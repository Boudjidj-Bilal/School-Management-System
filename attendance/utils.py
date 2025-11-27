from django.db.models import Count, Q

from classes.models import Class, ClassStudentYear
from schools.models import TermYearLevel
from .models import Attendance, AttendanceSession

def get_attendance_classes_for_user(user, current_year, user_type):
    """
    Récupère la liste des classes visibles pour l'utilisateur connecté
    dans le contexte du module d'appel.
    
    [CORRECTION] Utilisation de Class.objects.filter(...).distinct() 
    pour garantir l'unicité des classes (sans doublons) quelle que soit la DB.
    """

    classes_list = []

    if user_type == "Teacher":
        staff = user.staff_user

        # Requête inversée : On cherche les Classes qui ont une liaison ClassTeacherYear
        # correspondant à ce prof et cette année.
        # .distinct() garantit qu'une classe n'apparait qu'une fois même si le prof y a 3 matières.
        classes_list = Class.objects.filter(
            teacher_years__teacher__teacher=staff,
            teacher_years__year=current_year,
            teacher_years__is_active=True
        ).distinct().order_by('level__level', 'name')

    elif user_type in ["CPE", "Principal", "SuperAdministrator"]:
        # Toutes les classes actives de l'école
        classes_list = Class.objects.filter(
            level__school=current_year.school,
            is_valid=True
        ).distinct().order_by('level__level', 'name')
        
    return classes_list

def get_student_attendance_stats(student, term_year=None, current_year=None):
    """
    Calcule les statistiques d'absence et de retard pour un élève.
    """
    qs = Attendance.objects.filter(student=student)

    if term_year:
        qs = qs.filter(session__term_year=term_year)
    elif current_year:
        qs = qs.filter(session__term_year__year=current_year)

    stats = qs.aggregate(
        total_delays=Count('id', filter=Q(status='DELAY')),
        total_absences=Count('id', filter=Q(status='ABSENCE')),
        justified_absences=Count('id', filter=Q(status='ABSENCE', justified=True)),
        unjustified_absences=Count('id', filter=Q(status='ABSENCE', justified=False)),
        unjustified_delays=Count('id', filter=Q(status='DELAY', justified=False))
    )
    return stats


def get_class_attendance_stats(student_class, term_year):
    """
    Calcule les statistiques globales pour une classe entière sur un trimestre.
    """
    qs = Attendance.objects.filter(
        session__student_class=student_class,
        session__term_year=term_year
    )

    stats = qs.aggregate(
        total_absences=Count('id', filter=Q(status='ABSENCE')),
        unjustified_absences=Count('id', filter=Q(status='ABSENCE', justified=False)),
        total_delays=Count('id', filter=Q(status='DELAY')),
        unjustified_delays=Count('id', filter=Q(status='DELAY', justified=False))
    )
    return stats

def get_class_students_for_attendance(student_class, current_year):
    """
    Récupère la liste des élèves actifs d'une classe pour la feuille d'appel.
    Retourne les objets ClassStudentYear (qui lient Student et Class).
    """
    return ClassStudentYear.objects.filter(
        student_class=student_class,
        year=current_year,
        is_active=True
    ).select_related('student', 'student__user').order_by('student__user__last_name', 'student__user__first_name')


def get_teacher_attendance_history(teacher_staff, student_class, current_year):
    """
    Récupère l'historique complet des appels faits par CE professeur,
    pour CETTE classe, durant CETTE année.
    """
    return AttendanceSession.objects.filter(
        teacher=teacher_staff,
        student_class=student_class,
        # On remonte via term_year pour filtrer sur l'année globale
        term_year__year=current_year
    ).order_by('-date', '-start_time')

