import { MicVAD, utils } from '@ricky0123/vad-web';
import { extractErrorMessage } from 'wellcrafted/error';
import { Err, Ok, tryAsync, trySync } from 'wellcrafted/result';
import type { VadState } from '$lib/constants/audio';
import { defineQuery } from '$lib/query/client';
import { WhisperingErr } from '$lib/result';
import {
	cleanupRecordingStream,
	enumerateDevices,
	getRecordingStream,
} from '$lib/services/isomorphic/device-stream';
import { settings } from '$lib/stores/settings.svelte';

/**
 * Creates a Voice Activity Detection (VAD) recorder with reactive state.
 *
 * This module provides voice activity detection using the @ricky0123/vad-web library.
 * State is managed with Svelte's $state rune for automatic reactivity.
 *
 * Usage:
 * - Access state reactively: `vadRecorder.state` (triggers effects when changed)
 * - Start listening: `await vadRecorder.startActiveListening({ onSpeechStart, onSpeechEnd })`
 * - Stop listening: `await vadRecorder.stopActiveListening()`
 * - Enumerate devices: `createQuery(() => vadRecorder.enumerateDevices.options)`
 */
function createVadRecorder() {
	// Private state
	let _maybeVad: MicVAD | null = null;
	let _state = $state<VadState>('IDLE');
	let _currentStream: MediaStream | null = null;

	return {
		/**
		 * Current VAD state. Reactive - reading this in an $effect will
		 * cause the effect to re-run when the state changes.
		 */
		get state(): VadState {
			return _state;
		},

		/**
		 * Enumerate available audio input devices.
		 *
		 * Usage:
		 * - With createQuery: `createQuery(() => vadRecorder.enumerateDevices.options)`
		 */
		enumerateDevices: defineQuery({
			queryKey: ['vad', 'devices'],
			queryFn: async () => {
				const { data, error } = await enumerateDevices();
				if (error) {
					return WhisperingErr({
						title: '❌ 枚举设备失败',
						serviceError: error,
					});
				}
				return Ok(data);
			},
		}),

		/**
		 * Start voice activity detection.
		 * Updates `state` reactively as detection progresses.
		 */
		async startActiveListening({
			onSpeechStart,
			onSpeechEnd,
			onVADMisfire,
			onSpeechRealStart,
		}: {
			onSpeechStart: () => void;
			onSpeechEnd: (blob: Blob) => void;
			onVADMisfire?: () => void;
			onSpeechRealStart?: () => void;
		}) {
			// Prevent starting if already active
			if (_maybeVad) {
				return WhisperingErr({
					title: '⚠️ VAD 已在运行',
					description: '请先停止当前会话,再开始新的。',
				});
			}

			console.log('Starting VAD recording');

			// Get device ID from settings
			const deviceId = settings.value['recording.navigator.deviceId'];

			// Get validated stream with device fallback
			const { data: streamResult, error: streamError } =
				await getRecordingStream({
					selectedDeviceId: deviceId,
					sendStatus: (status) => {
						console.log('VAD getRecordingStream status update:', status);
					},
				});

			if (streamError) {
				return WhisperingErr({
					title: '❌ 获取录音流失败',
					serviceError: streamError,
				});
			}

			const { stream, deviceOutcome } = streamResult;
			_currentStream = stream;

			// Create VAD with the validated stream
			const { data: newVad, error: initializeVadError } = await tryAsync({
				try: () =>
					MicVAD.new({
						stream,
						submitUserSpeechOnPause: true,
						onSpeechStart: () => {
							_state = 'SPEECH_DETECTED';
							onSpeechStart();
						},
						onSpeechEnd: (audio) => {
							_state = 'LISTENING';
							const wavBuffer = utils.encodeWAV(audio);
							const blob = new Blob([wavBuffer], { type: 'audio/wav' });
							onSpeechEnd(blob);
						},
						onVADMisfire: () => {
							_state = 'LISTENING';
							onVADMisfire?.();
						},
						onSpeechRealStart: () => {
							onSpeechRealStart?.();
						},
						model: 'v5',
					}),
				catch: (error) =>
					WhisperingErr({
						title: '❌ 初始化 VAD 失败',
						description:
							'语音活动检测无法启动。您的麦克风可能正被其他应用程序占用。',
						action: { type: 'more-details', error },
					}),
			});

			if (initializeVadError) {
				// Clean up stream if VAD initialization fails
				cleanupRecordingStream(stream);
				_currentStream = null;
				return Err(initializeVadError);
			}

			// Start listening
			const { error: startError } = trySync({
				try: () => newVad.start(),
				catch: (error) =>
					WhisperingErr({
						title: '❌ 启动 VAD 失败',
						description: `启动语音活动检测器失败。${extractErrorMessage(error)}`,
						action: { type: 'more-details', error },
					}),
			});

			if (startError) {
				// Clean up everything on start error
				trySync({
					try: () => newVad.destroy(),
					catch: () => Ok(undefined),
				});
				cleanupRecordingStream(stream);
				_maybeVad = null;
				_currentStream = null;
				return Err(startError);
			}

			_maybeVad = newVad;
			_state = 'LISTENING';
			return Ok(deviceOutcome);
		},

		/**
		 * Stop voice activity detection and clean up resources.
		 * Sets `state` back to 'IDLE'.
		 */
		async stopActiveListening() {
			if (!_maybeVad) return Ok(undefined);

			const vadInstance = _maybeVad;
			const { error: destroyError } = trySync({
				try: () => vadInstance.destroy(),
				catch: (error) =>
					WhisperingErr({
						title: '❌ 停止 VAD 失败',
						description: `停止语音活动检测器失败。${extractErrorMessage(error)}`,
						action: { type: 'more-details', error },
					}),
			});

			// Always clean up, even if destroy had an error
			_maybeVad = null;
			_state = 'IDLE';

			// Clean up our managed stream
			if (_currentStream) {
				cleanupRecordingStream(_currentStream);
				_currentStream = null;
			}

			if (destroyError) return Err(destroyError);
			return Ok(undefined);
		},
	};
}

export const vadRecorder = createVadRecorder();
