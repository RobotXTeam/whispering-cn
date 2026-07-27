<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<Field.Field>
	<Field.Label for="anthropic-api-key">Anthropic API 密钥</Field.Label>
	<Input
		id="anthropic-api-key"
		type="password"
		placeholder="你的 Anthropic API 密钥"
		autocomplete="off"
		bind:value={
			() => settings.value['apiKeys.anthropic'],
			(value) => settings.updateKey('apiKeys.anthropic', value)
		}
	/>
	<Field.Description>
		你可以在<Link
			href="https://console.anthropic.com/settings/keys"
			target="_blank"
			rel="noopener noreferrer"
		>
			Anthropic 控制台
		</Link>中找到你的 Anthropic API 密钥。
	</Field.Description>
</Field.Field>
