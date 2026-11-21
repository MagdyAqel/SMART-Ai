import { z } from "zod";

const Question = z.object({
  q: z.string().describe("نص السؤال"),
  options: z.array(z.string()).describe("أربعة خيارات"),
  answer: z.number().int().describe("رقم الخيار الصحيح بدءاً من 0"),
  explanation: z.string(),
  difficulty: z.number().int().describe("1 أو 2 أو 3"),
});

export const QuizSchema = z.object({
  title: z.string(),
  questions: z.array(Question),
});

export const CourseSchema = z.object({
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  level: z.string(),
  lessons: z.array(
    z.object({
      title: z.string(),
      minutes: z.number().int(),
      content: z.array(z.string()),
      questions: z.array(Question),
    }),
  ),
});
