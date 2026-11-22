# -*- coding: utf-8 -*-
"""65 בדיקות קבלה - סעיף 16 באפיון 1.1."""
import datetime as dt
from fixture import base, no_cards, no_vat, SAL, d
from engine.compute import compute, _month_start
from engine.model import Mov, Rec, Ov, CardActual
from engine import dates as D

T = []
def test(n, title):
    def deco(f):
        T.append((n, title, f)); return f
    return deco

INC = lambda **k: Mov(dir="הכנסה", party="לקוח", cat="הכנסות משירותים", **k)
EXP = lambda **k: Mov(dir="הוצאה", party="ספק", cat="ספקים", **k)


# ═══════════ קבוצה א' — תאריכים (1–15) ═══════════
@test(1, "הכנסה · שוטף פלוס 30 · ביטחון ברירת מחדל")
def _():
    r = compute(base(), [INC(inv_date=d(2026,11,10), gross=10_000,
                             terms="שוטף פלוס 30", account="BANK1")])
    assert r.m(0).due == d(2026,12,30), r.m(0).due
    assert r.m(0).bank == d(2027,1,6), r.m(0).bank

@test(2, "אותה חשבונית · שוטף (סוף חודש)")
def _():
    r = compute(base(), [INC(inv_date=d(2026,11,10), gross=10_000,
                             terms="שוטף", account="BANK1")])
    assert r.m(0).due == d(2026,11,30)
    assert r.m(0).bank == d(2026,12,7), r.m(0).bank

@test(3, "הוצאה · שוטף 30 · נופל בשבת → אחורה")
def _():
    r = compute(base(), [EXP(inv_date=d(2026,11,5), gross=3_000,
                             terms="שוטף 30", account="BANK1")])
    assert r.m(0).due == d(2026,12,5)
    assert r.m(0).bank == d(2026,12,3), r.m(0).bank

@test(4, "הוצאה מיידית בשישי · לפני העוגן → באיחור, לא נספרת")
def _():
    r = compute(no_cards(vat_enabled=False),
                [EXP(inv_date=d(2026,11,20), gross=4_000,
                     terms="מיידי", account="BANK1")])
    assert r.m(0).bank == d(2026,11,19), r.m(0).bank
    assert r.m(0).status == "באיחור"
    assert r.close_on(d(2026,12,2)) == 70_000      # לא השפיעה על היתרה

@test(5, "תשלום חלקי · היתרה נשארת בתאריך המקורי")
def _():
    r = compute(base(), [INC(inv_date=d(2026,11,15), gross=20_000, terms="שוטף 30",
                             delay=0, paid_amt=8_000, pay_date=d(2026,11,25),
                             account="BANK1")])
    assert r.m(0).bank == d(2026,12,15), r.m(0).bank
    assert r.m(0).fc == 12_000, r.m(0).fc

@test(6, "שולם לפני העוגן → 0 בתחזית")
def _():
    r = compute(base(), [EXP(inv_date=d(2026,11,20), gross=5_000, terms="מיידי",
                             paid=True, pay_date=d(2026,11,28), account="BANK1")])
    assert r.m(0).fc == 0 and r.m(0).status == "שולם"

@test(7, "זיכוי · הכנסה שלילית בשבת → קדימה")
def _():
    r = compute(base(), [INC(inv_date=d(2026,12,5), gross=-2_000, terms="מיידי",
                             delay=0, account="BANK1")])
    assert r.m(0).bank == d(2026,12,6), r.m(0).bank
    assert r.m(0).fc == -2_000

@test(8, "כלל קבוע יום 31 · חודש קצר")
def _():
    rec = Rec("R31","","ספקים","הוצאה",1_000,1,31,d(2027,1,1))
    r = compute(no_cards(), [], [rec])
    assert r.gen_of("R31", d(2027,1,1)).bank == d(2027,1,31)
    assert r.gen_of("R31", d(2027,2,1)).bank == d(2027,2,28)
    assert r.gen_of("R31", d(2027,3,1)).bank == d(2027,3,31)

