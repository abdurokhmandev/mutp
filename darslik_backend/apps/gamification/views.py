from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Q
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.core.utils import success_response
from django.contrib.auth import get_user_model

User = get_user_model()


class LeaderboardView(APIView):
    """
    GET /api/v1/gamification/leaderboard/?period=week|month|all

    Eng faol o'quvchilarni ko'rsatadi.
    Mezon: tugatilgan darslar soni + streak + badge soni
    asosida hisoblangan "activity score".
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get('period', 'week')

        date_filter = {}
        if period == 'week':
            date_filter = {
                'enrollments__lesson_progresses__last_watched__gte': timezone.now() - timedelta(days=7)
            }
        elif period == 'month':
            date_filter = {
                'enrollments__lesson_progresses__last_watched__gte': timezone.now() - timedelta(days=30)
            }

        # Filter students and count completed lessons in the chosen period
        leaderboard = User.objects.filter(
            role='student'
        ).annotate(
            lessons_completed=Count(
                'enrollments__lesson_progresses',
                filter=Q(
                    enrollments__lesson_progresses__is_completed=True,
                    **date_filter
                ) if date_filter else Q(enrollments__lesson_progresses__is_completed=True)
            )
        ).order_by('-lessons_completed')[:50]

        data = []
        for rank, user in enumerate(leaderboard, 1):
            streak = getattr(user, 'streak', None)
            avatar_url = None
            if user.avatar:
                avatar_url = request.build_absolute_uri(user.avatar.url)
                
            data.append({
                'rank':             rank,
                'user_id':          user.id,
                'full_name':        user.full_name,
                'avatar':           avatar_url,
                'lessons_completed': user.lessons_completed,
                'current_streak':  streak.current_streak if streak else 0,
                'badges_count':    user.badges.count(),
                'is_current_user': user.id == request.user.id,
            })

        # Find current user's rank/info
        my_rank = next(
            (item for item in data if item['is_current_user']), None
        )
        
        # If current user is not in top 50, fetch their rank manually
        if not my_rank and request.user.role == 'student':
            user = request.user
            # Simple count of how many users have more completed lessons
            my_lessons_count = User.objects.filter(id=user.id).annotate(
                completed=Count(
                    'enrollments__lesson_progresses',
                    filter=Q(
                        enrollments__lesson_progresses__is_completed=True,
                        **date_filter
                    ) if date_filter else Q(enrollments__lesson_progresses__is_completed=True)
                )
            ).first().completed
            
            higher_users = User.objects.filter(role='student').annotate(
                completed=Count(
                    'enrollments__lesson_progresses',
                    filter=Q(
                        enrollments__lesson_progresses__is_completed=True,
                        **date_filter
                    ) if date_filter else Q(enrollments__lesson_progresses__is_completed=True)
                )
            ).filter(completed__gt=my_lessons_count).count()
            
            streak = getattr(user, 'streak', None)
            avatar_url = None
            if user.avatar:
                avatar_url = request.build_absolute_uri(user.avatar.url)
                
            my_rank = {
                'rank':             higher_users + 1,
                'user_id':          user.id,
                'full_name':        user.full_name,
                'avatar':           avatar_url,
                'lessons_completed': my_lessons_count,
                'current_streak':  streak.current_streak if streak else 0,
                'badges_count':    user.badges.count(),
                'is_current_user': True,
            }

        return success_response(data={
            'period':      period,
            'leaderboard': data,
            'my_rank':     my_rank,
        })
