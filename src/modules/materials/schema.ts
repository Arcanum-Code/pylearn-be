import { PaginationSchema } from "@/libs/response";
import { z } from "zod";

export const MaterialTypeEnum = z.enum(["text", "file", "video", "link"]);

export const CreateMaterialSchema = z.object({
  lecturerId: z.string(),
  groupId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  materialType: z.enum(["text", "file", "video", "link"], {
    errorMap: () => ({
      message: 'Must be one of "text", "file", "video", or "link"',
    }),
  }),
  content: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  iconName: z.string().max(50).optional(),
  isPublished: z
    .preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return val;
    }, z.boolean())
    .optional(),
  sequence: z
    .preprocess(
      (val) => (val === undefined || val === null ? undefined : Number(val)),
      z.number().int().optional(),
    )
    .optional(),
  file: z
    .instanceof(File)
    .refine(
      (file) => file.type === "application/pdf",
      "Only PDF files are allowed",
    )
    .refine(
      (file) => file.size <= 10 * 1024 * 1024,
      "File size must be less than 10MB",
    )
    .optional(),
});

export const CreateMaterialMeSchema = CreateMaterialSchema.omit({
  lecturerId: true,
});

export const UpdateMaterialSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    materialType: z
      .enum(["text", "file", "video", "link"], {
        errorMap: () => ({
          message: 'Must be one of "text", "file", "video", or "link"',
        }),
      })
      .optional(),
    content: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    iconName: z.string().max(50).optional(),
    isPublished: z
      .preprocess((val) => {
        if (val === "true" || val === true) return true;
        if (val === "false" || val === false) return false;
        return val;
      }, z.boolean())
      .optional(),
    sequence: z
      .preprocess(
        (val) => (val === undefined || val === null ? undefined : Number(val)),
        z.number().int().optional(),
      )
      .optional(),
    forceReread: z
      .preprocess((val) => {
        if (val === "true" || val === true) return true;
        if (val === "false" || val === false) return false;
        return val;
      }, z.boolean())
      .optional(),
    file: z
      .instanceof(File)
      .refine(
        (file) => file.type === "application/pdf",
        "Only PDF files are allowed",
      )
      .refine(
        (file) => file.size <= 10 * 1024 * 1024,
        "File size must be less than 10MB",
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for modification updating",
  });

export const MaterialParamSchema = z.object({
  id: z.string(),
});

export const GetMaterialsQuerySchema = PaginationSchema.extend({
  lecturerId: z.string().optional(),
  materialType: MaterialTypeEnum.optional(),
  isPublished: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((val) => val === true || val === "true")
    .optional(),
});

export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;
export type CreateMaterialMeInput = z.infer<typeof CreateMaterialMeSchema>;
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;
