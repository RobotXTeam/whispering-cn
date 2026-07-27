<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import * as RadioGroup from '@epicenter/ui/radio-group';
	import * as Select from '@epicenter/ui/select';
	import { Switch } from '@epicenter/ui/switch';
	import { createMutation, createQuery } from '@tanstack/svelte-query';
	import {
		ALWAYS_ON_TOP_MODE_OPTIONS,
		LAYOUT_MODE_OPTIONS,
	} from '$lib/constants/ui';
	import { desktopRpc, rpc } from '$lib/query';
	import { settings } from '$lib/stores/settings.svelte';

	const retentionItems = [
		{ value: 'keep-forever', label: '保留所有录音' },
		{ value: 'limit-count', label: '保留有限数量' },
	];

	const maxRecordingItems = [
		{ value: '0', label: '0 条录音（从不保存）' },
		{ value: '5', label: '5 条录音' },
		{ value: '10', label: '10 条录音' },
		{ value: '25', label: '25 条录音' },
		{ value: '50', label: '50 条录音' },
		{ value: '100', label: '100 条录音' },
	];

	const retentionLabel = $derived(
		retentionItems.find(
			(i) => i.value === settings.value['database.recordingRetentionStrategy'],
		)?.label,
	);

	const maxRecordingLabel = $derived(
		maxRecordingItems.find(
			(i) => i.value === settings.value['database.maxRecordingCount'],
		)?.label,
	);

	const alwaysOnTopLabel = $derived(
		ALWAYS_ON_TOP_MODE_OPTIONS.find(
			(i) => i.value === settings.value['system.alwaysOnTop'],
		)?.label,
	);

	const autostartQuery = createQuery(
		() => desktopRpc.autostart.isEnabled.options,
	);
	const enableAutostartMutation = createMutation(
		() => desktopRpc.autostart.enable.options,
	);
	const disableAutostartMutation = createMutation(
		() => desktopRpc.autostart.disable.options,
	);
</script>

<svelte:head>
	<title>设置 - Whispering</title>
</svelte:head>

