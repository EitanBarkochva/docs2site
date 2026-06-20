# Docs2Site

Docs2Site הוא MVP פשוט שממיר תיקיית Google Drive עם קבצי Google Docs לקבצי HTML סטטיים או לאתר תוכן מקומי.

## מה האפליקציה עושה

- התחברות עם Google OAuth
- קריאת קבצי Google Docs מתוך תיקיית Drive
- מיון מסמכים לפי שם הקובץ, כולל מספרים בתחילת השם
- הסתרת מספרי סדר בתפריט
- ייצוא כל Google Doc ל-HTML
- יצירת תיקיית HTML מקומית עם `index.html` וקובץ `.html` לכל מסמך
- תמיכה בעברית ו-RTL

## הרצה מקומית

```bash
npm install
npm start
```

פתחו בדפדפן:

```text
http://localhost:3000
```

## הגדרות Google

צרו קובץ `.env` לפי `.env.example`:

```env
PORT=3000
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

ב-Google Cloud צריך להוסיף ל-OAuth Client:

```text
http://localhost:3000
```

תחת `Authorized JavaScript origins`.

## יצירת קבצי HTML

אחרי התחברות עם Google:

1. מדביקים קישור לתיקיית Drive.
2. לוחצים `צור קבצי HTML`.
3. התוצרים נוצרים מקומית תחת:

```text
C:\codex\docSites\exports
```

שם התיקייה יהיה שם תיקיית Drive עם תוספת `HTML`.

בתוכה ייווצרו:

- `index.html`
- קובץ `.html` לכל Google Doc

כל קובץ כולל בתוכו HTML, CSS ו-JavaScript, כך שאפשר לפתוח אותו גם בלי שרת.
