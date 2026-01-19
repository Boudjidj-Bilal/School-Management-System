# ProjectSchool/ProjectSchool/settings.py
from pathlib import Path
import os
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

# -------------------------
# Security - Variables d'environnement
# -------------------------
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS', 
    default='localhost,127.0.0.1', 
    cast=lambda v: [s.strip() for s in v.split(',')]
)


INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",

    # Third-party
    "rest_framework",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "rest_framework.authtoken",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "crispy_forms",
    "crispy_bootstrap5",

    # Local apps
    "api",
    "schools",
    "users",
    "classes",
    "subjects",
    "scheduling",
    "grades",
    "attendance",
    "communications",
    "documents",
    "notifications",
    "accounts",
]

SITE_ID = 1
AUTH_USER_MODEL = "users.User"


# Définit la durée de vie maximale d'une session utilisateur à 10 minutes sans activité (600 secondes)
SESSION_COOKIE_AGE = 600

# Prolonge la session à chaque requête de l'utilisateur,
# ce qui gère la déconnexion après inactivité.
SESSION_SAVE_EVERY_REQUEST = True

EMAIL_BACKEND_CHOICE = config('EMAIL_BACKEND', default='console').upper()

# Configuration du backend selon le choix
if EMAIL_BACKEND_CHOICE == 'CONSOLE':
    # Backend console (développement)
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = 'noreply@localhost'
    SUPPORT_EMAIL = 'support@localhost'
    
elif EMAIL_BACKEND_CHOICE == 'MAILEROO':
    # Backend Maileroo (API)
    EMAIL_BACKEND = 'accounts.backends.MailerooBackend'
    MAILEROO_API_KEY = config('EMAIL_MAILEROO_API_KEY')
    DEFAULT_FROM_EMAIL = config('EMAIL_MAILEROO_DEFAULT_FROM_EMAIL')
    SUPPORT_EMAIL = config('EMAIL_MAILEROO_SUPPORT_EMAIL', default=DEFAULT_FROM_EMAIL)
    
elif EMAIL_BACKEND_CHOICE == 'GMAIL':
    # Backend Gmail (SMTP)
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = config('EMAIL_GMAIL_HOST')
    EMAIL_PORT = config('EMAIL_GMAIL_PORT', cast=int)
    EMAIL_USE_TLS = config('EMAIL_GMAIL_USE_TLS', cast=bool)
    EMAIL_USE_SSL = config('EMAIL_GMAIL_USE_SSL', default=False, cast=bool)
    EMAIL_HOST_USER = config('EMAIL_GMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = config('EMAIL_GMAIL_HOST_PASSWORD')
    DEFAULT_FROM_EMAIL = config('EMAIL_GMAIL_DEFAULT_FROM_EMAIL')
    SUPPORT_EMAIL = config('EMAIL_GMAIL_SUPPORT_EMAIL', default=DEFAULT_FROM_EMAIL)
    EMAIL_TIMEOUT = 300
    
elif EMAIL_BACKEND_CHOICE == 'YAHOO':
    # Backend Yahoo (SMTP)
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = config('EMAIL_YAHOO_HOST')
    EMAIL_PORT = config('EMAIL_YAHOO_PORT', cast=int)
    EMAIL_USE_TLS = config('EMAIL_YAHOO_USE_TLS', cast=bool)
    EMAIL_USE_SSL = config('EMAIL_YAHOO_USE_SSL', default=False, cast=bool)
    EMAIL_HOST_USER = config('EMAIL_YAHOO_HOST_USER')
    EMAIL_HOST_PASSWORD = config('EMAIL_YAHOO_HOST_PASSWORD')
    DEFAULT_FROM_EMAIL = config('EMAIL_YAHOO_DEFAULT_FROM_EMAIL')
    SUPPORT_EMAIL = config('EMAIL_YAHOO_SUPPORT_EMAIL', default=DEFAULT_FROM_EMAIL)
    EMAIL_TIMEOUT = 300
    
else:
    # Fallback sur console
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = 'noreply@localhost'
    SUPPORT_EMAIL = 'support@localhost'

# Le serveur SMTP de Gmail
EMAIL_HOST = 'smtp.gmail.com'

# Le port TLS/STARTTLS de Gmail
EMAIL_PORT = 587

# Nécessaire pour les connexions sécurisées avec TLS
EMAIL_USE_TLS = True

# Votre adresse email Gmail (expéditeur)
# Les valeurs sont lues depuis le fichier .env
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')

# Votre mot de passe d'application Gmail ou mot de passe standard
# Les valeurs sont lues depuis le fichier .env
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')

AUTHENTICATION_BACKENDS = (
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
)

# ACCOUNT_AUTHENTICATION_METHOD = "username"
ACCOUNT_LOGIN_METHODS = {'username'}
# ACCOUNT_EMAIL_REQUIRED = True
# ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = 'optional'

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # Doit être en premier pour CORS
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = "ProjectSchool.urls"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [os.path.join(BASE_DIR, 'templates')],
    "APP_DIRS": True,
    "OPTIONS": {
        "context_processors": [
            "django.template.context_processors.debug",
            "django.template.context_processors.request",
            "django.contrib.auth.context_processors.auth",
            "django.contrib.messages.context_processors.messages",
            'users.context_processors.user_roles', # Pour faire des vérifications en fonction du rôle de l'utilisateur dans les pages du sites
            'schools.context_processors.school_context', 

        ],
    },
  },
]

