from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView

from apps.core.utils import success_response, error_response
from .models import User, TeacherProfile
from .serializers import (
    UserRegisterSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    TeacherProfileSerializer,
    ChangePasswordSerializer
)


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
