<script lang="ts">
	import { confirmationDialog } from '$lib/components/ConfirmationDialog.svelte';
	import { Button } from '@epicenter/ui/button';
	import { TrashIcon } from '$lib/components/icons';
	import { Skeleton } from '@epicenter/ui/skeleton';
	import { rpc } from '$lib/query';
	import { createQuery } from '@tanstack/svelte-query';
	import EditTransformationModal from './EditTransformationModal.svelte';

	let { transformationId }: { transformationId: string } = $props();

	const transformationQuery = createQuery(
		() => rpc.db.transformations.getById(() => transformationId).options,
	);
	const transformation = $derived(transformationQuery.data);
</script>

<div class="flex items-center gap-1">
	{#if !transformation}
		<Skeleton class="size-8 md:hidden" />
		<Skeleton class="size-8" />
	{:else}
		<EditTransformationModal {transformation} />

		<Button
			tooltip="删除转换"
			onclick={() => {
				confirmationDialog.open({
					title: '删除转换',
					description: '确定要删除此转换吗?',
					confirm: { text: '删除', variant: 'destructive' },
					onConfirm: async () => {
						const { error } =
							await rpc.db.transformations.delete.execute(transformation);
						if (error) {
							rpc.notify.error.execute({
								title: '删除转换失败!',
								description: '无法删除您的转换。',
								action: { type: 'more-details', error },
							});
							throw error;
						}
						rpc.notify.success.execute({
							title: '已删除转换!',
							description: '您的转换已成功删除。',
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
