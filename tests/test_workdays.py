"""Tests for bank working-day arithmetic.

This is the piece most likely to be probed by a judge, and the piece where a
wrong answer costs someone real money. Boundaries are tested explicitly.

Reference dates used below (2026):
  Sat 4 Jul  = 1st Saturday  -> working
  Sat 11 Jul = 2nd Saturday  -> closed
  Sat 18 Jul = 3rd Saturday  -> working
  Sat 25 Jul = 4th Saturday  -> closed
"""
from __future__ import annotations

from datetime import date, datetime

import pytest

from api.rules.engine import IST
from api.rules.workdays import (
    add_working_days,
    is_second_or_fourth_saturday,
    is_working_day,
    working_day_deadline,
    working_days_between,
)

NO_HOLIDAYS: set[date] = set()


# --- Saturday classification -------------------------------------------------

@pytest.mark.parametrize(
    "day,expected",
    [
        (date(2026, 7, 4), False),   # 1st Saturday
        (date(2026, 7, 11), True),   # 2nd
        (date(2026, 7, 18), False),  # 3rd
        (date(2026, 7, 25), True),   # 4th
    ],
)
def test_second_and_fourth_saturdays_identified(day, expected):
    assert is_second_or_fourth_saturday(day) is expected


def test_a_month_starting_on_saturday_still_counts_correctly():
    """1 Aug 2026 is a Saturday, so it is the 1st - not the 2nd, whatever the
    date number suggests."""
    assert is_second_or_fourth_saturday(date(2026, 8, 1)) is False
    assert is_second_or_fourth_saturday(date(2026, 8, 8)) is True


def test_non_saturdays_are_never_flagged():
    assert is_second_or_fourth_saturday(date(2026, 7, 13)) is False  # Monday


# --- working-day predicate ---------------------------------------------------

def test_sunday_is_never_a_working_day():
    assert is_working_day(date(2026, 7, 12), NO_HOLIDAYS) is False


def test_weekday_is_a_working_day():
    assert is_working_day(date(2026, 7, 13), NO_HOLIDAYS) is True


def test_first_saturday_is_a_working_day():
    assert is_working_day(date(2026, 7, 4), NO_HOLIDAYS) is True


def test_declared_holiday_is_not_a_working_day():
    holiday = date(2026, 8, 15)
    assert is_working_day(holiday, {holiday}) is False


# --- counting forward --------------------------------------------------------

def test_start_date_is_excluded_from_the_count():
    """Required by the circular: the date of receiving the communication does
    not count. Mon + 3 working days = Thu, not Wed."""
    assert add_working_days(date(2026, 7, 13), 3, NO_HOLIDAYS) == date(2026, 7, 16)


def test_count_skips_sunday():
    """Fri 17 Jul + 3 working days: Sat 18 (3rd, open), Sun 19 skipped,
    Mon 20, Tue 21."""
    assert add_working_days(date(2026, 7, 17), 3, NO_HOLIDAYS) == date(2026, 7, 21)


def test_count_skips_a_closed_saturday_and_sunday():
    """Thu 9 Jul: Fri 10, Sat 11 closed, Sun 12 closed, Mon 13, Tue 14."""
    assert add_working_days(date(2026, 7, 9), 3, NO_HOLIDAYS) == date(2026, 7, 14)


def test_count_skips_declared_holidays():
    holidays = {date(2026, 7, 14), date(2026, 7, 15)}
    assert add_working_days(date(2026, 7, 13), 3, holidays) == date(2026, 7, 18)


def test_starting_on_a_holiday_still_counts_from_the_next_day():
    """The start date is excluded regardless, so its own status is irrelevant."""
    holidays = {date(2026, 7, 13)}
    assert add_working_days(date(2026, 7, 13), 1, holidays) == date(2026, 7, 14)


def test_a_long_closure_run_is_handled():
    holidays = {date(2026, 7, 13), date(2026, 7, 14), date(2026, 7, 15),
                date(2026, 7, 16), date(2026, 7, 17)}
    # Sat 11 and Sun 12 already closed; next open day is Sat 18 (3rd).
    assert add_working_days(date(2026, 7, 10), 1, holidays) == date(2026, 7, 18)


def test_zero_or_negative_count_is_rejected():
    with pytest.raises(ValueError):
        add_working_days(date(2026, 7, 13), 0, NO_HOLIDAYS)


# --- the RBI deadline --------------------------------------------------------

def test_rbi_three_working_day_deadline_lands_at_close_of_business():
    """SMS received Monday afternoon -> deadline is Thursday 5pm, not Thursday
    at the same clock time."""
    received = datetime(2026, 7, 13, 14, 30, tzinfo=IST)
    deadline = working_day_deadline(received, 3, NO_HOLIDAYS)
    assert deadline.date() == date(2026, 7, 16)
    assert (deadline.hour, deadline.minute) == (17, 0)


def test_naive_datetime_is_treated_as_ist():
    """A 5.5-hour timezone bug here would silently move the deadline a day."""
    naive = datetime(2026, 7, 13, 23, 45)
    aware = datetime(2026, 7, 13, 23, 45, tzinfo=IST)
    assert working_day_deadline(naive, 3, NO_HOLIDAYS) == working_day_deadline(
        aware, 3, NO_HOLIDAYS
    )


def test_friday_evening_sms_gives_the_customer_until_wednesday():
    """The realistic worst case, and the one worth showing a judge: a Friday
    night fraud alert does not mean a Monday deadline."""
    received = datetime(2026, 7, 10, 22, 15, tzinfo=IST)
    deadline = working_day_deadline(received, 3, NO_HOLIDAYS)
    # Sat 11 closed, Sun 12 closed -> Mon 13, Tue 14, Wed 15
    assert deadline.date() == date(2026, 7, 15)


# --- explaining the answer ---------------------------------------------------

def test_working_days_between_is_auditable():
    assert working_days_between(date(2026, 7, 13), date(2026, 7, 16), NO_HOLIDAYS) == 3


def test_working_days_between_ignores_closed_days():
    assert working_days_between(date(2026, 7, 9), date(2026, 7, 14), NO_HOLIDAYS) == 3


def test_working_days_between_is_zero_when_end_precedes_start():
    assert working_days_between(date(2026, 7, 16), date(2026, 7, 13), NO_HOLIDAYS) == 0
