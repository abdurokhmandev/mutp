from datetime import date, timedelta
from .models import DailyStudyLog


def get_streak(user) -> int:
    """
    O'quvchining joriy streak (ketma-ket o'qigan kunlar) soni.
    Bugundan boshlab orqaga sanash.
    Agar bugun o'qimagan bo'lsa, kechagi kundan sanash.
    """
    today = date.today()
    
    # Check if there is any study log for today. If not, start check from yesterday.
    if not DailyStudyLog.objects.filter(student=user, date=today).exists():
        check_date = today - timedelta(days=1)
    else:
        check_date = today
        
    streak = 0
    while True:
        exists = DailyStudyLog.objects.filter(
            student=user, date=check_date
        ).exists()
        if exists:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    return streak


def get_weekly_activity(user) -> list:
    """
    So'nggi 7 kun uchun kunlik o'qish soniyalari.
    [{"date": "2026-06-04", "day": "Wed", "seconds": 3600}, ...]
    """
    today = date.today()
    result = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        log = DailyStudyLog.objects.filter(student=user, date=d).first()
        result.append({
            "date": str(d),
            "day": d.strftime("%a"),
            "seconds": log.seconds_studied if log else 0
        })
    return result


def log_study_time(user, seconds: int):
    """
    O'qish vaqtini kunlik logga qo'shish.
    LessonProgress saqlanganida chaqiriladi.
    """
    today = date.today()
    log, created = DailyStudyLog.objects.get_or_create(
        student=user, date=today,
        defaults={'seconds_studied': 0}
    )
    log.seconds_studied += seconds
    log.save(update_fields=['seconds_studied'])
