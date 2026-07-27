import { Err, Ok, partitionResults, type Result } from 'wellcrafted/result';
import { defineMutation, queryClient } from '$lib/query/client';
import { WhisperingErr, type WhisperingError } from '$lib/result';
import { desktopServices, services } from '$lib/services';
import type { Recording } from '$lib/services/isomorphic/db';
import { settings } from '$lib/stores/settings.svelte';
import { rpc } from '..';
import { db } from './db';
import { notify } from './notify';

const transcriptionKeys = {
	isTranscribing: ['transcription', 'isTranscribing'] as const,
} as const;

export const transcription = {
	isCurrentlyTranscribing() {
		return (
			queryClient.isMutating({
				mutationKey: transcriptionKeys.isTranscribing,
			}) > 0
		);
	},
	transcribeRecording: defineMutation({
		mutationKey: transcriptionKeys.isTranscribing,
		mutationFn: async (
			recording: Recording,
		): Promise<Result<string, WhisperingError>> => {
			// Fetch audio blob by ID
			const { data: audioBlob, error: getAudioBlobError } =
				await services.db.recordings.getAudioBlob(recording.id);

			if (getAudioBlobError) {
				return WhisperingErr({
					title: '⚠️ 获取音频失败',
					description: `无法加载录音的音频：${getAudioBlobError.message}`,
				});
			}

			const { error: setRecordingTranscribingError } =
				await db.recordings.update.execute({
					...recording,
					transcriptionStatus: 'TRANSCRIBING',
				});
			if (setRecordingTranscribingError) {
				notify.warning.execute({
					title:
						'⚠️ 无法将录音的转录状态设置为转录中',
					description: '继续进行转录流程…',
					action: {
						type: 'more-details',
						error: setRecordingTranscribingError,
					},
				});
			}
			const { data: transcribedText, error: transcribeError } =
				await transcribeBlob(audioBlob);
			if (transcribeError) {
				const { error: setRecordingTranscribingError } =
					await db.recordings.update.execute({
						...recording,
						transcriptionStatus: 'FAILED',
					});
				if (setRecordingTranscribingError) {
					notify.warning.execute({
						title: '⚠️ 转录后无法更新录音',
						description:
							'转录失败，但无法在数据库中更新录音的转录状态',
						action: {
							type: 'more-details',
							error: setRecordingTranscribingError,
						},
					});
				}
				return Err(transcribeError);
			}

			const { error: setRecordingTranscribedTextError } =
				await db.recordings.update.execute({
					...recording,
					transcribedText,
					transcriptionStatus: 'DONE',
				});
			if (setRecordingTranscribedTextError) {
				notify.warning.execute({
					title: '⚠️ 转录后无法更新录音',
					description:
						'转录已完成，但无法在数据库中更新录音的转录文本和状态',
					action: {
						type: 'more-details',
						error: setRecordingTranscribedTextError,
					},
				});
			}
			return Ok(transcribedText);
		},
	}),

	transcribeRecordings: defineMutation({
		mutationKey: transcriptionKeys.isTranscribing,
		mutationFn: async (recordings: Recording[]) => {
			const results = await Promise.all(
				recordings.map(async (recording) => {
					// Fetch audio blob by ID
					const { data: audioBlob, error: getAudioBlobError } =
						await services.db.recordings.getAudioBlob(recording.id);

					if (getAudioBlobError) {
						return WhisperingErr({
							title: '⚠️ 获取音频失败',
							description: `无法加载录音的音频：${getAudioBlobError.message}`,
						});
					}

					return await transcribeBlob(audioBlob);
				}),
			);
			const partitionedResults = partitionResults(results);
			return Ok(partitionedResults);
		},
	}),
};

