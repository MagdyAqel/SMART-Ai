import { z } from "zod";

const Question = z.object({
  q: z.string().describe("نص السؤال"),
  options: z.array(z.string()).describe("أربعة خيارات"),
  answer: z.number().int().describe("رقم الخيار الصحيح بدءاً من 0"),
  explanation: z.string(),
  difficulty: z.number().int().describe("1 أو 2 أو 3"),
});

const Task = z.object({
  type: z.enum(["prompt", "written"]),
  title: z.string(),
  instructions: z.string(),
  material: z.string(),
  passScore: z.number().int(),
  rubric: z.array(z.object({ criterion: z.string(), description: z.string(), points: z.number().int() })),
});

export const GradeSchema = z.object({
  criteria: z.array(
    z.object({
      id: z.string().describe("معرّف المعيار كما ورد، مثل c1"),
      score: z.number().int(),
      evidence: z.string(),
      feedback: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  overall_feedback: z.string(),
  improved_version: z.string(),
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
      tasks: z.array(Task),
    }),
  ),
});
