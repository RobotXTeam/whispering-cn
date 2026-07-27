import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import OpenAI from 'openai';
import { Err, isErr, Ok, type Result, tryAsync } from 'wellcrafted/result';
import type { CompletionService } from './types';
import { CompletionServiceErr, type CompletionServiceError } from './types';

const customFetch = window.__TAURI_INTERNALS__ ? tauriFetch : undefined;

export type OpenAiCompatibleConfig = {
	/**
	 * Human-readable provider name used in error messages.
	 *
	 * @example 'OpenAI', 'OpenRouter', 'Custom'
	 */
	providerLabel: string;

	/**
	 * Function to determine the baseUrl for each API call.
	 *
	 * This allows each provider to control its endpoint strategy:
	 * - Return undefined to use OpenAI SDK default (https://api.openai.com/v1)
	 * - Return a static string for fixed endpoints (e.g., OpenRouter)
	 * - Extract from params for dynamic endpoints (e.g., Custom provider)
	 *
	 * @example () => undefined  // OpenAI: use SDK default
	 * @example () => 'https://openrouter.ai/api/v1'  // OpenRouter: static URL
	 * @example (params) => params.baseUrl  // Custom: dynamic from params
	 */
	getBaseUrl: (
		params: Parameters<CompletionService['complete']>[0],
	) => string | undefined;

	/**
	 * Optional validation function called before making the API request.
	 *
	 * Use this to validate required parameters specific to your provider.
	 * Return Ok(undefined) if validation passes, or an Err with a
	 * CompletionServiceError if validation fails.
	 *
	 * @example
	 * ```typescript
	 * validateParams: (params) => {
	 *   if (!params.baseUrl) {
	 *     return CompletionServiceErr({
	 *       message: 'Base URL is required',
	 *       context: { status: 400, name: 'MissingBaseUrl' },
	 *       cause: null,
	 *     });
	 *   }
	 *   return Ok(undefined);
	 * }
	 * ```
	 */
	validateParams?: (
		params: Parameters<CompletionService['complete']>[0],
	) => Result<void, CompletionServiceError>;

	/**
	 * HTTP headers to include with every request.
	 *
	 * Useful for provider-specific requirements like referrer headers,
	 * API versioning, or custom authentication schemes.
	 *
	 * @example { 'HTTP-Referer': 'https://myapp.com', 'X-Title': 'MyApp' }
	 */
	defaultHeaders?: Record<string, string>;

	/**
	 * Custom error messages for specific HTTP status codes.
	 *
	 * Allows providers to override default error messages with
	 * provider-specific guidance (e.g., billing issues, service-specific errors).
	 *
	 * @example { 402: 'Insufficient credits. Please add credits to continue.' }
	 */
	statusMessageOverrides?: Partial<Record<number, string>>;
};

/**
 * Creates a completion service that works with any OpenAI-compatible API.
 *
 * This factory function provides a reusable implementation for providers that
 * implement the OpenAI Chat Completions API format. It handles error mapping,
 * connection errors, and response validation.
 *
 * The baseUrl is provided at runtime via the complete() method, allowing each
 * provider to determine its endpoint strategy:
 * - OpenAI: omit baseUrl to use the OpenAI SDK default (https://api.openai.com/v1)
 * - OpenRouter: always pass 'https://openrouter.ai/api/v1'
 * - Custom: pass dynamic baseUrl from user settings/step configuration
 *
 * @param config - Configuration for provider-specific behavior
 * @returns A CompletionService that can be used to generate text completions
 *
 * @example
 * ```typescript
 * // Simple provider (OpenAI uses SDK default)
 * const openai = createOpenAiCompatibleCompletionService({
 *   providerLabel: 'OpenAI',
 * });
 *
 * // Provider with custom headers and error messages
 * const openrouter = createOpenAiCompatibleCompletionService({
 *   providerLabel: 'OpenRouter',
 *   defaultHeaders: {
 *     'HTTP-Referer': 'https://whispering.epicenter.so',
 *     'X-Title': 'Whispering',
 *   },
 *   statusMessageOverrides: {
 *     402: 'Insufficient credits in your OpenRouter account.',
 *   },
 * });
 * ```
 */
export function createOpenAiCompatibleCompletionService(
	config: OpenAiCompatibleConfig,
): CompletionService {
	return {
		async complete(params) {
			// Validate params if validator provided
			if (config.validateParams) {
				const validationResult = config.validateParams(params);
				if (isErr(validationResult)) {
					return validationResult;
				}
			}

			// Determine baseUrl using config function
			const effectiveBaseUrl = config.getBaseUrl(params);

			const client = new OpenAI({
				apiKey: params.apiKey,
				baseURL: effectiveBaseUrl,
				dangerouslyAllowBrowser: true,
				defaultHeaders: config.defaultHeaders,
				fetch: customFetch,
			});

			const { data: completion, error: apiError } = await tryAsync({
				try: () =>
					client.chat.completions.create({
						model: params.model,
						messages: [
							{ role: 'system', content: params.systemPrompt },
							{ role: 'user', content: params.userPrompt },
						],
					}),
				catch: (error) => {
					if (!(error instanceof OpenAI.APIError)) {
						throw error;
					}
					return Err(error);
				},
			});

			if (apiError) {
				const { status, name, message, error } = apiError;

				if (typeof status === 'number') {
					const override = config.statusMessageOverrides?.[status];
					if (override) {
						return CompletionServiceErr({
							message: override,
						});
					}
				}

				if (status === 400) {
					return CompletionServiceErr({
						message:
							message ??
							`对 ${config.providerLabel} API 的请求无效。${error?.message ?? ''}`.trim(),
					});
				}

				if (status === 401) {
					return CompletionServiceErr({
						message:
							message ??
							`您的 ${config.providerLabel} API 密钥似乎无效或已过期。请在设置中更新您的 API 密钥。`,
					});
				}

				if (status === 403) {
					return CompletionServiceErr({
						message:
							message ??
							`您的 ${config.providerLabel} 账户无权访问此模型或功能。`,
					});
				}

				if (status === 404) {
					return CompletionServiceErr({
						message:
							message ??
							`在 ${config.providerLabel} 上未找到请求的模型。请检查模型名称。`,
					});
				}

				if (status === 422) {
					return CompletionServiceErr({
						message:
							message ??
							`请求有效,但 ${config.providerLabel} 无法处理。请检查您的参数。`,
					});
				}

				if (status === 429) {
					return CompletionServiceErr({
						message:
							message ??
							`已超过 ${config.providerLabel} 的请求频率限制。请稍后重试。`,
					});
				}

				if (status && status >= 500) {
					return CompletionServiceErr({
						message:
							message ??
							`${config.providerLabel} 服务暂时不可用(错误 ${status})。请稍后重试。`,
					});
				}

				if (!status && name === 'APIConnectionError') {
					return CompletionServiceErr({
						message:
							message ??
							`无法连接到 ${config.providerLabel} 服务。这可能是网络问题或服务暂时中断。`,
					});
				}

				return CompletionServiceErr({
					message:
						message ??
						`${config.providerLabel} 发生了意外错误。请重试。`,
				});
			}

			const responseText = completion.choices.at(0)?.message?.content;
			if (!responseText) {
				return CompletionServiceErr({
					message: `${config.providerLabel} API 返回了空响应`,
				});
			}

			return Ok(responseText);
		},
	};
}
