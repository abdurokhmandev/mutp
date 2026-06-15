from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView

from apps.core.utils import success_response, error_response
from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import User, TeacherProfile, TelegramUser, PhoneOTP
from .serializers import (
    UserRegisterSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    TeacherProfileSerializer,
    ChangePasswordSerializer
)
from .otp import format_phone, send_otp, verify_otp


from apps.users.utils import normalize_phone

class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_phone = request.data.get('phone', '')
        phone = normalize_phone(raw_phone)

        # Validatsiya
        if len(phone) != 12 or not phone.startswith('998'):
            return error_response(
                "Telefon raqam noto'g'ri. "
                "To'g'ri format: 901234567"
            )

        # Spam himoya: 1 daqiqada 1 marta
        from datetime import timedelta
        recent = PhoneOTP.objects.filter(
            phone=phone,
            created_at__gte=timezone.now() - timedelta(minutes=1)
        ).exists()

        if recent:
            return error_response(
                "Iltimos, 1 daqiqa kuting va qayta urinib ko'ring.",
                status_code=429
            )

        # OTP yaratish (eski kodlar o'chadi)
        PhoneOTP.generate(phone)

        # Bot URL
        bot_url = (
            f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}"
            f"?start={phone}"
        )

        return success_response({
            'phone':           phone,
            'bot_url':         bot_url,
            'expires_minutes': 5,
        }, "Telegram botdan kod oling")


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = normalize_phone(request.data.get('phone', ''))
        code  = str(request.data.get('code', '')).strip()

        # Kod kiritilganmi?
        if not code or len(code) != 6:
            return error_response("6 xonali kodni kiriting")

        # Bazadan topish
        otp = PhoneOTP.objects.filter(
            phone=phone,
            is_used=False
        ).order_by('-created_at').first()

        if not otp:
            return error_response(
                "Kod topilmadi. "
                "Yangi kod so'rang."
            )

        # Urinish sanagich
        otp.attempts += 1
        otp.save(update_fields=['attempts'])

        # Yaroqliligini tekshirish
        if not otp.is_valid:
            if otp.attempts >= 3:
                return error_response(
                    "3 marta noto'g'ri kiritildi. "
                    "Yangi kod so'rang."
                )
            return error_response(
                "Kod muddati o'tgan (5 daqiqa). "
                "Yangi kod so'rang."
            )

        # Kod to'g'rimi?
        if otp.code != code:
            remaining = 3 - otp.attempts
            if remaining > 0:
                return error_response(
                    f"Kod noto'g'ri. "
                    f"{remaining} ta urinish qoldi."
                )
            else:
                return error_response(
                    "Urinishlar tugadi. Yangi kod so'rang."
                )

        # ✅ Kod to'g'ri — ishlatilgan deb belgilash
        otp.is_used = True
        otp.save(update_fields=['is_used'])

        # User topish yoki yaratish
        user = User.objects.filter(phone=phone).first()
        is_new = False
        if not user:
            import uuid
            fallback_email = f"user_{uuid.uuid4().hex[:10]}@mutp.local"
            user = User.objects.create_user(
                username=phone,
                email=fallback_email,
                phone=phone,
                role='student',
                is_active=True
            )
            is_new = True

        # Profil to'liqmi?
        profile_complete = bool(user.first_name and user.last_name)

        # Link telegram account if exists
        try:
            tg = TelegramUser.objects.filter(phone=phone).first()
            if tg:
                tg.linked_user = user
                tg.save()
        except Exception:
            pass

        # JWT token
        refresh = RefreshToken.for_user(user)

        return success_response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id':               user.id,
                'phone':            user.phone,
                'full_name':        user.full_name,
                'role':             user.role,
                'is_new':           is_new,
                'profile_complete': profile_complete,
            }
        }, "Muvaffaqiyatli kirdingiz!")


class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = normalize_phone(request.data.get('phone', ''))

        # Spam himoya
        from datetime import timedelta
        recent = PhoneOTP.objects.filter(
            phone=phone,
            created_at__gte=timezone.now() - timedelta(minutes=1)
        ).exists()

        if recent:
            return error_response(
                "Hali 1 daqiqa o'tmadi. Kuting.",
                status_code=429
            )

        PhoneOTP.generate(phone)

        bot_url = (
            f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}"
            f"?start={phone}"
        )

        return success_response({
            'phone':           phone,
            'bot_url':         bot_url,
            'expires_minutes': 5,
        }, "Yangi kod yaratildi. Botdan oling.")


class RegisterCompleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.first_name = request.data.get('first_name', '')
        user.last_name  = request.data.get('last_name', '')
        role = request.data.get('role', 'student')
        if role in ['student', 'teacher']:
            user.role = role
        user.profile_complete = True
        user.save()
        if user.role == 'teacher':
            TeacherProfile.objects.get_or_create(user=user)
        return success_response({'role': user.role}, "Profil saqlandi!")


