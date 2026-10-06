Calorie — Add Meal (Dashboard integration)

تشغيل
فك ضغط calorie-dashboard.zip وافتح المجلد كاملًا في VS Code.
افتح dashboard.html عبر Live Server، ثم اضغط Add Meal.
الرابط موجود في PAGE_ROUTES.addMeal = "add-meal.html".
الصفحة الجديدة تحتاج dashboard.css للتصميم المشترك، إضافة إلى add-meal.css وadd-meal.js.
لا تحذف ملفات Dashboard أو تغيّر أسماءها دون تعديل الروابط.

الخيارات
By Nutrition: اسم الوجبة، نوعها، ثلاثة حقول رقمية منفصلة (protein/carbs/fat)،
والسعرات محسوبة تلقائيًا (Protein×4 + Carbs×4 + Fat×9). الأرقام غير سالبة وتقبل الكسور؛ الحقول فارغة حتى يدخل المستخدم القيم.
By Ingredients: صفوف أسماء المكونات مع كمية موجبة ووحدة؛ يمكن إضافة وحذف صفوف.
Analyze Ingredients يطلب التحليل من الباك إند ثم يعرض نتائج قابلة للمراجعة والتعديل.
By Photo: رفع صورة JPG/PNG أو سحبها، معاينة، ثم Analyze Photo.
بعد التحليل يظهر Review Estimated Nutrition وزر Add Meal للحفظ.
تغيير المكونات/الصورة يبطل نتائج التحليل القديمة حتى يتم التحليل مجددًا.
لا توجد حقول Date/Time أو Vitamins/Minerals. لا يوجد حقل وصف.
النهاية: الحفظ الناجح يرجع Dashboard ليعمل GET جديد ويحدّث الأرقام.

الربط
في add-meal.js عدّل MEAL_API:
  saveUrl: "رابط POST إنشاء الوجبة"
  analyzeIngredientsUrl: "رابط POST تحليل المكونات"
  analyzePhotoUrl: "رابط POST تحليل الصورة"
  logoutUrl: "رابط POST الخروج" (اختياري)
وفي dashboard.js عدّل API_CONFIG.dashboardUrl كرابط GET Dashboard.
الروابط لا تحتوي أي قيمة افتراضية ولن يحدث تحليل أو حفظ مزيف عند غياب الرابط.

مهم: لم يتم تزويدنا بعقد API إضافة/تحليل الوجبات. الأشكال التالية هي العقد
المقترح الذي جهزنا الفرونت عليه، وليست تأكيدًا لما يقبله الباك إند الحالي.
إذا الباك إند مختلف، عدّل mapAnalysisResponse وbuildSavePayload وphotoFormData فقط.

1. Analyze Ingredients: POST JSON
{
  "name": "Chicken and rice",
  "mealType": "lunch",
  "ingredients": [ { "name": "Chicken breast", "quantity": 150, "unit": "g" } ]
}
الوحدات المتاحة: g / ml / piece / tbsp / tsp / cup. يجب على API دعم هذه الوحدات.

2. Analyze Photo: POST multipart/form-data
photo: ملف الصورة
name: اسم الوجبة
mealType: breakfast/lunch/dinner/snack
method: photo
لا تضع Content-Type يدويًا؛ المتصفح يضيف boundary الصحيح.

استجابة التحليل للخيارين
{
  "success": true,
  "nutrition": { "calories": 650, "protein": 50, "carbs": 70, "fat": 15 }
}
الحقول الأربعة يجب أن تكون JSON numbers، وتعبر عن مجموع الوجبة كلها.
يمكن أيضًا إرجاعها تحت data.nutrition. غياب القيم أو سالبها يُعرض كخطأ.
التحليل يجب ألا يسجل الوجبة؛ التسجيل يتم فقط عند الضغط على Add Meal بعد المراجعة.

3. Create Meal — Nutrition / Ingredients: POST JSON
{
  "name": "Chicken and rice",
  "mealType": "lunch",
  "method": "nutrition",
  "nutrition": { "calories": 650, "protein": 50, "carbs": 70, "fat": 15 }
}
إذا method = ingredients، يضاف ingredients إلى نفس الطلب.

4. Create Meal — Photo: POST multipart/form-data
photo: ملف الصورة
name / mealType / method: حقول نصية
nutrition: JSON string للقيم الأربع بعد المراجعة
بإمكان الباك إند استخدام نفس saveUrl مع دعم JSON وmultipart.
يمكن تعديل photoFormData إذا الباك إند يفضل photoId من استجابة التحليل.

استجابة الحفظ
HTTP ناجح مع JSON مثل {"success":true,"meal":{...}} أو HTTP 204.
HTTP خطأ أو {"success":false} يمنع الانتقال ولا يدّعي نجاح الحفظ.
يُمنع تكرار الضغط أثناء الطلب أو بعد الحفظ الناجح.
عند خطأ شبكة/مهلة بعد الحفظ قد يكون السيرفر سجّل الوجبة؛ تحقق من History قبل إعادة الحفظ.

وقت الوجبة
الواجهة لا ترسل date/time. Backend يجب أن يسجّل createdAt بوقت إنشاء الوجبة
ويحدد تاريخ التجميع في Dashboard بحسب المنطقة الزمنية المعتمدة للمستخدم.
لا تعتمدوا على وقت جهاز العميل لتحديد وقت الحفظ الرسمي.

Auth والملفات
الطلبات تستخدم credentials: include. عدّل getHeaders لنفس آلية auth في Dashboard.
CORS يجب أن يسمح بأصل الواجهة والـcredentials عند استخدام Cookies.
أضيفوا CSRF header في getHeaders إذا يتطلبه الباك إند.
تحقق ملفات الصور وحجمها الحقيقي ومحتواها يجب أن يتم أيضًا في السيرفر.
حد الواجهة للصور 10 MB؛ عدّله حسب حدود API الفعلية.
الصفحة لا تتصل مباشرة بأي AI provider ولا تحتوي OpenAI API key.

الفحوص
تم فحص التحقق من الأرقام، طلبات JSON وmultipart، عدم إرسال التاريخ والوقت،
المراجعة قبل الحفظ، إبطال التحليل عند تغير المدخلات، والتحويل للداشبورد بعد الحفظ.
تم التحقق من روابط HTML وCSS وJS داخل الحزمة. لم تتوفر معاينة متصفح مرئية هنا.

تحديث التنقل: Meals وAdd Meal كلاهما يفتح add-meal.html من Dashboard وصفحة الإضافة.
سعرات By Nutrition تحسب من 4 kcal/g للبروتين والكارب، و9 kcal/g للدهون؛ هذه تقديرات الماكروز.
في مراجعة التحليل تُستخدم سعرات API عند بقاء الماكروز كما هي، ويعاد حساب السعرات إذا عدّلها المستخدم.
Meal Description محذوف من كل الخيارات ومن طلبات التحليل والحفظ.
أيقونة Protein في Dashboard أصبحت رسم SVG لعضلة ذراع باللون الأخضر.

STANDALONE MEALS UPDATE V9
Keep add-meal.html, add-meal.css and add-meal.js in the same directory. add-meal.css now includes the shared logo, navigation, colors and responsive layout, so dashboard.css is no longer needed for this page. Place these files beside the other pages to retain navigation. Keep your existing MEAL_API configuration when replacing JavaScript.
