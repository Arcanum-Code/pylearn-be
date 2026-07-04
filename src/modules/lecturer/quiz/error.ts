import { t } from "@/libs/i18n";

export class LecturerQuizError extends Error {
  readonly key: string;
  readonly status: number;
  readonly details?: any;

  constructor(
    status: number,
    messageKey: string,
    details?: any,
    locale = "en",
  ) {
    super(t(locale, messageKey));
    this.name = "LecturerQuizError";
    this.key = messageKey;
    this.status = status;
    this.details = details;
  }
}
