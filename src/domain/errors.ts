export class DataValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DataValidationError';
  }
}

export class DataReadError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DataReadError';
  }
}

export class DataWriteError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DataWriteError';
  }
}

export class EntityNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'EntityNotFoundError';
  }
}
