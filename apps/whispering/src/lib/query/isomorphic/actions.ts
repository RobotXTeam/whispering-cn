import { nanoid } from 'nanoid/non-secure';
import { Ok } from 'wellcrafted/result';
import { defineMutation } from '$lib/query/client';
import { WhisperingErr } from '$lib/result';
import { DbServiceErr } from '$lib/services/isomorphic/db';
import { settings } from '$lib/stores/settings.svelte';
import { vadRecorder } from '$lib/stores/vad-recorder.svelte';
import * as transformClipboardWindow from '$routes/transform-clipboard/transformClipboardWindow.tauri';
import { rpc } from '..';
import { db } from './db';
import { delivery } from './delivery';
import { notify } from './notify';
import { recorder } from './recorder';
import { sound } from './sound';
import { text } from './text';
import { transcription } from './transcription';
import { transformer } from './transformer';

/**
 * Application actions. These are mutations at the UI boundary that can be invoked
 * from anywhere: command registry, components, stores, etc.
 *
 * They always return Ok() because there's nowhere left to propagate errors—errors flow
 * sideways through notify.error.execute() instead of up the call stack. Actions are
 * the end of the operation chain.
 */

// Track manual recording start time for duration calculation
let manualRecordingStartTime: number | null = null;

/**
 * Mutex flag to prevent concurrent recording operations.
 *
 * This flag guards against a race condition where rapid toggle calls (e.g., push-to-talk)
 * can both see 'IDLE' state before the recorder has fully started. Without this guard:
 * 1. Call 1 checks recorder state → IDLE (during setup, is_recording not yet true)
 * 2. Call 2 checks recorder state → IDLE (Call 1's recording hasn't fully started)
 * 3. Both calls try to start recording, causing state desync
 *
 * The flag is set synchronously at the start of any recording operation and cleared
 * when the core operation completes (after the recorder service call returns).
 */
let isRecordingOperationBusy = false;

// Internal mutations for manual recording
const startManualRecording = defineMutation({
	mutationKey: ['commands', 'startManualRecording'] as const,
	mutationFn: async () => {
		// Prevent concurrent recording operations
		if (isRecordingOperationBusy) {
			console.info('Recording operation already in progress, ignoring start');
			return Ok(undefined);
		}
		isRecordingOperationBusy = true;

		await settings.switchRecordingMode('manual');

		const toastId = nanoid();
		notify.loading.execute({
			id: toastId,
			title: '🎙️ 准备录音…',
			description: '正在设置录音环境…',
		});

		const { data: deviceAcquisitionOutcome, error: startRecordingError } =
			await recorder.startRecording.execute({ toastId });

		// Release mutex after the actual start operation completes
		isRecordingOperationBusy = false;

		if (startRecordingError) {
			notify.error.execute({ id: toastId, ...startRecordingError });
			return Ok(undefined);
		}

		switch (deviceAcquisitionOutcome.outcome) {
			case 'success': {
				notify.success.execute({
					id: toastId,
					title: '🎙️ Whispering 正在录音…',
					description: '现在开始说话，完成后停止录音',
				});
				break;
			}
			case 'fallback': {
				const method = settings.value['recording.method'];
				settings.updateKey(
					`recording.${method}.deviceId`,
					deviceAcquisitionOutcome.deviceId,
				);
				switch (deviceAcquisitionOutcome.reason) {
					case 'no-device-selected': {
						notify.info.execute({
							id: toastId,
							title: '🎙️ 已切换到可用麦克风',
							description:
								'未选择麦克风，因此我们自动连接到了一个可用麦克风。你可以在设置中更新选择。',
							action: {
								type: 'link',
								label: '打开设置',
								href: '/settings/recording',
							},
						});
						break;
					}
					case 'preferred-device-unavailable': {
						notify.info.execute({
							id: toastId,
							title: '🎙️ 已切换到其他麦克风',
							description:
								'未找到你之前选择的麦克风，因此我们自动连接到了一个可用麦克风。',
							action: {
								type: 'link',
								label: '打开设置',
								href: '/settings/recording',
							},
						});
						break;
					}
				}
			}
		}
		// Track start time for duration calculation
		manualRecordingStartTime = Date.now();
		console.info('Recording started');
		sound.playSoundIfEnabled.execute('manual-start');
		return Ok(undefined);
	},
});

