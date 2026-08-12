import { describe, expect, it } from 'vitest';

import { DataValidationError } from '../../src/domain/errors.js';
import type { Project } from '../../src/domain/models.js';
import {
  registerProjectIpc,
  type ProjectIpcChannel,
  type ProjectIpcRegistrar,
} from '../../src/main/project-ipc.js';

type Handler = (_event: unknown, ...arguments_: unknown[]) => unknown;

const createProject = (): Project => ({
  id: 'proj-001',
  name: '案件A',
  code: 'A-01',
  color: '#2f746d',
  archived: false,
  createdAt: '2026-08-12T00:00:00.000Z',
});

const createHarness = () => {
  const handlers = new Map<ProjectIpcChannel, Handler>();
  const calls: unknown[][] = [];
  const project = createProject();
  const ipc: ProjectIpcRegistrar = {
    handle: (channel, handler) => {
      handlers.set(channel, handler);
    },
  };
  const dataStore = {
    listProjects: async () => [project],
    createProject: async (input: unknown) => {
      calls.push(['create', input]);
      return project;
    },
    updateProject: async (id: string, input: unknown) => {
      calls.push(['update', id, input]);
      return { ...project, ...(input as Partial<Project>) };
    },
    deleteProject: async (id: string) => {
      calls.push(['delete', id]);
      return true;
    },
  };

  registerProjectIpc(ipc, dataStore);

  const invoke = async (channel: ProjectIpcChannel, ...arguments_: unknown[]) => {
    const handler = handlers.get(channel);
    if (handler === undefined) {
      throw new Error(`Missing handler: ${channel}`);
    }
    return handler({}, ...arguments_);
  };

  return { calls, invoke };
};

describe('project IPC boundary', () => {
  it('registers only the fixed project operations and passes validated values to the data layer', async () => {
    const { calls, invoke } = createHarness();

    await expect(invoke('projects:list')).resolves.toEqual([createProject()]);
    await expect(invoke('projects:create', { name: '案件B', code: 'B-01' })).resolves.toEqual(
      createProject(),
    );
    await expect(invoke('projects:update', 'proj-001', { archived: true })).resolves.toMatchObject({
      archived: true,
    });
    await expect(invoke('projects:delete', 'proj-001')).resolves.toBe(true);

    expect(calls).toEqual([
      ['create', { name: '案件B', code: 'B-01' }],
      ['update', 'proj-001', { archived: true }],
      ['delete', 'proj-001'],
    ]);
  });

  it('rejects generic or malformed IPC input before it reaches the data layer', async () => {
    const { calls, invoke } = createHarness();

    await expect(invoke('projects:list', 'unexpected')).rejects.toBeInstanceOf(DataValidationError);
    await expect(invoke('projects:create', { name: '案件A', command: 'unexpected' })).rejects.toBeInstanceOf(
      DataValidationError,
    );
    await expect(invoke('projects:create', { name: '案件A', color: '#invalid' })).rejects.toBeInstanceOf(
      DataValidationError,
    );
    await expect(invoke('projects:create', { name: 'あ'.repeat(101) })).rejects.toBeInstanceOf(
      DataValidationError,
    );
    await expect(invoke('projects:update', 'proj-001', {})).rejects.toBeInstanceOf(DataValidationError);
    await expect(invoke('projects:update', 'proj-001', { name: '   ' })).rejects.toBeInstanceOf(
      DataValidationError,
    );
    await expect(invoke('projects:delete', '')).rejects.toBeInstanceOf(DataValidationError);

    expect(calls).toEqual([]);
  });
});
