<script lang="ts">
	import { ChromeWebStoreIcon } from '$lib/components/icons';
	import { Button } from '@epicenter/ui/button';
	import DesktopIcon from '@lucide/svelte/icons/laptop';
</script>

<svelte:head>
	<title>更改全局键盘快捷键</title>
</svelte:head>

<main class="flex flex-1 items-center justify-center">
	<section class="container flex flex-col items-center gap-4 text-center">
		<h1 class="scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl">
			更改您的全局键盘快捷键
		</h1>
		<p class="text-muted-foreground lg:text-xl">
			您可以在扩展程序和桌面应用中使用全局键盘快捷键。
		</p>
		<div class="flex flex-col gap-2 md:flex-row">
			<Button
				tooltip="查看 Chrome 扩展程序"
				href="https://github.com/EpicenterHQ/epicenter/releases"
				target="_blank"
				rel="noopener noreferrer"
				variant="default"
				size="lg"
			>
				<DesktopIcon class="size-6" />
				下载桌面版
			</Button>
			<Button
				tooltip="查看桌面应用"
				href="https://chromewebstore.google.com/detail/whispering/oilbfihknpdbpfkcncojikmooipnlglo"
				target="_blank"
				rel="noopener noreferrer"
				variant="outline"
				size="lg"
			>
				<ChromeWebStoreIcon class="size-6" />
				获取 Chrome 扩展程序
			</Button>
		</div>
		<Button onclick={() => window.history.back()} variant="ghost"
			>返回</Button
		>
	</section>
</main>
