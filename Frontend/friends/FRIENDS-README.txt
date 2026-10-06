Calorie Friends — v12

طريقة التشغيل:
1. ضع friends.html وfriends.css وfriends.js في نفس مجلد الصفحات السابقة.
2. شغل friends.html باستخدام Go Live.
3. الروابط: dashboard.html وadd-meal.html وhistory.html وchatbot.html وprofile.html.
   زر Friends في الصفحات السابقة يفتح friends.html.
   الصفحات السابقة ليست مكررة داخل هذا الملف المضغوط؛ احتفظ بملفاتها في نفس المجلد.
4. الشعار SVG من صفحة Dashboard نفسها، والخط Arial، والقائمة على اليسار.
5. CSS مستقل ولا يحتاج dashboard.css أو Bootstrap أو مكتبة أيقونات خارجية.

الواجهة:
- البحث يفلتر أسماء المستخدمين في القائمة الحالية؛ لا يبحث عن مستخدمين خارج قائمة الأصدقاء والطلبات.
- My Friends وFriend Requests، الفرز، Refresh، View Progress، Accept وDecline وRemove Friend.
- لا صور حسابات، لا حالات Online/Active، لا مفتاح توضيح للألوان فوق القائمة.
- على الجوال تصبح قائمة الموقع أعلى المحتوى وتلتف بطاقات الأصدقاء.
- لا توجد بيانات تجريبية أو أصدقاء أو طلبات جاهزة.
- قبل ربط API تكون القوائم فارغة. بعد الربط تعرض بيانات حساب المستخدم من الباك إند فقط.

حساب النسبة:
Math.round(consumed / target * 100)
80% فأكثر أخضر، 50–79% أصفر، 30–49% أحمر، 0–29% بنفسجي.
يتم اختيار اللون بناء على النسبة المقربة المعروضة لتجنب اختلاف الرقم واللون.
عند تجاوز 100% تظهر النسبة الحقيقية ويبقى اللون أخضر ويقف طول المؤشر عند 100%.
البيانات الناقصة أو الهدف صفر تظهر — بالرمادي، وليس نسبة وهمية.
أمثلة: 1800/2200 = 82% أخضر؛ 1000/2000 = 50% أصفر؛
600/2000 = 30% أحمر؛ 580/2000 = 29% بنفسجي.

Backend integration:
Edit FRIENDS_CONFIG in friends.js and enter your backend URLs. No mock mode exists.
Requests include credentials: 'include'. Use getHeaders() for your existing authentication scheme.
No API keys are embedded. Backend must enforce access to friends' shared progress.

GET friendsUrl ->
{"success":true,"friends":[{"id":"1","username":"ahmed","name":"Ahmed","streak":12,"level":8,"calories":{"consumed":1800,"target":2200}}]}

GET requestsUrl ->
{"success":true,"requests":[{"id":"request-1","username":"omar","name":"Omar"}]}

GET progressUrl?friendId=1 ->
{"success":true,"progress":{"streak":12,"level":8,"calories":{"consumed":1800,"target":2200},"protein":{"consumed":90,"target":120},"carbs":{"consumed":150,"target":200},"fat":{"consumed":40,"target":60}}}

POST actionUrl, Content-Type: application/json
Accept: {"action":"accept","requestId":"request-1"}
Decline: {"action":"decline","requestId":"request-1"}
Remove: {"action":"remove","friendId":"1"}
Success: {"success":true} or HTTP 204. The frontend refreshes both lists afterward.
Errors: an HTTP error, or {"success":false,"message":"Error message"}.

POST logoutUrl clears the authenticated session, then redirects to login.html.
Use numeric consumed/target/streak/level, not numeric strings.
The frontend computes percentages; the API does not need to send them.
Refresh fetches real data only after API URLs are configured.
