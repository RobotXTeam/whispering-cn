import { migrationDialog } from '$lib/components/MigrationDialog.svelte';
import { rpc } from '$lib/query';

/**
 * Check if IndexedDB has data and show a migration toast if it does.
 * This helps users discover the migration feature and encourages them to migrate legacy data.
 */
export async function checkIndexedDBMigration(): Promise<void> {
	if (!window.__TAURI_INTERNALS__) {
		// Only run in desktop app
		return;
	}

	await migrationDialog.refreshCounts();

	if (migrationDialog.hasIndexedDBData) {
		rpc.notify.info.execute({
			title: '数据库迁移可用',
			description:
				'您在 IndexedDB 中有数据。点击此处迁移到更快的文件系统存储。',
			action: {
				type: 'button',
				label: '查看更新',
				onClick: () => {
					migrationDialog.isOpen = true;
				},
			},
			persist: true,
		});
	}
}
