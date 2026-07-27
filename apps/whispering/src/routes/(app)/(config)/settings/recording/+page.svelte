<script lang="ts">
	import DesktopOutputFolder from './DesktopOutputFolder.svelte';
	import FfmpegCommandBuilder from './FfmpegCommandBuilder.svelte';
	import * as Field from '@epicenter/ui/field';
	import * as Select from '@epicenter/ui/select';
	import * as Alert from '@epicenter/ui/alert';
	import { Link } from '@epicenter/ui/link';
	import InfoIcon from '@lucide/svelte/icons/info';
	import {
		BITRATE_OPTIONS,
		RECORDING_MODE_OPTIONS,
		SAMPLE_RATE_OPTIONS,
	} from '$lib/constants/audio';
	import { settings } from '$lib/stores/settings.svelte';
	import ManualSelectRecordingDevice from './ManualSelectRecordingDevice.svelte';
	import VadSelectRecordingDevice from './VadSelectRecordingDevice.svelte';
	import {
		isCompressionRecommended,
		COMPRESSION_RECOMMENDED_MESSAGE,
		hasNavigatorLocalTranscriptionIssue,
	} from '$routes/(app)/_layout-utils/check-ffmpeg';
	import { TRANSCRIPTION_SERVICE_ID_TO_LABEL } from '$lib/services/isomorphic/transcription/registry';
	import { IS_MACOS, IS_LINUX, PLATFORM_TYPE } from '$lib/constants/platform';
	import { Button } from '@epicenter/ui/button';

	const { data } = $props();

	// Derived labels for select triggers
	const recordingModeLabel = $derived(
		RECORDING_MODE_OPTIONS.find(
			(o) => o.value === settings.value['recording.mode'],
		)?.label,
	);

	const sampleRateLabel = $derived(
		SAMPLE_RATE_OPTIONS.find(
			(o) => o.value === settings.value['recording.cpal.sampleRate'],
		)?.label,
	);

	const bitrateLabel = $derived(
		BITRATE_OPTIONS.find(
			(o) => o.value === settings.value['recording.navigator.bitrateKbps'],
		)?.label,
	);

	const RECORDING_METHOD_OPTIONS = [
		{
			value: 'cpal',
			label: 'CPAL',
			description: IS_MACOS
				? '原生 Rust 音频方法。录制未压缩的 WAV，快捷键可靠。适用于所有转录方式。'
				: '原生 Rust 音频方法。录制未压缩的 WAV 格式。适用于所有转录方式。',
		},
		{
			value: 'ffmpeg',
			label: 'FFmpeg',
			description: {
				macos:
					'支持所有音频格式，提供高级自定义选项。键盘快捷键可靠。',
				linux:
					'Linux 推荐。支持所有音频格式，提供高级自定义选项。有助于绕过常见音频问题。',
				windows:
					'支持所有音频格式，提供高级自定义选项。',
				android:
					'支持所有音频格式，提供高级自定义选项。',
				ios: '支持所有音频格式，提供高级自定义选项。',
			}[PLATFORM_TYPE],
		},
		{
			value: 'navigator',
			label: '浏览器 API',
			description: IS_MACOS
				? 'Web MediaRecorder API。创建适合云端转录的压缩文件。本地转录需要 FFmpeg(Whisper C++/Parakeet)。应用在后台时快捷键可能有延迟(macOS AppNap)。'
				: 'Web MediaRecorder API。创建适合云端转录的压缩文件。本地转录需要 FFmpeg(Whisper C++/Parakeet)。',
		},
	];

	const recordingMethodLabel = $derived(
		RECORDING_METHOD_OPTIONS.find(
			(o) => o.value === settings.value['recording.method'],
		)?.label,
	);

	const isUsingNavigatorMethod = $derived(
		!window.__TAURI_INTERNALS__ ||
			settings.value['recording.method'] === 'navigator',
	);

	const isUsingFfmpegMethod = $derived(
		settings.value['recording.method'] === 'ffmpeg',
	);
</script>

<svelte:head>
	<title>录音设置 - Whispering</title>
</svelte:head>

