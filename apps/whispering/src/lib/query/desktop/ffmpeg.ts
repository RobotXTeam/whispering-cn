import { Ok } from 'wellcrafted/result';
import { defineQuery } from '$lib/query/client';
import { WhisperingErr } from '$lib/result';
import { desktopServices } from '$lib/services';

export const ffmpeg = {
	checkFfmpegInstalled: defineQuery({
		queryKey: ['ffmpeg.checkInstalled'],
		queryFn: async () => {
			const { data, error } = await desktopServices.ffmpeg.checkInstalled();
			if (error) {
				return WhisperingErr({
					title: '❌ 检查 FFmpeg 安装时出错',
					serviceError: error,
				});
			}
			return Ok(data);
		},
	}),
};
