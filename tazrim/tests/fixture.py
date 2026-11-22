"""נתוני הבסיס לכל 65 בדיקות הקבלה - סעיף 16.1 באפיון."""
import datetime as dt, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from engine import dates as D
from engine.model import Settings, Account, Card, Mov, Rec, Ov, CardActual

d = dt.date
CUTOFF = d(2026, 12, 1)
D.HOLIDAYS = {d(2026, 12, 13)}

CAT_VAT = {"שכר": False, "הלוואות": False, "מסים ומע\"מ": False,
           "ספקים": True, "שכירות": True, "הכנסות משירותים": True, "אחר": True}

RATES = [(d(2012, 9, 1), 0.17), (d(2013, 6, 1), 0.18),
         (d(2015, 10, 1), 0.17), (d(2025, 1, 1), 0.18)]


def base(**kw):
    s = Settings(
        cutoff=CUTOFF,
        accounts=[Account("BANK1", "עו\"ש", 50_000, 10_000),
                  Account("BANK2", "משני", 20_000, None)],
        cards=[Card("CARD1", "ויזה", "BANK1", 2, 3_000),
               Card("CARD2", "מאסטר", "BANK2", 10, 8_000)],
        default_delay=5, cat_vat=dict(CAT_VAT), vat_rates=list(RATES),
        vat_period="דו-חודשי", vat_basis="מצטבר",
        vat_pay_day=15, vat_pay_offset=1, vat_acc="BANK1")
    for k, v in kw.items():
        setattr(s, k, v)
    return s


def no_cards(**kw):
    """בסיס בלי כרטיסים - לבדיקות יתרות נקיות."""
    s = base(**kw)
    for c in s.cards:
        c.active = False
    return s


def no_vat(**kw):
    s = base(**kw); s.vat_enabled = False; return s


SAL = Rec(id="SAL-01", desc="שכר", cat="שכר", dir="הוצאה", amount=30_000,
          every=1, day=10, start=d(2026, 12, 1), method="העברה", account="BANK1")
