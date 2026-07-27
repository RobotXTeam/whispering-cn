<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<Field.Field>
	<Field.Label for="deepgram-api-key">Deepgram API 密钥</Field.Label>
	<Input
		id="deepgram-api-key"
		type="password"
		placeholder="你的 Deepgram API 密钥"
		autocomplete="off"
		bind:value={
			() => settings.value['apiKeys.deepgram'],
			(value) => settings.updateKey('apiKeys.deepgram', value)
		}
	/>
	<Field.Description>
		你可以在你的 <Link
			href="https://console.deepgram.com/project"
			target="_blank"
			rel="noopener noreferrer"
		>
			Deepgram 控制台
		</Link> 中找到你的 API 密钥。确保你拥有 <Link
			href="https://console.deepgram.com/billing"
			target="_blank"
			rel="noopener noreferrer"
		>
			额度
		</Link>
		可用。
	</Field.Description>
</Field.Field>
