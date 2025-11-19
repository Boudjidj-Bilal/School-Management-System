
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import QuerySet, F, Sum, ExpressionWrapper, DecimalField, Count, Avg
from .models import Grade, Appreciation, Mention
from users.models import Student, Staff
from schools.models import TermYearLevel, School
from classes.models import ClassStudentYear, ClassTeacherYear, Class
from scheduling.models import ScheduledCourse
from subjects.models import TeacherSubject
from attendance.models import Attendance
import pandas as pd


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
        course = ScheduledCourse.objects.get(id=course_id)
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
            is_global=is_global,
            content=content
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


"""
================================
GESTION DES MOYENNES GENERALES :
================================
"""

"""
    Cette partie contient des fonctions utilitaires pour gérer les calculs de moyenne des élèves.
"""

def get_general_average_subject(student_id: int, term_year_id: int, teacher_subject_id: int) -> tuple:
    """
    Calcule la moyenne générale d'un élève pour une matière, un professeur et un trimestre/une année spécifiques.

    Args:
        student_id (int): L'ID de l'élève.
        term_year_id (int): L'ID du trimestre/de l'année.
        teacher_subject_id (int): L'ID de l'objet TeacherSubject.

    Returns:
        tuple: (float, str) - La moyenne calculée ou (None, message d'erreur).
    """
    try:
        # 1. Valide l'existence de l'étudiant, du trimestre et du professeur
        student = Student.objects.get(id=student_id)
        term_year = TermYearLevel.objects.get(id=term_year_id)
        teacher_subject = TeacherSubject.objects.get(id=teacher_subject_id)

        # 2. Récupère tous les cours pour la matière et le professeur donnés
        # On utilise le lien Year > WeeklyScheduleTemplate pour trouver les cours.
        # Le modèle TermYearLevel a une relation avec le modèle Year.
        courses = ScheduledCourse.objects.filter(
            teacher_subject=teacher_subject,
            weekly_planning_template__year=term_year.year
        )
        course_ids = [course.id for course in courses]
        if not course_ids:
            return None, "Aucun cours trouvé pour cette matière et ce professeur dans le trimestre/l'année donné."

        # 3. Récupère les notes de l'étudiant pour ces cours
        grades = Grade.objects.filter(
            student=student,
            term_year=term_year,
            course__in=course_ids,
            is_absent=False
        )

        if not grades:
            return None, "Aucune note trouvée pour cet élève dans cette matière et ce trimestre."

        # 4. Calcule le total des points pondérés et le total des coefficients
        # On utilise ExpressionWrapper pour garantir un type de champ Decimal pour la précision
        total_weighted_grades = grades.annotate(
            weighted_grade=ExpressionWrapper(
                F('grade_value') * F('coefficient'),
                output_field=DecimalField()
            )
        ).aggregate(total_points=Sum('weighted_grade'))['total_points']

        total_coefficients = grades.aggregate(
            total_coeff=Sum('coefficient')
        )['total_coeff']

        # 5. Calcule la moyenne
        if total_coefficients > 0:
            average = total_weighted_grades / total_coefficients
            return round(average, 2), None
        else:
            return None, "Le total des coefficients est zéro, impossible de calculer la moyenne."

    except Student.DoesNotExist:
        return None, "L'élève n'a pas été trouvé."
    except TermYearLevel.DoesNotExist:
        return None, "Le trimestre/l'année n'a pas été trouvé."
    except TeacherSubject.DoesNotExist:
        return None, "La matière ou le professeur n'a pas été trouvé."
    except Exception as e:
        return None, f"Une erreur inattendue est survenue : {str(e)}"


