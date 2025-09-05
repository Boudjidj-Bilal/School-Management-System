"""
    Ce fichier centralise les fonctions utilitaires de l'application 'attendance'.

    Il agit comme une couche de service entre les vues et les modèles/managers.
    Cela permet de séparer la logique métier de la logique de l'API,
    rendant le code plus propre, plus maintenable et plus facile à tester.
"""

from django.core.exceptions import ObjectDoesNotExist
from schools.models import TermYearLevel
from users.models import Student
from scheduling.models import Course
from .models import Attendance

"""
=======================
GESTION DES PRESENCES :
=======================
"""

# --- Fonctions CRUD pour la classe Attendance ---

def create_attendance(student_id, course_id, term_year_id, attendance_type, justified=True):
    """
    Crée et enregistre une nouvelle entrée de présence (absence ou retard) pour un élève.

    Args:
        student_id (int): L'ID de l'élève.
        course_id (int): L'ID du cours.
        term_year_id (int): L'ID du trimestre/semestre.
        attendance_type (str): Le type de présence ('ABSENCE' ou 'DELAY').
        justified (bool, optional): Indique si l'absence ou le retard est justifié. 
                                    Par défaut, True.

    Returns:
        tuple: (Attendance, str) - L'objet Attendance créé ou un message d'erreur.
    """
    try:
        student = Student.objects.get(id=student_id)
        course = Course.objects.get(id=course_id)
        term_year = TermYearLevel.objects.get(id=term_year_id)

        attendance = Attendance.objects.create(
            student=student,
            course=course,
            term_year=term_year,
            type=attendance_type,
            justified=justified
        )
        return attendance, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet spécifié n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de la présence : {str(e)}"

def get_attendance_by_id(attendance_id):
    """
    Récupère une entrée de présence par son ID.

    Args:
        attendance_id (int): L'ID de l'entrée de présence.

    Returns:
        Attendance: L'objet Attendance ou None si non trouvé.
    """
    try:
        return Attendance.objects.get(id=attendance_id)
    except Attendance.DoesNotExist:
        return None

def get_attendance_by_student_and_term(student_id, term_year_id):
    """
    Récupère toutes les présences (absences et retards) pour un élève 
    pendant un trimestre/semestre donné.

    Args:
        student_id (int): L'ID de l'élève.
        term_year_id (int): L'ID du trimestre/semestre.

    Returns:
        QuerySet: Un QuerySet des objets Attendance correspondants.
    """
    try:
        return Attendance.objects.filter(
            student_id=student_id,
            term_year_id=term_year_id
        )
    except Exception:
        return Attendance.objects.none()

def update_attendance(attendance_id, **kwargs):
    """
    Met à jour les informations d'une entrée de présence.

    Args:
        attendance_id (int): L'ID de l'entrée de présence à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: justified=False).

    Returns:
        tuple: (Attendance, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        attendance = Attendance.objects.get(id=attendance_id)
        for key, value in kwargs.items():
            setattr(attendance, key, value)
        attendance.save()
        return attendance, None
    except Attendance.DoesNotExist:
        return None, "Erreur: L'entrée de présence spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de la présence : {str(e)}"

def delete_attendance(attendance_id):
    """
    Supprime une entrée de présence par son ID.

    Args:
        attendance_id (int): L'ID de l'entrée de présence à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        attendance = Attendance.objects.get(id=attendance_id)
        attendance.delete()
        return True
    except Attendance.DoesNotExist:
        return False
    except Exception:
        return False
