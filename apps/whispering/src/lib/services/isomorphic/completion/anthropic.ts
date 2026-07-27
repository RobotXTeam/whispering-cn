import Anthropic from '@anthropic-ai/sdk';
import { Err, Ok, tryAsync } from 'wellcrafted/result';
import type { CompletionService } from './types';
import { CompletionServiceErr } from './types';

export function createAnthropicCompletionService(): CompletionService {
	return {
		async complete({ apiKey, model, systemPrompt, userPrompt }) {
			const client = new Anthropic({
				apiKey,
				// Enable browser usage
				dangerouslyAllowBrowser: true,
			});
			// Call Anthropic API
			const { data: completion, error: anthropicApiError } = await tryAsync({
				try: () =>
					client.messages.create({
						model,
						system: systemPrompt,
						messages: [{ role: 'user', content: userPrompt }],
						max_tokens: 1024,
					}),
				catch: (error) => {
					// Check if it's NOT an Anthropic API error
					if (!(error instanceof Anthropic.APIError)) {
						// This is an unexpected error type
						throw error;
					}
					// Return the error directly
					return Err(error);
				},
			});

			if (anthropicApiError) {
				// Error handling follows https://www.npmjs.com/package/@anthropic-ai/sdk#error-handling
				const { status, name, message, error } = anthropicApiError;

				// 400 - BadRequestError
				if (status === 400) {
					return CompletionServiceErr({
						message:
							message ??
							`对 Anthropic API 的请求无效。${error?.message ?? ''}`.trim(),
					});
				}

				// 401 - AuthenticationError
				if (status === 401) {
					return CompletionServiceErr({
						message:
							message ??
							'您的 Anthropic API 密钥似乎无效或已过期。请在设置中更新您的 API 密钥。',
					});
				}

				// 403 - PermissionDeniedError
				if (status === 403) {
					return CompletionServiceErr({
						message:
							message ??
							"您的 Anthropic 账户无权访问此模型或功能。",
					});
				}

				// 404 - NotFoundError
				if (status === 404) {
					return CompletionServiceErr({
						message:
							message ??
							'在 Anthropic 上未找到请求的模型。请检查模型名称。',
					});
				}

				// 422 - UnprocessableEntityError
				if (status === 422) {
					return CompletionServiceErr({
						message:
							message ??
							'请求有效,但 Anthropic 无法处理。请检查您的参数。',
					});
				}

				// 429 - RateLimitError
				if (status === 429) {
					return CompletionServiceErr({
						message: message ?? '已超过 Anthropic 的请求频率限制。请稍后重试。',
					});
				}

				// >=500 - InternalServerError
				if (status && status >= 500) {
					return CompletionServiceErr({
						message:
							message ??
							`Anthropic 服务暂时不可用(错误 ${status})。请稍后重试。`,
					});
				}

				// Handle APIConnectionError (no status code)
				if (!status && name === 'APIConnectionError') {
					return CompletionServiceErr({
						message:
							message ??
							'无法连接到 Anthropic 服务。这可能是网络问题或服务暂时中断。',
					});
				}

				// Catch-all for unexpected errors
				return CompletionServiceErr({
					message: message ?? 'Anthropic 发生了意外错误。请重试。',
				});
			}

			// Extract the response text
			const responseText = completion.content
				.filter((block) => block.type === 'text')
				.map((block) => block.text)
				.join('');

			if (!responseText) {
				return CompletionServiceErr({
					message: 'Anthropic API 返回了空响应',
				});
			}

			return Ok(responseText);
		},
	};
}

export type AnthropicCompletionService = ReturnType<
	typeof createAnthropicCompletionService
>;

export const AnthropicCompletionServiceLive =
	createAnthropicCompletionService();
