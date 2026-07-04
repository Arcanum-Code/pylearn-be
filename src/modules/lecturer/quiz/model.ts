import { z } from "zod";
import { createResponseSchema } from "@/libs/response";

export const createQuizResponseSchema = z.object({
  quiz_id: z.string(),
  group_id: z.string(),
  level: z.number(),
  title: z.string(),
  pass_threshold: z.number(),
  status: z.string(),
  questions: z.array(z.any()),
  warning: z.string().optional(),
});

export const LecturerQuizModel = {
  createResponse: createResponseSchema(createQuizResponseSchema),
  createQuestionResponse: createResponseSchema(
    z.object({
      question_id: z.string(),
      quiz_id: z.string(),
      question_text: z.string(),
      key_answer_text: z.string(),
      sequence_order: z.number(),
      blanks: z.array(z.any()),
    }),
  ),
  replaceBlanksResponse: createResponseSchema(
    z.object({
      question_id: z.string(),
      blanks: z.array(
        z.object({
          blank_id: z.string(),
          keyword: z.string(),
          start_index: z.number(),
          end_index: z.number(),
        }),
      ),
    }),
  ),
  updateQuestionResponse: createResponseSchema(
    z.object({
      question_id: z.string(),
      quiz_id: z.string(),
      question_text: z.string(),
      key_answer_text: z.string(),
      sequence_order: z.number(),
      blanks: z.array(
        z.object({
          blank_id: z.string(),
          keyword: z.string(),
          start_index: z.number(),
          end_index: z.number(),
        }),
      ),
      blanks_invalidated: z.boolean().optional(),
      message: z.string().optional(),
    }),
  ),
  deleteQuestionResponse: createResponseSchema(z.null()),
} as const;
