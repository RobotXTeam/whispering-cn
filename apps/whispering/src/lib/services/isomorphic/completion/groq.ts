import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import Groq from 'groq-sdk';
import { Err, Ok, tryAsync } from 'wellcrafted/result';
import type { CompletionService } from './types';
import { CompletionServiceErr } from './types';

const customFetch = window.__TAURI_INTERNALS__ ? tauriFetch : undefined;
export function createGroqCompletionService(): CompletionService {
	return {
		async complete({ apiKey, model, systemPrompt, userPrompt }) {
			const client = new Groq({
				apiKey,
				dangerouslyAllowBrowser: true,
				fetch: customFetch,
			});
			// Call Groq API
			const { data: completion, error: groqApiError } = await tryAsync({
				try: () =>
					client.chat.completions.create({
						model,
						messages: [
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: userPrompt },
						],
					}),
				catch: (error) => {
					// Check if it's NOT a Groq API error
					if (!(error instanceof Groq.APIError)) {
						// This is an unexpected error type
						throw error;
					}
					// Return the error directly
					return Err(error);
				},
			});

			if (groqApiError) {
				// Error handling follows https://www.npmjs.com/package/groq-sdk#error-handling
				const { status, name, message, error } = groqApiError;

				// 400 - BadRequestError
				if (status === 400) {
					return CompletionServiceErr({
						message:
							message ??
							`对 Groq API 的请求无效。${error?.message ?? ''}`.trim(),
					});
				}

				// 401 - AuthenticationError
				if (status === 401) {
					return CompletionServiceErr({
						message:
							message ??
							'您的 Groq API 密钥似乎无效或已过期。请在设置中更新您的 API 密钥。',
					});
				}

				// 403 - PermissionDeniedError
				if (status === 403) {
					return CompletionServiceErr({
						message:
							message ??
							"您的 Groq 账户无权访问此模型或功能。",
					});
				}

				// 404 - NotFoundError
				if (status === 404) {
					return CompletionServiceErr({
						message:
							message ??
							'在 Groq 上未找到请求的模型。请检查模型名称。',
					});
				}

				// 422 - UnprocessableEntityError
				if (status === 422) {
					return CompletionServiceErr({
						message:
							message ??
							'请求有效,但 Groq 无法处理。请检查您的参数。',
					});
				}

				// 429 - RateLimitError
				if (status === 429) {
					return CompletionServiceErr({
						message: message ?? '已超过 Groq 的请求频率限制。请稍后重试。',
					});
				}

				// >=500 - InternalServerError
				if (status && status >= 500) {
					return CompletionServiceErr({
						message:
							message ??
							`Groq 服务暂时不可用(错误 ${status})。请稍后重试。`,
					});
				}

				// Handle APIConnectionError (no status code)
				if (!status && name === 'APIConnectionError') {
					return CompletionServiceErr({
						message:
							message ??
							'无法连接到 Groq 服务。这可能是网络问题或服务暂时中断。',
					});
				}

				// Catch-all for unexpected errors
				return CompletionServiceErr({
					message: message ?? 'Groq 发生了意外错误。请重试。',
				});
			}

			// Extract the response text
			const responseText = completion.choices.at(0)?.message?.content;
			if (!responseText) {
				return CompletionServiceErr({
					message: 'Groq API 返回了空响应',
				});
			}

			return Ok(responseText);
		},
	};
}

export type GroqCompletionService = ReturnType<
	typeof createGroqCompletionService
>;

export const GroqCompletionServiceLive = createGroqCompletionService();