@test(9, "כלל קבוע כל 3 חודשים · 15 בחודש")
def _():
    rec = Rec("R3","","ספקים","הוצאה",1_000,3,15,d(2027,1,1))
    r = compute(no_cards(), [], [rec])
    got = [g.bank for g in r.gen if g.rule=="R3" and g.bank]
    assert got == [d(2027,1,14), d(2027,4,15), d(2027,7,15),
                   d(2027,10,14), d(2028,1,13)], got

@test(10, "אשראי · מסגרת מלאה כשלא הוזן סכום")
def _():
    r = compute(base())
    c = r.card_of("CARD2", d(2026,12,1))
    assert (c.bank, c.amount, c.account) == (d(2026,12,10), 8_000, "BANK2"), c

@test(11, "אשראי · הסכום בפועל מחליף את המסגרת")
def _():
    r = compute(base(), cas=[CardActual("CARD2", d(2026,12,1), 6_200)])
    assert r.card_of("CARD2", d(2026,12,1)).amount == 6_200

@test(12, "אשראי · יום חיוב בשבת → קופץ לחודש הקודם")
def _():
    r = compute(base())
    c = r.card_of("CARD1", d(2027,1,1))
    assert c.raw == d(2027,1,2) and c.bank == d(2026,12,31), c

@test(13, "הוצאה בחג → אחורה דרך הרצף")
def _():
    r = compute(base(), [EXP(inv_date=d(2026,12,13), gross=100, terms="מיידי", account="BANK1")])
    assert r.m(0).bank == d(2026,12,10), r.m(0).bank

@test(14, "הוצאה בשישי → אחורה")
def _():
    r = compute(base(), [EXP(inv_date=d(2026,12,11), gross=100, terms="מיידי", account="BANK1")])
    assert r.m(0).bank == d(2026,12,10)

@test(15, "הוצאה בשבת → אחורה")
def _():
    r = compute(base(), [EXP(inv_date=d(2026,12,12), gross=100, terms="מיידי", account="BANK1")])
    assert r.m(0).bank == d(2026,12,10)


# ═══════════ קבוצה ב' — מע"מ (16–27) ═══════════
@test(16, "פיצול מע\"מ עסקאות")
def _():
    r = compute(base(), [INC(inv_date=d(2026,12,10), gross=11_800, terms="מיידי", account="BANK1")])
    assert (r.m(0).vat, r.m(0).net) == (1_800.0, 10_000.0), (r.m(0).vat, r.m(0).net)

@test(17, "מע\"מ תשומות על ספקים")
def _():
    r = compute(base(), [EXP(inv_date=d(2026,12,15), gross=5_900, terms="מיידי", account="BANK1")])
    assert r.m(0).vat == 900.0, r.m(0).vat

@test(18, "תקופה 1 · נטו 900 → הוצאה, יום עסקים אחורה")
def _():
    r = compute(no_cards(), [INC(inv_date=d(2026,12,10), gross=11_800, terms="מיידי", account="BANK1"),
                             EXP(inv_date=d(2026,12,15), gross=5_900, terms="מיידי", account="BANK1")])
    v = r.vat[0]
    assert (v.start, v.end) == (d(2026,11,1), d(2026,12,31)), (v.start, v.end)
    assert v.net == 900.0 and v.dir == "הוצאה"
    assert v.raw == d(2027,1,15) and v.bank == d(2027,1,14), (v.raw, v.bank)
    assert v.amount == 900.0 and v.account == "BANK1"

@test(19, "שכר לא נושא מע\"מ תשומות")
def _():
    r = compute(no_cards(), [INC(inv_date=d(2026,12,10), gross=11_800, terms="מיידי", account="BANK1"),
                             EXP(inv_date=d(2026,12,15), gross=5_900, terms="מיידי", account="BANK1"),
                             Mov(dir="הוצאה", party="עובד", cat="שכר", inv_date=d(2026,12,20),
                                 gross=11_800, terms="מיידי", account="BANK1")])
    assert r.m(2).vat == 0.0
    assert r.vat[0].net == 900.0

