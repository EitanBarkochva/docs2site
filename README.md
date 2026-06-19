# Docs2Site

Docs2Site הוא MVP פשוט שממיר תיקיית Google Drive עם קבצי Google Docs לאתר תוכן בעברית.

## מה האפליקציה עושה

- התחברות עם Google OAuth
- קריאת קבצי Google Docs מתוך תיקיית Drive
- מיון מסמכים לפי שם הקובץ, כולל מספרים בתחילת השם
- הסתרת מספרי סדר בתפריט האתר
- ייצוא כל Google Doc ל-HTML
- יצירת אתר ציבורי בנתיב `/site/:slug`
- תמיכה מלאה בעברית ו-RTL
- שמירה ב-Supabase, או בזיכרון מקומי כשאין Supabase מוגדר

## הרצה מקומית

```bash
npm install
npm start
```

פתחו בדפדפן:

```text
http://localhost:3000
```

## הגדרות

צרו קובץ `.env` לפי `.env.example`:

```env
PORT=3000
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

הגדרות Supabase הן אופציונליות ל-MVP מקומי. בלי Supabase הנתונים נשמרים בזיכרון עד הפעלה מחדש.

## Supabase

הריצו את `supabase-schema.sql` בפרויקט Supabase כדי ליצור את הטבלאות:

- `users`
- `sites`
- `pages`

## הערת עלות

הקוד יכול להיות מאוחסן בחינם ב-GitHub public repository. כדי להריץ את השרת באינטרנט צריך שירות שמריץ Node.js. אפשר להתחיל מ-free tiers, אבל GitHub Pages לבד אינו מתאים ל-`server.js`.
