# منصة التدريب التعاوني

Backend: Node.js + Express + JWT | Frontend: HTML/CSS/JS | التخزين: ملف `data.json`

## التشغيل في Visual Studio Code
1. ثبّت Node.js (الإصدار 18 أو أحدث) من https://nodejs.org
2. افتح المجلد في VS Code: File → Open Folder → `coop-training`
3. افتح الطرفية: Terminal → New Terminal
4. نفّذ:
   ```
   npm install
   npm start
   ```
5. افتح المتصفح على http://localhost:3000

## ترتيب التجربة
1. سجّل حساب **مشرف أكاديمي** أولاً (حتى يظهر في قائمة الطلاب).
2. سجّل حساب **جهة تدريب** وانشر فرصة.
3. سجّل حساب **طالب** واختر المشرف، ثم قدّم على الفرصة.
4. من حساب الجهة: اقبل الطلب. من حساب الطالب: ارفع تقريراً. من حساب المشرف: اعتمده وضع الدرجة.

## للنشر الفعلي
- اضبط متغير البيئة `JWT_SECRET` بقيمة قوية.
- استبدل `data.json` بقاعدة بيانات (PostgreSQL / MongoDB).
- فعّل HTTPS، وأضف حساب مدير للتحقق من الجهات والمشرفين.

## الرفع إلى GitHub
```
git init
git add .
git commit -m "الإصدار الأول"
git branch -M main
git remote add origin https://github.com/USERNAME/coop-training.git
git push -u origin main
```
> ملف `data.json` مستثنى عمداً (.gitignore) لأنه يحتوي بيانات المستخدمين وكلمات المرور المشفّرة.
