# ProjectSchool/ProjectSchool/settings.py
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "change-me"
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

STATIC_URL = '/static/'

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

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
]

SITE_ID = 1
AUTH_USER_MODEL = "users.User"


# Définit la durée de vie maximale d'une session utilisateur à 10 minutes sans activité (600 secondes)
SESSION_COOKIE_AGE = 600

# Prolonge la session à chaque requête de l'utilisateur,
# ce qui gère la déconnexion après inactivité.
SESSION_SAVE_EVERY_REQUEST = True

# Paramètres du backend d'envoi d'emails
# Utilisez le backend SMTP de Django
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

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

ACCOUNT_AUTHENTICATION_METHOD = "username"
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = "optional"

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
        ],
    },
}]

WSGI_APPLICATION = "ProjectSchool.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",  # swap to postgres in prod
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Paris"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Chemin de base pour les fichiers multimédia (uploads)
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# URL publique pour accéder aux fichiers multimédia
MEDIA_URL = '/media/'