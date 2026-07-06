import { createBaseApp } from "@/libs/base";
import { lecturerQuiz } from "./quiz";

export const lecturer = createBaseApp({ tags: ["Lecturer"] }).group(
  "/lecturer",
  (app) => app.use(lecturerQuiz),
);
