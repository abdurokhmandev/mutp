from .base import *

DEBUG = True

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Dev rejimida login cheklovini yumshatish
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login'] = '100/minute'
