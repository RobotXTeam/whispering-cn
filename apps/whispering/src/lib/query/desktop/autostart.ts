import { Ok } from 'wellcrafted/result';
import { defineMutation, defineQuery, queryClient } from '$lib/query/client';
import { WhisperingErr } from '$lib/result';
import { desktopServices } from '$lib/services';

const autostartKeys = {
	all: ['autostart'] as const,
	isEnabled: ['autostart', 'isEnabled'] as const,
	enable: ['autostart', 'enable'] as const,
	disable: ['autostart', 'disable'] as const,
} as const;

const invalidateAutostartState = () =>
	queryClient.invalidateQueries({ queryKey: autostartKeys.isEnabled });

export const autostart = {
	isEnabled: defineQuery({
		queryKey: autostartKeys.isEnabled,
		queryFn: async () => {
			const { data, error } = await desktopServices.autostart.isEnabled();
			if (error) {
				return WhisperingErr({
					title: '❌ 检查自启动状态失败',
					serviceError: error,
				});
			}
			return Ok(data);
		},
		initialData: false,
	}),

	enable: defineMutation({
		mutationKey: autostartKeys.enable,
		mutationFn: async () => {
			const { data, error } = await desktopServices.autostart.enable();
			if (error) {
				return WhisperingErr({
					title: '❌ 启用自启动失败',
					serviceError: error,
				});
			}
			return Ok(data);
		},
		onSettled: invalidateAutostartState,
	}),

	disable: defineMutation({
		mutationKey: autostartKeys.disable,
		mutationFn: async () => {
			const { data, error } = await desktopServices.autostart.disable();
			if (error) {
				return WhisperingErr({
					title: '❌ 禁用自启动失败',
					serviceError: error,
				});
			}
			return Ok(data);
		},
		onSettled: invalidateAutostartState,
	}),
};
