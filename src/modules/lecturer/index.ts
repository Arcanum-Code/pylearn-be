import { createBaseApp } from "@/libs/base";
import { lecturerQuiz } from "./quiz";
import { lecturerGroups } from "./groups";

export const lecturer = createBaseApp({ tags: ["Lecturer"] }).group(
  "/lecturer",
  (app) => app.use(lecturerQuiz).use(lecturerGroups),
);
