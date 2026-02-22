export class AceStepError extends Error {
  code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "AceStepError";
    this.code = code;
  }
}

export class AceStepTimeoutError extends AceStepError {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "AceStepTimeoutError";
  }
}

export class AceStepGenerationError extends AceStepError {
  constructor(message: string, code?: number) {
    super(message, code);
    this.name = "AceStepGenerationError";
  }
}
