<script lang="ts">
	import TextPreviewDialog from '$lib/components/copyable/TextPreviewDialog.svelte';
	import { Skeleton } from '@epicenter/ui/skeleton';
	import { rpc } from '$lib/query';
	import { viewTransition } from '$lib/utils/viewTransitions';
	import { createQuery } from '@tanstack/svelte-query';

	let {
		recordingId,
	}: {
		recordingId: string;
	} = $props();

	const latestTransformationRunByRecordingIdQuery = createQuery(
		() => rpc.db.runs.getLatestByRecordingId(() => recordingId).options,
	);

	const id = $derived(
		viewTransition.recording(recordingId).transformationOutput,
	);
</script>

{#if latestTransformationRunByRecordingIdQuery.isPending}
	<div class="space-y-2">
		<Skeleton class="h-3" />
		<Skeleton class="h-3" />
		<Skeleton class="h-3" />
	</div>
{:else if latestTransformationRunByRecordingIdQuery.error}
	<TextPreviewDialog
		{id}
		title="查询错误"
		label="查询错误"
		text={latestTransformationRunByRecordingIdQuery.error.message}
	/>
{:else if latestTransformationRunByRecordingIdQuery.data?.status === 'failed'}
	<TextPreviewDialog
		{id}
		title="转换错误"
		label="转换错误"
		text={latestTransformationRunByRecordingIdQuery.data.error}
	/>
{:else if latestTransformationRunByRecordingIdQuery.data?.status === 'completed'}
	<TextPreviewDialog
		{id}
		title="转换输出"
		label="转换输出"
		text={latestTransformationRunByRecordingIdQuery.data.output}
	/>
{/if}
