import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMedia } from "../src/media.js";

test("recognises video providers and falls back safely", () => {
  assert.equal(resolveMedia({ type: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10" }).src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
  assert.equal(resolveMedia({ type: "video", url: "https://youtu.be/dQw4w9WgXcQ" }).kind, "embed");
  assert.equal(resolveMedia({ type: "video", url: "https://vimeo.com/123456/abcdef12" }).src, "https://player.vimeo.com/video/123456?h=abcdef12");
  assert.equal(resolveMedia({ type: "video", url: "https://iframe.mediadelivery.net/play/42/abc-def" }).src, "https://iframe.mediadelivery.net/embed/42/abc-def");
  assert.equal(resolveMedia({ type: "video", url: "https://cdn.example.com/a.mp4" }).kind, "video");
  assert.equal(resolveMedia({ type: "image", url: "https://cdn.example.com/a.png" }).kind, "image");
  assert.equal(resolveMedia({ type: "video", url: "javascript:alert(1)" }), null);
  assert.equal(resolveMedia({ type: "video", url: "http://evil.example/x.mp4" }), null);
});
