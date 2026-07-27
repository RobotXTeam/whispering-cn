<script lang="ts">
	import { Button, buttonVariants } from '@epicenter/ui/button';
	import { Link } from '@epicenter/ui/link';
	import { Separator } from '@epicenter/ui/separator';
	import { desktopRpc, rpc } from '$lib/query';
	import Layers2Icon from '@lucide/svelte/icons/layers-2';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ShortcutFormatHelp from '../keyboard-shortcut-recorder/ShortcutFormatHelp.svelte';
	import ShortcutTable from '../keyboard-shortcut-recorder/ShortcutTable.svelte';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<svelte:head>
	<title>全局快捷键 - Whispering</title>
</svelte:head>

{#if window.__TAURI_INTERNALS__}
	<section>
		<div
			class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
		>
			<header class="space-y-1">
				<div class="flex items-center gap-2">
					<h2 class="text-xl font-semibold tracking-tight sm:text-2xl">
						全局快捷键
					</h2>
					<ShortcutFormatHelp type="global" />
				</div>
				<p class="text-sm text-muted-foreground">
					设置系统级键盘快捷键，即使 Whispering 未聚焦也能生效。这些快捷键可从系统任何位置触发。
				</p>
			</header>
			<Button
				variant="outline"
				size="sm"
				onclick={async () => {
					await desktopRpc.globalShortcuts.unregisterAll.execute();
					settings.resetGlobalShortcuts();
					rpc.notify.success.execute({
						title: '快捷键已重置',
						description: '所有全局快捷键已重置为默认值。',
					});
				}}
				class="shrink-0"
			>
				<RotateCcw class="size-4" />
				重置为默认值
			</Button>
		</div>

		<Separator class="my-6" />

		<ShortcutTable type="global" />
	</section>
{:else}
	<div class="rounded-lg border bg-card text-card-foreground shadow-sm">
		<div class="flex flex-col items-center justify-center p-8 text-center">
			<Layers2Icon class="mb-4 size-10 text-muted-foreground" />
			<h3 class="mb-2 text-xl font-medium">全局快捷键</h3>
			<p class="mb-6 max-w-md text-sm text-muted-foreground">
				全局快捷键让你可以从电脑上的任何应用使用 Whispering。此功能仅在桌面应用或浏览器扩展中可用。
			</p>
			<Link href="/desktop-app" class={buttonVariants()}>
				启用全局快捷键
			</Link>
		</div>
	</div>
{/if}
