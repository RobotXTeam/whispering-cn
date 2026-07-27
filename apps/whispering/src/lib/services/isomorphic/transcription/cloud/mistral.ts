import { Mistral } from '@mistralai/mistralai';
import { Err, Ok, type Result, tryAsync, trySync } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import { getAudioExtension } from '$lib/services/isomorphic/transcription/utils';
import type { Settings } from '$lib/settings';
export const MISTRAL_TRANSCRIPTION_MODELS = [
	{
		name: 'voxtral-mini-latest',
		description:
			'API 优化的 Voxtral Mini 模型,提供无与伦比的成本和延迟效率。支持高准确度的多语言转录。',
		cost: '$0.12/hour',
	},
	{
		name: 'voxtral-small-latest',
		description:
			'Voxtral Small 模型,具备更高的准确度和更广泛的语言支持。适合大多数转录需求,在成本与性能之间取得平衡。',
		cost: '$0.24/hour',
	},
] as const;

export type MistralModel = (typeof MISTRAL_TRANSCRIPTION_MODELS)[number];

const MAX_FILE_SIZE_MB = 25 as const;

export function createMistralTranscriptionService() {
	return {
		async transcribe(
			audioBlob: Blob,
			options: {
				prompt: string;
				temperature: string;
				outputLanguage: Settings['transcription.outputLanguage'];
				apiKey: string;
				modelName: (string & {}) | MistralModel['name'];
			},
		): Promise<Result<string, WhisperingError>> {
			// Pre-validate API key
			if (!options.apiKey) {
				return WhisperingErr({
					title: '🔑 需要API密钥',
					description: '请在设置中输入您的 Mistral API 密钥。',
					action: {
						type: 'link',
						label: '添加 API 密钥',
						href: '/settings/transcription',
					},
				});
			}

			// Check file size
			const blobSizeInMb = audioBlob.size / (1024 * 1024);
			if (blobSizeInMb > MAX_FILE_SIZE_MB) {
				return WhisperingErr({
					title: `文件大小 (${blobSizeInMb}MB) 过大`,
					description: `请上传小于 ${MAX_FILE_SIZE_MB}MB 的文件。`,
				});
			}

			// Create file from blob
			const { data: file, error: fileError } = trySync({
				try: () =>
					new File(
						[audioBlob],
						`recording.${getAudioExtension(audioBlob.type)}`,
						{ type: audioBlob.type },
					),
				catch: (error) =>
					WhisperingErr({
						title: '📄 文件创建失败',
						description:
							'为转录创建音频文件失败。请重试。',
						action: { type: 'more-details', error },
					}),
			});

			if (fileError) return Err(fileError);

			// Make the transcription request
			const { data: transcription, error: mistralApiError } = await tryAsync({
				try: () =>
					new Mistral({
						apiKey: options.apiKey,
					}).audio.transcriptions.complete({
						file,
						model: options.modelName,
						language:
							options.outputLanguage !== 'auto'
								? options.outputLanguage
								: undefined,
						temperature: options.temperature
							? Number.parseFloat(options.temperature)
							: undefined,
					}),
				catch: (error) => {
					// Return the error directly for processing
					return Err(error);
				},
			});

			if (mistralApiError) {
				// Handle Mistral API errors
				const errorMessage =
					mistralApiError instanceof Error
						? mistralApiError.message
						: '发生了未知错误';

				// Check for common HTTP status codes
				if (
					errorMessage.includes('401') ||
					errorMessage.includes('Unauthorized')
				) {
					return WhisperingErr({
						title: '🔑 需要认证',
						description:
							'您的 API 密钥似乎无效或已过期。请在设置中更新您的 API 密钥。',
						action: {
							type: 'link',
							label: '更新 API 密钥',
							href: '/settings/transcription',
						},
					});
				}

				if (
					errorMessage.includes('429') ||
					errorMessage.includes('rate limit')
				) {
					return WhisperingErr({
						title: '⏱️ 已达请求频率限制',
						description: '请求过于频繁。请稍后重试。',
						action: { type: 'more-details', error: mistralApiError },
					});
				}

				if (
					errorMessage.includes('413') ||
					errorMessage.includes('too large')
				) {
					return WhisperingErr({
						title: '📦 音频文件过大',
						description:
							'您的音频文件超过了最大大小限制。请尝试减小文件大小。',
						action: { type: 'more-details', error: mistralApiError },
					});
				}

				// Generic error fallback
				return WhisperingErr({
					title: '❌ 转录失败',
					description: errorMessage,
					action: { type: 'more-details', error: mistralApiError },
				});
			}

			// Check if transcription is valid
			if (!transcription || typeof transcription.text !== 'string') {
				return WhisperingErr({
					title: '❌ 无效的转录响应',
					description: 'Mistral API 返回了无效的响应格式。',
				});
			}

			return Ok(transcription.text.trim());
		},
	};
}

export type MistralTranscriptionService = ReturnType<
	typeof createMistralTranscriptionService
>;

export const MistralTranscriptionServiceLive =
	createMistralTranscriptionService();
