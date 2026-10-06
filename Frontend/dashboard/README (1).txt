Calorie Dashboard — API-ready HTML / CSS / JavaScript

تشغيل سريع
1. ضع dashboard.html وdashboard.css وdashboard.js في نفس المجلد.
2. افتح dashboard.js وعدّل API_CONFIG.dashboardUrl فقط لرابط طلب GET الخاص بكم.
   مثال: dashboardUrl: "http://localhost:3000/api/dashboard"
3. افتح dashboard.html عبر Live Server.
4. إذا تفتح نسخة قديمة اضغط Ctrl + F5، وتأكد أنك فتحت هذا المجلد.

لا توجد بيانات تجريبية داخل الصفحة. البيانات الغائبة تظهر — وليست صفرًا.
كل الأرقام والعناوين الشخصية وحالات الهدف تُعرض من بيانات API.
Bootstrap وBootstrap Icons مربوطان عبر CDN، والتخطيط الأساسي يعمل دون Bootstrap.

استجابة Dashboard المطلوبة (نفس الصورة المرفقة):
{
  "success": true,
  "days": [
    {
      "date": "YYYY-MM-DD",
      "isToday": true,
      "calories": { "consumed": 0, "target": 0, "percentage": 0, "remaining": 0 },
      "protein": { "consumed": 0, "target": 0, "percentage": 0, "remaining": 0 },
      "carbs": { "consumed": 0, "target": 0, "percentage": 0, "remaining": 0 },
      "fat": { "consumed": 0, "target": 0, "percentage": 0, "remaining": 0 },
      "vitamins": { "vitaminA": {}, "vitaminC": {}, "vitaminD": {}, "vitaminB12": {} },
      "minerals": { "calcium": {}, "iron": {}, "magnesium": {}, "potassium": {} },
      "mealsCount": 0
    }
  ]
}
هذا مثال للهيكل فقط، وليس بيانات تستخدمها الصفحة.
كل فيتامين ومعدن يستخدم consumed / target / percentage / remaining مثل الماكروز.
الحقول الرقمية يجب أن تكون JSON numbers وليست strings.
التجاوز والمتبقي يحسبان من target - consumed؛ لأن remaining قد يرجع صفرًا بعد التجاوز.
الشرائط تتوقف عند 100%، والأرقام الفعلية لا تُقص عند الهدف.

Username / Streak / Level / XP
استجابة الصورة لا تحتوي هذه الحقول. جهزنا لها مسارين:
A. أضف user إلى استجابة Dashboard:
   "user": {"username":"...", "streak":0, "level":1, "xp":0, "xpTarget":100}
B. إذا عندكم endpoint آخر يرجع هذه المعلومات، ضع رابطه في API_CONFIG.userUrl.
   يقبل {user:{...}} أو كائن المستخدم مباشرة.
   يمكن أن تكون streak/level/xp/xpTarget داخل user.gamification.
   إذا اختلفت أسماء الحقول عدّل mapUserData فقط.
xp يعني نقاط التقدم داخل المستوى الحالي، وxpTarget هو حد هذا المستوى.
إذا يرجع عندكم XP إجمالي بكل المستويات، حوّله في mapUserData إلى تقدم المستوى الحالي.
الحقول الناقصة تظهر —، وفشل طلب الحساب لا يمنع عرض التغذية.

التاريخ
آخر 7 أيام تعني اليوم والستة السابقة.
يستخدم isToday من الباك إند مرجعًا للتاريخ، وإلا تاريخ الجهاز المحلي.
كل يوم يغيّر البطاقات من days المُحمّلة؛ لا يحتاج طلبًا مستقلًا لكل نقرة.
الطلب يجب أن يعيد الأيام السبعة. اليوم غير الموجود يُعرض كبيانات غير متوفرة.
زر Refresh يعيد الطلب. تُحفظ القيم السابقة عند فشل التحديث مع رسالة واضحة.

ربط الصفحات
عدّل PAGE_ROUTES حسب أسماء صفحاتكم الحالية.
Add Meal يذهب إلى add-meal.html. الصفحة نفسها لا تنفذ إضافة وجبة.
View meals يذهب إلى history.html?date=YYYY-MM-DD.
صفحة History يجب أن تقرأ date من URL لتعرض وجبات اليوم المحدد.
AI Assistant يذهب إلى chatbot.html، وProfile إلى profile.html.
هذه صفحات مشروعكم؛ الملف المرفق يحتوي Dashboard فقط.
Calculate Food غير موجود حسب طلبكم.

Auth
الطلبات تستخدم credentials: include لملفات الارتباط.
إذا تستخدمون bearer token عدّل getHeaders لاستخدام نظام تسجيل الدخول الحالي.
لا توجد مفاتيح API أو رموز دخول ثابتة في الكود.
إذا Live Server والباك إند على منفذين مختلفين، الباك إند يحتاج CORS يسمح
بأصل الواجهة تحديدًا، وبـcredentials عند استخدام cookie authentication.
عند فتح الملف مباشرة يكون الأصل null، وقد يرفضه إعداد الباك إند؛ Live Server أنسب.
طلبات GET لها مهلة 20 ثانية ورسائل للاتصال/401/403/429/رد JSON غير صالح.
Logout يحتاج API_CONFIG.logoutUrl (POST). لن يدّعي نجاح الخروج بدون endpoint.
أي CSRF header مطلوب من الباك إند يمكن إضافته في getHeaders.

فحوص
تم فحص الطلبات وبنية البيانات، نافذة الأيام السبعة، الصفر مقابل القيمة الغائبة،
حالات المتبقي/التجاوز/بلوغ الهدف، وأخطاء الحساب وتحديث البيانات.
التخطيط يتغير لسطح المكتب والتابلت والجوال؛ الأيام تنزلق أفقيًا داخل القسم على الجوال.
لم تتوفر معاينة متصفح حقيقية هنا؛ اختبروا العرض على أجهزتكم المستهدفة.
