<script lang="ts">
	import { commands } from '$lib/commands';
	import { Input } from '@epicenter/ui/input';
	import * as Table from '@epicenter/ui/table';
	import { rpc } from '$lib/query';
	import { getDefaultSettings } from '$lib/settings';
	import { createPressedKeys } from '$lib/utils/createPressedKeys.svelte';
	import Search from '@lucide/svelte/icons/search';
	import GlobalKeyboardShortcutRecorder from './GlobalKeyboardShortcutRecorder.svelte';
	import LocalKeyboardShortcutRecorder from './LocalKeyboardShortcutRecorder.svelte';

	let { type }: { type: 'local' | 'global' } = $props();

	let searchQuery = $state('');

	const defaultSettings = getDefaultSettings();

	const filteredCommands = $derived(
		commands.filter((command) =>
			command.title.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);

	const pressedKeys = createPressedKeys({
		onUnsupportedKey: (key) => {
			rpc.notify.warning.execute({
				title: '不支持的按键',
				description: `按键"${key}"不支持。请尝试其他按键。`,
			});
		},
	});
</script>

<div class="space-y-4">
	<!-- Search input -->
	<div class="relative">
		<Search
			class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Input
			type="search"
			placeholder="搜索命令..."
			class="pl-10"
			bind:value={searchQuery}
		/>
	</div>

	<!-- Command list with shortcuts -->
	<div class="overflow-x-auto rounded-lg border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="min-w-[150px]">命令</Table.Head>
					<Table.Head class="text-right min-w-[200px]">快捷键</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each filteredCommands as command}
					{@const defaultShortcut =
						defaultSettings[`shortcuts.${type}.${command.id}`]}
					<Table.Row>
						<Table.Cell class="font-medium">
							<span class="block truncate pr-2">{command.title}</span>
						</Table.Cell>
						<Table.Cell class="text-right">
							{#if type === 'local'}
								<LocalKeyboardShortcutRecorder
									{command}
									placeholder={defaultShortcut
										? `默认:${defaultShortcut}`
										: '设置快捷键'}
									{pressedKeys}
								/>
							{:else}
								<GlobalKeyboardShortcutRecorder
									{command}
									placeholder={defaultShortcut
										? `默认:${defaultShortcut}`
										: '设置快捷键'}
									{pressedKeys}
								/>
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>
