import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import Groq from 'groq-sdk';
import { Err, Ok, type Result, tryAsync, trySync } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import { getAudioExtension } from '$lib/services/isomorphic/transcription/utils';
import type { Settings } from '$lib/settings';

const customFetch = window.__TAURI_INTERNALS__ ? tauriFetch : undefined;
export const GROQ_MODELS = [
	{
		name: 'whisper-large-v3',
		description:
			'准确度最佳(10.3% WER),支持完整多语言,包括翻译。推荐用于对错误敏感且需要多语言支持的应用。',
		cost: '$0.111/hour',
	},
	{
		name: 'whisper-large-v3-turbo',
		description:
			'快速多语言模型,准确度良好(12% WER)。多语言应用的最佳性价比之选。',
		cost: '$0.04/hour',
	},
] as const;

export type GroqModel = (typeof GROQ_MODELS)[number];

const MAX_FILE_SIZE_MB = 25 as const;

export function createGroqTranscriptionService() {
	return {
		async transcribe(
			audioBlob: Blob,
			options: {
				prompt: string;
				temperature: string;
				outputLanguage: Settings['transcription.outputLanguage'];
				apiKey: string;
				modelName: (string & {}) | GroqModel['name'];
				baseURL?: string;
			},
		): Promise<Result<string, WhisperingError>> {
			const isUsingCustomEndpoint = Boolean(options.baseURL);

			// When no custom baseURL is provided, we're using the official Groq API.
			// The official API has strict requirements:
			// 1. An API key is always required
			// 2. The key must follow Groq's format (starts with "gsk_" or "xai-")
			//
			// Custom endpoints (reverse proxies, Groq-compatible servers, etc.) may have
			// different authentication schemes or no auth at all, so we skip these checks.
			if (!isUsingCustomEndpoint) {
				// Check 1: Official Groq API requires an API key
				if (!options.apiKey) {
					return WhisperingErr({
						title: '🔑 需要API密钥',
						description: '请在设置中输入您的 Groq API 密钥。',
						action: {
							type: 'link',
							label: '添加 API 密钥',
							href: '/settings/transcription',
						},
					});
				}

				// Check 2: Official Groq API keys start with "gsk_" or "xai-"
				const hasValidGroqKeyFormat =
					options.apiKey.startsWith('gsk_') ||
					options.apiKey.startsWith('xai-');

				if (!hasValidGroqKeyFormat) {
					return WhisperingErr({
						title: '🔑 API 密钥格式无效',
						description:
							'您的 Groq API 密钥应以 "gsk_" 或 "xai-" 开头。请检查并更新您的 API 密钥。',
						action: {
							type: 'link',
							label: '更新 API 密钥',
							href: '/settings/transcription',
						},
					});
				}
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
			const { data: transcription, error: groqApiError } = await tryAsync({
				try: () =>
					new Groq({
						apiKey: options.apiKey,
						dangerouslyAllowBrowser: true,
						fetch: customFetch,
						...(options.baseURL && { baseURL: options.baseURL }),
					}).audio.transcriptions.create({
						file,
						model: options.modelName,
						language:
							options.outputLanguage === 'auto'
								? undefined
								: options.outputLanguage,
						prompt: options.prompt ? options.prompt : undefined,
						temperature: options.temperature
							? Number.parseFloat(options.temperature)
							: undefined,
					}),
				catch: (error) => {
					// Check if it's NOT a Groq API error
					if (!(error instanceof Groq.APIError)) {
						// This is an unexpected error type
						throw error;
					}
					// Return the error directly
					return Err(error);
				},
			});

			if (groqApiError) {
				// Error handling follows https://www.npmjs.com/package/groq-sdk#error-handling
				const { status, name, message, error } = groqApiError;

				// 400 - BadRequestError
				if (status === 400) {
					return WhisperingErr({
						title: '❌ 请求无效',
						description:
							message ??
							`对 Groq API 的请求无效。${error?.message ?? ''}`.trim(),
						action: { type: 'more-details', error: groqApiError },
					});
				}

				// 401 - AuthenticationError
				if (status === 401) {
					return WhisperingErr({
						title: '🔑 需要认证',
						description:
							message ??
							'您的 API 密钥似乎无效或已过期。请在设置中更新您的 API 密钥以继续转录。',
						action: {
							type: 'link',
							label: '更新 API 密钥',
							href: '/settings/transcription',
						},
					});
				}

				// 403 - PermissionDeniedError
				if (status === 403) {
					return WhisperingErr({
						title: '⛔ 权限被拒绝',
						description:
							message ??
							'您的账户无权访问此功能。可能是由于套餐限制或账户限制。',
						action: { type: 'more-details', error: groqApiError },
					});
				}

				// 404 - NotFoundError
				if (status === 404) {
					return WhisperingErr({
						title: '🔍 未找到',
						description:
							message ??
							'未找到请求的资源。这可能表示模型或 API 端点存在问题。',
						action: { type: 'more-details', error: groqApiError },
					});
				}

				// 422 - UnprocessableEntityError
				if (status === 422) {
					return WhisperingErr({
						title: '⚠️ 输入无效',
						description:
							message ??
							'请求有效,但服务器无法处理。请检查您的音频文件和参数。',
						action: {
							type: 'link',
							label: '更新 API 密钥',
							href: '/settings/transcription',
						},
					});
				}

				// 429 - RateLimitError
				if (status === 429) {
					return WhisperingErr({
						title: '⏱️ 已达请求频率限制',
						description:
							message ?? '请求过于频繁。请稍后重试。',
						action: {
							type: 'link',
							label: '更新 API 密钥',
							href: '/settings/transcription',
						},
					});
				}

				// >=500 - InternalServerError
				if (status && status >= 500) {
					return WhisperingErr({
						title: '🔧 服务不可用',
						description:
							message ??
							`转录服务暂时不可用(错误 ${status})。请稍后重试。`,
						action: { type: 'more-details', error: groqApiError },
					});
				}

				// Handle APIConnectionError (no status code)
				if (!status && name === 'APIConnectionError') {
					return WhisperingErr({
						title: '🌐 连接问题',
						description:
							message ??
							'无法连接到 Groq 服务。这可能是网络问题或服务暂时中断。',
						action: { type: 'more-details', error: groqApiError },
					});
				}

				// Return the error directly for other API errors
				return WhisperingErr({
					title: '❌ 意外错误',
					description:
						message ?? '发生了意外错误。请重试。',
					action: { type: 'more-details', error: groqApiError },
				});
			}

			return Ok(transcription.text.trim());
		},
	};
}

export type GroqTranscriptionService = ReturnType<
	typeof createGroqTranscriptionService
>;

export const GroqTranscriptionServiceLive = createGroqTranscriptionService();