@test(20, "תשומות גדולות מעסקאות → החזר מע\"מ, הכנסה, קדימה")
def _():
    r = compute(no_cards(), [INC(inv_date=d(2026,12,10), gross=11_800, terms="מיידי", account="BANK1"),
                             EXP(inv_date=d(2026,12,15), gross=5_900, terms="מיידי", account="BANK1"),
                             EXP(inv_date=d(2026,12,20), gross=23_600, terms="מיידי", account="BANK1")])
    v = r.vat[0]
    assert v.in_vat == 4_500.0 and v.net == -2_700.0, (v.in_vat, v.net)
    assert v.dir == "הכנסה" and v.bank == d(2027,1,17), v.bank
    assert v.amount == 2_700.0

@test(21, "בסיס מזומן → המע\"מ עובר לתקופה של תאריך הבנק")
def _():
    st = no_cards(); st.vat_basis = "מזומן"
    r = compute(st, [INC(inv_date=d(2026,12,10), gross=11_800,
                         terms="שוטף פלוס 30", delay=0, account="BANK1")])
    assert r.m(0).bank == d(2027,1,31), r.m(0).bank
    assert r.vat[0].out_vat == 0.0
    assert r.vat[1].out_vat == 1_800.0, r.vat[1].out_vat

@test(22, "שיעור 0% → אין מע\"מ")
def _():
    r = compute(base(), [INC(inv_date=d(2026,12,10), gross=11_800, rate_in=0.0,
                             terms="מיידי", account="BANK1")])
    assert (r.m(0).vat, r.m(0).net) == (0.0, 11_800.0)

@test(23, "תקופת מע\"מ חודשית")
def _():
    st = no_cards(); st.vat_period = "חודשי"
    r = compute(st, [INC(inv_date=d(2026,12,10), gross=11_800, terms="מיידי", account="BANK1")])
    v = r.vat[0]
    assert (v.start, v.end) == (d(2026,12,1), d(2026,12,31))
    assert v.bank == d(2027,1,14), v.bank

@test(24, "יום תשלום מע\"מ 25")
def _():
    st = no_cards(); st.vat_period = "חודשי"; st.vat_pay_day = 25
    r = compute(st, [INC(inv_date=d(2026,12,10), gross=11_800, terms="מיידי", account="BANK1")])
    assert r.vat[0].bank == d(2027,1,25), r.vat[0].bank

@test(25, "מנוע מע\"מ כבוי → אפס שורות")
def _():
    r = compute(no_vat(), [INC(inv_date=d(2026,12,10), gross=11_800, terms="מיידי", account="BANK1")])
    assert r.vat == [] and all(l.source != "מע\"מ" for l in r.lines)

@test(26, "שורה ידנית בקטגוריית מסים → תנאי האזהרה מתקיים")
def _():
    man = Mov(dir="הוצאה", party="מע\"מ", cat="מסים ומע\"מ", inv_date=d(2027,1,15),
              gross=900, terms="מיידי", account="BANK1")
    r = compute(no_cards(), [INC(inv_date=d(2026,12,10), gross=11_800, terms="מיידי", account="BANK1"), man])
    eng = [v for v in r.vat if v.amount and v.bank.year == 2027 and v.bank.month == 1]
    assert eng and r.m(1).mov.cat == "מסים ומע\"מ"

@test(27, "חשבונית 2024 מחושבת ב-17%")
def _():
    r = compute(base(), [INC(inv_date=d(2024,12,20), gross=11_700, terms="מיידי", account="BANK1")])
    assert r.m(0).vat == round(11_700*0.17/1.17, 2), r.m(0).vat


# ═══════════ קבוצה ג' — קבועות והחלפה (28–38) ═══════════
@test(28, "כלל קבוע ללא החלפות")
def _():
    r = compute(no_cards(), [], [SAL])
    g = r.gen_of("SAL-01", d(2026,12,1))
    assert (g.bank, g.amount) == (d(2026,12,10), 30_000), (g.bank, g.amount)

@test(29, "החלפה מלאה → הכלל מתאפס")
def _():
    m = EXP(inv_date=d(2026,12,5), gross=28_000, terms="מיידי", account="BANK1",
            rule="SAL-01", mode="מלא")
    r = compute(no_cards(), [m], [SAL])
    assert r.gen_of("SAL-01", d(2026,12,1)).amount == 0
    assert r.m(0).fc == 28_000

