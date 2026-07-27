import { extractErrorMessage } from 'wellcrafted/error';
import { tryAsync } from 'wellcrafted/result';
import type { DownloadService } from '.';
import { DownloadServiceErr } from './types';

export function createDownloadServiceWeb(): DownloadService {
	return {
		downloadBlob: ({ name, blob }) =>
			tryAsync({
				try: async () => {
					const file = new File([blob], name, { type: blob.type });
					const url = URL.createObjectURL(file);
					const a = document.createElement('a');
					a.href = url;
					a.download = name;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				},
				catch: (error) =>
					DownloadServiceErr({
						message: `在浏览器中保存录音时出错。请重试。 ${extractErrorMessage(error)}`,
					}),
			}),
	};
}
