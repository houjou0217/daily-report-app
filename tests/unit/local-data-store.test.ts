import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DataReadError, DataValidationError, DataWriteError } from '../../src/domain/errors.js';
import type { Report } from '../../src/domain/models.js';
import { LocalDataStore } from '../../src/data/local-data-store.js';
import type { FileSystem } from '../../src/data/json-file-store.js';

const createReport = (): Report => ({
  date: '2026-08-11',
  blocks: [
    {
      id: 'blk-001',
      projectId: 'proj-001',
      projectName: '案件A',
      taskLabel: 'MTG',
      workContent: '要件確認MTG',
      status: '完了',
      statusDetail: '',
      progressPercent: 100,
      startTime: '09:00',
      endTime: '10:00',
      note: '',
    },
    {
      id: 'blk-002',
      projectId: 'proj-001',
      projectName: '案件A',
      taskLabel: '資料作成',
      workContent: '議事録の作成',
      status: '進行中',
      statusDetail: '',
      progressPercent: 40,
      startTime: '10:15',
      endTime: '11:00',
      note: '',
    },
  ],
  comment: '特になし',
  updatedAt: '2026-08-11T09:00:00.000Z',
});

describe('LocalDataStore', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), 'daily-report-app-'));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('creates, updates, archives, reloads, and deletes projects', async () => {
    const store = new LocalDataStore(directory);
    const created = await store.createProject({ name: '案件A', code: 'A-01' });
    const updated = await store.updateProject(created.id, { archived: true, name: '案件A（完了）' });

    expect(updated).toMatchObject({
      id: created.id,
      name: '案件A（完了）',
      code: 'A-01',
      archived: true,
    });

    const reloadedStore = new LocalDataStore(directory);
    await expect(reloadedStore.getProject(created.id)).resolves.toEqual(updated);
    await expect(reloadedStore.deleteProject(created.id)).resolves.toBe(true);
    await expect(reloadedStore.deleteProject(created.id)).resolves.toBe(false);
    await expect(reloadedStore.listProjects()).resolves.toEqual([]);
  });

  it('saves, reloads, replaces, and deletes a daily report with repeated projects', async () => {
    const store = new LocalDataStore(directory);
    const report = createReport();

    await store.saveReport(report);
    await expect(new LocalDataStore(directory).loadReport(report.date)).resolves.toEqual(report);

    const replacement = { ...report, comment: '次回の確認事項あり' };
    await store.saveReport(replacement);
    await expect(store.loadReport(report.date)).resolves.toEqual(replacement);
    await expect(store.deleteReport(report.date)).resolves.toBe(true);
    await expect(store.loadReport(report.date)).resolves.toBeUndefined();
  });

  it('saves an unfinished work block as a local draft', async () => {
    const store = new LocalDataStore(directory);
    const draft = createReport();
    draft.blocks[0] = {
      ...draft.blocks[0]!,
      taskLabel: '',
      workContent: '',
      status: '',
    };

    await store.saveReport(draft);
    await expect(store.loadReport(draft.date)).resolves.toEqual(draft);
  });

  it('rejects invalid report data before it is written', async () => {
    const store = new LocalDataStore(directory);
    const report = createReport();
    report.blocks[0]!.progressPercent = 101;

    await expect(store.saveReport(report)).rejects.toBeInstanceOf(DataValidationError);
  });

  it('rejects malformed local JSON data', async () => {
    await fs.writeFile(join(directory, 'projects.json'), '{"projects":"invalid"}', 'utf8');

    await expect(new LocalDataStore(directory).listProjects()).rejects.toBeInstanceOf(DataReadError);
  });

  it('reports a file write failure', async () => {
    const failingFileSystem: FileSystem = {
      ...fs,
      writeFile: async () => {
        throw new Error('simulated write failure');
      },
    };
    const store = new LocalDataStore(directory, failingFileSystem);

    await expect(store.createProject({ name: '案件A' })).rejects.toBeInstanceOf(DataWriteError);
  });
});
