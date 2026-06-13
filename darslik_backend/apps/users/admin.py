from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, TeacherProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ['email', 'username', 'first_name', 'last_name', 'role', 'is_verified', 'created_at']
    list_filter   = ['role', 'is_verified', 'is_active']
    search_fields = ['email', 'username', 'first_name', 'last_name', 'phone']
    ordering      = ['-created_at']
    actions       = ['verify_teachers', 'deactivate_users']

    # Custom fieldsets for our custom fields
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Custom Fields', {'fields': ('role', 'avatar', 'phone', 'bio', 'telegram_id', 'is_verified')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Custom Fields', {'fields': ('role', 'avatar', 'phone', 'bio', 'telegram_id', 'is_verified')}),
    )

    def verify_teachers(self, request, queryset):
        updated = queryset.filter(role=User.Role.TEACHER).update(is_verified=True)
        self.message_user(request, f"{updated} o'qituvchilar muvaffaqiyatli tasdiqlandi.")
    verify_teachers.short_description = "O'qituvchilarni tasdiqlash"

    def deactivate_users(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f"{updated} foydalanuvchilar faolsizlantirildi.")
    deactivate_users.short_description = "Foydalanuvchilarni faolsizlantirish"


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display  = ['user', 'specialization', 'experience_years', 'total_earnings', 'average_rating']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['average_rating', 'total_students']
