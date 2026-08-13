import { describe, expect, it, vi } from 'vitest';

import { DataValidationError } from '../../src/domain/errors.js';
import {
  registerClipboardIpc,
  type ClipboardIpcChannel,
  type ClipboardIpcRegistrar,
} from '../../src/main/clipboard-ipc.js';

type Handler = (_event: unknown, ...arguments_: unknown[]) => unknown;

const createHarness = () => {
  const handlers = new Map<ClipboardIpcChannel, Handler>();
  const writeText = vi.fn();
  const ipc: ClipboardIpcRegistrar = {
    handle: (channel, handler) => {
      handlers.set(channel, handler);
    },
  };
  registerClipboardIpc(ipc, { writeText });

  const invoke = async (channel: ClipboardIpcChannel, ...arguments_: unknown[]) => {
    const handler = handlers.get(channel);
    if (handler === undefined) {
      throw new Error(`Missing handler: ${channel}`);
    }
    return handler({}, ...arguments_);
  };
  return { invoke, writeText };
};

describe('clipboard IPC boundary', () => {
  it('writes only the provided report text to the OS clipboard', async () => {
    const { invoke, writeText } = createHarness();

    await expect(invoke('clipboard:write-report', '【日報】2026年08月13日（木）')).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith('【日報】2026年08月13日（木）');
  });

  it('rejects invalid clipboard input before it reaches the OS boundary', async () => {
    const { invoke, writeText } = createHarness();

    await expect(invoke('clipboard:write-report', '')).rejects.toBeInstanceOf(DataValidationError);
    await expect(invoke('clipboard:write-report', { text: 'unexpected' })).rejects.toBeInstanceOf(
      DataValidationError,
    );
    await expect(invoke('clipboard:write-report', '日報', 'unexpected')).rejects.toBeInstanceOf(
      DataValidationError,
    );
    expect(writeText).not.toHaveBeenCalled();
  });
});
