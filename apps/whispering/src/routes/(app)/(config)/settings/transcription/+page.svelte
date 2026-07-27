<script lang="ts">
	import CopyablePre from '$lib/components/copyable/CopyablePre.svelte';
	import { createCopyFn } from '$lib/utils/createCopyFn';
	import { CopyButton } from '@epicenter/ui/copy-button';
	import {
		CompressionBody,
		DeepgramApiKeyInput,
		ElevenLabsApiKeyInput,
		GroqApiKeyInput,
		MistralApiKeyInput,
		OpenAiApiKeyInput,
	} from '$lib/components/settings';
	import LocalModelSelector from '$lib/components/settings/LocalModelSelector.svelte';
	import TranscriptionServiceSelect from '$lib/components/settings/TranscriptionServiceSelect.svelte';
	import { SUPPORTED_LANGUAGES_OPTIONS } from '$lib/constants/languages';
	import { DEEPGRAM_TRANSCRIPTION_MODELS } from '$lib/services/isomorphic/transcription/cloud/deepgram';
	import { ELEVENLABS_TRANSCRIPTION_MODELS } from '$lib/services/isomorphic/transcription/cloud/elevenlabs';
	import { GROQ_MODELS } from '$lib/services/isomorphic/transcription/cloud/groq';
	import { MISTRAL_TRANSCRIPTION_MODELS } from '$lib/services/isomorphic/transcription/cloud/mistral';
	import { OPENAI_TRANSCRIPTION_MODELS } from '$lib/services/isomorphic/transcription/cloud/openai';
	import { MOONSHINE_MODELS } from '$lib/services/isomorphic/transcription/local/moonshine';
	import { PARAKEET_MODELS } from '$lib/services/isomorphic/transcription/local/parakeet';
	import { WHISPER_MODELS } from '$lib/services/isomorphic/transcription/local/whispercpp';
	import { TRANSCRIPTION_SERVICE_CAPABILITIES } from '$lib/services/isomorphic/transcription/registry';
	import { settings } from '$lib/stores/settings.svelte';
	import InfoIcon from '@lucide/svelte/icons/info';
	import * as Alert from '@epicenter/ui/alert';
	import { Badge } from '@epicenter/ui/badge';
	import { Button } from '@epicenter/ui/button';
	import * as Card from '@epicenter/ui/card';
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import * as Select from '@epicenter/ui/select';
	import { Textarea } from '@epicenter/ui/textarea';
	import { hasNavigatorLocalTranscriptionIssue } from '$routes/(app)/_layout-utils/check-ffmpeg';

	const { data } = $props();

	/**
	 * Feature capabilities for the currently selected transcription service.
	 * Used to conditionally disable UI fields that aren't supported by the service.
	 */
	const currentServiceCapabilities = $derived(
		TRANSCRIPTION_SERVICE_CAPABILITIES[
			settings.value['transcription.selectedTranscriptionService']
		],
	);

	// Model options arrays
	const openaiModelItems = OPENAI_TRANSCRIPTION_MODELS.map((model) => ({
		value: model.name,
		label: model.name,
		...model,
	}));

	const groqModelItems = GROQ_MODELS.map((model) => ({
		value: model.name,
		label: model.name,
		...model,
	}));

	const deepgramModelItems = DEEPGRAM_TRANSCRIPTION_MODELS.map((model) => ({
		value: model.name,
		label: model.name,
		...model,
	}));

	const mistralModelItems = MISTRAL_TRANSCRIPTION_MODELS.map((model) => ({
		value: model.name,
		label: model.name,
		...model,
	}));

	const elevenlabsModelItems = ELEVENLABS_TRANSCRIPTION_MODELS.map((model) => ({
		value: model.name,
		label: model.name,
		...model,
	}));

	// Selected labels for select triggers
	const openaiModelLabel = $derived(
		openaiModelItems.find(
			(i) => i.value === settings.value['transcription.openai.model'],
		)?.label,
	);

	const groqModelLabel = $derived(
		groqModelItems.find(
			(i) => i.value === settings.value['transcription.groq.model'],
		)?.label,
	);

	const deepgramModelLabel = $derived(
		deepgramModelItems.find(
			(i) => i.value === settings.value['transcription.deepgram.model'],
		)?.label,
	);

	const mistralModelLabel = $derived(
		mistralModelItems.find(
			(i) => i.value === settings.value['transcription.mistral.model'],
		)?.label,
	);

	const elevenlabsModelLabel = $derived(
		elevenlabsModelItems.find(
			(i) => i.value === settings.value['transcription.elevenlabs.model'],
		)?.label,
	);

	const outputLanguageLabel = $derived(
		SUPPORTED_LANGUAGES_OPTIONS.find(
			(i) => i.value === settings.value['transcription.outputLanguage'],
		)?.label,
	);
