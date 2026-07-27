import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import OpenAI from 'openai';
import { Err, Ok, type Result, tryAsync, trySync } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import { getAudioExtension } from '$lib/services/isomorphic/transcription/utils';
import type { Settings } from '$lib/settings';

const customFetch = window.__TAURI_INTERNALS__ ? tauriFetch : undefined;

export const OPENAI_TRANSCRIPTION_MODELS = [
	{
		name: 'whisper-1',
		description:
			'OpenAI 旗舰级语音转文本模型,支持多语言。适用于各种用例,提供可靠且准确的转录。',
		cost: '$0.36/hour',
	},
	{
		name: 'gpt-4o-transcribe',
		description:
			'由 GPT-4o 驱动的转录,具备增强的理解和上下文能力。最适合需要深度理解的复杂音频。',
		cost: '$0.36/hour',
	},
	{
		name: 'gpt-4o-mini-transcribe',
		description:
			'高性价比的 GPT-4o mini 转录模型。在性能与成本之间取得良好平衡,适合标准转录需求。',
		cost: '$0.18/hour',
	},
] as const satisfies {
	name: OpenAI.Audio.AudioModel;
	description: string;
	cost: string;
}[];

export type OpenAIModel = (typeof OPENAI_TRANSCRIPTION_MODELS)[number];

const MAX_FILE_SIZE_MB = 25 as const;

export function createOpenaiTranscriptionService() {
	return {
		async transcribe(
			audioBlob: Blob,
			options: {
				prompt: string;
				temperature: string;
				outputLanguage: Settings['transcription.outputLanguage'];
				apiKey: string;
				modelName: (string & {}) | OpenAIModel['name'];
				baseURL?: string;
			},
		): Promise<Result<string, WhisperingError>> {
			const isUsingCustomEndpoint = Boolean(options.baseURL);

			// When no custom baseURL is provided, we're using the official OpenAI API.
			// The official API has strict requirements:
			// 1. An API key is always required
			// 2. The key must follow OpenAI's format (starts with "sk-")
			//
			// Custom endpoints (reverse proxies, OpenAI-compatible servers, etc.) may have
			// different authentication schemes or no auth at all, so we skip these checks.
			if (!isUsingCustomEndpoint) {
				// Check 1: Official OpenAI API requires an API key
				if (!options.apiKey) {
					return WhisperingErr({
						title: '🔑 需要API密钥',
						description:
							'请在设置中输入您的 OpenAI API 密钥以使用 Whisper 转录。',
						action: {
							type: 'link',
							label: '添加 API 密钥',
							href: '/settings/transcription',
						},
					});
				}

				// Check 2: Official OpenAI API keys always start with "sk-"
				if (!options.apiKey.startsWith('sk-')) {
					return WhisperingErr({
						title: '🔑 API 密钥格式无效',
						description:
							'您的 OpenAI API 密钥应以 "sk-" 开头。请检查并更新您的 API 密钥。',
						action: {
							type: 'link',
							label: '更新 API 密钥',
							href: '/settings/transcription',
						},
					});
				}
			}

			// Validate file size
			const blobSizeInMb = audioBlob.size / (1024 * 1024);
			if (blobSizeInMb > MAX_FILE_SIZE_MB) {
				return WhisperingErr({
					title: `文件大小 (${blobSizeInMb}MB) 过大`,
					description: `请上传小于 ${MAX_FILE_SIZE_MB}MB 的文件。`,
				});
			}

			// Create File object from blob
			const { data: file, error: fileError } = trySync({
				try: () =>
					new File(
						[audioBlob],
						`recording.${getAudioExtension(audioBlob.type)}`,
						{ type: audioBlob.type },
					),
				catch: (_error) =>
					WhisperingErr({
						title: '📁 文件创建失败',
						description:
							'为转录创建音频文件失败。请重试。',
					}),
			});

			if (fileError) return Err(fileError);

			// Call OpenAI API
			const { data: transcription, error: openaiApiError } = await tryAsync({
				try: () =>
					new OpenAI({
						apiKey: options.apiKey,
						dangerouslyAllowBrowser: true,
						fetch: customFetch,
						...(options.baseURL && { baseURL: options.baseURL }),
					}).audio.transcriptions.create({
						file,
						model: options.modelName,
						language:
							options.outputLanguage !== 'auto'
								? options.outputLanguage
								: undefined,
						prompt: options.prompt || undefined,
						temperature: options.temperature
							? Number.parseFloat(options.temperature)
							: undefined,
					}),
				catch: (error) => {
					// Check if it's NOT an OpenAI API error
					if (!(error instanceof OpenAI.APIError)) {
						// This is an unexpected error type
						throw error;
					}
					// Return the error directly
					return Err(error);
				},
			});

			if (openaiApiError) {
				// Error handling follows https://www.npmjs.com/package/openai#error-handling
				const { status, name, message, error } = openaiApiError;

				// 400 - BadRequestError
				if (status === 400) {
					return WhisperingErr({
						title: '❌ 请求无效',
						description:
							message ??
							`对 OpenAI API 的请求无效。${error?.message ?? ''}`.trim(),
						action: { type: 'more-details', error: openaiApiError },
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
						action: { type: 'more-details', error: openaiApiError },
					});
				}

				// 404 - NotFoundError
				if (status === 404) {
					return WhisperingErr({
						title: '🔍 未找到',
						description:
							message ??
							'未找到请求的资源。这可能表示模型或 API 端点存在问题。',
						action: { type: 'more-details', error: openaiApiError },
					});
				}

				// 413 - Request Entity Too Large
				if (status === 413) {
					return WhisperingErr({
						title: '📦 音频文件过大',
						description:
							message ??
							'您的音频文件超过了最大大小限制 (25MB)。请尝试将其分割成更小的片段或降低音频质量。',
						action: { type: 'more-details', error: openaiApiError },
					});
				}

				// 415 - Unsupported Media Type
				if (status === 415) {
					return WhisperingErr({
						title: '🎵 不支持的格式',
						description:
							message ??
							'不支持此音频格式。请将您的文件转换为 MP3、WAV、M4A 或其他常见音频格式。',
						action: { type: 'more-details', error: openaiApiError },
					});
				}

				// 422 - UnprocessableEntityError
				if (status === 422) {
					return WhisperingErr({
						title: '⚠️ 输入无效',
						description:
							message ??
							'请求有效,但服务器无法处理。请检查您的音频文件和参数。',
						action: { type: 'more-details', error: openaiApiError },
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
						action: { type: 'more-details', error: openaiApiError },
					});
				}

				// Handle APIConnectionError (no status code)
				if (!status && name === 'APIConnectionError') {
					return WhisperingErr({
						title: '🌐 连接问题',
						description:
							message ??
							'无法连接到 OpenAI 服务。这可能是网络问题或服务暂时中断。',
						action: { type: 'more-details', error: openaiApiError },
					});
				}

				// Return the error directly for other API errors
				return WhisperingErr({
					title: '❌ 意外错误',
					description:
						message ?? '发生了意外错误。请重试。',
					action: { type: 'more-details', error: openaiApiError },
				});
			}

			// Success - return the transcription text
			return Ok(transcription.text.trim());
		},
	};
}

export type OpenaiTranscriptionService = ReturnType<
	typeof createOpenaiTranscriptionService
>;

export const OpenaiTranscriptionServiceLive =
	createOpenaiTranscriptionService();
