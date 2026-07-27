import { extractErrorMessage } from 'wellcrafted/error';
import { Err, Ok, type Result, tryAsync, trySync } from 'wellcrafted/result';
import {
	type CancelRecordingResult,
	TIMESLICE_MS,
	type WhisperingRecordingState,
} from '$lib/constants/audio';
import {
	cleanupRecordingStream,
	enumerateDevices,
	getRecordingStream,
} from '$lib/services/isomorphic/device-stream';
import type {
	DeviceAcquisitionOutcome,
	DeviceIdentifier,
} from '$lib/services/types';
import type {
	NavigatorRecordingParams,
	RecorderService,
	RecorderServiceError,
} from './types';
import { RecorderServiceErr } from './types';

type ActiveRecording = {
	recordingId: string;
	selectedDeviceId: DeviceIdentifier | null;
	bitrateKbps: string;
	stream: MediaStream;
	mediaRecorder: MediaRecorder;
	recordedChunks: Blob[];
};

export function createNavigatorRecorderService(): RecorderService {
	let activeRecording: ActiveRecording | null = null;

	return {
		getRecorderState: async (): Promise<
			Result<WhisperingRecordingState, RecorderServiceError>
		> => {
			return Ok(activeRecording ? 'RECORDING' : 'IDLE');
		},

		enumerateDevices: async () => {
			const { data: devices, error } = await enumerateDevices();
			if (error) {
				return RecorderServiceErr({
					message: error.message,
				});
			}
			return Ok(devices);
		},

		startRecording: async (
			{ selectedDeviceId, recordingId, bitrateKbps }: NavigatorRecordingParams,
			{ sendStatus },
		): Promise<Result<DeviceAcquisitionOutcome, RecorderServiceError>> => {
			// Ensure we're not already recording
			if (activeRecording) {
				return RecorderServiceErr({
					message:
						'已有录音正在进行。请先停止当前录音,再开始新的。',
				});
			}

			sendStatus({
				title: '🎙️ 开始录音',
				description: '正在设置麦克风...',
			});

			// Get the recording stream
			const { data: streamResult, error: acquireStreamError } =
				await getRecordingStream({ selectedDeviceId, sendStatus });
			if (acquireStreamError) {
				return RecorderServiceErr({
					message: acquireStreamError.message,
				});
			}

			const { stream, deviceOutcome } = streamResult;

			const { data: mediaRecorder, error: recorderError } = trySync({
				try: () =>
					new MediaRecorder(stream, {
						bitsPerSecond: Number(bitrateKbps) * 1000,
					}),
				catch: (error) =>
					RecorderServiceErr({
						message: `初始化音频录制器失败。这可能是由于不支持的音频设置、麦克风冲突或浏览器限制造成的。请检查麦克风是否正常工作,并尝试调整音频设置。 ${extractErrorMessage(error)}`,
					}),
			});

			if (recorderError) {
				// Clean up stream if recorder creation fails
				cleanupRecordingStream(stream);
				return Err(recorderError);
			}

			// Set up recording state and event handlers
			const recordedChunks: Blob[] = [];

			// Store active recording state
			activeRecording = {
				recordingId,
				selectedDeviceId,
				bitrateKbps,
				stream,
				mediaRecorder,
				recordedChunks,
			};

			// Set up event handlers
			mediaRecorder.addEventListener('dataavailable', (event: BlobEvent) => {
				if (event.data.size) recordedChunks.push(event.data);
			});

			// Start recording
			mediaRecorder.start(TIMESLICE_MS);

			// Return the device acquisition outcome
			return Ok(deviceOutcome);
		},

		stopRecording: async ({
			sendStatus,
		}): Promise<Result<Blob, RecorderServiceError>> => {
			if (!activeRecording) {
				return RecorderServiceErr({
					message:
						'无法停止录音,因为没有找到活动的录音会话。请确保在尝试停止之前已开始录音。',
				});
			}

			const recording = activeRecording;
			activeRecording = null; // Clear immediately to prevent race conditions

			sendStatus({
				title: '⏸️ 完成录音',
				description: '正在保存音频...',
			});

			// Stop the recorder and wait for the final data
			const { data: blob, error: stopError } = await tryAsync({
				try: () =>
					new Promise<Blob>((resolve) => {
						recording.mediaRecorder.addEventListener('stop', () => {
							const audioBlob = new Blob(recording.recordedChunks, {
								type: recording.mediaRecorder.mimeType,
							});
							resolve(audioBlob);
						});
						recording.mediaRecorder.stop();
					}),
				catch: (error) =>
					RecorderServiceErr({
						message: `无法正确停止并保存录音。这可能是由于音频数据损坏、存储空间不足或浏览器问题造成的。您的录音数据可能丢失。 ${extractErrorMessage(error)}`,
					}),
			});

			// Always clean up the stream
			cleanupRecordingStream(recording.stream);

			if (stopError) return Err(stopError);

			sendStatus({
				title: '✅ 录音已保存',
				description: '录音已就绪,可以转录!',
			});
			return Ok(blob);
		},

		cancelRecording: async ({
			sendStatus,
		}): Promise<Result<CancelRecordingResult, RecorderServiceError>> => {
			if (!activeRecording) {
				return Ok({ status: 'no-recording' });
			}

			const recording = activeRecording;
			activeRecording = null; // Clear immediately

			sendStatus({
				title: '🛑 取消中',
				description: '正在丢弃录音...',
			});

			// Stop the recorder
			recording.mediaRecorder.stop();

			// Clean up the stream
			cleanupRecordingStream(recording.stream);

			sendStatus({
				title: '✨ 已取消',
				description: '录音已成功丢弃!',
			});

			return Ok({ status: 'cancelled' });
		},
	};
}

/**
 * Navigator recorder service that uses the MediaRecorder API.
 * Available in both browser and desktop environments.
 */
export const NavigatorRecorderServiceLive = createNavigatorRecorderService();
