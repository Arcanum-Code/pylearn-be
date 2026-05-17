import { t } from "@/libs/i18n";

export class DeleteSelfError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "user.deleteSelf"));
    this.key = "user.deleteSelf";
  }
}

export class CreateSystemError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "user.createSystemAdmin"));
    this.key = "user.createSystemAdmin";
  }
}

export class UpdateSystemError extends Error {
  readonly key: string;

  constructor(locale: string = "en") {
    super(t(locale, "user.updateSystemAdmin"));
    this.key = "user.updateSystemAdmin";
  }
}

export class DuplicateUserFieldException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateUserFieldException";
  }
}
