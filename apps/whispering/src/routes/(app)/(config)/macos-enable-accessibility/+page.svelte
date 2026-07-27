<script lang="ts">
	import { Button } from '@epicenter/ui/button';
	import { Badge } from '@epicenter/ui/badge';
	import * as Card from '@epicenter/ui/card';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { desktopServices } from '$lib/services';
	import { toast } from 'svelte-sonner';
	import { asShellCommand } from '$lib/services/desktop/command';
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';

	let { data } = $props();
	const isAccessibilityGranted = $derived(data.isAccessibilityGranted);

	async function requestPermissionOrShowGuidance() {
		const { error } = await desktopServices.permissions.accessibility.request();

		if (error) {
			toast.error('打开辅助功能设置失败', {
				description:
					'请在系统设置 > 隐私与安全性 > 辅助功能中手动启用辅助功能',
				action: {
					label: '打开辅助功能设置',
					onClick: () => openSystemSettings(),
				},
			});
		}
	}

	async function openSystemSettings() {
		// Try opening System Settings directly (works on macOS 13+)
		const { error: commandError } = await desktopServices.command.execute(
			asShellCommand(
				'open x-apple.systemsettings:com.apple.SystemSettings.extension',
			),
		);

		if (commandError) {
			console.error('Failed to open System Settings:', commandError);

			// Fallback: Show detailed instructions
			toast.info('手动打开系统设置', {
				description:
					'点击 Apple 菜单 → 系统设置 → 隐私与安全性 → 辅助功能',
				duration: 10000,
			});
			return;
		}

		// Show helpful toast since we can't open directly to accessibility
		toast.info('系统设置已打开', {
			description:
				'前往隐私与安全性 > 辅助功能以授予权限。',
			duration: 8000,
		});
	}
</script>

<svelte:head>
	<title>macOS 辅助功能</title>
</svelte:head>

<main class="flex flex-1 items-center justify-center">
	<Card.Root class="w-full max-w-2xl">
		<Card.Header>
			<Card.Title class="text-xl">macOS 辅助功能</Card.Title>
			<Card.Description class="leading-7">
				请按照以下步骤在您的 macOS 辅助功能设置中重新启用 Whispering。由于 macOS 的一个 bug,在安装新版本的 Whispering 后通常需要执行此操作。
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-col items-center gap-2">
				{#if window.__TAURI_INTERNALS__}
					<!-- YouTube embed for Tauri app (external videos don't work well) -->
					<iframe
						class="max-w-md rounded-lg border"
						width="560"
						height="315"
						src="https://www.youtube.com/embed/FJRktNkr1Fs"
						title="macOS 辅助功能设置指南"
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				{:else}
					<!-- Direct video for web version -->
					<video
						class="max-w-md rounded-lg border"
						src="https://github.com/EpicenterHQ/epicenter/releases/download/_assets/macos_enable_accessibility.mp4"
						autoplay
						loop
						controls
						muted
						playsinline
					>
						<p class="text-muted-foreground text-sm">
							视频指南不可用。请按照下方的文字说明
							操作。
						</p>
					</video>
				{/if}
				<ol
					class="text-muted-foreground list-inside list-decimal space-y-1 text-sm leading-7"
				>
					<li>
						前往 <span class="text-primary font-semibold tracking-tight">
							系统设置 > 隐私与安全性 > 辅助功能
						</span> 或点击下方按钮。
					</li>

					<li>
						点击 <span class="text-primary font-semibold tracking-tight"
							>🎙️ Whispering</span
						> 并使用减号图标(-)将其移除。
					</li>
					<li>
						按加号图标(+)并选择 <span
							class="text-primary font-semibold tracking-tight"
							>🎙️ Whispering.app</span
						> 以重新添加 Whispering
					</li>
				</ol>
			</div>
		</Card.Content>
		<Card.Footer>
			{#if !isAccessibilityGranted}
				<div class="flex gap-3 w-full">
					<Button
						variant="outline"
						onclick={() => goto('/')}
						class="flex-1 text-sm"
					>
						<ArrowLeft class="size-4" />
						返回主页
					</Button>
					<Button
						onclick={() => requestPermissionOrShowGuidance()}
						class="flex-1 text-sm"
					>
						<SettingsIcon class="size-4" />
						请求权限
					</Button>
				</div>
			{:else}
				<div class="flex flex-col gap-3 w-full">
					<Badge variant="success">
						<CheckIcon class="size-4" />
						已授予辅助功能权限
					</Badge>
					<div class="flex gap-3">
						<Button
							variant="outline"
							onclick={() => goto('/')}
							class="flex-1 text-sm"
						>
							<ArrowLeft class="size-4" />
							返回主页
						</Button>
						<Button
							onclick={() => openSystemSettings()}
							variant="outline"
							class="flex-1 text-sm"
						>
							<SettingsIcon class="size-4" />
							打开设置
						</Button>
					</div>
				</div>
			{/if}
		</Card.Footer>
	</Card.Root>
</main>
