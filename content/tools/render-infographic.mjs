// يرسم إنفوجرافيك المهارة صورةً عالية الدقة من infographic.json:
//   node render-infographic.mjs ../skill-01
// المخرج: web/public/media/<skill>/infographic.png (عرض 2160 بكسل، مناسب للعرض والطباعة)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SKILL_DIR = resolve(process.argv[2] || "../skill-01");
const SKILL = basename(SKILL_DIR);
const OUT_DIR = resolve(HERE, "../../web/public/media", SKILL);
const d = JSON.parse(readFileSync(join(SKILL_DIR, "infographic.json"), "utf8"));

const fontDir = join(HERE, "node_modules/@fontsource/ibm-plex-sans-arabic/files");
const font = (w, subset) => `file://${join(fontDir, `ibm-plex-sans-arabic-${subset}-${w}-normal.woff2`)}`;
const icon = (name) =>
  readFileSync(join(HERE, "node_modules/lucide-static/icons", `${name}.svg`), "utf8")
    .replace(/<!--.*?-->/gs, "")
    .replace(/width="24"/, 'width="100%"')
    .replace(/height="24"/, 'height="100%"');
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:400;src:url(${font(400, "arabic")})}
@font-face{font-family:Plex;font-weight:500;src:url(${font(500, "arabic")})}
@font-face{font-family:Plex;font-weight:700;src:url(${font(700, "arabic")})}
@font-face{font-family:Plex;font-weight:400;src:url(${font(400, "latin")});unicode-range:U+0000-00FF}
@font-face{font-family:Plex;font-weight:700;src:url(${font(700, "latin")});unicode-range:U+0000-00FF}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;font-family:Plex,sans-serif;color:#10302c;background:#f4f8f6}
.sheet{padding:56px 60px 44px;background:
  radial-gradient(700px 400px at 100% 0%,#d5f5ee 0%,transparent 70%),
  radial-gradient(600px 400px at 0% 100%,#e0f0fb 0%,transparent 70%),#f7faf9}
header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px}
.badge{display:inline-block;background:#0f766e;color:#fff;font-weight:700;font-size:20px;padding:6px 20px;border-radius:99px;margin-bottom:14px}
h1{font-size:52px;line-height:1.25;font-weight:700;color:#0b3b36;max-width:760px}
h1 em{font-style:normal;color:#0f9d8a}
.brand{font-size:18px;font-weight:700;color:#0f766e;white-space:nowrap;margin-top:8px}
.def{display:flex;gap:18px;align-items:center;background:#fff;border:2px solid #cdeae4;border-radius:22px;padding:22px 26px;margin-bottom:34px;box-shadow:0 6px 20px rgba(15,118,110,.07)}
.def i{width:56px;height:56px;flex-shrink:0;padding:12px;border-radius:16px;background:#d5f5ee;color:#0f766e}
.def p{font-size:23px;line-height:1.6}.def b{color:#0f766e}
h2{font-size:30px;font-weight:700;margin:0 0 18px;display:flex;align-items:center;gap:12px;color:#0b3b36}
h2 span{width:40px;height:40px;border-radius:12px;background:#0f766e;color:#fff;display:grid;place-items:center;font-size:22px}
.pillars{display:grid;gap:14px;margin-bottom:34px}
.pillar{display:grid;grid-template-columns:64px 170px 1fr;align-items:center;gap:18px;background:#fff;border-radius:20px;padding:16px 20px;border-inline-start:10px solid var(--c);box-shadow:0 4px 14px rgba(0,0,0,.05)}
.pillar .ic{width:64px;height:64px;padding:14px;border-radius:18px;background:color-mix(in srgb,var(--c) 16%,white);color:var(--c)}
.pillar h3{font-size:30px;color:var(--c);line-height:1.2}.pillar h3 small{display:block;font-size:17px;color:#5b6f6b;font-weight:500;margin-top:4px}
.pillar p{font-size:21px;line-height:1.55;color:#24433e}.pillar p q{display:block;margin-top:4px;font-size:19px;color:#0b3b36;background:#f2f7f6;border-radius:10px;padding:4px 12px;quotes:"«" "»"}
.compare{display:grid;grid-template-columns:1fr 1.5fr;gap:16px;margin-bottom:34px}
.pc{border-radius:20px;padding:20px 22px;background:#fff;border:2.5px solid}
.pc.weak{border-color:#f3a3a3}.pc.strong{border-color:#8fd9ac}
.pc h4{display:flex;align-items:center;gap:10px;font-size:23px;margin-bottom:10px}
.pc h4 i{width:32px;height:32px;padding:5px;border-radius:50%}
.weak h4{color:#c0392b}.weak h4 i{background:#fde2e2;color:#c0392b}
.strong h4{color:#15803d}.strong h4 i{background:#dcfce7;color:#15803d}
.pc p{font-size:21px;line-height:1.75}
.seg{border-radius:7px;padding:1px 5px;background:color-mix(in srgb,var(--c) 22%,white);box-decoration-break:clone;-webkit-box-decoration-break:clone}
.techs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:34px}
.tech{background:#fff;border-radius:20px;padding:20px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.05)}
.tech i{display:block;width:54px;height:54px;margin:0 auto 10px;color:#b45309}
.tech h4{font-size:22px;margin-bottom:6px}.tech p{font-size:18px;line-height:1.5;color:#4a5f5b}
.check{background:#0b3b36;color:#e9fbf6;border-radius:24px;padding:24px 28px;display:grid;grid-template-columns:1fr 1fr;gap:10px 26px}
.check h3{grid-column:1/-1;font-size:25px;margin-bottom:6px;color:#5eead4}
.check div{display:flex;gap:10px;align-items:center;font-size:20px}
.check i{width:26px;height:26px;flex-shrink:0;color:#5eead4}
footer{display:flex;justify-content:space-between;margin-top:26px;font-size:16px;color:#5b6f6b}
</style></head><body><div class="sheet">
<header><div><span class="badge">${esc(d.badge)}</span><h1>${d.title}</h1></div><div class="brand">◆ منصة التدريب الذكي</div></header>
<div class="def"><i>${icon("wand-sparkles")}</i><p>${d.definition}</p></div>
<h2><span>1</span>${esc(d.pillarsTitle)}</h2>
<div class="pillars">${d.pillars
  .map(
    (p) => `<div class="pillar" style="--c:${p.color}"><div class="ic">${icon(p.icon)}</div>
      <h3>${esc(p.name)}<small>${esc(p.question)}</small></h3><p>${esc(p.tip)}<q>${esc(p.example)}</q></p></div>`,
  )
  .join("")}</div>
<h2><span>2</span>${esc(d.compareTitle)}</h2>
<div class="compare">
  <div class="pc weak"><h4><i>${icon("x")}</i>أمر ضعيف</h4><p>«${esc(d.weak)}»</p></div>
  <div class="pc strong"><h4><i>${icon("check")}</i>أمر فعّال</h4><p>«${d.strong
    .map((s) => `<span class="seg" style="--c:${s.color}">${esc(s.text)}</span>`)
    .join(" ")}»</p></div>
</div>
<h2><span>3</span>${esc(d.techTitle)}</h2>
<div class="techs">${d.techniques.map((t) => `<div class="tech"><i>${icon(t.icon)}</i><h4>${esc(t.name)}</h4><p>${esc(t.text)}</p></div>`).join("")}</div>
<div class="check"><h3>${esc(d.checkTitle)}</h3>${d.checklist.map((c) => `<div><i>${icon("circle-check")}</i>${esc(c)}</div>`).join("")}</div>
<footer><span>${esc(d.footer)}</span><span>${esc(d.badge)} · ${esc(d.skillName)}</span></footer>
</div></body></html>`;

mkdirSync(OUT_DIR, { recursive: true });
const tmp = join(SKILL_DIR, "raw/_build");
mkdirSync(tmp, { recursive: true });
writeFileSync(join(tmp, "infographic.html"), html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 800 }, deviceScaleFactor: 2 });
await page.goto(`file://${join(tmp, "infographic.html")}`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(OUT_DIR, "infographic.png"), fullPage: true });
await browser.close();
console.log("تم:", join(OUT_DIR, "infographic.png"));
