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
