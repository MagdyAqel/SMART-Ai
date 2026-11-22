# مواصفات الصور المطلوبة (لـ ChatGPT)

## جدول الطلبات

نفّذ فقط ما حالته **مطلوب**، ثم غيّر حالته إلى **مرفوع** بعد الرفع. يضيف Claude الطلبات الجديدة هنا عند إعداد كل مهارة.

| الملف | الوصف | الحالة |
|---|---|---|
| `content/skill-01/raw/ex2.jpg` | معلم يقدّم نشاطاً صمّمه بالذكاء الاصطناعي | مرفوع |
| `content/skill-01/raw/ex3.jpg` | متعلمون في مجموعات على مهمة صاغها المعلم | مرفوع |
| `content/skill-01/raw/closing.jpg` | ختام فيديو المهارة الأولى | مرفوع |
| `content/images/covers/skill-01.jpg` … `skill-11.jpg` | أغلفة المهارات الإحدى عشرة | مرفوع |

لا توجد طلبات جديدة حالياً. ستُضاف طلبات المهارة الثانية عند إعدادها.


## تعليمات عامة لكل الصور

- **الأسلوب:** صورة فوتوغرافية واقعية احترافية بجودة تحريرية (editorial photography)، إضاءة طبيعية مشرقة، ألوان طبيعية نابضة، عمق ميدان ضحل، عدسة 35mm.
- **البيئة:** مدارس وفصول **حديثة ومجهّزة ومشرقة** في العالم العربي (أثاث حديث، نوافذ كبيرة، شاشات تفاعلية)، بطابع عربي عام لا يرتبط ببلد محدد. لا فصول قديمة أو متهالكة.
- **الأشخاص:** معلمون ومتدربون ومتعلمون عرب، بلباس محتشم وأنيق؛ بعض النساء والفتيات بحجاب حديث.
- **ممنوع:** أي نص أو حروف أو أرقام أو شعارات أو علامات مائية داخل الصورة (الشاشات والسبورات بلا كتابة، أو بأشكال ورسوم فقط).
- **المقاس:** أفقي 3:2 (مثل 1536×1024) أو 16:9، بأعلى دقة متاحة.
- **الصيغة والمكان:** JPG أو PNG، بالاسم والمسار المحددين تماماً أدناه.
- **بعد الانتهاء:** ارفع الصور (commit) إلى الفرع `claude/upbeat-ramanujan-weryd0`، ولا تعدّل أي ملف آخر في المستودع.

مرجع الأسلوب المعتمد: `content/skill-01/raw/ex1.jpg` (معلمة في مكتب حديث مشرق أمام حاسوب). اجعل كل الصور منسجمة معه.

---

## أ) صور المهارة الأولى (منفّذة، للمرجع)

### 1. `content/skill-01/raw/ex2.jpg` — معلم يقدّم نشاطاً صمّمه بالذكاء الاصطناعي
> Photorealistic editorial photo of a modern, bright Arab classroom with large windows, light wood and white furniture, and a large interactive display on the wall showing a colorful plant diagram with no text. A smartly dressed Arab male teacher in his 30s stands beside the display, smiling and engaging 12–13 year old students in neat uniforms who raise their hands enthusiastically. Collaborative desk clusters, vibrant and optimistic atmosphere, natural daylight, 35mm, shallow depth of field. No text, letters, numbers, logos or watermarks anywhere.

### 2. `content/skill-01/raw/ex3.jpg` — متعلمون يعملون في مجموعات على مهمة صاغها المعلم
> Photorealistic editorial photo of a bright, modern Arab primary school classroom with colorful contemporary furniture. Small groups of happy 10–11 year old students in neat uniforms (some girls wear white hijabs) collaborate around round tables, using tablets and colorful picture cards to build a water-cycle model with craft materials and drawn arrows. An elegant Arab female teacher in a modern hijab crouches beside one group, guiding them warmly. Joyful, focused learning, natural light, 35mm. No text, letters, numbers, logos or watermarks anywhere.

### 3. `content/skill-01/raw/closing.jpg` — صورة مشهد الختام في الفيديو
> Photorealistic editorial photo, wide shot: a confident Arab teacher (female, modern hijab, smart blazer) stands at the front of a modern, bright classroom, smiling at engaged students; soft glowing light, a subtle sense of achievement and confidence. Composition leaves calm empty space on the right third for overlay text. Natural colors, 35mm. No text, letters, numbers, logos or watermarks anywhere.

---

## ب) أغلفة المهارات (منفّذة، للمرجع)

الاسم: `content/images/covers/skill-XX.jpg` حيث XX رقم المهارة من 01 إلى 11. الأسلوب نفسه أعلاه، وكل غلاف يعبّر عن موضوع المهارة:

| الملف | المهارة | فكرة الصورة |
|---|---|---|
| `skill-01.jpg` | مقدمة في الذكاء الاصطناعي وهندسة الأوامر | معلمة تكتب أمراً لمساعد ذكي على حاسوب حديث، وتعبير اكتشاف وفضول |
| `skill-02.jpg` | مقدمة في الذكاء الاصطناعي في التعليم | فصل حديث يستخدم فيه المعلم والطلاب أجهزة لوحية وشاشة تفاعلية |
| `skill-03.jpg` | تصميم الصور والفيديو التعليمي بالذكاء الاصطناعي | معلم في استوديو صغير يصمم وسيلة بصرية على شاشة كبيرة، كاميرا وإضاءة |
| `skill-04.jpg` | أدوات الذكاء الاصطناعي من Google | معلمة تعمل على حاسوب محمول في بيئة تعاونية مشرقة (بلا شعارات) |
| `skill-05.jpg` | أدوات الذكاء الاصطناعي من Microsoft | معلم في اجتماع تعاوني مع زملائه أمام شاشة كبيرة (بلا شعارات) |
| `skill-06.jpg` | الذكاء الاصطناعي في البحث العلمي | باحثة تربوية في مكتبة حديثة بين الكتب وحاسوب محمول |
| `skill-07.jpg` | الذكاء الاصطناعي وتحليل البيانات | معلم يحلّل رسوماً بيانية ملونة (بلا أرقام أو نصوص) على شاشة |
| `skill-08.jpg` | الذكاء الاصطناعي في التخطيط التربوي | معلمة تخطط على طاولة فيها دفتر وتقويم وجهاز لوحي |
| `skill-09.jpg` | الذكاء الاصطناعي في التصميم والتنفيذ التربوي | طلاب في نشاط عملي تفاعلي يقوده معلم داخل فصل حديث |
| `skill-10.jpg` | الذكاء الاصطناعي في التقويم التربوي | معلم يراجع أعمال الطلاب على جهاز لوحي ويعطي تغذية راجعة مبتسماً |
| `skill-11.jpg` | أخلاقيات التعامل مع الذكاء الاصطناعي | مجموعة معلمين في نقاش جاد ومحترم حول طاولة مستديرة |