const stopManualRecording = defineMutation({
	mutationKey: ['commands', 'stopManualRecording'] as const,
	mutationFn: async () => {
		// Prevent concurrent recording operations
		if (isRecordingOperationBusy) {
			console.info('Recording operation already in progress, ignoring stop');
			return Ok(undefined);
		}
		isRecordingOperationBusy = true;

		const toastId = nanoid();
		notify.loading.execute({
			id: toastId,
			title: '⏸️ 正在停止录音…',
			description: '正在完成音频采集…',
		});

		const { data, error: stopRecordingError } =
			await recorder.stopRecording.execute({ toastId });

		// Release mutex after the actual stop operation completes
		// This allows new recordings to start while pipeline runs
		isRecordingOperationBusy = false;

		if (stopRecordingError) {
			notify.error.execute({ id: toastId, ...stopRecordingError });
			return Ok(undefined);
		}

		const { blob, recordingId } = data;

		notify.success.execute({
			id: toastId,
			title: '🎙️ 录音已停止',
			description: '你的录音已保存',
		});
		console.info('Recording stopped');
		sound.playSoundIfEnabled.execute('manual-stop');

		// Log manual recording completion
		let duration: number | undefined;
		if (manualRecordingStartTime) {
			duration = Date.now() - manualRecordingStartTime;
			manualRecordingStartTime = null; // Reset for next recording
		}
		rpc.analytics.logEvent.execute({
			type: 'manual_recording_completed',
			blob_size: blob.size,
			duration,
		});

		// Pipeline runs after mutex is released - new recordings can start
		// while transcription/transformation are in progress
		await processRecordingPipeline({
			blob,
			recordingId,
			toastId,
			completionTitle: '✨ 录音完成！',
			completionDescription: '录音已保存，会话已成功关闭',
		});

		return Ok(undefined);
	},
});

// Internal mutations for VAD recording
const startVadRecording = defineMutation({
	mutationKey: ['commands', 'startVadRecording'] as const,
	mutationFn: async () => {
		await settings.switchRecordingMode('vad');

		const toastId = nanoid();
		console.info('Starting voice activated capture');
		notify.loading.execute({
			id: toastId,
			title: '🎙️ 正在启动语音活动采集',
			description: '语音活动采集正在启动…',
		});
		const { data: deviceAcquisitionOutcome, error: startActiveListeningError } =
			await vadRecorder.startActiveListening({
				onSpeechStart: () => {
					notify.success.execute({
						title: '🎙️ 已检测到说话',
						description: '录音已开始。请清晰、大声地说话。',
					});
				},
				onSpeechEnd: async (blob) => {
					const toastId = nanoid();
					notify.success.execute({
						id: toastId,
						title: '🎙️ 语音活动片段已采集',
						description: '你的语音活动片段已采集。',
					});
					console.info('Voice activated speech captured');
					sound.playSoundIfEnabled.execute('vad-capture');

					// Log VAD recording completion
					rpc.analytics.logEvent.execute({
						type: 'vad_recording_completed',
						blob_size: blob.size,
						// VAD doesn't track duration by default
					});

					await processRecordingPipeline({
						blob,
						toastId,
						completionTitle: '✨ 语音活动采集完成！',
						completionDescription:
							'语音活动采集完成！可以开始下一段',
					});
				},
			});
		if (startActiveListeningError) {
			notify.error.execute({ id: toastId, ...startActiveListeningError });
			return Ok(undefined);
		}

		// Handle device acquisition outcome
		switch (deviceAcquisitionOutcome.outcome) {
			case 'success': {
				notify.success.execute({
					id: toastId,
					title: '🎙️ 语音活动采集已启动',
					description: '你的语音活动采集已启动。',
				});
				break;
			}
			case 'fallback': {
				settings.updateKey(
					'recording.navigator.deviceId',
					deviceAcquisitionOutcome.deviceId,
				);
				switch (deviceAcquisitionOutcome.reason) {
					case 'no-device-selected': {
						notify.info.execute({
							id: toastId,
							title: '🎙️ 语音活动检测已使用可用麦克风启动',
							description:
								'未为语音活动检测选择麦克风，因此我们自动连接到了一个可用麦克风。你可以在设置中更新选择。',
							action: {
								type: 'link',
								label: '打开设置',
								href: '/settings/recording',
							},
						});
						break;
					}
					case 'preferred-device-unavailable': {
						notify.info.execute({
							id: toastId,
							title: '🎙️ 语音活动检测已切换到其他麦克风',
							description:
								'未找到你之前为语音活动检测选择的麦克风，因此我们自动连接到了一个可用麦克风。',
							action: {
								type: 'link',
								label: '打开设置',
								href: '/settings/recording',
							},
						});
						break;
					}
				}
			}
		}

		sound.playSoundIfEnabled.execute('vad-start');
		return Ok(undefined);
	},
});

