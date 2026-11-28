# طلب جاهز لـ Claude (الجولة الثانية): 9 لقطات جديدة، وإعادة تصوير 16 لقطة بدقة أعلى

يعمل هذا الطلب في Claude على جهازك: تطبيق Claude لسطح المكتب مع Claude in Chrome أو التحكم بالحاسوب، أو Claude Code. انسخ ما تحت الخط كاملاً والصقه هناك.

---

أريد لقطات شاشة حقيقية لأدوات الذكاء الاصطناعي، وأن ترفعها مباشرة إلى مستودع منصتي التدريبية على GitHub.

- **المستودع:** `MagdyAqel/SMART-Ai`
- **الفرع:** `claude/upbeat-ramanujan-weryd0` فقط. لا تنشئ فرعاً آخر، ولا طلب دمج.

## مواصفات كل لقطة (إلزامية)
1. **الدقة:** اجعل نافذة المتصفح بملء الشاشة، وكبّر الصفحة إلى ١٢٥٪، والتقط النافذة بدقتها الأصلية. يجب ألا يقل عرض اللقطة عن **1400 بكسل**، ولا تصغّرها قبل الحفظ.
2. **الصيغة:** PNG فقط، وباسم الملف المحدد تماماً.
3. **الحقيقة:** صوّر الواجهة الحقيقية فقط. لا تولّد صوراً، ولا تعدّل محتوى اللقطة.
4. **الدخول:** لا تكتب كلمة مرور ولا تطلبها. إن ظهرت صفحة تسجيل دخول، توقّف واطلب مني أن أسجّل الدخول بنفسي.
5. **الخصوصية:** يجب ألا يظهر في اللقطة اسم الحساب ولا البريد ولا الصورة الشخصية ولا قوائم المحادثات أو الملفات السابقة. اطمس ذلك أو قصّه، ولا تستخدم أي بيانات طلاب.
6. **الانتظار:** انتظر اكتمال النتيجة قبل التصوير، وأبعد مؤشر الفأرة عن النص.
7. **الأداة غير المتاحة:** إن لم تكن الأداة متاحة في الحساب، فصوّر رسالة عدم الإتاحة باسم `<الاسم>-NOT-AVAILABLE.png`، ولا تصنع بديلاً.

## الجزء الأول: لقطات جديدة (9 لقطات)

| # | الملف | المجلد | الخطوات | ما يجب أن يظهر |
|---|---|---|---|---|
| 1 | `notebook-sources.png` | `content/skill-04/raw/shots/` | في Gemini Notebook أنشئ دفتراً جديداً، والصق نصاً قصيراً عن الخلية النباتية والحيوانية مصدراً، ثم اسأل: «ما الفرق بين الخلية النباتية والحيوانية؟» | الإجابة وفيها أرقام الإحالة إلى المصدر |
| 2 | `ms-learn-1-search.png` | `content/skill-05/raw/shots/` | في learn.microsoft.com/ar-sa/training اكتب في البحث: «AI for educators» | نتائج البحث ومسارات التعلّم الظاهرة |
| 3 | `ms-learn-2-path.png` | `content/skill-05/raw/shots/` | افتح مسار «Microsoft Copilot for Education» أو «AI for educators» | صفحة المسار: عنوانه، ووحداته، ومدته، وزر «بدء» |
| 4 | `ms-learn-3-module.png` | `content/skill-05/raw/shots/` | افتح أول وحدة في المسار | صفحة الوحدة: الوحدات الفرعية وزمن كل منها، وشريط التقدّم إن ظهر |
| 5 | `consensus-results.png` | `content/skill-06/raw/shots/` | في consensus.app ابحث: «Does flipped learning improve middle school science achievement?» | الملخص، ومقياس الاتفاق، وقائمة الدراسات |
| 6 | `elicit-table.png` | `content/skill-06/raw/shots/` | في elicit.com ابحث بالسؤال نفسه | جدول الدراسات بأعمدته |
| 7 | `gemini-skills-manage.png` | `content/skill-13/raw/shots/` | في gemini.google.com افتح القائمة الجانبية، ثم «إدارة Gem» (أو «المهارات») | رسالة «أصبحت Gems الآن مهارات» والمهارات الجاهزة من Google، مع إخفاء «Gems التي أنشأتها» |
| 8 | `claude-skills-list.png` | `content/skill-13/raw/shots/` | في claude.ai افتح Settings، ثم Capabilities أو Skills | قائمة Skills النشطة |

## الجزء الثاني: إعادة تصوير اللقطات الحالية بدقة أعلى
اللقطات الحالية عرضها نحو 600 بكسل، فيظهر النص فيها غير حاد. أعد تصويرها بالمواصفات أعلاه، بالأسماء نفسها، وفي مجلداتها نفسها، فتحلّ النسخ الجديدة محل القديمة. ابدأ بالأهم:
1. **`content/skill-03/raw/shots/`:**
   - `music-2-prompt.png`
   - `music-3-result.png`
   - `gemini-image-result.png`
   - `storybook-2-prompt.png`
   - `storybook-3-result.png`
   - `chatgpt-card-1-prompt.png`
   - `chatgpt-card-2-result.png`
   - `chatgpt-card-3-edit.png`
2. **`content/skill-12/raw/shots/`:**
   - `notebooklm-2-add-sources.png`
   - `notebook-sources.png`
   - `notebooklm-5-studio.png`
   - `notebooklm-6-mindmap.png`
   - `notebooklm-7-quiz-settings.png`
   - `notebooklm-8-audio-settings.png`
   - `notebooklm-9-quiz.png`
   - `notebooklm-11-audio-result.png`

   استخدم دفتر «رحلة قطرة الماء في الطبيعة» نفسه.

استخدم الأوامر نفسها المكتوبة في `content/images/SHOTS.md` لكل لقطة.

## الرفع
**إن كان المستودع منسوخاً على جهازي:**
```
git fetch origin claude/upbeat-ramanujan-weryd0
git checkout claude/upbeat-ramanujan-weryd0
git pull
# انسخ الملفات إلى مجلداتها، ثم:
git add content/*/raw/shots
git commit -m "Add remaining tool screenshots and high-res recaptures"
git push origin claude/upbeat-ramanujan-weryd0
```

**وإلا فمن موقع GitHub:**
1. افتح مجلد اللقطات على الفرع.
2. اضغط «Add file» ثم «Upload files».
3. اختر «Commit directly to the claude/upbeat-ramanujan-weryd0 branch».

## في النهاية أعطني
- قائمة بما رُفع، مع مسار كل ملف وعرضه بالبكسل.
- ما لم يتح، وسبب ذلك.
- رابط الـ commit.
