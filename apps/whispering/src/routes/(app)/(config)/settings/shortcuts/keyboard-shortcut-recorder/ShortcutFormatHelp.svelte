<script lang="ts">
	import * as Alert from '@epicenter/ui/alert';
	import { Button } from '@epicenter/ui/button';
	import * as Kbd from '@epicenter/ui/kbd';
	import * as Dialog from '@epicenter/ui/dialog';
	import {
		ACCELERATOR_SECTIONS,
		CommandOrAlt,
		CommandOrControl,
		KEYBOARD_EVENT_SUPPORTED_KEY_SECTIONS,
		OPTION_DEAD_KEYS,
	} from '$lib/constants/keyboard';
	import { IS_MACOS } from '$lib/constants/platform';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import HelpCircle from '@lucide/svelte/icons/help-circle';

	let { type }: { type: 'local' | 'global' } = $props();
	let dialogOpen = $state(false);

	const isLocal = $derived(type === 'local');

	/**
	 * Examples for each shortcut type
	 */
	const SHORTCUT_EXAMPLES = {
		local: [
			' ',
			`${CommandOrControl.toLowerCase()}+a`,
			`${CommandOrControl.toLowerCase()}+shift+p`,
			`${CommandOrAlt.toLowerCase()}+s`,
			'f5',
			`control+${CommandOrAlt.toLowerCase()}+delete`,
		],
		global: [
			'Space',
			'Control+A',
			`${CommandOrControl}+Shift+P`,
			`${CommandOrAlt}+S`,
			'F5',
			`Control+${CommandOrAlt}+Delete`,
		],
	} as const;
</script>

<Button
	variant="ghost"
	size="icon"
	class="size-6"
	onclick={() => (dialogOpen = true)}
	tooltip="点击查看快捷键格式指南"
>
	<HelpCircle class="size-4" />
	<span class="sr-only">快捷键格式帮助</span>
</Button>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content class="sm:max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>
				{isLocal ? '应用内' : '全局'}快捷键格式指南
			</Dialog.Title>
			<Dialog.Description>
				了解{isLocal
					? '应用内'
					: '系统级'}快捷键的格式写法。
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4">
			<!-- Quick format summary -->
			<div class="rounded-lg bg-muted p-4">
				<p class="text-sm">
					使用 <code class="font-mono text-xs">modifier+key</code> 格式，或单个按键直接用
					<code class="font-mono text-xs">key</code>。
				</p>
				{#if isLocal}
					<p class="text-sm text-muted-foreground mt-1">
						可使用键盘上的任意按键（小写）。以下是常见
						示例：
					</p>
				{/if}
			</div>

			<!-- Two-column flex layout -->
			<div class="flex flex-col sm:flex-row sm:divide-x">
				<!-- Left column: Modifiers -->
				<div class="sm:pr-4">
					<h4 class="text-sm font-semibold mb-1">修饰键</h4>
					<p class="text-xs text-muted-foreground mb-2">与其他键组合使用</p>
					<div class="flex flex-wrap sm:flex-col gap-1">
						{#each (isLocal ? KEYBOARD_EVENT_SUPPORTED_KEY_SECTIONS[0] : ACCELERATOR_SECTIONS[0]).keys as modifier}
							<Kbd.Root>{modifier}</Kbd.Root>
						{/each}
					</div>
				</div>

				<!-- Right column: All other keys -->
				<div class="flex-1 sm:pl-4">
					<div class="flex flex-col gap-4">
						{#each (isLocal ? KEYBOARD_EVENT_SUPPORTED_KEY_SECTIONS : ACCELERATOR_SECTIONS).slice(1) as section}
							<div>
								<h4 class="text-sm font-semibold mb-1">{section.title}</h4>
								<p class="text-xs text-muted-foreground mb-2">
									{section.description}
								</p>
								<div class="flex flex-wrap gap-1">
									{#each section.keys as key}
										<Kbd.Root>{key}</Kbd.Root>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Examples -->
			<div>
				<h4 class="mb-2 font-medium">示例</h4>
				<div class="space-y-2 rounded-lg border p-3">
					{#each SHORTCUT_EXAMPLES[isLocal ? 'local' : 'global'] as example}
						<code class="block text-sm">{example}</code>
					{/each}
				</div>
			</div>

			{#if IS_MACOS}
				<Alert.Root variant="warning">
					<AlertTriangle class="size-4" />
					<Alert.Title>macOS Option 键限制</Alert.Title>
					<Alert.Description class="space-y-2">
						<p>
							在 macOS 上，某些 Option（Alt）键组合会作为"死键"
							录制时无法正确注册：
						</p>
						<div class="flex flex-wrap gap-1 my-2">
							{#each OPTION_DEAD_KEYS as key}
								<Kbd.Root>Option + {key.toUpperCase()}</Kbd.Root>
							{/each}
						</div>
						<p class="font-medium">替代方案：</p>
						<ul class="list-disc list-inside space-y-1 ml-2">
							<li>反向录制：先按字母，再按 Option</li>
							<li>手动编辑：输入"alt+e"代替录制</li>
						</ul>
					</Alert.Description>
				</Alert.Root>
			{/if}
		</div>

		<Dialog.Footer>
			{#if !isLocal}
				<Button
					variant="outline"
					href="https://v2.tauri.app/plugin/global-shortcut/"
					target="_blank"
					rel="noreferrer"
				>
					<ExternalLink class="size-4" />
					查看文档
				</Button>
			{/if}
			<Button onclick={() => (dialogOpen = false)}>关闭</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