class LoginRateThrottle(UserRateThrottle):
    scope = 'login'


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            user_data = UserProfileSerializer(user, context={'request': request}).data
            data = {
                "user": user_data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
            return success_response(data=data, message="Ro'yxatdan muvaffaqiyatli o'tildi", status_code=201)
        return error_response(message="Xatolik yuz berdi", errors=serializer.errors, status_code=400)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)
            user_data = UserProfileSerializer(user, context={'request': request}).data
            data = {
                "user": user_data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
            return success_response(data=data, message="Tizimga kirildi", status_code=200)
        return error_response(message="Xatolik yuz berdi", errors=serializer.errors, status_code=400)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return error_response(message="refresh token kiritilishi shart", status_code=400)
            token = RefreshToken(refresh_token)
            token.blacklist()
            return success_response(message="Tizimdan muvaffaqiyatli chiqildi", status_code=200)
        except Exception as e:
            return error_response(message="Token yaroqsiz yoki allaqachon faolsizlantirilgan", errors=str(e), status_code=400)


class TokenRefreshView(SimpleJWTTokenRefreshView):
    """
    Standard SimpleJWT TokenRefreshView
    """
    pass


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return success_response(data=serializer.data, message="Profil ma'lumotlari")

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return success_response(data=serializer.data, message="Profil muvaffaqiyatli yangilandi")
        return error_response(message="Xatolik yuz berdi", errors=serializer.errors, status_code=400)


class UserProfileDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        user = get_object_or_404(User, id=id)
        serializer = UserProfileSerializer(user, context={'request': request})
        return success_response(data=serializer.data, message="Foydalanuvchi profili")


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            request.user.set_password(serializer.validated_data['new_password'])
            request.user.save()
            return success_response(message="Parol muvaffaqiyatli o'zgartirildi")
        return error_response(message="Xatolik yuz berdi", errors=serializer.errors, status_code=400)


class TeacherListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        teachers = TeacherProfile.objects.filter(user__is_verified=True, user__role=User.Role.TEACHER)
        
        # Filter by specialization
        spec = request.query_params.get('specialization')
        if spec:
            teachers = teachers.filter(specialization__icontains=spec)
            
        serializer = TeacherProfileSerializer(teachers, many=True, context={'request': request})
        return success_response(data=serializer.data, message="O'qituvchilar ro'yxati")


class TeacherDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, id):
        try:
            teacher_profile = TeacherProfile.objects.get(user_id=id, user__role=User.Role.TEACHER)
        except TeacherProfile.DoesNotExist:
            return error_response(message="O'qituvchi topilmadi", status_code=404)
        
        # Course serialization done dynamically to prevent circular imports
        from apps.courses.models import Course
        from apps.courses.serializers import CourseListSerializer
        
        courses = Course.objects.filter(teacher=teacher_profile.user, status=Course.Status.PUBLISHED)
        courses_serializer = CourseListSerializer(courses, many=True, context={'request': request})
        
        profile_serializer = TeacherProfileSerializer(teacher_profile, context={'request': request})
        
        data = {
            "profile": profile_serializer.data,
            "courses": courses_serializer.data
        }
        return success_response(data=data, message="O'qituvchi batafsil ma'lumotlari")


class SaveTelegramUserView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        bot_token = request.headers.get('X-Bot-Token')
        expected_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        if not bot_token or bot_token != expected_token:
            return error_response(message="Unauthorized", status_code=401)

        chat_id = request.data.get('chat_id')
        phone = request.data.get('phone')
        username = request.data.get('username', '')
        first_name = request.data.get('first_name', '')

        if not chat_id or not phone:
            return error_response(message="chat_id va phone kiritilishi shart", status_code=400)

        from .otp import format_phone
        phone = format_phone(phone)
        tg_user, created = TelegramUser.objects.update_or_create(
            chat_id=chat_id,
            defaults={
                'phone': phone,
                'username': username or '',
                'first_name': first_name or '',
            }
        )
        return success_response(
            data={'created': created, 'id': tg_user.id},
            message="Telegram user saqlandi"
        )


class GetOTPFromBotView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        bot_token = request.headers.get('X-Bot-Token')
        expected_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        if not bot_token or bot_token != expected_token:
            return error_response(message="Unauthorized", status_code=401)

        phone = normalize_phone(request.data.get('phone', ''))
        telegram_id = str(request.data.get('telegram_id', ''))
        username = request.data.get('username', '')
        first_name = request.data.get('first_name', '')

        if not phone or not telegram_id:
            return error_response(message="phone va telegram_id kiritilishi shart", status_code=400)

        # Bazadan faol OTP topish
        otp = PhoneOTP.objects.filter(
            phone=phone,
            is_used=False
        ).order_by('-created_at').first()

        # TelegramUser jadvaliga saqlab qo'yamiz/yangilaymiz
        TelegramUser.objects.update_or_create(
            chat_id=int(telegram_id),
            defaults={
                'phone': phone,
                'username': username or '',
                'first_name': first_name or '',
            }
        )

        if otp and otp.is_valid:
            # Telegram ID ni saqlash
            User.objects.filter(phone=phone).update(
                telegram_id=telegram_id
            )
            return success_response({
                'code': otp.code
            }, "Faol OTP topildi")
        else:
            return error_response("Bu raqam uchun faol kod topilmadi.", status_code=404)
