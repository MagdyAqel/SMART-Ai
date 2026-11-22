// يحوّل صور ChatGPT من content إلى مجلد الموقع بحجم مناسب للويب:
//   content/skill-XX/raw/exN.jpg      → web/public/media/skill-XX/example-N.jpg
//   content/images/covers/skill-XX.jpg → web/public/media/covers/skill-XX.jpg
// يُشغَّل تلقائياً في النشر، فتظهر الصور الجديدة دون تدخل يدوي.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const out = (...p) => join(ROOT, "web/public/media", ...p);
const newer = (src, dst) => !existsSync(dst) || statSync(src).mtimeMs > statSync(dst).mtimeMs;
let n = 0;
function convert(src, dst, width) {
  if (!newer(src, dst)) return;
  mkdirSync(join(dst, ".."), { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", `scale='min(${width},iw)':-2`, "-q:v", "3", dst]);
  n++;
}
for (const dir of readdirSync(join(ROOT, "content"))) {
  if (!/^skill-\d+$/.test(dir)) continue;
  const raw = join(ROOT, "content", dir, "raw");
  if (!existsSync(raw)) continue;
  for (const f of readdirSync(raw)) {
    const m = f.match(/^ex(\d+)\.(jpe?g|png|webp)$/i);
    if (m) convert(join(raw, f), out(dir, `example-${m[1]}.jpg`), 1600);
  }
}
const covers = join(ROOT, "content/images/covers");
if (existsSync(covers)) for (const f of readdirSync(covers)) if (/\.(jpe?g|png|webp)$/i.test(f)) convert(join(covers, f), out("covers", f.replace(/\.\w+$/, ".jpg")), 1200);
console.log(`تمت مزامنة ${n} صورة.`);
