# api/urls.py
from django.urls import path

# Liste des URL pour l’API (vide pour l’instant)
urlpatterns = []

"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

# Routers descendants par app
from users.urls import router as users_router
from schools.urls import router as schools_router
from classes.urls import router as classes_router
from subjects.urls import router as subjects_router
from scheduling.urls import router as scheduling_router
from grades.urls import router as grades_router
from attendance.urls import router as attendance_router
from communications.urls import router as communications_router
from documents.urls import router as documents_router
from notifications.urls import router as notifications_router

router = DefaultRouter()
router.registry.extend(users_router.registry)
router.registry.extend(schools_router.registry)
router.registry.extend(classes_router.registry)
router.registry.extend(subjects_router.registry)
router.registry.extend(scheduling_router.registry)
router.registry.extend(grades_router.registry)
router.registry.extend(attendance_router.registry)
router.registry.extend(communications_router.registry)
router.registry.extend(documents_router.registry)
router.registry.extend(notifications_router.registry)

urlpatterns = [
    path("", include(router.urls)),
]
"""