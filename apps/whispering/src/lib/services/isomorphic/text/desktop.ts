import { invoke } from '@tauri-apps/api/core';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { extractErrorMessage } from 'wellcrafted/error';
import { tryAsync } from 'wellcrafted/result';
import type { TextService } from './types';
import { TextServiceErr } from './types';

export function createTextServiceDesktop(): TextService {
	return {
		readFromClipboard: () =>
			tryAsync({
				try: async () => {
					const text = await readText();
					return text ?? null;
				},
				catch: (error) =>
					TextServiceErr({
						message: `使用 Tauri 剪贴板管理器 API 从剪贴板读取时出错。请重试。 ${extractErrorMessage(error)}`,
					}),
			}),

		copyToClipboard: (text) =>
			tryAsync({
				try: () => writeText(text),
				catch: (error) =>
					TextServiceErr({
						message: `使用 Tauri 剪贴板管理器 API 复制到剪贴板时出错。请重试。 ${extractErrorMessage(error)}`,
					}),
			}),

		writeToCursor: async (text) =>
			tryAsync({
				try: () => invoke<void>('write_text', { text }),
				catch: (error) =>
					TextServiceErr({
						message: `写入文本时出错。请尝试使用 Cmd/Ctrl+V 手动粘贴。 ${extractErrorMessage(error)}`,
					}),
			}),

		simulateEnterKeystroke: () =>
			tryAsync({
				try: () => invoke<void>('simulate_enter_keystroke'),
				catch: (error) =>
					TextServiceErr({
						message: `模拟 Enter 键按下时出错。请手动按 Enter 键。 ${extractErrorMessage(error)}`,
					}),
			}),
	};
}
