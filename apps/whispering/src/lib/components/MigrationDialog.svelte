<script module lang="ts">
	import { createFileSystemDb } from '$lib/services/isomorphic/db/file-system';
	import { createDbServiceWeb } from '$lib/services/isomorphic/db/web';
	import { nanoid } from 'nanoid/non-secure';
	import { Ok, tryAsync, type Result } from 'wellcrafted/result';
	import type {
		Recording,
		RecordingStoredInIndexedDB,
		SerializedAudio,
		Transformation,
		TransformationRun,
	} from '$lib/services/isomorphic/db/models';
	import {
		generateDefaultTransformation,
		generateDefaultTransformationStep,
	} from '$lib/services/isomorphic/db/models';
	import { DownloadServiceLive } from '$lib/services/isomorphic/download';
	import type {
		DbService,
		DbServiceError,
	} from '$lib/services/isomorphic/db/types';
	import { DbServiceErr } from '$lib/services/isomorphic/db/types';

	/**
	 * Result of a migration operation
	 */
	type MigrationResult = {
		total: number;
		succeeded: number;
		failed: number;
		skipped: number;
		duration: number;
	};

	/**
	 * Batch size for processing items (prevents memory issues with large datasets)
	 */
	const BATCH_SIZE = 100;

	/**
	 * Default counts for seeding mock data
	 */
	const MOCK_RECORDING_COUNT = 10;
	const MOCK_TRANSFORMATION_COUNT = 10;
	const MOCK_RUN_COUNT = 10;

	const testData = createMigrationTestData();
	const migrationDialog = createMigrationDialog();

	export { migrationDialog };

	function createMigrationTestData() {
		/**
		 * Generate a mock recording with realistic data.
		 */
		function _generateMockRecording({
			index,
			baseTimestamp,
		}: {
			index: number;
			baseTimestamp: Date;
		}): RecordingStoredInIndexedDB {
			// Vary timestamps across last 6 months
			const daysAgo = Math.floor(Math.random() * 180);
			const timestamp = new Date(baseTimestamp);
			timestamp.setDate(timestamp.getDate() - daysAgo);
			const timestampStr = timestamp.toISOString();

			// Vary transcription status
			const statuses = [
				'DONE',
				'DONE',
				'DONE',
				'UNPROCESSED',
				'FAILED',
			] as const;
			const transcriptionStatus = statuses[index % statuses.length]!;

			// Generate varied transcribed text lengths
			const textLengths = [
				'Short recording text.',
				'This is a medium-length recording with a bit more content to transcribe and process.',
				`This is a longer recording transcript. It contains multiple sentences and paragraphs of content. ${Array(10).fill('Lorem ipsum dolor sit amet, consectetur adipiscing elit.').join(' ')}`,
			];
			const transcribedText = textLengths[index % textLengths.length]!;

			const id = nanoid();
			const now = new Date().toISOString();

			return {
				id,
				title: `Recording ${index + 1}`,
				subtitle: `Mock recording #${index + 1} for testing`,
				timestamp: timestampStr,
				createdAt: now,
				updatedAt: now,
				transcribedText,
				transcriptionStatus,
				serializedAudio: _generateMockAudio(),
			};
		}

		/**
		 * Generate a small mock audio ArrayBuffer (~1KB).
		 * This creates a minimal valid audio buffer for testing purposes.
		 */
		function _generateMockAudio(): SerializedAudio {
			// Create a small buffer (1024 bytes = 1KB)
			const size = 1024;
			const buffer = new ArrayBuffer(size);
			const view = new Uint8Array(buffer);

			// Fill with some pseudo-random data to simulate audio
			for (let i = 0; i < size; i++) {
				view[i] = Math.floor(Math.random() * 256);
			}

			return {
				arrayBuffer: buffer,
				blobType: 'audio/webm',
			};
		}

		/**
		 * Generate a mock transformation.
		 */
		function _generateMockTransformation({
			index,
		}: {
			index: number;
		}): Transformation {
			const transformation = generateDefaultTransformation();

			// Vary between different transformation types
			const types = [
				{
					title: 'Summarize',
					description: 'Create a summary of the transcript',
				},
				{
					title: 'Translate to Spanish',
					description: 'Translate the text to Spanish',
				},
				{
					title: 'Extract Action Items',
					description: 'Extract action items from the meeting',
				},
				{
					title: 'Correct Grammar',
					description: 'Fix grammar and spelling errors',
				},
			];

			const type = types[index % types.length]!;

			transformation.title = `${type.title} ${index + 1}`;
			transformation.description = type.description;

			// Add 1-3 steps
			const numSteps = (index % 3) + 1;
			for (let i = 0; i < numSteps; i++) {
				const step = generateDefaultTransformationStep();
				step.type = i % 2 === 0 ? 'prompt_transform' : 'find_replace';

				if (step.type === 'prompt_transform') {
					step['prompt_transform.systemPromptTemplate'] =
						'You are a helpful assistant.';
					step['prompt_transform.userPromptTemplate'] =
						`${type.description} for the following text: {{input}}`;
				} else {
					step['find_replace.findText'] = 'um';
					step['find_replace.replaceText'] = '';
					step['find_replace.useRegex'] = false;
				}

				transformation.steps.push(step);
			}

			return transformation;
		}

		/**
		 * Generate a mock transformation run.
		 */
		function _generateMockTransformationRun({
			index,
			recordingIds,
			transformationIds,
		}: {
			index: number;
			recordingIds: string[];
			transformationIds: string[];
		}): TransformationRun {
			const recordingId = recordingIds[index % recordingIds.length]!;
			const transformationId =
				transformationIds[index % transformationIds.length]!;

			const id = nanoid();
			const startedAt = new Date(
				Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
			).toISOString();

			// Vary status
			const statuses = [
				'completed',
				'completed',
				'completed',
				'failed',
				'running',
			] as const;
			const status = statuses[index % statuses.length];

			const input = `Input text for transformation run ${index + 1}. This is the snapshot of the recording at the time of transformation.`;

			const stepRuns = [];

			// Add 1-2 step runs
			const numSteps = (index % 2) + 1;
			for (let i = 0; i < numSteps; i++) {
				const stepId = nanoid();
				const stepStartedAt = new Date(
					new Date(startedAt).getTime() + i * 1000,
				).toISOString();

				if (i < numSteps - 1 || status === 'completed') {
					// Completed step
					stepRuns.push({
						id: nanoid(),
						stepId,
						startedAt: stepStartedAt,
						completedAt: new Date(
							new Date(stepStartedAt).getTime() + 500,
						).toISOString(),
						status: 'completed' as const,
						input: i === 0 ? input : `Output from step ${i}`,
						output: `Output from step ${i + 1}`,
					});
				} else if (status === 'failed') {
					// Failed step
					stepRuns.push({
						id: nanoid(),
						stepId,
						startedAt: stepStartedAt,
						completedAt: new Date(
							new Date(stepStartedAt).getTime() + 500,
						).toISOString(),
						status: 'failed' as const,
						input: i === 0 ? input : `Output from step ${i}`,
						error: 'Mock error: API rate limit exceeded',
					});
				} else {
					// Running step
					stepRuns.push({
						id: nanoid(),
						stepId,
						startedAt: stepStartedAt,
						completedAt: null,
						status: 'running' as const,
						input: i === 0 ? input : `Output from step ${i}`,
					});
				}
			}

			if (status === 'completed') {
				return {
					id,
					transformationId,
					recordingId,
					startedAt,
					completedAt: new Date(
						new Date(startedAt).getTime() + numSteps * 1000,
					).toISOString(),
					status: 'completed',
					input,
					stepRuns,
					output: stepRuns[stepRuns.length - 1]?.output || input,
				};
			}

			if (status === 'failed') {
				return {
					id,
					transformationId,
					recordingId,
					startedAt,
					completedAt: new Date(
						new Date(startedAt).getTime() + numSteps * 1000,
					).toISOString(),
					status: 'failed',
					input,
					stepRuns,
					error: 'Mock error: Transformation failed',
				};
			}

			// Running
			return {
				id,
				transformationId,
				recordingId,
				startedAt,
				completedAt: null,
				status: 'running',
				input,
				stepRuns,
			};
		}

		return {
			/**
			 * Seed IndexedDB with mock data for testing migration performance.
			 *
			 * @param options Configuration for seeding
			 * @param options.recordingCount Number of recordings to create (default: 5000)
			 * @param options.transformationCount Number of transformations to create (default: 50)
			 * @param options.runCount Number of transformation runs to create (default: 500)
			 * @returns Promise with counts of created items
			 */
			async seedIndexedDB({
				recordingCount,
				transformationCount,
				runCount,
				onProgress,
			}: {
				recordingCount: number;
				transformationCount: number;
				runCount: number;
				onProgress: (message: string) => void;
			}): Promise<{
				recordings: number;
				transformations: number;
				runs: number;
			}> {
				const startTime = performance.now();
				onProgress(
					`开始用 ${recordingCount} 条录音记录、${transformationCount} 个转换和 ${runCount} 次运行填充 IndexedDB...`,
				);

				// Use the DbService interface
				const db = createDbServiceWeb({ DownloadService: DownloadServiceLive });

				const baseTimestamp = new Date();

				// Generate recordings
				onProgress(`生成 ${recordingCount} 条模拟录音记录...`);
				const recordings: RecordingStoredInIndexedDB[] = [];
				for (let i = 0; i < recordingCount; i++) {
					recordings.push(_generateMockRecording({ index: i, baseTimestamp }));

					if ((i + 1) % 1000 === 0) {
						onProgress(`已生成 ${i + 1}/${recordingCount} 条录音记录`);
					}
				}

				// Convert recordings to format expected by create() method
				const recordingParams = recordings.map((rec) => {
					const { serializedAudio, ...recording } = rec as Recording & {
						serializedAudio: SerializedAudio;
					};
					return {
						recording: recording as Recording,
						audio: new Blob([serializedAudio.arrayBuffer], {
							type: serializedAudio.blobType,
						}),
					};
				});

				// Bulk insert recordings
				onProgress('正在将录音记录插入 IndexedDB...');
				const { error: recordingsError } =
					await db.recordings.create(recordingParams);
				if (recordingsError) {
					throw new Error(
						`插入录音记录失败:${recordingsError.message}`,
					);
				}
				onProgress(`✓ 已插入 ${recordings.length} 条录音记录`);

				const recordingIds = recordings.map((r) => r.id);

				// Generate transformations
				onProgress(`生成 ${transformationCount} 个模拟转换...`);
				const transformations: Transformation[] = [];
				for (let i = 0; i < transformationCount; i++) {
					transformations.push(_generateMockTransformation({ index: i }));
				}

				// Bulk insert transformations
				onProgress('正在将转换插入 IndexedDB...');
				const { error: transformationsError } =
					await db.transformations.create(transformations);
				if (transformationsError) {
					throw new Error(
						`插入转换失败:${transformationsError.message}`,
					);
				}
				onProgress(`✓ 已插入 ${transformations.length} 个转换`);

				const transformationIds = transformations.map((t) => t.id);

				// Generate transformation runs
				onProgress(`生成 ${runCount} 次模拟转换运行...`);
				const runs: TransformationRun[] = [];
				for (let i = 0; i < runCount; i++) {
					runs.push(
						_generateMockTransformationRun({
							index: i,
							recordingIds,
							transformationIds,
						}),
					);

					if ((i + 1) % 100 === 0) {
						onProgress(`已生成 ${i + 1}/${runCount} 次运行`);
					}
				}

				// Bulk insert runs
				onProgress('正在将转换运行插入 IndexedDB...');
				const { error: runsError } = await db.runs.create(runs);
				if (runsError) {
					throw new Error(
						`插入转换运行失败:${runsError.message}`,
					);
				}
				onProgress(`✓ 已插入 ${runs.length} 次转换运行`);

				const endTime = performance.now();
				const duration = ((endTime - startTime) / 1000).toFixed(2);

				onProgress(`✓ 填充完成,用时 ${duration}s!`);
				onProgress(`  - ${recordings.length} 条录音记录`);
				onProgress(`  - ${transformations.length} 个转换`);
				onProgress(`  - ${runs.length} 次转换运行`);

				return {
					recordings: recordings.length,
					transformations: transformations.length,
					runs: runs.length,
				};
			},

			/**
			 * Clear all data from IndexedDB (useful for testing).
			 */
			async clearIndexedDB({
				onProgress,
			}: {
				onProgress: (message: string) => void;
			}): Promise<void> {
				onProgress('正在清空 IndexedDB...');

				const db = createDbServiceWeb({ DownloadService: DownloadServiceLive });

				// Clear all tables in parallel
				const [recordingsResult, transformationsResult, runsResult] =
					await Promise.all([
						db.recordings.clear(),
						db.transformations.clear(),
						db.runs.clear(),
					]);

				// Check for errors
				if (recordingsResult.error) {
					throw new Error(
						`清空录音记录失败:${recordingsResult.error.message}`,
					);
				}
				onProgress('✓ 已清空录音记录');

				if (transformationsResult.error) {
					throw new Error(
						`清空转换失败:${transformationsResult.error.message}`,
					);
				}
				onProgress('✓ 已清空转换');

				if (runsResult.error) {
					throw new Error(
						`清空转换运行失败:${runsResult.error.message}`,
					);
				}
				onProgress('✓ 已清空转换运行');

				onProgress('✓ IndexedDB 已成功清空');
			},
		};
	}

	function createMigrationDialog() {
		let isOpen = $state(false);
		let isRunning = $state(false);
		let logs = $state<string[]>([]);
		let counts = $state<{
			indexedDb: { recordings: number; transformations: number; runs: number };
			fileSystem: { recordings: number; transformations: number; runs: number };
		} | null>(null);
		let recordingsResult = $state<MigrationResult | null>(null);
		let transformationsResult = $state<MigrationResult | null>(null);
		let runsResult = $state<MigrationResult | null>(null);
		let isSeeding = $state(false);
		let isClearing = $state(false);

		const fileSystemDb = createFileSystemDb();
		const indexedDb = createDbServiceWeb({
			DownloadService: DownloadServiceLive,
		});

		// Migration helper functions (private to factory)
		/**
		 * Migrate recordings between IndexedDB and file system.
		 * Processes items in batches of 100 to prevent memory issues.
		 *
		 * @returns Result with counts and timing
		 */
		async function _migrateRecordings({
			indexedDb,
			fileSystemDb,
			onProgress,
		}: {
			indexedDb: DbService;
			fileSystemDb: DbService;
			onProgress: (message: string) => void;
		}): Promise<Result<MigrationResult, DbServiceError>> {
			const startTime = performance.now();

			return tryAsync({
				try: async () => {
					onProgress('[Migration] 开始录音记录迁移(IDB → FS)...');

					// Get all recordings from source
					const { data: recordings, error: getError } =
						await indexedDb.recordings.getAll();

					if (getError) {
						throw getError;
					}

					if (!recordings || recordings.length === 0) {
						onProgress('[Migration] 没有录音记录需要迁移');
						return {
							total: 0,
							succeeded: 0,
							failed: 0,
							skipped: 0,
							duration: (performance.now() - startTime) / 1000,
						};
					}

					const total = recordings.length;
					let succeeded = 0;
					let failed = 0;
					let skipped = 0;

					onProgress(`[Migration] 在 IndexedDB 中找到 ${total} 条录音记录`);
					onProgress(`[Migration] 分批处理,每批 ${BATCH_SIZE} 条...`);

					// Process in batches
					for (let i = 0; i < recordings.length; i += BATCH_SIZE) {
						const batch = recordings.slice(i, i + BATCH_SIZE);
						const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
						const totalBatches = Math.ceil(recordings.length / BATCH_SIZE);

						onProgress(
							`[Migration] 正在处理第 ${batchNumber}/${totalBatches} 批(共 ${batch.length} 项)...`,
						);

						for (const recording of batch) {
							// Check if already exists in destination
							const { data: existing } = await fileSystemDb.recordings.getById(
								recording.id,
							);

							if (existing) {
								skipped++;

								// Delete from IndexedDB since it already exists in file system
								const { error: deleteError } =
									await indexedDb.recordings.delete(recording);

								if (deleteError) {
									onProgress(
										`[Migration] ⚠️  警告:无法从 IndexedDB 删除跳过的录音记录 ${recording.id}`,
									);
								} else {
									onProgress(
										`[Migration] ✓ 已从 IndexedDB 删除跳过的录音记录 ${recording.id}`,
									);
								}

								continue;
							}

							// Get audio blob from IndexedDB
							const { data: audio, error: audioError } =
								await indexedDb.recordings.getAudioBlob(recording.id);

							if (audioError || !audio) {
								onProgress(
									`[Migration] ⚠️  无法获取录音记录 ${recording.id} 的音频`,
								);
								failed++;
								continue;
							}

							// Create in file system
							const { error: createError } =
								await fileSystemDb.recordings.create({
									recording,
									audio,
								});

							if (createError) {
								onProgress(
									`[Migration] ⚠️  无法在文件系统中创建录音记录 ${recording.id}`,
								);
								failed++;
								continue;
							}

							// Delete from IndexedDB after successful migration
							const { error: deleteError } =
								await indexedDb.recordings.delete(recording);

							if (deleteError) {
								onProgress(
									`[Migration] ⚠️  警告:迁移后无法从 IndexedDB 删除录音记录 ${recording.id}`,
								);
							} else {
								onProgress(
									`[Migration] ✓ 已从 IndexedDB 删除录音记录 ${recording.id}`,
								);
							}

							// Success!
							succeeded++;
						}

						// Log batch completion
						const processed = Math.min(i + BATCH_SIZE, recordings.length);
						onProgress(
							`[Migration] 进度:已处理 ${processed}/${total}(成功 ${succeeded},失败 ${failed},跳过 ${skipped})`,
						);
					}

					const duration = (performance.now() - startTime) / 1000;
					const successRate = ((succeeded / total) * 100).toFixed(1);

					onProgress('[Migration] ==========================================');
					onProgress(
						`[Migration] 录音记录迁移完成,用时 ${duration.toFixed(2)}s`,
					);
					onProgress(
						`[Migration] 总数:${total} | 成功:${succeeded} | 失败:${failed} | 跳过:${skipped}`,
					);
					onProgress(`[Migration] 成功率:${successRate}%`);
					onProgress('[Migration] ==========================================');

					return {
						total,
						succeeded,
						failed,
						skipped,
						duration,
					};
				},
				catch: (error) => {
					onProgress(
						`[Migration] ❌ 错误:${error instanceof Error ? error.message : String(error)}`,
					);
					throw DbServiceErr({
						message: '录音记录迁移失败',
					});
				},
			});
		}

		/**
		 * Migrate transformations between IndexedDB and file system.
		 * Processes items in batches of 100 to prevent memory issues.
		 */
		async function _migrateTransformations({
			indexedDb,
			fileSystemDb,
			onProgress,
		}: {
			indexedDb: DbService;
			fileSystemDb: DbService;
			onProgress: (message: string) => void;
		}): Promise<Result<MigrationResult, DbServiceError>> {
			const startTime = performance.now();

			return tryAsync({
				try: async () => {
					onProgress(
						'[Migration] 开始转换迁移(IDB → FS)...',
					);

					// Get all transformations from source
					const { data: transformations, error: getError } =
						await indexedDb.transformations.getAll();

					if (getError) {
						throw getError;
					}

					if (!transformations || transformations.length === 0) {
						onProgress('[Migration] 没有转换需要迁移');
						return {
							total: 0,
							succeeded: 0,
							failed: 0,
							skipped: 0,
							duration: (performance.now() - startTime) / 1000,
						};
					}

					const total = transformations.length;
					let succeeded = 0;
					let failed = 0;
					let skipped = 0;

					onProgress(`[Migration] 在 IndexedDB 中找到 ${total} 个转换`);
					onProgress(`[Migration] 分批处理,每批 ${BATCH_SIZE} 条...`);

					// Process in batches
					for (let i = 0; i < transformations.length; i += BATCH_SIZE) {
						const batch = transformations.slice(i, i + BATCH_SIZE);
						const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
						const totalBatches = Math.ceil(transformations.length / BATCH_SIZE);

						onProgress(
							`[Migration] 正在处理第 ${batchNumber}/${totalBatches} 批(共 ${batch.length} 项)...`,
						);

						for (const transformation of batch) {
							// Check if already exists in destination
							const { data: existing } =
								await fileSystemDb.transformations.getById(transformation.id);

							if (existing) {
								skipped++;

								// Delete from IndexedDB since it already exists in file system
								const { error: deleteError } =
									await indexedDb.transformations.delete(transformation);

								if (deleteError) {
									onProgress(
										`[Migration] ⚠️  警告:无法从 IndexedDB 删除跳过的转换 ${transformation.id}`,
									);
								} else {
									onProgress(
										`[Migration] ✓ 已从 IndexedDB 删除跳过的转换 ${transformation.id}`,
									);
								}

								continue;
							}

							// Create in file system
							const { error: createError } =
								await fileSystemDb.transformations.create(transformation);

							if (createError) {
								onProgress(
									`[Migration] ⚠️  无法在文件系统中创建转换 ${transformation.id}`,
								);
								failed++;
								continue;
							}

							// Delete from IndexedDB after successful migration
							const { error: deleteError } =
								await indexedDb.transformations.delete(transformation);

							if (deleteError) {
								onProgress(
									`[Migration] ⚠️  警告:迁移后无法从 IndexedDB 删除转换 ${transformation.id}`,
								);
							} else {
								onProgress(
									`[Migration] ✓ 已从 IndexedDB 删除转换 ${transformation.id}`,
								);
							}

							// Success!
							succeeded++;
						}

						// Log batch completion
						const processed = Math.min(i + BATCH_SIZE, transformations.length);
						onProgress(
							`[Migration] 进度:已处理 ${processed}/${total}(成功 ${succeeded},失败 ${failed},跳过 ${skipped})`,
						);
					}

					const duration = (performance.now() - startTime) / 1000;
					const successRate = ((succeeded / total) * 100).toFixed(1);

					onProgress('[Migration] ==========================================');
					onProgress(
						`[Migration] 转换迁移完成,用时 ${duration.toFixed(2)}s`,
					);
					onProgress(
						`[Migration] 总数:${total} | 成功:${succeeded} | 失败:${failed} | 跳过:${skipped}`,
					);
					onProgress(`[Migration] 成功率:${successRate}%`);
					onProgress('[Migration] ==========================================');

					return {
						total,
						succeeded,
						failed,
						skipped,
						duration,
					};
				},
				catch: (error) => {
					onProgress(
						`[Migration] ❌ 错误:${error instanceof Error ? error.message : String(error)}`,
					);
					throw DbServiceErr({
						message: '转换迁移失败',
					});
				},
			});
		}

		/**
		 * Migrate transformation runs between IndexedDB and file system.
		 * Processes items in batches of 100 to prevent memory issues.
		 */
		async function _migrateTransformationRuns({
			indexedDb,
			fileSystemDb,
			onProgress,
		}: {
			indexedDb: DbService;
			fileSystemDb: DbService;
			onProgress: (message: string) => void;
		}): Promise<Result<MigrationResult, DbServiceError>> {
			const startTime = performance.now();

			return tryAsync({
				try: async () => {
					onProgress(
						'[Migration] 开始转换运行迁移(IDB → FS)...',
					);

					// Get all runs from source
					const { data: runs, error: getError } = await indexedDb.runs.getAll();

					if (getError) {
						throw getError;
					}

					if (!runs || runs.length === 0) {
						onProgress('[Migration] 没有转换运行需要迁移');
						return {
							total: 0,
							succeeded: 0,
							failed: 0,
							skipped: 0,
							duration: (performance.now() - startTime) / 1000,
						};
					}

					const total = runs.length;
					let succeeded = 0;
					let failed = 0;
					let skipped = 0;

					onProgress(
						`[Migration] 在 IndexedDB 中找到 ${total} 次转换运行`,
					);
					onProgress(`[Migration] 分批处理,每批 ${BATCH_SIZE} 条...`);

					// Process in batches
					for (let i = 0; i < runs.length; i += BATCH_SIZE) {
						const batch = runs.slice(i, i + BATCH_SIZE);
						const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
						const totalBatches = Math.ceil(runs.length / BATCH_SIZE);

						onProgress(
							`[Migration] 正在处理第 ${batchNumber}/${totalBatches} 批(共 ${batch.length} 项)...`,
						);

						for (const run of batch) {
							// Check if already exists in destination
							const { data: existing } = await fileSystemDb.runs.getById(
								run.id,
							);

							if (existing) {
								skipped++;

								// Delete from IndexedDB since it already exists in file system
								const { error: deleteError } = await indexedDb.runs.delete(run);

								if (deleteError) {
									onProgress(
										`[Migration] ⚠️  警告:无法从 IndexedDB 删除跳过的转换运行 ${run.id}`,
									);
								} else {
									onProgress(
										`[Migration] ✓ 已从 IndexedDB 删除跳过的转换运行 ${run.id}`,
									);
								}

								continue;
							}

							// Create in file system
							const { error: createError } =
								await fileSystemDb.runs.create(run);

							if (createError) {
								onProgress(
									`[Migration] ⚠️  无法在文件系统中创建转换运行 ${run.id}`,
								);
								failed++;
								continue;
							}

							// Delete from IndexedDB after successful migration
							const { error: deleteError } = await indexedDb.runs.delete(run);

							if (deleteError) {
								onProgress(
									`[Migration] ⚠️  警告:迁移后无法从 IndexedDB 删除转换运行 ${run.id}`,
								);
							} else {
								onProgress(
									`[Migration] ✓ 已从 IndexedDB 删除转换运行 ${run.id}`,
								);
							}

							// Success!
							succeeded++;
						}

						// Log batch completion
						const processed = Math.min(i + BATCH_SIZE, runs.length);
						onProgress(
							`[Migration] 进度:已处理 ${processed}/${total}(成功 ${succeeded},失败 ${failed},跳过 ${skipped})`,
						);
					}

					const duration = (performance.now() - startTime) / 1000;
					const successRate = ((succeeded / total) * 100).toFixed(1);

					onProgress('[Migration] ==========================================');
					onProgress(
						`[Migration] 转换运行迁移完成,用时 ${duration.toFixed(2)}s`,
					);
					onProgress(
						`[Migration] 总数:${total} | 成功:${succeeded} | 失败:${failed} | 跳过:${skipped}`,
					);
					onProgress(`[Migration] 成功率:${successRate}%`);
					onProgress('[Migration] ==========================================');

					return {
						total,
						succeeded,
						failed,
						skipped,
						duration,
					};
				},
				catch: (error) => {
					onProgress(
						`[Migration] ❌ 错误:${error instanceof Error ? error.message : String(error)}`,
					);
					throw DbServiceErr({
						message: '转换运行迁移失败',
					});
				},
			});
		}

		/**
		 * Get counts of items in both storage systems.
		 * Useful for showing users what data exists where.
		 */
		async function _getMigrationCounts(
			indexedDb: DbService,
			fileSystemDb: DbService,
		): Promise<
			Result<
				{
					indexedDb: {
						recordings: number;
						transformations: number;
						runs: number;
					};
					fileSystem: {
						recordings: number;
						transformations: number;
						runs: number;
					};
				},
				DbServiceError
			>
		> {
			return tryAsync({
				try: async () => {
					// Get IndexedDB counts
					const [idbRecordings, idbTransformations, idbRuns] =
						await Promise.all([
							indexedDb.recordings.getCount(),
							indexedDb.transformations.getCount(),
							indexedDb.runs.getCount(),
						]);

					// Get File System counts
					const [fsRecordings, fsTransformations, fsRuns] = await Promise.all([
						fileSystemDb.recordings.getCount(),
						fileSystemDb.transformations.getCount(),
						fileSystemDb.runs.getCount(),
					]);

					return {
						indexedDb: {
							recordings: idbRecordings.data ?? 0,
							transformations: idbTransformations.data ?? 0,
							runs: idbRuns.data ?? 0,
						},
						fileSystem: {
							recordings: fsRecordings.data ?? 0,
							transformations: fsTransformations.data ?? 0,
							runs: fsRuns.data ?? 0,
						},
					};
				},
				catch: (error) => {
					throw DbServiceErr({
						message: '获取迁移计数失败',
					});
				},
			});
		}

		function _addLog(message: string) {
			logs.push(message);
		}

		function _clearLogs() {
			logs = [];
		}

		async function refreshCounts() {
			_addLog('[Counts] 正在从两个系统加载项目计数...');

			const { data, error } = await _getMigrationCounts(
				indexedDb,
				fileSystemDb,
			);

			if (error) {
				_addLog(`[Counts] ❌ 错误:${error.message}`);
				return;
			}

			counts = data;
			_addLog(
				`[Counts] IndexedDB:${data.indexedDb.recordings} 条录音记录,${data.indexedDb.transformations} 个转换,${data.indexedDb.runs} 次运行`,
			);
			_addLog(
				`[Counts] 文件系统:${data.fileSystem.recordings} 条录音记录,${data.fileSystem.transformations} 个转换,${data.fileSystem.runs} 次运行`,
			);
		}

		return {
			get isOpen() {
				return isOpen;
			},
			set isOpen(value: boolean) {
				isOpen = value;
			},
			openDialog() {
				isOpen = true;
			},
			get hasIndexedDBData() {
				return counts
					? counts.indexedDb.recordings > 0 ||
							counts.indexedDb.transformations > 0 ||
							counts.indexedDb.runs > 0
					: false;
			},
			/**
			 * Refresh and display item counts from both IndexedDB and File System.
			 * Updates the counts state which is used to determine if migration is needed.
			 * Logs progress messages to the migration log.
			 */
			refreshCounts,
			get isRunning() {
				return isRunning;
			},
			get logs() {
				return logs;
			},
			get counts() {
				return counts;
			},
			get recordingsResult() {
				return recordingsResult;
			},
			get transformationsResult() {
				return transformationsResult;
			},
			get runsResult() {
				return runsResult;
			},
			async startMigration() {
				if (isRunning) return;

				isRunning = true;
				_clearLogs();
				recordingsResult = null;
				transformationsResult = null;
				runsResult = null;

				_addLog('[Migration] 开始迁移流程...');
				_addLog('[Migration] 方向:IndexedDB → 文件系统');

				// Migrate recordings
				const recordingsMigration = await _migrateRecordings({
					indexedDb,
					fileSystemDb,
					onProgress: _addLog,
				});
				if (recordingsMigration.error) {
					_addLog(
						`[Migration] ❌ 录音记录迁移失败:${recordingsMigration.error.message}`,
					);
				} else {
					recordingsResult = recordingsMigration.data;
				}

				// Migrate transformations
				const transformationsMigration = await _migrateTransformations({
					indexedDb,
					fileSystemDb,
					onProgress: _addLog,
				});
				if (transformationsMigration.error) {
					_addLog(
						`[Migration] ❌ 转换迁移失败:${transformationsMigration.error.message}`,
					);
				} else {
					transformationsResult = transformationsMigration.data;
				}

				// Migrate transformation runs
				const runsMigration = await _migrateTransformationRuns({
					indexedDb,
					fileSystemDb,
					onProgress: _addLog,
				});
				if (runsMigration.error) {
					_addLog(
						`[Migration] ❌ 运行迁移失败:${runsMigration.error.message}`,
					);
				} else {
					runsResult = runsMigration.data;
				}

				await refreshCounts();
				isRunning = false;
				_addLog('[Migration] 迁移流程完成!');
			},
			get isSeeding() {
				return isSeeding;
			},
			async seedMockData() {
				if (isSeeding) return;

				isSeeding = true;
				_clearLogs();
				_addLog('[Seed] 开始填充模拟数据...');

				await tryAsync({
					try: async () => {
						const result = await testData.seedIndexedDB({
							recordingCount: MOCK_RECORDING_COUNT,
							transformationCount: MOCK_TRANSFORMATION_COUNT,
							runCount: MOCK_RUN_COUNT,
							onProgress: _addLog,
						});

						_addLog(
							`[Seed] ✅ 已填充 ${result.recordings} 条录音记录、${result.transformations} 个转换、${result.runs} 次运行`,
						);

						await refreshCounts();
					},
					catch: (error) => {
						_addLog(
							`[Seed] ❌ 错误:${error instanceof Error ? error.message : String(error)}`,
						);
						return Ok(undefined);
					},
				});

				isSeeding = false;
			},
			get isClearing() {
				return isClearing;
			},
			async clearIndexedDB() {
				if (isClearing) return;

				isClearing = true;
				_clearLogs();
				_addLog('[Clear] 正在清空 IndexedDB...');

				await tryAsync({
					try: async () => {
						await testData.clearIndexedDB({ onProgress: _addLog });

						_addLog('[Clear] ✅ IndexedDB 已清空');
						await refreshCounts();
					},
					catch: (error) => {
						_addLog(
							`[Clear] ❌ 错误:${error instanceof Error ? error.message : String(error)}`,
						);
						return Ok(undefined);
					},
				});

				isClearing = false;
			},
		};
	}
