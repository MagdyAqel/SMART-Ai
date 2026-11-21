// عرض نتيجة التصحيح الذاتي (مشترك بين صفحة المهمة وتقرير الأداء).
import { ar, esc, markdown, progressBar } from "../ui.js";

export function gradeResultHtml(s) {
  const verdict = s.passed ? "ناجح ✅" : `لم تصل إلى ${ar(s.passScore)}% بعد`;
  return `
    <section class="card grade">
      <div class="grade-head">
        <div class="score-ring small" style="--p:${s.pct}"><span>${ar(s.pct)}%</span></div>
        <div>
          <h2>${verdict}</h2>
          <p class="muted">${ar(s.total)} من ${ar(s.max)} درجة · نسبة النجاح ${ar(s.passScore)}%</p>
          ${s.overall ? `<p>${esc(s.overall)}</p>` : ""}
        </div>
      </div>
      <h3>التصحيح حسب المعايير</h3>
      <ul class="criteria">${s.criteria
        .map(
          (c) => `<li>
            <div class="crit-head"><b>${esc(c.criterion)}</b><span>${ar(c.score)} / ${ar(c.points)}</span></div>
            ${progressBar((c.score / c.points) * 100, c.criterion)}
            ${c.evidence ? `<p class="evidence">«${esc(c.evidence)}»</p>` : ""}
            ${c.feedback ? `<p>${esc(c.feedback)}</p>` : ""}
          </li>`,
        )
        .join("")}</ul>
      <div class="grid-2 tight">
        ${s.strengths?.length ? `<div><h3>نقاط القوة</h3><ul>${s.strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
        ${s.improvements?.length ? `<div><h3>للتحسين</h3><ul>${s.improvements.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      </div>
    </section>
    ${
      s.output != null
        ? `<section class="card"><h3>💬 ما أنتجه برومبتك فعلاً</h3><div class="output">${markdown(s.output)}</div></section>`
        : ""
    }
    ${
      s.improved
        ? `<section class="card"><h3>✨ نسخة محسّنة مقترحة</h3><div class="improved">${markdown(s.improved)}</div>
            <button class="btn small" data-copy>نسخ</button></section>`
        : ""
    }`;
}

export function bindCopy(el, text) {
  el.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(text);
      e.target.textContent = "تم النسخ ✓";
    } catch {
      e.target.textContent = "تعذّر النسخ";
    }
  });
}
