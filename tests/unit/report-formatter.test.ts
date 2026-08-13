import { describe, expect, it } from 'vitest';

import {
  formatReport,
  validateReportForPreview,
} from '../../src/domain/report-formatter.js';
import type { Report } from '../../src/domain/models.js';

const createReport = (): Report => ({
  date: '2026-08-11',
  blocks: [
    {
      id: 'blk-001', projectId: 'proj-a', projectName: '案件A', taskLabel: '資料作成',
      workContent: '設計書を更新', status: '進行中', statusDetail: '確認待ち', progressPercent: 70,
      startTime: '11:30', endTime: '12:00', note: '',
    },
    {
      id: 'blk-002', projectId: 'proj-b', projectName: '案件B', taskLabel: 'MTG',
      workContent: '要件確認', status: '完了', statusDetail: '', progressPercent: 100,
      startTime: '09:00', endTime: '10:00', note: '',
    },
    {
      id: 'blk-003', projectId: 'proj-a', projectName: '案件A', taskLabel: '',
      workContent: '追加対応', status: '保留', statusDetail: '',
      startTime: '', endTime: '', note: '',
    },
  ],
  comment: '特になし',
  updatedAt: '2026-08-11T09:00:00.000Z',
});

describe('report formatter', () => {
  it('formats repeated projects in chronological order without grouping them', () => {
    expect(formatReport(createReport())).toBe(`【日報】2026年08月11日（火）

09:00-10:00 ■ 案件B（MTG）
・作業内容：要件確認
・進捗状況：完了（100%）

11:30-12:00 ■ 案件A（資料作成）
・作業内容：設計書を更新
・進捗状況：進行中（70%） 確認待ち

■ 案件A
・作業内容：追加対応
・進捗状況：保留

本日の所感・共有事項：特になし`);
  });

  it('reports required fields and invalid time relationships before previewing', () => {
    const report = createReport();
    report.blocks[0] = {
      ...report.blocks[0]!, projectId: '', projectName: '', workContent: '', status: '', startTime: '10:00', endTime: '09:55',
    };

    expect(validateReportForPreview(report)).toEqual([
      { blockId: 'blk-001', field: 'project', message: '対象案件を選択してください。' },
      { blockId: 'blk-001', field: 'workContent', message: '作業内容を入力してください。' },
      { blockId: 'blk-001', field: 'status', message: '進捗状況を選択してください。' },
      { blockId: 'blk-001', field: 'time', message: '終了時刻は開始時刻以降に設定してください。' },
    ]);
  });
});
