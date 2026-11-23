# أدوات مساعدة لكتابة ملفات المهارات بالنمط نفسه (skill.json, video.json, infographic.json, narration).
# الاستخدام: from skillgen import *  ثم build(spec)
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
COLORS = ["#2dd4bf", "#60a5fa", "#fbbf24", "#c084fc", "#f87171"]
INFO_COLORS = ["#0f9d8a", "#2563eb", "#d97706", "#7c3aed", "#dc2626"]
ORDINALS = ["أولًا", "ثانيًا", "ثالثًا", "رابعًا", "خامسًا"]


def q(i, d, text, opts, ans, exp):
    return {"id": f"q{i}", "difficulty": d, "q": text, "options": opts, "answer": ans, "explanation": exp}


def r(c, desc, p):
    return {"criterion": c, "description": desc, "points": p}


def task(title, instructions, rubric, kind="prompt", material="", run=True, pass_score=70):
    assert sum(x["points"] for x in rubric) == 100, title
    return {"id": "t1", "type": kind, "runPrompt": kind == "prompt" and run, "passScore": pass_score,
            "title": title, "instructions": instructions, "material": material, "rubric": rubric}


def lesson(lid, title, minutes, content, questions, tasks=None):
    return {"id": lid, "title": title, "minutes": minutes, "media": [], "content": content,
            "questions": questions, "tasks": tasks or []}


def build(sp):
    """sp: dict with keys n, title, description, icon, intro{definition, why, objectives, minutes},
    lessons, post (10 questions), examples [(caption, note, image_prompt)], closing_prompt,
    video{hook_sub, scenes...}, info{...}"""
    n = sp["n"]  # الرقم الظاهر للمتدرب وترتيب المهارة
    sid = f"skill-{sp.get('id_num', n):02d}"  # المعرّف الثابت (لا يتغير عند إعادة الترتيب)
    d = os.path.join(ROOT, sid)
    os.makedirs(os.path.join(d, "raw"), exist_ok=True)
    for L in sp["lessons"]:
        L["skill"] = f"{sid}-{L['id']}"
    skill = {
        "id": sid, "number": n, "order": n, "icon": sp["icon"], "title": sp["title"],
        "description": sp["description"], "level": sp.get("level", "للمعلمين والتربويين"),
        "cover": f"/media/covers/{sid}.jpg",
        "intro": sp["intro"],
        "video": {"url": f"/media/{sid}/intro-video.mp4", "poster": f"/media/{sid}/poster.jpg",
                  "captions": f"/media/{sid}/intro-video.ar.vtt", "title": f"فيديو تعريفي: {sp['title']}"},
        "infographic": {"url": f"/media/{sid}/infographic.png", "alt": sp["info"]["alt"]},
        "examples": [{"url": f"/media/{sid}/example-{i + 1}.jpg", "caption": c, "note": note}
                     for i, (c, note, _) in enumerate(sp["examples"])],
        "lessons": sp["lessons"],
        "postTest": {"passScore": None, "questions": sp["post"]},
    }
    assert len(sp["post"]) == 10, sid
    json.dump(skill, open(os.path.join(d, "skill.json"), "w"), ensure_ascii=False, indent=2)

    # الفيديو: المشاهد ونصوص التعليق
    v = sp["video"]
    scenes = []
    scenes.append({"id": "s1", "type": "hook", "image": "cover.jpg", "text": v["hook"],
                   "kicker": f"المهارة {['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة', 'الثالثة عشرة'][n]}",
                   "title": sp["title"], "subtitle": v["hook_sub"], "subtitleAt": v["hook_sub_at"]})
    scenes.append({"id": "s2", "type": "definition", "icon": v["def_icon"], "text": v["def_text"],
                   "term": v["term"], "definition": v["definition"],
                   "chips": [{"label": a, "icon": b, "at": c} for a, b, c in v["chips"]]})
    scenes.append({"id": "s3", "type": "cards", "icon": v["cards_icon"], "text": v["cards_text"],
                   "title": v["cards_title"],
                   "cards": [{"title": a, "text": b, "icon": c, "at": e, "tone": t}
                             for (a, b, c, e), t in zip(v["cards"], ["teal", "amber", ""])]})
    steps_text = v["steps_intro"] + " " + " ".join(
        f"{ORDINALS[i]}: {s[3]}" for i, s in enumerate(v["steps"]))
    scenes.append({"id": "s4", "type": "steps", "icon": "list-checks", "text": steps_text,
                   "title": v["steps_title"],
                   "steps": [{"title": a, "text": b, "icon": c, "at": ORDINALS[i], "color": COLORS[i]}
                             for i, (a, b, c, _) in enumerate(v["steps"])]})
    scenes.append({"id": "s5", "type": "compare", "text": v["compare_text"], "title": v["compare_title"],
                   "weak": {"label": "أمر ضعيف", "text": v["weak"], "at": "أمر ضعيف"},
                   "strong": {"label": "أمر فعّال", "at": "وأمر فعال",
                              "parts": [{"text": t, "color": COLORS[i % 5], "tag": tag}
                                        for i, (t, tag) in enumerate(v["strong"])]},
                   "moral": v["moral"], "moralAt": v["moral_at"]})
    scenes.append({"id": "s6", "type": "closing", "image": "closing.jpg", "text": v["closing_text"],
                   "title": v["closing_title"],
                   "steps": [{"label": "تعلّم", "icon": "book-open", "at": v["closing_cues"][0]},
                             {"label": "تدرّب", "icon": "pencil-line", "at": v["closing_cues"][1]},
                             {"label": "اختبر نفسك", "icon": "list-checks", "at": v["closing_cues"][2]},
                             {"label": "انتقل للمهارة التالية", "icon": "award", "at": v["closing_cues"][3]}]})
    video = {"badge": f"المهارة {n}", "sting": scenes[0]["kicker"], "posterAt": 4.2, "scenes": scenes}
    json.dump(video, open(os.path.join(d, "video.json"), "w"), ensure_ascii=False, indent=2)
    narration = "\n\n".join(s["text"] for s in scenes)
    open(os.path.join(d, "narration.txt"), "w").write(narration)

    # الإنفوجرافيك
    inf = sp["info"]
    info = {
        "badge": f"المهارة {n}", "skillName": sp["title"], "title": inf["title"], "definition": inf["definition"],
        "pillarsTitle": inf["steps_title"],
        "pillars": [{"name": a, "question": b, "tip": c, "example": e, "icon": ic, "color": INFO_COLORS[i]}
                    for i, (a, b, c, e, ic) in enumerate(inf["steps"])],
        "compareTitle": "قارن بنفسك", "weak": v["weak"],
        "strong": [{"text": t, "color": INFO_COLORS[i % 5]} for i, (t, _) in enumerate(v["strong"])],
        "techTitle": inf["tech_title"],
        "techniques": [{"name": a, "text": b, "icon": c} for a, b, c in inf["techniques"]],
        "checkTitle": inf.get("check_title", "قبل أن تعتمد المُخرَج"), "checklist": inf["checklist"],
        "footer": "التدريب على توظيف الذكاء الاصطناعي في التعليم",
    }
    json.dump(info, open(os.path.join(d, "infographic.json"), "w"), ensure_ascii=False, indent=2)

    words = len(narration.split())
    print(f"{sid}: {len(sp['lessons'])} دروس, {len(sp['post'])} أسئلة بعدية, التعليق {words} كلمة (~{round(words / 112 * 60)} ث)")
    return {"id": sid, "examples": sp["examples"], "closing": sp["closing_prompt"]}
