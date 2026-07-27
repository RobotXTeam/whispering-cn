import { Ok } from 'wellcrafted/result';
import { WHISPERING_RECORDINGS_PATHNAME } from '$lib/constants/app';
import { defineMutation } from '$lib/query/client';
import type { WhisperingError } from '$lib/result';
import type { TextServiceError } from '$lib/services/isomorphic/text';
import { settings } from '$lib/stores/settings.svelte';
import { rpc } from '..';

export const delivery = {
	/**
	 * Delivers transcript to the user according to their text output preferences.
	 *
	 * This mutation handles the complete delivery workflow for transcription results:
	 * 1. Shows a success toast with the transcript
	 * 2. Optionally copies text to clipboard based on user settings
	 * 3. Optionally writes text to cursor based on user settings
	 * 4. Provides fallback UI actions when automatic operations fail
	 *
	 * The user's preferences are read from:
	 * - `transcription.copyToClipboardOnSuccess` - Whether to auto-copy
	 * - `transcription.writeToCursorOnSuccess` - Whether to auto-write to cursor
	 *
	 * @param text - The transcript to deliver
	 * @param toastId - Unique ID for toast notifications to prevent duplicates
	 * @returns Result with no meaningful data (fire-and-forget operation)
	 *
	 * @example
	 * ```typescript
	 * // After transcription completes
	 * await rpc.delivery.deliverTranscriptionResult.execute({
	 *   text: transcript,
	 *   toastId: nanoid()
	 * });
	 * ```
	 */
	deliverTranscriptionResult: defineMutation({
		mutationKey: ['delivery', 'deliverTranscriptionResult'],
		mutationFn: async ({
			text,
			toastId,
		}: {
			text: string;
			toastId: string;
		}) => {
			// Track what operations succeeded
			let copied = false;
			let written = false;

			// Shows transcription result and offers manual copy action
			const offerManualCopy = () =>
				rpc.notify.success.execute({
					id: toastId,
					title: '📝 录音已转录！',
					description: text,
					action: {
						type: 'button',
						label: '复制到剪贴板',
						onClick: async () => {
							const { error } = await rpc.text.copyToClipboard.execute({
								text,
							});
							if (error) {
								// Report that manual copy attempt failed
								rpc.notify.error.execute({
									title: '将转录文本复制到剪贴板时出错',
									description: error.message,
									action: { type: 'more-details', error },
								});
								return;
							}
							// Confirm manual copy succeeded
							rpc.notify.success.execute({
								id: toastId,
								title: '已将转录文本复制到剪贴板！',
								description: text,
							});
						},
					},
				});

			// Warns that automatic copy failed
			const warnAutoCopyFailed = (error: TextServiceError) => {
				rpc.notify.warning.execute({
					title: '无法复制到剪贴板',
					description: error.message,
					action: { type: 'more-details', error },
				});
			};

			// Warns that write to cursor failed
			const warnWriteToCursorFailed = (
				error: TextServiceError | WhisperingError,
			) => {
				if (error.name === 'TextServiceError') {
					rpc.notify.warning.execute({
						title: '无法自动写入到光标位置',
						description: error.message,
						action: { type: 'more-details', error },
					});
					return;
				}
				if (error.name === 'WhisperingError') {
					rpc.notify[error.severity].execute(error);
					return;
				}
			};

			// Show appropriate success notification based on what succeeded
			const showSuccessNotification = () => {
				if (copied && written) {
					// Both operations succeeded
					rpc.notify.success.execute({
						id: toastId,
						title:
							'📝 录音已转录，已复制到剪贴板，并已写入到光标位置！',
						description: text,
						action: {
							type: 'link',
							label: '前往录音记录',
							href: WHISPERING_RECORDINGS_PATHNAME,
						},
					});
				} else if (copied) {
					// Only copy succeeded
					rpc.notify.success.execute({
						id: toastId,
						title: '📝 录音已转录并已复制到剪贴板！',
						description: text,
						action: {
							type: 'link',
							label: '前往录音记录',
							href: WHISPERING_RECORDINGS_PATHNAME,
						},
					});
				} else if (written) {
					// Only write succeeded
					rpc.notify.success.execute({
						id: toastId,
						title: '📝 录音已转录并已写入到光标位置！',
						description: text,
						action: {
							type: 'link',
							label: '前往录音记录',
							href: WHISPERING_RECORDINGS_PATHNAME,
						},
					});
				} else {
					// Neither succeeded, offer manual copy
					offerManualCopy();
				}
			};

			// Main delivery flow - operations are independent

			// Check if user wants to copy to clipboard
			if (settings.value['transcription.copyToClipboardOnSuccess']) {
				const { error: copyError } = await rpc.text.copyToClipboard.execute({
					text,
				});
				if (!copyError) {
					copied = true;
				} else {
					warnAutoCopyFailed(copyError);
				}
			}

			// Check if user wants to write to cursor (independent of copy)
			if (settings.value['transcription.writeToCursorOnSuccess']) {
				const { error: writeError } = await rpc.text.writeToCursor.execute({
					text,
				});
				if (!writeError) {
					written = true;
					// Optionally simulate Enter keystroke after successful write
					if (settings.value['transcription.simulateEnterAfterOutput']) {
						const { error: enterError } =
							await rpc.text.simulateEnterKeystroke.execute();
						if (enterError) {
							rpc.notify.warning.execute({
								title: '无法模拟回车键按下',
								description: enterError.message,
								action: { type: 'more-details', error: enterError },
							});
						}
					}
				} else {
					warnWriteToCursorFailed(writeError);
				}
			}

			// Show appropriate notification
			showSuccessNotification();

			return Ok(undefined);
		},
	}),

	/**
	 * Delivers transformed text to the user according to their text output preferences.
	 *
	 * This mutation handles the complete delivery workflow for transformation results:
	 * 1. Shows a success toast with the transformed text
	 * 2. Optionally copies text to clipboard based on user settings
	 * 3. Optionally writes text to cursor based on user settings
	 * 4. Provides fallback UI actions when automatic operations fail
	 *
	 * The user's preferences are read from:
	 * - `transformation.copyToClipboardOnSuccess` - Whether to auto-copy
	 * - `transformation.writeToCursorOnSuccess` - Whether to auto-write to cursor
	 *
	 * @param text - The transformed text to deliver
	 * @param toastId - Unique ID for toast notifications to prevent duplicates
	 * @returns Result with no meaningful data (fire-and-forget operation)
	 *
	 * @example
	 * ```typescript
	 * // After transformation completes
	 * await rpc.delivery.deliverTransformationResult.execute({
	 *   text: transformedText,
	 *   toastId: nanoid()
	 * });
	 * ```
	 */
	deliverTransformationResult: defineMutation({
		mutationKey: ['delivery', 'deliverTransformationResult'],
		mutationFn: async ({
			text,
			toastId,
		}: {
			text: string;
			toastId: string;
		}) => {
			// Track what operations succeeded
			let copied = false;
			let written = false;

			// Shows transformation result and offers manual copy action
			const offerManualCopy = () =>
				rpc.notify.success.execute({
					id: toastId,
					title: '🔄 转换完成！',
					description: text,
					action: {
						type: 'button',
						label: '复制到剪贴板',
						onClick: async () => {
							const { error } = await rpc.text.copyToClipboard.execute({
								text,
							});
							if (error) {
								// Report that manual copy attempt failed
								rpc.notify.error.execute({
									title: '将转换后的文本复制到剪贴板时出错',
									description: error.message,
									action: { type: 'more-details', error },
								});
								return;
							}
							// Confirm manual copy succeeded
							rpc.notify.success.execute({
								id: toastId,
								title: '已将转换后的文本复制到剪贴板！',
								description: text,
							});
						},
					},
				});

			// Warns that automatic copy failed
			const warnAutoCopyFailed = (error: TextServiceError) => {
				rpc.notify.warning.execute({
					title: '无法复制到剪贴板',
					description: error.message,
					action: { type: 'more-details', error },
				});
			};

			// Warns that write to cursor failed
			const warnWriteToCursorFailed = (
				error: TextServiceError | WhisperingError,
			) => {
				if (error.name === 'TextServiceError') {
					rpc.notify.error.execute({
						title: '将转换后的文本写入到光标位置时出错',
						description: error.message,
						action: { type: 'more-details', error },
					});
					return;
				}
				if (error.name === 'WhisperingError') {
					rpc.notify[error.severity].execute(error);
					return;
				}
			};

			// Show appropriate success notification based on what succeeded
			const showSuccessNotification = () => {
				if (copied && written) {
					// Both operations succeeded
					rpc.notify.success.execute({
						id: toastId,
						title:
							'🔄 转换完成，已复制到剪贴板，并已写入到光标位置！',
						description: text,
						action: {
							type: 'link',
							label: '前往录音记录',
							href: WHISPERING_RECORDINGS_PATHNAME,
						},
					});
				} else if (copied) {
					// Only copy succeeded
					rpc.notify.success.execute({
						id: toastId,
						title: '🔄 转换完成，已复制到剪贴板！',
						description: text,
						action: {
							type: 'link',
							label: '前往录音记录',
							href: WHISPERING_RECORDINGS_PATHNAME,
						},
					});
				} else if (written) {
					// Only write succeeded
					rpc.notify.success.execute({
						id: toastId,
						title: '🔄 转换完成，已写入到光标位置！',
						description: text,
						action: {
							type: 'link',
							label: '前往录音记录',
							href: WHISPERING_RECORDINGS_PATHNAME,
						},
					});
				} else {
					// Neither succeeded, offer manual copy
					offerManualCopy();
				}
			};

			// Main delivery flow - operations are independent

			// Check if user wants to copy to clipboard
			if (settings.value['transformation.copyToClipboardOnSuccess']) {
				const { error: copyError } = await rpc.text.copyToClipboard.execute({
					text,
				});
				if (!copyError) {
					copied = true;
				} else {
					warnAutoCopyFailed(copyError);
				}
			}

			// Check if user wants to write to cursor (independent of copy)
			if (settings.value['transformation.writeToCursorOnSuccess']) {
				const { error: writeError } = await rpc.text.writeToCursor.execute({
					text,
				});
				if (!writeError) {
					written = true;
					// Optionally simulate Enter keystroke after successful write
					if (settings.value['transformation.simulateEnterAfterOutput']) {
						const { error: enterError } =
							await rpc.text.simulateEnterKeystroke.execute();
						if (enterError) {
							rpc.notify.warning.execute({
								title: '无法模拟回车键按下',
								description: enterError.message,
								action: { type: 'more-details', error: enterError },
							});
						}
					}
				} else {
					warnWriteToCursorFailed(writeError);
				}
			}

			// Show appropriate notification
			showSuccessNotification();

			return Ok(undefined);
		},
	}),
};
