import { invoke } from '@tauri-apps/api/core';
import { exists, stat } from '@tauri-apps/plugin-fs';
import { type } from 'arktype';
import { extractErrorMessage } from 'wellcrafted/error';
import { Ok, type Result, tryAsync } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import type { Settings } from '$lib/settings';
import { isModelFileSizeValid, type WhisperModelConfig } from './types';

/**
 * Pre-built Whisper models available for download from Hugging Face.
 * These are ggml-format models compatible with whisper.cpp.
 */
export const WHISPER_MODELS = [
	{
		id: 'tiny',
		name: 'Tiny',
		description: '最快,基础准确率',
		size: '78 MB',
		sizeBytes: 77_691_713,
		engine: 'whispercpp',
		file: {
			url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
			filename: 'ggml-tiny.bin',
		},
	},
	{
		id: 'small',
		name: 'Small',
		description: '快,准确率较好',
		size: '488 MB',
		sizeBytes: 487_601_967,
		engine: 'whispercpp',
		file: {
			url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
			filename: 'ggml-small.bin',
		},
	},
	{
		id: 'medium',
		name: 'Medium',
		description: '速度与准确率均衡',
		size: '1.5 GB',
		sizeBytes: 1_533_763_059,
		engine: 'whispercpp',
		file: {
			url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
			filename: 'ggml-medium.bin',
		},
	},
	{
		id: 'large-v3-turbo',
		name: 'Large v3 Turbo',
		description: '准确率最高,较慢',
		size: '1.6 GB',
		sizeBytes: 1_624_555_275,
		engine: 'whispercpp',
		file: {
			url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
			filename: 'ggml-large-v3-turbo.bin',
		},
	},
] as const satisfies readonly WhisperModelConfig[];

const WhisperCppErrorType = type({
	name: "'AudioReadError' | 'FfmpegNotFoundError' | 'GpuError' | 'ModelLoadError' | 'TranscriptionError'",
	message: 'string',
});

export function createWhisperCppTranscriptionService() {
	return {
		async transcribe(
			audioBlob: Blob,
			options: {
				outputLanguage: Settings['transcription.outputLanguage'];
				modelPath: string;
				prompt: Settings['transcription.prompt'];
			},
		): Promise<Result<string, WhisperingError>> {
			// Pre-validation
			if (!options.modelPath) {
				return WhisperingErr({
					title: '📁 需要模型文件',
					description: '请在设置中选择一个 Whisper 模型文件。',
					action: {
						type: 'link',
						label: '配置模型',
						href: '/settings/transcription',
					},
				});
			}

			// Check if model file exists
			const { data: isExists } = await tryAsync({
				try: () => exists(options.modelPath),
				catch: () => Ok(false),
			});

			if (!isExists) {
				return WhisperingErr({
					title: '❌ 未找到模型文件',
					description: `模型文件 "${options.modelPath}" 不存在。`,
					action: {
						type: 'link',
						label: '选择模型',
						href: '/settings/transcription',
					},
				});
			}

			// Check for corrupted/incomplete model files
			const modelConfig = WHISPER_MODELS.find((m) =>
				options.modelPath.endsWith(m.file.filename),
			);
			if (modelConfig) {
				const { data: fileStats } = await tryAsync({
					try: () => stat(options.modelPath),
					catch: () => Ok(null),
				});
				if (
					fileStats &&
					!isModelFileSizeValid(fileStats.size, modelConfig.sizeBytes)
				) {
					return WhisperingErr({
						title: '⚠️ 模型文件似乎已损坏',
						description: `模型文件大小为 ${Math.round(fileStats.size / 1000000)}MB,但应为 ~${Math.round(modelConfig.sizeBytes / 1000000)}MB。这通常是因为下载中断造成的。请删除并重新下载模型。`,
						action: {
							type: 'link',
							label: '重新下载模型',
							href: '/settings/transcription',
						},
					});
				}
			}

			// Convert audio blob to byte array
			const arrayBuffer = await audioBlob.arrayBuffer();
			const audioData = Array.from(new Uint8Array(arrayBuffer));

			// Call Tauri command to transcribe with whisper-cpp
			// Note: temperature is not supported by local models (transcribe-rs)
			const result = await tryAsync({
				try: () =>
					invoke<string>('transcribe_audio_whisper', {
						audioData: audioData,
						modelPath: options.modelPath,
						language:
							options.outputLanguage === 'auto' ? null : options.outputLanguage,
						initialPrompt: options.prompt || null,
					}),
				catch: (unknownError) => {
					const result = WhisperCppErrorType(unknownError);
					if (result instanceof type.errors) {
						return WhisperingErr({
							title: '❌ Whisper C++ 意外错误',
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

						case 'GpuError':
							return WhisperingErr({
								title: '🎮 GPU 错误',
								description: error.message,
								action: {
									type: 'link',
									label: '配置设置',
									href: '/settings/transcription',
								},
							});

						case 'FfmpegNotFoundError':
							return WhisperingErr({
								title: '🛠️ 此录音格式需要 FFmpeg',
								description:
									'此录音使用压缩格式(webm/ogg/mp4),需要 FFmpeg。请安装 FFmpeg 或切换到 CPAL 录制(可生成 WAV 文件,无需 FFmpeg 即可使用)。',
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
								title: '❌ Whisper C++ 错误',
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

export type WhisperCppTranscriptionService = ReturnType<
	typeof createWhisperCppTranscriptionService
>;

export const WhisperCppTranscriptionServiceLive =
	createWhisperCppTranscriptionService();
