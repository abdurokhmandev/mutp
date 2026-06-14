from django.db import models
from django.conf import settings

class Channel(models.Model):
    """
    Kanal — guruh yoki shaxsiy chat uchun konteyner.
    Slack'dagi #general, #python-kurs kabi.
    """
    class ChannelType(models.TextChoices):
        DIRECT = 'direct', 'Shaxsiy chat'
        COURSE = 'course', 'Kurs guruhi'
        CUSTOM = 'custom', 'Maxsus guruh'

    name         = models.CharField(max_length=100, blank=True)
    channel_type = models.CharField(max_length=10, choices=ChannelType)
    course       = models.ForeignKey(
                     'courses.Course', null=True, blank=True,
                     on_delete=models.CASCADE, related_name='channels'
                   )
    creator      = models.ForeignKey(
                     settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                     null=True, related_name='created_channels'
                   )
    members      = models.ManyToManyField(
                     settings.AUTH_USER_MODEL, related_name='channels',
                     through='ChannelMember'
                   )
    description  = models.TextField(blank=True)
    is_archived  = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Kanal"

    def __str__(self):
        return self.name or f"{self.channel_type} #{self.pk}"


class ChannelMember(models.Model):
    """Kanalga a'zolik + rol"""
    class Role(models.TextChoices):
        ADMIN  = 'admin',  'Admin'
        MEMBER = 'member', "A'zo"

    channel   = models.ForeignKey(Channel, on_delete=models.CASCADE)
    user      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role      = models.CharField(max_length=10, choices=Role, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['channel', 'user']


class Message(models.Model):
    """Kanal ichidagi xabar"""
    class MessageType(models.TextChoices):
        TEXT   = 'text',   'Matn'
        FILE   = 'file',   'Fayl'
        IMAGE  = 'image',  'Rasm'
        SYSTEM = 'system', 'Tizim xabari'

    channel      = models.ForeignKey(
                     Channel, on_delete=models.CASCADE, related_name='messages'
                   )
    sender       = models.ForeignKey(
                     settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                     null=True, related_name='sent_messages'
                   )
    message_type = models.CharField(
                     max_length=10, choices=MessageType, default=MessageType.TEXT
                   )
    text         = models.TextField(blank=True)
    file         = models.FileField(
                     upload_to='chat/files/%Y/%m/', blank=True, null=True
                   )
    file_name    = models.CharField(max_length=255, blank=True)
    file_size    = models.PositiveIntegerField(null=True, blank=True)
    parent       = models.ForeignKey(
                     'self', null=True, blank=True,
                     on_delete=models.SET_NULL, related_name='replies'
                   )
    is_edited    = models.BooleanField(default=False)
    edited_at    = models.DateTimeField(null=True, blank=True)
    is_deleted   = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = "Xabar"

    def __str__(self):
        return f"{self.sender} → #{self.channel}: {self.text[:50]}"


class MessageReaction(models.Model):
    """Emoji reakciyalar — 👍 ❤️ 😂 😮 😢"""
    message = models.ForeignKey(
                Message, on_delete=models.CASCADE, related_name='reactions'
              )
    user    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji   = models.CharField(max_length=10)

    class Meta:
        unique_together = ['message', 'user', 'emoji']
