<script lang="ts">
	import { Button } from '@epicenter/ui/button';
	import { Separator } from '@epicenter/ui/separator';
	import { rpc } from '$lib/query';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ShortcutFormatHelp from '../keyboard-shortcut-recorder/ShortcutFormatHelp.svelte';
	import ShortcutTable from '../keyboard-shortcut-recorder/ShortcutTable.svelte';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<svelte:head>
	<title>应用内快捷键 - Whispering</title>
</svelte:head>

<section>
	<div
		class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
	>
		<header class="space-y-1">
			<div class="flex items-center gap-2">
				<h2 class="text-xl font-semibold tracking-tight sm:text-2xl">
					应用内快捷键
				</h2>
				<ShortcutFormatHelp type="local" />
			</div>
			<p class="text-sm text-muted-foreground">
				设置应用聚焦时生效的键盘快捷键。这些快捷键仅在 Whispering 为活动应用时触发。
			</p>
		</header>
		<Button
			variant="outline"
			size="sm"
			onclick={() => {
				settings.resetLocalShortcuts();
				rpc.notify.success.execute({
					title: '快捷键已重置',
					description: '所有应用内快捷键已重置为默认值。',
				});
			}}
			class="shrink-0"
		>
			<RotateCcw class="size-4" />
			重置为默认值
		</Button>
	</div>

	<Separator class="my-6" />

	<ShortcutTable type="local" />
</section>
