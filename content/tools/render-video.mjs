// يُنتج فيديو إنفوجرافيك متحرك لمهارة من ملف video.json:
//   node render-video.mjs ../skill-01
//
// المدخلات في مجلد المهارة:
//   video.json            المشاهد ونوع كل مشهد وبياناته
//   raw/narration.mp3     التعليق الصوتي
//   raw/words.json        توقيت كل كلمة (من التفريغ الصوتي) لمزامنة المشاهد والترجمة
//   raw/music.wav, raw/whoosh.mp3, raw/*.jpg
// المخرجات في web/public/media/<skill>/:
//   intro-video.mp4, intro-video.ar.vtt, poster.jpg
//
// الرسم حتمي: نوقف كل الحركات ونضبط زمنها إطاراً إطاراً، فلا تتأثر الجودة بسرعة الجهاز.

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SKILL_DIR = resolve(process.argv[2] || "../skill-01");
const SKILL = basename(SKILL_DIR);
const OUT_DIR = resolve(HERE, "../../web/public/media", SKILL);
const FPS = Number(process.env.FPS || 25);
const W = 1920;
const H = 1080;
const LEAD_IN = 1.4; // ثوانٍ قبل بدء التعليق (افتتاحية)
const TAIL = 3.0; // ثوانٍ بعد انتهاء التعليق (خاتمة)
const PREVIEW = process.env.PREVIEW; // "12,40" لعرض صور عند ثوانٍ محددة بدل الفيديو كاملاً

const spec = JSON.parse(readFileSync(join(SKILL_DIR, "video.json"), "utf8"));
const words = JSON.parse(readFileSync(join(SKILL_DIR, "raw/words.json"), "utf8"));
const narrationPath = join(SKILL_DIR, "raw/narration.mp3");
const narrationDur = Number(
  execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", narrationPath]).toString(),
);
const TOTAL = LEAD_IN + narrationDur + TAIL;

// ---------- مزامنة المشاهد مع الكلمات ----------

const norm = (s) =>
  String(s)
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const W_ = words.filter((w) => norm(w.text)).map((w) => ({ ...w, n: norm(w.text) }));

/** أول موضع (بعد from) تتطابق فيه الكلمات التالية مع بداية العبارة. */
function findPhrase(phrase, from = 0) {
  const target = norm(phrase).split(" ").slice(0, 3);
  for (let i = from; i < W_.length; i++) {
    if (target.every((t, k) => W_[i + k] && (W_[i + k].n === t || W_[i + k].n.includes(t) || t.includes(W_[i + k].n)))) return i;
  }
  return -1;
}

let cursor = 0;
const scenes = spec.scenes.map((s0) => {
  // صورة غير موجودة بعد (مثل صور ChatGPT المنتظرة): يُعرض المشهد بخلفية التصميم
  const s = s0.image && !existsSync(join(SKILL_DIR, "raw", s0.image)) ? { ...s0, image: null } : s0;
  const idx = findPhrase(s.text, cursor);
  if (idx < 0) throw new Error(`لم أجد بداية المشهد ${s.id} في التفريغ`);
  cursor = idx + 1;
  return { ...s, wordIndex: idx, speechStart: W_[idx].start };
});
scenes.forEach((s, i) => {
  s.start = i === 0 ? 0 : LEAD_IN + s.speechStart - 0.35;
  const next = scenes[i + 1];
  s.end = next ? LEAD_IN + next.speechStart - 0.35 : TOTAL;
  s.lastWord = next ? next.wordIndex - 1 : W_.length - 1;
});

/** زمن نطق كلمة مفتاحية داخل المشهد (مطلق)، أو نسبة من مدة المشهد. */
function cue(scene, key, fallbackRatio = 0.2) {
  if (typeof key === "number") return scene.start + (scene.end - scene.start) * key;
  const i = findPhrase(key, scene.wordIndex);
  if (i >= 0 && i <= scene.lastWord + 2) return LEAD_IN + W_[i].start - 0.15;
  console.warn(`  ! لم أجد «${key}» في المشهد ${scene.id}، أستخدم نسبة تقريبية`);
  return scene.start + (scene.end - scene.start) * fallbackRatio;
}

