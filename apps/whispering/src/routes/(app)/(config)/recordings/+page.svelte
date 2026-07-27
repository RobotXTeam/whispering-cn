<script lang="ts">
	import { confirmationDialog } from '$lib/components/ConfirmationDialog.svelte';
	import { TrashIcon } from '$lib/components/icons';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { createCopyFn } from '$lib/utils/createCopyFn';
	import { CopyButton } from '@epicenter/ui/copy-button';
	import { Badge } from '@epicenter/ui/badge';
	import { Button, buttonVariants } from '@epicenter/ui/button';
	import * as ButtonGroup from '@epicenter/ui/button-group';
	import { Card } from '@epicenter/ui/card';
	import { Checkbox } from '@epicenter/ui/checkbox';
	import * as Dialog from '@epicenter/ui/dialog';
	import * as DropdownMenu from '@epicenter/ui/dropdown-menu';
	import { Input } from '@epicenter/ui/input';
	import { Label } from '@epicenter/ui/label';
	import { Skeleton } from '@epicenter/ui/skeleton';
	import { SelectAllPopover, SortableTableHeader } from '@epicenter/ui/table';
	import * as Table from '@epicenter/ui/table';
	import { Textarea } from '@epicenter/ui/textarea';
	import { rpc } from '$lib/query';
	import type { Recording } from '$lib/services/isomorphic/db';
	import { cn } from '@epicenter/ui/utils';
	import { createPersistedState } from '@epicenter/svelte-utils';
	import { createMutation, createQuery } from '@tanstack/svelte-query';
	import {
		FlexRender,
		createTable as createSvelteTable,
		renderComponent,
	} from '@tanstack/svelte-table';
	import type {
		ColumnDef,
		ColumnFiltersState,
		PaginationState,
	} from '@tanstack/table-core';
	import {
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		getSortedRowModel,
	} from '@tanstack/table-core';
	import * as Empty from '@epicenter/ui/empty';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import MicIcon from '@lucide/svelte/icons/mic';
	import SearchIcon from '@lucide/svelte/icons/search';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import LoadingTranscriptionIcon from '@lucide/svelte/icons/ellipsis';
	import RetryTranscriptionIcon from '@lucide/svelte/icons/repeat';
	import StartTranscriptionIcon from '@lucide/svelte/icons/play';
	import { nanoid } from 'nanoid/non-secure';
	import { createRawSnippet } from 'svelte';
	import { type } from 'arktype';
	import LatestTransformationRunOutputByRecordingId from './LatestTransformationRunOutputByRecordingId.svelte';
	import RenderAudioUrl from './RenderAudioUrl.svelte';
	import TranscriptDialog from '$lib/components/copyable/TranscriptDialog.svelte';
	import { RecordingRowActions } from './row-actions';
	import { format } from 'date-fns';
	import OpenFolderButton from '$lib/components/OpenFolderButton.svelte';
	import { PATHS } from '$lib/constants/paths';

	/**
	 * Returns a cell renderer for a date/time column using date-fns format.
	 *
	 * @param formatString - date-fns format string
	 */
	function formattedCell(formatString: string) {
		return ({ getValue }: { getValue: () => unknown }) => {
			const value = getValue();
			if (typeof value !== 'string' || !value) return '';
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return value;
			try {
				return format(date, formatString);
			} catch {
				return value;
			}
		};
	}

	const getAllRecordingsQuery = createQuery(
		() => rpc.db.recordings.getAll.options,
	);
	const transcribeRecordings = createMutation(
		() => rpc.transcription.transcribeRecordings.options,
	);
	const DATE_FORMAT = 'PP p'; // e.g., Aug 13, 2025, 10:00 AM

	const columns: ColumnDef<Recording>[] = [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(SelectAllPopover<Recording>, { table }),
			cell: ({ row }) =>
				renderComponent(Checkbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value) => row.toggleSelected(!!value),
					'aria-label': '选择行',
				}),
			enableSorting: false,
			enableHiding: false,
			filterFn: (row, _columnId, filterValue) => {
				const title = String(row.getValue('title'));
				const subtitle = String(row.getValue('subtitle'));
				const transcribedText = String(row.getValue('transcribedText'));
				return (
					title.toLowerCase().includes(filterValue.toLowerCase()) ||
					subtitle.toLowerCase().includes(filterValue.toLowerCase()) ||
					transcribedText.toLowerCase().includes(filterValue.toLowerCase())
				);
			},
		},
		{
			id: 'ID',
			accessorKey: 'id',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, { column, headerText: 'ID' }),
			cell: ({ getValue }) => {
				const id = getValue<string>();
				return renderComponent(Badge, {
					variant: 'id',
					children: createRawSnippet(() => ({
						render: () => id,
					})),
				});
			},
		},
		{
			id: 'Title',
			accessorKey: 'title',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '标题',
				}),
		},
		{
			id: 'Subtitle',
			accessorKey: 'subtitle',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '副标题',
				}),
		},
		{
			id: 'Timestamp',
			accessorKey: 'timestamp',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '时间戳',
				}),
			cell: formattedCell(DATE_FORMAT),
		},
		{
			id: 'Created At',
			accessorKey: 'createdAt',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '创建时间',
				}),
			cell: formattedCell(DATE_FORMAT),
		},
		{
			id: 'Updated At',
			accessorKey: 'updatedAt',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '更新时间',
				}),
			cell: formattedCell(DATE_FORMAT),
		},
		{
			id: 'Transcript',
			accessorKey: 'transcribedText',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '转录文本',
				}),
			cell: ({ getValue, row }) => {
				const transcribedText = getValue<string>();
				if (!transcribedText) return;
				return renderComponent(TranscriptDialog, {
					recordingId: row.id,
					transcribedText,
				});
			},
		},
		{
			id: 'Latest Transformation Run Output',
			accessorFn: ({ id }) => id,
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '最新转换运行输出',
				}),
			cell: ({ getValue }) => {
				const recordingId = getValue<string>();
				return renderComponent(LatestTransformationRunOutputByRecordingId, {
					recordingId,
				});
			},
		},
		{
			id: 'Audio',
			accessorFn: ({ id }) => id,
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '音频',
				}),
			cell: ({ getValue }) => {
				const id = getValue<string>();
				return renderComponent(RenderAudioUrl, { id });
			},
		},
		{
			id: 'Actions',
			accessorFn: (recording) => recording,
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '操作',
				}),
			cell: ({ getValue }) => {
				const recording = getValue<Recording>();
				return renderComponent(RecordingRowActions, {
					recordingId: recording.id,
				});
			},
		},
	];

	let sorting = createPersistedState({
		key: 'whispering-recordings-data-table-sorting',
		onParseError: (error) => [{ id: 'timestamp', desc: true }],
		schema: type({ desc: 'boolean', id: 'string' }).array(),
	});
	let columnFilters = $state<ColumnFiltersState>([]);
	let columnVisibility = createPersistedState({
		key: 'whispering-recordings-data-table-column-visibility',
		onParseError: (error) => ({
			ID: false,
			Title: false,
			Subtitle: false,
			'Created At': false,
			'Updated At': false,
		}),
		schema: type('Record<string, boolean>'),
	});
	let rowSelection = createPersistedState({
		key: 'whispering-recordings-data-table-row-selection',
		onParseError: (error) => ({}),
		schema: type('Record<string, boolean>'),
	});
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
	let globalFilter = $state('');

	const table = createSvelteTable({
		getRowId: (originalRow) => originalRow.id,
		get data() {
			return getAllRecordingsQuery.data ?? [];
		},
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting.value = updater(sorting.value);
			} else {
				sorting.value = updater;
			}
		},
		onColumnFiltersChange: (updater) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}
		},
		onColumnVisibilityChange: (updater) => {
			if (typeof updater === 'function') {
				columnVisibility.value = updater(columnVisibility.value);
			} else {
				columnVisibility.value = updater;
			}
		},
		onRowSelectionChange: (updater) => {
			if (typeof updater === 'function') {
				rowSelection.value = updater(rowSelection.value);
			} else {
				rowSelection.value = updater;
			}
		},
		onPaginationChange: (updater) => {
			if (typeof updater === 'function') {
				pagination = updater(pagination);
			} else {
				pagination = updater;
			}
		},
		onGlobalFilterChange: (updater) => {
			if (typeof updater === 'function') {
				globalFilter = updater(globalFilter);
			} else {
				globalFilter = updater;
			}
		},
		state: {
			get sorting() {
				return sorting.value;
			},
			get columnFilters() {
				return columnFilters;
			},
			get columnVisibility() {
				return columnVisibility.value;
			},
			get rowSelection() {
				return rowSelection.value;
			},
			get pagination() {
				return pagination;
			},
			get globalFilter() {
				return globalFilter;
			},
		},
	});

	const selectedRecordingRows = $derived(
		table.getFilteredSelectedRowModel().rows,
	);

	let template = $state('{{timestamp}} {{transcribedText}}');
	let delimiter = $state('\n\n');

	let isDialogOpen = $state(false);

	const joinedTranscriptionsText = $derived.by(() => {
		const transcriptions = selectedRecordingRows
			.map(({ original }) => original)
			.filter((recording) => recording.transcribedText !== '')
			.map((recording) =>
				template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
					if (key in recording) {
						const value = recording[key as keyof Recording];
						return typeof value === 'string' ? value : '';
					}
					return '';
				}),
			);
		return transcriptions.join(delimiter);
	});
