# يبني الفيديو الثاني لكل مهارة: «شرح تطبيقي خطوة بخطوة».
# المخرجات في مجلد المهارة: tutorial.json (المشاهد) و tutorial-narration.txt (نص التعليق)
# ويضيف الحقل tutorial إلى skill.json.
#   python3 tutorials.py        يكتب الملفات لكل المهارات
#   ثم بعد التعليق الصوتي:  node render-video.mjs ../skill-04 tutorial
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
COLORS = ["#2dd4bf", "#60a5fa", "#fbbf24", "#c084fc", "#f87171"]
ORD_F = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة"]
COUNT = {3: "ثلاث", 4: "أربع", 5: "خمس"}
AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
NTH = ["", "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة",
       "العاشرة", "الحادية عشرة"]


def S(title, tip, icon, say, prompt=None, type_cue=None, output=None, out_cue=None, window=None, short=None):
    """خطوة واحدة: title يظهر ويُنطق، say شرحها (يجب أن يحتوي type_cue و out_cue إن وُجدا)."""
    if type_cue:
        assert type_cue in say, (title, type_cue)
    if out_cue:
        assert out_cue in say, (title, out_cue)
    return dict(title=title, tip=tip, icon=icon, say=say, prompt=prompt, type_cue=type_cue,
                output=output or [], out_cue=out_cue, window=window, short=short or tip)


def first_words(text, n=4):
    return " ".join(text.split()[:n])


def build(n, sp):
    sid = f"skill-{n:02d}"
    d = os.path.join(ROOT, sid)
    steps = sp["steps"]
    k = len(steps)
    parts = []  # نص التعليق فقرةً فقرة
    scenes = []

    parts.append(sp["hook_say"])
    scenes.append({"id": "t1", "type": "hook", "image": "ex2.jpg", "text": first_words(sp["hook_say"]),
                   "kicker": f"المهارة {NTH[n]} · شرح تطبيقي", "title": sp["title"],
                   "subtitle": sp["hook_sub"], "subtitleAt": sp["hook_sub_at"]})

    titles = [s["title"] for s in steps]
    overview = f"{sp['overview_lead']} في {COUNT[k]} خطوات: " + "، ثم ".join(titles[:-1]) + f"، وأخيرًا {titles[-1]}."
    parts.append(overview)
    scenes.append({"id": "t2", "type": "steps", "icon": "route", "text": first_words(overview),
                   "title": sp["overview_title"],
                   "steps": [{"title": s["title"], "text": s["short"], "icon": s["icon"], "at": s["title"],
                              "color": COLORS[i]} for i, s in enumerate(steps)]})

    for i, s in enumerate(steps):
        say = f"الخطوة {ORD_F[i]}: {s['title']}. {s['say']}"
        parts.append(say)
        sc = {"id": f"t{3 + i}", "type": "screen", "text": first_words(say), "step": i + 1,
              "stepLabel": f"الخطوة {i + 1}", "title": s["title"], "tip": s["tip"], "icon": s["icon"],
              "output": s["output"]}
        if s["prompt"]:
            sc["prompt"] = s["prompt"]
            sc["typeAt"] = s["type_cue"] or 0.2
        if s["out_cue"]:
            sc["outputAt"] = s["out_cue"]
        if s["window"]:
            sc["window"] = s["window"]
        scenes.append(sc)

    ck = sp["checklist"]
    ck_say = ck["lead"] + " " + " ".join(said for _, said in ck["items"])
    parts.append(ck_say)
    scenes.append({"id": f"t{3 + k}", "type": "checklist", "icon": "shield-check", "text": first_words(ck_say),
                   "title": ck["title"], "items": [{"text": t, "at": said} for t, said in ck["items"]]})

    cl = sp["closing"]
    parts.append(cl["say"])
    scenes.append({"id": f"t{4 + k}", "type": "closing", "image": "ex3.jpg", "text": first_words(cl["say"]),
                   "title": cl["title"],
                   "steps": [{"label": a, "icon": b, "at": c} for a, b, c in cl["cta"]]})

    spec = {"badge": f"المهارة {n} · شرح تطبيقي", "sting": "شرح تطبيقي خطوة بخطوة", "posterAt": 4.2,
            "scenes": scenes}
    json.dump(spec, open(os.path.join(d, "tutorial.json"), "w"), ensure_ascii=False, indent=2)
    text = "\n\n".join(parts)
    open(os.path.join(d, "tutorial-narration.txt"), "w").write(text + "\n")

    skill_path = os.path.join(d, "skill.json")
    skill = json.load(open(skill_path))
    skill["tutorial"] = {"url": f"/media/{sid}/tutorial-video.mp4", "poster": f"/media/{sid}/tutorial-poster.jpg",
                         "captions": f"/media/{sid}/tutorial-video.ar.vtt",
                         "title": f"شرح تطبيقي خطوة بخطوة: {sp['title']}"}
    json.dump(skill, open(skill_path, "w"), ensure_ascii=False, indent=2)
    words = len(text.split())
    print(f"{sid}: {len(scenes)} مشاهد · {words} كلمة (≈ {words / 1.75:.0f} ث)")
