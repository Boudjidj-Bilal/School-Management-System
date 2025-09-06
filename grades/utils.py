
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import QuerySet
from .models import Grade, Appreciation, Mention
from users.models import Student
from schools.models import TermYearLevel
from scheduling.models import Course
from subjects.models import TeacherSubject

"""
    Ce fichier centralise les fonctions utilitaires de l'application 'grades'.

    Il gère la logique métier liée aux notes, aux appréciations et aux mentions des élèves.
"""

"""
===================
GESTION DES NOTES :
===================
"""

def create_grade(student_id: int, course_id: int, term_year_id: int, grade_value: float, name: str, coefficient: float = 1.0, is_absent: bool = False):
    """
    Crée et enregistre une nouvelle note pour un élève dans un cours.

    Args:
        student_id (int): L'ID de l'élève.
        course_id (int): L'ID du cours.
        term_year_id (int): L'ID du trimestre/semestre/année.
        grade_value (float): La valeur de la note.
        name (str): Le nom de l'évaluation.
        coefficient (float, optional): Le coefficient. Par défaut à 1.0.
        is_absent (bool, optional): Indique si l'élève était absent. Par défaut à False.

    Returns:
        tuple: (Grade, str) - L'objet Grade créé ou un message d'erreur.
    """
    try:
        student = Student.objects.get(id=student_id)
        course = Course.objects.get(id=course_id)
        term_year = TermYearLevel.objects.get(id=term_year_id)

        grade = Grade.objects.create(
            student=student,
            course=course,
            term_year=term_year,
            grade_value=grade_value,
            name=name,
            coefficient=coefficient,
            is_absent=is_absent
        )
        return grade, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: Un des objets (élève, cours, période) n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de la note : {str(e)}"


def get_grade_by_id(grade_id: int):
    """
    Récupère une note par son ID.

    Args:
        grade_id (int): L'ID de la note.

    Returns:
        Grade: L'objet Grade ou None si non trouvé.
    """
    try:
        return Grade.objects.get(id=grade_id)
    except Grade.DoesNotExist:
        return None


def get_grades_for_student_by_course(student_id: int, course_id: int) -> QuerySet:
    """
    Récupère toutes les notes d'un élève pour un cours spécifique.

    Args:
        student_id (int): L'ID de l'élève.
        course_id (int): L'ID du cours.

    Returns:
        QuerySet: Un QuerySet des objets Grade correspondants.
    """
    try:
        return Grade.objects.filter(student_id=student_id, course_id=course_id).order_by('term_year__end_date', 'name')
    except Exception:
        return Grade.objects.none()
    

def get_grades_for_student_by_subject_term(student_id: int, subject_id: int, term_year_id: int) -> QuerySet:
    """
    Récupère toutes les notes d'un élève pour une matière spécifique dans un trimestre spécifique d'une année.

    Args:
        student_id (int): L'ID de l'élève.
        subject_id (int): L'ID de la matière.

    Returns:
        QuerySet: Un QuerySet des objets Grade correspondants.
    """
    try:
        return Grade.objects.filter(
            student_id=student_id,
            course__teacher_subject__subject_id=subject_id,
            term_year = term_year_id
        ).order_by('term_year__end_date', 'name')
    except Exception:
        return Grade.objects.none()

def get_all_grades_by_term_year(term_year_id: int) -> QuerySet:
    """
    Récupère toutes les notes de tous les élèves pour une période (trimestre/semestre/année) donnée.

    Args:
        term_year_id (int): L'ID de la période.

    Returns:
        QuerySet: Un QuerySet des objets Grade correspondants.
    """
    try:
        return Grade.objects.filter(
            term_year_id=term_year_id
        ).order_by('student__user__last_name', 'student__user__first_name', 'course__teacher_subject__subject__name', 'name')
    except Exception:
        return Grade.objects.none()
    
def get_all_grades_by_year(year_id: int) -> QuerySet:
    """
    Récupère toutes les notes de tous les élèves pour une année scolaire donnée.

    Cette fonction filtre les notes en se basant sur les périodes (term_year)
    qui sont associées à l'année scolaire spécifiée.

    Args:
        year_id (int): L'ID de l'année scolaire.

    Returns:
        QuerySet: Un QuerySet des objets Grade correspondants.
    """
    try:
        return Grade.objects.filter(
            term_year__year_id=year_id
        ).order_by('student__user__last_name', 'student__user__first_name', 'course__teacher_subject__subject__name', 'name')
    except Exception:
        return Grade.objects.none()

def update_grade(grade_id: int, **kwargs):
    """
    Met à jour une note existante.

    Args:
        grade_id (int): L'ID de la note à mettre à jour.
        **kwargs: Les champs à mettre à jour.

    Returns:
        tuple: (Grade, str) - L'objet Grade mis à jour ou un message d'erreur.
    """
    try:
        grade = Grade.objects.get(id=grade_id)
        for key, value in kwargs.items():
            setattr(grade, key, value)
        grade.save()
        return grade, None
    except Grade.DoesNotExist:
        return None, "Erreur: La note spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de la note : {str(e)}"


