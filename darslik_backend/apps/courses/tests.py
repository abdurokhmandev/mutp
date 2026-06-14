from django.test import TestCase
from rest_framework.test import APIClient
from apps.users.models import User
from .models import Category, Course, Enrollment


class CourseEnrollTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student = User.objects.create_user(
            username='student@test.com', email='s@test.com',
            password='pass', role='student'
        )
        self.teacher = User.objects.create_user(
            username='teacher@test.com', email='t@test.com',
            password='pass', role='teacher', is_verified=True
        )
        self.category = Category.objects.create(name='IT', slug='it')
        self.free_course = Course.objects.create(
            teacher=self.teacher, category=self.category,
            title='Bepul kurs', slug='bepul-kurs',
            price=0, status='published'
        )
        self.paid_course = Course.objects.create(
            teacher=self.teacher, category=self.category,
            title='Pullik kurs', slug='pullik-kurs',
            price=99000, status='published'
        )

    def test_enroll_free_course(self):
        """Bepul kursga yozilish"""
        self.client.force_authenticate(user=self.student)
        res = self.client.post(f'/api/v1/courses/bepul-kurs/enroll/')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(Enrollment.objects.filter(
            student=self.student, course=self.free_course
        ).exists())

    def test_enroll_paid_course_fails(self):
        """Pullik kursga to'lovsiz yozilish mumkin emas"""
        self.client.force_authenticate(user=self.student)
        res = self.client.post(f'/api/v1/courses/pullik-kurs/enroll/')
        self.assertEqual(res.status_code, 400)

    def test_double_enroll_fails(self):
        """Ikki marta yozilish mumkin emas"""
        self.client.force_authenticate(user=self.student)
        self.client.post(f'/api/v1/courses/bepul-kurs/enroll/')
        res = self.client.post(f'/api/v1/courses/bepul-kurs/enroll/')
        self.assertEqual(res.status_code, 400)

    def test_publish_course(self):
        """Kursni nashr etish"""
        from .models import Module, Lesson
        module = Module.objects.create(course=self.free_course, title="1-modul")
        Lesson.objects.create(module=module, title="1-dars", lesson_type="video")
        
        self.client.force_authenticate(user=self.teacher)
        res = self.client.post(f'/api/v1/courses/teacher/courses/bepul-kurs/publish/', {
            'is_private': False,
            'require_approval': False,
            'max_students': None
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['success'], True)
