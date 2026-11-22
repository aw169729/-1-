"""מנוע תאריכים - מימוש כללי האפיון אחרי החלטות 21.11.2026."""
import datetime as dt

HOLIDAYS = {dt.date(2026, 12, 13)}          # רשימת החגים (בדיקות)
WEEKEND = (4, 5)                             # שישי=4, שבת=5  (WeekendCode 7)


def is_biz(d):
    return d.weekday() not in WEEKEND and d not in HOLIDAYS


def shift_fwd(d):
    """הכנסה: ליום העסקים הפתוח הבא."""
    while not is_biz(d):
        d += dt.timedelta(days=1)
    return d


def shift_back(d):
    """הוצאה: ליום העסקים הפתוח האחרון שלפני. החלטת אשר 21.11."""
    while not is_biz(d):
        d -= dt.timedelta(days=1)
    return d


def shift(d, direction):
    return shift_fwd(d) if direction == "הכנסה" else shift_back(d)


def add_biz(d, n):
    """הוספת n ימי עסקים. n=0 מחזיר את d עצמו."""
    for _ in range(n):
        d += dt.timedelta(days=1)
        while not is_biz(d):
            d += dt.timedelta(days=1)
    return d


def eomonth(d, k=0):
    y, m = d.year, d.month + k
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    nxt = dt.date(y + (m == 12), 1 if m == 12 else m + 1, 1)
    return nxt - dt.timedelta(days=1)


# טבלת תנאי התשלום - ברירת מחדל. ניתנת להחלפה מלאה.
TERMS = {
    "מיידי":          ("מיידי", None),
    "שוטף":           ("סוף חודש", None),
    "שוטף 30":        ("ימים מהחשבונית", 30),
    "שוטף 60":        ("ימים מהחשבונית", 60),
    "שוטף 90":        ("ימים מהחשבונית", 90),
    "שוטף 120":       ("ימים מהחשבונית", 120),
    "שוטף פלוס 30":   ("סוף חודש + ימים", 30),
    "שוטף פלוס 45":   ("סוף חודש + ימים", 45),
    "שוטף פלוס 60":   ("סוף חודש + ימים", 60),
    "שוטף פלוס 90":   ("סוף חודש + ימים", 90),
    "שוטף פלוס 120":  ("סוף חודש + ימים", 120),
    "תאריך קבוע":     ("תאריך קבוע", None),
}


def due_date(inv, term, value=None, terms=None):
    """תאריך פירעון מוסכם, נגזר מטבלת התנאים ולא מפענוח טקסט."""
    table = TERMS if terms is None else terms
    if term not in table:
        raise KeyError(f"תנאי לא קיים בטבלה: {term}")
    kind, days = table[term]
    if kind == "מיידי":
        return inv
    if kind == "סוף חודש":
        return eomonth(inv, 0)
    if kind == "ימים מהחשבונית":
        return inv + dt.timedelta(days=days)
    if kind == "סוף חודש + ימים":
        return eomonth(inv, 0) + dt.timedelta(days=days)
    if kind == "תאריך קבוע":
        return value
    raise ValueError(kind)


def bank_date(inv, term, direction, value=None, delay=None,
               default_delay=5, scen_delay=0, manual_due=None, terms=None):
    """תאריך הבנק המלא. manual_due (עמודה AM) דורס את הפירעון המחושב."""
    due = manual_due if manual_due else due_date(inv, term, value, terms)
    if direction == "הכנסה":
        n = default_delay if delay is None else delay
        return shift_fwd(add_biz(shift_fwd(due), n + scen_delay))
    return shift_back(due)


def card_cycle(purchase, cut):
    """סגירת המחזור. cut=0 => סוף חודש."""
    if cut == 0:
        return eomonth(purchase, 0)
    if purchase.day <= cut:
        return dt.date(purchase.year, purchase.month, cut)
    nm = eomonth(purchase, 0) + dt.timedelta(days=1)
    return dt.date(nm.year, nm.month, cut)


def card_bank(purchase, cut, deb):
    """יום ירידת החיוב מהבנק. הוצאה => הזזה אחורה."""
    close = card_cycle(purchase, cut)
    if cut > 0 and deb > cut:
        raw = dt.date(close.year, close.month, deb)
    else:
        nm = eomonth(close, 0) + dt.timedelta(days=1)
        raw = dt.date(nm.year, nm.month, deb)
    return close, shift_back(raw)
