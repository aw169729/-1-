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


def due_date(inv, term, value=None):
    """תאריך פירעון מוסכם לפי רשימת התנאים של אשר."""
    if term == "מיידי":
        return inv
    if term == "שוטף":                      # סוף החודש
        return eomonth(inv, 0)
    if term.startswith("שוטף פלוס "):        # סוף החודש + N
        return eomonth(inv, 0) + dt.timedelta(days=int(term.split()[-1]))
    if term.startswith("שוטף "):             # N ימים מהחשבונית
        return inv + dt.timedelta(days=int(term.split()[-1]))
    if term == "ימים":
        return inv + dt.timedelta(days=int(value))
    if term == "תאריך קבוע":
        return value
    raise ValueError(term)


def bank_date(inv, term, direction, value=None, delay=None,
               default_delay=5, scen_delay=0, manual_due=None):
    """תאריך הבנק המלא. manual_due (עמודה AM) דורס את הפירעון המחושב."""
    due = manual_due if manual_due else due_date(inv, term, value)
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
