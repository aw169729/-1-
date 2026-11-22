"""חישוב התזרים המלא - מימוש אפיון 1.1."""
from __future__ import annotations
import datetime as dt
from dataclasses import dataclass, field
from . import dates as D
from .model import Settings, Mov, Rec, Ov, CardActual, Line

MONTHS = 14
DAYS = 400


# ───────────────────────── עזר ─────────────────────────
def _month_start(d): return dt.date(d.year, d.month, 1)


def _edate(d, k):
    y, m = d.year, d.month + k
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    last = D.eomonth(dt.date(y, m, 1), 0).day
    return dt.date(y, m, min(d.day, last))


def _day_in_month(ms, day):
    """היום ה-day בחודש ms, נדחס לסוף החודש אם קצר."""
    return min(D.eomonth(ms, 0), ms + dt.timedelta(days=day - 1))


def _shift(d, direction):
    return D.shift_fwd(d) if direction == "הכנסה" else D.shift_back(d)


# ───────────────────────── תוצאות ─────────────────────────
@dataclass
class MovCalc:
    mov: Mov
    due: dt.date | None = None
    expected: dt.date | None = None
    bank: dt.date | None = None
    account: str | None = None
    fc: float = 0.0
    vat: float = 0.0
    net: float = 0.0
    vat_date: dt.date | None = None
    status: str = ""
    err: str = ""


@dataclass
class GenRow:
    rule: str; month: dt.date; dir: str; cat: str; account: str
    raw: dt.date | None = None; bank: dt.date | None = None
    base: float = 0.0; full_cnt: int = 0; partial: float = 0.0
    amount: float = 0.0; over_cover: bool = False
    vat: float = 0.0; vat_date: dt.date | None = None


@dataclass
class CardRow:
    card: str; month: dt.date; account: str
    raw: dt.date | None = None; bank: dt.date | None = None
    base: float = 0.0; invoices: float = 0.0; amount: float = 0.0


@dataclass
class VatRow:
    kind: str; start: dt.date; end: dt.date
    out_vat: float = 0.0; in_vat: float = 0.0; net: float = 0.0
    raw: dt.date | None = None; bank: dt.date | None = None
    dir: str = ""; amount: float = 0.0; account: str = ""


@dataclass
class Result:
    st: Settings
    movs: list = field(default_factory=list)
    gen: list = field(default_factory=list)
    cards: list = field(default_factory=list)
    vat: list = field(default_factory=list)
    lines: list = field(default_factory=list)
    daily: list = field(default_factory=list)      # (date, {acc: close}, total_close)

    # ---- שליפות נוחות לבדיקות ----
    def m(self, i): return self.movs[i]

    def close_on(self, d, acc=None):
        for day, per, tot in self.daily:
            if day == d:
                return tot if acc is None else per[acc]
        raise KeyError(d)

    def gen_of(self, rule, month):
        return next(g for g in self.gen
                    if g.rule == rule and g.month == _month_start(month))

    def card_of(self, card, month):
        return next(c for c in self.cards
                    if c.card == card and c.month == _month_start(month))


# ───────────────────────── ולידציה ─────────────────────────
def _validate(m: Mov, st: Settings, terms) -> str:
    if not m.dir or not m.party:          return "חסר כיוון או שם"
    if m.inv_date is None:                return "תאריך חשבונית חסר"
    if not m.gross:                       return "סכום חסר או אפס"
    if m.terms not in terms:              return "תנאי תשלום לא קיים בטבלה"
    if terms[m.terms][0] == "תאריך קבוע" and not isinstance(m.term_val, dt.date):
        return "חסר ערך תנאי"
    if (m.paid or m.paid_amt) and m.pay_date is None:
        return "חסר תאריך תשלום בפועל"
    if m.method == "אשראי" and not m.card:    return "אמצעי אשראי ללא כרטיס"
    if m.method != "אשראי" and not m.account: return "חסר חשבון בנק"
    if m.card and st.card(m.card) is None:    return "כרטיס לא קיים"
    if m.account and st.acc(m.account) is None: return "חשבון לא קיים"
    if m.paid_amt is not None and abs(m.paid_amt) > abs(m.gross):
        return "סכום חלקי גדול מהחשבונית"
    if m.rule and not m.mode:             return "נבחר כלל להחלפה בלי היקף"
    return ""