@test(30, "החלפה חלקית → הכלל מופחת")
def _():
    m = EXP(inv_date=d(2026,12,5), gross=10_000, terms="מיידי", account="BANK1",
            rule="SAL-01", mode="חלקי")
    r = compute(no_cards(), [m], [SAL])
    assert r.gen_of("SAL-01", d(2026,12,1)).amount == 20_000
    assert r.m(0).fc + r.gen_of("SAL-01", d(2026,12,1)).amount == 30_000

@test(31, "שתי החלפות מלא → נספרות, הכלל 0")
def _():
    ms = [EXP(inv_date=d(2026,12,5), gross=14_000, terms="מיידי", account="BANK1",
              rule="SAL-01", mode="מלא") for _ in range(2)]
    r = compute(no_cards(), ms, [SAL])
    g = r.gen_of("SAL-01", d(2026,12,1))
    assert g.full_cnt == 2 and g.amount == 0

@test(32, "כיסוי יתר חלקי → 0 ואזהרה")
def _():
    ms = [EXP(inv_date=d(2026,12,5), gross=35_000, terms="מיידי", account="BANK1",
              rule="SAL-01", mode="חלקי")]
    r = compute(no_cards(), ms, [SAL])
    g = r.gen_of("SAL-01", d(2026,12,1))
    assert g.amount == 0 and g.over_cover

@test(33, "חריגה מחליפה את הסכום")
def _():
    r = compute(no_cards(), [], [SAL], [Ov("SAL-01", d(2026,12,1), 33_000)])
    assert r.gen_of("SAL-01", d(2026,12,1)).amount == 33_000

@test(34, "חריגה 0 → דילוג על החודש")
def _():
    r = compute(no_cards(), [], [SAL], [Ov("SAL-01", d(2026,12,1), 0)])
    assert r.gen_of("SAL-01", d(2026,12,1)).amount == 0

@test(35, "שתי חריגות לאותו חודש → תנאי השגיאה מתקיים")
def _():
    ovs = [Ov("SAL-01", d(2026,12,1), 33_000), Ov("SAL-01", d(2026,12,20), 31_000)]
    dup = sum(1 for o in ovs if o.key == D.eomonth(d(2026,12,1),0))
    assert dup > 1

@test(36, "חריגה לכלל שאינו קיים → תנאי השגיאה מתקיים")
def _():
    ovs = [Ov("NOPE", d(2026,12,1), 1)]
    assert all(o.rule != SAL.id for o in ovs)

@test(37, "תאריך סיום חוסם מופעים")
def _():
    rec = Rec("E","","ספקים","הוצאה",1_000,1,10,d(2026,12,1), end=d(2027,1,31))
    r = compute(no_cards(), [], [rec])
    got = [g.month for g in r.gen if g.rule=="E" and g.bank]
    assert got == [d(2026,12,1), d(2027,1,1)], got

@test(38, "כלל לא פעיל → אפס מופעים")
def _():
    rec = Rec("X","","ספקים","הוצאה",1_000,1,10,d(2026,12,1), active=False)
    r = compute(no_cards(), [], [rec])
    assert all(g.amount == 0 for g in r.gen if g.rule=="X")


# ═══════════ קבוצה ד' — ריבוי חשבונות וכרטיסים (39–46) ═══════════
@test(39, "ללא תנועות → היתרות נשארות")
def _():
    r = compute(no_vat(**{}) if False else no_cards(vat_enabled=False))
    assert r.close_on(d(2026,12,2), "BANK1") == 50_000
    assert r.close_on(d(2026,12,2), "BANK2") == 20_000
    assert r.close_on(r.daily[-1][0]) == 70_000

@test(40, "הוצאה מ-BANK2 בלבד")
def _():
    r = compute(no_cards(vat_enabled=False),
                [EXP(inv_date=d(2026,12,10), gross=5_000, terms="מיידי", account="BANK2")])
    assert r.close_on(d(2026,12,10), "BANK1") == 50_000
    assert r.close_on(d(2026,12,10), "BANK2") == 15_000
    assert r.close_on(d(2026,12,10)) == 65_000

