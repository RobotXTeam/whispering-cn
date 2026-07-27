<script lang="ts">
	import { confirmationDialog } from '$lib/components/ConfirmationDialog.svelte';
	import { Button } from '@epicenter/ui/button';
	import { Link } from '@epicenter/ui/link';
	import { Separator } from '@epicenter/ui/separator';
	import { rpc } from '$lib/query';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import SidebarNav from './SidebarNav.svelte';
	import { settings } from '$lib/stores/settings.svelte';

	let { children } = $props();

	const isString = (value: unknown): value is string =>
		typeof value === 'string';
	const versionPromise = (async () => {
		const res = await fetch(
			'https://api.github.com/repos/EpicenterHQ/epicenter/releases/latest',
		);
		const { html_url: latestReleaseUrl, tag_name: latestVersion } =
			await res.json();
		if (!isString(latestVersion) || !isString(latestReleaseUrl)) {
			throw new Error('Failed to fetch latest version');
		}
		if (!window.__TAURI_INTERNALS__)
			return { isOutdated: false, version: latestVersion } as const;
		const { getVersion } = await import('@tauri-apps/api/app');
		const currentVersion = `v${await getVersion()}`;
		if (latestVersion === currentVersion) {
			return { isOutdated: false, version: currentVersion } as const;
		}
		return {
			isOutdated: true,
			latestVersion,
			currentVersion,
			latestReleaseUrl,
		} as const;
	})();
</script>

<main class="flex w-full flex-1 flex-col pb-4 pt-2 px-4 mx-auto max-w-6xl">
	<div
		class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="space-y-0.5">
			<h2 class="text-2xl font-bold tracking-tight">设置</h2>
			<p class="text-muted-foreground">
				{#await versionPromise}
					自定义你的 Whispering 体验。
				{:then v}
					{#if v.isOutdated}
						{@const { latestVersion, currentVersion, latestReleaseUrl } = v}
						自定义你的 Whispering {currentVersion} 体验（最新版
						<Link
							href={latestReleaseUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							{latestVersion}
						</Link>）。
					{:else}
						{@const { version } = v}
						自定义你的 Whispering {version} 体验。
					{/if}
				{:catch error}
					自定义你的 Whispering 体验。
				{/await}
			</p>
		</div>
		<Button
			variant="outline"
			size="sm"
			onclick={() => {
				confirmationDialog.open({
					title: '重置所有设置',
					description:
						'此操作将把所有设置重置为默认值。此操作无法撤销。',
					confirm: { text: '重置设置', variant: 'destructive' },
					onConfirm: () => {
						settings.reset();
						rpc.notify.success.execute({
							title: '设置已重置',
							description: '所有设置已重置为默认值。',
						});
					},
				});
			}}
			class="shrink-0"
		>
			<RotateCcw class="size-4" />
			重置为默认值
		</Button>
	</div>
	<Separator class="my-6" />
	<div class="flex flex-col space-y-8 lg:flex-row lg:gap-8">
		<aside class="lg:w-1/6">
			<SidebarNav />
		</aside>
		<main class="flex-1 p-1.5 lg:max-w-3xl">
			{@render children()}
		</main>
	</div>
</main>
