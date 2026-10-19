# ספר הבאגים — מה נשבר לי, למה, ואיך לא להיתקע בפעם הבאה

מסמך זה נבנה מהמערכת הזו (ניהול נסיעות/חיובים — Vite + React + TanStack Router + Supabase + Vercel):
מהיסטוריית הקומיטים (כל קומיט שמתחיל ב-`Fix` הוא באג שעלה לי זמן) ומסריקה של הקוד עצמו.
חלק מהבאגים כאן **עדיין קיימים בקוד** — הם מסומנים ב-🔴.

**איך להשתמש בזה:** לפני שמתחילים מערכת חדשה — לעבור על "צ'ק-ליסט יום 0" בסוף.
כשנתקעים — לחפש את התסמין בתוכן העניינים.

---

## תוכן עניינים

1. [דיפלוי, בנייה ו-ENV](#1-דיפלוי-בנייה-ו-env)
2. [Supabase — שליפות ונתונים](#2-supabase--שליפות-ונתונים)
3. [הרשאות ואבטחה](#3-הרשאות-ואבטחה)
4. [כסף, מע״מ וחישובים](#4-כסף-מעמ-וחישובים)
5. [תאריכים ואקסל](#5-תאריכים-ואקסל)
6. [State, סנכרון ו-React](#6-state-סנכרון-ו-react)
7. [עברית, RTL ו-UI](#7-עברית-rtl-ו-ui)
8. [תהליך עבודה ואיכות](#8-תהליך-עבודה-ואיכות)
9. [צ'ק-ליסט יום 0 למערכת הבאה](#9-צקליסט-יום-0-למערכת-הבאה)
10. [נספח: קוד מוכן להעתקה](#10-נספח-קוד-מוכן-להעתקה)

---

## 1. דיפלוי, בנייה ו-ENV

### 1.1 הבנייה נשברה בגלל פריימוורק שלא התאים לפריסה
**תסמין:** האתר עולה ריק / 404 אחרי דיפלוי ל-Vercel. ארבעה קומיטים רצופים כדי לייצב
(`Switch to plain Vite config`, `Add vercel.json`, `Fix SPA build: add index.html, main.tsx, stubs`).

**סיבה:** הפרויקט נוצר כ-TanStack **Start** (SSR/fullstack) אבל נפרס כ-SPA סטטי.
נדרשו stubs ידניים (`src/stubs/tanstack-start.ts`) כדי לנטרל מודולים שרצים רק בשרת.

**פתרון שננקט:** `vite.config.ts` רגיל + alias שמחליף את מודולי השרת ב-stubs ריקים.

**🧭 כלל לפעם הבאה:**
> להחליט **לפני** שורת הקוד הראשונה: SPA סטטי או SSR? ולבחור starter שתואם ליעד הפריסה.
> אם היעד הוא Vercel/Netlify סטטי — להתחיל מ-Vite SPA נקי. לא להמיר פריימוורק באמצע.
> **בדיקה:** `npm run build && npm run preview` חייב לעבוד **מקומית** לפני הדיפלוי הראשון, ביום הראשון.

---

### 1.2 ה-rewrite של ה-SPA בלע את ה-API
**תסמין:** כל קריאה ל-`/api/...` החזירה את ה-HTML של האפליקציה במקום JSON.
(קומיט `Fix vercel.json: exclude /api routes from SPA rewrite`)

**סיבה:** הכלל היה `{"source": "/(.*)", "destination": "/index.html"}` — תפס גם את `/api`.

**פתרון:**
```json
{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }] }
```

**🧭 כלל:** כל rewrite של SPA חייב negative lookahead לנתיבי השרת (`api/`, `assets/`, `_`).
אחרי כל שינוי ב-`vercel.json`: `curl -i https://<site>/api/health` — אם חזר `text/html`, הכלל שבור.
(כדאי להוסיף endpoint `/api/health` טריוויאלי בדיוק בשביל הבדיקה הזו.)

---

### 1.3 משתני סביבה: `VITE_` מול שרת
**תסמין:** בלוקאלי עובד, בפרודקשן `Missing Supabase environment variables`.

**סיבה:** ב-Vite רק משתנים עם קידומת `VITE_` מוזרקים ל-bundle של הדפדפן.
`process.env.X` בקוד לקוח הוא `undefined` בפרודקשן. בקוד הזה יש fallback כפול
(`import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL`) שמסתיר את הבעיה בפיתוח.

**🧭 כלל:**
> - משתנה שנגמר בדפדפן ⇒ `VITE_*` וגם מוגדר בלוח הבקרה של Vercel (לכל Environment: Production/Preview).
> - משתנה סודי (service role key, מפתחות API) ⇒ **בלי** `VITE_`, רק בפונקציות שרת.
> - לאמת ב-build: `grep -r "SERVICE_ROLE" dist/` חייב להחזיר כלום.

---

### 1.4 🔴 קובץ `.env` נמצא בתוך ה-git
**תסמין:** `git ls-files | grep env` ⇒ `.env` מופיע. ה-`.gitignore` **לא** מכיל `.env`.

**סיבה:** ה-starter לא כלל את זה, ואף אחד לא בדק.

כרגע שם יש רק מפתחות publishable (anon) — לא אסון, אבל זו הרגל שבפעם הבאה יכניס service key לריפו ציבורי.

**פתרון:**
```bash
printf '\n.env\n.env.*\n!.env.example\n' >> .gitignore
git rm --cached .env
# ליצור .env.example עם שמות המשתנים בלבד, בלי ערכים
```
אם מפתח סודי כבר נדחף — **להחליף אותו (rotate)**, לא רק למחוק את הקובץ. ההיסטוריה נשארת.

**🧭 כלל:** `.env` ב-`.gitignore` **בקומיט הראשון**, תמיד, ביחד עם `.env.example`.

---

### 1.5 שני lockfiles בריפו אחד
**תסמין:** `bun.lockb` + `package-lock.json` ביחד. גרסאות שונות בין מקומי לבין ה-CI של Vercel ⇒
"אצלי זה עובד".

**🧭 כלל:** מנהל חבילות אחד לפרויקט. בוחרים, מוחקים את השני, ומקבעים ב-`package.json`:
```json
"packageManager": "npm@10.9.0",
"engines": { "node": ">=20" }
```

---

## 2. Supabase — שליפות ונתונים

### 2.1 תקרת 1000 השורות (הבאג הכי מתעתע)
**תסמין:** דוחות וסכומים נראים נכון בהתחלה, ואחרי שהמערכת גדלה — חסרות נסיעות, החוב יוצא קטן מדי.
**בלי שגיאה. בלי כלום.**

**סיבה:** Supabase מגביל כל בקשה ל-~1000 שורות כברירת מחדל.

**פתרון שננקט (טוב):** `src/lib/fetch-all.ts` — pagination עם `.range()`.

**🧭 כלל:**
> **אסור** להשתמש ב-`supabase.from(...).select()` ישירות כשמספר התוצאות לא חסום מראש.
> יוצרים `fetchAllRows` **ביום הראשון** ומשתמשים רק בו.
> כלל אצבע: אם אי פעם יהיו יותר מ-1000 שורות בטבלה — חייבים pagination.
>
> עדיף אף יותר: **לא לשלוף הכול ללקוח**. סכומים מחשבים ב-SQL (VIEW או RPC) ומחזירים שורה אחת.
> 50,000 נסיעות שעוברות ברשת כדי לחשב סכום זה בזבוז שיהפוך לכאב.

---

### 2.2 🔴 `.in()` עם מערך ארוך — הבקשה נופלת
**תסמין:** העלאת קובץ אקסל גדול נכשלת עם `414 URI Too Long` או שגיאה סתומה.

**מיקום:** `src/components/trips/UploadTripsDialog.tsx` — בדיקת כפילויות:
```ts
.in("trip_number", numbers)   // numbers יכול להיות 3000 מספרים
```
גם `withAutoReturnTrips` ו-`list-users` סובלים מזה.

**סיבה:** `.in()` נבנה לתוך ה-URL. מעל ~1-2K פריטים זה חורג מהמגבלה.

**פתרון:**
```ts
async function inChunks<T>(items: string[], size: number, fn: (chunk: string[]) => Promise<T[]>) {
  const out: T[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await fn(items.slice(i, i + size))));
  return out;
}
const existing = await inChunks(numbers, 500, (chunk) =>
  supabase.from("trips").select("trip_number").in("trip_number", chunk).then((r) => r.data ?? []),
);
```

**🧭 כלל:** כל `.in()` שהמערך שלו מגיע מקלט משתמש — בצ'אנקים של 500. גם `insert` של הרבה שורות: בצ'אנקים.

---

### 2.3 🔴 הקצאת מספרי נסיעה בצד הלקוח — תנאי מירוץ
**תסמין:** שני משתמשים מעלים קבצים באותה דקה ⇒ `duplicate key value violates unique constraint` והעלאה נכשלת באמצע.

**מיקום:** `src/lib/trip-numbers.ts` — שולף את **כל** המספרים הקיימים, מחפש חורים, מקצה.
בין השליפה להכנסה יכול להיכנס מישהו אחר.

**פתרון נכון — בצד ה-DB:**
```sql
CREATE SEQUENCE IF NOT EXISTS trip_number_seq;
ALTER TABLE trips ALTER COLUMN trip_number
  SET DEFAULT lpad(nextval('trip_number_seq')::text, 4, '0');
```
או RPC שמקצה אטומית. אם חייבים לוגיקת "החור הקטן ביותר" — פונקציית Postgres עם `FOR UPDATE`.

**🧭 כלל:**
> כל ערך ייחודי (מספר חשבונית, מספר נסיעה, מספר הזמנה) מוקצה ב-**DB**, לא בדפדפן.
> שליפה→חישוב→כתיבה מהלקוח היא תמיד תנאי מירוץ.
> ובנוסף: תמיד לטפל ב-`error.code === "23505"` עם retry במקום לקרוס.

---

### 2.4 🔴 Read-Modify-Write על מערך — עדכון אבוד
**מיקום:** `src/lib/client-matching.ts` → `addAliasToClient`: קורא `aliases`, מוסיף, כותב את כל המערך.
שתי הוספות במקביל ⇒ אחת נעלמת.

**פתרון:** לעשות את זה אטומית ב-SQL:
```sql
CREATE OR REPLACE FUNCTION add_client_alias(p_client_id uuid, p_alias text)
RETURNS void LANGUAGE sql AS $$
  UPDATE clients SET aliases = array_append(aliases, p_alias)
  WHERE id = p_client_id AND NOT (p_alias = ANY(COALESCE(aliases, '{}')));
$$;
```
או — עדיף מבנית — טבלת `client_aliases` נפרדת עם `UNIQUE(client_id, alias)`.

**🧭 כלל:** מערכים/JSON בעמודה הם נוחים עד שצריך לעדכן אותם במקביל. רשימה שגדלה = טבלה.

---

### 2.5 🔴 שם לקוח כמפתח זר — ושינוי שם בלי טרנזקציה
**מיקום:** `renameClient` מעדכן `clients.name`, ואז `trips.client`, ואז `payments.client` — שלוש פעולות נפרדות.
אם השנייה נכשלת, הנתונים נשארים חצי-משונים, והחוב של הלקוח "נעלם".

גם ככה: `trips.client` ו-`payments.client` מחזיקים **טקסט** ולא `client_id`. כל רווח כפול = לקוח חדש.

**פתרון:**
1. להצמיד הכול ל-`client_id uuid REFERENCES clients(id)`. השם נשלף ב-join. שינוי שם = `UPDATE` אחד.
2. עד שזה קורה — לעטוף את ה-rename ב-RPC אחת (פונקציית Postgres = טרנזקציה אוטומטית).

**🧭 כלל:**
> **אף פעם לא להשתמש בשדה שהמשתמש יכול לערוך בתור מפתח.** מפתחות הם UUID. שמות הם תצוגה.
> כל רצף של 2+ כתיבות שחייב להצליח ביחד ⇒ RPC אחת, לא לולאה מהדפדפן.

---

### 2.6 🔴 `update` על שורה שאולי לא קיימת — כישלון שקט
**מיקום:** `src/lib/billing-month.ts` → `setBillingMonth` עושה
`update({value}).eq("key","current_billing_month")`.
אם השורה לא קיימת: **0 שורות עודכנו, בלי שגיאה**. המשתמש רואה "נשמר" והכלום נשמר.

**פתרון:**
```ts
const { error } = await supabase
  .from("settings")
  .upsert({ key: "current_billing_month", value: month }, { onConflict: "key" });
```
ולאמת כמות שורות כשצריך: `.select("key")` אחרי update ולבדוק `data.length`.

**🧭 כלל:** להגדרות/מונים — תמיד `upsert`, אף פעם לא `update` "עיוור".
כל פעולת כתיבה חייבת לאמת שמשהו באמת השתנה לפני שמציגים הודעת הצלחה.

---

### 2.7 🔴 ברירות מחדל קשיחות שמשקרות
**מיקום:** `fetchBillingMonth` מחזיר `"2026-04"` / `"2026-03-26"` אם אין שורה ב-DB.
ביום שהטבלה ריקה או ה-RLS חוסם — כל המערכת עובדת חודשיים אחורה **בשקט** וכל החיובים יוצאים לחודש הלא נכון.

**🧭 כלל:**
> ברירת מחדל שקטה על נתון עסקי = באג חמור שמגלים אחרי שהלקוחות קיבלו חשבונית שגויה.
> אם ההגדרה חסרה — להציג שגיאה ולעצור, או לגזור אותה מהתאריך הנוכחי. לא להמציא קבוע.

---

### 2.8 שגיאות שנבלעות ל-`console.error` ומחזירות ריק
**מיקום:** `fetchAdditionalCharges`, `fetchExcludedSet`, `setTripsExcluded` ועוד — כולם:
```ts
if (error) { console.error(...); return []; }
```
**התוצאה:** נפילת רשת או חסימת RLS נראית למשתמש בדיוק כמו "אין חיובים" — והסכומים יוצאים נמוכים מדי.

**🧭 כלל:**
> בשום מקום שבו מספר כספי מוצג, "שגיאה" לא יכולה להיראות כמו "0".
> או שזורקים (`throw`) ומציגים מצב שגיאה ב-UI, או מחזירים `{ data, error }` והקורא מחליט.
> `console.error` לבד אינו טיפול בשגיאה — אף משתמש לא פותח DevTools.

---

### 2.9 אינדקסים שחסרים
כל שאילתה שמסננת לפי `billing_month`, `client_id`, `trip_date` צריכה אינדקס.
```sql
CREATE INDEX IF NOT EXISTS trips_billing_month_idx ON trips(billing_month);
CREATE INDEX IF NOT EXISTS trips_client_date_idx   ON trips(client_id, trip_date);
```
**🧭 כלל:** כל עמודה שמופיעה אחרי `.eq()` / `.in()` / `ORDER BY` — אינדקס, מהיום הראשון. זה שורה אחת ב-SQL.

---

## 3. הרשאות ואבטחה

### 3.1 🔴 הכי חמור: ההרשאות קיימות רק ב-UI
**מיקום:** `auth-context.tsx` מספק `canView` / `canEdit` ומסתיר כפתורים.
אבל ה-RLS בפועל:
```sql
CREATE POLICY "Auth can update trips" ON public.trips FOR UPDATE TO authenticated USING (true);
```
**כלומר: כל משתמש מחובר יכול לשנות/למחוק כל נסיעה ישירות דרך ה-API**, גם אם אין לו הרשאת עריכה.
הכפתור מוסתר — ה-endpoint פתוח. ה-anon key גלוי לכל אחד שפותח DevTools.

**פתרון:** לאכוף את אותה הרשאה ב-RLS:
```sql
CREATE OR REPLACE FUNCTION public.can_edit(p_page text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM user_page_permissions
                 WHERE user_id = auth.uid() AND page = p_page AND can_edit);
$$;

DROP POLICY "Auth can update trips" ON public.trips;
CREATE POLICY "edit trips" ON public.trips FOR UPDATE TO authenticated
  USING (public.can_edit('trips')) WITH CHECK (public.can_edit('trips'));
```

**🧭 כלל:**
> **UI מסתיר, DB אוכף.** כל הרשאה חייבת להתקיים פעמיים — בתצוגה **וגם** ב-RLS.
> מבחן: "אם המשתמש יפתח קונסול ויריץ את הקריאה בעצמו — מה יקרה?" אם התשובה "הוא ימחק דברים" — יש חור.

---

### 3.2 🔴 טבלת `settings` פתוחה לגמרי
```sql
CREATE POLICY "Public can update settings" ON public.settings FOR UPDATE USING (true);
```
בלי `TO authenticated` — זה כולל **anon**. כל מי שיש לו את ה-URL וה-anon key (כלומר: כל אחד)
יכול לשנות את חודש החיוב, את אחוז המע״מ ואת תבניות ההודעות.

**פתרון:** קריאה ל-`authenticated`, כתיבה לאדמינים בלבד.

**🧭 כלל:** `USING (true)` בלי `TO authenticated` זה "כולם, גם אנונימיים".
לעבור על **כל** המדיניות אחרי כל מיגרציה:
```sql
SELECT tablename, policyname, roles, cmd, qual FROM pg_policies WHERE schemaname='public';
```
וגם לוודא שאין טבלה בלי RLS בכלל:
```sql
SELECT tablename FROM pg_tables t WHERE schemaname='public'
  AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relname=t.tablename AND c.relrowsecurity);
```

---

### 3.3 🔴 Bootstrap של אדמין מצד הלקוח = הסלמת הרשאות
**מיקום:** `auth-context.tsx`:
```ts
// Bootstrap: if no admins exist, promote this user.
if (!count || count === 0) { await supabase.from("user_roles").insert({ user_id: uid, role: "admin" }); }
```
הקוד הזה רץ **בדפדפן**. אם מדיניות ה-INSERT על `user_roles` מתירה למשתמש להוסיף לעצמו תפקיד,
כל משתמש חדש יכול להפוך את עצמו לאדמין בקריאה אחת. וגם — זה מירוץ: שני משתמשים ראשונים, שני אדמינים.

**פתרון:** להריץ bootstrap פעם אחת ידנית ב-SQL Editor, או בטריגר `SECURITY DEFINER` שמקדם
רק אם `(SELECT count(*) FROM user_roles WHERE role='admin') = 0` — בתוך ה-DB.

**🧭 כלל:** החלטות על **תפקידים** אף פעם לא נקבעות בקוד שרץ אצל המשתמש.

---

### 3.4 מה כן נעשה נכון — לשמר
- ה-`service_role` key נמצא **רק** בפונקציות Vercel (`api/_supabase-admin.ts`), לא בקוד הלקוח. ✅
- כל handler אדמין בודק `token → getUser → has_role('admin')` לפני כל פעולה. ✅
- הפרדה בין `has_role()` ב-`SECURITY DEFINER` לבין הטבלה — מונע רקורסיה אינסופית ב-RLS. ✅

**🧭 כלל:** `service_role` עוקף RLS לחלוטין. כל route שמשתמש בו חייב לבדוק אימות **והרשאה** בשורות הראשונות.

---

### 3.5 🔴 Monkey-patch גלובלי על `window.fetch`
**מיקום:** `auth-context.tsx` דורס את `window.fetch` כדי לצרף טוקן לקריאות `/_serverFn/`.

למה זה באג-בהמתנה: רץ בזמן import (side effect), משפיע על **כל** בקשה באפליקציה (גם צד ג'),
בלתי ניתן לדיבוג, ומסתמך על מחרוזת בנתיב. בנוסף — הוא עדיין שם למרות שהמעבר ל-SPA הוציא את
`_serverFn` מהתמונה; זה קוד מת שמאט כל fetch.

**פתרון:** wrapper מפורש (`apiFetch`) שמשתמשים בו במפורש, או `supabase.functions.invoke`.

**🧭 כלל:** לא לדרוס גלובלים של הדפדפן. פונקציית עטיפה מפורשת תמיד עדיפה.

---

## 4. כסף, מע״מ וחישובים

### 4.1 עיגול לכל שורה במקום פעם אחת בסוף
**מיקום:** `client-price.ts` מעגל כל נסיעה ל-2 ספרות. 300 נסיעות × עיגול = סטייה של שקלים בסכום החודשי,
והלקוח מתקשר לשאול למה החשבונית לא מסתדרת.

**🧭 כלל:**
> `סכום של מעוגלים ≠ עיגול של סכום`. מעגלים **פעם אחת**, בנקודת התצוגה/החשבונית.
> הכי בטוח: לשמור כסף ב-**אגורות כמספר שלם** (`integer`) ולהמיר רק בתצוגה.
> ב-Postgres: `numeric`, אף פעם לא `float8`. (כאן השתמשו ב-`NUMERIC` ✅ — אבל ב-JS הכול הופך ל-float.)

---

### 4.2 🔴 מע״מ עם ערך ברירת מחדל בזמן טעינה
**מיקום:** `vat-context.tsx` מחזיק `DEFAULT_VAT_RATE` עד שה-fetch חוזר, ומספק `loading` — אבל אם
רכיב מחשב סכומים לפני שהטעינה הסתיימה, המשתמש רואה **מספרים שגויים לשבריר שנייה**,
וגרוע מזה — אם הוא ילחץ "שלח" באותו רגע, הסכום השגוי יישלח.

**🧭 כלל:**
> נתון עסקי שנטען אסינכרונית (מע״מ, שער, מחירון): כל עוד `loading` — **לא מציגים מספר ולא מאפשרים פעולה**.
> skeleton או כפתור מושבת. ברירת מחדל שקטה על מע״מ = חשבונית שגויה.
> ובנוסף: לשמור על כל חשבונית את **שיעור המע״מ שבו היא חושבה**. שינוי מע״מ עתידי לא יכול לשנות היסטוריה.

---

### 4.3 🔴 "החודש הנוכחי" מחושב משעון המכשיר
**מיקום:** `payments.tsx` (3 מקומות) ו-`reports.tsx`:
```ts
const now = new Date();
const current = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
```
אבל למערכת יש מושג מפורש של **חודש חיוב** (`fetchBillingMonth`), שמתחיל ב-26 לחודש הקודם.
בסוף חודש השניים מתפצלים — ו"חוב ללא החודש הנוכחי" מחשב דבר אחר ממה שהמשתמש רואה בכותרת.
כולל: משתמש עם שעון/אזור זמן שונה רואה מספרים אחרים.

**🧭 כלל:**
> אם למערכת יש מושג זמן עסקי (חודש חיוב, שנת כספים) — **אסור** ל-`new Date()` להופיע בלוגיקה עסקית.
> מקור אמת אחד: `billing.month`. `new Date()` מותר רק לתצוגת "עודכן לפני X".

---

### 4.4 🔴 חיפוש שמתאים מספרים "בערך"
**מיקום:** `payments.tsx`:
```ts
if (Math.abs(v - qNum) < 0.5) return true;       // סבילות
return s2.includes(numericQ) || s0.includes(numericQ);  // substring
```
חיפוש "100" מחזיר גם 1001, 2100 ו-99.7. בעמוד של חובות זה מבלבל מאוד.

**🧭 כלל:** חיפוש מספרי = התאמה מדויקת (או טווח מפורש שהמשתמש בחר). substring על סכומים זו הפתעה.

---

## 5. תאריכים ואקסל

### 5.1 DD/MM מול MM/DD — הלקח שכבר תועד בקוד
בקוד יש הערה: `// NEVER use new Date(string) here — it misinterprets DD/MM as MM/DD.`
זה לקח שנקנה בדם: `new Date("03/04/2026")` = 4 במרץ בארה״ב, 3 באפריל בישראל.

**🧭 כלל:** `new Date(string)` **אסור** על קלט משתמש. תמיד פירוק מפורש של המחרוזת. ✅ (נפתר כאן)

---

### 5.2 🔴 `toISOString().slice(0,10)` — יום אחורה
**מיקום:** `AddTripDialog.tsx`: `const today = new Date().toISOString().slice(0,10);`

`toISOString` מחזיר **UTC**. בישראל (UTC+2/+3), בין חצות ל-03:00, "היום" יוצא **אתמול**.
נסיעה שמוזנת ב-01:00 נרשמת ליום הקודם — ואם זה 26 לחודש, היא נוחתת בחודש חיוב אחר.

**פתרון:**
```ts
const localISODate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```
(הפונקציה הזו כבר קיימת בקוד בתוך `getMonthRange` — פשוט לא השתמשו בה בכל מקום.)

**🧭 כלל:**
> תאריך "יומי" (יום נסיעה, יום חיוב) נשמר כ-`date` ומחושב ב-**זמן מקומי**, לעולם לא דרך `toISOString`.
> חותמת זמן אמיתית (`created_at`) נשמרת כ-`timestamptz` ב-UTC. לא לערבב בין השניים.

---

### 5.3 תאריכי סריאל של אקסל
`parseExcelDate` מטפל נכון: `(value - 25569) * 86400 * 1000` + getters של UTC. ✅
שימו לב לשתי מלכודות שנפתרו כאן אבל חוזרות תמיד:
- אקסל חושב ש-1900 הייתה שנה מעוברת ⇒ האופסט 25569 מניח זאת (נכון ל-Windows epoch).
- חובה `getUTC*` ולא `get*`, אחרת אזור זמן מזיז את היום.
- חובה `XLSX.read(buf, { cellDates: true })` — אחרת מקבלים מספרים וגם תאים שכבר הומרו ל-Date, מעורבב.

**🧭 כלל:** פונקציית פירוק תאריך **אחת** בכל הפרויקט, עם בדיקות על: `Date`, מספר סריאל,
`"26/03/2026"`, `"26/3/26"`, `"26-03-2026"`, `"26/03/2026, 14:30"`, ריק, זבל. כל מקרה שנתקלת בו — נכנס לבדיקה.

---

## 6. State, סנכרון ו-React

### 6.1 localStorage כבסיס נתונים — העלות האמיתית
**תסמין:** שלושה קומיטים רק כדי לצאת מזה
(`העבר חיובים ידניים... מ-localStorage לענן`, `הוסף כפתורי ייצוא/ייבוא`).
ועדיין נשאר בקוד מסך של "ייצא חיובים ישנים מהדפדפן הזה" — שהוא בעצם התנצלות על הארכיטקטורה.

**למה זה כאב:** הנתונים חיו רק בדפדפן אחד. מחשב אחר = נתונים אחרים. ניקוי cache = הכול נמחק.
אי אפשר לגבות, אי אפשר לבדוק מול הלקוח מה באמת קרה.

**🧭 כלל:**
> `localStorage` הוא **רק** להעדפות תצוגה (מיון, פילטר, מצב סרגל). לעולם לא לנתונים שהמשתמש יצר.
> שאלת הסינון: "אם המשתמש יפתח מחשב אחר — האם הוא חייב לראות את זה?" כן ⇒ ענן, מהרגע הראשון.
> המיגרציה אחר כך עולה פי 10 מלעשות את זה נכון מראש.

---

### 6.2 Realtime — מה שצריך כדי שזה יעבוד
`use-realtime-sync.ts` מימש נכון: debounce של 300ms, `cbRef` נגד stale closure, ניקוי ב-cleanup. ✅
בצד ה-DB נדרשו `REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE` — ✅ קיים.

שתי נקודות תשומת לב שנשארו:
- שם הערוץ מכיל `Math.random()` ⇒ בכל re-mount נפתח ערוץ חדש. ב-React StrictMode (dev) זה כפול.
לא דליפה (יש `removeChannel`), אבל קשה לדבג.
- `eslint-disable react-hooks/exhaustive-deps` + `[tables.join(",")]` — עובד, אבל מסתיר שגיאות עתידיות.
עדיף `useMemo` על המערך או לקבל מחרוזת מוכנה.

**🧭 כלל:** Realtime דורש **שלושה** דברים ביחד: publication, replica identity, ו-RLS שמתיר SELECT.
אם אחד חסר — אין שגיאה, פשוט אין עדכונים. לבדוק את שלושתם לפני שמחפשים באג בקוד.

---

### 6.3 `await load()` אחרי כל כתיבה
**תסמין:** כל שמירה קטנה גוררת טעינה מחדש של כל העמוד — איטי, והמסך "קופץ".

**🧭 כלל:**
> להשתמש ב-TanStack Query (כבר מותקן בפרויקט! `@tanstack/react-query` ב-`package.json` ולא בשימוש)
> עם `invalidateQueries` במקום `load()` ידני. מקבלים cache, dedupe, ו-optimistic updates בחינם.
> זה גם פותר את "שתי לשוניות מציגות מספרים שונים".

---

### 6.4 רכיב של 1355 שורות
`payments.tsx` = 1355 שורות, `reports.tsx` = 949, `clients.tsx` = 640.
כל שינוי קטן מצריך גלילה דרך הכול, ובאג בחישוב מסתתר בין JSX.

**🧭 כלל:**
> קו אדום: 300 שורות לקובץ. כש-`useMemo` מחשב כסף — הוא יוצא לקובץ `lib/` טהור שאפשר לבדוק.
> חלוקה: `lib/*.ts` = חישובים טהורים (בדיקים), `hooks/` = נתונים, `components/` = תצוגה.
> הכלל הפשוט: **אם אי אפשר לבדוק את זה בלי דפדפן — זה במקום הלא נכון.**

---

## 7. עברית, RTL ו-UI

### 7.1 עמודות דביקות ב-RTL
שלושה קומיטים (`Add sticky columns`, `Fix sticky: remove inner shadow gap`, `Fix sticky columns width alignment`).
ב-RTL `left`/`right` מתהפכים, ו-`position: sticky` בתוך טבלה עם `overflow` הוא רגיש מאוד.

**🧭 כלל:** להשתמש בתכונות לוגיות — `inset-inline-start` / `inset-inline-end`, `padding-inline`,
`margin-inline` — במקום `left`/`right`. ב-Tailwind: `ps-*`/`pe-*`/`start-*`/`end-*`.
זה פותר 90% מבאגי ה-RTL מראש. ולשים `dir="rtl"` על ה-`<html>`, לא על div פנימי.

---

### 7.2 מיון בעברית
`a.localeCompare(b, "he")` ✅ — נכון. `a > b` היה נותן סדר שבור (לפי Unicode).
למספרים בתוך טקסט: `localeCompare(b, "he", { numeric: true })`.

---

### 7.3 עברית ב-PDF
`pdf-font.ts` נדרש כי jsPDF לא תומך בעברית מחוץ לקופסה — צריך להטמיע גופן ולטפל בכיוון.

**🧭 כלל:** אם יש PDF בעברית — לבדוק את זה ב**שבוע הראשון**, לא שבוע לפני שמשתמשים.
חלופה שחוסכת כאב: לייצר HTML מעוצב ולתת למשתמש להדפיס ל-PDF דרך הדפדפן.

---

### 7.4 נרמול טלפונים ל-WhatsApp
`normalizePhoneForWa` קיים ✅. המלכודות: `0` מוביל, `+972`, מקפים, רווחים, מספר ריק.

**🧭 כלל:** לנרמל טלפון **בכניסה** (לפני שמירה ב-DB) ולא בכל שימוש. שומרים E.164 (`+9725...`). פעם אחת.

---

## 8. תהליך עבודה ואיכות

### 8.1 אין בדיקות, אין CI, הבנייה לא נבדקת לפני דחיפה
אפשר לראות את זה מההיסטוריה: `Fix SPA build`, `Fix vercel.json`, `Fix API routes` —
כל אחד מהם הוא סבב דיפלוי שנכשל בפרודקשן. כל סבב כזה = 10-20 דקות המתנה.

**🧭 כלל (הכי משתלם מכל המסמך):**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run build
```
חמש דקות הקמה. חוסך כל קומיט "Fix build" שבהיסטוריה הזו.

---

### 8.2 `as any` / `as never` — 44 מופעים
```ts
.insert({ name: normalizeName(name) } as never)
```
ה-`as never` נועד להשתיק את TypeScript מול הטיפוסים המחוללים של Supabase.
המחיר: שינוי סכימה (שם עמודה, טיפוס) **לא יתגלה בקומפילציה** — רק בפרודקשן.

**🧭 כלל:**
> לחדש את `types.ts` אחרי כל מיגרציה:
> `npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`
> (להכניס ל-`package.json` כ-`"types:db"` ולהריץ אוטומטית.)
> כל `as any` חייב הערה שמסבירה למה — אחרת זה חור בבטיחות שבשבילה בחרת TypeScript.

---

### 8.3 מה כן עבד טוב — לשמר במערכת הבאה
- ✅ `fetch-all.ts` עם תיעוד מפורט ודוגמה — פתרון גנרי לבעיה חוזרת, במקום אחד.
- ✅ ההערה `// NEVER use new Date(string)` — תיעוד של באג בתוך הקוד שמונע חזרה עליו.
- ✅ הפרדת `lib/` לפונקציות טהורות (`client-price`, `billing-month`, `hebrew-date`).
- ✅ `has_role()` כ-`SECURITY DEFINER` — התבנית הנכונה ל-RLS בלי רקורסיה.
- ✅ מיגרציות SQL בריפו, עם חותמת זמן.
- ✅ `auto-return-trip.ts` — אידמפוטנטי (בודק מול DB **וגם** מול הקובץ לפני יצירה). זו התבנית הנכונה לייבוא.

---

## 9. צ'ק-ליסט יום 0 למערכת הבאה

### לפני שורת קוד
- [ ] להחליט: SPA סטטי / SSR / fullstack — ולבחור starter שתואם ליעד הפריסה.
- [ ] `.gitignore` עם `.env` + יצירת `.env.example`. **בקומיט הראשון.**
- [ ] מנהל חבילות אחד. `packageManager` + `engines` ב-`package.json`.
- [ ] `npm run build` + דיפלוי של "Hello World" לפרודקשן — **לפני** שכותבים פיצ'ר.
- [ ] CI (הקובץ מסעיף 8.1).
- [ ] `/api/health` שמחזיר JSON, ובדיקת `curl` שהוא לא נבלע ב-rewrite.

### סכימת הנתונים
- [ ] כל מפתח זר הוא `uuid`, אף פעם לא שם/טקסט שהמשתמש עורך.
- [ ] כסף: `numeric` ב-DB (או `integer` באגורות). לעולם לא `float`.
- [ ] תאריך יומי = `date`; חותמת זמן = `timestamptz`.
- [ ] `UNIQUE` על כל מה שאמור להיות ייחודי + אינדקס על כל עמודת סינון.
- [ ] מספור רץ = `SEQUENCE` ב-DB, לא חישוב בדפדפן.
- [ ] RLS מופעל על **כל** טבלה, והמדיניות מוגבלת `TO authenticated` לפחות.
- [ ] `settings` / הגדרות: קריאה לכולם המחוברים, כתיבה לאדמין בלבד.

### תשתית קוד (לכתוב ביום הראשון, פעם אחת)
- [ ] `fetchAllRows` — pagination.
- [ ] `inChunks` — לכל `.in()` / `insert` המוני.
- [ ] `localISODate` — תאריך מקומי, בלי `toISOString`.
- [ ] `parseDate` — פירוק מפורש, עם בדיקות.
- [ ] `money` — עיגול אחד, בתצוגה בלבד.
- [ ] עטיפת שגיאות אחידה שמציגה toast **וגם** מסמנת את ה-UI כשגוי (לא "0").
- [ ] TanStack Query במקום `useState` + `load()` ידני.

### לפני כל דיפלוי
- [ ] `npx tsc --noEmit` נקי.
- [ ] `npm run build` עובר.
- [ ] `grep -r "SERVICE_ROLE\|secret" dist/` — ריק.
- [ ] `SELECT * FROM pg_policies WHERE schemaname='public'` — אין `USING(true)` בלי `TO authenticated`.
- [ ] בדיקה ידנית עם משתמש **לא**-אדמין: הוא באמת לא יכול לערוך? (לנסות גם מהקונסול, לא רק מה-UI.)

---

## 10. נספח: קוד מוכן להעתקה

```ts
// lib/db.ts — תשתית Supabase בטוחה

import type { PostgrestError } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

/** שליפת כל השורות — עוקף את תקרת 1000 השורות של Supabase. */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;              // זורקים — לא מחזירים ריק בשקט
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}

/** פיצול לצ'אנקים — לכל .in() או insert המוני. */
export async function inChunks<I, O>(
  items: I[], size: number, fn: (chunk: I[]) => Promise<O[]>,
): Promise<O[]> {
  const out: O[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await fn(items.slice(i, i + size))));
  return out;
}
```

```ts
// lib/dates.ts — תאריכים בלי הפתעות

/** YYYY-MM-DD בזמן מקומי. לא toISOString — הוא UTC ומזיז יום. */
export const localISODate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** פירוק מפורש. new Date(string) אסור על קלט משתמש. */
export function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : localISODate(value);
  if (typeof value === "number") {                       // סריאל של אקסל
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(value).trim().split(",")[0].trim();   // חותך רכיב שעה
  const p = s.split(/[\/\-.]/);
  if (p.length !== 3) return null;
  const [dd, mm] = [p[0].padStart(2, "0"), p[1].padStart(2, "0")];
  const yyyy = p[2].length === 2 ? "20" + p[2] : p[2];
  return /^\d{2}$/.test(dd) && /^\d{2}$/.test(mm) && /^\d{4}$/.test(yyyy) ? `${yyyy}-${mm}-${dd}` : null;
}
```

```ts
// lib/money.ts — כסף באגורות, עיגול אחד בסוף

export const toAgorot = (shekels: number): number => Math.round(shekels * 100);
export const toShekels = (agorot: number): number => agorot / 100;

/** סוכמים באגורות (שלמים) — בלי שגיאות float. */
export const sumAgorot = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** עיגול יחיד, רק בנקודת התצוגה. */
export const formatILS = (agorot: number): string =>
  (agorot / 100).toLocaleString("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 });
```

```sql
-- RLS: אותן הרשאות שה-UI מציג, אכופות ב-DB

CREATE OR REPLACE FUNCTION public.can_edit(p_page text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM user_page_permissions
                 WHERE user_id = auth.uid() AND page = p_page AND can_edit);
$$;

CREATE OR REPLACE FUNCTION public.can_view(p_page text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM user_page_permissions
                 WHERE user_id = auth.uid() AND page = p_page AND can_view);
$$;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY trips_select ON public.trips FOR SELECT TO authenticated USING (public.can_view('trips'));
CREATE POLICY trips_insert ON public.trips FOR INSERT TO authenticated WITH CHECK (public.can_edit('trips'));
CREATE POLICY trips_update ON public.trips FOR UPDATE TO authenticated
  USING (public.can_edit('trips')) WITH CHECK (public.can_edit('trips'));
CREATE POLICY trips_delete ON public.trips FOR DELETE TO authenticated USING (public.can_edit('trips'));

-- ביקורת: להריץ אחרי כל מיגרציה
SELECT tablename, policyname, roles, cmd FROM pg_policies
 WHERE schemaname = 'public' AND 'anon' = ANY(roles);   -- חייב לחזור ריק
```

---

## שלושת הכללים שמכסים את רוב המסמך

1. **אכיפה בשכבה שהמשתמש לא שולט בה.** UI מסתיר, ה-DB אוכף. הרשאות, ייחודיות, מספור רץ
   וטרנזקציות — הכול ב-Postgres, לא בדפדפן.
2. **שקט זה לא הצלחה.** שגיאה שמחזירה `[]`, `update` שלא עדכן, ברירת מחדל קשיחה, תקרת 1000 שורות —
   כל אלה נראים כמו "עובד" עד שמישהו מקבל חשבונית שגויה. כל נתיב כישלון חייב להיות גלוי.
3. **מה שעולה דקה ביום הראשון עולה יום בחודש השלישי.** `.gitignore`, CI, `fetchAllRows`, `client_id`
   במקום שם, ענן במקום localStorage.
