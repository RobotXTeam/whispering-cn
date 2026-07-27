<script lang="ts">
	import * as Card from '@epicenter/ui/card';
	import { Badge } from '@epicenter/ui/badge';
	import { Label } from '@epicenter/ui/label';
	import { Switch } from '@epicenter/ui/switch';
	import { rpc } from '$lib/query';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<div class="space-y-8">
	<!-- Page Header -->
	<div class="space-y-2">
		<div class="flex items-center gap-3">
			<h3 class="text-xl font-semibold tracking-tight">分析</h3>
			{#if settings.value['analytics.enabled']}
				<Badge
					variant="outline"
					class="text-xs text-green-700 dark:text-green-400 border-green-200 dark:border-green-400/30"
				>
					已启用
				</Badge>
			{:else}
				<Badge
					variant="outline"
					class="text-xs text-warning dark:text-warning border-warning dark:border-warning/30"
				>
					已禁用
				</Badge>
			{/if}
		</div>
		<p class="text-sm text-muted-foreground max-w-2xl">
			帮助我们了解哪些功能被使用最多。我们使用匿名事件
			日志来改进 Whispering。
		</p>
	</div>

	<!-- Main Toggle Section -->
	<Card.Root class="transition-colors duration-200">
		<Card.Content>
			<div class="flex items-start justify-between gap-4">
				<div class="space-y-2 flex-1">
					<Label
						for="analytics-toggle"
						class="text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
					>
						分享匿名事件
					</Label>
					<p class="text-sm text-muted-foreground leading-relaxed">
						我们记录简单事件,如"录音已开始"或"转录
						已完成"。这些事件不会附加任何个人数据。
					</p>
				</div>
				<Switch
					id="analytics-toggle"
					bind:checked={
						() => settings.value['analytics.enabled'],
						(checked) => {
							settings.updateKey('analytics.enabled', checked);

							// Log the change (will only send if analytics is now enabled)
							if (checked) {
								rpc.analytics.logEvent.execute({
									type: 'settings_changed',
									section: 'analytics',
								});
							}
						}
					}
					class="shrink-0"
				/>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Data Collection Information -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root class="border-green-100 dark:border-green-900/20">
			<Card.Header>
				<Card.Title
					class="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2"
				>
					<div class="w-2 h-2 bg-green-500 rounded-full"></div>
					我们记录的事件
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<ul class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
					<li class="flex items-start gap-2">
						<span class="text-green-500 mt-1">•</span>
						<span>按钮点击(你使用的功能)</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-green-500 mt-1">•</span>
						<span>完成时长(事情花费多久)</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-green-500 mt-1">•</span>
						<span>错误信息(当某些操作失败时)</span>
					</li>
				</ul>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-warning dark:border-warning/20">
			<Card.Header>
				<Card.Title
					class="text-sm font-medium text-warning dark:text-warning flex items-center gap-2"
				>
					<div class="w-2 h-2 bg-warning rounded-full"></div>
					从不收集
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<ul class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
					<li class="flex items-start gap-2">
						<span class="text-warning mt-1">•</span>
						<span>你的实际转录文本或录音</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-warning mt-1">•</span>
						<span>设备 ID 或用户标识符</span>
					</li>
					<li class="flex items-start gap-2">
						<span class="text-warning mt-1">•</span>
						<span>API 密钥或任何个人数据</span>
					</li>
				</ul>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Transparency Section -->
	<Card.Root class="bg-muted/30 border-dashed">
		<Card.Header>
			<Card.Title class="text-base font-medium">完全透明</Card.Title>
			<Card.Description>
				所有分析代码都是开源且可审计的。准确查看收集了
				什么数据,以及何时收集。
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3">
			<div class="grid gap-2 text-sm">
				<a
					href="https://github.com/EpicenterHQ/epicenter/blob/main/apps/whispering/src/lib/services/analytics/types.ts"
					target="_blank"
					rel="noopener noreferrer"
					class="group flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
				>
					<span
						class="text-muted-foreground group-hover:text-primary/60 transition-colors"
						>→</span
					>
					<span
						class="underline underline-offset-4 decoration-transparent group-hover:decoration-current transition-colors"
						>查看事件定义</span
					>
				</a>
				<a
					href="https://github.com/search?q=repo%3AEpicenterHQ%2Fepicenter+rpc.analytics.logEvent&type=code"
					target="_blank"
					rel="noopener noreferrer"
					class="group flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
				>
					<span
						class="text-muted-foreground group-hover:text-primary/60 transition-colors"
						>→</span
					>
					<span
						class="underline underline-offset-4 decoration-transparent group-hover:decoration-current transition-colors"
						>查看事件记录位置</span
					>
				</a>
				<a
					href="https://github.com/aptabase"
					target="_blank"
					rel="noopener noreferrer"
					class="group flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
				>
					<span
						class="text-muted-foreground group-hover:text-primary/60 transition-colors"
						>→</span
					>
					<span
						class="underline underline-offset-4 decoration-transparent group-hover:decoration-current transition-colors"
						>了解 Aptabase</span
					>
				</a>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Status Footer -->
	<div class="flex items-center gap-2 text-xs">
		{#if settings.value['analytics.enabled']}
			<div class="flex items-center gap-2 text-green-700 dark:text-green-400">
				<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
				<span class="font-medium">分析已启用</span>
				<span class="text-muted-foreground"
					>• 更改立即生效</span
				>
			</div>
		{:else}
			<div class="flex items-center gap-2 text-warning dark:text-warning">
				<div class="w-2 h-2 bg-warning rounded-full"></div>
				<span class="font-medium">分析已禁用</span>
				<span class="text-muted-foreground">• 没有收集任何数据</span>
			</div>
		{/if}
	</div>
</div>