def get_class_average_subject(term_year_id: int, class_id: int, teacher_subject_id: int) -> tuple:
    """
    Calcule la moyenne générale d'une classe pour une matière et un trimestre/une année donnés.

    Args:
        term_year_id (int): L'ID du trimestre/de l'année.
        class_id (int): L'ID de la classe.
        teacher_subject_id (int): L'ID de l'objet TeacherSubject.

    Returns:
        tuple: (float, str) - La moyenne calculée ou (None, message d'erreur).
    """
    try:
        term_year = TermYearLevel.objects.get(id=term_year_id)
        year = term_year.year
        
        students_in_class = ClassStudentYear.objects.filter(
            year=year, 
            student__class_set__in=[class_id]
        ).values_list('student', flat=True)
        students = Student.objects.filter(id__in=students_in_class)

        if not students.exists():
            return None, "Aucun élève trouvé dans cette classe pour cette année scolaire."

        class_averages = []

        for student in students:
            student_average, error = get_general_average_subject(
                student_id=student.id,
                term_year_id=term_year_id,
                teacher_subject_id=teacher_subject_id
            )
            if student_average is not None:
                class_averages.append(student_average)

        if not class_averages:
            return None, "Aucune moyenne n'a pu être calculée pour cette matière et ce trimestre/cette année."

        class_average = sum(class_averages) / len(class_averages)
        return round(class_average, 2), None

    except TermYearLevel.DoesNotExist:
        return None, "Le trimestre/l'année n'a pas été trouvé."
    except Exception as e:
        return None, f"Une erreur inattendue est survenue lors du calcul de la moyenne de la classe : {str(e)}"


def get_overall_average_term(student_id: int, term_year_id: int) -> tuple:
    """
    Calcule la moyenne générale totale d'un élève pour un trimestre et une année donnée,
    en moyennant les notes obtenues dans chaque matière.

    Args:
        student_id (int): L'ID de l'élève.
        term_year_id (int): L'ID du trimestre/de l'année.

    Returns:
        tuple: (float, str) - La moyenne générale totale ou (None, message d'erreur).
    """
    try:
        teacher_subjects_with_grades = Grade.objects.filter(
            student__id=student_id,
            term_year__id=term_year_id,
            is_absent=False
        ).values_list('course__teacher_subject__id', flat=True).distinct()

        if not teacher_subjects_with_grades:
            return None, "Aucune note trouvée pour cet élève dans ce trimestre."

        total_average = 0
        subject_count = 0

        for ts_id in teacher_subjects_with_grades:
            subject_average, error = get_general_average_subject(student_id, term_year_id, ts_id)
            if subject_average is not None:
                total_average += subject_average
                subject_count += 1

        if subject_count > 0:
            overall_average = total_average / subject_count
            return round(overall_average, 2), None
        else:
            return None, "Aucune moyenne de matière valide n'a pu être calculée."

    except Exception as e:
        return None, f"Une erreur inattendue est survenue lors du calcul de la moyenne générale totale : {str(e)}"


def get_overall_class_average_term(term_year_id: int, class_id: int) -> tuple:
    """
    Calcule la moyenne générale totale d'une classe pour un trimestre/une année donnés.

    Args:
        term_year_id (int): L'ID du trimestre/de l'année.
        class_id (int): L'ID de la classe.

    Returns:
        tuple: (float, str) - La moyenne générale totale de la classe ou (None, message d'erreur).
    """
    try:
        term_year = TermYearLevel.objects.get(id=term_year_id)
        year = term_year.year
        
        students_in_class = ClassStudentYear.objects.filter(
            year=year,
            student__class_set__in=[class_id]
        ).values_list('student', flat=True)
        students = Student.objects.filter(id__in=students_in_class)

        if not students.exists():
            return None, "Aucun élève trouvé dans cette classe pour cette année scolaire."
            
        overall_class_averages = []

        for student in students:
            student_overall_average, error = get_overall_average_term(
                student_id=student.id,
                term_year_id=term_year_id
            )
            if student_overall_average is not None:
                overall_class_averages.append(student_overall_average)

        if not overall_class_averages:
            return None, "Aucune moyenne générale valide n'a pu être calculée pour la classe."

        overall_class_average = sum(overall_class_averages) / len(overall_class_averages)
        return round(overall_class_average, 2), None

    except TermYearLevel.DoesNotExist:
        return None, "Le trimestre/l'année n'a pas été trouvé."
    except Exception as e:
        return None, f"Une erreur inattendue est survenue lors du calcul de la moyenne générale de la classe : {str(e)}"



"""
===========================================
GESTION DU FICHIER EXCEL DES DATA DU SITE : 
===========================================
"""

