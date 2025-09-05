from django.core.exceptions import ObjectDoesNotExist
from schools.models import School, Year
from .models import Level, Classroom, Class, ClassStudentYear, ClassTeacherYear
from users.models import Staff, Student
from subjects.models import TeacherSubject

"""
    Ce fichier centralise les fonctions utilitaires de l'application 'classes'.

    Il agit comme une couche de service entre les vues et les modèles/managers.
    Cela permet de séparer la logique métier de la logique de l'API,
    rendant le code plus propre, plus maintenable et plus facile à tester.
"""

"""
=====================
GESTION DES NIVEAUX :
=====================
"""

# --- Fonctions CRUD pour la classe Level ---

def create_level(level_number, school_id, term_type="TRIMESTRE"):
    """
    Crée et enregistre un nouveau niveau scolaire.

    Args:
        level_number (int): Le niveau numérique (ex: 6, 5, 12...).
        school_id (int): L'ID de l'école à laquelle le niveau est lié.
        term_type (str, optional): Le type de terme ("TRIMESTRE" ou "SEMESTRE"). 
                                   Par défaut, c'est "TRIMESTRE".

    Returns:
        tuple: (Level, str) - L'objet Level créé ou un message d'erreur.
    """
    try:
        school = School.objects.get(id=school_id)
        level = Level.objects.create(
            level=level_number,
            term_type=term_type,
            school=school
        )
        return level, None
    except ObjectDoesNotExist:
        return None, "Erreur: L'école spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la création du niveau : {str(e)}"

def get_level_by_id(level_id):
    """
    Récupère un niveau scolaire par son ID.

    Args:
        level_id (int): L'ID du niveau.

    Returns:
        Level: L'objet Level ou None si non trouvé.
    """
    try:
        return Level.objects.get(id=level_id)
    except Level.DoesNotExist:
        return None

def get_levels_by_school(school_id):
    """
    Récupère tous les niveaux d'une école spécifique.

    Args:
        school_id (int): L'ID de l'école.

    Returns:
        QuerySet: Un QuerySet des objets Level correspondants.
    """
    try:
        school = School.objects.get(id=school_id)
        return Level.objects.filter(school=school)
    except ObjectDoesNotExist:
        return Level.objects.none() # Retourne un QuerySet vide si l'école n'existe pas

def update_level(level_id, **kwargs):
    """
    Met à jour les informations d'un niveau scolaire.

    Args:
        level_id (int): L'ID du niveau à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: level=7, term_type="SEMESTRE").

    Returns:
        tuple: (Level, str) - L'objet Level mis à jour ou un message d'erreur.
    """
    try:
        level = Level.objects.get(id=level_id)
        for key, value in kwargs.items():
            setattr(level, key, value)
        level.save()
        return level, None
    except Level.DoesNotExist:
        return None, "Erreur: Le niveau spécifié n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour du niveau : {str(e)}"

def delete_level(level_id):
    """
    Supprime un niveau scolaire par son ID.

    Args:
        level_id (int): L'ID du niveau à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        level = Level.objects.get(id=level_id)
        level.delete()
        return True
    except Level.DoesNotExist:
        return False
    except Exception:
        return False

"""
================================
GESTION DES SALLES DE CLASSE :
================================
"""

# --- Fonctions CRUD pour la classe Classroom ---

def create_classroom(name, classroom_type, school_id, is_active=True):
    """
    Crée et enregistre une nouvelle salle de classe.

    Args:
        name (str): Le nom de la salle de classe.
        classroom_type (str): Le type de la salle (ex: 'laboratoire').
        school_id (int): L'ID de l'école à laquelle la salle est liée.
        is_active (bool, optional): Indique si la salle est active. Par défaut, True.

    Returns:
        tuple: (Classroom, str) - L'objet Classroom créé ou un message d'erreur.
    """
    try:
        school = School.objects.get(id=school_id)
        classroom = Classroom.objects.create(
            name=name,
            type=classroom_type,
            is_active=is_active,
            school=school
        )
        return classroom, None
    except ObjectDoesNotExist:
        return None, "Erreur: L'école spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la création de la salle de classe : {str(e)}"

def get_classroom_by_id(classroom_id):
    """
    Récupère une salle de classe par son ID.

    Args:
        classroom_id (int): L'ID de la salle de classe.

    Returns:
        Classroom: L'objet Classroom ou None si non trouvé.
    """
    try:
        return Classroom.objects.get(id=classroom_id)
    except Classroom.DoesNotExist:
        return None

def get_classrooms_by_school(school_id):
    """
    Récupère toutes les salles de classe d'une école spécifique.

    Args:
        school_id (int): L'ID de l'école.

    Returns:
        QuerySet: Un QuerySet des objets Classroom correspondants.
    """
    try:
        school = School.objects.get(id=school_id)
        return Classroom.objects.filter(school=school)
    except ObjectDoesNotExist:
        return Classroom.objects.none()

def update_classroom(classroom_id, **kwargs):
    """
    Met à jour les informations d'une salle de classe.

    Args:
        classroom_id (int): L'ID de la salle à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: name='Salle 102').

    Returns:
        tuple: (Classroom, str) - L'objet Classroom mis à jour ou un message d'erreur.
    """
    try:
        classroom = Classroom.objects.get(id=classroom_id)
        for key, value in kwargs.items():
            setattr(classroom, key, value)
        classroom.save()
        return classroom, None
    except Classroom.DoesNotExist:
        return None, "Erreur: La salle de classe spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de la salle de classe : {str(e)}"

def delete_classroom(classroom_id):
    """
    Supprime une salle de classe par son ID.

    Args:
        classroom_id (int): L'ID de la salle à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        classroom = Classroom.objects.get(id=classroom_id)
        classroom.delete()
        return True
    except Classroom.DoesNotExist:
        return False
    except Exception:
        return False



