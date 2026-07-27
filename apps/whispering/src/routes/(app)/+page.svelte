<script lang="ts">
	import { commandCallbacks } from '$lib/commands';
	import NavItems from '$lib/components/NavItems.svelte';
	import TranscriptDialog from '$lib/components/copyable/TranscriptDialog.svelte';
	import {
		CompressionSelector,
		TranscriptionSelector,
		TransformationSelector,
	} from '$lib/components/settings';
	import ManualDeviceSelector from '$lib/components/settings/selectors/ManualDeviceSelector.svelte';
	import VadDeviceSelector from '$lib/components/settings/selectors/VadDeviceSelector.svelte';
	import {
		RECORDER_STATE_TO_ICON,
		RECORDING_MODE_OPTIONS,
		VAD_STATE_TO_ICON,
	} from '$lib/constants/audio';
	import { getShortcutDisplayLabel } from '$lib/constants/keyboard';
	import { rpc } from '$lib/query';
	import { vadRecorder } from '$lib/stores/vad-recorder.svelte';
	import { desktopServices, services } from '$lib/services';
	import { settings } from '$lib/stores/settings.svelte';
	import { viewTransition } from '$lib/utils/viewTransitions';
	import { Button } from '@epicenter/ui/button';
	import {
		ACCEPT_AUDIO,
		ACCEPT_VIDEO,
		FileDropZone,
		MEGABYTE,
	} from '@epicenter/ui/file-drop-zone';
	import * as Kbd from '@epicenter/ui/kbd';
	import { Link } from '@epicenter/ui/link';
	import * as ToggleGroup from '@epicenter/ui/toggle-group';
	import { createQuery } from '@tanstack/svelte-query';
	import type { UnlistenFn } from '@tauri-apps/api/event';
	import { onDestroy, onMount } from 'svelte';

	const getRecorderStateQuery = createQuery(
		() => rpc.recorder.getRecorderState.options,
	);
	const latestRecordingQuery = createQuery(
		() => rpc.db.recordings.getLatest.options,
	);

	const latestRecording = $derived(latestRecordingQuery.data);

	const audioPlaybackUrlQuery = createQuery(() => ({
		...rpc.db.recordings.getAudioPlaybackUrl(() => latestRecording?.id ?? '')
			.options,
		enabled: !!latestRecording?.id,
	}));

	const blobUrl = $derived(audioPlaybackUrlQuery.data);

	const availableModes = $derived(
		RECORDING_MODE_OPTIONS.filter((mode) => {
			if (!mode.desktopOnly) return true;
			// Desktop only, only show if Tauri is available
			return window.__TAURI_INTERNALS__;
		}),
	);

	const AUDIO_EXTENSIONS = [
		'mp3',
		'wav',
		'm4a',
		'aac',
		'ogg',
		'flac',
		'wma',
		'opus',
	] as const;

	const VIDEO_EXTENSIONS = [
		'mp4',
		'avi',
		'mov',
		'wmv',
		'flv',
		'mkv',
		'webm',
		'm4v',
	] as const;

	// Store unlisten function for drag drop events
	let unlistenDragDrop: UnlistenFn | undefined;

	// Set up desktop drag and drop listener
	onMount(async () => {
		if (!window.__TAURI_INTERNALS__) return;
		try {
			const { getCurrentWebview } = await import('@tauri-apps/api/webview');
			const { extname } = await import('@tauri-apps/api/path');

			const isAudio = async (path: string) =>
				AUDIO_EXTENSIONS.includes(
					(await extname(path)) as (typeof AUDIO_EXTENSIONS)[number],
				);
			const isVideo = async (path: string) =>
				VIDEO_EXTENSIONS.includes(
					(await extname(path)) as (typeof VIDEO_EXTENSIONS)[number],
				);

			unlistenDragDrop = await getCurrentWebview().onDragDropEvent(
				async (event) => {
					if (settings.value['recording.mode'] !== 'upload') return;
					if (event.payload.type !== 'drop' || event.payload.paths.length === 0)
						return;

					// Filter for audio/video files based on extension
					const pathResults = await Promise.all(
						event.payload.paths.map(async (path) => ({
							path,
							isValid: (await isAudio(path)) || (await isVideo(path)),
						})),
					);
					const validPaths = pathResults
						.filter(({ isValid }) => isValid)
						.map(({ path }) => path);

					if (validPaths.length === 0) {
						rpc.notify.warning.execute({
							title: '⚠️ 没有有效文件',
							description: '请拖入音频或视频文件',
						});
						return;
					}

					await settings.switchRecordingMode('upload');

					// Convert file paths to File objects using the fs service
					const { data: files, error } =
						await desktopServices.fs.pathsToFiles(validPaths);

					if (error) {
						rpc.notify.error.execute({
							title: '❌ 读取文件失败',
							description: error.message,
						});
						return;
					}

					if (files.length > 0) {
						await rpc.commands.uploadRecordings.execute({ files });
					}
				},
			);
		} catch (error) {
			rpc.notify.error.execute({
				title: '❌ 设置拖放监听器失败',
				description: `${error}`,
			});
		}
	});

	onDestroy(() => {
		unlistenDragDrop?.();
		// Clean up audio URL when component unmounts to prevent memory leaks
		if (latestRecording?.id) {
			services.db.recordings.revokeAudioUrl(latestRecording.id);
		}
	});