const stopVadRecording = defineMutation({
	mutationKey: ['commands', 'stopVadRecording'] as const,
	mutationFn: async () => {
		const toastId = nanoid();
		console.info('Stopping voice activated capture');
		notify.loading.execute({
			id: toastId,
			title: '⏸️ 正在停止语音活动采集…',
			description: '正在完成语音活动采集…',
		});
		const { error: stopVadError } = await vadRecorder.stopActiveListening();
		if (stopVadError) {
			notify.error.execute({ id: toastId, ...stopVadError });
			return Ok(undefined);
		}
		notify.success.execute({
			id: toastId,
			title: '🎙️ 语音活动采集已停止',
			description: '你的语音活动采集已停止。',
		});
		sound.playSoundIfEnabled.execute('vad-stop');
		return Ok(undefined);
	},
});

export const commands = {
	startManualRecording,
	stopManualRecording,
	startVadRecording,
	stopVadRecording,

	// Toggle manual recording
	toggleManualRecording: defineMutation({
		mutationKey: ['commands', 'toggleManualRecording'] as const,
		mutationFn: async () => {
			const { data: recorderState, error: getRecorderStateError } =
				await recorder.getRecorderState.fetch();
			if (getRecorderStateError) {
				notify.error.execute(getRecorderStateError);
				return Ok(undefined);
			}
			if (recorderState === 'RECORDING') {
				return await stopManualRecording.execute(undefined);
			}
			return await startManualRecording.execute(undefined);
		},
	}),

	// Cancel manual recording
	cancelManualRecording: defineMutation({
		mutationKey: ['commands', 'cancelManualRecording'] as const,
		mutationFn: async () => {
			// Prevent concurrent recording operations
			if (isRecordingOperationBusy) {
				console.info(
					'Recording operation already in progress, ignoring cancel',
				);
				return Ok(undefined);
			}
			isRecordingOperationBusy = true;

			const toastId = nanoid();
			notify.loading.execute({
				id: toastId,
				title: '⏸️ 正在取消录音…',
				description: '正在清理录音会话…',
			});
			const { data: cancelRecordingResult, error: cancelRecordingError } =
				await recorder.cancelRecording.execute({ toastId });

			// Release mutex after the actual cancel operation completes
			isRecordingOperationBusy = false;

			if (cancelRecordingError) {
				notify.error.execute({ id: toastId, ...cancelRecordingError });
				return Ok(undefined);
			}
			switch (cancelRecordingResult.status) {
				case 'no-recording': {
					notify.info.execute({
						id: toastId,
						title: '没有进行中的录音',
						description: '没有正在进行的录音可取消。',
					});
					break;
				}
				case 'cancelled': {
					// Session cleanup is now handled internally by the recorder service
					// Reset start time if recording was cancelled
					manualRecordingStartTime = null;
					notify.success.execute({
						id: toastId,
						title: '✅ 完成！',
						description: '录音已成功取消',
					});
					sound.playSoundIfEnabled.execute('manual-cancel');
					console.info('Recording cancelled');
					break;
				}
			}
			return Ok(undefined);
		},
	}),

	// Toggle VAD recording
	toggleVadRecording: defineMutation({
		mutationKey: ['commands', 'toggleVadRecording'] as const,
		mutationFn: async () => {
			if (
				vadRecorder.state === 'LISTENING' ||
				vadRecorder.state === 'SPEECH_DETECTED'
			) {
				return await stopVadRecording.execute(undefined);
			}
			return await startVadRecording.execute(undefined);
		},
	}),

	// Upload recordings (supports multiple files)
	uploadRecordings: defineMutation({
		mutationKey: ['recordings', 'uploadRecordings'] as const,
		mutationFn: async ({ files }: { files: File[] }) => {
			await settings.switchRecordingMode('upload');
			// Partition files into valid and invalid in a single pass
			const { valid: validFiles, invalid: invalidFiles } = files.reduce<{
				valid: File[];
				invalid: File[];
			}>(
				(acc, file) => {
					const isValid =
						file.type.startsWith('audio/') || file.type.startsWith('video/');
					acc[isValid ? 'valid' : 'invalid'].push(file);
					return acc;
				},
				{ valid: [], invalid: [] },
			);

			if (validFiles.length === 0) {
				return DbServiceErr({
					message: '未找到有效的音频或视频文件。',
				});
			}

			if (invalidFiles.length > 0) {
				notify.warning.execute({
					title: '⚠️ 已跳过部分文件',
					description: `${invalidFiles.length} 个文件不是音频或视频文件`,
				});
			}

			// Process all valid files in parallel
			await Promise.all(
				validFiles.map(async (file) => {
					const arrayBuffer = await file.arrayBuffer();
					const audioBlob = new Blob([arrayBuffer], { type: file.type });

					// Log file upload event
					rpc.analytics.logEvent.execute({
						type: 'file_uploaded',
						blob_size: audioBlob.size,
					});

					// Each file gets its own toast notification
					const toastId = nanoid();
					await processRecordingPipeline({
						blob: audioBlob,
						toastId,
						completionTitle: '📁 文件上传成功！',
						completionDescription: file.name,
					});
				}),
			);

			return Ok({
				processedCount: validFiles.length,
				skippedCount: invalidFiles.length,
			});
		},
	}),

	// Open transformation picker to select a transformation
	openTransformationPicker: defineMutation({
		mutationKey: ['commands', 'openTransformationPicker'] as const,
		mutationFn: async () => {
			await transformClipboardWindow.toggle();
			return Ok(undefined);
		},
	}),

	// Run selected transformation on clipboard
	runTransformationOnClipboard: defineMutation({
		mutationKey: ['commands', 'runTransformationOnClipboard'] as const,
		mutationFn: async () => {
			// Get selected transformation from settings
			const transformationId =
				settings.value['transformations.selectedTransformationId'];

			if (!transformationId) {
				return WhisperingErr({
					title: '⚠️ 未选择转换',
					description: '请先在设置中选择一个转换。',
					action: {
						type: 'link',
						label: '选择一个转换',
						href: '/transformations',
					},
				});
			}

			// Get the transformation
			const { data: transformation, error: getTransformationError } =
				await db.transformations.getById(() => transformationId).fetch();

			if (getTransformationError) {
				return WhisperingErr({
					title: '❌ 获取转换失败',
					serviceError: getTransformationError,
				});
			}

			if (!transformation) {
				settings.updateKey('transformations.selectedTransformationId', null);
				return WhisperingErr({
					title: '⚠️ 未找到转换',
					description:
						'所选转换已不存在。请选择其他转换。',
					action: {
						type: 'link',
						label: '选择其他转换',
						href: '/transformations',
					},
				});
			}

			// Read clipboard text
			const { data: clipboardText, error: readClipboardError } =
				await text.readFromClipboard.fetch();

			if (readClipboardError) {
				return WhisperingErr({
					title: '❌ 读取剪贴板失败',
					serviceError: readClipboardError,
				});
			}

			if (!clipboardText?.trim()) {
				return WhisperingErr({
					title: '📋 剪贴板为空',
					description: '请在运行转换前复制一些文本。',
				});
			}

			// Run transformation
			const toastId = nanoid();
			notify.loading.execute({
				id: toastId,
				title: '🔄 正在运行转换…',
				description: '正在转换你的剪贴板文本…',
			});

			const { data: output, error: transformError } =
				await transformer.transformInput.execute({
					input: clipboardText,
					transformation,
				});

			if (transformError) {
				notify.error.execute({ id: toastId, ...transformError });
				return Ok(undefined);
			}

			sound.playSoundIfEnabled.execute('transformationComplete');

			await delivery.deliverTransformationResult.execute({
				text: output,
				toastId,
			});

			return Ok(undefined);
		},
		onError: (error) => {
			notify.error.execute(error);
		},
	}),
};

