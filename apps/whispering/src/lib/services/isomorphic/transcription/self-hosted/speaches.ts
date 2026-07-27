import { type } from 'arktype';
import { Ok, type Result } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import type { HttpService } from '$lib/services/isomorphic/http';
import { getAudioExtension } from '$lib/services/isomorphic/transcription/utils';
import type { Settings } from '$lib/settings';

const WhisperApiResponse = type({ text: 'string' }, '|', {
	error: { message: 'string' },
});

export function createSpeachesTranscriptionService({
	HttpService,
}: {
	HttpService: HttpService;
}) {
	return {
		transcribe: async (
			audioBlob: Blob,
			options: {
				prompt: string;
				temperature: string;
				outputLanguage: Settings['transcription.outputLanguage'];
				modelId: string;
				baseUrl: string;
			},
		): Promise<Result<string, WhisperingError>> => {
			const formData = new FormData();
			formData.append(
				'file',
				new File(
					[audioBlob],
					`recording.${getAudioExtension(audioBlob.type)}`,
					{ type: audioBlob.type },
				),
			);
			formData.append('model', options.modelId);
			if (options.outputLanguage !== 'auto') {
				formData.append('language', options.outputLanguage);
			}
			if (options.prompt) formData.append('prompt', options.prompt);
			if (options.temperature)
				formData.append('temperature', options.temperature);

			const { data: whisperApiResponse, error: postError } =
				await HttpService.post({
					url: `${options.baseUrl}/v1/audio/transcriptions`,
					body: formData,
					schema: WhisperApiResponse,
				});

			if (postError) {
				switch (postError.name) {
					case 'ConnectionError': {
						return WhisperingErr({
							title: '🌐 连接问题',
							description:
								'无法连接到转录服务。这可能是网络问题或服务临时中断。请稍后重试。',
							action: { type: 'more-details', error: postError },
						});
					}

					case 'ResponseError': {
						const {
							context: { status },
							message,
						} = postError;

						if (status === 401) {
							return WhisperingErr({
								title: '🔑 需要身份验证',
								description:
									'您的 API 密钥似乎无效或已过期。请在设置中更新您的 API 密钥以继续转录。',
								action: {
									type: 'link',
									label: '更新 API 密钥',
									href: '/settings/transcription',
								},
							});
						}

						if (status === 403) {
							return WhisperingErr({
								title: '⛔ 访问受限',
								description:
									"您的账户无权访问此功能。这可能是由于套餐限制或账户限制造成的。请检查您的账户状态。",
								action: { type: 'more-details', error: postError },
							});
						}

						if (status === 413) {
							return WhisperingErr({
								title: '📦 音频文件过大',
								description:
									'您的音频文件超过了最大大小限制(通常为 25MB)。请尝试将其分割成较小的片段或降低音频质量。',
								action: { type: 'more-details', error: postError },
							});
						}

						if (status === 415) {
							return WhisperingErr({
								title: '🎵 不支持的格式',
								description:
									"不支持此音频格式。请将您的文件转换为 MP3、WAV、M4A 或其他常见音频格式。",
								action: { type: 'more-details', error: postError },
							});
						}

						// Rate limiting
						if (status === 429) {
							return WhisperingErr({
								title: '⏱️ 已达速率限制',
								description: message,
								action: {
									type: 'link',
									label: '更新 API 密钥',
									href: '/settings/transcription',
								},
							});
						}

						if (status >= 500) {
							return WhisperingErr({
								title: '🔧 服务不可用',
								description: `转录服务暂时不可用(错误 ${status})。请几分钟后重试。`,
								action: { type: 'more-details', error: postError },
							});
						}

						return WhisperingErr({
							title: '❌ 请求失败',
							description: `请求失败,错误为 ${status}。这可能是临时的——请重试。如果问题持续存在,请联系支持。`,
							action: { type: 'more-details', error: postError },
						});
					}

					case 'ParseError':
						return WhisperingErr({
							title: '🔍 响应错误',
							description:
								'从转录服务收到意外响应。这通常是临时的——请重试。',
							action: { type: 'more-details', error: postError },
						});

					default:
						return WhisperingErr({
							title: '❓ 意外错误',
							description:
								'转录过程中发生了意外错误。请重试,如果问题持续存在,请联系支持。',
							action: { type: 'more-details', error: postError },
						});
				}
			}

			if ('error' in whisperApiResponse) {
				return WhisperingErr({
					title: '🔧 Speaches 连接问题',
					description: whisperApiResponse.error.message,
				});
			}

			return Ok(whisperApiResponse.text.trim());
		},
	};
}

export type SpeachesTranscriptionService = ReturnType<
	typeof createSpeachesTranscriptionService
>;

import { HttpServiceLive } from '$lib/services/isomorphic/http';

export const SpeachesTranscriptionServiceLive =
	createSpeachesTranscriptionService({
		HttpService: HttpServiceLive,
	});
