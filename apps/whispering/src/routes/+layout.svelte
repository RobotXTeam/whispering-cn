<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { listen } from '@tauri-apps/api/event';
	import { commands } from '$lib/commands';
	import { queryClient } from '$lib/query/client';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { Toaster, type ToasterProps } from 'svelte-sonner';
	import '@epicenter/ui/app.css';
	import * as Tooltip from '@epicenter/ui/tooltip';

	let { children } = $props();

	const TOASTER_SETTINGS = {
		position: 'bottom-right',
		richColors: true,
		duration: 5000,
		visibleToasts: 5,
		toastOptions: {
			classes: {
				toast: 'flex flex-wrap *:data-content:flex-1',
				icon: 'shrink-0',
				actionButton: 'w-full mt-3 inline-flex justify-center',
				closeButton: 'w-full mt-3 inline-flex justify-center',
			},
		},
		closeButton: true,
	} satisfies ToasterProps;

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Wayland global-hotkey bridge: GNOME runs `whispering <command-id>` as a
	// second instance; the Rust single-instance handler forwards the id here
	// via the `whispering://command` event. Find the matching command and fire
	// its callback — the same path the X11 global-shortcut plugin would take.
	onMount(() => {
		const unlisten = listen<string>('whispering://command', (event) => {
			commands.find((c) => c.id === event.payload)?.callback();
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	});
</script>

<svelte:head>
	<title>Whispering</title>
</svelte:head>

<QueryClientProvider client={queryClient}>
	<Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
		{@render children()}
	</Tooltip.Provider>
</QueryClientProvider>

<Toaster
	offset={16}
	class="xs:block hidden"
	theme={mode.current}
	{...TOASTER_SETTINGS}
/>
<ModeWatcher defaultMode="dark" track={false} />
<SvelteQueryDevtools client={queryClient} buttonPosition="bottom-right" />

<style>
	/* Override inspector button to bottom-center positioning */
	:global(#svelte-inspector-host button) {
		bottom: 16px !important;
		left: 50% !important;
		transform: translateX(-50%) !important;
		right: auto !important;
	}
</style>
