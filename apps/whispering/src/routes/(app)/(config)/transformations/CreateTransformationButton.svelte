<script lang="ts">
	import { confirmationDialog } from '$lib/components/ConfirmationDialog.svelte';
	import { Editor } from '$lib/components/transformations-editor';
	import { Button } from '@epicenter/ui/button';
	import * as Dialog from '@epicenter/ui/dialog';
	import { Separator } from '@epicenter/ui/separator';
	import { rpc } from '$lib/query';
	import { generateDefaultTransformation } from '$lib/services/isomorphic/db';
	import { createMutation } from '@tanstack/svelte-query';
	import PlusIcon from '@lucide/svelte/icons/plus';

	const createTransformation = createMutation(
		() => rpc.db.transformations.create.options,
	);

	let isDialogOpen = $state(false);
	let transformation = $state(generateDefaultTransformation());

	function promptUserConfirmLeave() {
		confirmationDialog.open({
			title: '有未保存的更改',
			description: '您有未保存的更改。确定要离开吗?',
			confirm: { text: '离开' },
			onConfirm: () => {
				isDialogOpen = false;
			},
		});
	}
</script>

<Dialog.Root bind:open={isDialogOpen}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props}>
				<PlusIcon class="size-4" />
				创建转换
			</Button>
		{/snippet}
	</Dialog.Trigger>

	<Dialog.Content
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
		<Dialog.Header>
			<Dialog.Title>创建转换</Dialog.Title>
			<Separator />
		</Dialog.Header>

		<Editor bind:transformation />

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (isDialogOpen = false)}>
				取消
			</Button>
			<Button
				type="submit"
				onclick={() =>
					createTransformation.mutate($state.snapshot(transformation), {
						onSuccess: () => {
							isDialogOpen = false;
							transformation = generateDefaultTransformation();
							rpc.notify.success.execute({
								title: '已创建转换!',
								description:
									'您的转换已成功创建。',
							});
						},
						onError: (error) => {
							rpc.notify.error.execute({
								title: '创建转换失败!',
								description: '无法创建您的转换。',
								action: { type: 'more-details', error },
							});
						},
					})}
			>
				创建
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