</script>

<svelte:head>
	<title>转录设置 - Whispering</title>
</svelte:head>

<Field.Set>
	<Field.Legend>转录</Field.Legend>
	<Field.Description>
		配置你的 Whispering 转录偏好。
	</Field.Description>
	<Field.Separator />
	<Field.Group>
		<TranscriptionServiceSelect
			id="selected-transcription-service"
			label="转录服务"
			bind:selected={
				() => settings.value['transcription.selectedTranscriptionService'],
				(selected) =>
					settings.updateKey(
						'transcription.selectedTranscriptionService',
						selected,
					)
			}
		/>

		{#if settings.value['transcription.selectedTranscriptionService'] === 'OpenAI'}
			<Field.Field>
				<Field.Label for="openai-model">OpenAI 模型</Field.Label>
				<Select.Root
					type="single"
					bind:value={
						() => settings.value['transcription.openai.model'],
						(v) => settings.updateKey('transcription.openai.model', v)
					}
				>
					<Select.Trigger id="openai-model" class="w-full">
						{openaiModelLabel ?? '选择模型'}
					</Select.Trigger>
					<Select.Content>
						{#each openaiModelItems as item}
							<Select.Item value={item.value} label={item.label}>
								{@render renderModelOption({ item })}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Field.Description>
					你可以在 <Link
						href="https://platform.openai.com/docs/guides/speech-to-text"
						target="_blank"
						rel="noopener noreferrer"
					>
						OpenAI 文档
					</Link>中找到关于这些模型的更多详情。
				</Field.Description>
			</Field.Field>
			<OpenAiApiKeyInput />
		{:else if settings.value['transcription.selectedTranscriptionService'] === 'Groq'}
			<Field.Field>
				<Field.Label for="groq-model">Groq 模型</Field.Label>
				<Select.Root
					type="single"
					bind:value={
						() => settings.value['transcription.groq.model'],
						(v) => settings.updateKey('transcription.groq.model', v)
					}
				>
					<Select.Trigger id="groq-model" class="w-full">
						{groqModelLabel ?? '选择模型'}
					</Select.Trigger>
					<Select.Content>
						{#each groqModelItems as item}
							<Select.Item value={item.value} label={item.label}>
								{@render renderModelOption({ item })}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Field.Description>
					你可以在 <Link
						href="https://console.groq.com/docs/speech-to-text"
						target="_blank"
						rel="noopener noreferrer"
					>
						Groq 文档
					</Link>中找到关于这些模型的更多详情。
				</Field.Description>
			</Field.Field>
			<GroqApiKeyInput />
		{:else if settings.value['transcription.selectedTranscriptionService'] === 'Deepgram'}
			<Field.Field>
				<Field.Label for="deepgram-model">Deepgram 模型</Field.Label>
				<Select.Root
					type="single"
					bind:value={
						() => settings.value['transcription.deepgram.model'],
						(v) => settings.updateKey('transcription.deepgram.model', v)
					}
				>
					<Select.Trigger id="deepgram-model" class="w-full">
						{deepgramModelLabel ?? '选择模型'}
					</Select.Trigger>
					<Select.Content>
						{#each deepgramModelItems as item}
							<Select.Item value={item.value} label={item.label}>
								{@render renderModelOption({ item })}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</Field.Field>
			<DeepgramApiKeyInput />
		{:else if settings.value['transcription.selectedTranscriptionService'] === 'Mistral'}
			<Field.Field>
				<Field.Label for="mistral-model">Mistral 模型</Field.Label>
				<Select.Root
					type="single"
					bind:value={
						() => settings.value['transcription.mistral.model'],
						(v) => settings.updateKey('transcription.mistral.model', v)
					}
				>
					<Select.Trigger id="mistral-model" class="w-full">
						{mistralModelLabel ?? '选择模型'}
					</Select.Trigger>
					<Select.Content>
						{#each mistralModelItems as item}
							<Select.Item value={item.value} label={item.label}>
								{@render renderModelOption({ item })}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Field.Description>
					你可以在 <Link
						href="https://mistral.ai/news/voxtral/"
						target="_blank"
						rel="noopener noreferrer"
					>
						Mistral 文档
					</Link>中找到关于 Voxtral 语音理解的更多详情。
				</Field.Description>
			</Field.Field>
			<MistralApiKeyInput />
		{:else if settings.value['transcription.selectedTranscriptionService'] === 'ElevenLabs'}
			<Field.Field>
				<Field.Label for="elevenlabs-model">ElevenLabs 模型</Field.Label>
				<Select.Root
					type="single"
					bind:value={
						() => settings.value['transcription.elevenlabs.model'],
						(v) => settings.updateKey('transcription.elevenlabs.model', v)
					}
				>
					<Select.Trigger id="elevenlabs-model" class="w-full">
						{elevenlabsModelLabel ?? '选择模型'}
					</Select.Trigger>
					<Select.Content>
						{#each elevenlabsModelItems as item}
							<Select.Item value={item.value} label={item.label}>
								{@render renderModelOption({ item })}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Field.Description>
					你可以在 <Link
						href="https://elevenlabs.io/docs/capabilities/speech-to-text"
						target="_blank"
						rel="noopener noreferrer"
					>
						ElevenLabs 文档
					</Link>中找到关于这些模型的更多详情。
				</Field.Description>
			</Field.Field>
			<ElevenLabsApiKeyInput />
		{:else if settings.value['transcription.selectedTranscriptionService'] === 'speaches'}
			<div class="space-y-4">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-lg">Speaches 设置</Card.Title>
						<Card.Description>
							安装 Speaches 服务器并配置 Whispering。Speaches 是
							faster-whisper-server 的继任者,具有改进的功能和
							积极的开发。
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-6">
						<div class="flex gap-3">
							<Button
								href="https://speaches.ai/installation/"
								target="_blank"
								rel="noopener noreferrer"
							>
								安装指南
							</Button>
							<Button
								variant="outline"
								href="https://speaches.ai/usage/speech-to-text/"
								target="_blank"
								rel="noopener noreferrer"
							>
								语音转文本设置
							</Button>
						</div>

						<div class="space-y-4">
							<div>
								<p class="text-sm font-medium">
									<span class="text-muted-foreground">步骤 1:</span> 安装 Speaches
									服务器
								</p>
								<ul class="ml-6 mt-2 space-y-2 text-sm text-muted-foreground">
									<li class="list-disc">
										下载所需的 docker compose 文件,详见 <Link
											href="https://speaches.ai/installation/"
											target="_blank"
											rel="noopener noreferrer"
										>
											安装指南
										</Link>
									</li>
									<li class="list-disc">
										根据你的系统选择 CUDA、带 CDI 的 CUDA 或 CPU
										变体
									</li>
								</ul>
							</div>

							<div>
								<p class="text-sm font-medium mb-2">
									<span class="text-muted-foreground">步骤 2:</span> 启动 Speaches
									容器
								</p>
								<CopyablePre
									copyableText="docker compose up --detach"
									variant="code"
								/>
							</div>

							<div>
								<p class="text-sm font-medium">
									<span class="text-muted-foreground">步骤 3:</span> 下载语音
									识别模型
								</p>
								<ul class="ml-6 mt-2 space-y-2 text-sm text-muted-foreground">
									<li class="list-disc">
										查看可用模型,详见 <Link
											href="https://speaches.ai/usage/speech-to-text/"
											target="_blank"
											rel="noopener noreferrer"
										>
											语音转文本指南
										</Link>
									</li>
									<li class="list-disc">
										运行以下命令下载模型:
									</li>
								</ul>
								<div class="mt-2">
									<CopyablePre
										copyableText="uvx speaches-cli model download Systran/faster-distil-whisper-small.en"
										variant="code"
									/>
								</div>
							</div>

							<div>
								<p class="text-sm font-medium">
									<span class="text-muted-foreground">步骤 4:</span> 配置
									以下设置
								</p>
								<ul class="ml-6 mt-2 space-y-1 text-sm text-muted-foreground">
									<li class="list-disc">输入你的 Speaches 服务器 URL</li>
									<li class="list-disc">输入你下载的模型 ID</li>
								</ul>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			</div>

			<Field.Field>
				<Field.Label for="speaches-base-url">基础 URL</Field.Label>
				<Input
					id="speaches-base-url"
					placeholder="http://localhost:8000"
					autocomplete="off"
					bind:value={
						() => settings.value['transcription.speaches.baseUrl'],
						(value) =>
							settings.updateKey('transcription.speaches.baseUrl', value)
					}
				/>
				<Field.Description>
					你的 Speaches 服务器运行的 URL(<code>
						SPEACHES_BASE_URL
					</code>),通常为
					<CopyButton
						text="http://localhost:8000"
						copyFn={createCopyFn('speaches base url')}
						class="bg-muted rounded px-[0.3rem] py-[0.15rem] font-mono text-sm hover:bg-muted/80"
						variant="ghost"
						size="sm"
					>
						http://localhost:8000
					</CopyButton>
				</Field.Description>
			</Field.Field>

			<Field.Field>
				<Field.Label for="speaches-model-id">模型 ID</Field.Label>
				<Input
					id="speaches-model-id"
					placeholder="Systran/faster-distil-whisper-small.en"
					autocomplete="off"
					bind:value={
						() => settings.value['transcription.speaches.modelId'],
						(value) =>
							settings.updateKey('transcription.speaches.modelId', value)
					}
				/>
				<Field.Description>
					你在步骤 3 中下载的模型(<code>MODEL_ID</code>),例如
					<CopyButton
						text="Systran/faster-distil-whisper-small.en"
						copyFn={createCopyFn('speaches model id')}
						class="bg-muted rounded px-[0.3rem] py-[0.15rem] font-mono text-sm hover:bg-muted/80"
						variant="ghost"
						size="sm"
					>
						Systran/faster-distil-whisper-small.en
					</CopyButton>
				</Field.Description>
			</Field.Field>
		{:else if settings.value['transcription.selectedTranscriptionService'] === 'whispercpp'}
			<div class="space-y-4">
				<!-- Whisper Model Selector Component -->
				{#if window.__TAURI_INTERNALS__}
					<LocalModelSelector
						models={WHISPER_MODELS}
						title="Whisper 模型"
						description="选择预构建的模型或浏览你自己的模型。模型在本地运行,用于私密的离线transcription."
						fileSelectionMode="file"
						fileExtensions={['bin', 'gguf', 'ggml']}
						bind:value={
							() => settings.value['transcription.whispercpp.modelPath'],
							(v) => settings.updateKey('transcription.whispercpp.modelPath', v)
						}
					>
						{#snippet prebuiltFooter()}
							<p class="text-sm text-muted-foreground">
								模型从{' '}
								<Link
									href="https://huggingface.co/ggerganov/whisper.cpp"
									target="_blank"
									rel="noopener noreferrer"
								>
									Hugging Face
								</Link>
								{' '}下载并本地存储在你的应用数据目录中。量化
								模型体积更小,质量损失极小。
							</p>
						{/snippet}

						{#snippet manualInstructions()}
							<div>
								<p class="text-sm font-medium mb-2">
									<span class="text-muted-foreground">步骤 1:</span> 下载 Whisper
									模型
								</p>
								<ul class="ml-6 mt-2 space-y-2 text-sm text-muted-foreground">
									<li class="list-disc">
										访问{' '}
										<Link
											href="https://huggingface.co/ggerganov/whisper.cpp/tree/main"
											target="_blank"
											rel="noopener noreferrer"
										>
											模型仓库
										</Link>
									</li>
									<li class="list-disc">
										下载任意模型文件(例如 ggml-base.en.bin,仅支持
										英语)
									</li>
									<li class="list-disc">
										量化模型(q5_0、q8_0)体积更小,
										质量损失极小
									</li>
								</ul>
							</div>
						{/snippet}
					</LocalModelSelector>

					{#if hasNavigatorLocalTranscriptionIssue( { isFFmpegInstalled: data.ffmpegInstalled ?? false }, )}
						<Alert.Root class="border-red-500/20 bg-red-500/5">
							<InfoIcon class="size-4 text-red-600 dark:text-red-400" />
							<Alert.Title class="text-red-600 dark:text-red-400">
								浏览器 API 录音需要 FFmpeg
							</Alert.Title>
							<Alert.Description>
								你正在使用浏览器 API 录音方式,它产生的
								压缩音频需要 FFmpeg 才能进行 Whisper C++
								转录。
								<div class="mt-3 space-y-3">
									<div class="text-sm">
										<strong>选项 1:</strong>
										<Link href="/settings/recording"
											>切换到 CPAL 录音</Link
										>
										以直接兼容本地转录
									</div>
									<div class="text-sm">
										<strong>选项 2:</strong>
										<Link href="/install-ffmpeg">安装 FFmpeg</Link>
										以继续使用浏览器 API 录音
									</div>
									<div class="text-sm">
										<strong>选项 3:</strong>
										切换到云转录服务(OpenAI、Groq、Deepgram、
										等),它们兼容所有录音方式
									</div>
								</div>
							</Alert.Description>
						</Alert.Root>
					{/if}
				{/if}
			</div>
		{:else if settings.value['transcription.selectedTranscriptionService'] === 'parakeet'}
			<div class="space-y-4">
				<!-- Parakeet Model Selector Component -->
				{#if window.__TAURI_INTERNALS__}
					<LocalModelSelector
						models={PARAKEET_MODELS}
						title="Parakeet 模型"
						description="Parakeet 是一个 NVIDIA NeMo 模型,针对快速本地转录进行了优化。它会自动检测语言,不支持手动语言选择。"
						fileSelectionMode="directory"
						bind:value={
							() => settings.value['transcription.parakeet.modelPath'],
							(v) => settings.updateKey('transcription.parakeet.modelPath', v)
						}
					>
						{#snippet prebuiltFooter()}
							<p class="text-sm text-muted-foreground">
								模型从{' '}
								<Link
									href="https://github.com/EpicenterHQ/epicenter/releases/tag/models/parakeet-tdt-0.6b-v3-int8"
									target="_blank"
									rel="noopener noreferrer"
								>
									GitHub 发布
								</Link>
								{' '}并存储在你的应用数据目录中。预打包的
								存档包含 NVIDIA Parakeet 模型,采用 INT8
								量化,下载后解压。
							</p>
						{/snippet}

						{#snippet manualInstructions()}
							<Card.Root class="bg-muted/50">
								<Card.Content class="p-4">
									<h4 class="mb-2 text-sm font-medium">
										获取 Parakeet 模型
									</h4>
									<ul class="space-y-2 text-sm text-muted-foreground">
										<li class="flex items-start gap-2">
											<span
												class="mt-0.5 block size-1.5 rounded-full bg-muted-foreground/50"
											/>
											<span>
												从"预构建模型"
												选项卡下载
											</span>
										</li>
										<li class="flex items-start gap-2">
											<span
												class="mt-0.5 block size-1.5 rounded-full bg-muted-foreground/50"
											/>
											<span>
												或从{' '}
												<Link
													href="https://github.com/NVIDIA/NeMo"
													target="_blank"
													rel="noopener noreferrer"
												>
													NVIDIA NeMo
												</Link>
											</span>
										</li>
										<li class="flex items-start gap-2">
											<span
												class="mt-0.5 block size-1.5 rounded-full bg-muted-foreground/50"
											/>
											<span>
												Parakeet 模型是包含 ONNX 文件的目录
											</span>
										</li>
									</ul>
								</Card.Content>
							</Card.Root>
						{/snippet}
					</LocalModelSelector>

					{#if hasNavigatorLocalTranscriptionIssue( { isFFmpegInstalled: data.ffmpegInstalled ?? false }, )}
						<Alert.Root class="border-red-500/20 bg-red-500/5">
							<InfoIcon class="size-4 text-red-600 dark:text-red-400" />
							<Alert.Title class="text-red-600 dark:text-red-400">
								浏览器 API 录音需要 FFmpeg
							</Alert.Title>
							<Alert.Description>
								你正在使用浏览器 API 录音方式,它产生的
								压缩音频需要 FFmpeg 才能进行 Parakeet
								转录。
								<div class="mt-3 space-y-3">
									<div class="text-sm">
										<strong>选项 1:</strong>
										<Link href="/settings/recording"
											>切换到 CPAL 录音</Link
										>
										以直接兼容本地转录
									</div>
									<div class="text-sm">
										<strong>选项 2:</strong>
										<Link href="/install-ffmpeg">安装 FFmpeg</Link>
										以继续使用浏览器 API 录音
									</div>
									<div class="text-sm">
										<strong>选项 3:</strong>
										切换到云转录服务(OpenAI、Groq、Deepgram、
										等),它们兼容所有录音方式
									</div>
								</div>
							</Alert.Description>
						</Alert.Root>
					{/if}
				{/if}
			</div>
		{:else if settings.value['transcription.selectedTranscriptionService'] === 'moonshine'}
			<div class="space-y-4">
				<!-- Moonshine Model Selector Component -->
				{#if window.__TAURI_INTERNALS__}
					<LocalModelSelector
						models={MOONSHINE_MODELS}
						title="Moonshine 模型"
						description="Moonshine 是 UsefulSensors 开发的高效 ONNX 模型。仅支持英语,推理快速,模型体积小(约 30 MB)。"
						fileSelectionMode="directory"
						bind:value={
							() => settings.value['transcription.moonshine.modelPath'],
							(v) => settings.updateKey('transcription.moonshine.modelPath', v)
						}
					>
						{#snippet prebuiltFooter()}
							<p class="text-sm text-muted-foreground">
								模型从{' '}
								<Link
									href="https://huggingface.co/UsefulSensors/moonshine"
									target="_blank"
									rel="noopener noreferrer"
								>
									Hugging Face
								</Link>
								{' '}并存储在你的应用数据目录中。Moonshine 使用
								量化 ONNX 模型以实现高效的本地推理。
							</p>
						{/snippet}

						{#snippet manualInstructions()}
							<Card.Root class="bg-muted/50">
								<Card.Content class="p-4">
									<h4 class="mb-2 text-sm font-medium">
										获取 Moonshine 模型
									</h4>
									<ul class="space-y-2 text-sm text-muted-foreground">
										<li class="flex items-start gap-2">
											<span
												class="mt-0.5 block size-1.5 rounded-full bg-muted-foreground/50"
											/>
											<span>
												从"预构建模型"
												选项卡下载
											</span>
										</li>
										<li class="flex items-start gap-2">
											<span
												class="mt-0.5 block size-1.5 rounded-full bg-muted-foreground/50"
											/>
											<span>
												或从{' '}
												<Link
													href="https://huggingface.co/UsefulSensors/moonshine"
													target="_blank"
													rel="noopener noreferrer"
												>
													Hugging Face 上的 UsefulSensors
												</Link>
											</span>
										</li>
										<li class="flex items-start gap-2">
											<span
												class="mt-0.5 block size-1.5 rounded-full bg-muted-foreground/50"
											/>
											<span>
												Moonshine 模型是包含 ONNX 文件
												和分词器的目录
											</span>
										</li>
									</ul>
									<div
										class="mt-3 rounded border border-amber-500/20 bg-amber-500/5 p-3"
									>
										<p
											class="text-xs font-medium text-amber-600 dark:text-amber-400"
										>
											目录命名要求
										</p>
										<p class="mt-1 text-xs text-muted-foreground">
											模型目录必须命名为{' '}
											<code class="rounded bg-muted px-1 py-0.5 font-mono"
												>moonshine-&#123;variant&#125;-&#123;lang&#125;</code
											>
											{' '}(例如,
											<code class="rounded bg-muted px-1 py-0.5 font-mono"
												>moonshine-tiny-en</code
											>,
											{' '}<code class="rounded bg-muted px-1 py-0.5 font-mono"
												>moonshine-base-en</code
											>)。变体(tiny/base)决定模型架构。
										</p>
									</div>
								</Card.Content>
							</Card.Root>
						{/snippet}
					</LocalModelSelector>

					{#if hasNavigatorLocalTranscriptionIssue( { isFFmpegInstalled: data.ffmpegInstalled ?? false }, )}
						<Alert.Root class="border-red-500/20 bg-red-500/5">
							<InfoIcon class="size-4 text-red-600 dark:text-red-400" />
							<Alert.Title class="text-red-600 dark:text-red-400">
								浏览器 API 录音需要 FFmpeg
							</Alert.Title>
							<Alert.Description>
								你正在使用浏览器 API 录音方式,它产生的
								压缩音频需要 FFmpeg 才能进行 Moonshine
								转录。
								<div class="mt-3 space-y-3">
									<div class="text-sm">
										<strong>选项 1:</strong>
										<Link href="/settings/recording"
											>切换到 CPAL 录音</Link
										>
										以直接兼容本地转录
									</div>
									<div class="text-sm">
										<strong>选项 2:</strong>
										<Link href="/install-ffmpeg">安装 FFmpeg</Link>
										以继续使用浏览器 API 录音
									</div>
									<div class="text-sm">
										<strong>选项 3:</strong>
										切换到云转录服务(OpenAI、Groq、Deepgram、
										等),它们兼容所有录音方式
									</div>
								</div>
							</Alert.Description>
						</Alert.Root>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Audio Compression Settings -->
		<CompressionBody />

		<Field.Field>
			<Field.Label for="output-language">输出语言</Field.Label>
			<Select.Root
				type="single"
				bind:value={
					() => settings.value['transcription.outputLanguage'],
					(v) => settings.updateKey('transcription.outputLanguage', v)
				}
				disabled={!currentServiceCapabilities.supportsLanguage}
			>
				<Select.Trigger id="output-language" class="w-full">
					{outputLanguageLabel ?? '选择语言'}
				</Select.Trigger>
				<Select.Content>
					{#each SUPPORTED_LANGUAGES_OPTIONS as item}
						<Select.Item value={item.value} label={item.label} />
					{/each}
				</Select.Content>
			</Select.Root>
			{#if !currentServiceCapabilities.supportsLanguage}
				<Field.Description>
					{settings.value['transcription.selectedTranscriptionService'] ===
					'moonshine'
						? 'Moonshine 仅支持英语'
						: 'Parakeet 自动检测语言'}
				</Field.Description>
			{/if}
		</Field.Field>

		<Field.Field>
			<Field.Label for="temperature">温度</Field.Label>
			<Input
				id="temperature"
				type="number"
				min="0"
				max="1"
				step="0.1"
				placeholder="0"
				autocomplete="off"
				disabled={!currentServiceCapabilities.supportsTemperature}
				bind:value={
					() => settings.value['transcription.temperature'],
					(value) =>
						settings.updateKey('transcription.temperature', String(value))
				}
			/>
			<Field.Description>
				{currentServiceCapabilities.supportsTemperature
					? "控制模型输出的随机性。0 代表专注且确定,1 代表更具创造性。"
					: '本地模型(transcribe-rs)不支持温度'}
			</Field.Description>
		</Field.Field>

		<Field.Field>
			<Field.Label for="transcription-prompt">系统提示词</Field.Label>
			<Textarea
				id="transcription-prompt"
				placeholder="例如:这是一堂关于量子物理的学术讲座,包含'eigenvalue'和'Schrödinger'等技术术语"
				disabled={!currentServiceCapabilities.supportsPrompt}
				bind:value={
					() => settings.value['transcription.prompt'],
					(value) => settings.updateKey('transcription.prompt', value)
				}
			/>
			<Field.Description>
				{currentServiceCapabilities.supportsPrompt
					? '帮助转录服务(例如 Whisper)在初始转录时更好地识别特定术语、名称或上下文。不适用于文本转换 — 请使用"转换"选项卡进行后处理规则。'
					: '本地模型(Parakeet、Moonshine)不支持系统提示词'}
			</Field.Description>
		</Field.Field>
	</Field.Group>
</Field.Set>

{#snippet renderModelOption({
	item,
}: {
	item: {
		name: string;
		description: string;
		cost: string;
	};
})}
	<div class="flex flex-col gap-1 py-1">
		<div class="font-medium">{item.name}</div>
		<div class="text-sm text-muted-foreground">
			{item.description}
		</div>
		<Badge variant="outline" class="text-xs">{item.cost}</Badge>
	</div>
{/snippet}
