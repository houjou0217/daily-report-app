import type { LocalDataStore } from '../data/local-data-store.js';
import { DataValidationError } from '../domain/errors.js';
import type { Report } from '../domain/models.js';
import { assertReport, assertReportDate } from '../domain/validation.js';

type ReportIpcChannel = 'reports:list-dates' | 'reports:load' | 'reports:save';
type IpcHandler = (_event: unknown, ...arguments_: unknown[]) => unknown;

export interface ReportIpcRegistrar {
  handle: (channel: ReportIpcChannel, listener: IpcHandler) => void;
}

type ReportDataAccess = Pick<LocalDataStore, 'listReportDates' | 'loadReport' | 'saveReport'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertNoExtraArguments = (arguments_: unknown[]): void => {
  if (arguments_.length !== 0) {
    throw new DataValidationError('This operation does not accept extra arguments.');
  }
};

const assertAllowedKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]): void => {
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw new DataValidationError('Unexpected report input field.');
  }
};

const parseReport = (value: unknown): Report => {
  if (!isRecord(value)) {
    throw new DataValidationError('Report input must be an object.');
  }

  assertAllowedKeys(value, ['date', 'blocks', 'comment', 'updatedAt']);
  if (!Array.isArray(value.blocks)) {
    throw new DataValidationError('Report blocks must be an array.');
  }

  for (const block of value.blocks) {
    if (!isRecord(block)) {
      throw new DataValidationError('Report block must be an object.');
    }
    assertAllowedKeys(block, [
      'id',
      'projectId',
      'projectName',
      'taskLabel',
      'workContent',
      'status',
      'statusDetail',
      'progressPercent',
      'startTime',
      'endTime',
      'note',
    ]);
  }

  assertReport(value);
  return value;
};

export const registerReportIpc = (ipc: ReportIpcRegistrar, dataStore: ReportDataAccess): void => {
  ipc.handle('reports:list-dates', async (_event, ...arguments_) => {
    assertNoExtraArguments(arguments_);
    return dataStore.listReportDates();
  });

  ipc.handle('reports:load', async (_event, date, ...arguments_) => {
    assertNoExtraArguments(arguments_);
    assertReportDate(date);
    return dataStore.loadReport(date);
  });

  ipc.handle('reports:save', async (_event, report, ...arguments_) => {
    assertNoExtraArguments(arguments_);
    await dataStore.saveReport(parseReport(report));
  });
};

export type { ReportIpcChannel };
