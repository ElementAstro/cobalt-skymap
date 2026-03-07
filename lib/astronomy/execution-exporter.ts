import type { ObservationSession } from '@/lib/tauri/types';

export type ExecutionExportFormat = 'markdown' | 'json' | 'csv';

interface ExecutionExportOptions {
  format: ExecutionExportFormat;
}

function exportAsMarkdown(session: ObservationSession): string {
  const lines = [
    '# Observation Execution Summary',
    '',
    `- Session ID: ${session.id}`,
    `- Plan: ${session.source_plan_name ?? 'Unknown Plan'}`,
    `- Plan ID: ${session.source_plan_id ?? 'unknown'}`,
    `- Status: ${session.execution_status ?? 'unknown'}`,
    `- Date: ${session.date}`,
    '',
    '## Targets',
    '',
  ];

  for (const target of session.execution_targets ?? []) {
    lines.push(`- ${target.target_name} — ${target.status}`);
  }

  return lines.join('\n');
}

function exportAsJson(session: ObservationSession): string {
  return JSON.stringify({
    sessionId: session.id,
    sourcePlanId: session.source_plan_id,
    sourcePlanName: session.source_plan_name,
    executionStatus: session.execution_status,
    date: session.date,
    summary: session.execution_summary,
    targets: (session.execution_targets ?? []).map((target) => ({
      id: target.id,
      targetId: target.target_id,
      targetName: target.target_name,
      status: target.status,
      scheduledStart: target.scheduled_start,
      scheduledEnd: target.scheduled_end,
      observationIds: target.observation_ids,
      skipReason: target.skip_reason,
    })),
    observations: session.observations,
  }, null, 2);
}

function escapeCsv(value: string | number | undefined): string {
  if (value === undefined) return '';
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exportAsCsv(session: ObservationSession): string {
  const header = 'order,target_name,status,scheduled_start,scheduled_end,actual_start,actual_end,observation_count,skip_reason';
  const rows = (session.execution_targets ?? []).map((target) => [
    target.order,
    escapeCsv(target.target_name),
    target.status,
    target.scheduled_start,
    target.scheduled_end,
    target.actual_start ?? '',
    target.actual_end ?? '',
    target.observation_ids.length,
    escapeCsv(target.skip_reason),
  ].join(','));

  return [header, ...rows].join('\n');
}

export function exportExecutionSummary(
  session: ObservationSession,
  options: ExecutionExportOptions,
): string {
  switch (options.format) {
    case 'json':
      return exportAsJson(session);
    case 'csv':
      return exportAsCsv(session);
    case 'markdown':
    default:
      return exportAsMarkdown(session);
  }
}
