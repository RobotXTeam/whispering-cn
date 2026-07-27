import { nanoid } from 'nanoid/non-secure';
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import { IS_MACOS } from '$lib/constants/platform';
import { desktopServices } from '$lib/services';

export function registerAccessibilityPermission() {
	// Only run on macOS desktop
	if (!IS_MACOS) return;

	const accessibilityToastId = nanoid();

	// Check accessibility permission once on mount
	(async () => {
		const { data: isAccessibilityGranted, error } =
			await desktopServices.permissions.accessibility.check();

		if (error) {
			console.error('Failed to check accessibility permissions:', error);
			return;
		}

		if (!isAccessibilityGranted) {
			// Toast if permission not granted
			toast.warning('辅助功能权限问题', {
				id: accessibilityToastId,
				description:
					'Whispering 需要辅助功能权限。这通常需要在更新后移除并重新添加应用。',
				duration: Number.POSITIVE_INFINITY,
				action: {
					label: '查看指南',
					onClick: () => {
						goto('/macos-enable-accessibility');
						// Dismiss the toast
						toast.dismiss(accessibilityToastId);
					},
				},
			});
		}
	})();

	// Return cleanup function
	return () => {
		toast.dismiss(accessibilityToastId);
	};
}

export function registerMicrophonePermission() {
	// Only run on macOS desktop
	if (!IS_MACOS) return;

	const microphoneToastId = nanoid();

	// Check microphone permission once on mount
	(async () => {
		const { data: isMicrophoneGranted, error } =
			await desktopServices.permissions.microphone.check();

		if (error) {
			console.error('Failed to check microphone permissions:', error);
			return;
		}

		if (!isMicrophoneGranted) {
			// Toast if permission not granted
			toast.info('需要麦克风权限', {
				id: microphoneToastId,
				description: 'Whispering 需要麦克风访问权限才能录制音频',
				duration: Number.POSITIVE_INFINITY,
				action: {
					label: '启用权限',
					onClick: async () => {
						const { error: requestError } =
							await desktopServices.permissions.microphone.request();

						if (requestError) {
							toast.error('请求麦克风权限失败', {
								description: '请检查你的系统设置',
							});
							return;
						}
						// Dismiss the toast after requesting
						toast.dismiss(microphoneToastId);
					},
				},
			});
		}
	})();

	// Return cleanup function
	return () => {
		toast.dismiss(microphoneToastId);
	};
}
