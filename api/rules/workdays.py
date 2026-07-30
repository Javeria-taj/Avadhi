"""Indian bank working-day arithmetic.

Why this file exists
--------------------
RBI's 2017 circular on unauthorised electronic transactions gives a customer
zero liability for a third-party breach if they notify the bank within THREE
WORKING DAYS. Three details make this non-trivial, and all three are places a
language model would produce a plausible wrong answer:

  1. The clock starts from the date the customer receives the BANK'S
     COMMUNICATION (the SMS/email alert) - not from when they noticed the fraud.
  2. The date of receiving the communication is EXCLUDED from the count.
  3. "Working days" follows the working schedule of the customer's home branch.

Indian bank schedules: closed Sundays, closed 2nd and 4th Saturdays, open on
1st/3rd/5th Saturdays, plus declared holidays.

This is exactly the arithmetic that justifies a deterministic engine. Say so.
"""
from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from pathlib import Path

from api.rules.engine import IST

HOLIDAYS_FILE = Path(__file__).resolve().parents[2] / "data" / "holidays.json"

# End of the business day. A deadline of "3 working days" means the close of
# the third working day, not the same clock time three days later.
BRANCH_CLOSING = time(hour=17, minute=0)

_holidays: set[date] | None = None


def load_holidays(path: Path | None = None) -> set[date]:
    """Declared bank holidays, as data. Cached after first read."""
    global _holidays
    if _holidays is not None:
        return _holidays

    path = path or HOLIDAYS_FILE
    if not path.exists():
        _holidays = set()
        return _holidays

    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    _holidays = {date.fromisoformat(d) for d in payload.get("dates", [])}
    return _holidays


def reset_holiday_cache() -> None:
    """For tests, and for reloading after editing the holiday file."""
    global _holidays
    _holidays = None


def is_second_or_fourth_saturday(day: date) -> bool:
    """Indian banks close on the 2nd and 4th Saturday of each month.

    Computed from the ordinal position of the Saturday within its month, not
    from the day-of-month, because the 8th is only the 2nd Saturday in some
    months.
    """
    if day.weekday() != 5:  # 5 == Saturday
        return False
    return ((day.day - 1) // 7) + 1 in (2, 4)


def is_working_day(day: date, holidays: set[date] | None = None) -> bool:
    holidays = holidays if holidays is not None else load_holidays()
    if day.weekday() == 6:  # Sunday
        return False
    if is_second_or_fourth_saturday(day):
        return False
    return day not in holidays


def add_working_days(
    start: date,
    count: int,
    holidays: set[date] | None = None,
) -> date:
    """Return the date `count` working days after `start`, excluding `start`.

    Excluding the start date is required by the circular, not a stylistic
    choice. `start` may itself be a holiday - it is skipped either way because
    counting begins the following day.
    """
    if count < 1:
        raise ValueError("count must be at least 1 working day")

    holidays = holidays if holidays is not None else load_holidays()
    cursor = start
    remaining = count

    # Guard against a pathological holiday file locking the loop forever.
    for _ in range(count * 10 + 30):
        cursor += timedelta(days=1)
        if is_working_day(cursor, holidays):
            remaining -= 1
            if remaining == 0:
                return cursor

    raise RuntimeError(
        f"Could not find {count} working days after {start}. Check data/holidays.json."
    )


def working_day_deadline(
    communication_received: datetime,
    working_days: int,
    holidays: set[date] | None = None,
) -> datetime:
    """Deadline as an IST datetime, at close of business on the final day."""
    received = (
        communication_received
        if communication_received.tzinfo
        else communication_received.replace(tzinfo=IST)
    ).astimezone(IST)

    final_day = add_working_days(received.date(), working_days, holidays)
    return datetime.combine(final_day, BRANCH_CLOSING, tzinfo=IST)


def working_days_between(
    start: date,
    end: date,
    holidays: set[date] | None = None,
) -> int:
    """Working days from `start` (exclusive) to `end` (inclusive).

    Used to explain to the user how the deadline was reached, so the number on
    screen is auditable rather than asserted.
    """
    holidays = holidays if holidays is not None else load_holidays()
    if end <= start:
        return 0

    count = 0
    cursor = start
    while cursor < end:
        cursor += timedelta(days=1)
        if is_working_day(cursor, holidays):
            count += 1
    return count
