import { invoke } from '@tauri-apps/api/core';
import { exists, stat } from '@tauri-apps/plugin-fs';
import { type } from 'arktype';
import { extractErrorMessage } from 'wellcrafted/error';
import { Ok, type Result, tryAsync } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import type { ParakeetModelConfig } from './types';

/**
 * Pre-built Parakeet models available for download from GitHub releases.
 * These are NVIDIA NeMo models consisting of multiple ONNX files.
 */
export const PARAKEET_MODELS = [
	{
		id: 'parakeet-tdt-0.6b-v3-int8',
		name: 'Parakeet TDT 0.6B v3 (INT8)',
		description: '快速且准确的 NVIDIA NeMo 模型',
		size: '~670 MB',
		sizeBytes: 670_619_803, // Total size of all individual files
		engine: 'parakeet',
		directoryName: 'parakeet-tdt-0.6b-v3-int8',
		files: [
			{
				url: 'https://github.com/EpicenterHQ/epicenter/releases/download/models/parakeet-tdt-0.6b-v3-int8/config.json',
				filename: 'config.json',
				sizeBytes: 97,
			},
			{
				url: 'https://github.com/EpicenterHQ/epicenter/releases/download/models/parakeet-tdt-0.6b-v3-int8/decoder_joint-model.int8.onnx',
				filename: 'decoder_joint-model.int8.onnx',
				sizeBytes: 18_202_004,
			},
			{
				url: 'https://github.com/EpicenterHQ/epicenter/releases/download/models/parakeet-tdt-0.6b-v3-int8/encoder-model.int8.onnx',
				filename: 'encoder-model.int8.onnx',
				sizeBytes: 652_183_999,
			},
			{
				url: 'https://github.com/EpicenterHQ/epicenter/releases/download/models/parakeet-tdt-0.6b-v3-int8/nemo128.onnx',
				filename: 'nemo128.onnx',
				sizeBytes: 139_764,
			},
			{
				url: 'https://github.com/EpicenterHQ/epicenter/releases/download/models/parakeet-tdt-0.6b-v3-int8/vocab.txt',
				filename: 'vocab.txt',
				sizeBytes: 93_939,
			},
		],
	},
] as const satisfies readonly ParakeetModelConfig[];

const ParakeetErrorType = type({
	name: "'AudioReadError' | 'FfmpegNotFoundError' | 'ModelLoadError' | 'TranscriptionError'",
	message: 'string',
});

export function createParakeetTranscriptionService() {
	return {
		async transcribe(
			audioBlob: Blob,
			options: { modelPath: string },
		): Promise<Result<string, WhisperingError>> {
			// Pre-validation
			if (!options.modelPath) {
				return WhisperingErr({
					title: '📁 需要模型目录',
					description: '请在设置中选择一个 Parakeet 模型目录。',
					action: {
						type: 'link',
						label: '配置模型',
						href: '/settings/transcription',
					},
				});
			}

			// Check if model directory exists
			const { data: isExists } = await tryAsync({
				try: () => exists(options.modelPath),
				catch: () => Ok(false),
			});

			if (!isExists) {
				return WhisperingErr({
					title: '❌ 未找到模型目录',
					description: `模型目录 "${options.modelPath}" 不存在。`,
					action: {
						type: 'link',
						label: '选择模型',
						href: '/settings/transcription',
					},
				});
			}

			// Check if it's actually a directory
			const { data: stats } = await tryAsync({
				try: () => stat(options.modelPath),
				catch: () => Ok(null),
			});

			if (!stats || !stats.isDirectory) {
				return WhisperingErr({
					title: '❌ 模型路径无效',
					description:
						'Parakeet 模型必须是包含模型文件的目录。',
					action: {
						type: 'link',
						label: '选择模型目录',
						href: '/settings/transcription',
					},
				});
			}

			// Convert audio blob to byte array
			const arrayBuffer = await audioBlob.arrayBuffer();
			const audioData = Array.from(new Uint8Array(arrayBuffer));

			// Call Tauri command to transcribe with Parakeet
			// Note: Parakeet doesn't support language selection, temperature, or prompt
			const result = await tryAsync({
				try: () =>
					invoke<string>('transcribe_audio_parakeet', {
						audioData: audioData,
						modelPath: options.modelPath,
					}),
				catch: (unknownError) => {
					const result = ParakeetErrorType(unknownError);
					if (result instanceof type.errors) {
						return WhisperingErr({
							title: '❌ Parakeet 意外错误',
							description: extractErrorMessage(unknownError),
							action: { type: 'more-details', error: unknownError },
						});
					}
					const error = result;

					switch (error.name) {
						case 'ModelLoadError':
							return WhisperingErr({
								title: '🤖 模型加载错误',
								description: error.message,
								action: {
									type: 'more-details',
									error: new Error(error.message),
								},
							});

						case 'FfmpegNotFoundError':
							return WhisperingErr({
								title: '🛠️ 未安装 FFmpeg',
								description:
									'Parakeet 需要 FFmpeg 来转换音频格式。请安装 FFmpeg 或切换到 16kHz 的 CPAL 录制。',
								action: {
									type: 'link',
									label: '安装 FFmpeg',
									href: '/install-ffmpeg',
								},
							});

						case 'AudioReadError':
							return WhisperingErr({
								title: '🔊 音频读取错误',
								description: error.message,
								action: {
									type: 'more-details',
									error: new Error(error.message),
								},
							});

						case 'TranscriptionError':
							return WhisperingErr({
								title: '❌ 转录错误',
								description: error.message,
								action: {
									type: 'more-details',
									error: new Error(error.message),
								},
							});

						default:
							return WhisperingErr({
								title: '❌ Parakeet 错误',
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

export type ParakeetTranscriptionService = ReturnType<
	typeof createParakeetTranscriptionService
>;

export const ParakeetTranscriptionServiceLive =
	createParakeetTranscriptionService();
