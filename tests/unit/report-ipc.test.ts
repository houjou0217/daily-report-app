import { describe, expect, it } from 'vitest';

import { DataValidationError } from '../../src/domain/errors.js';
import type { Report } from '../../src/domain/models.js';
import {
  registerReportIpc,
  type ReportIpcChannel,
  type ReportIpcRegistrar,
} from '../../src/main/report-ipc.js';

type Handler = (_event: unknown, ...arguments_: unknown[]) => unknown;

const createReport = (): Report => ({
  date: '2026-08-12',
  blocks: [
    {
      id: 'blk-001',
      projectId: 'proj-001',
      projectName: '案件A',
      taskLabel: '',
      workContent: '',
      status: '',
      statusDetail: '',
      startTime: '',
      endTime: '',
      note: '',
    },
  ],
  comment: '',
  updatedAt: '2026-08-12T00:00:00.000Z',
});

const createHarness = () => {
  const handlers = new Map<ReportIpcChannel, Handler>();
  const savedReports: Report[] = [];
  const ipc: ReportIpcRegistrar = {
    handle: (channel, handler) => {
      handlers.set(channel, handler);
    },
  };
  const dataStore = {
    listReportDates: async () => ['2026-08-12'],
    loadReport: async (date: string) => (date === '2026-08-12' ? createReport() : undefined),
    saveReport: async (report: Report) => {
      savedReports.push(report);
    },
  };
  registerReportIpc(ipc, dataStore);

  const invoke = async (channel: ReportIpcChannel, ...arguments_: unknown[]) => {
    const handler = handlers.get(channel);
    if (handler === undefined) {
      throw new Error(`Missing handler: ${channel}`);
    }
    return handler({}, ...arguments_);
  };

  return { invoke, savedReports };
};

describe('report IPC boundary', () => {
  it('loads and saves a draft report through fixed IPC operations', async () => {
    const { invoke, savedReports } = createHarness();
    const report = createReport();

    await expect(invoke('reports:list-dates')).resolves.toEqual(['2026-08-12']);
    await expect(invoke('reports:load', report.date)).resolves.toEqual(report);
    await expect(invoke('reports:save', report)).resolves.toBeUndefined();
    expect(savedReports).toEqual([report]);
  });

  it('rejects malformed or generic report input before it reaches the data layer', async () => {
    const { invoke, savedReports } = createHarness();
    const report = createReport();

    await expect(invoke('reports:list-dates', 'unexpected')).rejects.toBeInstanceOf(DataValidationError);
    await expect(invoke('reports:load', '2026-02-30')).rejects.toBeInstanceOf(DataValidationError);
    await expect(invoke('reports:save', { ...report, command: 'unexpected' })).rejects.toBeInstanceOf(
      DataValidationError,
    );
    await expect(
      invoke('reports:save', { ...report, blocks: [{ ...report.blocks[0], unexpected: true }] }),
    ).rejects.toBeInstanceOf(DataValidationError);
    await expect(invoke('reports:save', report, 'unexpected')).rejects.toBeInstanceOf(DataValidationError);
    expect(savedReports).toEqual([]);
  });
});
