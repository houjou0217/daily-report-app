import { describe, expect, it } from 'vitest';

import {
  calculateDuration,
  isEndTimeBeforeStartTime,
  sortWorkBlocksByStartTime,
  timeToMinutes,
} from '../../src/domain/time.js';
import type { WorkBlock } from '../../src/domain/models.js';

const createBlock = (id: string, startTime: string): WorkBlock => ({
  id,
  projectId: 'proj-001',
  projectName: '案件A',
  taskLabel: '',
  workContent: '',
  status: '',
  statusDetail: '',
  startTime,
  endTime: '',
  note: '',
});

describe('time utilities', () => {
  it('accepts five-minute times and calculates durations', () => {
    expect(timeToMinutes('09:05')).toBe(545);
    expect(timeToMinutes('09:07')).toBeUndefined();
    expect(calculateDuration('09:05', '10:35')).toBe('1時間30分');
    expect(calculateDuration('09:05', '')).toBeUndefined();
  });

  it('identifies an end time before its start time', () => {
    expect(isEndTimeBeforeStartTime('10:00', '09:55')).toBe(true);
    expect(isEndTimeBeforeStartTime('10:00', '10:00')).toBe(false);
  });

  it('sorts by start time while keeping same-time and blank blocks in their manual order', () => {
    const blocks = [
      createBlock('blank-1', ''),
      createBlock('late', '13:00'),
      createBlock('same-1', '09:00'),
      createBlock('same-2', '09:00'),
      createBlock('blank-2', ''),
      createBlock('early', '08:55'),
    ];

    expect(sortWorkBlocksByStartTime(blocks).map((block) => block.id)).toEqual([
      'early',
      'same-1',
      'same-2',
      'late',
      'blank-1',
      'blank-2',
    ]);
  });
});