@test(41, "BANK1 יורד מתחת לרף")
def _():
    st = no_cards(vat_enabled=False)
    r = compute(st, [EXP(inv_date=d(2026,12,10), gross=45_000, terms="מיידי", account="BANK1")])
    assert r.close_on(d(2026,12,10), "BANK1") == 5_000
    first = next(day for day, per, _ in r.daily if per["BANK1"] < st.acc("BANK1").minimum)
    assert first == d(2026,12,10), first

@test(42, "חשבון בלי רף → אין התראה")
def _():
    st = no_cards(vat_enabled=False)
    r = compute(st, [EXP(inv_date=d(2026,12,10), gross=15_000, terms="מיידי", account="BANK2")])
    assert st.acc("BANK2").minimum is None
    assert r.close_on(d(2026,12,10), "BANK2") == 5_000

@test(43, "הכרטיס גובר על החשבון שנרשם בשורה")
def _():
    st = base(vat_enabled=False)
    r = compute(st, [EXP(inv_date=d(2026,12,5), gross=800, terms="מיידי",
                         method="אשראי", card="CARD2", account="BANK1")])
    assert r.m(0).account == "BANK2", r.m(0).account

@test(44, "תנועה לחשבון שאינו קיים → שגיאה, לא נספרת")
def _():
    r = compute(no_cards(vat_enabled=False),
                [EXP(inv_date=d(2026,12,10), gross=1_000, terms="מיידי", account="BANK3")])
    assert r.m(0).err and r.m(0).fc == 0
    assert r.close_on(d(2026,12,10)) == 70_000

@test(45, "כרטיס לא קיים → שגיאה")
def _():
    r = compute(base(), [EXP(inv_date=d(2026,12,5), gross=800, terms="מיידי",
                             method="אשראי", card="CARD9")])
    assert r.m(0).err == "כרטיס לא קיים", r.m(0).err

@test(46, "כיבוי BANK2 → נעלם מהמאוחד")
def _():
    st = no_cards(vat_enabled=False)
    st.acc("BANK2").active = False
    r = compute(st)
    assert r.close_on(d(2026,12,2)) == 50_000


# ═══════════ קבוצה ה' — שלמות ובקרה (47–59) ═══════════
@test(47, "שורה ריקה אינה שגיאה ואינה נספרת")
def _():
    r = compute(no_cards(vat_enabled=False), [Mov(dir="", party="")])
    assert r.m(0).fc == 0
    assert r.close_on(d(2026,12,2)) == 70_000

@test(48, "חשבוניות כפולות → תנאי השגיאה מתקיים")
def _():
    ms = [INC(inv_date=d(2026,12,10), gross=100, inv_no="A1", terms="מיידי", account="BANK1"),
          INC(inv_date=d(2026,12,11), gross=200, inv_no="A1", terms="מיידי", account="BANK1")]
    r = compute(no_cards(vat_enabled=False), ms)
    dup = sum(1 for a in ms for b in ms if a is not b
              and a.inv_no and a.inv_no == b.inv_no and a.party == b.party)
    assert dup == 2 and all(not c.err for c in r.movs)

@test(49, "תאריך תשלום בעתיד → תנאי האזהרה מתקיים")
def _():
    m = EXP(inv_date=d(2026,12,1), gross=100, terms="מיידי", account="BANK1",
            paid=True, pay_date=d(2099,1,1))
    r = compute(no_cards(vat_enabled=False), [m])
    assert m.pay_date > dt.date.today()

@test(50, "סכום חלקי גדול מהחשבונית → שגיאה")
def _():
    r = compute(no_cards(vat_enabled=False),
                [INC(inv_date=d(2026,12,1), gross=1_000, terms="מיידי", account="BANK1",
                     paid_amt=1_500, pay_date=d(2026,11,30))])
    assert r.m(0).err == "סכום חלקי גדול מהחשבונית", r.m(0).err

