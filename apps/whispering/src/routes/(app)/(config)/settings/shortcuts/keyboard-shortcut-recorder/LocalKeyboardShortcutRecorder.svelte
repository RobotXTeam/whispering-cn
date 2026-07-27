<script lang="ts">
	import type { Command } from '$lib/commands';
	import type { KeyboardEventSupportedKey } from '$lib/constants/keyboard';
	import { rpc } from '$lib/query';
	import {
		type CommandId,
		arrayToShortcutString,
	} from '$lib/services/isomorphic/local-shortcut-manager';
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
		settings.value[`shortcuts.local.${command.id}`],
	);

	const keyRecorder = createKeyRecorder({
		pressedKeys,
		onRegister: async (keyCombination: KeyboardEventSupportedKey[]) => {
			const { error: unregisterError } =
				await rpc.localShortcuts.unregisterCommand.execute({
					commandId: command.id as CommandId,
				});
			if (unregisterError) {
				rpc.notify.error.execute({
					title: '取消注册应用内快捷键出错',
					description: unregisterError.message,
					action: { type: 'more-details', error: unregisterError },
				});
			}
			const { error: registerError } =
				await rpc.localShortcuts.registerCommand.execute({
					command,
					keyCombination,
				});

			if (registerError) {
				rpc.notify.error.execute({
					title: '注册应用内快捷键出错',
					description: registerError.message,
					action: { type: 'more-details', error: registerError },
				});
				return;
			}

			settings.updateKey(
				`shortcuts.local.${command.id}`,
				arrayToShortcutString(keyCombination),
			);

			rpc.notify.success.execute({
				title: `应用内快捷键已设置为 ${keyCombination}`,
				description: `按快捷键以触发"${command.title}"`,
			});
		},
		onClear: async () => {
			const { error: unregisterError } =
				await rpc.localShortcuts.unregisterCommand.execute({
					commandId: command.id as CommandId,
				});
			if (unregisterError) {
				rpc.notify.error.execute({
					title: '清除应用内快捷键出错',
					description: unregisterError.message,
					action: { type: 'more-details', error: unregisterError },
				});
			}
			settings.updateKey(`shortcuts.local.${command.id}`, null);

			rpc.notify.success.execute({
				title: '应用内快捷键已清除',
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
