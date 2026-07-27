<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '@epicenter/ui/button';
	import { cn } from '@epicenter/ui/utils';
	import { cubicInOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';

	let { children } = $props();

	const [send, receive] = crossfade({
		duration: 250,
		easing: cubicInOut,
	});

	const items = [
		{ href: '/settings/shortcuts/local', title: '应用内快捷键' },
		{ href: '/settings/shortcuts/global', title: '全局快捷键' },
	] as const;
</script>

<div class="mx-auto max-w-4xl space-y-6 py-6">
	<header>
		<h1 class="text-3xl font-bold tracking-tight">键盘快捷键</h1>
		<p class="mt-2 text-muted-foreground">
			配置键盘快捷键以快速访问 Whispering 功能。
		</p>
	</header>

	<nav class="flex w-full gap-1 rounded-lg bg-muted p-1">
		{#each items as item (item.href)}
			{@const isActive = page.url.pathname === item.href}
			<Button
				href={item.href}
				variant="ghost"
				class={cn(
					'relative flex-1 justify-center transition-colors',
					isActive
						? 'text-foreground hover:text-foreground'
						: 'text-muted-foreground hover:text-foreground',
				)}
				data-sveltekit-noscroll
			>
				{#if isActive}
					<div
						class="absolute inset-0 rounded-md bg-background shadow-sm"
						in:send={{ key: 'active-tab' }}
						out:receive={{ key: 'active-tab' }}
					></div>
				{/if}
				<span class="relative z-10">
					{item.title}
				</span>
			</Button>
		{/each}
	</nav>

	{@render children()}
</div>
