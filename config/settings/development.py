from .base import *

# ============================================
# إعدادات البريد الإلكتروني الحقيقي (Gmail SMTP)
# ============================================

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True

# 1️⃣ السماح بجميع الـ IPs للوصول من الشبكة المحلية والموبايل
ALLOWED_HOSTS = ['*']

EMAIL_HOST_USER = 'mymoney3699@gmail.com'
EMAIL_HOST_PASSWORD = 'szcy wyrg xaor hvju'

DEFAULT_FROM_EMAIL = f'منظومة كلية طرابلس <{EMAIL_HOST_USER}>'

# 2️⃣ الدومين الافتراضي للنظام
DOMAIN_NAME = '127.0.0.1:8000'
SITE_DOMAIN = 'http://127.0.0.1:8000'

# 3️⃣ Content Security Policy (CSP) - السماح بـ eval والسكربتات في بيئة التطوير
CSP_DEFAULT_SRC = ("'self'", "'unsafe-inline'", "'unsafe-eval'", "*")
CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:", "*")
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'", "https:", "http:", "*")
CSP_IMG_SRC = ("'self'", "data:", "blob:", "https:", "http:", "*")
CSP_CONNECT_SRC = ("'self'", "https:", "http:", "ws:", "wss:", "*")

