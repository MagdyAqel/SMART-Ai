import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { HttpsError } from "firebase-functions/v2/https";
import { CourseSchema, QuizSchema } from "./schemas.js";
import {
  COURSE_SYSTEM,
  QUIZ_SYSTEM,
  TUTOR_SYSTEM,
  courseUserPrompt,
  lessonContextBlock,
  quizUserPrompt,
} from "./prompts.js";

export const MODEL = "claude-opus-5-5";

// عند رفض النموذج طلباً لأسباب تتعلق بالسلامة، يعيد الخادم تشغيله تلقائياً
// على نموذج بديل مناسب داخل الطلب نفسه.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

let cached;
function client(apiKey) {
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "لم يُضبط مفتاح Claude API على الخادم (ANTHROPIC_API_KEY).");
  }
  if (!cached || cached.apiKey !== apiKey) cached = new Anthropic({ apiKey });
  return cached;
}

/** يحوّل أخطاء Claude API إلى أخطاء Firebase مفهومة للواجهة. */
export function toHttpsError(err) {
  if (err instanceof HttpsError) return err;
  if (err instanceof Anthropic.AuthenticationError) {
    return new HttpsError("failed-precondition", "مفتاح Claude API غير صالح.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpsError("resource-exhausted", "الخدمة مشغولة الآن، حاول بعد قليل.");
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("Claude bad request", err.message);
    return new HttpsError("invalid-argument", "تعذّر معالجة الطلب.");
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Claude API error", err.status, err.message);
    return new HttpsError("unavailable", "خدمة الذكاء الاصطناعي غير متاحة مؤقتاً.");
  }
  if (err?.name === "AbortError" || err instanceof Anthropic.APIUserAbortError) {
    return new HttpsError("cancelled", "أُلغي الطلب.");
  }
  console.error("Unexpected error", err);
  return new HttpsError("internal", "حدث خطأ غير متوقع.");
}

function refusalError() {
  return new HttpsError("permission-denied", "اعتذر المساعد عن هذا الطلب. جرّب صياغة أخرى أو موضوعاً مختلفاً.");
}

/**
 * يبث رد المدرّب نصاً بنص. onText تُستدعى مع كل جزء جديد.
 * يعيد النص الكامل وسبب التوقف.
 */
export async function streamTutorReply({ apiKey, messages, lesson, signal, onText }) {
  const system = [{ type: "text", text: TUTOR_SYSTEM }];
  if (lesson) system.push({ type: "text", text: lessonContextBlock(lesson.course, lesson.lesson) });

  const stream = client(apiKey).beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 16000, // سقف لتكلفة الرد الواحد في المحادثة
      system,
      messages,
      output_config: { effort: "low" }, // محادثة تعليمية: سرعة الرد أهم من التفكير العميق
      ...FALLBACK,
    },
    { signal },
  );

  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      await onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal" && !text) throw refusalError();
  return { text, stopReason: final.stop_reason };
}

export async function generateQuiz({ apiKey, input }) {
  const response = await client(apiKey).beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: QUIZ_SYSTEM,
    messages: [{ role: "user", content: quizUserPrompt(input) }],
    output_config: { effort: "medium", format: betaZodOutputFormat(QuizSchema) },
    ...FALLBACK,
  });
  if (response.stop_reason === "refusal") throw refusalError();
  if (!response.parsed_output) {
    throw new HttpsError("internal", "لم يُرجع النموذج اختباراً بصيغة صحيحة، حاول مرة أخرى.");
  }
  return response.parsed_output;
}

export async function generateCourse({ apiKey, input }) {
  // الدورة الكاملة مخرجات طويلة، لذا نستخدم البث لتجنّب مهلة HTTP ثم نقرأ الرسالة النهائية.
  const stream = client(apiKey).beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system: COURSE_SYSTEM,
    messages: [{ role: "user", content: courseUserPrompt(input) }],
    output_config: { effort: "high", format: betaZodOutputFormat(CourseSchema) },
    ...FALLBACK,
  });
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw refusalError();
  if (final.stop_reason === "max_tokens") {
    throw new HttpsError("resource-exhausted", "الدورة أطول من الحد المسموح، قلّل عدد الدروس.");
  }
  const text = final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  let parsed;
  try {
    parsed = CourseSchema.parse(JSON.parse(text));
  } catch {
    throw new HttpsError("internal", "لم يُرجع النموذج دورة بصيغة صحيحة، حاول مرة أخرى.");
  }
  return parsed;
}
