export class QwenTTSError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QwenTTSError";
  }
}

export class QwenTTSConnectionError extends QwenTTSError {
  constructor(message: string) {
    super(message);
    this.name = "QwenTTSConnectionError";
  }
}

export class QwenTTSGenerationError extends QwenTTSError {
  constructor(message: string) {
    super(message);
    this.name = "QwenTTSGenerationError";
  }
}
