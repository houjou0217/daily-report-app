import * as fileSystem from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { DataReadError, DataWriteError } from '../domain/errors.js';

export type FileSystem = Pick<
  typeof fileSystem,
  'mkdir' | 'readFile' | 'rename' | 'unlink' | 'writeFile'
>;

const hasErrorCode = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;

export class JsonFileStore {
  public constructor(
    private readonly rootDirectory: string,
    private readonly fs: FileSystem = fileSystem,
  ) {}

  public async read<T>(relativePath: string): Promise<T | undefined> {
    try {
      const content = await this.fs.readFile(this.getPath(relativePath), 'utf8');
      return JSON.parse(content) as T;
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return undefined;
      }

      if (error instanceof SyntaxError) {
        throw new DataReadError('Local JSON data is invalid.', { cause: error });
      }

      throw new DataReadError('Local data could not be read.', { cause: error });
    }
  }

  public async write(relativePath: string, value: unknown): Promise<void> {
    const targetPath = this.getPath(relativePath);
    const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;

    try {
      await this.fs.mkdir(dirname(targetPath), { recursive: true });
      await this.fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      await this.fs.rename(temporaryPath, targetPath);
    } catch (error) {
      await this.cleanupTemporaryFile(temporaryPath);
      throw new DataWriteError('Local data could not be saved.', { cause: error });
    }
  }

  public async remove(relativePath: string): Promise<boolean> {
    try {
      await this.fs.unlink(this.getPath(relativePath));
      return true;
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return false;
      }

      throw new DataWriteError('Local data could not be deleted.', { cause: error });
    }
  }

  private getPath(relativePath: string): string {
    return join(this.rootDirectory, relativePath);
  }

  private async cleanupTemporaryFile(temporaryPath: string): Promise<void> {
    try {
      await this.fs.unlink(temporaryPath);
    } catch {
      // A missing temporary file is expected when the initial write failed.
    }
  }
}