</script>

<svelte:head>
	<title>Whispering</title>
</svelte:head>

<div
	class="flex flex-1 flex-col items-center justify-center gap-4 w-full max-w-md mx-auto px-4"
>
	<div class="xs:flex hidden flex-col items-center gap-4">
		<h1 class="scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl">
			Whispering
		</h1>
		<p class="text-muted-foreground text-center">
			按下快捷键 → 说话 → 获取文本。免费开源 ❤️
		</p>
	</div>

	<ToggleGroup.Root
		type="single"
		bind:value={
			() => settings.value['recording.mode'],
			(mode) => {
				if (!mode) return;
				settings.switchRecordingMode(mode);
			}
		}
		class="w-full"
	>
		{#each availableModes as option}
			<ToggleGroup.Item
				value={option.value}
				aria-label={`切换到 ${option.label.toLowerCase()} 模式`}
			>
				{option.icon}
				{option.label}
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>

	{#if settings.value['recording.mode'] === 'manual'}
		<!-- Container with relative positioning for the button and absolute selectors -->
		<div class="relative">
			<Button
				tooltip={getRecorderStateQuery.data === 'IDLE'
					? '开始录音'
					: '停止录音'}
				onclick={() => commandCallbacks.toggleManualRecording()}
				variant="ghost"
				class="shrink-0 size-32 sm:size-36 lg:size-40 xl:size-44 transform items-center justify-center overflow-hidden duration-300 ease-in-out"
			>
				<span
					style="filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.5)); view-transition-name: {viewTransition
						.global.microphone};"
					class="text-[100px] sm:text-[110px] lg:text-[120px] xl:text-[130px] leading-none"
				>
					{RECORDER_STATE_TO_ICON[getRecorderStateQuery.data ?? 'IDLE']}
				</span>
			</Button>
			{#if getRecorderStateQuery.data === 'RECORDING'}
				<div class="absolute -right-12 bottom-4 flex items-center">
					<Button
						tooltip="取消录音"
						onclick={() => commandCallbacks.cancelManualRecording()}
						variant="ghost"
						size="icon"
						style="view-transition-name: {viewTransition.global.cancel};"
					>
						🚫
					</Button>
				</div>
			{:else}
				<div class="absolute -right-32 bottom-4 flex items-center gap-0.5">
					<ManualDeviceSelector />
					<CompressionSelector />
					<TranscriptionSelector />
					<TransformationSelector />
				</div>
			{/if}
		</div>
	{:else if settings.value['recording.mode'] === 'vad'}
		<!-- Container with relative positioning for the button and absolute selectors -->
		<div class="relative">
			<Button
				tooltip={vadRecorder.state === 'IDLE'
					? '开始语音活动会话'
					: '停止语音活动会话'}
				onclick={() => commandCallbacks.toggleVadRecording()}
				variant="ghost"
				class="shrink-0 size-32 sm:size-36 lg:size-40 xl:size-44 transform items-center justify-center overflow-hidden duration-300 ease-in-out"
			>
				<span
					style="filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.5)); view-transition-name: {viewTransition
						.global.microphone};"
					class="text-[100px] sm:text-[110px] lg:text-[120px] xl:text-[130px] leading-none"
				>
					{VAD_STATE_TO_ICON[vadRecorder.state]}
				</span>
			</Button>
			{#if vadRecorder.state === 'IDLE'}
				<div class="absolute -right-32 bottom-4 flex items-center gap-0.5">
					<VadDeviceSelector />
					<CompressionSelector />
					<TranscriptionSelector />
					<TransformationSelector />
				</div>
			{/if}
		</div>
	{:else if settings.value['recording.mode'] === 'upload'}
		<div class="flex flex-col items-center gap-4 w-full">
			<FileDropZone
				accept="{ACCEPT_AUDIO}, {ACCEPT_VIDEO}"
				maxFiles={10}
				maxFileSize={25 * MEGABYTE}
				onUpload={(files) => {
					if (files.length > 0) {
						rpc.commands.uploadRecordings.execute({ files });
					}
				}}
				onFileRejected={({ file, reason }) => {
					rpc.notify.error.execute({
						title: '❌ 文件被拒绝',
						description: `${file.name}: ${reason}`,
					});
				}}
				class="h-32 sm:h-36 lg:h-40 xl:h-44 w-full"
			/>
			<div class="flex items-center gap-1.5">
				<CompressionSelector />
				<TranscriptionSelector />
				<TransformationSelector />
			</div>
		</div>
	{/if}

	{#if latestRecording}
		<div class="xxs:flex hidden w-full flex-col gap-2">
			<TranscriptDialog
				recordingId={latestRecording.id}
				transcribedText={latestRecording.transcriptionStatus === 'TRANSCRIBING'
					? '...'
					: latestRecording.transcribedText}
				rows={1}
				disabled={!latestRecording.transcribedText.trim()}
				loading={latestRecording.transcriptionStatus === 'TRANSCRIBING'}
			/>

			{#if blobUrl}
				<audio
					style="view-transition-name: {viewTransition.recording(
						latestRecording.id,
					).audio}"
					src={blobUrl}
					controls
					class="h-8 w-full"
				></audio>
			{/if}
		</div>
	{/if}

	{#if settings.value['ui.layoutMode'] === 'nav-items'}
		<NavItems class="xs:flex -mb-2.5 -mt-1 hidden" />
	{/if}

	<div class="xs:flex hidden flex-col items-center gap-3">
		{#if settings.value['recording.mode'] === 'manual'}
			<p class="text-foreground/75 text-center text-sm">
				点击麦克风或按下
				{' '}<Link
					tooltip="转到设置中的应用内快捷键"
					href="/settings/shortcuts/local"
				>
					<Kbd.Root
						>{getShortcutDisplayLabel(
							settings.value['shortcuts.local.toggleManualRecording'],
						)}</Kbd.Root
					>
				</Link>{' '}
				在此处开始录音。
			</p>
			{#if window.__TAURI_INTERNALS__}
				<p class="text-foreground/75 text-sm">
					按下
					{' '}<Link
						tooltip="转到设置中的全局快捷键"
						href="/settings/shortcuts/global"
					>
						<Kbd.Root
							>{getShortcutDisplayLabel(
								settings.value['shortcuts.global.toggleManualRecording'],
							)}</Kbd.Root
						>
					</Link>{' '}
					在任意位置开始录音。
				</p>
			{/if}
		{:else if settings.value['recording.mode'] === 'vad'}
			<p class="text-foreground/75 text-center text-sm">
				点击麦克风或按下
				{' '}<Link
					tooltip="转到设置中的应用内快捷键"
					href="/settings/shortcuts/local"
				>
					<Kbd.Root
						>{getShortcutDisplayLabel(
							settings.value['shortcuts.local.toggleVadRecording'],
						)}</Kbd.Root
					>
				</Link>{' '}
				开始语音活动会话。
			</p>
		{:else if settings.value['recording.mode'] === 'upload'}
			<p class="text-foreground/75 text-center text-sm">
				将文件拖到此处或点击浏览。
			</p>
			{#if window.__TAURI_INTERNALS__}
				<p class="text-foreground/75 text-sm">
					按下
					{' '}<Link
						tooltip="转到设置中的全局快捷键"
						href="/settings/shortcuts/global"
					>
						<Kbd.Root
							>{getShortcutDisplayLabel(
								settings.value['shortcuts.global.toggleManualRecording'],
							)}</Kbd.Root
						>
					</Link>{' '}
					改为开始录音。
				</p>
			{/if}
		{/if}
		<p class="text-muted-foreground text-center text-sm font-light">
			{#if !window.__TAURI_INTERNALS__}
				厌倦了切换标签页?
				<Link
					tooltip="获取桌面版 Whispering"
					href="https://epicenter.so/whispering"
					target="_blank"
					rel="noopener noreferrer"
				>
					获取原生桌面应用
				</Link>
			{/if}
		</p>
	</div>
</div>
