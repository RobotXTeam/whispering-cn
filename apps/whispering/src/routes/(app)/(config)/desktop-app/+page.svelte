<script lang="ts">
	import { ChromeWebStoreIcon } from '$lib/components/icons';
	import { Button } from '@epicenter/ui/button';
	import { Card } from '@epicenter/ui/card';
	import CommandIcon from '@lucide/svelte/icons/command';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import MicIcon from '@lucide/svelte/icons/mic';
	import ZapIcon from '@lucide/svelte/icons/zap';
</script>

<svelte:head>
	<title>下载桌面应用 - Whispering</title>
</svelte:head>

<main
	class="flex flex-1 items-center justify-center p-4 container max-w-4xl mx-auto"
>
	<div class="w-full">
		<header class="text-center space-y-4 mb-8">
			<h1 class="scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl">
				Whispering 桌面版
			</h1>
			<p class="text-muted-foreground text-lg lg:text-xl max-w-2xl mx-auto">
				体验 Whispering 的全部强大功能,获得原生性能与系统集成。
			</p>
		</header>

		<div class="grid gap-6 mb-8 lg:grid-cols-3">
			<Card class="p-6">
				<div class="space-y-2">
					<CommandIcon class="h-8 w-8 text-primary mb-2" />
					<h3 class="text-lg font-semibold">全局快捷键</h3>
					<p class="text-sm text-muted-foreground">
						可自定义的全局键盘快捷键,可在系统任意位置控制录音
					</p>
				</div>
			</Card>

			<Card class="p-6">
				<div class="space-y-2">
					<MicIcon class="h-8 w-8 text-primary mb-2" />
					<h3 class="text-lg font-semibold">原生性能</h3>
					<p class="text-sm text-muted-foreground">
						Rust 后端、更多音频 API 以及优化的资源占用
					</p>
				</div>
			</Card>

			<Card class="p-6">
				<div class="space-y-2">
					<ZapIcon class="h-8 w-8 text-primary mb-2" />
					<h3 class="text-lg font-semibold">系统集成</h3>
					<p class="text-sm text-muted-foreground">
						系统托盘控制、直接文本注入、自动更新与窗口管理
					</p>
				</div>
			</Card>
		</div>

		<div class="flex flex-col items-center gap-4">
			<div class="flex flex-col gap-3 sm:flex-row">
				<Button
					tooltip="下载 Whispering 桌面应用"
					href="https://github.com/EpicenterHQ/epicenter/releases"
					target="_blank"
					rel="noopener noreferrer"
					variant="default"
					size="lg"
					class="min-w-[200px]"
				>
					<DownloadIcon class="size-5" />
					下载桌面版
				</Button>
				<Button
					tooltip="获取 Chrome 扩展程序"
					href="https://chromewebstore.google.com/detail/whispering/oilbfihknpdbpfkcncojikmooipnlglo"
					target="_blank"
					rel="noopener noreferrer"
					variant="outline"
					size="lg"
				>
					<ChromeWebStoreIcon class="size-5" />
					Chrome 扩展程序
				</Button>
			</div>

			<Button
				onclick={() => window.history.back()}
				variant="ghost"
				class="mt-2"
			>
				返回
			</Button>
		</div>
	</div>
</main>
