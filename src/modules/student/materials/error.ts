import { t } from "@/libs/i18n";

export class MaterialNotFoundError extends Error {
  readonly key = "common.notFound";

  constructor(locale: string = "en") {
    super(t(locale, "common.notFound"));
    this.name = "MaterialNotFoundError";
  }
}
