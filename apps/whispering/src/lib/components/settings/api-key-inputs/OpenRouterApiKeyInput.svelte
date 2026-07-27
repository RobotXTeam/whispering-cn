<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<Field.Field>
	<Field.Label for="openrouter-api-key">OpenRouter API 密钥</Field.Label>
	<Input
		id="openrouter-api-key"
		type="password"
		placeholder="你的 OpenRouter API 密钥"
		autocomplete="off"
		bind:value={
			() => settings.value['apiKeys.openrouter'],
			(value) => settings.updateKey('apiKeys.openrouter', value)
		}
	/>
	<Field.Description>
		你可以在 <Link
			href="https://openrouter.ai/keys"
			target="_blank"
			rel="noopener noreferrer"
		>
			OpenRouter 控制面板
		</Link> 中找到你的 OpenRouter API 密钥。
	</Field.Description>
</Field.Field>
