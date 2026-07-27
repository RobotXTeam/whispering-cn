import { invoke } from '@tauri-apps/api/core';
import { stat } from '@tauri-apps/plugin-fs';
import { regex } from 'arkregex';
import { type } from 'arktype';
import { extractErrorMessage } from 'wellcrafted/error';
import { Ok, type Result, tryAsync } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import {
	MOONSHINE_LANGUAGES,
	MOONSHINE_VARIANTS,
	type MoonshineLanguage,
	type MoonshineModelConfig,
	type MoonshineVariant,
} from './types';

/**
 * HuggingFace base URL for Moonshine models.
 * Models are distributed across different directories:
 * - ONNX models: onnx/merged/[variant]/quantized/
 * - Tokenizer: ctranslate2/tiny/ (shared across all models)
 */
const HF_BASE = 'https://huggingface.co/UsefulSensors/moonshine/resolve/main';

/**
 * Type-safe regex pattern for validating Moonshine model paths.
 * Matches paths ending with `moonshine-{variant}-{lang}`.
 *
 * Built from MOONSHINE_VARIANTS and MOONSHINE_LANGUAGES arrays for consistency.
 * The Rust side extracts variant from the path to determine model architecture.
 */
const MOONSHINE_DIR_PATTERN = regex.as<
	`${string}moonshine-${MoonshineVariant}-${MoonshineLanguage}`,
	{ captures: [MoonshineVariant, MoonshineLanguage] }
>(
	`moonshine-(${MOONSHINE_VARIANTS.join('|')})-(${MOONSHINE_LANGUAGES.join('|')})$`,
);

/**
 * Pre-built Moonshine models available for download from HuggingFace.
 * These are ONNX models using encoder-decoder architecture with KV caching.
 *
 * ## Directory Naming Convention
 *
 * Model directories MUST follow the format: `moonshine-{variant}-{lang}`
 * - variant: "tiny" or "base" (determines model architecture)
 * - lang: language code (e.g., "en", "ar", "zh")
 *
 * The Rust side extracts the variant from the directory name to determine
 * which MoonshineModelParams to use (tiny: 6 layers, base: 8 layers).
 *
 * ## Model Sizes
 *
 * - "tiny" models: 6 layers, head_dim=36 (~30 MB quantized)
 * - "base" models: 8 layers, head_dim=52 (~65 MB quantized)
 *
 * Note: Language-specific models (ar, zh, ja, ko, uk, vi, es) exist but only
 * have float versions available. We provide quantized English models for now
 * since they offer the best size/performance tradeoff.
 */
export const MOONSHINE_MODELS = [
	{
		id: 'moonshine-tiny-en',
		name: 'Moonshine Tiny (English)',
		description: '快速高效的英文转录(~28 MB)',
		size: '~30 MB',
		sizeBytes: 30_166_481, // encoder + decoder + tokenizer
		engine: 'moonshine',
		language: 'en',
		directoryName: 'moonshine-tiny-en',
		files: [
			{
				url: `${HF_BASE}/onnx/merged/tiny/quantized/encoder_model.onnx`,
				filename: 'encoder_model.onnx',
				sizeBytes: 7_937_661,
			},
			{
				url: `${HF_BASE}/onnx/merged/tiny/quantized/decoder_model_merged.onnx`,
				filename: 'decoder_model_merged.onnx',
				sizeBytes: 20_243_286,
			},
			{
				url: `${HF_BASE}/ctranslate2/tiny/tokenizer.json`,
				filename: 'tokenizer.json',
				sizeBytes: 1_985_534,
			},
		],
	},
	{
		id: 'moonshine-base-en',
		name: 'Moonshine Base (English)',
		description: '更高准确率的英文转录(~65 MB)',
		size: '~65 MB',
		sizeBytes: 64_997_467, // encoder + decoder + tokenizer
		engine: 'moonshine',
		language: 'en',
		directoryName: 'moonshine-base-en',
		files: [
			{
				url: `${HF_BASE}/onnx/merged/base/quantized/encoder_model.onnx`,
				filename: 'encoder_model.onnx',
				sizeBytes: 20_513_063,
			},
			{
				url: `${HF_BASE}/onnx/merged/base/quantized/decoder_model_merged.onnx`,
				filename: 'decoder_model_merged.onnx',
				sizeBytes: 42_498_870,
			},
			{
				url: `${HF_BASE}/ctranslate2/tiny/tokenizer.json`,
				filename: 'tokenizer.json',
				sizeBytes: 1_985_534,
			},
		],
	},
] as const satisfies readonly MoonshineModelConfig[];

