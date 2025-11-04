from django.core.exceptions import ObjectDoesNotExist
from django.db.models import QuerySet
from .models import WeeklyScheduleTemplate, ScheduledCourse
from schools.models import Year
from datetime import time
from subjects.models import TeacherSubject
from classes.models import Classroom, Class

"""
    Ce fichier centralise les fonctions utilitaires de l'application 'scheduling'.

    Il gère la logique métier liée à la création, la lecture, la mise à jour et la suppression
    (CRUD) des modèles de planification hebdomadaire.
"""

"""
================================
GESTION D'UN MODEL DE PLANNING :
================================
"""

def create_weekly_schedule_template(name: str, description: str, year_id: int):
    """
    Crée et enregistre un nouveau modèle de planning hebdomadaire.

    Args:
        name (str): Le nom du modèle.
        description (str): La description du modèle.
        year_id (int): L'ID de l'année scolaire associée.

    Returns:
        tuple: (WeeklyScheduleTemplate, str) - L'objet créé ou un message d'erreur.
    """
    try:
        year = Year.objects.get(id=year_id)
        template = WeeklyScheduleTemplate.objects.create(
            name=name,
            description=description,
            year=year
        )
        return template, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'année spécifiée n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création du modèle de planning : {str(e)}"


def get_weekly_schedule_template_by_id(template_id: int):
    """
    Récupère un modèle de planning hebdomadaire par son ID.

    Args:
        template_id (int): L'ID du modèle.

    Returns:
        WeeklyScheduleTemplate: L'objet WeeklyScheduleTemplate ou None si non trouvé.
    """
    try:
        return WeeklyScheduleTemplate.objects.get(id=template_id)
    except WeeklyScheduleTemplate.DoesNotExist:
        return None


def get_all_weekly_schedule_templates() -> QuerySet:
    """
    Récupère tous les modèles de planning hebdomadaire.

    Returns:
        QuerySet: Un QuerySet des objets WeeklyScheduleTemplate.
    """
    return WeeklyScheduleTemplate.objects.all().order_by('year__start_date', 'name')


def update_weekly_schedule_template(template_id: int, **kwargs):
    """
    Met à jour un modèle de planning hebdomadaire existant.

    Args:
        template_id (int): L'ID du modèle à mettre à jour.
        **kwargs: Les champs à mettre à jour.

    Returns:
        tuple: (WeeklyScheduleTemplate, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        template = WeeklyScheduleTemplate.objects.get(id=template_id)
        for key, value in kwargs.items():
            if key == 'year_id':
                template.year = Year.objects.get(id=value)
            else:
                setattr(template, key, value)
        template.save()
        return template, None
    except WeeklyScheduleTemplate.DoesNotExist:
        return None, "Erreur: Le modèle de planning spécifié n'existe pas."
    except ObjectDoesNotExist as e:
        return None, f"Erreur: Une des relations (année) n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la mise à jour du modèle de planning : {str(e)}"


def delete_weekly_schedule_template(template_id: int) -> bool:
    """
    Supprime un modèle de planning hebdomadaire par son ID.

    Args:
        template_id (int): L'ID du modèle à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        template = WeeklyScheduleTemplate.objects.get(id=template_id)
        template.delete()
        return True
    except WeeklyScheduleTemplate.DoesNotExist:
        return False
    except Exception:
        return False

"""
======================================
GESTION D'UNE INSTANCE D'UN PLANNING :
======================================
"""


"""
====================
GESTIONS DES COURS :
====================
"""

def create_course(day_of_week: int, start_time: time, end_time: time, classroom_id: int, student_class_id: int, teacher_subject_id: int, weekly_planning_template_id: int):
    """
    Crée et enregistre un nouveau cours planifié.

    Args:
        day_of_week (int): Le jour de la semaine.
        start_time (time): L'heure de début.
        end_time (time): L'heure de fin.
        classroom_id (int): L'ID de la salle de classe.
        student_class_id (int): L'ID de la classe d'élèves.
        teacher_subject_id (int): L'ID de l'affectation professeur-matière.
        weekly_planning_template_id (int): L'ID du modèle de planning hebdomadaire.

    Returns:
        tuple: (Course, str) - L'objet Course créé ou un message d'erreur.
    """
    try:
        classroom = Classroom.objects.get(id=classroom_id)
        student_class = Class.objects.get(id=student_class_id)
        teacher_subject = TeacherSubject.objects.get(id=teacher_subject_id)
        weekly_planning_template = WeeklyScheduleTemplate.objects.get(id=weekly_planning_template_id)
        
        course = ScheduledCourse.objects.create(
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            classroom=classroom,
            student_class=student_class,
            teacher_subject=teacher_subject,
            weekly_planning_template=weekly_planning_template
        )
        return course, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: Un des objets liés (salle, classe, professeur/matière, modèle) n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création du cours : {str(e)}"