async function transcribeBlob(
	blob: Blob,
): Promise<Result<string, WhisperingError>> {
	const selectedService =
		settings.value['transcription.selectedTranscriptionService'];

	// Log transcription request
	const startTime = Date.now();
	rpc.analytics.logEvent.execute({
		type: 'transcription_requested',
		provider: selectedService,
	});

	// Compress audio if enabled, else pass through original blob
	let audioToTranscribe = blob;
	if (settings.value['transcription.compressionEnabled']) {
		const { data: compressedBlob, error: compressionError } =
			await desktopServices.ffmpeg.compressAudioBlob(
				blob,
				settings.value['transcription.compressionOptions'],
			);

		if (compressionError) {
			// Notify user of compression failure but continue with original blob
			notify.warning.execute({
				title: '音频压缩失败',
				description: `${compressionError.message}。使用原始音频进行转录。`,
			});
			rpc.analytics.logEvent.execute({
				type: 'compression_failed',
				provider: selectedService,
				error_message: compressionError.message,
			});
		} else {
			// Use compressed blob and notify user of success
			audioToTranscribe = compressedBlob;
			const compressionRatio = Math.round(
				(1 - compressedBlob.size / blob.size) * 100,
			);
			notify.info.execute({
				title: '音频已压缩',
				description: `文件大小减少了 ${compressionRatio}%`,
			});
			rpc.analytics.logEvent.execute({
				type: 'compression_completed',
				provider: selectedService,
				original_size: blob.size,
				compressed_size: compressedBlob.size,
				compression_ratio: compressionRatio,
			});
		}
	}

	const transcriptionResult: Result<string, WhisperingError> =
		await (async () => {
			switch (selectedService) {
				case 'OpenAI':
					return await services.transcriptions.openai.transcribe(
						audioToTranscribe,
						{
							outputLanguage: settings.value['transcription.outputLanguage'],
							prompt: settings.value['transcription.prompt'],
							temperature: settings.value['transcription.temperature'],
							apiKey: settings.value['apiKeys.openai'],
							modelName: settings.value['transcription.openai.model'],
							baseURL: settings.value['apiEndpoints.openai'] || undefined,
						},
					);
				case 'Groq':
					return await services.transcriptions.groq.transcribe(
						audioToTranscribe,
						{
							outputLanguage: settings.value['transcription.outputLanguage'],
							prompt: settings.value['transcription.prompt'],
							temperature: settings.value['transcription.temperature'],
							apiKey: settings.value['apiKeys.groq'],
							modelName: settings.value['transcription.groq.model'],
							baseURL: settings.value['apiEndpoints.groq'] || undefined,
						},
					);
				case 'speaches':
					return await services.transcriptions.speaches.transcribe(
						audioToTranscribe,
						{
							outputLanguage: settings.value['transcription.outputLanguage'],
							prompt: settings.value['transcription.prompt'],
							temperature: settings.value['transcription.temperature'],
							modelId: settings.value['transcription.speaches.modelId'],
							baseUrl: settings.value['transcription.speaches.baseUrl'],
						},
					);
				case 'ElevenLabs':
					return await services.transcriptions.elevenlabs.transcribe(
						audioToTranscribe,
						{
							outputLanguage: settings.value['transcription.outputLanguage'],
							prompt: settings.value['transcription.prompt'],
							temperature: settings.value['transcription.temperature'],
							apiKey: settings.value['apiKeys.elevenlabs'],
							modelName: settings.value['transcription.elevenlabs.model'],
						},
					);
				case 'Deepgram':
					return await services.transcriptions.deepgram.transcribe(
						audioToTranscribe,
						{
							outputLanguage: settings.value['transcription.outputLanguage'],
							prompt: settings.value['transcription.prompt'],
							temperature: settings.value['transcription.temperature'],
							apiKey: settings.value['apiKeys.deepgram'],
							modelName: settings.value['transcription.deepgram.model'],
						},
					);
				case 'Mistral':
					return await services.transcriptions.mistral.transcribe(
						audioToTranscribe,
						{
							outputLanguage: settings.value['transcription.outputLanguage'],
							prompt: settings.value['transcription.prompt'],
							temperature: settings.value['transcription.temperature'],
							apiKey: settings.value['apiKeys.mistral'],
							modelName: settings.value['transcription.mistral.model'],
						},
					);
				case 'whispercpp': {
					// Pure Rust audio conversion now handles most formats without FFmpeg
					// Only compressed formats (MP3, M4A) require FFmpeg, which will be
					// handled automatically as a fallback in the Rust conversion pipeline
					return await services.transcriptions.whispercpp.transcribe(
						audioToTranscribe,
						{
							outputLanguage: settings.value['transcription.outputLanguage'],
							modelPath: settings.value['transcription.whispercpp.modelPath'],
							prompt: settings.value['transcription.prompt'],
						},
					);
				}
				case 'parakeet': {
					// Pure Rust audio conversion now handles most formats without FFmpeg
					// Only compressed formats (MP3, M4A) require FFmpeg, which will be
					// handled automatically as a fallback in the Rust conversion pipeline
					return await services.transcriptions.parakeet.transcribe(
						audioToTranscribe,
						{ modelPath: settings.value['transcription.parakeet.modelPath'] },
					);
				}
				case 'moonshine': {
					// Moonshine uses ONNX Runtime with encoder-decoder architecture
					// Variant is extracted from modelPath (e.g., "moonshine-tiny-en" → "tiny")
					return await services.transcriptions.moonshine.transcribe(
						audioToTranscribe,
						{
							modelPath: settings.value['transcription.moonshine.modelPath'],
						},
					);
				}
				default:
					return WhisperingErr({
						title: '⚠️ 未选择转录服务商',
						description: '请在设置中选择一个转录服务商。',
					});
			}
		})();

	// Log transcription result
	const duration = Date.now() - startTime;
	if (transcriptionResult.error) {
		rpc.analytics.logEvent.execute({
			type: 'transcription_failed',
			provider: selectedService,
			error_title: transcriptionResult.error.title,
			error_description: transcriptionResult.error.description,
		});
	} else {
		rpc.analytics.logEvent.execute({
			type: 'transcription_completed',
			provider: selectedService,
			duration,
		});
	}

	return transcriptionResult;
}
