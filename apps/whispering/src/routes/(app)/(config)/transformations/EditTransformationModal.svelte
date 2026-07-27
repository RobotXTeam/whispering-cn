<script lang="ts">
	import { confirmationDialog } from '$lib/components/ConfirmationDialog.svelte';
	import { PencilIcon as EditIcon } from '$lib/components/icons';
	import { Editor } from '$lib/components/transformations-editor';
	import { Button } from '@epicenter/ui/button';
	import * as Modal from '@epicenter/ui/modal';
	import { Separator } from '@epicenter/ui/separator';
	import { rpc } from '$lib/query';
	import type { Transformation } from '$lib/services/isomorphic/db';
	import { createMutation } from '@tanstack/svelte-query';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import { Spinner } from '@epicenter/ui/spinner';
	import PlayIcon from '@lucide/svelte/icons/play';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import MarkTransformationActiveButton from './MarkTransformationActiveButton.svelte';

	const updateTransformation = createMutation(
		() => rpc.db.transformations.update.options,
	);

	let {
		transformation,
		class: className,
	}: { transformation: Transformation; class?: string } = $props();

	let isDialogOpen = $state(false);

	/**
	 * A working copy of the transformation that we can safely edit.
	 *
	 * It's like a photocopy of an important document—you don't want to
	 * accidentally mess up the original. You edit the photocopy, submit it,
	 * and the original is updated. Then you get a new photocopy.
	 *
	 * Here's how it works:
	 * 1. We get the original transformation data
	 * 2. We make a copy of it (this variable)
	 * 3. User makes changes to the copy
	 * 4. When they save, we send the copy via mutation
	 * 5. The mutation updates the original transformation
	 * 6. We get the fresh original data back and make a new copy (via $derived)
	 */
	let workingCopy = $derived(
		// Reset the working copy when new transformation data comes in.
		transformation,
	);

	/**
	 * Tracks whether the user has made changes to the working copy.
	 *
	 * Think of this like a "dirty" flag on a document - it tells us if
	 * the user has made edits that haven't been saved yet.
	 *
	 * How it works:
	 * - Starts as false when we get fresh data from the upstream transformation
	 * - Becomes true as soon as the user edits anything
	 * - Goes back to false when they save or when fresh data comes in
	 *
	 * We use this to:
	 * - Show confirmation dialogs before closing unsaved work
	 * - Disable the save button when there's nothing to save
	 * - Reset the working copy when new data arrives
	 */
	let isWorkingCopyDirty = $derived.by(() => {
		// Reset dirty flag when new transformation data comes in
		transformation;
		return false;
	});

	function promptUserConfirmLeave() {
		if (!isWorkingCopyDirty) {
			isDialogOpen = false;
			return;
		}

		confirmationDialog.open({
			title: '有未保存的更改',
			description: '您有未保存的更改。确定要离开吗?',
			confirm: { text: '离开' },
			onConfirm: () => {
				// Reset working copy and dirty flag
				workingCopy = transformation;
				isWorkingCopyDirty = false;

				isDialogOpen = false;
			},
		});
	}
</script>

<Modal.Root bind:open={isDialogOpen}>
	<Modal.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				tooltip="编辑转换、测试转换并查看运行历史"
				variant="ghost"
				class={className}
			>
				<EditIcon class="size-4" />
				<PlayIcon class="size-4" />
				<HistoryIcon class="size-4" />
			</Button>
		{/snippet}
	</Modal.Trigger>

	<Modal.Content
		class="max-h-[80vh] sm:max-w-7xl"
		onEscapeKeydown={(e) => {
			e.preventDefault();
			if (isDialogOpen) {
				promptUserConfirmLeave();
			}
		}}
		onInteractOutside={(e) => {
			e.preventDefault();
			if (isDialogOpen) {
				promptUserConfirmLeave();
			}
		}}
	>
		<Modal.Header>
			<Modal.Title>转换设置</Modal.Title>
			<Separator />
		</Modal.Header>

		<Editor
			bind:transformation={
				() => workingCopy,
				(v) => {
					workingCopy = v;
					isWorkingCopyDirty = true;
				}
			}
		/>

		<Modal.Footer>
			<Button
				onclick={() => {
					confirmationDialog.open({
						title: '删除转换',
						description: '确定吗?此操作无法撤销。',
						confirm: { text: '删除', variant: 'destructive' },
						onConfirm: async () => {
							const { error } = await rpc.db.transformations.delete.execute(
								$state.snapshot(transformation),
							);
							if (error) {
								rpc.notify.error.execute({
									title: '删除转换失败!',
									description: '无法删除您的转换。',
									action: { type: 'more-details', error },
								});
								throw error;
							}
							isDialogOpen = false;
							rpc.notify.success.execute({
								title: '已删除转换!',
								description:
									'您的转换已成功删除。',
							});
						},
					});
				}}
				variant="destructive"
			>
				<TrashIcon class="size-4" />
				删除
			</Button>
			<div class="flex items-center gap-2">
				<MarkTransformationActiveButton {transformation} />
				<Button variant="outline" onclick={() => promptUserConfirmLeave()}>
					关闭
				</Button>
				<Button
					onclick={() => {
						updateTransformation.mutate($state.snapshot(workingCopy), {
							onSuccess: () => {
								rpc.notify.success.execute({
									title: '已更新转换!',
									description:
										'您的转换已成功更新。',
								});
								isDialogOpen = false;
							},
							onError: (error) => {
								rpc.notify.error.execute({
									title: '更新转换失败!',
									description: '无法更新您的转换。',
									action: { type: 'more-details', error },
								});
							},
						});
					}}
					disabled={updateTransformation.isPending || !isWorkingCopyDirty}
				>
					{#if updateTransformation.isPending}
						<Spinner />
					{/if}
					保存
				</Button>
			</div>
		</Modal.Footer>
	</Modal.Content>
</Modal.Root>
