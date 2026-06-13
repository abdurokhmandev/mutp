import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.users.models import User, TeacherProfile
from apps.courses.models import Category, Course, Module, Lesson, Enrollment, LessonProgress, Review
from apps.analytics.models import DailyStudyLog


class Command(BaseCommand):
    help = "Test ma'lumotlarini to'ldirish"

    def handle(self, *args, **options):
        self.stdout.write("Ma'lumotlarni to'ldirish boshlandi...")

        # Clear existing data to avoid duplicates
        Review.objects.all().delete()
        Enrollment.objects.all().delete()
        Lesson.objects.all().delete()
        Module.objects.all().delete()
        Course.objects.all().delete()
        Category.objects.all().delete()
        DailyStudyLog.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()

        # 1. 5 ta kategoriya
        categories_data = [
            {"name": "Dasturlash", "icon": "💻"},
            {"name": "Tillar", "icon": "🗣️"},
            {"name": "Dizayn", "icon": "🎨"},
            {"name": "Biznes", "icon": "📊"},
            {"name": "Matematika", "icon": "🔢"},
        ]
        categories = []
        for index, cat in enumerate(categories_data):
            c = Category.objects.create(
                name=cat["name"],
                icon=cat["icon"],
                order=index
            )
            categories.append(c)

        self.stdout.write(f"{len(categories)} ta kategoriya yaratildi.")

        # 2. 2 ta o'qituvchi (tasdiqlangan)
        teachers = []
        teacher_names = [
            ("Alisher", "Karimov", "alisher@edu.uz", "Python & Django bo'yicha katta dasturchi"),
            ("Dilnoza", "Nazarova", "dilnoza@edu.uz", "IELTS bo'yicha 8.5 ballik tajribali o'qituvchi")
        ]
        for first, last, email, bio in teacher_names:
            u = User.objects.create_user(
                username=email,
                email=email,
                password="Password123!",
                first_name=first,
                last_name=last,
                role=User.Role.TEACHER,
                is_verified=True,
                bio=bio
            )
            profile = u.teacher_profile
            profile.specialization = "Dasturlash" if "alisher" in email else "Chet tillari"
            profile.experience_years = 6 if "alisher" in email else 8
            profile.total_earnings = 15000000.00
            profile.pending_payout = 4500000.00
            profile.bank_card = "8600123456789012"
            profile.save()
            teachers.append(u)

        self.stdout.write("2 ta o'qituvchi yaratildi.")

        # 3. 10 ta kurs (5 bepul, 5 pullik)
        courses = []
        course_titles = [
            ("Python asoslari", 0, "beginner", "uz", categories[0]),
            ("React JS boshlang'ich", 0, "intermediate", "uz", categories[0]),
            ("IELTS 7+ Listening", 0, "intermediate", "en", categories[1]),
            ("UI/UX Figma basics", 0, "beginner", "uz", categories[2]),
            ("Biznes boshqaruviga kirish", 0, "beginner", "uz", categories[3]),
            ("Django REST Framework Advanced", 499000, "advanced", "uz", categories[0]),
            ("Ingliz tili Grammatika", 199000, "beginner", "uz", categories[1]),
            ("Mobil dizayn Figma", 299000, "intermediate", "uz", categories[2]),
            ("Sotuv sirlari va marketing", 399000, "intermediate", "uz", categories[3]),
            ("DTM Matematika yechimlari", 150000, "beginner", "uz", categories[4]),
        ]

        for i, (title, price, level, lang, cat) in enumerate(course_titles):
            teacher = teachers[0] if i % 2 == 0 else teachers[1]
            status = Course.Status.PUBLISHED
            
            c = Course.objects.create(
                teacher=teacher,
                category=cat,
                title=title,
                description=f"Bu {title} kursi haqida to'liq va batafsil ma'lumot matni. Bu yerda siz kurs davomida nimalar o'rganishingiz va qanday natijaga erishishingiz bayon qilinadi.",
                price=price,
                level=level,
                language=lang,
                status=status,
                is_featured=(i < 3)
            )
            courses.append(c)

        self.stdout.write("10 ta kurs yaratildi.")

        # 4. Har bir kursda 3 ta modul, har modulda 5 ta dars
        for course in courses:
            for m_idx in range(1, 4):
                module = Module.objects.create(
                    course=course,
                    title=f"{m_idx}-Modul. Asoslar va amaliyot",
                    order=m_idx
                )
                for l_idx in range(1, 6):
                    lesson_type = Lesson.LessonType.VIDEO if l_idx % 2 == 1 else Lesson.LessonType.TEXT
                    Lesson.objects.create(
                        module=module,
                        title=f"{l_idx}-Dars. Mavzuni o'rganish",
                        order=l_idx,
                        lesson_type=lesson_type,
                        video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" if lesson_type == Lesson.LessonType.VIDEO else "",
                        duration_seconds=random.randint(300, 1200) if lesson_type == Lesson.LessonType.VIDEO else 0,
                        content="Dars matni va foydali havolalar bu yerda yoziladi..." if lesson_type == Lesson.LessonType.TEXT else "",
                        is_free_preview=(m_idx == 1 and l_idx == 1)
                    )

        self.stdout.write("Modullar va darslar yaratildi.")

        # 5. 20 ta o'quvchi
        students = []
        for s_idx in range(1, 21):
            email = f"student{s_idx}@edu.uz"
            u = User.objects.create_user(
                username=email,
                email=email,
                password="Password123!",
                first_name=f"Talaba_{s_idx}",
                last_name=f"Familiyasi",
                role=User.Role.STUDENT
            )
            students.append(u)

        self.stdout.write("20 ta talaba yaratildi.")

        # 6. 50 ta random yozilish
        enrollments = []
        # Free courses are safe to enroll automatically
        free_courses = [c for c in courses if c.is_free]
        paid_courses = [c for c in courses if not c.is_free]

        # Student study logs for streaking
        today = date.today()

        for student in students:
            # Each student logs in last 10 days
            for d_idx in range(random.randint(4, 9)):
                log_date = today - timedelta(days=d_idx)
                DailyStudyLog.objects.create(
                    student=student,
                    date=log_date,
                    seconds_studied=random.randint(600, 3600)
                )

            # Enroll in 2-3 free courses
            chosen_free = random.sample(free_courses, random.randint(2, 3))
            for course in chosen_free:
                enrollment = Enrollment.objects.create(
                    student=student,
                    course=course,
                    enrolled_at=timezone.now() - timedelta(days=random.randint(1, 10))
                )
                
                # Simulate partial or full progress
                lessons = Lesson.objects.filter(module__course=course)
                total_lessons = lessons.count()
                
                # Make some completed (e.g. 100% progress)
                is_completed = (random.random() > 0.6)
                if is_completed:
                    for lesson in lessons:
                        LessonProgress.objects.create(
                            enrollment=enrollment,
                            lesson=lesson,
                            watched_seconds=lesson.duration_seconds if lesson.duration_seconds > 0 else 0,
                            is_completed=True
                        )
                else:
                    # Partial progress
                    completed_count = random.randint(1, total_lessons - 2)
                    for lesson in list(lessons)[:completed_count]:
                        LessonProgress.objects.create(
                            enrollment=enrollment,
                            lesson=lesson,
                            watched_seconds=lesson.duration_seconds if lesson.duration_seconds > 0 else 0,
                            is_completed=True
                        )
                
                # If completed, add a review
                if enrollment.is_completed:
                    Review.objects.create(
                        enrollment=enrollment,
                        rating=random.choice([4, 5]),
                        comment="Juda ajoyib va tushunarli kurs bo'libdi, hammaga tavsiya qilaman!"
                    )
                
                enrollments.append(enrollment)

            # Add some manual enrollment to paid courses to simulate teacher earnings
            chosen_paid = random.sample(paid_courses, random.randint(1, 2))
            for course in chosen_paid:
                enrollment = Enrollment.objects.create(
                    student=student,
                    course=course,
                    enrolled_at=timezone.now() - timedelta(days=random.randint(1, 15))
                )
                # simulate partial progress
                lessons = Lesson.objects.filter(module__course=course)
                completed_count = random.randint(1, 5)
                for lesson in list(lessons)[:completed_count]:
                    LessonProgress.objects.create(
                        enrollment=enrollment,
                        lesson=lesson,
                        watched_seconds=lesson.duration_seconds if lesson.duration_seconds > 0 else 0,
                        is_completed=True
                    )
                enrollments.append(enrollment)

        self.stdout.write(f"50 ta yozilish va dars progresslari shakllantirildi.")
        self.stdout.write(self.style.SUCCESS("Ma'lumotlar muvaffaqiyatli to'ldirildi!"))
