"""מנוע ייחוס מלא - מימוש אפיון גרסה 1.1."""
from __future__ import annotations
import datetime as dt
from dataclasses import dataclass, field
from . import dates as D

D_ = dt.date


# ───────────────────────── מבני נתונים ─────────────────────────
@dataclass
class Account:
    id: str; name: str; opening: float
    minimum: float | None = None; active: bool = True


@dataclass
class Card:
    id: str; name: str; account: str
    debit_day: int; limit: float; active: bool = True


@dataclass
class Scenario:
    name: str; delay: int = 0; haircut: float = 0.0


@dataclass
class Settings:
    cutoff: D_
    accounts: list[Account]
    cards: list[Card] = field(default_factory=list)
    scenario: str = "בסיס"
    scenarios: dict = field(default_factory=lambda: {
        "בסיס": Scenario("בסיס", 0, 0.0),
        "זהיר": Scenario("זהיר", 15, 0.05),
        "קיצוני": Scenario("קיצוני", 30, 0.10)})
    default_delay: int = 5
    cust_delay: dict = field(default_factory=dict)
    cat_vat: dict = field(default_factory=dict)
    vat_rates: list = field(default_factory=lambda: [(D_(2025, 1, 1), 0.18)])
    vat_enabled: bool = True
    vat_period: str = "דו-חודשי"
    vat_basis: str = "מצטבר"
    vat_pay_day: int = 15
    vat_pay_offset: int = 1
    vat_acc: str = "BANK1"
    check_date: D_ | None = None
    check_total: float | None = None

    @property
    def scen(self): return self.scenarios[self.scenario]

    def card(self, cid): return next((c for c in self.cards if c.id == cid), None)

    def acc(self, aid): return next((a for a in self.accounts if a.id == aid), None)

    def vat_rate(self, on: D_):
        r = 0.0
        for frm, val in sorted(self.vat_rates):
            if on and on >= frm:
                r = val
        return r

    def open_total(self):
        return sum(a.opening for a in self.accounts if a.active)


@dataclass
class Mov:
    """שורה בלשונית הזנה."""
    dir: str; party: str = ""; desc: str = ""; cat: str = "אחר"
    inv_no: str = ""; inv_date: D_ | None = None; gross: float = 0.0
    rate_in: float | None = None; vat_yn: str | None = None
    terms: str = "מיידי"; term_val=None; delay: int | None = None
    method: str = "העברה"; card: str | None = None; account: str | None = None
    paid: bool = False; paid_amt: float | None = None; pay_date: D_ | None = None
    rule: str | None = None; ov_month: D_ | None = None; mode: str | None = None
    manual_due: D_ | None = None
    err: str = ""


@dataclass
class Rec:
    """כלל קבוע."""
    id: str; desc: str; cat: str; dir: str; amount: float
    every: int; day: int; start: D_
    end: D_ | None = None; active: bool = True
    method: str = "העברה"; card: str | None = None; account: str = "BANK1"
    vat_yn: str | None = None; rate: float | None = None
    err: str = ""


@dataclass
class Ov:
    """חריגה / סימון תשלום של כלל קבוע."""
    rule: str; month: D_; amount: float
    paid: bool = False; pay_date: D_ | None = None

    @property
    def key(self): return D.eomonth(self.month, 0)


@dataclass
class CardActual:
    card: str; month: D_; amount: float

    @property
    def key(self): return D.eomonth(self.month, 0)


@dataclass
class Line:
    """תנועה מחושבת שנכנסת לתזרים."""
    date: D_; dir: str; amount: float; account: str
    cat: str = "אחר"; source: str = "הזנה"; desc: str = ""
