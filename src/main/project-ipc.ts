import type { LocalDataStore } from '../data/local-data-store.js';
import { DataValidationError } from '../domain/errors.js';
import type { CreateProjectInput, Project, UpdateProjectInput } from '../domain/models.js';

type ProjectIpcChannel =
  | 'projects:list'
  | 'projects:create'
  | 'projects:update'
  | 'projects:delete';

type IpcHandler = (_event: unknown, ...arguments_: unknown[]) => unknown;

export interface ProjectIpcRegistrar {
  handle: (channel: ProjectIpcChannel, listener: IpcHandler) => void;
}

type ProjectDataAccess = Pick<
  LocalDataStore,
  'createProject' | 'deleteProject' | 'listProjects' | 'updateProject'
>;

const MAX_PROJECT_NAME_LENGTH = 100;
const MAX_PROJECT_CODE_LENGTH = 50;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function assertAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowedKeys.includes(key))) {
    throw new DataValidationError('Unexpected project input field.');
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DataValidationError(`${field} is required.`);
  }
}

function assertOptionalString(
  value: unknown,
  field: string,
): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new DataValidationError(`${field} must be a string.`);
  }
}

function assertMaximumLength(value: string, field: string, maximum: number): void {
  if (value.length > maximum) {
    throw new DataValidationError(`${field} must be ${maximum} characters or fewer.`);
  }
}

function assertOptionalColor(value: unknown): asserts value is string | undefined {
  assertOptionalString(value, 'color');
  if (value !== undefined && !HEX_COLOR_PATTERN.test(value)) {
    throw new DataValidationError('color must be a six-digit hex color.');
  }
}

function assertOptionalBoolean(
  value: unknown,
  field: string,
): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new DataValidationError(`${field} must be a boolean.`);
  }
}

const parseCreateProjectInput = (value: unknown): CreateProjectInput => {
  if (!isRecord(value)) {
    throw new DataValidationError('Project input must be an object.');
  }

  assertAllowedKeys(value, ['name', 'code', 'color']);
  assertNonEmptyString(value.name, 'name');
  assertMaximumLength(value.name, 'name', MAX_PROJECT_NAME_LENGTH);
  assertOptionalString(value.code, 'code');
  if (value.code !== undefined) {
    assertMaximumLength(value.code, 'code', MAX_PROJECT_CODE_LENGTH);
  }
  assertOptionalColor(value.color);

  return {
    name: value.name,
    ...(value.code === undefined ? {} : { code: value.code }),
    ...(value.color === undefined ? {} : { color: value.color }),
  };
};

const parseUpdateProjectInput = (value: unknown): UpdateProjectInput => {
  if (!isRecord(value)) {
    throw new DataValidationError('Project update must be an object.');
  }

  assertAllowedKeys(value, ['name', 'code', 'color', 'archived']);
  if (value.name !== undefined) {
    assertNonEmptyString(value.name, 'name');
    assertMaximumLength(value.name, 'name', MAX_PROJECT_NAME_LENGTH);
  }
  assertOptionalString(value.code, 'code');
  if (value.code !== undefined) {
    assertMaximumLength(value.code, 'code', MAX_PROJECT_CODE_LENGTH);
  }
  assertOptionalColor(value.color);
  assertOptionalBoolean(value.archived, 'archived');

  if (Object.keys(value).length === 0) {
    throw new DataValidationError('Project update must contain a changed field.');
  }

  return {
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(value.code === undefined ? {} : { code: value.code }),
    ...(value.color === undefined ? {} : { color: value.color }),
    ...(value.archived === undefined ? {} : { archived: value.archived }),
  };
};

function assertProjectId(value: unknown): asserts value is string {
  assertNonEmptyString(value, 'project id');
}

const assertNoArguments = (arguments_: unknown[]): void => {
  if (arguments_.length !== 0) {
    throw new DataValidationError('This operation does not accept arguments.');
  }
};

export const registerProjectIpc = (
  ipc: ProjectIpcRegistrar,
  dataStore: ProjectDataAccess,
): void => {
  ipc.handle('projects:list', async (_event, ...arguments_) => {
    assertNoArguments(arguments_);
    return dataStore.listProjects();
  });

  ipc.handle('projects:create', async (_event, input, ...arguments_) => {
    assertNoArguments(arguments_);
    return dataStore.createProject(parseCreateProjectInput(input));
  });

  ipc.handle('projects:update', async (_event, id, input, ...arguments_) => {
    assertNoArguments(arguments_);
    assertProjectId(id);
    return dataStore.updateProject(id, parseUpdateProjectInput(input));
  });

  ipc.handle('projects:delete', async (_event, id, ...arguments_) => {
    assertNoArguments(arguments_);
    assertProjectId(id);
    return dataStore.deleteProject(id);
  });
};

export type { Project, ProjectIpcChannel };