def export_all_data_to_excel() -> tuple:
    """
    Exporte toutes les données (étudiants, classes, trimestres, années)
    vers un seul fichier Excel.

    Args:
        None

    Returns:
        tuple: (bool, str) - True en cas de succès avec le chemin du fichier,
                             False avec un message d'erreur.
    """
    try:
        all_data = []

        # Récupération de tous les trimestres/semestres
        all_term_years = TermYearLevel.objects.all()

        if not all_term_years.exists():
            return False, "Aucun trimestre/semestre n'a été trouvé."

        # Boucle sur chaque terme pour récupérer les données de tous les étudiants
        for term_year in all_term_years:
            # Récupération de tous les étudiants
            all_students = Student.objects.all()

            # Boucle sur chaque étudiant pour collecter les données
            for student in all_students:
                # Récupération de l'inscription de l'élève pour l'année en cours
                class_student_year = ClassStudentYear.objects.filter(
                    student=student,
                    year=term_year.year
                ).first()
                if not class_student_year:
                    continue  # L'étudiant n'est pas inscrit cette année-là

                school = student.school
                school_type = school.get_type_display()
                student_class = class_student_year.student_class
                student_level = student_class.level

                # Calcul de la moyenne générale
                overall_average, _ = get_overall_average_term(student.id, term_year.id)

                # Calcul des heures d'absence et de retard
                attendance_data = Attendance.objects.filter(
                    student=student,
                    term_year=term_year
                ).aggregate(
                    total_absence=Sum(F('course__duration'), filter=F('type') == 'ABSENCE'),
                    total_delay=Sum(F('course__duration'), filter=F('type') == 'DELAY'),
                    justified_absence=Sum(F('course__duration'), filter=F('type') == 'ABSENCE' and F('justified') == True),
                    justified_delay=Sum(F('course__duration'), filter=F('type') == 'DELAY' and F('justified') == True)
                )

                # Récupération de l'appréciation et de la mention
                try:
                    general_appreciation = Appreciation.objects.get(
                        student=student,
                        term_year=term_year,
                        is_global=True
                    ).content
                except Appreciation.DoesNotExist:
                    general_appreciation = "N/A"

                try:
                    mention = Mention.objects.get(
                        student=student,
                        term_year=term_year
                    ).get_mention_type_display()
                except Mention.DoesNotExist:
                    mention = "N/A"

                # Construction de la ligne de données
                student_data = {
                    "Établissement": school.name,
                    "Type d'établissement": school_type,
                    "Année": term_year.year.name,
                    "Type trimestre/semestre": student_level.get_term_type_display(),
                    "Nb trimestre/semestre": term_year.counter,
                    "Nom": student.user.last_name,
                    "Prénom": student.user.first_name,
                    "Email": student.user.email,
                    "Civilité": student.get_gender_display(),
                    "Date de naissance": student.birth_date,
                    "Classe": student_class.name,
                    "Niveau": student_level.level,
                    "Moyenne générale": overall_average,
                    "Absence (h)": attendance_data.get('total_absence', 0),
                    "Retard (h)": attendance_data.get('total_delay', 0),
                    "Absence justifié (h)": attendance_data.get('justified_absence', 0),
                    "Retard justifié (h)": attendance_data.get('justified_delay', 0),
                    "Appréciations générale": general_appreciation,
                    "Mention": mention,
                    "Est actif": "Oui" if student.user.is_active else "Non"
                }
                all_data.append(student_data)

        # Création du DataFrame et du fichier Excel
        df = pd.DataFrame(all_data)
        file_name = "rapport_general_toutes_donnees.xlsx"
        file_path = f"/tmp/{file_name}"
        df.to_excel(file_path, index=False)

        return True, file_path

    except Exception as e:
        return False, f"Une erreur inattendue est survenue : {str(e)}"


"""
=======================
GESTION DES BULLETINS : 
=======================
"""

"""
    Génère un bulletin de notes complet pour un élève, un trimestre et une classe donnés.

    Args:
        student_id (int): L'ID de l'élève.
        term_year_id (int): L'ID du trimestre/de l'année.
        class_id (int): L'ID de la classe.

    Returns:
        tuple: (dict, str) - Un dictionnaire avec toutes les données du bulletin ou (None, message d'erreur).
"""


