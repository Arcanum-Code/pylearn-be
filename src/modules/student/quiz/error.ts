export class QuizAttemptValidationError extends Error {
  public code = 400;

  constructor(message: string) {
    super(message);
    this.name = "QuizAttemptValidationError";
  }
}

export class QuizAttemptContextException extends Error {
  public code = 403; // Forbidden to answer closed/wrong student attempts

  constructor(message: string) {
    super(message);
    this.name = "QuizAttemptContextException";
  }
}