@test(51, "יתרת סגירה = פתיחה + סך הנטו")
def _():
    ms = [INC(inv_date=d(2026,12,10), gross=9_000, terms="מיידי", delay=0, account="BANK1"),
          EXP(inv_date=d(2026,12,20), gross=4_000, terms="מיידי", account="BANK2")]
    r = compute(no_cards(vat_enabled=False), ms)
    net = sum((l.amount if l.dir=="הכנסה" else -l.amount) for l in r.lines)
    assert abs(r.close_on(r.daily[-1][0]) - (r.st.open_total()+net)) < 0.005

@test(52, "סכום חודשי = סכום יומי באותו טווח")
def _():
    ms = [INC(inv_date=d(2026,12,10), gross=9_000, terms="מיידי", delay=0, account="BANK1"),
          EXP(inv_date=d(2027,1,20), gross=4_000, terms="מיידי", account="BANK1")]
    r = compute(no_cards(), ms, [SAL])
    end = r.daily[-1][0]
    by_line = sum((l.amount if l.dir=="הכנסה" else -l.amount)
                  for l in r.lines if r.st.cutoff < l.date <= end)
    by_day = r.close_on(end) - r.st.open_total()
    assert abs(by_line - by_day) < 0.005, (by_line, by_day)

@test(53, "פירוט קטגוריות = סך ההוצאות")
def _():
    ms = [EXP(inv_date=d(2026,12,10), gross=4_000, terms="מיידי", account="BANK1"),
          Mov(dir="הוצאה", party="בעל", cat="שכירות", inv_date=d(2026,12,20),
              gross=6_000, terms="מיידי", account="BANK1")]
    r = compute(no_cards(), ms, [SAL])
    out = sum(l.amount for l in r.lines if l.dir=="הוצאה")
    by_cat = {}
    for l in r.lines:
        if l.dir=="הוצאה": by_cat[l.cat] = by_cat.get(l.cat,0)+l.amount
    assert abs(sum(by_cat.values()) - out) < 0.005

@test(54, "תנועה מעבר ל-400 יום אינה מוצגת")
def _():
    far = r_date = base().cutoff + dt.timedelta(days=450)
    r = compute(no_cards(vat_enabled=False),
                [EXP(inv_date=far, gross=1_000, terms="מיידי", account="BANK1")])
    assert r.m(0).bank > r.daily[-1][0]
    assert r.close_on(r.daily[-1][0]) == 70_000

@test(55, "אין יתרות → אין תזרים")
def _():
    st = no_cards(vat_enabled=False)
    for a in st.accounts: a.active = False
    r = compute(st)
    assert r.st.open_total() == 0 and r.close_on(d(2026,12,2)) == 0

@test(56, "תרחיש זהיר · 15 ימי עסקים ו-5%")
def _():
    st = base(vat_enabled=False); st.scenario = "זהיר"
    r = compute(st, [INC(inv_date=d(2026,11,10), gross=10_000,
                         terms="שוטף פלוס 30", account="BANK1")])
    assert r.m(0).bank == d(2027,1,27), r.m(0).bank
    assert r.m(0).fc == 9_500.0, r.m(0).fc

@test(57, "התרחיש אינו נוגע להוצאות ולכללים קבועים")
def _():
    exp = EXP(inv_date=d(2026,12,20), gross=4_000, terms="מיידי", account="BANK1")
    a = compute(no_cards(vat_enabled=False), [exp], [SAL])
    st = no_cards(vat_enabled=False); st.scenario = "קיצוני"
    b = compute(st, [exp], [SAL])
    assert a.m(0).bank == b.m(0).bank and a.m(0).fc == b.m(0).fc
    assert a.gen_of("SAL-01", d(2026,12,1)).amount == b.gen_of("SAL-01", d(2026,12,1)).amount

@test(58, "שוטף פלוס 60 · התאריך נגזר מהטבלה")
def _():
    r = compute(base(), [INC(inv_date=d(2027,1,1), gross=10_000,
                             terms="שוטף פלוס 60", account="BANK1")])
    assert r.m(0).due == d(2027,4,1), r.m(0).due
    assert r.m(0).bank == d(2027,4,8), r.m(0).bank

