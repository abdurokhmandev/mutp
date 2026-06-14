from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from .models import User


class UserRegisterTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('register')
        self.valid_data = {
            "first_name": "Jasur",
            "last_name": "Nazarov",
            "email": "jasur@test.com",
            "password": "Test1234!password",
            "password2": "Test1234!password",
            "role": "student"
        }

    def test_register_success(self):
        """Muvaffaqiyatli ro'yxatdan o'tish"""
        res = self.client.post(self.url, self.valid_data)
        self.assertEqual(res.status_code, 201)
        self.assertIn('access', res.data['data'])
        self.assertTrue(User.objects.filter(email='jasur@test.com').exists())

    def test_register_password_mismatch(self):
        """Parollar mos kelmasligi"""
        data = {**self.valid_data, "password2": "wrong"}
        res = self.client.post(self.url, data)
        self.assertEqual(res.status_code, 400)

    def test_register_duplicate_email(self):
        """Takroriy email"""
        self.client.post(self.url, self.valid_data)
        res = self.client.post(self.url, self.valid_data)
        self.assertEqual(res.status_code, 400)


class UserOTPTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        from apps.users.models import TelegramUser
        self.tg_user = TelegramUser.objects.create(
            chat_id=12345678,
            phone="+998901234567",
            username="test_tg",
            first_name="Test"
        )

    def test_send_otp_success_if_started(self):
        from unittest.mock import patch
        with patch('apps.users.views.send_otp', return_value=True):
            res = self.client.post('/api/v1/auth/send-otp/', {'phone': '998901234567'})
            self.assertEqual(res.status_code, 200)
            self.assertIn('phone', res.data['data'])

    def test_send_otp_fail_if_bot_not_started(self):
        res = self.client.post('/api/v1/auth/send-otp/', {'phone': '998909999999'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['errors']['error'], 'bot_not_started')

    def test_verify_otp_success(self):
        from django.core.cache import cache
        cache.set('otp:+998901234567', '123456', timeout=300)
        res = self.client.post('/api/v1/auth/verify-otp/', {
            'phone': '998901234567',
            'otp': '123456',
            'role': 'student'
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data['data'])
        self.assertIn('refresh', res.data['data'])

