<script lang="ts">
	import { Button, buttonVariants } from '@epicenter/ui/button';
	import * as Kbd from '@epicenter/ui/kbd';
	import { Link } from '@epicenter/ui/link';
	import * as Card from '@epicenter/ui/card';
	import * as Alert from '@epicenter/ui/alert';
	import * as Tabs from '@epicenter/ui/tabs';
	import { Snippet } from '@epicenter/ui/snippet';
	import { Badge } from '@epicenter/ui/badge';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import { Spinner } from '@epicenter/ui/spinner';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { services } from '$lib/services';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { desktopRpc } from '$lib/query';

	const platform = services.os.type();

	const ffmpegQuery = createQuery(() => ({
		...desktopRpc.ffmpeg.checkFfmpegInstalled.options,
		refetchInterval: (query) => {
			const isInstalled = query.state.data;
			return isInstalled ? 30000 : 5000;
		},
		refetchOnWindowFocus: true,
		staleTime: 1000,
	}));
</script>

<svelte:head>
	<title>安装 FFmpeg - Whispering</title>
</svelte:head>

<main class="flex flex-1 items-center justify-center p-8">
	<div class="w-full min-w-[640px] max-w-4xl">
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<div class="space-y-3 flex-1 pr-8">
						<Card.Title class="text-3xl">安装 FFmpeg</Card.Title>
						<Card.Description class="text-base leading-relaxed">
							FFmpeg 将音频转换为 WAV 格式以进行本地转录,并压缩文件以便高效传输到云端 API。
						</Card.Description>
					</div>

					<div class="flex flex-col items-end gap-3">
						{#if ffmpegQuery.isPending}
							<Badge variant="secondary" class="gap-1.5">
								<Spinner class="size-3" />
								检查中
							</Badge>
						{:else if ffmpegQuery.data === true}
							<Badge
								variant="default"
								class="gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
							>
								<CheckCircleIcon class="size-3" />
								已安装
							</Badge>
						{:else if ffmpegQuery.data === false}
							<Badge variant="destructive" class="gap-1.5">
								<XCircleIcon class="size-3" />
								未找到
							</Badge>
						{/if}

						<Button
							size="icon"
							variant="ghost"
							onclick={() => ffmpegQuery.refetch()}
							title="重新检查"
							class="size-8"
						>
							{#if ffmpegQuery.isFetching}
								<Spinner />
							{:else}
								<RefreshCwIcon class="size-4" />
							{/if}
						</Button>
					</div>
				</div>
			</Card.Header>

			<Card.Content class="space-y-8">
				{#if ffmpegQuery.data === true}
					<Alert.Root class="border-green-500/20 bg-green-500/5">
						<CheckCircleIcon
							class="size-4 text-green-600 dark:text-green-400"
						/>
						<Alert.Title class="text-green-600 dark:text-green-400">
							FFmpeg 已安装!
						</Alert.Title>
						<Alert.Description>
							已在您的系统上检测到 FFmpeg。您现在可以使用所有音频处理功能。
						</Alert.Description>
					</Alert.Root>

					<div class="flex gap-3">
						<Link
							href="/settings/transcription"
							class={buttonVariants({ class: 'flex-1' })}
						>
							继续前往设置
						</Link>
						<Button variant="outline" onclick={() => goto('/')}>
							前往主页
						</Button>
					</div>
				{:else}
					<Tabs.Root value={platform}>
						<Tabs.List class="grid w-full grid-cols-3">
							<Tabs.Trigger value="macos">macOS</Tabs.Trigger>
							<Tabs.Trigger value="windows">Windows</Tabs.Trigger>
							<Tabs.Trigger value="linux">Linux</Tabs.Trigger>
						</Tabs.List>

						<Tabs.Content value="macos" class="mt-6">
							<div class="space-y-6">
								<h3 class="text-lg font-semibold">macOS 安装</h3>

								<div class="space-y-3">
									<p class="text-sm font-medium">
										使用 Homebrew 安装(支持 Intel 和 Apple
										Silicon)
									</p>
									<Snippet text="brew install ffmpeg" />

									<p class="text-xs text-muted-foreground">
										没有 Homebrew?
										<Link
											href="https://brew.sh"
											target="_blank"
											rel="noopener noreferrer"
											class="underline"
										>
											从 brew.sh 安装
										</Link>
									</p>
								</div>

								<div class="border-t pt-4">
									<p class="text-sm font-medium mb-2">验证安装</p>
									<p class="text-sm text-muted-foreground mb-2">
										安装后,验证 FFmpeg 是否正常工作:
									</p>
									<Snippet text="ffmpeg -version" variant="secondary" />
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="windows" class="mt-6">
							<div class="space-y-8">
								<!-- Windows Installation Section -->
								<div class="space-y-6">
									<div class="space-y-2">
										<h3 class="text-lg font-semibold">Windows 安装</h3>
									</div>

									<ol class="space-y-6 text-sm text-muted-foreground">
										<li class="flex gap-4">
											<span class="font-semibold text-foreground shrink-0"
												>1.</span
											>
											<div class="space-y-3 flex-1">
												<p>从 GitHub 下载 FFmpeg:</p>
												<Button
													href="https://github.com/BtbN/FFmpeg-Builds/releases"
													target="_blank"
													rel="noopener noreferrer"
													variant="default"
													size="lg"
													class="w-full sm:w-auto"
												>
													<DownloadIcon class="size-5" />
													下载 Windows 版 FFmpeg
												</Button>
											</div>
										</li>

										<li class="flex gap-4">
											<span class="font-semibold text-foreground shrink-0"
												>2.</span
											>
											<div class="space-y-2 flex-1">
												<p>
													下载最新的 <code
														class="bg-muted px-2 py-1 rounded text-xs font-mono"
														>ffmpeg-master-latest-win64-gpl-shared.zip</code
													>
												</p>
											</div>
										</li>

										<li class="flex gap-4">
											<span class="font-semibold text-foreground shrink-0"
												>3.</span
											>
											<div class="space-y-2 flex-1">
												<p>
													将 ZIP 文件解压到 <code
														class="bg-muted px-2 py-1 rounded text-xs font-mono"
														>C:\ffmpeg</code
													>
												</p>
											</div>
										</li>

										<li class="flex gap-4">
											<span class="font-semibold text-foreground shrink-0"
												>4.</span
											>
											<div class="space-y-6 flex-1">
												<p>
													将 <code
														class="bg-muted px-2 py-1 rounded text-xs font-mono"
														>C:\ffmpeg\bin</code
													> 添加到您的 Windows PATH:
												</p>

												<!-- Method 1 -->
												<div class="space-y-4 border-l-2 border-muted pl-6">
													<p class="text-base font-semibold text-foreground">
														Method 1: 使用 Windows 设置(推荐)
													</p>
													<ol class="space-y-3 text-sm text-muted-foreground">
														<li class="flex gap-3">
															<span class="shrink-0">a.</span>
															<span
																>按 <Kbd.Root>Windows + X</Kbd.Root> 并选择
																"系统"</span
															>
														</li>
														<li class="flex gap-3">
															<span class="shrink-0">b.</span>
															<span
																>点击"高级系统设置" → "环境
																变量..."</span
															>
														</li>
														<li class="flex gap-3">
															<span class="shrink-0">c.</span>
															<span
																>在"系统变量"下,选择"Path" →
																"编辑..." → "新建"</span
															>
														</li>
														<li class="flex gap-3">
															<span class="shrink-0">d.</span>
															<span
																>添加: <code
																	class="bg-muted px-2 py-1 rounded font-mono text-xs"
																	>C:\ffmpeg\bin</code
																></span
															>
														</li>
														<li class="flex gap-3">
															<span class="shrink-0">e.</span>
															<span>在所有对话框上点击"确定"</span>
														</li>
													</ol>
												</div>

												<!-- Method 2 -->
												<div class="space-y-4 border-l-2 border-muted pl-6">
													<p class="text-base font-semibold text-foreground">
														Method 2: PowerShell(一条命令)
													</p>
													<div class="space-y-3">
														<Snippet
															text="[Environment]::SetEnvironmentVariable(&quot;Path&quot;, $env:Path + &quot;;C:\ffmpeg\bin&quot;, &quot;Machine&quot;)"
														/>
														<p class="text-xs text-muted-foreground">
															<strong>注意:</strong> 以管理员身份运行 PowerShell
															执行此命令
														</p>
													</div>
												</div>

												<!-- Video Tutorial -->
												<div
													class="border rounded-lg p-4 bg-muted/20 space-y-3"
												>
													<p class="text-sm font-medium">
														📹 需要帮助设置 PATH?
													</p>
													<Button
														href="https://www.youtube.com/watch?v=eRZRXpzZfM4&t=85s"
														target="_blank"
														rel="noopener noreferrer"
														variant="outline"
														size="sm"
													>
														<ExternalLinkIcon class="size-3" />
														观看教程视频
													</Button>
												</div>
											</div>
										</li>
										<li class="flex gap-4">
											<span class="font-semibold text-foreground shrink-0"
												>5.</span
											>
											<div class="space-y-3 flex-1">
												<p class="text-sm text-muted-foreground">
													重启 Whispering,然后验证 FFmpeg 是否正常工作:
												</p>
												<Snippet text="ffmpeg -version" variant="secondary" />
											</div>
										</li>
									</ol>
								</div>

								<!-- Troubleshooting Section -->
								<div class="space-y-6 border-t pt-8">
									<h3 class="text-lg font-semibold">故障排除</h3>

									<div class="space-y-5">
										<div class="p-5 border rounded-lg bg-muted/10 space-y-4">
											<p class="text-base font-semibold">
												🚫 "ffmpeg 不是内部或外部命令"
											</p>
											<ul
												class="space-y-3 ml-4 list-disc text-sm text-muted-foreground"
											>
												<li>
													确保您将 <code
														class="bg-muted px-2 py-1 rounded font-mono text-xs"
														>C:\ffmpeg\bin</code
													>
													添加到了 PATH(而不仅仅是
													<code
														class="bg-muted px-2 py-1 rounded font-mono text-xs"
														>C:\ffmpeg</code
													>)
												</li>
												<li>
													添加到 PATH 后完全重启 Whispering
												</li>
												<li>
													在新的命令提示符中测试: <code
														class="bg-muted px-2 py-1 rounded font-mono text-xs"
														>ffmpeg -version</code
													>
												</li>
											</ul>
										</div>

										<details class="border rounded-lg">
											<summary
												class="p-4 cursor-pointer hover:bg-muted/5 text-base font-semibold"
											>
												🔧 高级故障排除
											</summary>
											<div class="px-5 pb-5 space-y-4 border-t bg-muted/5 pt-4">
												<ul
													class="space-y-3 ml-4 list-disc text-sm text-muted-foreground"
												>
													<li>
														注销并重新登录 Windows 以刷新环境
														变量
													</li>
													<li>检查 Windows Defender 是否阻止了 FFmpeg</li>
													<li>
														验证 ffmpeg.exe 文件是否存在于 <code
															class="bg-muted px-2 py-1 rounded font-mono text-xs"
															>C:\ffmpeg\bin\ffmpeg.exe</code
														>
													</li>
												</ul>
											</div>
										</details>
									</div>
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="linux" class="mt-6">
							<div class="space-y-4">
								<h3 class="text-lg font-semibold">Linux 安装</h3>

								<div class="space-y-4">
									<div>
										<p class="text-sm font-medium mb-2">Ubuntu/Debian:</p>
										<Snippet
											text="sudo apt update && sudo apt install ffmpeg"
										/>
									</div>

									<div>
										<p class="text-sm font-medium mb-2">Fedora/RHEL:</p>
										<Snippet text="sudo dnf install ffmpeg" />
									</div>

									<div>
										<p class="text-sm font-medium mb-2">Arch Linux:</p>
										<Snippet text="sudo pacman -S ffmpeg" />
									</div>
								</div>

								<div class="border-t pt-4">
									<p class="text-sm font-medium mb-2">验证安装</p>
									<p class="text-sm text-muted-foreground mb-2">
										安装后,运行以下命令验证 FFmpeg 是否正常工作:
									</p>
									<Snippet text="ffmpeg -version" variant="secondary" />
								</div>
							</div>
						</Tabs.Content>
					</Tabs.Root>
				{/if}
			</Card.Content>

			{#if ffmpegQuery.data !== true}
				<Card.Footer class="flex justify-center">
					<Button href="/settings/transcription" variant="ghost" size="sm">
						<ArrowLeftIcon class="size-4" />
						返回设置
					</Button>
				</Card.Footer>
			{/if}
		</Card.Root>
	</div>
</main>
