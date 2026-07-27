<script lang="ts">
	import * as Alert from '@epicenter/ui/alert';
	import { Button } from '@epicenter/ui/button';
	import * as Kbd from '@epicenter/ui/kbd';
	import { Input } from '@epicenter/ui/input';
	import * as Popover from '@epicenter/ui/popover';
	import {
		getShortcutDisplayLabel,
		type KeyboardEventSupportedKey,
	} from '$lib/constants/keyboard';
	import { IS_MACOS } from '$lib/constants/platform';
	import { cn } from '@epicenter/ui/utils';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import Pencil from '@lucide/svelte/icons/pencil';
	import XIcon from '@lucide/svelte/icons/x';
	import { type KeyRecorder } from './create-key-recorder.svelte';

	const {
		title,
		placeholder = '按下按键组合',
		autoFocus = true,
		rawKeyCombination,
		keyRecorder,
	}: {
		title: string;
		placeholder?: string;
		autoFocus?: boolean;
		rawKeyCombination: string | null;
		keyRecorder: KeyRecorder;
	} = $props();

	let isPopoverOpen = $state(false);
	let isManualMode = $state(false);
	let manualValue = $state(rawKeyCombination ?? '');

	$effect(() => {
		manualValue = rawKeyCombination ?? '';
	});
</script>

<div class="flex items-center justify-end gap-2">
	{#if rawKeyCombination}
		<Kbd.Root>{getShortcutDisplayLabel(rawKeyCombination)}</Kbd.Root>
		<Button
			variant="ghost"
			size="icon"
			class="size-8 shrink-0"
			onclick={() => keyRecorder.clear()}
		>
			<XIcon class="size-4" />
			<span class="sr-only">清除快捷键</span>
		</Button>
	{:else}
		<span class="text-sm text-muted-foreground">未设置</span>
	{/if}

	<Popover.Root
		open={isPopoverOpen}
		onOpenChange={(isOpen) => {
			isPopoverOpen = isOpen;
			if (!isOpen) {
				keyRecorder.stop();
				isManualMode = false;
			}
			if (isOpen && autoFocus && !isManualMode) {
				keyRecorder.start();
			}
		}}
	>
		<Popover.Trigger>
			<Button variant="ghost" size="sm" class="h-8 font-normal">
				{#if rawKeyCombination}
					<span class="text-xs">设置快捷键</span>
				{:else}
					<span class="text-xs text-muted-foreground">+ 添加</span>
				{/if}
			</Button>
		</Popover.Trigger>

		<Popover.Content
			class="w-80"
			align="end"
			onEscapeKeydown={(e) => {
				if (keyRecorder.isListening) {
					e.preventDefault();
				}
			}}
		>
			<div class="space-y-4">
				<div>
					<h4 class="mb-1 text-sm font-medium leading-none">{title}</h4>
					<p class="text-xs text-muted-foreground">
						{#if isManualMode}
							手动输入快捷键（例如:ctrl+shift+a）
						{:else}
							点击录制或手动编辑
						{/if}
					</p>
				</div>

				{#if IS_MACOS && !isManualMode}
					<Alert.Root variant="warning" class="text-xs">
						<AlertTriangle class="size-4" />
						<Alert.Title class="text-xs font-medium"
							>macOS Option 键说明</Alert.Title
						>
						<Alert.Description class="text-xs">
							某些 Option+键组合(E、I、N、U、`)可能无法正确录制
							。尝试反向录制（先按字母，再按
							Option）或手动编辑。
						</Alert.Description>
					</Alert.Root>
				{/if}

				{#if !isManualMode}
					<!-- Recording mode -->
					<button
						type="button"
						class={cn(
							'relative flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
							keyRecorder.isListening && 'ring-2 ring-ring ring-offset-2',
						)}
						onclick={(e) => {
							e.stopPropagation();
							keyRecorder.start();
						}}
						tabindex="0"
						aria-label={keyRecorder.isListening
							? '正在录制键盘快捷键'
							: '点击录制键盘快捷键'}
					>
						<div class="flex w-full items-center justify-between">
							<div
								class="flex grow items-center gap-1.5 overflow-x-auto pr-2 scrollbar-none"
							>
								{#if rawKeyCombination && !keyRecorder.isListening}
									<Kbd.Root
										>{getShortcutDisplayLabel(rawKeyCombination)}</Kbd.Root
									>
								{:else if !keyRecorder.isListening}
									<span class="truncate text-muted-foreground"
										>{placeholder}</span
									>
								{/if}
							</div>
							{#if !keyRecorder.isListening}
								<Keyboard class="size-4 text-muted-foreground" />
							{/if}
						</div>

						{#if keyRecorder.isListening}
							<div
								class="absolute inset-0 z-10 flex animate-in fade-in-0 zoom-in-95 items-center justify-center rounded-md border border-input bg-background/95 backdrop-blur-sm"
								aria-live="polite"
							>
								<div class="flex flex-col items-center gap-1 px-4 py-2">
									<p class="text-sm font-medium">按下按键组合</p>
									<p class="text-xs text-muted-foreground">按 Esc 取消</p>
								</div>
							</div>
						{/if}
					</button>

					<div class="flex items-center gap-2">
						{#if rawKeyCombination}
							<Button
								variant="outline"
								size="sm"
								class="flex-1"
								onclick={() => keyRecorder.clear()}
							>
								<XIcon class="size-3" />
								清除
							</Button>
						{/if}
						<Button
							variant="outline"
							size="sm"
							class={rawKeyCombination ? 'flex-1' : 'w-full'}
							onclick={() => {
								isManualMode = true;
								manualValue = rawKeyCombination ?? '';
								keyRecorder.stop();
							}}
						>
							<Pencil class="size-3" />
							手动编辑
						</Button>
					</div>
				{:else}
					<!-- Manual mode -->
					<form
						onsubmit={(e) => {
							e.preventDefault();
							if (manualValue) {
								keyRecorder.register(
									manualValue.split('+') as KeyboardEventSupportedKey[],
								);
								isManualMode = false;
							}
						}}
						class="space-y-3"
					>
						<Input
							type="text"
							placeholder="例如:ctrl+shift+a"
							bind:value={manualValue}
							class="font-mono text-sm"
							autofocus
						/>
						<div class="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								class="flex-1"
								onclick={() => {
									isManualMode = false;
									manualValue = rawKeyCombination ?? '';
								}}
							>
								取消
							</Button>
							<Button
								type="submit"
								size="sm"
								class="flex-1"
								disabled={!manualValue}
							>
								保存
							</Button>
						</div>
					</form>
				{/if}
			</div>
		</Popover.Content>
	</Popover.Root>
</div>
