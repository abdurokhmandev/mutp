# EduUz Ta'lim Platformasi Backend (darslik_backend)

Ushbu loyiha online ta'lim platformasi uchun yozilgan Django-ga asoslangan backend xizmatidir. Bu yerda talabalar kurslarga yozilishi, progresslarini kuzatishi, darslarni o'rganishi hamda sertifikatlar olishlari mumkin. O'qituvchilar esa kurslar yaratib, modullar va darslar qo'shishi, o'z boshqaruv paneli orqali statistika va daromadlarini real vaqtda kuzatib borishi mumkin.

## Texnologiyalar steki
- **Python**: 3.12+
- **Django**: 5.x
- **Django REST Framework**: 3.15+
- **JWT Autentifikatsiya**: `djangorestframework-simplejwt`
- **Sozlamalar muhiti**: `django-environ`
- **Rasmlar bilan ishlash**: `Pillow`
- **Static fayllar xizmati**: `Whitenoise`
- **API Hujjatlar**: `drf-spectacular` (Swagger/Redoc)

---

## O'rnatish va ishga tushirish buyruqlari

Quyidagi amallarni ketma-ket bajaring:

### 1. Virtual muhitni yaratish va faollashtirish
```bash
# Virtual muhit yaratish
python -m venv venv

# Virtual muhitni faollashtirish
# Windows uchun:
venv\Scripts\activate

# Linux/Mac uchun:
source venv/bin/activate
```

### 2. Paketlarni o'rnatish
```bash
pip install -r requirements.txt
```

### 3. Muhit o'zgaruvchilari (.env)
Loyihaning asosiy papkasida (`darslik_backend/` ichida) `.env` faylini yarating yoki `.env.example` nusxasini oling:
```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```
Keyin `.env` faylidagi qiymatlarni tahrirlang (masalan, `SECRET_KEY` va `DATABASE_URL`).

### 4. Ma'lumotlar bazasi migratsiyasi
```bash
python manage.py migrate
```

### 5. Admin (Superuser) yaratish
```bash
python manage.py createsuperuser
```

### 6. Test ma'lumotlarini yuklash (Seeding)
Tizimni dastlabki test ma'lumotlari (kategoriyalar, o'qituvchilar, kurslar, darslar, talabalar va yozilishlar) bilan to'ldirish uchun maxsus commandni ishga tushiring:
```bash
python manage.py seed_data
```

### 7. Serverni ishga tushirish
```bash
python manage.py runserver
```
Server sukut bo'yicha http://127.0.0.1:8000/ manzilida ishlaydi.

### 8. Testlarni ishga tushirish
```bash
python manage.py test apps.users apps.courses
```

---

## Muhit o'zgaruvchilari (Environment Variables)

`.env` faylida quyidagi o'zgaruvchilar sozlanadi:
- `SECRET_KEY`: Django xavfsizlik kaliti.
- `DEBUG`: Development rejimida `True`, productionda `False` bo'ladi.
- `DATABASE_URL`: Ma'lumotlar bazasi ulanish manzili (sukut bo'yicha `sqlite:///db.sqlite3`).
- `ALLOWED_HOSTS`: Ruxsat berilgan domenlar ro'yxati (vergul bilan ajratiladi).
- `CORS_ALLOWED_ORIGINS`: Frontend ulanishi uchun ruxsat berilgan domenlar.
- `MEDIA_URL` va `MEDIA_ROOT`: Yuklangan rasm va videolar uchun sozlamalar.
- `STATIC_ROOT`: Yig'iladigan static fayllar papkasi.

---

## API Endpointlar ro'yxati

Loyiha Swagger hujjati orqali to'liq vizual taqdim etilgan:
- **Swagger UI**: http://127.0.0.1:8000/api/docs/
- **Redoc**: http://127.0.0.1:8000/api/redoc/

### 🔐 Autentifikatsiya (/api/v1/auth/)
- `POST /register/` — Yangi foydalanuvchini ro'yxatdan o'tkazish.
- `POST /login/` — Tizimga kirish (JWT token va user profil qaytariladi).
- `POST /logout/` — Tizimdan chiqish (Refresh tokenni faolsizlantiradi).
- `POST /token/refresh/` — Access tokenni yangilash.
- `GET, PATCH /profile/` — Foydalanuvchi profili ma'lumotlarini olish va yangilash.
- `POST /change-password/` — Parolni o'zgartirish.

### 👥 O'qituvchilar (/api/v1/auth/teachers/)
- `GET /teachers/` — Tasdiqlangan o'qituvchilar ro'yxati (qidirish va filtrlash bilan).
- `GET /teachers/{id}/` — O'qituvchi batafsil ma'lumoti va uning chop etilgan kurslari.

### 📚 Kurslar va Darslar (/api/v1/courses/)
- `GET /categories/` — Barcha asosiy kategoriyalar ro'yxati.
- `GET /` — Barcha faol (published) kurslar (qidiruv, saralash va filtrlash bilan).
- `GET /{slug}/` — Kurs haqida batafsil ma'lumot, modullar va darslar ro'yxati.
- `POST /{slug}/enroll/` — Bepul kurslarga a'zo bo'lish (yozilish).
- `POST /{slug}/review/` — Tamomlangan kurslar uchun 1-5 gacha reyting va fikr bildirish.
- `GET /lessons/{id}/` — Dars tafsilotlari (video va kontent) — faqat a'zo bo'lganlar yoki bepul preview uchun ochiq.
- `PATCH /lessons/{id}/progress/` — Dars progressini saqlash (ko'rilgan soniyalarni yuborish).
- `GET /certificates/{code}/` — Kurs sertifikatini kodi orqali tekshirish va ko'rish (ommaviy).

### 🎓 Talaba boshqaruv paneli (/api/v1/student/)
- `GET /student/enrollments/` — Talabaning barcha yozilgan kurslari ro'yxati (tugallangan yoki davom etayotgan bo'yicha filtrlanadi).
- `GET /api/v1/student/dashboard/` — Talaba dashboard ma'lumotlari (o'qish statistikasi, haftalik faollik grafigi soniyalarda, streaklar, faol kurslar va sertifikatlar).

### 👨‍🏫 O'qituvchi boshqaruv paneli (/api/v1/courses/teacher/)
- `GET /teacher/dashboard/` — O'qituvchi boshqaruv paneli (umumiy daromad, tasdiqlangan to'lovlar, o'quvchilar soni, so'nggi 6 oylik daromad va oxirgi 10 ta yozilishlar).
- `GET /teacher/courses/` — O'qituvchining o'z kurslari va ularning har birining batafsil statistikasi.
- `POST /teacher/courses/create/` — Yangi kurs yaratish (draft holatida).
- `PATCH /teacher/courses/{slug}/update/` — O'z kursini tahrirlash (nomi, narxi, darajasi va h.k.).
- `POST /teacher/courses/{slug}/modules/` — Kursga yangi modul qo'shish.
- `POST /teacher/modules/{id}/lessons/` — Modulga yangi dars yuklash.