<Field.Set>
	<Field.Legend>通用</Field.Legend>
	<Field.Description>
		配置你的 Whispering 通用偏好。
	</Field.Description>
	<Field.Separator />
	<Field.Group>
		<Field.Set>
			<Field.Legend variant="label">转录输出</Field.Legend>
			<Field.Description>
				在音频转录完成后立即应用。
			</Field.Description>
			<Field.Group>
				<Field.Field orientation="horizontal">
					<Switch
						id="transcription.copyToClipboardOnSuccess"
						bind:checked={
							() => settings.value['transcription.copyToClipboardOnSuccess'],
							(v) =>
								settings.updateKey('transcription.copyToClipboardOnSuccess', v)
						}
					/>
					<Field.Label for="transcription.copyToClipboardOnSuccess">
						复制转录文本到剪贴板
					</Field.Label>
				</Field.Field>

				<Field.Field orientation="horizontal">
					<Switch
						id="transcription.writeToCursorOnSuccess"
						bind:checked={
							() => settings.value['transcription.writeToCursorOnSuccess'],
							(v) =>
								settings.updateKey('transcription.writeToCursorOnSuccess', v)
						}
					/>
					<Field.Label for="transcription.writeToCursorOnSuccess">
						在光标处粘贴转录文本
					</Field.Label>
				</Field.Field>

				{#if window.__TAURI_INTERNALS__ && settings.value['transcription.writeToCursorOnSuccess']}
					<Field.Field orientation="horizontal">
						<Switch
							id="transcription.simulateEnterAfterOutput"
							bind:checked={
								() => settings.value['transcription.simulateEnterAfterOutput'],
								(v) =>
									settings.updateKey(
										'transcription.simulateEnterAfterOutput',
										v,
									)
							}
						/>
						<Field.Label for="transcription.simulateEnterAfterOutput">
							粘贴转录文本后按回车键
						</Field.Label>
					</Field.Field>
				{/if}
			</Field.Group>
		</Field.Set>

		<Field.Separator />

		<Field.Set>
			<Field.Legend variant="label">转换输出</Field.Legend>
			<Field.Description>
				在你对转录文本运行已保存的转换后应用。
			</Field.Description>
			<Field.Group>
				<Field.Field orientation="horizontal">
					<Switch
						id="transformation.copyToClipboardOnSuccess"
						bind:checked={
							() => settings.value['transformation.copyToClipboardOnSuccess'],
							(v) =>
								settings.updateKey('transformation.copyToClipboardOnSuccess', v)
						}
					/>
					<Field.Label for="transformation.copyToClipboardOnSuccess">
						复制转换后的文本到剪贴板
					</Field.Label>
				</Field.Field>

				<Field.Field orientation="horizontal">
					<Switch
						id="transformation.writeToCursorOnSuccess"
						bind:checked={
							() => settings.value['transformation.writeToCursorOnSuccess'],
							(v) =>
								settings.updateKey('transformation.writeToCursorOnSuccess', v)
						}
					/>
					<Field.Label for="transformation.writeToCursorOnSuccess">
						在光标处粘贴转换后的文本
					</Field.Label>
				</Field.Field>

				{#if window.__TAURI_INTERNALS__ && settings.value['transformation.writeToCursorOnSuccess']}
					<Field.Field orientation="horizontal">
						<Switch
							id="transformation.simulateEnterAfterOutput"
							bind:checked={
								() => settings.value['transformation.simulateEnterAfterOutput'],
								(v) =>
									settings.updateKey(
										'transformation.simulateEnterAfterOutput',
										v,
									)
							}
						/>
						<Field.Label for="transformation.simulateEnterAfterOutput">
							粘贴转换后的文本后按回车键
						</Field.Label>
					</Field.Field>
				{/if}
			</Field.Group>
		</Field.Set>

		<Field.Separator />

		<Field.Field>
			<Field.Label for="recording-retention-strategy"
				>自动删除录音</Field.Label
			>
			<Select.Root
				type="single"
				bind:value={
					() => settings.value['database.recordingRetentionStrategy'],
					(v) => settings.updateKey('database.recordingRetentionStrategy', v)
				}
			>
				<Select.Trigger id="recording-retention-strategy" class="w-full">
					{retentionLabel ?? '选择保留策略'}
				</Select.Trigger>
				<Select.Content>
					{#each retentionItems as item}
						<Select.Item value={item.value} label={item.label} />
					{/each}
				</Select.Content>
			</Select.Root>
		</Field.Field>

		{#if settings.value['database.recordingRetentionStrategy'] === 'limit-count'}
			<Field.Field>
				<Field.Label for="max-recording-count">最大录音数</Field.Label>
				<Select.Root
					type="single"
					bind:value={
						() => settings.value['database.maxRecordingCount'],
						(v) => settings.updateKey('database.maxRecordingCount', v)
					}
				>
					<Select.Trigger id="max-recording-count" class="w-full">
						{maxRecordingLabel ?? '选择最大录音数'}
					</Select.Trigger>
					<Select.Content>
						{#each maxRecordingItems as item}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Content>
				</Select.Root>
			</Field.Field>
		{/if}

		{#if window.__TAURI_INTERNALS__}
			<Field.Field orientation="horizontal">
				<Field.Content>
					<Field.Label for="autostart">开机启动</Field.Label>
					<Field.Description>
						登录时自动打开 Whispering
					</Field.Description>
				</Field.Content>
				<Switch
					id="autostart"
					checked={autostartQuery.data ?? false}
					onCheckedChange={(checked) => {
						if (checked) {
							enableAutostartMutation.mutate(undefined, {
								onError: (error) => rpc.notify.error.execute(error),
							});
						} else {
							disableAutostartMutation.mutate(undefined, {
								onError: (error) => rpc.notify.error.execute(error),
							});
						}
					}}
					disabled={autostartQuery.isPending ||
						enableAutostartMutation.isPending ||
						disableAutostartMutation.isPending}
				/>
			</Field.Field>
			<Field.Field>
				<Field.Label for="always-on-top">置顶</Field.Label>
				<Select.Root
					type="single"
					bind:value={
						() => settings.value['system.alwaysOnTop'],
						(v) => settings.updateKey('system.alwaysOnTop', v)
					}
				>
					<Select.Trigger id="always-on-top" class="w-full">
						{alwaysOnTopLabel ?? '选择置顶模式'}
					</Select.Trigger>
					<Select.Content>
						{#each ALWAYS_ON_TOP_MODE_OPTIONS as item}
							<Select.Item value={item.value} label={item.label} />
						{/each}
					</Select.Content>
				</Select.Root>
			</Field.Field>
		{/if}

		<Field.Separator />

		<Field.Set>
			<Field.Legend variant="label">导航布局</Field.Legend>
			<Field.Description>选择你浏览应用的方式。</Field.Description>
			<RadioGroup.Root
				bind:value={
					() => settings.value['ui.layoutMode'],
					(v) => settings.updateKey('ui.layoutMode', v)
				}
			>
				{#each LAYOUT_MODE_OPTIONS as option (option.value)}
					<Field.Label for="layout-{option.value}">
						<Field.Field orientation="horizontal">
							<Field.Content>
								<Field.Title>{option.label}</Field.Title>
								<Field.Description>{option.description}</Field.Description>
							</Field.Content>
							<RadioGroup.Item
								value={option.value}
								id="layout-{option.value}"
							/>
						</Field.Field>
					</Field.Label>
				{/each}
			</RadioGroup.Root>
		</Field.Set>
	</Field.Group>
</Field.Set>
