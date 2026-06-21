BADGE_CHECKS = {}

def register_check(trigger_type):
    def decorator(func):
        BADGE_CHECKS[trigger_type] = func
        return func
    return decorator


@register_check('first_course_completed')
def check_first_course(user):
    from apps.courses.models import Enrollment
    return Enrollment.objects.filter(
        student=user, is_completed=True
    ).count() >= 1


@register_check('streak_7')
def check_streak_7(user):
    return getattr(user, 'streak', None) and user.streak.current_streak >= 7


@register_check('streak_30')
def check_streak_30(user):
    return getattr(user, 'streak', None) and user.streak.current_streak >= 30


@register_check('courses_completed_5')
def check_5_courses(user):
    from apps.courses.models import Enrollment
    return Enrollment.objects.filter(
        student=user, is_completed=True
    ).count() >= 5


@register_check('quiz_perfect_score')
def check_perfect_quiz(user):
    from apps.courses.models import QuizAttempt
    return QuizAttempt.objects.filter(
        student=user, score=100
    ).exists()


def check_and_award_badges(user):
    """
    Foydalanuvchi uchun barcha shartlarni tekshiradi,
    yangi yutuq bo'lsa beradi va qaytaradi.
    Har bir muhim harakatdan keyin chaqiriladi
    (dars tugatish, streak yangilanish va h.k.)
    """
    from .models import Badge, UserBadge
    from apps.notifications.models import Notification

    newly_earned = []
    already_earned_ids = set(
        UserBadge.objects.filter(user=user).values_list('badge_id', flat=True)
    )

    for badge in Badge.objects.exclude(id__in=already_earned_ids):
        check_fn = BADGE_CHECKS.get(badge.trigger_type)
        if check_fn and check_fn(user):
            UserBadge.objects.create(user=user, badge=badge)
            newly_earned.append(badge)
            
            # Send level-up/achievement notification to user
            Notification.objects.create(
                recipient=user,
                type=Notification.Type.XP_EARNED,
                title='Yangi yutuq! 🏆',
                message=f'Tabriklaymiz! Siz "{badge.name}" yutug\'ini qo\'lga kiritdingiz!',
                link='profile.html'
            )

    return newly_earned
