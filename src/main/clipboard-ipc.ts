import { DataValidationError } from '../domain/errors.js';

type ClipboardIpcChannel = 'clipboard:write-report';
type IpcHandler = (_event: unknown, ...arguments_: unknown[]) => unknown;

export interface ClipboardIpcRegistrar {
  handle: (channel: ClipboardIpcChannel, listener: IpcHandler) => void;
}

export interface ClipboardAccess {
  writeText: (text: string) => void;
}

const assertNoExtraArguments = (arguments_: unknown[]): void => {
  if (arguments_.length !== 0) {
    throw new DataValidationError('This operation does not accept extra arguments.');
  }
};

function assertReportText(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DataValidationError('Report text must be a non-empty string.');
  }
}

export const registerClipboardIpc = (
  ipc: ClipboardIpcRegistrar,
  clipboard: ClipboardAccess,
): void => {
  ipc.handle('clipboard:write-report', async (_event, text, ...arguments_) => {
    assertNoExtraArguments(arguments_);
    assertReportText(text);
    clipboard.writeText(text);
  });
};

export type { ClipboardIpcChannel };
