from django.conf import settings
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, TeacherProfile


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    role = serializers.ChoiceField(choices=[User.Role.STUDENT, User.Role.TEACHER], default=User.Role.STUDENT)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'password', 'password2', 'role']
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password2": "Parollar mos kelmadi."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        role = validated_data.get('role', User.Role.STUDENT)
        
        # Set username as email
        email = validated_data['email']
        username = email
        
        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=role
        )
        # Dev rejimida o'qituvchilarni avtomatik tasdiqlash
        if role == User.Role.TEACHER and settings.DEBUG:
            user.is_verified = True
            user.save(update_fields=['is_verified'])
        return user


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(request=self.context.get('request'), email=email, password=password)
            if not user:
                raise serializers.ValidationError("Email yoki parol xato.")
            if not user.is_active:
                raise serializers.ValidationError("Foydalanuvchi hisobi faol emas.")
        else:
            raise serializers.ValidationError("Email va parol kiritilishi shart.")

        attrs['user'] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)
    is_verified = serializers.BooleanField(read_only=True)
    avatar = serializers.SerializerMethodField()

    # O'qituvchi uchun qo'shimcha maydonlar (ixtiyoriy)
    specialization = serializers.CharField(required=False, allow_blank=True)
    experience_years = serializers.IntegerField(required=False, min_value=0)
    bank_card = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    interests = serializers.CharField(required=False, allow_blank=True)
    found_source = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'first_name', 'last_name', 'email', 'role', 
            'avatar', 'phone', 'bio', 'is_verified', 'profile_complete',
            'specialization', 'experience_years', 'bank_card', 'address', 'interests', 'found_source'
        ]
        read_only_fields = ['id', 'email', 'role', 'is_verified']


    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        if request is not None:
            return request.build_absolute_uri(obj.avatar.url)
        return obj.avatar.url

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.role == User.Role.TEACHER:
            profile = getattr(instance, 'teacher_profile', None)
            if profile:
                data['specialization'] = profile.specialization
                data['experience_years'] = profile.experience_years
                data['bank_card'] = profile.bank_card
                data['address'] = profile.address
                data['interests'] = profile.interests
                data['found_source'] = profile.found_source
                data['average_rating'] = profile.average_rating
                data['total_students'] = profile.total_students
                data['total_earnings'] = float(profile.total_earnings)
                data['pending_payout'] = float(profile.pending_payout)
        return data

    def update(self, instance, validated_data):
        # O'qituvchi maydonlarini ajratib olish
        specialization = validated_data.pop('specialization', None)
        experience_years = validated_data.pop('experience_years', None)
        bank_card = validated_data.pop('bank_card', None)
        address = validated_data.pop('address', None)
        interests = validated_data.pop('interests', None)
        found_source = validated_data.pop('found_source', None)

        user = super().update(instance, validated_data)

        if user.role == User.Role.TEACHER:
            profile, _ = TeacherProfile.objects.get_or_create(user=user)
            if specialization is not None:
                profile.specialization = specialization
            if experience_years is not None:
                profile.experience_years = experience_years
            if bank_card is not None:
                profile.bank_card = bank_card
            if address is not None:
                profile.address = address
            if interests is not None:
                profile.interests = interests
            if found_source is not None:
                profile.found_source = found_source
            profile.save()

        return user



class TeacherProfileSerializer(serializers.ModelSerializer):
    user_details = UserProfileSerializer(source='user', read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    total_students = serializers.IntegerField(read_only=True)
    courses_count = serializers.SerializerMethodField()

    class Meta:
        model = TeacherProfile
        fields = [
            'id', 'user_details', 'specialization', 'experience_years',
            'average_rating', 'total_students', 'courses_count', 'total_earnings', 'pending_payout', 'bank_card'
        ]
        read_only_fields = ['id', 'total_earnings', 'pending_payout']

    def get_courses_count(self, obj):
        from apps.courses.models import Course
        return Course.objects.filter(teacher=obj.user, status=Course.Status.PUBLISHED).count()



class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Eski parol xato kiritildi.")
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password2": "Yangi parollar mos kelmadi."})
        return attrs