def _card_charge_on_or_after(st: Settings, cid: str, d: dt.date):
    """תאריך חיוב הכרטיס הראשון שאינו לפני d."""
    c = st.card(cid)
    ms = _month_start(d)
    for _ in range(MONTHS + 2):
        raw = _day_in_month(ms, c.debit_day)
        if raw >= d:
            return D.shift_back(raw)
        ms = _edate(ms, 1)
    return D.shift_back(_day_in_month(ms, c.debit_day))


# ───────────────────────── המנוע ─────────────────────────
def compute(st, movs=(), recs=(), ovs=(), cas=(), terms=None):
    terms = D.TERMS if terms is None else terms
    r = Result(st=st)
    scen = st.scen
    base_month = _month_start(st.cutoff)

    # ---------- 1. תנועות ----------
    for m in movs:
        c = MovCalc(mov=m)
        c.err = _validate(m, st, terms)
        if c.err:
            c.status = "שגיאה"
            r.movs.append(c)
            continue

        rate = m.rate_in if m.rate_in is not None else st.vat_rate(m.inv_date)
        ok = (m.vat_yn == "כן") if m.vat_yn else st.cat_vat.get(m.cat, True)
        c.vat = 0.0 if rate == 0 or (m.dir == "הוצאה" and not ok) \
            else round(m.gross * rate / (1 + rate), 2)
        c.net = round(m.gross - c.vat, 2)

        c.due = m.manual_due or D.due_date(m.inv_date, m.terms, m.term_val, terms)

        if m.dir == "הכנסה":
            dly = m.delay if m.delay is not None \
                else st.cust_delay.get(m.party, st.default_delay)
            c.expected = D.add_biz(D.shift_fwd(c.due), dly + scen.delay)
        else:
            c.expected = c.due

        if m.paid and m.pay_date:
            c.bank = m.pay_date        # שולם במלואו -> התאריך האמיתי גובר
        elif m.method == "אשראי" and m.card:
            c.bank = _card_charge_on_or_after(st, m.card, c.due)
        else:
            c.bank = _shift(c.expected, m.dir)

        c.account = st.card(m.card).account if m.card else m.account

        if m.paid and m.pay_date and m.pay_date <= st.cutoff:
            c.fc = 0.0
        elif m.paid:
            c.fc = m.gross
        else:
            rem = m.gross - (m.paid_amt or 0)
            c.fc = rem * (1 - scen.haircut) if (m.dir == "הכנסה" and rem > 0) else rem

        c.vat_date = (c.bank if st.vat_basis == "מזומן" else m.inv_date) if c.vat else None

        if m.paid:                       c.status = "שולם"
        elif m.paid_amt:                 c.status = "חלקי"
        elif c.bank and c.bank <= st.cutoff: c.status = "באיחור"
        else:                            c.status = "צפוי"
        r.movs.append(c)

    # ---------- 2. מנוע קבועות ----------
    for rec in recs:
        for k in range(MONTHS):
            ms = _edate(base_month, k)
            g = GenRow(rule=rec.id, month=ms, dir=rec.dir, cat=rec.cat,
                       account=st.card(rec.card).account if rec.card else rec.account)
            if not rec.active or rec.err:
                r.gen.append(g); continue
            since = (ms.year - rec.start.year) * 12 + (ms.month - rec.start.month)
            if since < 0 or since % rec.every:
                r.gen.append(g); continue
            g.raw = _day_in_month(ms, rec.day)
            if rec.end and g.raw > rec.end:
                g.raw = None; r.gen.append(g); continue
            g.bank = _card_charge_on_or_after(st, rec.card, g.raw) if rec.card \
                else _shift(g.raw, rec.dir)

            key = D.eomonth(ms, 0)
            ov = next((o for o in ovs if o.rule == rec.id and o.key == key), None)
            g.base = ov.amount if ov else rec.amount
            g.full_cnt = sum(1 for m in movs if m.rule == rec.id and m.mode == "מלא"
                             and D.eomonth(m.ov_month or m.inv_date, 0) == key)
            g.partial = sum(m.gross for m in movs if m.rule == rec.id and m.mode == "חלקי"
                            and D.eomonth(m.ov_month or m.inv_date, 0) == key)
            g.over_cover = g.partial > g.base
            g.amount = 0.0 if (g.full_cnt or g.bank <= st.cutoff) \
                else max(0.0, g.base - g.partial)

            if g.amount:
                rate = rec.rate if rec.rate is not None else st.vat_rate(g.raw)
                ok = (rec.vat_yn == "כן") if rec.vat_yn else st.cat_vat.get(rec.cat, True)
                g.vat = 0.0 if rate == 0 or (rec.dir == "הוצאה" and not ok) \
                    else round(g.amount * rate / (1 + rate), 2)
                g.vat_date = (g.bank if st.vat_basis == "מזומן" else g.raw) if g.vat else None
            r.gen.append(g)

    # ---------- 3. מנוע אשראי ----------
    for card in st.cards:
        if not card.active:
            continue
        for k in range(MONTHS):
            ms = _edate(base_month, k)
            row = CardRow(card=card.id, month=ms, account=card.account)
            row.raw = _day_in_month(ms, card.debit_day)
            row.bank = D.shift_back(row.raw)
            key = D.eomonth(ms, 0)
            act = next((a for a in cas if a.card == card.id and a.key == key), None)
            row.base = act.amount if act else card.limit
            # שיוך לפי תאריך החיוב עצמו: חיוב יכול ליפול בחודש הקודם (בדיקה 12)
            row.invoices = sum(
                c.fc for c in r.movs
                if c.mov.card == card.id and c.bank == row.bank and not c.err)
            row.amount = 0.0 if row.bank <= st.cutoff else max(0.0, row.base - row.invoices)
            r.cards.append(row)

    # ---------- 4. מנוע מע"מ ----------
    if st.vat_enabled:
        if st.vat_period == "חודשי":
            starts = [_edate(base_month, k) for k in range(MONTHS)]
            ends = [D.eomonth(x, 0) for x in starts]
        else:
            anchor = dt.date(base_month.year,
                             base_month.month - ((base_month.month - 1) % 2), 1)
            starts = [_edate(anchor, 2 * k) for k in range(MONTHS)]
            ends = [D.eomonth(x, 1) for x in starts]
        for s0, e0 in zip(starts, ends):
            v = VatRow(kind="מע\"מ", start=s0, end=e0, account=st.vat_acc)
            v.out_vat = round(
                sum(c.vat for c in r.movs
                    if c.vat_date and s0 <= c.vat_date <= e0 and c.mov.dir == "הכנסה")
                + sum(g.vat for g in r.gen
                      if g.vat_date and s0 <= g.vat_date <= e0 and g.dir == "הכנסה"), 2)
            v.in_vat = round(
                sum(c.vat for c in r.movs
                    if c.vat_date and s0 <= c.vat_date <= e0 and c.mov.dir == "הוצאה")
                + sum(g.vat for g in r.gen
                      if g.vat_date and s0 <= g.vat_date <= e0 and g.dir == "הוצאה"), 2)
            v.net = round(v.out_vat - v.in_vat, 2)
            if v.net:
                pm = _edate(e0, st.vat_pay_offset)
                v.raw = _day_in_month(_month_start(pm), st.vat_pay_day)
                v.dir = "הוצאה" if v.net > 0 else "הכנסה"
                v.bank = _shift(v.raw, v.dir)
                v.amount = 0.0 if v.bank <= st.cutoff else abs(v.net)
            r.vat.append(v)

    # ---------- 5. שורות לתזרים ----------
    for c in r.movs:
        if c.fc and c.bank and not c.err:
            r.lines.append(Line(c.bank, c.mov.dir, c.fc, c.account, c.mov.cat, "הזנה"))
    for g in r.gen:
        if g.amount:
            r.lines.append(Line(g.bank, g.dir, g.amount, g.account, g.cat, "קבוע"))
    for cr in r.cards:
        if cr.amount:
            r.lines.append(Line(cr.bank, "הוצאה", cr.amount, cr.account, "אחר", "אשראי"))
    for v in r.vat:
        if v.amount:
            r.lines.append(Line(v.bank, v.dir, v.amount, v.account, "מסים ומע\"מ", "מע\"מ"))

    # ---------- 6. מנוע יומי ----------
    live = [a for a in st.accounts if a.active]
    bal = {a.id: a.opening for a in live}
    for i in range(DAYS):
        day = st.cutoff + dt.timedelta(days=i + 1)
        for ln in r.lines:
            if ln.date == day and ln.account in bal:
                bal[ln.account] += ln.amount if ln.dir == "הכנסה" else -ln.amount
        r.daily.append((day, dict(bal), round(sum(bal.values()), 2)))
    return r
