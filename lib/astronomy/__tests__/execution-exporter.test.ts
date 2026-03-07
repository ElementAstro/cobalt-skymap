import { exportExecutionSummary } from '../execution-exporter';
import type { ObservationSession } from '@/lib/tauri/types';

function makeExecutionSession(): ObservationSession {
  return {
    id: 'session-1',
    date: '2025-06-15',
    observations: [
      {
        id: 'obs-1',
        object_name: 'M31',
        observed_at: '2025-06-15T20:45:00.000Z',
        image_paths: [],
        execution_target_id: 'target-1',
      },
    ],
    equipment_ids: [],
    source_plan_id: 'plan-1',
    source_plan_name: 'Tonight Plan',
    execution_status: 'completed',
    execution_summary: {
      completed_targets: 1,
      skipped_targets: 1,
      failed_targets: 0,
      total_targets: 2,
      total_observations: 1,
    },
    execution_targets: [
      {
        id: 'exec-target-1',
        target_id: 'target-1',
        target_name: 'M31',
        scheduled_start: '2025-06-15T20:30:00.000Z',
        scheduled_end: '2025-06-15T22:00:00.000Z',
        scheduled_duration_minutes: 90,
        order: 1,
        status: 'completed',
        observation_ids: ['obs-1'],
      },
      {
        id: 'exec-target-2',
        target_id: 'target-2',
        target_name: 'M42',
        scheduled_start: '2025-06-15T22:15:00.000Z',
        scheduled_end: '2025-06-15T23:15:00.000Z',
        scheduled_duration_minutes: 60,
        order: 2,
        status: 'skipped',
        observation_ids: [],
        skip_reason: 'Clouds',
      },
    ],
    created_at: '2025-06-15T19:00:00.000Z',
    updated_at: '2025-06-15T23:20:00.000Z',
  };
}

describe('execution-exporter', () => {
  it('exports markdown summary with completed and skipped targets', () => {
    const output = exportExecutionSummary(makeExecutionSession(), {
      format: 'markdown',
    });

    expect(output).toContain('# Observation Execution Summary');
    expect(output).toContain('Tonight Plan');
    expect(output).toContain('M31');
    expect(output).toContain('completed');
    expect(output).toContain('M42');
    expect(output).toContain('skipped');
  });

  it('exports json summary with execution metadata', () => {
    const output = exportExecutionSummary(makeExecutionSession(), {
      format: 'json',
    });

    const parsed = JSON.parse(output) as {
      sourcePlanId: string;
      targets: Array<{ targetName: string }>;
    };
    expect(parsed.sourcePlanId).toBe('plan-1');
    expect(parsed.targets).toHaveLength(2);
    expect(parsed.targets[0].targetName).toBe('M31');
  });

  it('exports csv rows for execution targets', () => {
    const output = exportExecutionSummary(makeExecutionSession(), {
      format: 'csv',
    });

    expect(output).toContain('order,target_name,status');
    expect(output).toContain('"M31",completed');
    expect(output).toContain('"M42",skipped');
  });
});