</script>

<svelte:head>
	<title>所有录音记录</title>
</svelte:head>

<main class="flex w-full flex-1 flex-col gap-2 px-4 py-4 sm:px-8 mx-auto">
	<h1 class="scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl">
		录音记录
	</h1>
	<p class="text-muted-foreground">
		您最近的录音记录和转录,已本地存储
		{window.__TAURI_INTERNALS__ ? '在文件系统中' : '在 IndexedDB 中'}。
	</p>
	<Card class="flex flex-col gap-4 p-6">
		<div class="flex flex-col md:flex-row items-center justify-between gap-2">
			<Input
				placeholder="筛选转录文本..."
				type="text"
				class="w-full md:max-w-sm"
				bind:value={globalFilter}
			/>
			<div class="flex w-full items-center justify-between gap-2">
				{#if selectedRecordingRows.length > 0}
					<Button
						tooltip="转录选中的录音记录"
						variant="outline"
						size="icon"
						disabled={transcribeRecordings.isPending}
						onclick={() => {
							const toastId = nanoid();
							rpc.notify.loading.execute({
								id: toastId,
								title: '正在转录 queries.recordings...',
								description: '这可能需要一些时间。',
							});
							transcribeRecordings.mutate(
								selectedRecordingRows.map(({ original }) => original),
								{
									onSuccess: ({ oks, errs }) => {
										const isAllSuccessful = errs.length === 0;
										if (isAllSuccessful) {
											const n = oks.length;
											rpc.notify.success.execute({
												id: toastId,
												title: `已转录 ${n} 条录音！`,
												description: `您的 ${n} 条录音已成功转录。`,
											});
											return;
										}
										const isAllFailed = oks.length === 0;
										if (isAllFailed) {
											const n = errs.length;
											rpc.notify.error.execute({
												id: toastId,
												title: `${n} 条录音转录失败`,
												description:
													n === 1
														? '您的录音无法转录。'
														: '您的录音均无法转录。',
												action: { type: 'more-details', error: errs },
											});
											return;
										}
										// Mixed results
										rpc.notify.warning.execute({
											id: toastId,
											title: `已转录 ${oks.length} / ${oks.length + errs.length} 条录音记录`,
											description: `${oks.length} 成功,${errs.length} 失败。`,
											action: { type: 'more-details', error: errs },
										});
									},
								},
							);
						}}
					>
						{#if transcribeRecordings.isPending}
							<EllipsisIcon class="size-4" />
						{:else if selectedRecordingRows.some(({ id }) => {
							const currentRow = getAllRecordingsQuery.data?.find((r) => r.id === id);
							return currentRow?.transcriptionStatus === 'TRANSCRIBING';
						})}
							<LoadingTranscriptionIcon class="size-4" />
						{:else if selectedRecordingRows.some(({ id }) => {
							const currentRow = getAllRecordingsQuery.data?.find((r) => r.id === id);
							return currentRow?.transcriptionStatus === 'DONE';
						})}
							<RetryTranscriptionIcon class="size-4" />
						{:else}
							<StartTranscriptionIcon class="size-4" />
						{/if}
					</Button>

					<Dialog.Root
						open={isDialogOpen}
						onOpenChange={(v) => (isDialogOpen = v)}
					>
						<Dialog.Trigger>
							<Button
								tooltip="复制所选录音的转录文本"
								variant="outline"
								size="icon"
							>
								<CopyIcon class="size-4" />
							</Button>
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Header>
								<Dialog.Title>复制转录文本</Dialog.Title>
								<Dialog.Description>
									在此处修改您的配置文件。完成后点击保存。
								</Dialog.Description>
							</Dialog.Header>
							<div class="grid gap-4 py-4">
								<div class="grid grid-cols-4 items-center gap-4">
									<Label for="template" class="text-right">模板</Label>
									<Textarea
										id="template"
										bind:value={template}
										class="col-span-3"
									/>
								</div>
								<div class="grid grid-cols-4 items-center gap-4">
									<Label for="delimiter" class="text-right">分隔符</Label>
									<Textarea
										id="delimiter"
										bind:value={delimiter}
										class="col-span-3"
									/>
								</div>
							</div>
							<Textarea
								placeholder="复制文本预览"
								readonly
								class="h-32"
								value={joinedTranscriptionsText}
							/>
							<Dialog.Footer>
								<CopyButton
									text={joinedTranscriptionsText}
									copyFn={createCopyFn('transcripts')}
									size="default"
									onCopy={(status) => {
										if (status === 'success') isDialogOpen = false;
									}}
								>
									复制转录
								</CopyButton>
							</Dialog.Footer>
						</Dialog.Content>
					</Dialog.Root>

					<Button
						tooltip="删除选中的录音记录"
						variant="outline"
						size="icon"
						onclick={() => {
							confirmationDialog.open({
								title: '删除录音记录',
								description:
									'确定要删除这些录音记录吗?',
								confirm: { text: '删除', variant: 'destructive' },
								onConfirm: async () => {
									const { error } = await rpc.db.recordings.delete.execute(
										selectedRecordingRows.map(({ original }) => original),
									);
									if (error) {
										rpc.notify.error.execute({
											title: '删除录音记录失败!',
											description: '您的录音记录无法删除。',
											action: { type: 'more-details', error },
										});
										throw error;
									}
									rpc.notify.success.execute({
										title: '已删除录音记录!',
										description:
											'您的录音记录已成功删除。',
									});
								},
							});
						}}
					>
						<TrashIcon class="size-4" />
					</Button>
				{/if}

				<OpenFolderButton
					getFolderPath={PATHS.DB.RECORDINGS}
					tooltipText="打开录音记录文件夹"
				/>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'ml-auto items-center transition-all [&[data-state=open]>svg]:rotate-180',
						)}
					>
						列 <ChevronDownIcon
							class="size-4 transition-transform duration-200"
						/>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						{#each table
							.getAllColumns()
							.filter((c) => c.getCanHide()) as column (column.id)}
							<DropdownMenu.CheckboxItem
								bind:checked={
									() => column.getIsVisible(),
									(value) => column.toggleVisibility(!!value)
								}
							>
								{column.columnDef.id}
							</DropdownMenu.CheckboxItem>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>

		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					{#each table.getHeaderGroups() as headerGroup}
						<Table.Row>
							{#each headerGroup.headers as header}
								<Table.Head colspan={header.colSpan}>
									{#if !header.isPlaceholder}
										<FlexRender
											content={header.column.columnDef.header}
											context={header.getContext()}
										/>
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				<Table.Body>
					{#if getAllRecordingsQuery.isPending}
						{#each { length: 5 }}
							<Table.Row>
								<Table.Cell>
									<Skeleton class="size-4" />
								</Table.Cell>
								<Table.Cell colspan={columns.length - 1}>
									<Skeleton class="h-4 w-full" />
								</Table.Cell>
							</Table.Row>
						{/each}
					{:else if table.getRowModel().rows?.length}
						{#each table.getRowModel().rows as row (row.id)}
							<Table.Row>
								{#each row.getVisibleCells() as cell}
									<Table.Cell>
										<FlexRender
											content={cell.column.columnDef.cell}
											context={cell.getContext()}
										/>
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{:else}
						<Table.Row>
							<Table.Cell colspan={columns.length}>
								<Empty.Root class="py-8">
									<Empty.Header>
										<Empty.Media variant="icon">
											{#if globalFilter}
												<SearchIcon />
											{:else}
												<MicIcon />
											{/if}
										</Empty.Media>
										<Empty.Title>
											{#if globalFilter}
												未找到录音记录
											{:else}
												暂无录音记录
											{/if}
										</Empty.Title>
										<Empty.Description>
											{#if globalFilter}
												请尝试调整搜索或筛选条件。
											{:else}
												开始录音以添加记录。
											{/if}
										</Empty.Description>
									</Empty.Header>
								</Empty.Root>
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex items-center justify-between">
			<div class="text-muted-foreground text-sm">
				{selectedRecordingRows.length} / {table.getFilteredRowModel().rows
					.length} 行已选。
			</div>
			<ButtonGroup.Root>
				<Button
					variant="outline"
					size="sm"
					onclick={() => table.previousPage()}
					disabled={!table.getCanPreviousPage()}
				>
					上一页
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => table.nextPage()}
					disabled={!table.getCanNextPage()}
				>
					下一页
				</Button>
			</ButtonGroup.Root>
		</div>
	</Card>
</main>