<Field.Set>
	<Field.Legend>录音</Field.Legend>
	<Field.Description>
		配置你的 Whispering 录音偏好。
	</Field.Description>
	<Field.Separator />
	<Field.Group>
		<Field.Field>
			<Field.Label for="recording-mode">录音模式</Field.Label>
			<Select.Root
				type="single"
				bind:value={
					() => settings.value['recording.mode'],
					(selected) => {
						if (selected) settings.updateKey('recording.mode', selected);
					}
				}
			>
				<Select.Trigger id="recording-mode" class="w-full">
					{recordingModeLabel ?? '选择录音模式'}
				</Select.Trigger>
				<Select.Content>
					{#each RECORDING_MODE_OPTIONS as item}
						<Select.Item value={item.value} label={item.label} />
					{/each}
				</Select.Content>
			</Select.Root>
			<Field.Description>
				选择录音的激活方式： {RECORDING_MODE_OPTIONS.map(
					(option) => option.label.toLowerCase(),
				).join(', ')}
			</Field.Description>
		</Field.Field>

		{#if window.__TAURI_INTERNALS__ && settings.value['recording.mode'] === 'manual'}
			<Field.Field>
				<Field.Label for="recording-method">录音方法</Field.Label>
				<Select.Root
					type="single"
					bind:value={
						() => settings.value['recording.method'],
						(selected) => {
							if (selected)
								settings.updateKey(
									'recording.method',
									selected as 'cpal' | 'navigator' | 'ffmpeg',
								);
						}
					}
				>
					<Select.Trigger id="recording-method" class="w-full">
						{recordingMethodLabel ?? '选择录音方法'}
					</Select.Trigger>
					<Select.Content>
						{#each RECORDING_METHOD_OPTIONS as item}
							<Select.Item value={item.value} label={item.label}>
								<div class="flex flex-col gap-0.5">
									<div class="font-medium">{item.label}</div>
									{#if item.description}
										<div class="text-xs text-muted-foreground">
											{item.description}
										</div>
									{/if}
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Field.Description>
					{RECORDING_METHOD_OPTIONS.find(
						(option) => option.value === settings.value['recording.method'],
					)?.description}
				</Field.Description>
			</Field.Field>

			{#if IS_MACOS && settings.value['recording.method'] === 'navigator'}
				<Alert.Root class="border-warning/20 bg-warning/5">
					<InfoIcon class="size-4 text-warning dark:text-warning" />
					<Alert.Title class="text-warning dark:text-warning">
						全局快捷键可能不可靠
					</Alert.Title>
					<Alert.Description>
						使用 navigator 录音器时，macOS App Nap 可能会阻止
						浏览器录音逻辑在未聚焦时启动。建议
						使用 CPAL 方法以获得可靠的全局快捷键支持。
					</Alert.Description>
				</Alert.Root>
			{/if}

			{#if settings.value['recording.method'] === 'ffmpeg' && !data.ffmpegInstalled}
				<Alert.Root class="border-red-500/20 bg-red-500/5">
					<InfoIcon class="size-4 text-red-600 dark:text-red-400" />
					<Alert.Title class="text-red-600 dark:text-red-400">
						未安装 FFmpeg
					</Alert.Title>
					<Alert.Description>
						FFmpeg 录音方法需要 FFmpeg。请安装
						以使用此功能。
						<Link
							href="/install-ffmpeg"
							class="font-medium underline underline-offset-4 hover:text-red-700 dark:hover:text-red-300"
						>
							安装 FFmpeg →
						</Link>
					</Alert.Description>
				</Alert.Root>
			{:else if isCompressionRecommended()}
				<Alert.Root class="border-blue-500/20 bg-blue-500/5">
					<InfoIcon class="size-4 text-blue-600 dark:text-blue-400" />
					<Alert.Title class="text-blue-600 dark:text-blue-400">
						启用压缩以加快上传
					</Alert.Title>
					<Alert.Description>
						{COMPRESSION_RECOMMENDED_MESSAGE}
						<Link
							href="/settings/transcription"
							class="font-medium underline underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300"
						>
							在转录设置中启用 →
						</Link>
					</Alert.Description>
				</Alert.Root>
			{/if}

			{#if hasNavigatorLocalTranscriptionIssue( { isFFmpegInstalled: data.ffmpegInstalled ?? false }, )}
				<Alert.Root class="border-red-500/20 bg-red-500/5">
					<InfoIcon class="size-4 text-red-600 dark:text-red-400" />
					<Alert.Title class="text-red-600 dark:text-red-400">
						本地转录需要 FFmpeg 或 CPAL 录音
					</Alert.Title>
					<Alert.Description>
						浏览器 API 录音方法会产生压缩音频，
						需要 FFmpeg 才能使用 {TRANSCRIPTION_SERVICE_ID_TO_LABEL[
							settings.value['transcription.selectedTranscriptionService']
						]} 进行本地转录。
						<div class="mt-3 space-y-3">
							<div class="flex items-center gap-2">
								<span class="text-sm"><strong>选项 1:</strong></span>
								<Button
									onclick={() => settings.updateKey('recording.method', 'cpal')}
									variant="secondary"
									size="sm"
								>
									切换到 CPAL 录音
								</Button>
							</div>
							<div class="text-sm">
								<strong>选项 2:</strong>
								<Link href="/install-ffmpeg">安装 FFmpeg</Link>
								以继续使用浏览器 API 录音
							</div>
							<div class="text-sm">
								<strong>选项 3:</strong>
								切换到云端转录服务商（OpenAI、Groq、Deepgram 等）
								适用于所有录音方式
							</div>
						</div>
					</Alert.Description>
				</Alert.Root>
			{/if}
		{/if}

		{#if settings.value['recording.mode'] === 'manual'}
			{@const method = settings.value['recording.method']}
			<ManualSelectRecordingDevice
				bind:selected={
					() => settings.value[`recording.${method}.deviceId`],
					(selected) =>
						settings.updateKey(`recording.${method}.deviceId`, selected)
				}
			/>
		{:else if settings.value['recording.mode'] === 'vad'}
			{#if IS_LINUX}
				<Alert.Root class="border-red-500/20 bg-red-500/5">
					<InfoIcon class="size-4 text-red-600 dark:text-red-400" />
					<Alert.Title class="text-red-600 dark:text-red-400">
						Linux 不支持 VAD 模式
					</Alert.Title>
					<Alert.Description>
						语音活动检测(VAD)模式需要浏览器的
						Navigator API，该 API 在 Linux 的 Tauri 中未完全支持。
						设备枚举和录音会失败。请改用
						手动录音模式。
						<Link
							href="https://github.com/EpicenterHQ/epicenter/issues/839"
							target="_blank"
							class="font-medium underline underline-offset-4 hover:text-red-700 dark:hover:text-red-300"
						>
							了解更多 →
						</Link>
					</Alert.Description>
				</Alert.Root>
			{:else}
				<Alert.Root class="border-blue-500/20 bg-blue-500/5">
					<InfoIcon class="size-4 text-blue-600 dark:text-blue-400" />
					<Alert.Title class="text-blue-600 dark:text-blue-400">
						语音活动检测模式
					</Alert.Title>
					<Alert.Description>
						VAD 模式使用浏览器的 Web Audio API 进行实时语音
						检测，并通过浏览器的 MediaRecorder API 录音。音频
						编码为未压缩的 WAV 格式。VAD 模式有自己的录音
						方法，不能使用 CPAL 或 FFmpeg。
					</Alert.Description>
				</Alert.Root>
			{/if}

			<VadSelectRecordingDevice
				bind:selected={
					() => settings.value['recording.navigator.deviceId'],
					(selected) =>
						settings.updateKey('recording.navigator.deviceId', selected)
				}
			/>
		{/if}

		{#if settings.value['recording.mode'] === 'manual' || settings.value['recording.mode'] === 'vad'}
			{#if isUsingNavigatorMethod}
				<!-- Browser method settings -->
				<Field.Field>
					<Field.Label for="bit-rate">比特率</Field.Label>
					<Select.Root
						type="single"
						bind:value={
							() => settings.value['recording.navigator.bitrateKbps'],
							(selected) => {
								if (selected)
									settings.updateKey(
										'recording.navigator.bitrateKbps',
										selected,
									);
							}
						}
					>
						<Select.Trigger id="bit-rate" class="w-full">
							{bitrateLabel ?? '选择比特率'}
						</Select.Trigger>
						<Select.Content>
							{#each BITRATE_OPTIONS as item}
								<Select.Item value={item.value} label={item.label} />
							{/each}
						</Select.Content>
					</Select.Root>
					<Field.Description>
						录音的比特率。值越高质量越好，但
						文件越大。
					</Field.Description>
				</Field.Field>
			{:else if isUsingFfmpegMethod}
				<!-- FFmpeg method settings -->
				<div class="space-y-2">
					<label for="output-folder" class="text-sm font-medium">
						录音输出文件夹
					</label>
					<DesktopOutputFolder></DesktopOutputFolder>
					<p class="text-xs text-muted-foreground">
						选择录音的保存位置。默认位置安全且由应用
						管理。
					</p>
				</div>

				<FfmpegCommandBuilder
					bind:globalOptions={
						() => settings.value['recording.ffmpeg.globalOptions'],
						(v) => settings.updateKey('recording.ffmpeg.globalOptions', v)
					}
					bind:inputOptions={
						() => settings.value['recording.ffmpeg.inputOptions'],
						(v) => settings.updateKey('recording.ffmpeg.inputOptions', v)
					}
					bind:outputOptions={
						() => settings.value['recording.ffmpeg.outputOptions'],
						(v) => settings.updateKey('recording.ffmpeg.outputOptions', v)
					}
				/>
			{:else}
				<!-- CPAL method settings -->
				<Field.Field>
					<Field.Label for="sample-rate">采样率</Field.Label>
					<Select.Root
						type="single"
						bind:value={
							() => settings.value['recording.cpal.sampleRate'],
							(selected) => {
								if (selected)
									settings.updateKey('recording.cpal.sampleRate', selected);
							}
						}
					>
						<Select.Trigger id="sample-rate" class="w-full">
							{sampleRateLabel ?? '选择采样率'}
						</Select.Trigger>
						<Select.Content>
							{#each SAMPLE_RATE_OPTIONS as item}
								<Select.Item value={item.value} label={item.label} />
							{/each}
						</Select.Content>
					</Select.Root>
					<Field.Description>
						采样率越高质量越好，但文件越大
					</Field.Description>
				</Field.Field>

				<div class="space-y-2">
					<label for="output-folder" class="text-sm font-medium">
						录音输出文件夹
					</label>
					<DesktopOutputFolder></DesktopOutputFolder>
					<p class="text-xs text-muted-foreground">
						选择录音的保存位置。默认位置安全且由应用
						管理。
					</p>
				</div>
			{/if}
		{/if}
	</Field.Group>
</Field.Set>