const MoonshineErrorType = type({
	name: "'AudioReadError' | 'FfmpegNotFoundError' | 'ModelLoadError' | 'TranscriptionError'",
	message: 'string',
});

export function createMoonshineTranscriptionService() {
	return {
		async transcribe(
			audioBlob: Blob,
			{ modelPath }: { modelPath: string },
		): Promise<Result<string, WhisperingError>> {
			// Pre-validation
			if (!modelPath) {
				return WhisperingErr({
					title: '需要模型目录',
					description: '请在设置中选择一个 Moonshine 模型目录。',
					action: {
						type: 'link',
						label: '配置模型',
						href: '/settings/transcription',
					},
				});
			}

			// Check if model directory exists and is a directory (single I/O call)
			const { data: stats } = await tryAsync({
				try: () => stat(modelPath),
				catch: () => Ok(null),
			});

			if (!stats) {
				return WhisperingErr({
					title: '未找到模型目录',
					description: `模型目录 "${modelPath}" 不存在。`,
					action: {
						type: 'link',
						label: '选择模型',
						href: '/settings/transcription',
					},
				});
			}

			if (!stats.isDirectory) {
				return WhisperingErr({
					title: '模型路径无效',
					description:
						'Moonshine 模型必须是包含模型文件的目录。',
					action: {
						type: 'link',
						label: '选择模型目录',
						href: '/settings/transcription',
					},
				});
			}

			// Validate path ends with moonshine-{variant}-{lang}
			if (!MOONSHINE_DIR_PATTERN.test(modelPath)) {
				return WhisperingErr({
					title: '模型目录名无效',
					description: `模型路径必须以 moonshine-{variant}-{lang} 结尾(例如,"moonshine-tiny-en"、"moonshine-base-en")`,
					action: {
						type: 'link',
						label: '选择有效模型',
						href: '/settings/transcription',
					},
				});
			}

			// Convert audio blob to byte array
			const arrayBuffer = await audioBlob.arrayBuffer();
			const audioData = Array.from(new Uint8Array(arrayBuffer));

			// Call Tauri command to transcribe with Moonshine
			// The Rust side extracts variant from the model path directory name
			const result = await tryAsync({
				try: () =>
					invoke<string>('transcribe_audio_moonshine', {
						audioData,
						modelPath,
					}),
				catch: (unknownError) => {
					const result = MoonshineErrorType(unknownError);
					if (result instanceof type.errors) {
						return WhisperingErr({
							title: 'Moonshine 意外错误',
							description: extractErrorMessage(unknownError),
							action: { type: 'more-details', error: unknownError },
						});
					}
					const error = result;

					switch (error.name) {
						case 'ModelLoadError':
							return WhisperingErr({
								title: '模型加载错误',
								description: error.message,
								action: {
									type: 'more-details',
									error: new Error(error.message),
								},
							});

						case 'FfmpegNotFoundError':
							return WhisperingErr({
								title: '未安装 FFmpeg',
								description:
									'Moonshine 需要 FFmpeg 来转换音频格式。请安装 FFmpeg 或切换到 16kHz 的 CPAL 录制。',
								action: {
									type: 'link',
									label: '安装 FFmpeg',
									href: '/install-ffmpeg',
								},
							});

						case 'AudioReadError':
							return WhisperingErr({
								title: '音频读取错误',
								description: error.message,
								action: {
									type: 'more-details',
									error: new Error(error.message),
								},
							});

						case 'TranscriptionError':
							return WhisperingErr({
								title: '转录错误',
								description: error.message,
								action: {
									type: 'more-details',
									error: new Error(error.message),
								},
							});

						default:
							return WhisperingErr({
								title: 'Moonshine 错误',
								description: '发生了意外错误。',
								action: {
									type: 'more-details',
									error: new Error(String(error)),
								},
							});
					}
				},
			});

			return result;
		},
	};
}

export type MoonshineTranscriptionService = ReturnType<
	typeof createMoonshineTranscriptionService
>;

export const MoonshineTranscriptionServiceLive =
	createMoonshineTranscriptionService();
