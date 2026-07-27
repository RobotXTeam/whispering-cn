import { createOpenAiCompatibleCompletionService } from './openai-compatible';

export const OpenRouterCompletionServiceLive =
	createOpenAiCompatibleCompletionService({
		providerLabel: 'OpenRouter',
		getBaseUrl: () => 'https://openrouter.ai/api/v1', // Always use OpenRouter endpoint
		defaultHeaders: {
			'HTTP-Referer': 'https://whispering.epicenter.so',
			'X-Title': 'Whispering',
		},
		statusMessageOverrides: {
			402: '您的 OpenRouter 账户额度不足。请充值后继续使用。',
			502: '模型服务商暂时不可用。如果已配置,OpenRouter 会自动尝试使用备用模型重试。',
			503: 'OpenRouter 暂时不可用。请稍后重试。',
		},
	});

export type OpenRouterCompletionService =
	typeof OpenRouterCompletionServiceLive;
