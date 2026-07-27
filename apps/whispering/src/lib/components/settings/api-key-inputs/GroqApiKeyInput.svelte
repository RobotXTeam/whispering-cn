<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<Field.Group>
	<Field.Field>
		<Field.Label for="groq-api-key">Groq API 密钥</Field.Label>
		<Input
			id="groq-api-key"
			type="password"
			placeholder="你的 Groq API 密钥"
			autocomplete="off"
			bind:value={
				() => settings.value['apiKeys.groq'],
				(value) => settings.updateKey('apiKeys.groq', value)
			}
		/>
		<Field.Description>
			你可以在<Link
				href="https://console.groq.com/keys"
				target="_blank"
				rel="noopener noreferrer"
			>
				Groq 控制台
			</Link>中找到你的 Groq API 密钥。
		</Field.Description>
	</Field.Field>

	<Field.Field>
		<Field.Label for="groq-base-url">Groq 基础 URL</Field.Label>
		<Input
			id="groq-base-url"
			type="url"
			placeholder="https://api.groq.com/openai/v1(默认)"
			autocomplete="off"
			bind:value={
				() => settings.value['apiEndpoints.groq'],
				(value) => settings.updateKey('apiEndpoints.groq', value)
			}
		/>
		<Field.Description>
			覆盖默认的 Groq API 端点。适用于反向代理或
			Groq 兼容的服务。留空则使用官方 Groq API。
		</Field.Description>
	</Field.Field>
</Field.Group>
