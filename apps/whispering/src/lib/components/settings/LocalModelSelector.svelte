<script lang="ts">
	import type { LocalModelConfig } from '$lib/services/isomorphic/transcription/local/types';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import X from '@lucide/svelte/icons/x';
	import { Button } from '@epicenter/ui/button';
	import * as Card from '@epicenter/ui/card';
	import { Input } from '@epicenter/ui/input';
	import * as Tabs from '@epicenter/ui/tabs';
	import { basename } from '@tauri-apps/api/path';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readDir } from '@tauri-apps/plugin-fs';
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { extractErrorMessage } from 'wellcrafted/error';
	import { Ok, tryAsync } from 'wellcrafted/result';
	import LocalModelDownloadCard from './LocalModelDownloadCard.svelte';

	/**
	 * Props for the LocalModelSelector component
	 */
	type LocalModelSelectorProps = {
		/** Array of pre-built models available for download */
		models: readonly LocalModelConfig[];

		/** Component title displayed in the card header */
		title: string;

		/** Component description displayed below the title */
		description: string;

		/** Whether to select files or directories */
		fileSelectionMode: 'file' | 'directory';

		/** File extensions to filter (for file mode only) */
		fileExtensions?: string[];

		/** Bindable value with getter/setter for the model path */
		value: string;

		/** Optional footer content for pre-built models tab */
		prebuiltFooter?: Snippet;

		/** Custom instructions for manual selection tab */
		manualInstructions?: Snippet;
	};

	let {
		models,
		title,
		description,
		fileSelectionMode,
		fileExtensions = [],
		value = $bindable(),
		prebuiltFooter,
		manualInstructions,
	}: LocalModelSelectorProps = $props();

	// Extract the model name from the current path
	const modelName = $derived.by(async () => {
		const path = value;
		if (!path) return '';
		return await basename(path);
	});

	// Check if current model is pre-built
	const prebuiltModelInfo = $derived(
		models.find((m) => {
			if (!value) return false;
			switch (m.engine) {
				case 'whispercpp':
					return value.endsWith(m.file.filename);
				case 'parakeet':
				case 'moonshine':
					return value.endsWith(m.directoryName);
			}
		}) ?? null,
	);
	const isPrebuiltModel = $derived(!!prebuiltModelInfo);

	/**
	 * Open file/folder browser for manual model selection
	 */
	async function selectModel() {
		if (!window.__TAURI_INTERNALS__) return;

		await tryAsync({
			try: async () => {
				if (fileSelectionMode === 'directory') {
					// Directory selection for folder-based models
					const selected = await open({
						directory: true,
						multiple: false,
						title: `选择${title}目录`,
					});

					if (selected) {
						// Validate that it's a directory with expected files
						const entries = await readDir(selected);
						if (!entries || entries.length === 0) {
							toast.error('所选目录为空');
							return;
						}

						value = selected;
						toast.success('已选择模型目录');
					}
				} else {
					// File selection for single-file models
					const filters =
						fileExtensions.length > 0
							? [
									{
										name: `${title} 文件`,
										extensions: fileExtensions,
									},
								]
							: [];

					const selected = await open({
						multiple: false,
						filters,
						title: `选择${title}文件`,
					});

					if (selected) {
						value = selected;
						toast.success('已选择模型文件');
					}
				}
			},
			catch: (error) => {
				toast.error('选择模型失败', {
					description: extractErrorMessage(error),
				});
				return Ok(undefined);
			},
		});
	}

	/**
	 * Clear the currently selected model
	 */
	function clearModel() {
		value = '';
		toast.success('模型路径已清除');
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-lg">{title}</Card.Title>
		<Card.Description>{description}</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-6">
		<Tabs.Root value="prebuilt" class="w-full">
			<Tabs.List class="grid w-full grid-cols-2">
				<Tabs.Trigger value="prebuilt">预置模型</Tabs.Trigger>
				<Tabs.Trigger value="manual">手动选择</Tabs.Trigger>
			</Tabs.List>

			<!-- Pre-built Models Tab -->
			<Tabs.Content value="prebuilt" class="mt-4 space-y-3">
				{#each models as model}
					<LocalModelDownloadCard {model} />
				{/each}

				{#if prebuiltFooter}
					<div class="rounded-lg border bg-muted/50 p-4">
						{@render prebuiltFooter()}
					</div>
				{/if}
			</Tabs.Content>

			<!-- Manual Selection Tab -->
			<Tabs.Content value="manual" class="mt-4 space-y-4">
				{#if manualInstructions}
					{@render manualInstructions()}
				{/if}

				<!-- Model Selection Input -->
				<div>
					<p class="text-sm font-medium mb-2">
						{#if manualInstructions}
							<span class="text-muted-foreground">第 2 步:</span> 选择模型
							{fileSelectionMode === 'directory' ? '目录' : '文件'}
						{:else}
							选择模型
							{fileSelectionMode === 'directory' ? '目录' : '文件'}
						{/if}
					</p>
					<div class="flex items-center gap-2">
						<Input
							type="text"
							{value}
							readonly
							placeholder="未选择模型"
							class="flex-1"
						/>
						{#if value}
							<Button
								variant="outline"
								size="icon"
								onclick={clearModel}
								title="清除模型路径"
							>
								<X class="size-4" />
							</Button>
						{/if}
						<Button
							variant="outline"
							size="icon"
							onclick={selectModel}
							title={fileSelectionMode === 'directory'
								? '浏览模型目录'
								: '浏览模型文件'}
						>
							{#if fileSelectionMode === 'directory'}
								<FolderOpen class="size-4" />
							{:else}
								<Paperclip class="size-4" />
							{/if}
						</Button>
					</div>

					<!-- Display selected model info -->
					{#if value}
						<div class="mt-2 space-y-1">
							{#await modelName then name}
								{#if name}
									<p class="text-sm text-muted-foreground">
										<span class="font-medium">已选择:</span>
										{name}
									</p>
								{/if}
							{/await}

							{#if isPrebuiltModel && prebuiltModelInfo}
								<p class="text-sm text-muted-foreground">
									<span class="font-medium">大小:</span>
									{prebuiltModelInfo.size}
									{#if fileSelectionMode === 'directory'}
										(含模型文件的目录)
									{/if}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</Tabs.Content>
		</Tabs.Root>
	</Card.Content>
</Card.Root>