</script>

<script lang="ts">
	import { Button } from '@epicenter/ui/button';
	import * as Dialog from '@epicenter/ui/dialog';
	import type { Snippet } from 'svelte';

	type TriggerProps = {
		props: Record<string, unknown>;
	};

	let { trigger }: { trigger?: Snippet<[TriggerProps]> } = $props();

	let logsContainer = $state<HTMLDivElement | null>(null);

	// Auto-scroll logs to bottom
	$effect(() => {
		if (logsContainer && migrationDialog.logs.length > 0) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});
</script>

<Dialog.Root
	bind:open={migrationDialog.isOpen}
	onOpenChange={(open) => {
		if (open) {
			migrationDialog.refreshCounts();
		}
	}}
>
	{#if trigger}
		<Dialog.Trigger>
			{#snippet child({ props })}
				{@render trigger({ props })}
			{/snippet}
		</Dialog.Trigger>
	{/if}
	<Dialog.Content class="max-h-[90vh] max-w-3xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>数据库迁移管理器</Dialog.Title>
			<Dialog.Description>
				将数据从 IndexedDB 迁移至文件系统存储。这能带来更快的性能和更好的数据可移植性。
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6">
			<!-- Counts Display -->
			{#if migrationDialog.counts}
				<div class="rounded-lg border p-4">
					<h3 class="mb-3 text-sm font-semibold">当前项目数量</h3>
					<div class="grid grid-cols-2 gap-4 text-sm">
						<div>
							<p class="font-medium">IndexedDB:</p>
							<ul class="ml-4 list-disc text-muted-foreground">
								<li>
									{migrationDialog.counts.indexedDb.recordings} 条录音记录
								</li>
								<li>
									{migrationDialog.counts.indexedDb.transformations} 个转换
								</li>
								<li>{migrationDialog.counts.indexedDb.runs} 次运行</li>
							</ul>
						</div>
						<div>
							<p class="font-medium">文件系统:</p>
							<ul class="ml-4 list-disc text-muted-foreground">
								<li>
									{migrationDialog.counts.fileSystem.recordings} 条录音记录
								</li>
								<li>
									{migrationDialog.counts.fileSystem.transformations} 个转换
								</li>
								<li>{migrationDialog.counts.fileSystem.runs} 次运行</li>
							</ul>
						</div>
					</div>
				</div>
			{/if}

			{#if migrationDialog.hasIndexedDBData}
				<Button
					onclick={migrationDialog.startMigration}
					disabled={migrationDialog.isRunning}
					class="w-full"
				>
					{migrationDialog.isRunning ? '迁移中...' : '开始迁移'}
				</Button>
			{/if}

			<!-- Logs Section -->
			{#if migrationDialog.logs.length > 0}
				<div class="space-y-2">
					<h3 class="text-sm font-semibold">迁移日志</h3>
					<div
						bind:this={logsContainer}
						class="max-h-64 overflow-y-auto rounded-lg border bg-muted p-3 font-mono text-xs"
					>
						{#each migrationDialog.logs as log}
							<div class="mb-1">{log}</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Results Section -->
			{#if migrationDialog.recordingsResult || migrationDialog.transformationsResult || migrationDialog.runsResult}
				<div class="rounded-lg border p-4">
					<h3 class="mb-3 text-sm font-semibold">迁移结果</h3>
					<div class="space-y-2 text-sm">
						{#if migrationDialog.recordingsResult}
							{@const r = migrationDialog.recordingsResult}
							<div>
								<p class="font-medium">录音记录:</p>
								<p class="text-muted-foreground">
									总数:{r.total} | 成功:{r.succeeded} | 失败:{r.failed}
									| 跳过:{r.skipped} | 用时:{r.duration.toFixed(2)}s
								</p>
							</div>
						{/if}
						{#if migrationDialog.transformationsResult}
							{@const t = migrationDialog.transformationsResult}
							<div>
								<p class="font-medium">转换:</p>
								<p class="text-muted-foreground">
									总数:{t.total} | 成功:{t.succeeded} | 失败:{t.failed}
									| 跳过:{t.skipped} | 用时:{t.duration.toFixed(2)}s
								</p>
							</div>
						{/if}
						{#if migrationDialog.runsResult}
							{@const r = migrationDialog.runsResult}
							<div>
								<p class="font-medium">转换运行:</p>
								<p class="text-muted-foreground">
									总数:{r.total} | 成功:{r.succeeded} | 失败:{r.failed}
									| 跳过:{r.skipped} | 用时:{r.duration.toFixed(2)}s
								</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Dev-Only Seed Section -->
			{#if import.meta.env.DEV}
				<div
					class="rounded-lg border border-dashed border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-950"
				>
					<h3
						class="mb-3 text-sm font-semibold text-yellow-900 dark:text-yellow-100"
					>
						Dev Tools (仅用于测试)
					</h3>
					<div class="flex gap-2">
						<Button
							onclick={migrationDialog.seedMockData}
							disabled={migrationDialog.isSeeding || migrationDialog.isClearing}
							variant="outline"
							size="sm"
						>
							{migrationDialog.isSeeding
								? '填充中...'
								: `填充 ${MOCK_RECORDING_COUNT} 条录音记录`}
						</Button>
						<Button
							onclick={migrationDialog.clearIndexedDB}
							disabled={migrationDialog.isSeeding || migrationDialog.isClearing}
							variant="outline"
							size="sm"
						>
							{migrationDialog.isClearing ? '清空中...' : '清空 IndexedDB'}
						</Button>
					</div>
				</div>
			{/if}
		</div>

		<Dialog.Footer>
			<Button onclick={() => (migrationDialog.isOpen = false)} variant="outline"
				>关闭</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
