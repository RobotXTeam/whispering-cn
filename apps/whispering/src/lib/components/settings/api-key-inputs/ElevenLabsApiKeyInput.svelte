<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<Field.Field>
	<Field.Label for="elevenlabs-api-key">ElevenLabs API 密钥</Field.Label>
	<Input
		id="elevenlabs-api-key"
		type="password"
		placeholder="你的 ElevenLabs API 密钥"
		autocomplete="off"
		bind:value={
			() => settings.value['apiKeys.elevenlabs'],
			(value) => settings.updateKey('apiKeys.elevenlabs', value)
		}
	/>
	<Field.Description>
		你可以在 <Link
			href="https://elevenlabs.io/app/settings/api-keys"
			target="_blank"
			rel="noopener noreferrer"
		>
			ElevenLabs 控制台
		</Link> 中找到你的 ElevenLabs API 密钥。
	</Field.Description>
</Field.Field>