"""
=====================
GESTION DES CLASSES :
=====================
"""

# --- Fonctions CRUD pour la classe Class ---

def create_class(name, level_id, is_valid=True):
    """
    Crée et enregistre une nouvelle classe académique.

    Args:
        name (str): Le nom de la classe (ex: '6A').
        level_id (int): L'ID du niveau auquel la classe est liée.
        is_valid (bool, optional): Indique si la classe est valide pour l'enregistrement.
        Par défaut, True.

    Returns:
        tuple: (Class, str) - L'objet Class créé ou un message d'erreur.
    """
    try:
        level = Level.objects.get(id=level_id)
            
        class_obj = Class.objects.create(
            name=name,
            level=level,
            is_valid=is_valid
        )
        return class_obj, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet spécifié n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de la classe : {str(e)}"

def get_class_by_id(class_id):
    """
    Récupère une classe académique par son ID.

    Args:
        class_id (int): L'ID de la classe.

    Returns:
        Class: L'objet Class ou None si non trouvé.
    """
    try:
        return Class.objects.get(id=class_id)
    except Class.DoesNotExist:
        return None

def get_classes_by_level(level_id):
    """
    Récupère toutes les classes d'un niveau spécifique.

    Args:
        level_id (int): L'ID du niveau.

    Returns:
        QuerySet: Un QuerySet des objets Class correspondants.
    """
    try:
        level = Level.objects.get(id=level_id)
        return Class.objects.filter(level=level)
    except ObjectDoesNotExist:
        return Class.objects.none()

def get_classes_by_school(school_id):
    """
    Récupère toutes les classes d'une école spécifique.

    Args:
        school_id (int): L'ID de l'école.

    Returns:
        QuerySet: Un QuerySet des objets Class correspondants.
    """
    try:
        school = School.objects.get(id=school_id)
        return Class.objects.filter(level__school=school)
    except ObjectDoesNotExist:
        return Class.objects.none()
    

def get_main_teacher_class(teacher_id, year_id):
    """
    Récupère la classe où un professeur est le professeur principal pour une année donnée.

    Args:
        teacher_id (int): L'ID de l'affectation professeur-matière.
        year_id (int): L'ID de l'année scolaire.

    Returns:
        Class: L'objet Class si trouvé, sinon None.
    """
    try:
        assignment = ClassTeacherYear.objects.get(
            teacher_id=teacher_id,
            year_id=year_id,
            is_main_teacher=True,
            is_active=True
        )
        return assignment.student_class
    except ClassTeacherYear.DoesNotExist:
        return None
    except Exception:
        return None

def update_class(class_id, **kwargs):
    """
    Met à jour les informations d'une classe académique.

    Args:
        class_id (int): L'ID de la classe à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: name='6B').

    Returns:
        tuple: (Class, str) - L'objet Class mis à jour ou un message d'erreur.
    """
    try:
        class_obj = Class.objects.get(id=class_id)

        for key, value in kwargs.items():
            setattr(class_obj, key, value)
        
        class_obj.save()
        return class_obj, None
    except Class.DoesNotExist:
        return None, "Erreur: La classe spécifiée n'existe pas."
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet spécifié n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de la classe : {str(e)}"

