import { createBaseApp } from "@/libs/base";
import { studentGroups } from "./groups";
import { studentMaterials } from "./materials";

export const student = createBaseApp({ tags: ["Student"] }).group(
  "/student",
  (app) => app.use(studentGroups).use(studentMaterials),
);
