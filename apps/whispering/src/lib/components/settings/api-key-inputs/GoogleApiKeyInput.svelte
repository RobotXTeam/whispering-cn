<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<Field.Field>
	<Field.Label for="google-api-key">Google API 密钥</Field.Label>
	<Input
		id="google-api-key"
		type="password"
		placeholder="你的 Google API 密钥"
		autocomplete="off"
		bind:value={
			() => settings.value['apiKeys.google'],
			(value) => settings.updateKey('apiKeys.google', value)
		}
	/>
	<Field.Description>
		你可以在 <Link
			href="https://aistudio.google.com/app/apikey"
			target="_blank"
			rel="noopener noreferrer"
		>
			Google AI Studio
		</Link> 中找到你的 Google API 密钥。
	</Field.Description>
</Field.Field>