def generate_report_card(student_id: int, term_year_id: int, class_id: int) -> tuple:
    """
    Génère un bulletin de notes complet pour un élève, un trimestre et une classe donnés.

    Cette fonction est le point d'entrée pour la création d'un bulletin. Elle rassemble
    toutes les informations nécessaires (détails de l'élève, de l'école, des matières,
    des notes, des absences, etc.) et les structure dans un dictionnaire.

    Args:
        student_id (int): L'ID de l'élève.
        term_year_id (int): L'ID du trimestre/de l'année.
        class_id (int): L'ID de la classe.

    Returns:
        tuple: (dict, str) - Un dictionnaire avec toutes les données du bulletin ou (None, message d'erreur).
    """
    try:
        # 1. Récupération des objets clés
        # On commence par récupérer les objets principaux depuis la base de données.
        # Cela nous permet d'avoir accès à toutes les informations de manière structurée.
        student = Student.objects.get(id=student_id)
        term_year = TermYearLevel.objects.get(id=term_year_id)
        current_class = Class.objects.get(id=class_id)
        year = term_year.year
        school = School.objects.get(id=year.school.id)

        # 2. Informations sur le personnel de l'école
        # Cherche le chef d'établissement
        # On filtre le personnel de l'école par le type "PRINCIPAL".
        # `.first()` permet de prendre le premier résultat s'il y en a plusieurs, ou `None` s'il n'y en a pas.
        establishment_head_staff = Staff.objects.filter(
            school=school,
            staff_type="PRINCIPAL"
        ).first()
        establishment_head_name = establishment_head_staff.user.get_full_name() if establishment_head_staff else "Non assigné"

        # Cherche le professeur principal en utilisant la table ClassTeacherYear
        # Cette table fait le lien entre une classe, une année et un professeur principal.
        main_teacher_assignment = ClassTeacherYear.objects.filter(
            student_class=current_class,
            year=year,
            is_main_teacher=True
        ).first()
        main_teacher_name = main_teacher_assignment.teacher.user.get_full_name() if main_teacher_assignment else "Non assigné"

        # 3. Initialisation de la structure du bulletin
        # On crée un dictionnaire qui va contenir toutes les données du bulletin.
        # Cette structure est prédéfinie pour faciliter l'affichage ultérieur.
        report_card_data = {
            "title": f"Bulletin du {term_year.counter}ème {term_year.level.term_type} de l'année {year.name}",
            "school_info": {
                "name": school.name,
                "address": school.address,
                "phone_number": school.phone_number,
                "email": school.email,
                "establishment_head": establishment_head_name
            },
            "student_info": {
                "full_name": student.user.get_full_name(),
                "birth_date": student.birth_date,
                "class_name": current_class.name,
                "main_teacher": main_teacher_name,
                "address": student.address,
                # Récupère les noms des parents en passant par la table d'association `Child`
                "parents": [c.parent.user.get_full_name() for c in student.parent_links.all()]
            },
            "term_info": {
                "term_name": term_year.level.term_type,
                "term_number": term_year.counter,
                "year_name": year.name
            },
            "subject_grades": [],
            "overall_averages": {
                "student_overall_average": None,
                "class_overall_average": None,
                "highest_class_average": None,
                "lowest_class_average": None
            },
            "attendance": {
                "absences": 0,
                "justified_absences": 0,
                "delays": 0,
                "justified_delays": 0,
            },
            "appreciations": {
                "subject_appreciations": [],
                "global_appreciation": None,
                "mention": None
            }
        }

        # 4. Calculs des notes, moyennes par matière et appréciations
        # On récupère toutes les matières enseignées pendant l'année scolaire de l'élève.
        teacher_subjects = TeacherSubject.objects.filter(
            courses__weekly_planning_template__year=year
        ).distinct()
        
        student_overall_averages = []
        class_overall_averages = []

        # On parcourt chaque matière pour collecter les données
        for ts in teacher_subjects:
            subject_name = ts.subject.name
            teacher_name = ts.teacher.user.get_full_name()
            
            # On vérifie que la matière est bien liée à un cours dans la classe de l'élève.
            # Cela évite d'inclure des matières que la classe n'a pas.
            if not ScheduledCourse.objects.filter(
                teacher_subject=ts,
                class_set__in=[current_class.id],
                weekly_planning_template__year=year
            ).exists():
                continue

            # Moyenne de l'élève pour la matière
            student_subject_average, error = get_general_average_subject(
                student_id=student_id,
                term_year_id=term_year_id,
                teacher_subject_id=ts.id
            )
            # Si la moyenne a été calculée, on l'ajoute à la liste pour le calcul de la moyenne générale de l'élève
            if student_subject_average is not None:
                student_overall_averages.append(student_subject_average)

            # Moyenne de la classe pour la matière
            class_subject_average, error = get_class_average_subject(
                term_year_id=term_year_id,
                class_id=class_id,
                teacher_subject_id=ts.id
            )
            # Si la moyenne de la classe a été calculée, on l'ajoute à la liste pour le calcul de la moyenne générale de la classe
            if class_subject_average is not None:
                class_overall_averages.append(class_subject_average)

            # Récupère l'appréciation du professeur pour cette matière et cet élève
            appreciation = Appreciation.objects.filter(
                student=student,
                term_year=term_year,
                teacher_subject=ts
            ).first()

            # Ajoute toutes ces informations à la liste `subject_grades` du dictionnaire
            report_card_data["subject_grades"].append({
                "subject_name": subject_name,
                "teacher_name": teacher_name,
                "student_average": student_subject_average,
                "class_average": class_subject_average,
                "appreciation": appreciation.comment if appreciation else None
            })

        # 5. Calcul des moyennes générales et statistiques de la classe
        # Calcule la moyenne générale de l'élève sur toutes les matières
        if student_overall_averages:
            student_overall_average, _ = get_overall_average_term(student_id=student.id, term_year_id=term_year.id)
            report_card_data["overall_averages"]["student_overall_average"] = round(student_overall_average, 2)
        
        # Calcule la moyenne générale de la classe et les moyennes min/max
        if class_overall_averages:
            class_overall_average, _ = get_overall_class_average_term(term_year_id=term_year.id, class_id=current_class.id)
            report_card_data["overall_averages"]["class_overall_average"] = round(class_overall_average, 2)
            report_card_data["overall_averages"]["highest_class_average"] = max(class_overall_averages)
            report_card_data["overall_averages"]["lowest_class_average"] = min(class_overall_averages)
        
        # 6. Calcul des présences
        # On utilise `Count('id')` pour compter le nombre d'enregistrements qui correspondent aux filtres.
        # On utilise le modèle `Attendance` et les choix de type `ABSENCE` et `DELAY`.
        absences = Attendance.objects.filter(student=student, term_year=term_year, type='ABSENCE').aggregate(count=Count('id'))['count']
        justified_absences = Attendance.objects.filter(student=student, term_year=term_year, type='ABSENCE', justified=True).aggregate(count=Count('id'))['count']
        delays = Attendance.objects.filter(student=student, term_year=term_year, type='DELAY').aggregate(count=Count('id'))['count']
        justified_delays = Attendance.objects.filter(student=student, term_year=term_year, type='DELAY', justified=True).aggregate(count=Count('id'))['count']

        # On met à jour le dictionnaire avec les données de présence
        report_card_data["attendance"]["absences"] = absences
        report_card_data["attendance"]["justified_absences"] = justified_absences
        report_card_data["attendance"]["delays"] = delays
        report_card_data["attendance"]["justified_delays"] = justified_delays

        # 7. Appréciation globale et mention
        # Récupère l'appréciation générale de l'élève pour le trimestre (si elle existe)
        global_appreciation = Appreciation.objects.filter(student=student, term_year=term_year, is_global=True).first()
        # Récupère la mention attribuée (ex: "Félicitations")
        mention = Mention.objects.filter(student=student, term_year=term_year).first()
        
        if global_appreciation:
            report_card_data["appreciations"]["global_appreciation"] = global_appreciation.content
        if mention:
            report_card_data["appreciations"]["mention"] = mention.mention_type

        # 8. Retourne le dictionnaire de données et `None` pour l'erreur
        return report_card_data, None

    except Student.DoesNotExist:
        return None, "L'élève n'a pas été trouvé."
    except TermYearLevel.DoesNotExist:
        return None, "Le trimestre/l'année n'a pas été trouvé."
    except Class.DoesNotExist:
        return None, "La classe n'a pas été trouvée."
    except School.DoesNotExist:
        return None, "L'école n'a pas été trouvée."
    except Exception as e:
        # Gère les erreurs inattendues
        return None, f"Une erreur inattendue est survenue lors de la génération du bulletin : {str(e)}"
