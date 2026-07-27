<script lang="ts">
	import { rpc } from '$lib/query';
	import { services } from '$lib/services';
	import { viewTransition } from '$lib/utils/viewTransitions';
	import { createQuery } from '@tanstack/svelte-query';
	import { onDestroy } from 'svelte';

	let { id }: { id: string } = $props();

	const audioUrlQuery = createQuery(
		() => rpc.db.recordings.getAudioPlaybackUrl(() => id).options,
	);

	onDestroy(() => {
		// Clean up audio URL when component unmounts to prevent memory leaks
		services.db.recordings.revokeAudioUrl(id);
	});
</script>

{#if audioUrlQuery.data}
	<audio
		class="h-8"
		style="view-transition-name: {viewTransition.recording(id).audio}"
		controls
		src={audioUrlQuery.data}
	>
		您的浏览器不支持 audio 元素。
	</audio>
{/if}
