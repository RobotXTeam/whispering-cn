import { type } from 'arktype';
import { Ok, type Result } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import type { HttpService } from '$lib/services/isomorphic/http';
import { HttpServiceLive } from '$lib/services/isomorphic/http';
import type { Settings } from '$lib/settings';

export const DEEPGRAM_TRANSCRIPTION_MODELS = [
	{
		name: 'nova-3',
		description:
			'Deepgram 最先进的语音转文本模型,具备卓越的准确度和速度。最适合高精度转录需求。',
		cost: '$0.0043/minute',
	},
	{
		name: 'nova-2',
		description: 'Deepgram 此前最佳的语音转文本模型。',
		cost: '$0.0043/minute',
	},
	{
		name: 'nova',
		description:
			'Deepgram Nova 模型,具备出色的准确度和性能。速度与质量的良好平衡。',
		cost: '$0.0043/minute',
	},
	{
		name: 'enhanced',
		description:
			'增强型通用模型,对大多数用例具备良好的准确度。高性价比之选。',
		cost: '$0.0025/minute',
	},
	{
		name: 'base',
		description:
			'满足标准转录需求的基础模型。最具性价比,准确度合理。',
		cost: '$0.0020/minute',
	},
] as const satisfies {
	name: string;
	description: string;
	cost: string;
}[];

export type DeepgramModel = (typeof DEEPGRAM_TRANSCRIPTION_MODELS)[number];

const MAX_FILE_SIZE_MB = 500 as const; // Deepgram supports larger files

// Schema for Deepgram API response
const DeepgramResponse = type({
	results: {
		channels: type({
			alternatives: type({
				transcript: 'string',
				'confidence?': 'number',
			}).array(),
		}).array(),
	},
});

export function createDeepgramTranscriptionService({
	HttpService,
}: {
	HttpService: HttpService;
}) {
	return {
		async transcribe(
			audioBlob: Blob,
			options: {
				prompt: string;
				temperature: string;
				outputLanguage: Settings['transcription.outputLanguage'];
				apiKey: string;
				modelName: (string & {}) | DeepgramModel['name'];
			},
		): Promise<Result<string, WhisperingError>> {
			// Pre-validation: Check API key
			if (!options.apiKey) {
				return WhisperingErr({
					title: '🔑 需要API密钥',
					description:
						'请在设置中输入您的 Deepgram API 密钥以使用 Deepgram 转录。',
					action: {
						type: 'link',
						label: '添加 API 密钥',
						href: '/settings/transcription',
					},
				});
			}

			// Validate file size
			const blobSizeInMb = audioBlob.size / (1024 * 1024);
			if (blobSizeInMb > MAX_FILE_SIZE_MB) {
				return WhisperingErr({
					title: `文件大小 (${blobSizeInMb}MB) 过大`,
					description: `请上传小于 ${MAX_FILE_SIZE_MB}MB 的文件。`,
				});
			}

			// Build query parameters
			const params = new URLSearchParams({
				model: options.modelName,
				smart_format: 'true',
				punctuate: 'true',
				paragraphs: 'true',
			});

			if (options.outputLanguage !== 'auto') {
				params.append('language', options.outputLanguage);
			}

			if (options.prompt) {
				const isNova3 = options.modelName.toLowerCase().includes('nova-3');
				params.append(isNova3 ? 'keyterm' : 'keywords', options.prompt);
			}

			// Send raw audio data directly as recommended by Deepgram docs
			const { data: deepgramResponse, error: postError } =
				await HttpService.post({
					url: `https://api.deepgram.com/v1/listen?${params.toString()}`,
					body: audioBlob, // Send raw audio blob directly
					headers: {
						Authorization: `Token ${options.apiKey}`,
						'Content-Type': audioBlob.type || 'audio/*', // Use the blob's mime type or fallback to audio/*
					},
					schema: DeepgramResponse,
				});

			if (postError) {
				switch (postError.name) {
					case 'ConnectionError': {
						return WhisperingErr({
							title: '🌐 连接问题',
							description:
								'无法连接到 Deepgram 服务。请检查您的网络连接。',
							action: { type: 'more-details', error: postError },
						});
					}

					case 'ResponseError': {
						const {
							context: { status },
							message,
						} = postError;

						if (status === 400) {
							return WhisperingErr({
								title: '❌ 请求无效',
								description:
									message ||
									'请求参数无效。请检查您的音频文件和设置。',
								action: { type: 'more-details', error: postError },
							});
						}

						if (status === 401) {
							return WhisperingErr({
								title: '🔑 认证失败',
								description:
									'您的 Deepgram API 密钥无效或已过期。请在设置中更新您的 API 密钥。',
								action: {
									type: 'link',
									label: '更新 API 密钥',
									href: '/settings/transcription',
								},
							});
						}

						if (status === 403) {
							return WhisperingErr({
								title: '⛔ 访问被拒绝',
								description:
									message ||
									'您的账户无权访问此功能或模型。',
								action: { type: 'more-details', error: postError },
							});
						}

						if (status === 413) {
							return WhisperingErr({
								title: '📦 音频文件过大',
								description:
									'您的音频文件超过了最大大小限制。请尝试将其分割成更小的片段。',
								action: { type: 'more-details', error: postError },
							});
						}

						if (status === 415) {
							return WhisperingErr({
								title: '🎵 不支持的格式',
								description:
									'不支持此音频格式。请将您的文件转换为支持的格式。',
								action: { type: 'more-details', error: postError },
							});
						}

						if (status === 429) {
							return WhisperingErr({
								title: '⏱️ 已达请求频率限制',
								description:
									'请求过于频繁。请稍后再试。',
								action: { type: 'more-details', error: postError },
							});
						}

						if (status && status >= 500) {
							return WhisperingErr({
								title: '🔧 服务不可用',
								description: `Deepgram 服务暂时不可用(错误 ${status})。请稍后重试。`,
								action: { type: 'more-details', error: postError },
							});
						}

						return WhisperingErr({
							title: '❌ 转录失败',
							description:
								message ||
								'转录过程中发生了意外错误。请重试。',
							action: { type: 'more-details', error: postError },
						});
					}

					case 'ParseError':
						return WhisperingErr({
							title: '🔍 响应错误',
							description:
								'从 Deepgram 服务收到了意外的响应。请重试。',
							action: { type: 'more-details', error: postError },
						});

					default:
						return WhisperingErr({
							title: '❓ 意外错误',
							description:
								'转录过程中发生了意外错误。请重试。',
							action: { type: 'more-details', error: postError },
						});
				}
			}

			// Extract transcription text
			const transcript = deepgramResponse.results?.channels
				?.at(0)
				?.alternatives?.at(0)?.transcript;

			if (!transcript) {
				return WhisperingErr({
					title: '📝 未找到转录文本',
					description:
						'在音频文件中未检测到语音。请检查您的音频后重试。',
				});
			}

			return Ok(transcript.trim());
		},
	};
}

export type DeepgramTranscriptionService = ReturnType<
	typeof createDeepgramTranscriptionService
>;

export const DeepgramTranscriptionServiceLive =
	createDeepgramTranscriptionService({
		HttpService: HttpServiceLive,
	});
