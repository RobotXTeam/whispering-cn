<script lang="ts">
	import { confirmationDialog } from '$lib/components/ConfirmationDialog.svelte';
	import CopyablePre from '$lib/components/copyable/CopyablePre.svelte';
	import TextPreviewDialog from '$lib/components/copyable/TextPreviewDialog.svelte';
	import { rpc } from '$lib/query';
	import type { TransformationRun } from '$lib/services/isomorphic/db';
	import { viewTransition } from '$lib/utils/viewTransitions';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import PlayIcon from '@lucide/svelte/icons/play';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { Badge } from '@epicenter/ui/badge';
	import * as Empty from '@epicenter/ui/empty';
	import { Button } from '@epicenter/ui/button';
	import * as Card from '@epicenter/ui/card';
	import { Label } from '@epicenter/ui/label';
	import * as Table from '@epicenter/ui/table';
	import { format } from 'date-fns';

	let { runs }: { runs: TransformationRun[] } = $props();

	let expandedRunId = $state<string | null>(null);

	function toggleRunExpanded(runId: string) {
		expandedRunId = expandedRunId === runId ? null : runId;
	}

	function formatDate(dateStr: string) {
		return format(new Date(dateStr), 'MMM d, yyyy h:mm a');
	}
</script>

{#if runs.length === 0}
	<Empty.Root class="h-full">
		<Empty.Header>
			<Empty.Media variant="icon">
				<PlayIcon />
			</Empty.Media>
			<Empty.Title>暂无运行记录</Empty.Title>
			<Empty.Description>
				运行转换后,结果将显示在此处。
			</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{:else}
	<div class="space-y-4">
		<div class="flex justify-end px-2">
			<Button
				variant="destructive"
				size="sm"
				onclick={() => {
					confirmationDialog.open({
						title: '清除所有转换运行记录?',
						description: `此操作将永久删除历史记录中的所有 ${runs.length} 条运行记录${runs.length !== 1 ? 's' : ''}。此操作无法撤销。`,
						confirm: { text: '全部删除', variant: 'destructive' },
						onConfirm: async () => {
							const { error } = await rpc.db.runs.delete.execute(runs);
							if (error) {
								rpc.notify.error.execute({
									title: '删除运行记录失败',
									description: error.message,
								});
								throw error;
							}
							rpc.notify.success.execute({
								title: `已删除 ${runs.length} 条运行记录${runs.length !== 1 ? 's' : ''}`,
								description: '所有转换运行记录已删除。',
							});
						},
					});
				}}
			>
				<Trash2 class="size-4" />
				清除所有运行记录
			</Button>
		</div>
		<div class="h-full overflow-y-auto px-2">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>展开</Table.Head>
						<Table.Head>状态</Table.Head>
						<Table.Head>开始时间</Table.Head>
						<Table.Head>完成时间</Table.Head>
						<Table.Head class="text-right">操作</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each runs as run}
						<Table.Row>
							<Table.Cell>
								<Button
									variant="ghost"
									size="icon"
									class="size-8 shrink-0"
									onclick={() => toggleRunExpanded(run.id)}
								>
									{#if expandedRunId === run.id}
										<ChevronDown class="size-4" />
									{:else}
										<ChevronRight class="size-4" />
									{/if}
								</Button>
							</Table.Cell>
							<Table.Cell>
								<Badge variant={`status.${run.status}`}>
									{run.status}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								{formatDate(run.startedAt)}
							</Table.Cell>
							<Table.Cell>
								{run.completedAt ? formatDate(run.completedAt) : '-'}
							</Table.Cell>
							<Table.Cell class="text-right">
								<Button
									variant="ghost"
									size="icon"
									tooltip="删除运行记录"
									onclick={() => {
										confirmationDialog.open({
											title: '删除转换运行记录?',
											description: `此操作将永久删除${formatDate(run.startedAt)}的运行记录。此操作无法撤销。`,
											confirm: { text: 'Delete', variant: 'destructive' },
											onConfirm: async () => {
												const { error } = await rpc.db.runs.delete.execute(run);
												if (error) {
													rpc.notify.error.execute({
														title: '删除运行记录失败',
														description: error.message,
													});
													throw error;
												}
												rpc.notify.success.execute({
													title: '运行记录已删除',
													description:
														'您的转换运行记录已删除。',
												});
											},
										});
									}}
								>
									<Trash2 class="size-4" />
								</Button>
							</Table.Cell>
						</Table.Row>

						{#if expandedRunId === run.id}
							<Table.Row>
								<Table.Cell class="space-y-4 p-4" colspan={5}>
									<Label class="text-sm font-medium">输入</Label>
									<CopyablePre variant="text" copyableText={run.input} />

									{#if run.status === 'completed'}
										<Label class="text-sm font-medium">输出</Label>
										<CopyablePre variant="text" copyableText={run.output} />
									{:else if run.status === 'failed'}
										<Label class="text-sm font-medium">错误</Label>
										<CopyablePre variant="error" copyableText={run.error} />
									{/if}
									{#if run.stepRuns.length > 0}
										<div class="flex flex-col gap-2">
											<Label class="text-sm font-medium">步骤</Label>
											<Card.Root>
												<Table.Root>
													<Table.Header>
														<Table.Row>
															<Table.Head>状态</Table.Head>
															<Table.Head>开始时间</Table.Head>
															<Table.Head>完成时间</Table.Head>
															<Table.Head>输入</Table.Head>
															<Table.Head>输出</Table.Head>
														</Table.Row>
													</Table.Header>
													<Table.Body>
														{#each run.stepRuns as stepRun}
															<Table.Row>
																<Table.Cell>
																	<Badge variant={`status.${stepRun.status}`}>
																		{stepRun.status}
																	</Badge>
																</Table.Cell>
																<Table.Cell>
																	{formatDate(stepRun.startedAt)}
																</Table.Cell>
																<Table.Cell>
																	{stepRun.completedAt
																		? formatDate(stepRun.completedAt)
																		: '-'}
																</Table.Cell>
																<Table.Cell>
																	<TextPreviewDialog
																		id={viewTransition.stepRun(stepRun.id)
																			.input}
																		title="步骤输入"
																		label="步骤输入"
																		text={stepRun.input}
																	/>
																</Table.Cell>
																<Table.Cell>
																	{#if stepRun.status === 'completed'}
																		<TextPreviewDialog
																			id={viewTransition.stepRun(stepRun.id)
																				.output}
																			title="步骤输出"
																			label="步骤输出"
																			text={stepRun.output}
																		/>
																	{:else if stepRun.status === 'failed'}
																		<TextPreviewDialog
																			id={viewTransition.stepRun(stepRun.id)
																				.error}
																			title="步骤错误"
																			label="步骤错误"
																			text={stepRun.error}
																		/>
																	{/if}
																</Table.Cell>
															</Table.Row>
														{/each}
													</Table.Body>
												</Table.Root>
											</Card.Root>
										</div>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/if}
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</div>
{/if}
