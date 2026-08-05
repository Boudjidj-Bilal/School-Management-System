"""
    Ce fichier centralise les fonctions utilitaires de l'application 'subjects'.

    Il agit comme une couche de service entre les vues et les modèles/managers.
    Cela permet de séparer la logique métier de la logique de l'API,
    rendant le code plus propre, plus maintenable et plus facile à tester.
"""

from django.core.exceptions import ObjectDoesNotExist
from schools.models import School
from users.models import Staff
from .models import Subject, TeacherSubject

from django.utils.translation import gettext_lazy as _

"""
======================
GESTION DES MATIERES :
======================
"""

# --- Fonctions CRUD pour la classe Subject ---

def create_subject(name, color, school_id, is_active=True):
    """
    Crée et enregistre une nouvelle matière scolaire.

    Args:
        name (str): Le nom de la matière.
        color (str): La couleur associée (ex: 'RED').
        school_id (int): L'ID de l'école à laquelle la matière est liée.
        is_active (bool, optional): Indique si la matière est active. Par défaut, True.

    Returns:
        tuple: (Subject, str) - L'objet Subject créé ou un message d'erreur.
    """
    try:
        school = School.objects.get(id=school_id)
        subject = Subject.objects.create(
            name=name,
            color=color,
            is_active=is_active,
            school=school
        )
        return subject, None
    except ObjectDoesNotExist:
        return None, _("Erreur: L'école spécifiée n'existe pas.")
    except Exception as e:
        return None, _("Erreur lors de la création de la matière : {error}").format(error=str(e))

def get_subject_by_id(subject_id):
    """
    Récupère une matière scolaire par son ID.

    Args:
        subject_id (int): L'ID de la matière.

    Returns:
        Subject: L'objet Subject ou None si non trouvé.
    """
    try:
        return Subject.objects.get(id=subject_id)
    except Subject.DoesNotExist:
        return None

def get_subjects_by_school(school_id):
    """
    Récupère toutes les matières d'une école spécifique.

    Args:
        school_id (int): L'ID de l'école.

    Returns:
        QuerySet: Un QuerySet des objets Subject correspondants.
    """
    try:
        school = School.objects.get(id=school_id)
        return Subject.objects.filter(school=school)
    except ObjectDoesNotExist:
        return Subject.objects.none()

def update_subject(subject_id, **kwargs):
    """
    Met à jour les informations d'une matière scolaire.

    Args:
        subject_id (int): L'ID de la matière à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: name='Physique-Chimie').

    Returns:
        tuple: (Subject, str) - L'objet Subject mis à jour ou un message d'erreur.
    """
    try:
        subject = Subject.objects.get(id=subject_id)
        for key, value in kwargs.items():
            setattr(subject, key, value)
        subject.save()
        return subject, None
    except Subject.DoesNotExist:
        return None, _("Erreur: La matière spécifiée n'existe pas.")
    except Exception as e:
        return None, _("Erreur lors de la mise à jour de la matière : {error}").format(error=str(e))

def delete_subject(subject_id):
    """
    Supprime une matière scolaire par son ID.

    Args:
        subject_id (int): L'ID de la matière à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        subject = Subject.objects.get(id=subject_id)
        subject.delete()
        return True
    except Subject.DoesNotExist:
        return False
    except Exception:
        return False


"""
===============================================
GESTION DES AFFECTATIONS PROFESSEURS-MATIERES :
===============================================
"""

# --- Fonctions CRUD pour la classe TeacherSubject ---

def create_teacher_subject(subject_id, teacher_id, is_active=True):
    """
    Crée et enregistre une nouvelle affectation de professeur à une matière.

    Args:
        subject_id (int): L'ID de la matière.
        teacher_id (int): L'ID du professeur.
        is_active (bool, optional): Indique si l'affectation est active. Par défaut, True.

    Returns:
        tuple: (TeacherSubject, str) - L'objet TeacherSubject créé ou un message d'erreur.
    """
    try:
        subject = Subject.objects.get(id=subject_id)
        teacher = Staff.objects.get(id=teacher_id)
        
        assignment = TeacherSubject.objects.create(
            subject=subject,
            teacher=teacher,
            is_active=is_active
        )
        return assignment, None
    except ObjectDoesNotExist as e:
        return None, _("Erreur: L'objet spécifié n'existe pas. Détails: {error}").format(error=str(e))
    except Exception as e:
        return None, _("Erreur lors de la création de l'affectation : {error}").format(error=str(e))

def get_teacher_subject_by_id(assignment_id):
    """
    Récupère une affectation professeur-matière par son ID.

    Args:
        assignment_id (int): L'ID de l'affectation.

    Returns:
        TeacherSubject: L'objet TeacherSubject ou None si non trouvé.
    """
    try:
        return TeacherSubject.objects.get(id=assignment_id)
    except TeacherSubject.DoesNotExist:
        return None

def get_subjects_by_teacher(teacher_id):
    """
    Récupère toutes les matières qu'un professeur enseigne.

    Args:
        teacher_id (int): L'ID du professeur.

    Returns:
        QuerySet: Un QuerySet des objets Subject.
    """
    try:
        return Subject.objects.filter(
            teacher_subjects__teacher_id=teacher_id,
            teacher_subjects__is_active=True
        )
    except Exception:
        return Subject.objects.none()

def get_teachers_by_subject(subject_id):
    """
    Récupère tous les professeurs qui enseignent une matière donnée.

    Args:
        subject_id (int): L'ID de la matière.

    Returns:
        QuerySet: Un QuerySet des objets Staff.
    """
    try:
        return Staff.objects.filter(
            teacher_subjects__subject_id=subject_id,
            teacher_subjects__is_active=True
        )
    except Exception:
        return Staff.objects.none()

def update_teacher_subject(assignment_id, **kwargs):
    """
    Met à jour les informations d'une affectation professeur-matière.

    Args:
        assignment_id (int): L'ID de l'affectation à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: is_active=False).

    Returns:
        tuple: (TeacherSubject, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        assignment = TeacherSubject.objects.get(id=assignment_id)
        for key, value in kwargs.items():
            setattr(assignment, key, value)
        assignment.save()
        return assignment, None
    except TeacherSubject.DoesNotExist:
        return None, _("Erreur: L'affectation spécifiée n'existe pas.")
    except Exception as e:
        return None, _("Erreur lors de la mise à jour de l'affectation : {error}").format(error=str(e))

def delete_teacher_subject(assignment_id):
    """
    Supprime une affectation professeur-matière par son ID.

    Args:
        assignment_id (int): L'ID de l'affectation à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        assignment = TeacherSubject.objects.get(id=assignment_id)
        assignment.delete()
        return True
    except TeacherSubject.DoesNotExist:
        return False
    except Exception:
        return False
