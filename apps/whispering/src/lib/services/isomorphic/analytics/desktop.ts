import { invoke } from '@tauri-apps/api/core';
import { extractErrorMessage } from 'wellcrafted/error';
import { tryAsync } from 'wellcrafted/result';
import type { AnalyticsService } from './types';
import { AnalyticsServiceErr } from './types';

export function createAnalyticsServiceDesktop(): AnalyticsService {
	return {
		logEvent: async (event) =>
			tryAsync({
				try: async () => {
					const { type, ...properties } = event;
					await invoke<void>('plugin:aptabase|track_event', {
						name: type,
						props: properties,
					});
				},
				catch: (error) =>
					AnalyticsServiceErr({
						message: `通过 Tauri 记录分析事件失败:${extractErrorMessage(error)}`,
					}),
			}),
	};
}