// ---------- الأصول ----------

const fontDir = join(HERE, "node_modules/@fontsource/ibm-plex-sans-arabic/files");
const font = (w, subset) => `file://${join(fontDir, `ibm-plex-sans-arabic-${subset}-${w}-normal.woff2`)}`;
const icon = (name) =>
  readFileSync(join(HERE, "node_modules/lucide-static/icons", `${name}.svg`), "utf8")
    .replace(/<!--.*?-->/gs, "")
    .replace(/width="24"/, 'width="100%"')
    .replace(/height="24"/, 'height="100%"')
    .replace(/<(path|circle|rect|line|polyline|polygon|ellipse)\b/g, '<$1 pathLength="1"');
const img = (f) => `file://${join(SKILL_DIR, "raw", f)}`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const at = (t) => `style="--d:${t.toFixed(2)}s"`;

// ---------- قوالب المشاهد ----------

const templates = {
  hook(s) {
    return `
      <div class="photo kb" style="background-image:url('${img(s.image)}');--d:${s.start}s;--len:${s.end - s.start + 1}s"></div>
      <div class="shade"></div>
      <div class="hook">
        <div class="kicker in" ${at(s.start + 0.5)}>${esc(s.kicker)}</div>
        <h1 class="in" ${at(s.start + 0.9)}>${esc(s.title)}</h1>
        <p class="in" ${at(cue(s, s.subtitleAt, 0.75))}>${esc(s.subtitle)}</p>
      </div>`;
  },
  definition(s) {
    return `
      <div class="center col">
        <div class="badge pop" ${at(s.start + 0.3)}>${icon(s.icon)}</div>
        <h2 class="term in" ${at(s.start + 0.5)}>${esc(s.term)}</h2>
        <p class="def in" ${at(s.start + 1.1)}>${esc(s.definition)}</p>
        ${
          s.chips
            ? `<div class="chips">${s.chips
                .map((c) => `<div class="chip pop" ${at(cue(s, c.at, 0.3))}><i>${icon(c.icon)}</i>${esc(c.label)}</div>`)
                .join("")}</div>`
            : ""
        }
        ${
          s.branch
            ? `<div class="branch in" ${at(cue(s, s.branch.at, 0.55))}>
                <div class="branch-title"><i>${icon("sparkles")}</i>${esc(s.branch.title)}</div>
                <div class="chips small">${s.branch.items
                  .map((c) => `<div class="chip alt pop" ${at(cue(s, c.at, 0.7))}><i>${icon(c.icon)}</i>${esc(c.label)}</div>`)
                  .join("")}</div>
              </div>`
            : ""
        }
      </div>`;
  },
  tokens(s) {
    const t0 = cue(s, s.buildAt, 0.35);
    const span = Math.max(4, cue(s, s.doneAt, 0.85) - t0);
    const step = span / s.sentence.length;
    return `
      <div class="center col">
        <h2 class="title in" ${at(s.start + 0.3)}><i class="ti">${icon("brain")}</i>${esc(s.title)}</h2>
        <div class="corpus in" ${at(s.start + 0.8)}>${Array.from({ length: 36 }, (_, i) => `<span style="--k:${i}"></span>`).join("")}</div>
        <div class="sentence">${s.sentence
          .map((w, i) => `<span class="word ${i === s.sentence.length - 1 ? "last" : ""} pop" ${at(t0 + i * step)}>${esc(w)}</span>`)
          .join("")}<span class="caret" ${at(t0)}></span></div>
        <div class="candidates in" ${at(t0 + step * (s.sentence.length - 2))}>
          <div class="cand-title">الكلمة التالية الأنسب؟</div>
          ${s.candidates
            .map(
              (c, i) => `<div class="cand ${i === 0 ? "best" : ""}"><span>${esc(c.word)}</span><b class="grow-x" style="--d:${(
                t0 + step * (s.sentence.length - 2) + 0.3 + i * 0.15
              ).toFixed(2)}s;--w:${c.p}%"></b><em>${c.p}%</em></div>`,
            )
            .join("")}
        </div>
      </div>`;
  },
  cards(s) {
    return `
      <div class="center col">
        <h2 class="title in" ${at(s.start + 0.3)}><i class="ti">${icon(s.icon)}</i>${esc(s.title)}</h2>
        <div class="cards">${s.cards
          .map(
            (c) => `<div class="card pop ${c.tone || ""}" ${at(cue(s, c.at, 0.3))}>
              <div class="card-icon">${icon(c.icon)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`,
          )
          .join("")}</div>
      </div>`;
  },
  pillars(s) {
    return `
      <div class="center col">
        <h2 class="title in" ${at(s.start + 0.3)}><i class="ti">${icon("target")}</i>${esc(s.title)}</h2>
        <div class="pillars">${s.pillars
          .map(
            (p, i) => `<div class="pillar pop" style="--c:${p.color};--d:${cue(s, p.at, 0.15 + i * 0.16).toFixed(2)}s">
              <div class="p-num">${i + 1}</div><div class="p-icon">${icon(p.icon)}</div>
              <h3>${esc(p.name)}</h3><p>${esc(p.example)}</p></div>`,
          )
          .join("")}</div>
      </div>`;
  },
  compare(s) {
    const strongAt = cue(s, s.strong.at, 0.35);
    return `
      <div class="center col">
        <h2 class="title in" ${at(s.start + 0.3)}><i class="ti">${icon("scale")}</i>${esc(s.title)}</h2>
        <div class="compare">
          <div class="pcard weak pop" ${at(cue(s, s.weak.at, 0.12))}>
            <div class="pc-head"><i>${icon("x")}</i>${esc(s.weak.label)}</div>
            <p class="prompt">«${esc(s.weak.text)}»</p>
          </div>
          <div class="pcard strong pop" ${at(strongAt)}>
            <div class="pc-head"><i>${icon("check")}</i>${esc(s.strong.label)}</div>
            <p class="prompt">«${s.strong.parts
              .map((p, i) => `<span class="seg hl" style="--c:${p.color};--d:${(strongAt + 0.6 + i * 1.6).toFixed(2)}s">${esc(p.text)}</span>`)
              .join(" ")}»</p>
            <div class="legend">${s.strong.parts
              .filter((p) => p.tag)
              .map((p, i) => `<span class="fade" style="--c:${p.color};--d:${(strongAt + 0.6 + i * 1.6).toFixed(2)}s">${esc(p.tag)}</span>`)
              .join("")}</div>
          </div>
        </div>
        <div class="moral in" ${at(cue(s, s.moralAt, 0.85))}>${esc(s.moral)}</div>
      </div>`;
  },
  steps(s) {
    const items = s.steps.map((st, i) => ({ ...st, t: cue(s, st.at, 0.15 + i * (0.75 / s.steps.length)) }));
    const first = items[0].t;
    const last = items.at(-1).t;
    return `
      <div class="center col">
        <h2 class="title in" ${at(s.start + 0.3)}><i class="ti">${icon(s.icon || "list-checks")}</i>${esc(s.title)}</h2>
        <div class="flow" style="--n:${items.length}">
          <div class="flow-line"><b style="--d:${first.toFixed(2)}s;--len:${Math.max(0.5, last - first + 0.6).toFixed(2)}s"></b></div>
          ${items
            .map(
              (st, i) => `<div class="fstep pop" style="--d:${st.t.toFixed(2)}s;--c:${st.color || "#2dd4bf"}">
                <div class="fnum">${i + 1}</div>
                <div class="ficon">${icon(st.icon)}</div>
                <h3>${esc(st.title)}</h3><p>${esc(st.text)}</p>
              </div>`,
            )
            .join("")}
        </div>
      </div>`;
  },
  closing(s) {
    return `
      ${s.image ? `<div class="photo kb dim" style="background-image:url('${img(s.image)}');--d:${s.start}s;--len:${s.end - s.start + 1}s"></div><div class="shade"></div>` : ""}
      <div class="center col">
        <h2 class="big in" ${at(s.start + 0.4)}>${esc(s.title)}</h2>
        <div class="steps">${s.steps
          .map(
            (st, i) => `${i ? `<div class="arrow in" ${at(cue(s, st.at, 0.5 + i * 0.12) - 0.2)}>←</div>` : ""}
            <div class="step pop" ${at(cue(s, st.at, 0.5 + i * 0.12))}><i>${icon(st.icon)}</i><span>${esc(st.label)}</span></div>`,
          )
          .join("")}</div>
        <div class="brand-end in" ${at(TOTAL - 2.6)}><span class="logo">◆</span> منصة التدريب الذكي</div>
      </div>`;
  },
};

function sceneHtml(s, i) {
  const fadeOut = i === scenes.length - 1 ? TOTAL + 10 : s.end - 0.35;
  return `<section class="scene t-${s.type}" style="--in:${s.start.toFixed(2)}s;--out:${fadeOut.toFixed(2)}s">${templates[s.type](s)}</section>`;
}

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:400;src:url(${font(400, "arabic")})}
@font-face{font-family:Plex;font-weight:500;src:url(${font(500, "arabic")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font(700, "arabic")})}
@font-face{font-family:Plex;font-weight:400;src:url(${font(400, "latin")});unicode-range:U+0000-00FF}
@font-face{font-family:Plex;font-weight:700;src:url(${font(700, "latin")});unicode-range:U+0000-00FF}
:root{--bg1:#06201f;--bg2:#0b3b36;--teal:#2dd4bf;--amber:#fbbf24;--coral:#f87171;--green:#4ade80;--ink:#ecfdf9;--muted:#9fc9c1}
*{box-sizing:border-box;margin:0}
*,*::before,*::after{animation-play-state:paused!important}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--bg1);font-family:Plex,sans-serif;color:var(--ink)}
.stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;
  background:radial-gradient(1200px 700px at 80% 10%,#0f5a52 0%,transparent 60%),radial-gradient(900px 600px at 10% 100%,#0a4a5c 0%,transparent 55%),linear-gradient(160deg,var(--bg1),var(--bg2))}
.grid{position:absolute;inset:-40px;background-image:radial-gradient(rgba(45,212,191,.18) 1.5px,transparent 1.6px);background-size:44px 44px;
  animation:drift ${TOTAL}s linear both}
@keyframes drift{to{transform:translate(-44px,-88px)}}
.scene{position:absolute;inset:0;opacity:0;animation:sIn .5s ease var(--in) both,sOut .45s ease var(--out) forwards}
@keyframes sIn{from{opacity:0}to{opacity:1}} @keyframes sOut{from{opacity:1}to{opacity:0}}
.in{opacity:0;animation:fadeUp .7s cubic-bezier(.2,.8,.2,1) var(--d) both}
@keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
.pop{opacity:0;animation:pop .6s cubic-bezier(.3,1.5,.5,1) var(--d) both}
@keyframes pop{from{opacity:0;transform:scale(.82) translateY(16px)}to{opacity:1;transform:none}}
.fade{opacity:0;animation:fade .5s ease var(--d) both} @keyframes fade{to{opacity:1}}
.kb{animation:kb var(--len) linear var(--d) both} @keyframes kb{from{transform:scale(1.02)}to{transform:scale(1.14) translateX(-30px)}}
.photo{position:absolute;inset:0;background-size:cover;background-position:center;filter:saturate(1.05)}
.photo.dim{filter:saturate(.8) brightness(.75)}
.shade{position:absolute;inset:0;background:linear-gradient(270deg,rgba(4,28,26,.92) 0%,rgba(4,28,26,.75) 42%,rgba(4,28,26,.15) 75%)}
.t-closing .shade{background:rgba(4,28,26,.72)}
.center{position:absolute;inset:120px 140px 110px;display:flex;align-items:center;justify-content:center}
.col{flex-direction:column;gap:34px;text-align:center}
svg{display:block}
/* hook */
.hook{position:absolute;right:150px;top:50%;transform:translateY(-50%);width:880px}
.kicker{display:inline-block;color:var(--bg1);background:var(--teal);font-weight:700;font-size:30px;padding:8px 26px;border-radius:99px;margin-bottom:28px}
.hook h1{font-size:104px;font-weight:700;line-height:1.15;margin-bottom:26px;text-shadow:0 4px 30px rgba(0,0,0,.4)}
.hook p{font-size:46px;line-height:1.5;color:#d8f3ee}
/* headings */
.title{font-size:68px;font-weight:700;display:flex;align-items:center;gap:22px}
.ti{width:72px;height:72px;color:var(--teal);display:inline-block}
.big{font-size:84px;font-weight:700;line-height:1.3;max-width:1400px}
.badge{width:132px;height:132px;padding:30px;border-radius:36px;background:rgba(45,212,191,.14);border:2px solid rgba(45,212,191,.5);color:var(--teal)}
.term{font-size:96px;font-weight:700;background:linear-gradient(90deg,var(--teal),#a7f3d0);-webkit-background-clip:text;color:transparent;padding-bottom:6px}
.def{font-size:44px;line-height:1.6;max-width:1350px;color:#d7efea}
.chips{display:flex;gap:24px;justify-content:center;flex-wrap:wrap}
.chip{display:flex;align-items:center;gap:14px;font-size:38px;font-weight:500;padding:16px 32px;border-radius:22px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.18)}
.chip i{width:42px;height:42px;color:var(--teal)}
.chips.small .chip{font-size:34px;padding:12px 26px}
.chip.alt i{color:var(--amber)}
.branch{display:flex;flex-direction:column;gap:20px;align-items:center;padding:26px 40px;border-radius:30px;border:2px dashed rgba(251,191,36,.55);background:rgba(251,191,36,.06)}
.branch-title{display:flex;gap:14px;align-items:center;font-size:42px;font-weight:700;color:var(--amber)}
.branch-title i{width:44px;height:44px}
/* tokens */
.corpus{display:grid;grid-template-columns:repeat(18,1fr);gap:10px;width:900px;opacity:.9}
.corpus span{height:12px;border-radius:6px;background:rgba(159,201,193,.25)}
.corpus span:nth-child(3n){background:rgba(45,212,191,.35)} .corpus span:nth-child(5n){width:60%}
.sentence{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;font-size:64px;font-weight:700;min-height:100px;align-items:center;max-width:1500px}
.word{padding:6px 22px;border-radius:16px;background:rgba(255,255,255,.08)}
.word.last{background:var(--teal);color:var(--bg1)}
.caret{width:6px;height:70px;background:var(--teal);opacity:0;animation:blink 1s steps(2) var(--d) 40 both}
@keyframes blink{0%{opacity:1}50%{opacity:0}}
.candidates{width:760px;padding:26px 34px;border-radius:26px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.15);text-align:right}
.cand-title{font-size:32px;color:var(--muted);margin-bottom:14px}
.cand{display:grid;grid-template-columns:200px 1fr 90px;align-items:center;gap:18px;font-size:38px;margin:10px 0}
.cand b{height:20px;border-radius:10px;background:rgba(159,201,193,.45);width:var(--w);transform-origin:right;animation:growX .9s ease var(--d) both}
.cand.best b{background:var(--teal)} .cand.best span{color:var(--teal);font-weight:700}
.cand em{font-style:normal;color:var(--muted);font-size:32px}
@keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
/* cards */
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;width:1560px}
.card{padding:44px 38px;border-radius:32px;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.14);text-align:right}
.card-icon{width:84px;height:84px;padding:18px;border-radius:24px;background:rgba(248,113,113,.15);color:var(--coral);margin-bottom:24px}
.card.amber .card-icon{background:rgba(251,191,36,.15);color:var(--amber)}
.card.teal .card-icon{background:rgba(45,212,191,.15);color:var(--teal)}
.card h3{font-size:46px;margin-bottom:12px} .card p{font-size:34px;line-height:1.55;color:#cfe8e3}
/* pillars */
.pillars{display:grid;grid-template-columns:repeat(5,1fr);gap:26px;width:1660px}
.pillar{position:relative;padding:40px 22px 34px;border-radius:30px;background:rgba(255,255,255,.06);border:2px solid color-mix(in srgb,var(--c) 70%,transparent);text-align:center}
.pillar::after{content:"";position:absolute;inset:-2px;border-radius:30px;box-shadow:0 0 0 6px color-mix(in srgb,var(--c) 40%,transparent);opacity:0;animation:glow 1.6s ease var(--d) both}
@keyframes glow{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
.p-num{position:absolute;top:-26px;right:50%;transform:translateX(50%);width:52px;height:52px;border-radius:50%;background:var(--c);color:var(--bg1);font-weight:700;font-size:30px;display:grid;place-items:center}
.p-icon{width:74px;height:74px;margin:6px auto 16px;color:var(--c)}
.pillar h3{font-size:46px;color:var(--c);margin-bottom:12px} .pillar p{font-size:28px;line-height:1.5;color:#d4ece7}
/* compare */
.compare{display:grid;grid-template-columns:1fr 1.7fr;gap:44px;width:1640px;align-items:stretch}
.pcard{padding:36px 40px;border-radius:30px;text-align:right;background:rgba(255,255,255,.06);border:2px solid}
.pcard.weak{border-color:rgba(248,113,113,.6)} .pcard.strong{border-color:rgba(74,222,128,.6)}
.pc-head{display:flex;align-items:center;gap:14px;font-size:36px;font-weight:700;margin-bottom:20px}
.pc-head i{width:46px;height:46px;padding:6px;border-radius:50%}
.weak .pc-head{color:var(--coral)} .weak .pc-head i{background:rgba(248,113,113,.2)}
.strong .pc-head{color:var(--green)} .strong .pc-head i{background:rgba(74,222,128,.2)}
.prompt{font-size:38px;line-height:1.75}
.seg{border-radius:10px;padding:2px 6px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.hl{animation:hl .6s ease var(--d) both} @keyframes hl{from{background:transparent}to{background:color-mix(in srgb,var(--c) 32%,transparent)}}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:22px}
.legend span{font-size:26px;padding:6px 16px;border-radius:99px;background:color-mix(in srgb,var(--c) 30%,transparent);border:1.5px solid var(--c)}
.moral{font-size:48px;font-weight:700;color:var(--amber)}
/* closing */
.steps{display:flex;align-items:center;gap:26px}
.step{display:flex;align-items:center;gap:16px;font-size:42px;font-weight:700;padding:22px 36px;border-radius:24px;background:rgba(45,212,191,.16);border:2px solid rgba(45,212,191,.6)}
.step i{width:50px;height:50px;color:var(--teal)}
.arrow{font-size:56px;color:var(--teal)}
.brand-end{font-size:40px;font-weight:700;color:var(--muted);margin-top:20px} .logo{color:var(--teal)}
/* رموز متحركة: ترسم نفسها ثم تطفو بهدوء */
.scene svg [pathLength]{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.1s cubic-bezier(.6,.1,.3,1) calc(var(--d, 0s) + .2s) both}
@keyframes draw{to{stroke-dashoffset:0}}
.card-icon,.p-icon,.ficon{animation:floaty 3.2s ease-in-out calc(var(--d, 0s) + 1.3s) infinite both}
.badge.pop{animation:pop .6s cubic-bezier(.3,1.5,.5,1) var(--d) both,floaty 3.2s ease-in-out calc(var(--d) + 1.3s) infinite}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.ti svg{animation:spinIn .9s cubic-bezier(.3,1.4,.5,1) var(--d, 0s) both}
@keyframes spinIn{from{transform:rotate(-90deg) scale(.4);opacity:0}to{transform:none;opacity:1}}
/* steps */
.flow{position:relative;display:grid;grid-template-columns:repeat(var(--n),1fr);gap:26px;width:1660px;padding-top:30px}
.flow-line{position:absolute;top:66px;left:calc(100% / (2 * var(--n)));right:calc(100% / (2 * var(--n)));height:6px;border-radius:6px;background:rgba(255,255,255,.12)}
.flow-line b{display:block;height:100%;border-radius:inherit;background:linear-gradient(270deg,var(--teal),var(--amber));transform-origin:right;animation:growX var(--len) linear var(--d) both}
.fstep{position:relative;z-index:1;text-align:center;padding:0 10px}
.fnum{width:72px;height:72px;margin:0 auto 18px;border-radius:50%;display:grid;place-items:center;font-size:36px;font-weight:700;color:var(--bg1);background:var(--c);box-shadow:0 0 0 10px rgba(6,32,31,.9),0 0 30px color-mix(in srgb,var(--c) 60%,transparent)}
.ficon{width:76px;height:76px;margin:0 auto 14px;padding:16px;border-radius:22px;color:var(--c);background:color-mix(in srgb,var(--c) 15%,transparent);border:2px solid color-mix(in srgb,var(--c) 45%,transparent)}
.fstep h3{font-size:40px;margin-bottom:10px;color:var(--c)}
.fstep p{font-size:28px;line-height:1.5;color:#d4ece7}
/* chrome */
.top{position:absolute;top:44px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;font-size:28px;z-index:5}
.top .brand{font-weight:700;color:#d8f3ee} .top .skill{padding:6px 22px;border-radius:99px;border:1.5px solid rgba(255,255,255,.3);color:#d8f3ee}
.progress{position:absolute;left:0;right:0;bottom:0;height:8px;background:rgba(255,255,255,.08);z-index:5}
.progress b{display:block;height:100%;background:linear-gradient(90deg,var(--teal),var(--amber));transform-origin:right;animation:growX ${TOTAL}s linear 0s both}
.intro-sting{position:absolute;inset:0;display:grid;place-items:center;z-index:6;background:var(--bg1);animation:sting 1.4s ease 0s both}
.intro-sting div{font-size:64px;font-weight:700;color:var(--teal);animation:pop .8s cubic-bezier(.3,1.5,.5,1) .1s both}
@keyframes sting{0%,70%{opacity:1}100%{opacity:0;visibility:hidden}}
</style></head><body><div class="stage"><div class="grid"></div>
${scenes.map(sceneHtml).join("\n")}
<div class="top"><span class="brand"><span class="logo">◆</span> منصة التدريب الذكي</span><span class="skill">${esc(spec.badge)}</span></div>
<div class="progress"><b></b></div>
<div class="intro-sting"><div>${esc(spec.sting)}</div></div>
</div></body></html>`;

