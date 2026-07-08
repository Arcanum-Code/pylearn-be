import { t } from "@/libs/i18n";

export class LecturerGroupsError extends Error {
  readonly key: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    status: number,
    messageKey: string,
    details?: unknown,
    locale = "en",
  ) {
    super(t(locale, messageKey));
    this.name = "LecturerGroupsError";
    this.key = messageKey;
    this.status = status;
    this.details = details;
  }
}
