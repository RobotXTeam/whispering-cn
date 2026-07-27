<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>
		{page.status === 404 ? '页面未找到' : '错误'} - Whispering
	</title>
</svelte:head>

<main class="flex flex-1 flex-col items-center justify-center gap-6 p-8">
	<div class="text-center space-y-6">
		<h1 class="text-4xl font-bold text-foreground">
			{#if page.status === 404}
				404 - 页面未找到
			{:else}
				出错了
			{/if}
		</h1>

		<p class="text-muted-foreground text-lg">
			{#if page.status === 404}
				您要找的页面不存在。
			{:else}
				发生了意外错误。
			{/if}
		</p>

		<div class="pt-4">
			<a
				href="/"
				class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
			>
				返回首页
			</a>
		</div>
	</div>
</main>
