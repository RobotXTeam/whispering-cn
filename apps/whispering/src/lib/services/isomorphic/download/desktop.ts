import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { extractErrorMessage } from 'wellcrafted/error';
import { Err, Ok, tryAsync } from 'wellcrafted/result';
import { getAudioExtension } from '$lib/services/isomorphic/transcription/utils';
import type { DownloadService } from '.';
import { DownloadServiceErr } from './types';

export function createDownloadServiceDesktop(): DownloadService {
	return {
		downloadBlob: async ({ name, blob }) => {
			const extension = getAudioExtension(blob.type);
			const { data: path, error: saveError } = await tryAsync({
				try: () =>
					save({
						filters: [{ name, extensions: [extension] }],
					}),
				catch: (error) =>
					DownloadServiceErr({
						message: `使用 Tauri 文件系统 API 保存录音时出错。请重试。 ${extractErrorMessage(error)}`,
					}),
			});
			if (saveError) return Err(saveError);
			if (path === null) {
				return DownloadServiceErr({
					message: '请指定保存录音的路径。',
				});
			}
			const { error: writeError } = await tryAsync({
				try: async () => {
					const contents = new Uint8Array(await blob.arrayBuffer());
					await writeFile(path, contents);
				},
				catch: (error) =>
					DownloadServiceErr({
						message: `使用 Tauri 文件系统 API 保存录音时出错。请重试。 ${extractErrorMessage(error)}`,
					}),
			});
			if (writeError) return Err(writeError);
			return Ok(undefined);
		},
	};
}
