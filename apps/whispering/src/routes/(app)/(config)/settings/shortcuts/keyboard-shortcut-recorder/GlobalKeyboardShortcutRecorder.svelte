<script lang="ts">
	import type { Command } from '$lib/commands';
	import type { KeyboardEventSupportedKey } from '$lib/constants/keyboard';
	import { desktopRpc, rpc } from '$lib/query';
	import {
		type Accelerator,
		pressedKeysToTauriAccelerator,
	} from '$lib/services/desktop/global-shortcut-manager';
	import { settings } from '$lib/stores/settings.svelte';
	import { type PressedKeys } from '$lib/utils/createPressedKeys.svelte';
	import KeyboardShortcutRecorder from './KeyboardShortcutRecorder.svelte';
	import { createKeyRecorder } from './create-key-recorder.svelte';

	const {
		command,
		placeholder,
		autoFocus = true,
		pressedKeys,
	}: {
		command: Command;
		placeholder?: string;
		autoFocus?: boolean;
		pressedKeys: PressedKeys;
	} = $props();

	const shortcutValue = $derived(
		settings.value[`shortcuts.global.${command.id}`],
	);

	const keyRecorder = createKeyRecorder({
		pressedKeys,
		onRegister: async (keyCombination: KeyboardEventSupportedKey[]) => {
			if (shortcutValue) {
				const { error: unregisterError } =
					await desktopRpc.globalShortcuts.unregisterCommand.execute({
						accelerator: shortcutValue as Accelerator,
					});

				if (unregisterError) {
					rpc.notify.error.execute({
						title: '取消注册快捷键失败',
						description:
							'无法取消注册全局快捷键。它可能已被其他应用占用。',
						action: { type: 'more-details', error: unregisterError },
					});
				}
			}

			const { data: accelerator, error: acceleratorError } =
				pressedKeysToTauriAccelerator(keyCombination);

			if (acceleratorError) {
				rpc.notify.error.execute({
					title: '无效的快捷键组合',
					description: `按键组合"${keyCombination.join('+')}"无效。请尝试其他组合。`,
					action: { type: 'more-details', error: acceleratorError },
				});
				return;
			}

			const { error: registerError } =
				await desktopRpc.globalShortcuts.registerCommand.execute({
					command,
					accelerator,
				});

			if (registerError) {
				switch (registerError.name) {
					case 'InvalidAcceleratorError':
						rpc.notify.error.execute({
							title: '无效的快捷键组合',
							description: `按键组合"${keyCombination.join('+')}"无效。请尝试其他组合。`,
							action: { type: 'more-details', error: registerError },
						});
						break;
					default:
						rpc.notify.error.execute({
							title: '注册快捷键失败',
							description:
								'无法注册全局快捷键。它可能已被其他应用占用。',
							action: { type: 'more-details', error: registerError },
						});
						break;
				}
				return;
			}

			settings.updateKey(`shortcuts.global.${command.id}`, accelerator);

			rpc.notify.success.execute({
				title: `全局快捷键已设置为 ${accelerator}`,
				description: `按快捷键以触发"${command.title}"`,
			});
		},
		onClear: async () => {
			const { error: unregisterError } =
				await desktopRpc.globalShortcuts.unregisterCommand.execute({
					accelerator: shortcutValue as Accelerator,
				});

			if (unregisterError) {
				rpc.notify.error.execute({
					title: '清除全局快捷键出错',
					description: '无法清除全局快捷键。',
					action: { type: 'more-details', error: unregisterError },
				});
			}

			settings.updateKey(`shortcuts.global.${command.id}`, null);

			rpc.notify.success.execute({
				title: '全局快捷键已清除',
				description: `请设置新的快捷键以触发"${command.title}"`,
			});
		},
	});
</script>

<KeyboardShortcutRecorder
	title={command.title}
	{placeholder}
	{autoFocus}
	rawKeyCombination={shortcutValue}
	{keyRecorder}
/>
