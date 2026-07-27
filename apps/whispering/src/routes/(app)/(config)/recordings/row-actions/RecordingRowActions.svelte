<script lang="ts">
	import { confirmationDialog } from '$lib/components/ConfirmationDialog.svelte';
	import { Button } from '@epicenter/ui/button';
	import { CopyButton } from '@epicenter/ui/copy-button';
	import * as Tooltip from '@epicenter/ui/tooltip';
	import { TrashIcon } from '$lib/components/icons';
	import { createCopyFn } from '$lib/utils/createCopyFn';
	import { Skeleton } from '@epicenter/ui/skeleton';
	import { rpc } from '$lib/query';
	import { viewTransition } from '$lib/utils/viewTransitions';
	import { createMutation, createQuery } from '@tanstack/svelte-query';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import FileStackIcon from '@lucide/svelte/icons/file-stack';
	import { Spinner } from '@epicenter/ui/spinner';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import EditRecordingModal from './EditRecordingModal.svelte';
	import TransformationPicker from './TransformationPicker.svelte';
	import ViewTransformationRunsDialog from './ViewTransformationRunsDialog.svelte';
	import { nanoid } from 'nanoid/non-secure';

	const transcribeRecording = createMutation(
		() => rpc.transcription.transcribeRecording.options,
	);

	const downloadRecording = createMutation(
		() => rpc.download.downloadRecording.options,
	);

	let { recordingId }: { recordingId: string } = $props();

	const latestTransformationRunByRecordingIdQuery = createQuery(
		() => rpc.db.runs.getLatestByRecordingId(() => recordingId).options,
	);

	const recordingQuery = createQuery(
		() => rpc.db.recordings.getById(() => recordingId).options,
	);

	const recording = $derived(recordingQuery.data);
</script>

<div class="flex items-center gap-1">
	{#if !recording}
		<Skeleton class="size-8" />
		<Skeleton class="size-8" />
		<Skeleton class="size-8" />
		<Skeleton class="size-8" />
		<Skeleton class="size-8" />
	{:else}
		<Button
			tooltip={recording.transcriptionStatus === 'UNPROCESSED'
				? '开始转录此录音'
				: recording.transcriptionStatus === 'TRANSCRIBING'
					? '正在转录...'
					: recording.transcriptionStatus === 'DONE'
						? '重新转录'
						: '转录失败 - 点击重试'}
			onclick={() => {
				const toastId = nanoid();
				rpc.notify.loading.execute({
					id: toastId,
					title: '📋 正在转录...',
					description: '您的录音正在转录...',
				});
				transcribeRecording.mutate(recording, {
					onError: (error) => {
						if (error.name === 'WhisperingError') {
							rpc.notify.error.execute({ id: toastId, ...error });
							return;
						}
						rpc.notify.error.execute({
							id: toastId,
							title: '❌ 转录录音失败',
							description: '您的录音无法转录。',
							action: { type: 'more-details', error: error },
						});
					},
					onSuccess: (transcribedText) => {
						rpc.sound.playSoundIfEnabled.execute('transcriptionComplete');

						rpc.delivery.deliverTranscriptionResult.execute({
							text: transcribedText,
							toastId,
						});
					},
				});
			}}
			variant="ghost"
			size="icon"
		>
			{#if recording.transcriptionStatus === 'UNPROCESSED'}
				<PlayIcon class="size-4" />
			{:else if recording.transcriptionStatus === 'TRANSCRIBING'}
				<EllipsisIcon class="size-4" />
			{:else if recording.transcriptionStatus === 'DONE'}
				<RepeatIcon class="size-4 text-green-500" />
			{:else if recording.transcriptionStatus === 'FAILED'}
				<AlertCircleIcon class="size-4 text-red-500" />
			{/if}
		</Button>

		<TransformationPicker recordingId={recording.id} />

		<EditRecordingModal {recording} />

		<CopyButton
			text={recording.transcribedText}
			copyFn={createCopyFn('transcript')}
			style="view-transition-name: {viewTransition.recording(recordingId)
				.transcript}"
		/>

		{#if latestTransformationRunByRecordingIdQuery.isPending}
			<Spinner />
		{:else if latestTransformationRunByRecordingIdQuery.isError}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<AlertCircleIcon
							class="text-red-500"
							{...props}
							id={viewTransition.recording(recordingId).transformationOutput}
						/>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content class="max-w-xs text-center">
					获取最新转换运行输出时出错
				</Tooltip.Content>
			</Tooltip.Root>
		{:else}
			<CopyButton
				text={latestTransformationRunByRecordingIdQuery.data?.status ===
				'completed'
					? latestTransformationRunByRecordingIdQuery.data.output
					: ''}
				copyFn={createCopyFn('latest transformation run output')}
				style="view-transition-name: {viewTransition.recording(recordingId)
					.transformationOutput}"
			>
				{#snippet icon()}
					<FileStackIcon class="size-4" />
				{/snippet}
			</CopyButton>
		{/if}

		<ViewTransformationRunsDialog {recordingId} />

		<Button
			tooltip="下载录音"
			onclick={() =>
				downloadRecording.mutate(recording, {
					onError: (error) => {
						if (error.name === 'WhisperingError') {
							rpc.notify.error.execute(error);
							return;
						}
						rpc.notify.error.execute({
							title: '下载录音失败!',
							description: '您的录音无法下载。',
							action: { type: 'more-details', error },
						});
					},
					onSuccess: () => {
						rpc.notify.success.execute({
							title: '录音已下载!',
							description: '您的录音已下载。',
						});
					},
				})}
			variant="ghost"
			size="icon"
		>
			{#if downloadRecording.isPending}
				<Spinner />
			{:else}
				<DownloadIcon class="size-4" />
			{/if}
		</Button>

		<Button
			tooltip="删除录音"
			onclick={() => {
				confirmationDialog.open({
					title: '删除录音',
					description: '确定要删除此录音吗?',
					confirm: { text: '删除', variant: 'destructive' },
					onConfirm: async () => {
						const { error } = await rpc.db.recordings.delete.execute(recording);
						if (error) {
							rpc.notify.error.execute({
								title: '删除录音失败!',
								description: '您的录音无法删除。',
								action: { type: 'more-details', error },
							});
							throw error;
						}
						rpc.notify.success.execute({
							title: '已删除录音!',
							description: '您的录音已删除。',
						});
					},
				});
			}}
			variant="ghost"
			size="icon"
		>
			<TrashIcon class="size-4" />
		</Button>
	{/if}
</div>