WSGI_APPLICATION = "ProjectSchool.wsgi.application"


DEBUG = config('DEBUG', default=True, cast=bool)

if DEBUG:
    # Mode développement → SQLite par défaut
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    # Mode production → Config via .env
    DB_ENGINE = config('DB_ENGINE', default='django.db.backends.postgresql')
    DB_NAME = config('DB_NAME', default='')
    DB_USER = config('DB_USER', default='')
    DB_PASSWORD = config('DB_PASSWORD', default='')
    DB_HOST = config('DB_HOST', default='')
    DB_PORT = config('DB_PORT', default='')

    DATABASES = {
        'default': {
            'ENGINE': DB_ENGINE,
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
            # Options spécifiques selon le moteur
            'OPTIONS': (
                {
                    # MySQL
                    'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
                    'charset': 'utf8mb4',
                }
                if DB_ENGINE.endswith('mysql')
                else (
                    {
                        # PostgreSQL → schema dédié
                        'options': f"-c search_path={config('DB_SCHEMA', default='public')}"
                    }
                    if DB_ENGINE.endswith('postgresql')
                    else {}
                )
            ),
            # Pool de connexions : activé en prod, désactivé en debug
            'CONN_MAX_AGE': 60,
        }
    }


# LANGUAGE_CODE = "en-us"
LANGUAGE_CODE = "fr-fr"

TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Chemin de base pour les fichiers multimédia (uploads)
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# URL publique pour accéder aux fichiers multimédia
MEDIA_URL = '/media/'

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# -------------------------
# Static files - Configuration production
# -------------------------
STATIC_URL = '/static/'

# Dossier de collecte pour la production (utilisé par Nginx)
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Dossiers sources optionnels (si vous avez des fichiers personnalisés)
# ⚠️ Ne créez ce dossier QUE si vous avez des fichiers statiques personnalisés
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []


# -------------------------
# Configuration commune
CORS_ALLOW_CREDENTIALS = True  # Nécessaire pour les cookies HttpOnly
CORS_ALLOWED_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

if DEBUG:
    # Développement : HTTP autorisé
    CORS_ALLOWED_ORIGINS = [
        "https://neurotex.shop"
    ]
    CORS_ALLOW_CREDENTIALS = True
else:
    # Production : HTTPS uniquement
    FRONTEND_URL_CONFIG = config('FRONTEND_URL', default='https://neurotex.shop')
    
    CORS_ALLOWED_ORIGINS = [
        FRONTEND_URL_CONFIG,
        "https://neurotex.shop",
        "https://www.neurotex.shop",
        # Ajoutez d'autres domaines si nécessaire
    ]
    
    CORS_ALLOW_CREDENTIALS = True
    
    # ⚠️ IMPORTANT pour les cookies cross-origin HTTPS
    CORS_ALLOW_HEADERS = list(CORS_ALLOWED_HEADERS) + [
        'cookie',
        'set-cookie',
    ]

# -------------------------
# Security headers - Configuration complète
# -------------------------
# Protection XSS
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# Frames et référents
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# Configuration SSL conditionnelle
if not DEBUG:
    # Production : SSL obligatoire

    # Force HTTPS uniquement si derrière un proxy
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    
    # Ne PAS forcer la redirection HTTPS si Nginx le fait déjà
    SECURE_SSL_REDIRECT = False  # ← Nginx gère les redirections HTTP→HTTPS

    SECURE_HSTS_SECONDS = 31536000  # 1 an
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True


    # Cookies sécurisés
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    

else:
    # Développement : pas de SSL
    SECURE_SSL_REDIRECT = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

# IMPORTANT : Trusted origins pour HTTPS + reverse proxy
CSRF_TRUSTED_ORIGINS = (
    ["http://localhost:8000", "http://127.0.0.1:8000"] if DEBUG 
    else [
        "https://theranotes-tsr.com",
    ]
)

# -------------------------
# Cookies configuration pour l'authentification
# -------------------------
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"

# Configuration spécifique pour nos cookies API
API_COOKIE_SECURE = not DEBUG
API_COOKIE_SAMESITE = "Lax" if DEBUG else "None"

# Durée de vie des sessions
SESSION_COOKIE_AGE = 86400  # 24 heures

