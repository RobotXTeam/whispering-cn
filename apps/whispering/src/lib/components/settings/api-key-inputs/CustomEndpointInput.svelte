<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { settings } from '$lib/stores/settings.svelte';

	type Props = {
		showBaseUrl?: boolean;
	};

	let { showBaseUrl = true }: Props = $props();
</script>

<div class="space-y-4">
	{#if showBaseUrl}
		<Field.Field>
			<Field.Label for="custom-endpoint-base-url"
				>自定义 API 基础 URL</Field.Label
			>
			<Input
				id="custom-endpoint-base-url"
				placeholder="例如 http://localhost:11434/v1"
				autocomplete="off"
				bind:value={
					() => settings.value['completion.custom.baseUrl'],
					(value) => settings.updateKey('completion.custom.baseUrl', value)
				}
			/>
			<Field.Description>
				OpenAI 兼容端点(Ollama、LM Studio、
				llama.cpp 等)的全局默认 URL。可在转换中按步骤覆盖。
			</Field.Description>
		</Field.Field>
	{/if}

	<Field.Field>
		<Field.Label for="custom-endpoint-api-key">自定义 API 密钥</Field.Label>
		<Input
			id="custom-endpoint-api-key"
			type="password"
			placeholder="如不需要请留空"
			autocomplete="off"
			bind:value={
				() => settings.value['apiKeys.custom'],
				(value) => settings.updateKey('apiKeys.custom', value)
			}
		/>
		<Field.Description>
			大多数本地端点不需要身份验证。仅当
			你的端点需要时才输入密钥。
		</Field.Description>
	</Field.Field>
</div>