def delete_grade(grade_id: int) -> bool:
    """
    Supprime une note par son ID.

    Args:
        grade_id (int): L'ID de la note à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        grade = Grade.objects.get(id=grade_id)
        grade.delete()
        return True
    except Grade.DoesNotExist:
        return False
    except Exception:
        return False

"""
===========================
GESTION DES APPRÉCIATIONS :
===========================
"""

def create_appreciation(student_id: int, term_year_id: int, content: str, teacher_subject_id: int = None, is_global: bool = False):
    """
    Crée et enregistre une nouvelle appréciation pour un élève.

    Args:
        student_id (int): L'ID de l'élève.
        term_year_id (int): L'ID du trimestre/semestre/année.
        content (str): Le contenu de l'appréciation.
        teacher_subject_id (int, optional): L'ID de l'affectation professeur-matière. Optionnel pour une appréciation globale.
        is_global (bool, optional): True si c'est une appréciation générale, False sinon.

    Returns:
        tuple: (Appreciation, str) - L'objet Appreciation créé ou un message d'erreur.
    """
    try:
        student = Student.objects.get(id=student_id)
        term_year = TermYearLevel.objects.get(id=term_year_id)
        teacher_subject = TeacherSubject.objects.get(id=teacher_subject_id) if teacher_subject_id else None

        appreciation = Appreciation.objects.create(
            student=student,
            term_year=term_year,
            teacher_subject=teacher_subject,
            is_global=is_global
        )
        return appreciation, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: Un des objets (élève, période, ou affectation professeur) n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de l'appréciation : {str(e)}"


def get_appreciations_for_student(student_id: int) -> QuerySet:
    """
    Récupère toutes les appréciations pour un élève, triées par période.

    Args:
        student_id (int): L'ID de l'élève.

    Returns:
        QuerySet: Un QuerySet des objets Appreciation correspondants.
    """
    try:
        return Appreciation.objects.filter(student_id=student_id).order_by('term_year__end_date')
    except Exception:
        return Appreciation.objects.none()


def update_appreciation(appreciation_id: int, content: str, is_global: bool = None, teacher_subject_id: int = None):
    """
    Met à jour le contenu d'une appréciation et d'autres champs optionnels.

    Args:
        appreciation_id (int): L'ID de l'appréciation.
        content (str): Le nouveau contenu de l'appréciation.
        is_global (bool, optional): Le nouveau statut global.
        teacher_subject_id (int, optional): Le nouvel ID de l'affectation professeur-matière.

    Returns:
        tuple: (Appreciation, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        appreciation = Appreciation.objects.get(id=appreciation_id)
        appreciation.content = content
        if is_global is not None:
            appreciation.is_global = is_global
        if teacher_subject_id is not None:
            appreciation.teacher_subject = TeacherSubject.objects.get(id=teacher_subject_id)
        appreciation.save()
        return appreciation, None
    except Appreciation.DoesNotExist:
        return None, "Erreur: L'appréciation spécifiée n'existe pas."
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet (affectation professeur) n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de l'appréciation : {str(e)}"


def delete_appreciation(appreciation_id: int) -> bool:
    """
    Supprime une appréciation par son ID.

    Args:
        appreciation_id (int): L'ID de l'appréciation.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        appreciation = Appreciation.objects.get(id=appreciation_id)
        appreciation.delete()
        return True
    except Appreciation.DoesNotExist:
        return False
    except Exception:
        return False

"""
======================
GESTION DES MENTIONS :
======================
"""

def create_mention(student_id: int, term_year_id: int, mention_type: str):
    """
    Crée et enregistre une mention pour un élève pour une période donnée.

    Args:
        student_id (int): L'ID de l'élève.
        term_year_id (int): L'ID du trimestre/semestre/année.
        mention_type (str): Le type de mention ('AB', 'B', 'TB').

    Returns:
        tuple: (Mention, str) - L'objet Mention créé ou un message d'erreur.
    """
    try:
        student = Student.objects.get(id=student_id)
        term_year = TermYearLevel.objects.get(id=term_year_id)

        mention, created = Mention.objects.get_or_create(
            student=student,
            term_year=term_year,
            defaults={'mention_type': mention_type}
        )
        if not created:
            return mention, "Avertissement: Une mention pour cet élève et cette période existe déjà."
        return mention, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: Un des objets (élève, période) n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de la mention : {str(e)}"


def get_mention_for_student_by_term(student_id: int, term_year_id: int):
    """
    Récupère la mention d'un élève pour une période spécifique.

    Args:
        student_id (int): L'ID de l'élève.
        term_year_id (int): L'ID du trimestre/semestre/année.

    Returns:
        Mention: L'objet Mention ou None si non trouvé.
    """
    try:
        return Mention.objects.get(student_id=student_id, term_year_id=term_year_id)
    except Mention.DoesNotExist:
        return None


def update_mention_type(mention_id: int, new_mention_type: str):
    """
    Met à jour le type de mention.

    Args:
        mention_id (int): L'ID de la mention.
        new_mention_type (str): Le nouveau type de mention ('AB', 'B', 'TB').

    Returns:
        tuple: (Mention, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        mention = Mention.objects.get(id=mention_id)
        mention.mention_type = new_mention_type
        mention.save()
        return mention, None
    except Mention.DoesNotExist:
        return None, "Erreur: La mention spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de la mention : {str(e)}"


def delete_mention(mention_id: int) -> bool:
    """
    Supprime une mention par son ID.

    Args:
        mention_id (int): L'ID de la mention.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        mention = Mention.objects.get(id=mention_id)
        mention.delete()
        return True
    except Mention.DoesNotExist:
        return False
    except Exception:
        return False



# TODO faire la fonction d'export des données en fichier excel qui s'envoie automatiquement vers le super user.