/**
 * Processes a recording through the full pipeline: save → transcribe → transform
 *
 * This function handles the complete flow from recording creation through transcription:
 * 1. Creates recording metadata and saves to database
 * 2. Handles database save errors
 * 3. Shows completion toast
 * 4. Executes transcription flow
 * 5. Applies transformation if one is selected
 *
 * @param recordingId - Optional recording ID. When provided (e.g., from CPAL recorder),
 * the ID was generated earlier in the pipeline and is passed through for consistency.
 * When omitted (e.g., VAD recording, file uploads), a new ID is generated here using nanoid().
 * This flexibility allows different recording methods to control ID generation at the
 * appropriate point in their respective pipelines.
 */
async function processRecordingPipeline({
	blob,
	recordingId,
	toastId,
	completionTitle,
	completionDescription,
}: {
	blob: Blob;
	recordingId?: string;
	toastId: string;
	completionTitle: string;
	completionDescription: string;
}) {
	const now = new Date().toISOString();
	const newRecordingId = recordingId ?? nanoid();

	const recording = {
		id: newRecordingId,
		title: '',
		subtitle: '',
		timestamp: now,
		createdAt: now,
		updatedAt: now,
		transcribedText: '',
		transcriptionStatus: 'UNPROCESSED',
	} as const;

	const { error: createRecordingError } = await db.recordings.create.execute({
		recording,
		audio: blob,
	});

	if (createRecordingError) {
		notify.error.execute({
			id: toastId,
			title:
				'❌ 你的录音已采集但无法保存到数据库。',
			description: createRecordingError.message,
			action: { type: 'more-details', error: createRecordingError },
		});
		return;
	}

	notify.success.execute({
		id: toastId,
		title: completionTitle,
		description: completionDescription,
	});

	const transcribeToastId = nanoid();
	notify.loading.execute({
		id: transcribeToastId,
		title: '📋 正在转录…',
		description: '你的录音正在转录…',
	});

	const { data: transcribedText, error: transcribeError } =
		await transcription.transcribeRecording.execute(recording);

	if (transcribeError) {
		if (transcribeError.name === 'WhisperingError') {
			notify.error.execute({ id: transcribeToastId, ...transcribeError });
			return;
		}
		notify.error.execute({
			id: transcribeToastId,
			title: '❌ 转录录音失败',
			description: '你的录音无法转录。',
			action: { type: 'more-details', error: transcribeError },
		});
		return;
	}

	sound.playSoundIfEnabled.execute('transcriptionComplete');

	await delivery.deliverTranscriptionResult.execute({
		text: transcribedText,
		toastId: transcribeToastId,
	});

	// Determine if we need to chain to transformation
	const transformationId =
		settings.value['transformations.selectedTransformationId'];

	// Check if transformation is valid if specified
	if (!transformationId) return;
	const { data: transformation, error: getTransformationError } =
		await db.transformations.getById(() => transformationId).fetch();

	const transformationNoLongerExists = !transformation;

	if (getTransformationError) {
		notify.error.execute({
			title: '❌ 获取转换失败',
			description: getTransformationError.message,
			action: {
				type: 'more-details',
				error: getTransformationError,
			},
		});
		return;
	}

	if (transformationNoLongerExists) {
		settings.updateKey('transformations.selectedTransformationId', null);
		notify.warning.execute({
			title: '⚠️ 未找到匹配的转换',
			description:
				'未找到匹配的转换。请选择其他转换。',
			action: {
				type: 'link',
				label: '选择其他转换',
				href: '/transformations',
			},
		});
		return;
	}

	const transformToastId = nanoid();
	notify.loading.execute({
		id: transformToastId,
		title: '🔄 正在运行转换…',
		description:
			'正在将所选转换应用到转录文本…',
	});
	const { data: transformationRun, error: transformError } =
		await transformer.transformRecording.execute({
			recordingId: recording.id,
			transformation,
		});
	if (transformError) {
		notify.error.execute({ id: transformToastId, ...transformError });
		return;
	}

	if (transformationRun.status === 'failed') {
		notify.error.execute({
			id: transformToastId,
			title: '⚠️ 转换错误',
			description: transformationRun.error,
			action: { type: 'more-details', error: transformationRun.error },
		});
		return;
	}

	sound.playSoundIfEnabled.execute('transformationComplete');

	await delivery.deliverTransformationResult.execute({
		text: transformationRun.output,
		toastId: transformToastId,
	});
}