def get_course_by_id(course_id: int):
    """
    Récupère un cours par son ID.

    Args:
        course_id (int): L'ID du cours.

    Returns:
        Course: L'objet Course ou None si non trouvé.
    """
    try:
        return ScheduledCourse.objects.get(id=course_id)
    except ScheduledCourse.DoesNotExist:
        return None


def get_all_courses() -> QuerySet:
    """
    Récupère tous les cours planifiés.

    Returns:
        QuerySet: Un QuerySet des objets Course.
    """
    return ScheduledCourse.objects.all().order_by('day_of_week', 'start_time')


def get_courses_by_template(template_id: int) -> QuerySet:
    """
    Récupère tous les cours associés à un modèle de planning hebdomadaire.

    Args:
        template_id (int): L'ID du modèle de planning.

    Returns:
        QuerySet: Un QuerySet des objets Course.
    """
    try:
        return ScheduledCourse.objects.filter(
            weekly_planning_template_id=template_id
        ).order_by('day_of_week', 'start_time')
    except Exception:
        return ScheduledCourse.objects.none()


def get_courses_by_class(student_class_id: int) -> QuerySet:
    """
    Récupère tous les cours associés à une classe d'élèves.

    Args:
        student_class_id (int): L'ID de la classe d'élèves.

    Returns:
        QuerySet: Un QuerySet des objets Course.
    """
    try:
        return ScheduledCourse.objects.filter(
            student_class_id=student_class_id
        ).order_by('day_of_week', 'start_time')
    except Exception:
        return ScheduledCourse.objects.none()


def get_courses_by_teacher(teacher_subject_id: int) -> QuerySet:
    """
    Récupère tous les cours associés à un professeur et une matière.

    Args:
        teacher_subject_id (int): L'ID de l'affectation professeur-matière.

    Returns:
        QuerySet: Un QuerySet des objets Course.
    """
    try:
        return ScheduledCourse.objects.filter(
            teacher_subject_id=teacher_subject_id
        ).order_by('day_of_week', 'start_time')
    except Exception:
        return ScheduledCourse.objects.none()


def get_courses_by_classroom(classroom_id: int) -> QuerySet:
    """
    Récupère tous les cours se déroulant dans une salle de classe.

    Args:
        classroom_id (int): L'ID de la salle de classe.

    Returns:
        QuerySet: Un QuerySet des objets Course.
    """
    try:
        return ScheduledCourse.objects.filter(
            classroom_id=classroom_id
        ).order_by('day_of_week', 'start_time')
    except Exception:
        return ScheduledCourse.objects.none()


def get_courses_by_day(day_of_week: int) -> QuerySet:
    """
    Récupère tous les cours d'un jour de la semaine donné.

    Args:
        day_of_week (int): Le jour de la semaine (1 pour Lundi, etc.).

    Returns:
        QuerySet: Un QuerySet des objets Course.
    """
    try:
        return ScheduledCourse.objects.filter(
            day_of_week=day_of_week
        ).order_by('start_time')
    except Exception:
        return ScheduledCourse.objects.none()


def update_course(course_id: int, **kwargs):
    """
    Met à jour un cours planifié existant.

    Args:
        course_id (int): L'ID du cours à mettre à jour.
        **kwargs: Les champs à mettre à jour.

    Returns:
        tuple: (Course, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        course = ScheduledCourse.objects.get(id=course_id)
        for key, value in kwargs.items():
            if key == 'classroom_id':
                course.classroom = Classroom.objects.get(id=value)
            elif key == 'student_class_id':
                course.student_class = Class.objects.get(id=value)
            elif key == 'teacher_subject_id':
                course.teacher_subject = TeacherSubject.objects.get(id=value)
            elif key == 'weekly_planning_template_id':
                course.weekly_planning_template = WeeklyScheduleTemplate.objects.get(id=value)
            else:
                setattr(course, key, value)
        course.save()
        return course, None
    except ScheduledCourse.DoesNotExist:
        return None, "Erreur: Le cours spécifié n'existe pas."
    except ObjectDoesNotExist as e:
        return None, f"Erreur: Une des relations liées au cours n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la mise à jour du cours : {str(e)}"


def delete_course(course_id: int) -> bool:
    """
    Supprime un cours planifié par son ID.

    Args:
        course_id (int): L'ID du cours à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        course = ScheduledCourse.objects.get(id=course_id)
        course.delete()
        return True
    except ScheduledCourse.DoesNotExist:
        return False
    except Exception:
        return False
