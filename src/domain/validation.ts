import { DataValidationError } from './errors.js';
import type { Project, ProjectsDocument, Report, WorkBlock } from './models.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function assertString(value: unknown, field: string, allowEmpty = true): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new DataValidationError(`${field} must be a ${allowEmpty ? 'string' : 'non-empty string'}.`);
  }
}

function assertDateTime(value: unknown, field: string): asserts value is string {
  assertString(value, field, false);

  if (Number.isNaN(Date.parse(value))) {
    throw new DataValidationError(`${field} must be an ISO date-time string.`);
  }
}

export function assertReportDate(value: unknown): asserts value is string {
  assertString(value, 'date', false);

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new DataValidationError('date must use the YYYY-MM-DD format.');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new DataValidationError('date must be a calendar date.');
  }
}

export function assertProject(value: unknown): asserts value is Project {
  if (!isRecord(value)) {
    throw new DataValidationError('project must be an object.');
  }

  assertString(value.id, 'project.id', false);
  assertString(value.name, 'project.name', false);
  assertString(value.code, 'project.code');
  assertString(value.color, 'project.color', false);
  assertDateTime(value.createdAt, 'project.createdAt');

  if (!/^#[0-9a-f]{6}$/iu.test(value.color)) {
    throw new DataValidationError('project.color must be a six-digit hex color.');
  }

  if (typeof value.archived !== 'boolean') {
    throw new DataValidationError('project.archived must be a boolean.');
  }
}

export function assertWorkBlock(value: unknown): asserts value is WorkBlock {
  if (!isRecord(value)) {
    throw new DataValidationError('work block must be an object.');
  }

  assertString(value.id, 'block.id', false);
  assertString(value.projectId, 'block.projectId', false);
  assertString(value.projectName, 'block.projectName', false);
  assertString(value.taskLabel, 'block.taskLabel');
  // Reports are saved while users are still entering a work block. Required-field
  // feedback is applied when generating the final report, not while preserving a draft.
  assertString(value.workContent, 'block.workContent');
  assertString(value.status, 'block.status');
  assertString(value.statusDetail, 'block.statusDetail');
  assertString(value.startTime, 'block.startTime');
  assertString(value.endTime, 'block.endTime');
  assertString(value.note, 'block.note');

  if (
    value.progressPercent !== undefined &&
    (typeof value.progressPercent !== 'number' ||
      !Number.isFinite(value.progressPercent) ||
      value.progressPercent < 0 ||
      value.progressPercent > 100)
  ) {
    throw new DataValidationError('block.progressPercent must be a number between 0 and 100.');
  }
}

export function assertProjectsDocument(value: unknown): asserts value is ProjectsDocument {
  if (!isRecord(value) || !Array.isArray(value.projects)) {
    throw new DataValidationError('projects document must contain a projects array.');
  }

  const ids = new Set<string>();
  for (const project of value.projects) {
    assertProject(project);
    if (ids.has(project.id)) {
      throw new DataValidationError('project ids must be unique.');
    }
    ids.add(project.id);
  }
}

export function assertReport(value: unknown): asserts value is Report {
  if (!isRecord(value) || !Array.isArray(value.blocks)) {
    throw new DataValidationError('report must contain a blocks array.');
  }

  assertReportDate(value.date);
  assertString(value.comment, 'report.comment');
  assertDateTime(value.updatedAt, 'report.updatedAt');

  const ids = new Set<string>();
  for (const block of value.blocks) {
    assertWorkBlock(block);
    if (ids.has(block.id)) {
      throw new DataValidationError('block ids must be unique within a report.');
    }
    ids.add(block.id);
  }
}
