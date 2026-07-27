<script lang="ts">
	import { Runs } from '$lib/components/transformations-editor';
	import { Button } from '@epicenter/ui/button';
	import * as Dialog from '@epicenter/ui/dialog';
	import { rpc } from '$lib/query';
	import { createQuery } from '@tanstack/svelte-query';
	import HistoryIcon from '@lucide/svelte/icons/history';

	let { recordingId }: { recordingId: string } = $props();

	const transformationRunsByRecordingIdQuery = createQuery(
		() => rpc.db.runs.getByRecordingId(() => recordingId).options,
	);

	let isOpen = $state(false);
</script>

<Dialog.Root bind:open={isOpen}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				tooltip="查看转换运行"
			>
				<HistoryIcon class="size-4" />
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-4xl">
		<Dialog.Header>
			<Dialog.Title>转换运行</Dialog.Title>
			<Dialog.Description>
				查看此录音的所有转换运行
			</Dialog.Description>
		</Dialog.Header>
		<div class="max-h-[60vh] overflow-y-auto">
			{#if transformationRunsByRecordingIdQuery.isPending}
				<div class="text-muted-foreground text-sm">加载运行中...</div>
			{:else if transformationRunsByRecordingIdQuery.error}
				<div class="text-destructive text-sm">
					{transformationRunsByRecordingIdQuery.error.message}
				</div>
			{:else if transformationRunsByRecordingIdQuery.data}
				<Runs runs={transformationRunsByRecordingIdQuery.data} />
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (isOpen = false)}>关闭</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
