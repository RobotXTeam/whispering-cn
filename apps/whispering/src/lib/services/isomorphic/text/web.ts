import { extractErrorMessage } from 'wellcrafted/error';
import { Ok, tryAsync } from 'wellcrafted/result';
import type { TextService } from './types';
import { TextServiceErr } from './types';

export function createTextServiceWeb(): TextService {
	return {
		readFromClipboard: () =>
			tryAsync({
				try: async () => {
					const text = await navigator.clipboard.readText();
					return text || null;
				},
				catch: (error) =>
					TextServiceErr({
						message: `使用浏览器剪贴板 API 从剪贴板读取时出错。请重试。 ${extractErrorMessage(error)}`,
					}),
			}),

		copyToClipboard: async (text) => {
			const { error: copyError } = await tryAsync({
				try: () => navigator.clipboard.writeText(text),
				catch: (error) =>
					TextServiceErr({
						message: `使用浏览器剪贴板 API 复制到剪贴板时出错。请重试。 ${extractErrorMessage(error)}`,
					}),
			});

			if (copyError) {
				// Extension fallback code commented out for now
				// Could be re-enabled if extension support is needed
				return Ok(undefined);
			}
			return Ok(undefined);
		},

		writeToCursor: async (text) => {
			// In web browsers, we cannot programmatically paste for security reasons
			// We can copy the text to clipboard but the user must manually paste with Cmd/Ctrl+V
			await navigator.clipboard.writeText(text);
			return TextServiceErr({
				message:
					'文本已复制到剪贴板。出于安全原因,网页浏览器不支持自动粘贴。请使用 Cmd/Ctrl+V 手动粘贴。',
			});
		},

		simulateEnterKeystroke: async () =>
			TextServiceErr({
				message:
					'出于安全原因,网页浏览器不支持模拟按键。',
			}),
	};
}
