import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { remove } from '@tauri-apps/plugin-fs';
import { extractErrorMessage } from 'wellcrafted/error';
import { Err, Ok, type Result, tryAsync } from 'wellcrafted/result';
import type {
	CancelRecordingResult,
	WhisperingRecordingState,
} from '$lib/constants/audio';
import { FsServiceLive } from '$lib/services/desktop/fs';
import {
	type CpalRecordingParams,
	type RecorderService,
	RecorderServiceErr,
	type RecorderServiceError,
} from '$lib/services/isomorphic/recorder/types';
import {
	asDeviceIdentifier,
	type Device,
	type DeviceAcquisitionOutcome,
} from '$lib/services/types';

/**
 * Audio recording data returned from the Rust method
 */
type AudioRecording = {
	sampleRate: number;
	channels: number;
	durationSeconds: number;
	filePath?: string;
};

/**
 * Creates a CPAL recorder service that interfaces with Rust audio recording methods.
 * This service handles device enumeration, recording start/stop operations, and file management
 * for desktop audio recording using the CPAL library.
 */
export function createCpalRecorderService(): RecorderService {
	/**
	 * Enumerates available recording devices from the system.
	 */
	const enumerateDevices = async (): Promise<
		Result<Device[], RecorderServiceError>
	> => {
		const { data: deviceNames, error: enumerateRecordingDevicesError } =
			await invoke<string[]>('enumerate_recording_devices');
		if (enumerateRecordingDevicesError) {
			return RecorderServiceErr({
				message: '枚举录音设备失败',
			});
		}
		// On desktop, device names serve as both ID and label
		return Ok(
			deviceNames.map((name) => ({
				id: asDeviceIdentifier(name),
				label: name,
			})),
		);
	};

	return {
		/**
		 * Gets the current state of the recorder.
		 */
		getRecorderState: async (): Promise<
			Result<WhisperingRecordingState, RecorderServiceError>
		> => {
			const { data: recordingId, error: getRecorderStateError } = await invoke<
				string | null
			>('get_current_recording_id');
			if (getRecorderStateError)
				return RecorderServiceErr({
					message:
						'获取录音器状态时遇到问题。可能是因为您的麦克风正被其他应用占用、麦克风权限被拒绝,或所选录音设备已断开连接',
				});

			return Ok(recordingId ? 'RECORDING' : 'IDLE');
		},

		enumerateDevices,

		/**
		 * Starts a recording session with the specified parameters.
		 * Handles device selection, fallback logic, and recording initialization.
		 *
		 * @param params - Recording parameters including device ID, recording ID, output folder, and sample rate
		 * @param callbacks - Callback functions for status updates
		 */
		startRecording: async (
			{
				selectedDeviceId,
				recordingId,
				outputFolder,
				sampleRate,
			}: CpalRecordingParams,
			{ sendStatus },
		): Promise<Result<DeviceAcquisitionOutcome, RecorderServiceError>> => {
			const { data: devices, error: enumerateError } = await enumerateDevices();
			if (enumerateError) return Err(enumerateError);

			/**
			 * Acquires a recording device, either the selected one or a fallback.
			 */
			const acquireDevice = (): Result<
				DeviceAcquisitionOutcome,
				RecorderServiceError
			> => {
				const deviceIds = devices.map((d) => d.id);
				const fallbackDeviceId = deviceIds.at(0);
				if (!fallbackDeviceId) {
					return RecorderServiceErr({
						message: selectedDeviceId
							? '找不到所选的麦克风。请确保其已连接后重试!'
							: '找不到任何麦克风。请确保其已连接后重试!',
					});
				}

				if (!selectedDeviceId) {
					sendStatus({
						title: '🔍 未选择设备',
						description:
							'别担心!我们会自动为您找到最合适的麦克风……',
					});
					return Ok({
						outcome: 'fallback',
						reason: 'no-device-selected',
						deviceId: fallbackDeviceId,
					});
				}

				// Check if the selected device exists in the devices array
				const deviceExists = deviceIds.includes(selectedDeviceId);

				if (deviceExists)
					return Ok({ outcome: 'success', deviceId: selectedDeviceId });

				sendStatus({
					title: '⚠️ 寻找新麦克风',
					description:
						'该麦克风不可用。让我们尝试找另一个……',
				});

				return Ok({
					outcome: 'fallback',
					reason: 'preferred-device-unavailable',
					deviceId: fallbackDeviceId,
				});
			};

			const { data: deviceOutcome, error: acquireDeviceError } =
				acquireDevice();
			if (acquireDeviceError) return Err(acquireDeviceError);

			// Use the device from the outcome
			const deviceIdentifier = deviceOutcome.deviceId;

			// Now initialize recording with the chosen device
			sendStatus({
				title: '🎤 正在准备',
				description:
					'正在初始化您的录音会话并检查麦克风访问权限……',
			});

			// Convert sample rate string to number if provided
			const sampleRateNum = sampleRate
				? Number.parseInt(sampleRate, 10)
				: undefined;

			const { error: initRecordingSessionError } = await invoke(
				'init_recording_session',
				{
					deviceIdentifier,
					recordingId,
					outputFolder,
					sampleRate: sampleRateNum,
				},
			);
			if (initRecordingSessionError)
				return RecorderServiceErr({
					message:
						'设置录音会话时遇到问题。可能是因为您的麦克风正被其他应用占用、麦克风权限被拒绝,或所选录音设备已断开连接',
				});

			sendStatus({
				title: '🎙️ 开始录音',
				description:
					'录音会话已初始化,现在开始捕获音频……',
			});
			const { error: startRecordingError } =
				await invoke<void>('start_recording');
			if (startRecordingError)
				return RecorderServiceErr({
					message:
						'无法开始录音。请检查您的麦克风后重试。',
				});

			return Ok(deviceOutcome);
		},

		/**
		 * Stops the current recording session and returns the recorded audio as a Blob.
		 * Handles file reading, session cleanup, and resource management.
		 *
		 * @param callbacks - Callback functions for status updates
		 */
		stopRecording: async ({
			sendStatus,
		}): Promise<Result<Blob, RecorderServiceError>> => {
			const { data: audioRecording, error: stopRecordingError } =
				await invoke<AudioRecording>('stop_recording');
			if (stopRecordingError) {
				return RecorderServiceErr({
					message: '无法保存您的录音。请重试。',
				});
			}

			const { filePath } = audioRecording;
			// Desktop recorder should always write to a file
			if (!filePath) {
				return RecorderServiceErr({
					message: '未提供录音文件路径。',
				});
			}
			// audioRecording is now AudioRecordingWithFile

			// Read the WAV file from disk
			sendStatus({
				title: '📁 正在读取录音',
				description: '正在从磁盘加载您的录音……',
			});

			const { data: blob, error: readRecordingFileError } =
				await FsServiceLive.pathToBlob(filePath);
			if (readRecordingFileError)
				return RecorderServiceErr({
					message: `无法读取录音文件:${readRecordingFileError.message}`,
				});
			// Close the recording session after stopping
			sendStatus({
				title: '🔄 正在关闭会话',
				description: '正在清理录音资源……',
			});
			const { error: closeError } = await invoke<void>(
				'close_recording_session',
			);
			if (closeError) {
				// Log but don't fail the stop operation
				console.error('Failed to close recording session:', closeError);
			}

			return Ok(blob);
		},

		/**
		 * Cancels the current recording session and cleans up resources.
		 * Deletes any temporary recording files and closes the recording session.
		 *
		 * @param callbacks - Callback functions for status updates
		 */
		cancelRecording: async ({
			sendStatus,
		}): Promise<Result<CancelRecordingResult, RecorderServiceError>> => {
			// Check current state first
			const { data: recordingId, error: getRecordingIdError } = await invoke<
				string | null
			>('get_current_recording_id');
			if (getRecordingIdError) {
				return RecorderServiceErr({
					message:
						'无法检查录音状态。请尝试关闭应用后重新启动。',
				});
			}

			if (!recordingId) {
				return Ok({ status: 'no-recording' });
			}

			sendStatus({
				title: '🛑 正在取消',
				description:
					'正在安全停止您的录音并清理资源……',
			});

			// First get the recording data to know if there's a file to delete
			const { data: audioRecording } =
				await invoke<AudioRecording>('stop_recording');

			// If there's a file path, delete the file using Tauri FS plugin
			if (audioRecording?.filePath) {
				const { filePath } = audioRecording;
				const { error: removeError } = await tryAsync({
					try: () => remove(filePath),
					catch: (error) =>
						RecorderServiceErr({
							message: `删除录音文件失败:${extractErrorMessage(error)}`,
						}),
				});
				if (removeError)
					sendStatus({
						title: '❌ 删除录音文件出错',
						description:
							'我们无法删除该录音文件。正在继续执行取消流程……',
					});
			}

			// Close the recording session after cancelling
			sendStatus({
				title: '🔄 正在关闭会话',
				description: '正在清理录音资源……',
			});
			const { error: closeError } = await invoke<void>(
				'close_recording_session',
			);
			if (closeError) {
				// Log but don't fail the cancel operation
				console.error('Failed to close recording session:', closeError);
			}

			return Ok({ status: 'cancelled' });
		},
	};
}

/**
 * CPAL recorder service that uses the Rust CPAL method.
 * This is the CPAL audio recorder for desktop environments.
 */
export const CpalRecorderServiceLive = createCpalRecorderService();

/**
 * Wrapper function for Tauri invoke calls that handles errors consistently.
 * Converts Tauri invoke calls into Result types for better error handling.
 *
 * @param command - The Tauri command to invoke
 * @param args - Optional arguments to pass to the command
 */
async function invoke<T>(command: string, args?: Record<string, unknown>) {
	return tryAsync({
		try: async () => await tauriInvoke<T>(command, args),
		catch: (error) =>
			Err({ name: 'TauriInvokeError', command, error } as const),
	});
}
