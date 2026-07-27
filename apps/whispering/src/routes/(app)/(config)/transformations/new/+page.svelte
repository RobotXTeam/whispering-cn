<script lang="ts">
	import { goto } from '$app/navigation';
	import { Editor } from '$lib/components/transformations-editor';
	import { Button } from '@epicenter/ui/button';
	import * as Card from '@epicenter/ui/card';
	import { rpc } from '$lib/query';
	import { generateDefaultTransformation } from '$lib/services/isomorphic/db';
	import { createMutation } from '@tanstack/svelte-query';

	const createTransformation = createMutation(
		() => rpc.db.transformations.create.options,
	);

	let transformation = $state(generateDefaultTransformation());
</script>

<Card.Root class="w-full max-w-4xl">
	<Card.Header>
		<Card.Title>创建转换</Card.Title>
		<Card.Description>
			创建新的转换以处理文本。
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<Editor bind:transformation />
		<Card.Footer class="flex justify-end gap-2">
			<Button
				onclick={() =>
					createTransformation.mutate($state.snapshot(transformation), {
						onSuccess: () => {
							goto('/transformations');
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
				创建转换
			</Button>
		</Card.Footer>
	</Card.Content>
</Card.Root>
