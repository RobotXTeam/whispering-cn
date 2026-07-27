<script lang="ts">
	import { Badge } from '@epicenter/ui/badge';
	import { Button } from '@epicenter/ui/button';
	import { Checkbox } from '@epicenter/ui/checkbox';
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import {
		FFMPEG_DEFAULT_COMPRESSION_OPTIONS,
		FFMPEG_SMALLEST_COMPRESSION_OPTIONS,
	} from '$lib/services/desktop/recorder/ffmpeg';
	import { settings } from '$lib/stores/settings.svelte';
	import { cn } from '@epicenter/ui/utils';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { isCompressionRecommended } from '$routes/(app)/_layout-utils/check-ffmpeg';
	import { createQuery } from '@tanstack/svelte-query';
	import { desktopRpc } from '$lib/query';
	import * as Alert from '@epicenter/ui/alert';
	import { Link } from '@epicenter/ui/link';

	// Compression preset definitions (UI only - not stored in settings)
	const COMPRESSION_PRESETS = {
		recommended: {
			label: '推荐',
			icon: '🎯',
			description: '最适合语音,带静音移除',
			options: FFMPEG_DEFAULT_COMPRESSION_OPTIONS,
		},
		preserve: {
			label: '保留音频',
			icon: '📼',
			description: '压缩但保留所有音频',
			options: '-c:a libopus -b:a 32k -ar 16000 -ac 1 -compression_level 10',
		},
		smallest: {
			label: '最小',
			icon: '🗜️',
			description: '最大压缩,带静音移除',
			options: FFMPEG_SMALLEST_COMPRESSION_OPTIONS,
		},
		compatible: {
			label: 'MP3',
			icon: '✅',
			description: '通用兼容性',
			options: '-c:a libmp3lame -b:a 32k -ar 16000 -ac 1 -q:a 9',
		},
	} as const;

	type CompressionPresetKey = keyof typeof COMPRESSION_PRESETS;

	/**
	 * Checks if a compression preset is currently active
	 * @param presetKey The preset key to check
	 * @returns true if the preset's options match current settings
	 */
	function isPresetActive(presetKey: CompressionPresetKey): boolean {
		return (
			settings.value['transcription.compressionOptions'] ===
			COMPRESSION_PRESETS[presetKey].options
		);
	}

	// Check if FFmpeg is installed
	const ffmpegQuery = createQuery(
		() => desktopRpc.ffmpeg.checkFfmpegInstalled.options,
	);

	const isFfmpegInstalled = $derived(ffmpegQuery.data ?? false);
	const isFfmpegCheckLoading = $derived(ffmpegQuery.isPending);

	// Show recommended badge if compression is recommended
	const showRecommendedBadge = $derived(isCompressionRecommended());
</script>

<div class="space-y-4">
	<!-- Enable/Disable Toggle -->
	<Field.Field orientation="horizontal">
		<Checkbox
			id="compression-enabled"
			checked={settings.value['transcription.compressionEnabled']}
			onCheckedChange={(checked) =>
				settings.updateKey(
					'transcription.compressionEnabled',
					checked === true,
				)}
			disabled={!isFfmpegInstalled}
		/>
		<Field.Content>
			<div class="flex items-center gap-2">
				<Field.Label
					for="compression-enabled"
					class={cn(!isFfmpegInstalled && 'text-muted-foreground')}
				>
					转录前压缩音频
				</Field.Label>
				{#if showRecommendedBadge}
					<Badge variant="secondary" class="text-xs">推荐</Badge>
				{/if}
			</div>
			<Field.Description>
				减小文件体积并裁剪静音,以加快上传速度并降低 API
				成本
			</Field.Description>
		</Field.Content>
	</Field.Field>

	{#if settings.value['transcription.compressionEnabled']}
		<!-- Preset Selection Badges -->
		<div class="space-y-3">
			<p class="text-base font-medium">压缩预设</p>
			<div class="flex flex-wrap gap-2">
				{#each Object.entries(COMPRESSION_PRESETS) as [presetKey, preset]}
					<Button
						tooltip={preset.description}
						variant={isPresetActive(presetKey as CompressionPresetKey)
							? 'default'
							: 'outline'}
						size="sm"
						class={cn(
							'cursor-pointer transition-colors h-auto px-2 py-1',
							isPresetActive(presetKey as CompressionPresetKey)
								? 'hover:bg-primary/90'
								: 'hover:bg-accent hover:text-accent-foreground',
						)}
						onclick={() =>
							settings.updateKey(
								'transcription.compressionOptions',
								preset.options,
							)}
					>
						<span class="mr-1">{preset.icon}</span>
						<span>{preset.label}</span>
					</Button>
				{/each}
			</div>
			<p class="text-muted-foreground text-xs">
				选择一个预设或在下方自定义 FFmpeg 选项
			</p>
		</div>

		<!-- Custom Options Input -->
		<Field.Field>
			<Field.Label for="compression-options">自定义选项</Field.Label>
			<div class="flex gap-2">
				<Input
					id="compression-options"
					value={settings.value['transcription.compressionOptions']}
					oninput={(e) =>
						settings.updateKey(
							'transcription.compressionOptions',
							e.currentTarget.value,
						)}
					placeholder={FFMPEG_DEFAULT_COMPRESSION_OPTIONS}
					class="flex-1"
				/>
				{#if settings.value['transcription.compressionOptions'] !== FFMPEG_DEFAULT_COMPRESSION_OPTIONS}
					<Button
						tooltip="重置为默认"
						variant="ghost"
						size="icon"
						class="h-9 w-9"
						onclick={() => {
							settings.updateKey(
								'transcription.compressionOptions',
								FFMPEG_DEFAULT_COMPRESSION_OPTIONS,
							);
						}}
					>
						<RotateCcw class="h-3 w-3" />
					</Button>
				{/if}
			</div>
			<Field.Description>
				FFmpeg 压缩选项。此处的更改将在转录期间
				实时反映。
			</Field.Description>
		</Field.Field>

		<!-- Command Preview -->
		<div class="text-xs text-muted-foreground">
			<p class="font-medium mb-1">命令预览:</p>
			<code class="bg-muted rounded px-2 py-1 text-xs break-all block">
				ffmpeg -i input.wav {settings.value['transcription.compressionOptions']}
				output.opus
			</code>
		</div>
	{/if}

	<!-- FFmpeg Installation Warning -->
	{#if !isFfmpegInstalled && !isFfmpegCheckLoading}
		<Alert.Root variant="warning">
			<AlertTriangle class="size-4" />
			<Alert.Title>需要 FFmpeg</Alert.Title>
			<Alert.Description>
				音频压缩需要你的系统安装 FFmpeg。<Link
					href="/install-ffmpeg"
					class="font-medium underline underline-offset-4">安装 FFmpeg</Link
				> 以启用此功能。
			</Alert.Description>
		</Alert.Root>
	{/if}
</div>
