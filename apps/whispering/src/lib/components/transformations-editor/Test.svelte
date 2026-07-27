<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Textarea } from '@epicenter/ui/textarea';
	import { Button } from '@epicenter/ui/button';
	import * as SectionHeader from '@epicenter/ui/section-header';
	import { Separator } from '@epicenter/ui/separator';
	import { rpc } from '$lib/query';
	import type { Transformation } from '$lib/services/isomorphic/db';
	import { createMutation } from '@tanstack/svelte-query';
	import { Spinner } from '@epicenter/ui/spinner';
	import PlayIcon from '@lucide/svelte/icons/play';

	const transformInput = createMutation(
		() => rpc.transformer.transformInput.options,
	);

	let { transformation }: { transformation: Transformation } = $props();

	let input = $state('');
	let output = $state('');
</script>

<div class="flex flex-col gap-6 overflow-y-auto h-full px-2">
	<SectionHeader.Root>
		<SectionHeader.Title>测试转换</SectionHeader.Title>
		<SectionHeader.Description>
			使用示例输入测试您的转换
		</SectionHeader.Description>
	</SectionHeader.Root>

	<Separator />

	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<Field.Field>
			<Field.Label for="input">输入文本</Field.Label>
			<Textarea
				id="input"
				bind:value={input}
				placeholder="输入要转换的文本..."
				rows={5}
			/>
		</Field.Field>

		<Field.Field>
			<Field.Label for="output">输出文本</Field.Label>
			<Textarea
				id="output"
				value={output}
				placeholder="转换后的文本将显示在此处..."
				rows={5}
				readonly
			/>
		</Field.Field>
	</div>

	<Button
		onclick={() =>
			transformInput.mutate(
				{ input, transformation },
				{
					onSuccess: (o) => {
						if (o) {
							output = o;
						}
					},
				},
			)}
		disabled={!input.trim() || transformation.steps.length === 0}
		class="w-full"
	>
		{#if transformInput.isPending}
			<Spinner />
		{:else}
			<PlayIcon class="size-4" />
		{/if}
		{transformInput.isPending
			? '转换运行中...'
			: '运行转换'}
	</Button>
</div>
