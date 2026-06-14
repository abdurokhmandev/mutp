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


class DiscussionTestCase(TestCase):
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
        self.course = Course.objects.create(
            teacher=self.teacher, category=self.category,
            title='Python Asoslari', slug='python-asoslari',
            price=0, status='published'
        )
        from .models import Module, Lesson
        self.module = Module.objects.create(course=self.course, title="Asosiy modul")
        self.lesson = Lesson.objects.create(module=self.module, title="1-dars", lesson_type="video")
        
        # Student enrolls
        Enrollment.objects.create(student=self.student, course=self.course)

    def test_lesson_discussion_api(self):
        # 1. Post a discussion question
        self.client.force_authenticate(user=self.student)
        res = self.client.post(f'/api/v1/courses/lessons/{self.lesson.id}/discussions/', {
            'title': 'Darsda xatolik',
            'text': 'Video 5:12 da qaysi operator?',
            'video_timestamp': 312
        })
        self.assertEqual(res.status_code, 201)
        disc_id = res.data['data']['id']

        # 2. Get discussions
        res = self.client.get(f'/api/v1/courses/lessons/{self.lesson.id}/discussions/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['data']), 1)

        # 3. Post a reply
        res = self.client.post(f'/api/v1/courses/discussions/{disc_id}/replies/', {
            'text': 'Bu if shart operatori'
        })
        self.assertEqual(res.status_code, 201)
        reply_id = res.data['data']['id']

        # 4. React to discussion
        res = self.client.post(f'/api/v1/courses/discussions/{disc_id}/react/', {
            'emoji': '👍',
            'target_type': 'discussion'
        })
        self.assertEqual(res.status_code, 200)

        # 5. Teacher actions (pin, resolve, accept reply)
        self.client.force_authenticate(user=self.teacher)
        res = self.client.post(f'/api/v1/courses/discussions/{disc_id}/pin/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['data']['is_pinned'])

        res = self.client.post(f'/api/v1/courses/discussions/replies/{reply_id}/accept/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['data']['is_accepted'])


class Custom404TestCase(TestCase):
    def test_custom_404_page(self):
        client = APIClient()
        response = client.get('/some-nonexistent-url-path/')
        # Django custom error handlers are invoked only when DEBUG=False, so let's override settings in this test
        with self.settings(DEBUG=False, ALLOWED_HOSTS=['*']):
            response = self.client.get('/some-nonexistent-url-path/')
            self.assertEqual(response.status_code, 404)
            self.assertContains(response, "Voy! Bu sahifa topilmadi", status_code=404)


