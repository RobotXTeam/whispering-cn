<script lang="ts">
	import { confirmationDialog } from '$lib/components/ConfirmationDialog.svelte';
	import { TrashIcon } from '$lib/components/icons';
	import { Badge } from '@epicenter/ui/badge';
	import { Button } from '@epicenter/ui/button';
	import * as ButtonGroup from '@epicenter/ui/button-group';
	import { Checkbox } from '@epicenter/ui/checkbox';
	import { Input } from '@epicenter/ui/input';
	import { Skeleton } from '@epicenter/ui/skeleton';
	import { SelectAllPopover, SortableTableHeader } from '@epicenter/ui/table';
	import * as Table from '@epicenter/ui/table';
	import { rpc } from '$lib/query';
	import { type Transformation } from '$lib/services/isomorphic/db';
	import { createPersistedState } from '@epicenter/svelte-utils';
	import { viewTransition } from '$lib/utils/viewTransitions';
	import { createQuery } from '@tanstack/svelte-query';
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
	import SearchIcon from '@lucide/svelte/icons/search';
	import WandSparklesIcon from '@lucide/svelte/icons/wand-sparkles';
	import { createRawSnippet } from 'svelte';
	import { type } from 'arktype';
	import CreateTransformationButton from './CreateTransformationButton.svelte';
	import MarkTransformationActiveButton from './MarkTransformationActiveButton.svelte';
	import TransformationRowActions from './TransformationRowActions.svelte';
	import OpenFolderButton from '$lib/components/OpenFolderButton.svelte';
	import { PATHS } from '$lib/constants/paths';

	const transformationsQuery = createQuery(
		() => rpc.db.transformations.getAll.options,
	);

	const columns: ColumnDef<Transformation>[] = [
		{
			id: 'select',
			header: ({ table }) =>
				renderComponent(SelectAllPopover<Transformation>, { table }),
			cell: ({ row }) =>
				renderComponent(Checkbox, {
					checked: row.getIsSelected(),
					onCheckedChange: (value) => row.toggleSelected(!!value),
					'aria-label': '选择行',
				}),
			enableSorting: false,
			enableHiding: false,
		},
		{
			id: 'mark-selected',
			cell: ({ row }) =>
				renderComponent(MarkTransformationActiveButton, {
					transformation: row.original,
					size: 'icon',
				}),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: 'id',
			cell: ({ getValue }) =>
				renderComponent(Badge, {
					variant: 'id',
					children: createRawSnippet((name) => ({
						render: () => getValue<string>(),
					})),
				}),
			header: 'ID',
		},
		{
			accessorKey: 'title',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '标题',
				}),
		},
		{
			accessorKey: 'description',
			header: ({ column }) =>
				renderComponent(SortableTableHeader, {
					column,
					headerText: '描述',
				}),
		},
		{
			id: 'actions',
			accessorFn: (transformation) => transformation,
			header: '操作',
			cell: ({ getValue }) => {
				const transformation = getValue<Transformation>();
				return renderComponent(TransformationRowActions, {
					transformationId: transformation.id,
				});
			},
		},
	];

	let sorting = createPersistedState({
		key: 'whispering-transformations-data-table-sorting',
		onParseError: (error) => [{ id: 'title', desc: false }],
		schema: type({ desc: 'boolean', id: 'string' }).array(),
	});
	let columnFilters = $state<ColumnFiltersState>([]);
	let rowSelection = createPersistedState({
		key: 'whispering-transformations-data-table-row-selection',
		onParseError: (error) => ({}),
		schema: type('Record<string, boolean>'),
	});
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
	let globalFilter = $state('');

	const table = createSvelteTable({
		getRowId: (originalRow) => originalRow.id,
		get data() {
			return transformationsQuery.data ?? [];
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

	const selectedTransformationRows = $derived(
		table.getFilteredSelectedRowModel().rows,
	);
</script>

<svelte:head>
	<title>所有转换</title>
</svelte:head>

<main class="flex w-full flex-1 flex-col gap-2 px-4 py-4 sm:px-8 mx-auto">
	<h1 class="scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl">
		转换
	</h1>
	<p class="text-muted-foreground">
		您的文本转换已本地存储在 IndexedDB 中。
	</p>

	<div class="flex items-center justify-between gap-2 w-full">
		<Input
			placeholder="筛选转换..."
			type="text"
			class="w-full"
			bind:value={globalFilter}
		/>
		{#if selectedTransformationRows.length > 0}
			<Button
				tooltip="删除所选转换"
				variant="outline"
				size="icon"
				onclick={() => {
					confirmationDialog.open({
						title: '删除转换',
						description:
							'确定要删除这些转换吗?',
						confirm: { text: '删除', variant: 'destructive' },
						onConfirm: async () => {
							const { error } = await rpc.db.transformations.delete.execute(
								selectedTransformationRows.map(({ original }) => original),
							);
							if (error) {
								rpc.notify.error.execute({
									title: '删除转换失败!',
									description: '无法删除您的转换。',
									action: { type: 'more-details', error },
								});
								throw error;
							}
							rpc.notify.success.execute({
								title: '已删除转换!',
								description:
									'您的转换已成功删除。',
							});
						},
					});
				}}
			>
				<TrashIcon class="size-4" />
			</Button>
		{/if}

		<OpenFolderButton
			getFolderPath={PATHS.DB.TRANSFORMATIONS}
			tooltipText="打开转换文件夹"
		/>

		<CreateTransformationButton />
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
				{#if transformationsQuery.isPending}
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
						<Table.Row
							style="view-transition-name: {viewTransition.transformation(
								row.id,
							)}"
						>
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
											<WandSparklesIcon />
										{/if}
									</Empty.Media>
									<Empty.Title>
										{#if globalFilter}
											未找到转换
										{:else}
											暂无转换
										{/if}
									</Empty.Title>
									<Empty.Description>
										{#if globalFilter}
											请尝试调整搜索或筛选条件。
										{:else}
											点击"创建转换"添加一个。
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
			已选 {selectedTransformationRows.length} / {table.getFilteredRowModel().rows
				.length} 行。
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
</main>
