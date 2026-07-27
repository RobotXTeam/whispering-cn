<script lang="ts">
	import * as Field from '@epicenter/ui/field';
	import { Input } from '@epicenter/ui/input';
	import { Link } from '@epicenter/ui/link';
	import { settings } from '$lib/stores/settings.svelte';
</script>

<Field.Group>
	<Field.Field>
		<Field.Label for="openai-api-key">OpenAI API 密钥</Field.Label>
		<Input
			id="openai-api-key"
			type="password"
			placeholder="你的 OpenAI API 密钥"
			autocomplete="off"
			bind:value={
				() => settings.value['apiKeys.openai'],
				(value) => settings.updateKey('apiKeys.openai', value)
			}
		/>
		<Field.Description>
			你可以在你的 <Link
				href="https://platform.openai.com/api-keys"
				target="_blank"
				rel="noopener noreferrer"
			>
				账户设置
			</Link> 中找到你的 API 密钥。确保 <Link
				href="https://platform.openai.com/settings/organization/billing/overview"
				target="_blank"
				rel="noopener noreferrer"
			>
				账单
			</Link>
			已启用。
		</Field.Description>
	</Field.Field>

	<Field.Field>
		<Field.Label for="openai-base-url">OpenAI 基础 URL</Field.Label>
		<Input
			id="openai-base-url"
			type="url"
			placeholder="https://api.openai.com/v1(默认)"
			autocomplete="off"
			bind:value={
				() => settings.value['apiEndpoints.openai'],
				(value) => settings.updateKey('apiEndpoints.openai', value)
			}
		/>
		<Field.Description>
			覆盖默认的 OpenAI API 端点。适用于反向代理或			OpenAI 兼容的服务。留空则使用官方 OpenAI API。
		</Field.Description>
	</Field.Field>
</Field.Group>
