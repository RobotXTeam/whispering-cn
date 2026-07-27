import { ElevenLabsClient } from 'elevenlabs';
import { Ok, type Result } from 'wellcrafted/result';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import type { Settings } from '$lib/settings';

export const ELEVENLABS_TRANSCRIPTION_MODELS = [
	{
		name: 'scribe_v1',
		description:
			'全球最准确的转录模型,英语准确度达 96.7%。支持 99 种语言,提供词级时间戳和说话人分离。',
		cost: '$0.40/hour',
	},
	{
		name: 'scribe_v1_experimental',
		description:
			'Scribe 的实验版本,包含最新功能与改进。可能包含前沿能力,但存在潜在不稳定性。',
		cost: '$0.40/hour',
	},
] as const;

export type ElevenLabsModel = (typeof ELEVENLABS_TRANSCRIPTION_MODELS)[number];

export function createElevenLabsTranscriptionService() {
	return {
		transcribe: async (
			audioBlob: Blob,
			options: {
				prompt: string;
				temperature: string;
				outputLanguage: Settings['transcription.outputLanguage'];
				apiKey: string;
				modelName: (string & {}) | ElevenLabsModel['name'];
			},
		): Promise<Result<string, WhisperingError>> => {
			if (!options.apiKey) {
				return WhisperingErr({
					title: '🔑 需要API密钥',
					description:
						'请在设置中输入您的 ElevenLabs API 密钥以使用语音转文本转录。',
					action: {
						type: 'link',
						label: '添加 API 密钥',
						href: '/settings/transcription',
					},
				});
			}

			try {
				const client = new ElevenLabsClient({
					apiKey: options.apiKey,
				});

				// Check file size
				const blobSizeInMb = audioBlob.size / (1024 * 1024);
				const MAX_FILE_SIZE_MB = 1000; // ElevenLabs allows files up to 1GB

				if (blobSizeInMb > MAX_FILE_SIZE_MB) {
					return WhisperingErr({
						title: '📁 文件大小过大',
						description: `您的音频文件 (${blobSizeInMb.toFixed(1)}MB) 超过了 ${MAX_FILE_SIZE_MB}MB 的限制。请使用更小的文件或压缩音频。`,
					});
				}

				// Use the client's speechToText functionality
				const transcription = await client.speechToText.convert({
					file: audioBlob,
					model_id: options.modelName,
					// Map outputLanguage if not set to 'auto'
					language_code:
						options.outputLanguage !== 'auto'
							? options.outputLanguage
							: undefined,
					tag_audio_events: false,
					diarize: true,
				});

				// Return the transcribed text
				return Ok(transcription.text.trim());
			} catch (error) {
				return WhisperingErr({
					title: '🔧 转录失败',
					description:
						'无法使用 ElevenLabs 完成转录。可能是服务问题或不支持的音频格式。请重试。',
					action: { type: 'more-details', error },
				});
			}
		},
	};
}

export type ElevenLabsTranscriptionService = ReturnType<
	typeof createElevenLabsTranscriptionService
>;

export const ElevenlabsTranscriptionServiceLive =
	createElevenLabsTranscriptionService();
