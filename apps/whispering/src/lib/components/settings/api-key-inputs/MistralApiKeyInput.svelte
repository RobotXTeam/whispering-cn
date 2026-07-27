<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<Field.Field>
	<Field.Label for="mistral-api-key">Mistral AI API 密钥</Field.Label>
	<Input
		id="mistral-api-key"
		type="password"
		placeholder="你的 Mistral AI API 密钥"
		autocomplete="off"
		bind:value={
			() => settings.value['apiKeys.mistral'],
			(value) => settings.updateKey('apiKeys.mistral', value)
		}
	/>
	<Field.Description>
		你可以在 <Link
			href="https://console.mistral.ai/api-keys/"
			target="_blank"
			rel="noopener noreferrer"
		>
			Mistral 控制台
		</Link> 中找到你的 API 密钥。Voxtral 转录定价为 <Link
			href="https://mistral.ai/pricing#api-pricing"
			target="_blank"
			rel="noopener noreferrer"
		>
			$0.12/hour
		</Link>
		的音频。
	</Field.Description>
</Field.Field>