@test(59, "תאריך פירעון ידני דורס, ומחיקתו מחזירה")
def _():
    with_am = compute(base(), [INC(inv_date=d(2026,11,10), gross=10_000, terms="שוטף פלוס 30",
                                   manual_due=d(2026,12,20), account="BANK1")])
    without = compute(base(), [INC(inv_date=d(2026,11,10), gross=10_000,
                                   terms="שוטף פלוס 30", account="BANK1")])
    assert with_am.m(0).bank == d(2026,12,27), with_am.m(0).bank
    assert without.m(0).bank == d(2027,1,6)


# ═══════════ קבוצה ו' — חידושי 1.1 (60–65) ═══════════
@test(60, "שולם אחרי העוגן → נספר במלואו")
def _():
    r = compute(no_cards(vat_enabled=False),
                [EXP(inv_date=d(2027,1,10), gross=5_000, terms="מיידי", account="BANK1",
                     paid=True, pay_date=d(2027,1,15))])
    assert r.m(0).fc == 5_000 and r.m(0).bank == d(2027,1,15)
    assert r.close_on(d(2027,1,15), "BANK1") == 45_000

@test(61, "ימי ביטחון ללקוח · השורה גוברת על הטבלה")
def _():
    st = base(vat_enabled=False); st.cust_delay = {"אלון": 20}
    by_cust = compute(st, [Mov(dir="הכנסה", party="אלון", cat="הכנסות משירותים",
                               inv_date=d(2026,11,10), gross=10_000, terms="שוטף", account="BANK1")])
    by_row = compute(st, [Mov(dir="הכנסה", party="אלון", cat="הכנסות משירותים",
                              inv_date=d(2026,11,10), gross=10_000, terms="שוטף",
                              delay=0, account="BANK1")])
    assert by_cust.m(0).bank == D.add_biz(d(2026,11,30), 20), by_cust.m(0).bank
    assert by_row.m(0).bank == d(2026,11,30)

@test(62, "שדה הבדיקה מראה פער ואינו מתקן אותו")
def _():
    st = no_cards(vat_enabled=False)
    st.check_date, st.check_total = d(2026,12,31), 61_000
    r = compute(st)
    gap = st.check_total - r.close_on(st.check_date)
    assert gap == -9_000, gap
    assert r.close_on(st.check_date) == 70_000   # לא תוקן אוטומטית

@test(63, "שדה הבדיקה ריק → שום דבר לא נחסם")
def _():
    st = no_cards(vat_enabled=False)
    r = compute(st)
    assert st.check_date is None and st.check_total is None
    assert r.close_on(d(2026,12,2)) == 70_000

@test(64, "חשבונית על כרטיס מופחתת מהמסגרת — בלי ספירה כפולה")
def _():
    st = base(vat_enabled=False)
    r = compute(st, [EXP(inv_date=d(2026,12,5), gross=800, terms="מיידי",
                         method="אשראי", card="CARD1", account=None)])
    inv = r.m(0)
    card_row = next(c for c in r.cards if c.card=="CARD1" and c.bank == inv.bank)
    assert card_row.amount == 2_200, card_row.amount
    assert card_row.amount + inv.fc == 3_000

@test(65, "שורה עם שגיאה אינה נכנסת לתחזית")
def _():
    r = compute(no_cards(vat_enabled=False),
                [EXP(inv_date=d(2026,12,10), gross=0, terms="מיידי", account="BANK1")])
    assert r.m(0).err == "סכום חסר או אפס"
    assert r.m(0).fc == 0 and r.close_on(d(2026,12,10)) == 70_000


# ═══════════ מריץ ═══════════
if __name__ == "__main__":
    ok = fail = 0; bad = []
    for n, title, f in sorted(T):
        try:
            f(); ok += 1
        except Exception as e:
            fail += 1; bad.append((n, title, e))
    print(f"\n{'='*64}\nעברו {ok} מתוך {ok+fail}\n{'='*64}")
    for n, title, e in bad:
        print(f"  ✗ {n:>2} | {title}\n       {type(e).__name__}: {e}")
    raise SystemExit(1 if fail else 0)