// ---------- الترجمة المصاحبة (WebVTT) ----------

function vtt() {
  const fmt = (t) => {
    const ms = Math.round(t * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
    return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
  };
  const cues = [];
  let cur = [];
  for (const w of words.filter((x) => x.type !== "spacing" && String(x.text).trim())) {
    cur.push(w);
    const text = cur.map((x) => x.text.trim()).join(" ");
    if (/[.،:؛؟!]$/.test(w.text.trim()) || cur.length >= 9 || text.length > 60) {
      cues.push(cur);
      cur = [];
    }
  }
  if (cur.length) cues.push(cur);
  return (
    "WEBVTT\n\n" +
    cues
      .map((c, i) => {
        const end = Math.min(c.at(-1).end + 0.2, cues[i + 1]?.[0].start ?? Infinity);
        return `${i + 1}\n${fmt(LEAD_IN + c[0].start)} --> ${fmt(LEAD_IN + end)}\n${c.map((x) => x.text.trim()).join(" ")}\n`;
      })
      .join("\n")
  );
}

// ---------- التشغيل ----------

mkdirSync(OUT_DIR, { recursive: true });
const tmp = join(SKILL_DIR, "raw/_build");
mkdirSync(tmp, { recursive: true });
writeFileSync(join(tmp, "video.html"), html);
console.log(`المدة: ${TOTAL.toFixed(1)} ث · ${scenes.length} مشاهد`);
scenes.forEach((s) => console.log(`  ${s.id} ${s.type.padEnd(10)} ${s.start.toFixed(1)} → ${s.end.toFixed(1)}`));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(`file://${join(tmp, "video.html")}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const seek = (t) => page.evaluate((ms) => document.getAnimations().forEach((a) => (a.currentTime = ms)), t * 1000);

if (PREVIEW) {
  for (const t of PREVIEW.split(",").map(Number)) {
    await seek(t);
    await page.screenshot({ path: join(tmp, `preview-${t}.jpg`), type: "jpeg", quality: 85 });
  }
  console.log("معاينة:", tmp);
  await browser.close();
  process.exit(0);
}

// الصور إلى ffmpeg مباشرة
const silent = join(tmp, "video-silent.mp4");
const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", silent], { stdio: ["pipe", "inherit", "inherit"] });
const frames = Math.ceil(TOTAL * FPS);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await seek(f / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % (FPS * 10) === 0) process.stdout.write(`\r  إطار ${f}/${frames} (${Math.round((Date.now() - t0) / 1000)} ث)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await seek(spec.posterAt ?? 4);
await page.screenshot({ path: join(OUT_DIR, "poster.jpg"), type: "jpeg", quality: 88 });
await browser.close();
console.log("\n  تم رسم الصورة");

// مزج الصوت: التعليق + موسيقى تنخفض تحت الصوت + مؤثر انتقال عند كل مشهد
const whooshAt = scenes.slice(1).map((s) => s.start);
const music = join(SKILL_DIR, "raw/music.wav");
const whoosh = join(SKILL_DIR, "raw/whoosh.mp3");
const inputs = ["-i", silent, "-i", narrationPath, "-stream_loop", "-1", "-i", music];
whooshAt.forEach(() => inputs.push("-i", whoosh));
const wh = whooshAt
  .map((t, i) => `[${3 + i}:a]volume=0.22,adelay=${Math.round(Math.max(0, t - 0.25) * 1000)}|${Math.round(Math.max(0, t - 0.25) * 1000)}[w${i}]`)
  .join(";");
const filter = [
  `[1:a]adelay=${LEAD_IN * 1000}|${LEAD_IN * 1000},apad=whole_dur=${TOTAL},volume=1.0,asplit=2[voice][key]`,
  `[2:a]atrim=0:${TOTAL},volume=0.30,afade=t=in:d=1.2,afade=t=out:st=${TOTAL - 2.5}:d=2.5[mus]`,
  `[mus][key]sidechaincompress=threshold=0.03:ratio=7:attack=30:release=600[ducked]`,
  wh,
  `[voice][ducked]${whooshAt.map((_, i) => `[w${i}]`).join("")}amix=inputs=${2 + whooshAt.length}:normalize=0:duration=first,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
]
  .filter(Boolean)
  .join(";");
execFileSync("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", filter, "-map", "0:v", "-map", "[a]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", String(TOTAL), "-movflags", "+faststart",
  join(OUT_DIR, "intro-video.mp4")], { stdio: "inherit" });
writeFileSync(join(OUT_DIR, "intro-video.ar.vtt"), vtt());
console.log("تم:", OUT_DIR);