def delete_class(class_id):
    """
    Supprime une classe académique par son ID.

    Args:
        class_id (int): L'ID de la classe à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        class_obj = Class.objects.get(id=class_id)
        class_obj.delete()
        return True
    except Class.DoesNotExist:
        return False
    except Exception:
        return False


"""
=====================================
GESTION DES ELEVES DANS LES CLASSES :
=====================================
"""


def create_class_student_year(class_id, student_id, year_id, is_delegate=False):
    """
    Crée et enregistre une nouvelle inscription d'élève pour une classe et une année donnée.

    Args:
        class_id (int): L'ID de la classe.
        student_id (int): L'ID de l'élève.
        year_id (int): L'ID de l'année scolaire.
        is_delegate (bool, optional): Indique si l'élève est un délégué. Par défaut, False.

    Returns:
        tuple: (ClassStudentYear, str) - L'objet d'inscription créé ou un message d'erreur.
    """
    try:
        student_class = Class.objects.get(id=class_id)
        student = Student.objects.get(id=student_id)
        year = Year.objects.get(id=year_id)

        inscription = ClassStudentYear.objects.create(
            student_class=student_class,
            student=student,
            year=year,
            is_delegate=is_delegate
        )
        return inscription, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet spécifié n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de l'inscription : {str(e)}"

def get_class_student_year_by_id(inscription_id):
    """
    Récupère une inscription d'élève par son ID.

    Args:
        inscription_id (int): L'ID de l'inscription.

    Returns:
        ClassStudentYear: L'objet ClassStudentYear ou None si non trouvé.
    """
    try:
        return ClassStudentYear.objects.get(id=inscription_id)
    except ClassStudentYear.DoesNotExist:
        return None

def get_students_by_class(class_id, year_id):
    """
    Récupère tous les élèves inscrits dans une classe pour une année donnée.

    Args:
        class_id (int): L'ID de la classe.
        year_id (int): L'ID de l'année scolaire.

    Returns:
        QuerySet: Un QuerySet d'objets Student.
    """
    try:
        return Student.objects.filter(
            class_years__student_class_id=class_id,
            class_years__year_id=year_id,
            class_years__is_active=True
        )
    except Exception:
        return Student.objects.none()

def update_class_student_year(inscription_id, **kwargs):
    """
    Met à jour les informations d'une inscription d'élève.

    Args:
        inscription_id (int): L'ID de l'inscription à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: is_active=False).

    Returns:
        tuple: (ClassStudentYear, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        inscription = ClassStudentYear.objects.get(id=inscription_id)
        for key, value in kwargs.items():
            setattr(inscription, key, value)
        inscription.save()
        return inscription, None
    except ClassStudentYear.DoesNotExist:
        return None, "Erreur: L'inscription spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de l'inscription : {str(e)}"

def delete_class_student_year(inscription_id):
    """
    Supprime une inscription d'élève par son ID.

    Args:
        inscription_id (int): L'ID de l'inscription à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        inscription = ClassStudentYear.objects.get(id=inscription_id)
        inscription.delete()
        return True
    except ClassStudentYear.DoesNotExist:
        return False
    except Exception:
        return False

        
"""
======================================
GESTION DES AFFECTATIONS PROFESSEURS :
======================================
"""


def create_class_teacher_year(class_id, teacher_id, year_id, is_main_teacher=False):
    """
    Crée et enregistre une nouvelle affectation de professeur pour une classe et une année donnée.

    Args:
        class_id (int): L'ID de la classe.
        teacher_id (int): L'ID de l'affectation professeur-matière.
        year_id (int): L'ID de l'année scolaire.
        is_main_teacher (bool, optional): Indique si le professeur est le professeur principal.
                                       Par défaut, False.

    Returns:
        tuple: (ClassTeacherYear, str) - L'objet d'affectation créé ou un message d'erreur.
    """
    try:
        student_class = Class.objects.get(id=class_id)
        teacher = TeacherSubject.objects.get(id=teacher_id)
        year = Year.objects.get(id=year_id)

        assignment = ClassTeacherYear.objects.create(
            student_class=student_class,
            teacher=teacher,
            year=year,
            is_main_teacher=is_main_teacher,
        )
        return assignment, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet spécifié n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de l'affectation : {str(e)}"

def get_class_teacher_year_by_id(assignment_id):
    """
    Récupère une affectation de professeur par son ID.

    Args:
        assignment_id (int): L'ID de l'affectation.

    Returns:
        ClassTeacherYear: L'objet ClassTeacherYear ou None si non trouvé.
    """
    try:
        return ClassTeacherYear.objects.get(id=assignment_id)
    except ClassTeacherYear.DoesNotExist:
        return None

def get_teachers_by_class(class_id, year_id):
    """
    Récupère tous les professeurs affectés à une classe pour une année donnée.

    Args:
        class_id (int): L'ID de la classe.
        year_id (int): L'ID de l'année scolaire.

    Returns:
        QuerySet: Un QuerySet d'objets TeacherSubject.
    """
    try:
        return TeacherSubject.objects.filter(
            class_years__student_class_id=class_id,
            class_years__year_id=year_id,
            class_years__is_active=True
        )
    except Exception:
        return TeacherSubject.objects.none()

def update_class_teacher_year(assignment_id, **kwargs):
    """
    Met à jour les informations d'une affectation de professeur.

    Args:
        assignment_id (int): L'ID de l'affectation à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: is_active=False).

    Returns:
        tuple: (ClassTeacherYear, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        assignment = ClassTeacherYear.objects.get(id=assignment_id)
        for key, value in kwargs.items():
            setattr(assignment, key, value)
        assignment.save()
        return assignment, None
    except ClassTeacherYear.DoesNotExist:
        return None, "Erreur: L'affectation spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de l'affectation : {str(e)}"

def delete_class_teacher_year(assignment_id):
    """
    Supprime une affectation de professeur par son ID.

    Args:
        assignment_id (int): L'ID de l'affectation à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        assignment = ClassTeacherYear.objects.get(id=assignment_id)
        assignment.delete()
        return True
    except ClassTeacherYear.DoesNotExist:
        return False
    except Exception:
        return False
