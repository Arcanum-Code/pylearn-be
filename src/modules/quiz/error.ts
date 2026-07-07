export class InvalidTimeRangeError extends Error {
  constructor(message: string = "Start time must be before end time") {
    super(message);
    this.name = "InvalidTimeRangeError";
  }
}

export class CannotDeleteQuestionError extends Error {
  constructor(
    message: string = "Cannot delete question. Questions must be deleted in reverse sequential order.",
  ) {
    super(message);
    this.name = "CannotDeleteQuestionError";
  }
}
