# documents/utils.py

# Import des modèles nécessaires
from classes.models import ClassTeacherYear, ClassStudentYear
from grades.models import Evaluation, Grade, Appreciation, Mention

# Import des fonctions existantes
from grades.utils import (
    calculate_student_subject_average,
    calculate_subject_class_average,
    calculate_overall_student_average,
    calculate_overall_class_average,
    get_evaluations_for_subject
)
from attendance.utils import get_student_attendance_stats

# ===================
# FONCTIONS DE CALCUL 
# ===================

def calculate_subject_min_max_averages(student_class, teacher_subject, term_year):
    """
    Calcule la moyenne la plus basse (Min) et la plus haute (Max) de la CLASSE
    pour une matière donnée.
    
    Algorithme :
    1. Récupère tous les élèves de la classe.
    2. Calcule la moyenne de chaque élève pour cette matière.
    3. Extrait le min et le max.
    """
    # Récupérer les élèves actifs de la classe
    class_students = ClassStudentYear.objects.filter(
        student_class=student_class, 
        year=term_year.year,
        is_active=True
    ).select_related('student')

    averages = []

    for link in class_students:
        # On réutilise ta fonction existante pour être cohérent dans le calcul
        avg = calculate_student_subject_average(link.student, teacher_subject, term_year)
        if avg is not None:
            averages.append(avg)

    if not averages:
        return None, None

    return min(averages), max(averages)


def calculate_student_main_grade_average(student, teacher_subject, term_year):
    """
    Calcule la moyenne de l'élève UNIQUEMENT sur les 'Notes Principales' (is_main_grade=True).
    Retourne None s'il n'y a aucune note principale.
    """
    # 1. Récupérer les évaluations "Principales"
    evals = Evaluation.objects.filter(
        teacher_subject=teacher_subject,
        term_year=term_year,
        is_main_grade=True # LE FILTRE CLÉ
    )
    
    if not evals.exists():
        return None

    total_points = 0
    total_coeff = 0

    for evaluation in evals:
        # Récupérer la note
        grade = Grade.objects.filter(evaluation=evaluation, student=student).first()
        
        # On ignore les absences ou les notes manquantes pour la moyenne
        if grade and not grade.is_absent and grade.grade_value is not None:
            # Normalisation sur 20 (Optionnel, selon ta logique école)
            # Si on veut tout ramener sur 20 pour la moyenne :
            normalized_value = (grade.grade_value / evaluation.max_grade) * 20
            
            total_points += normalized_value * evaluation.coefficient
            total_coeff += evaluation.coefficient

    if total_coeff == 0:
        return None

    return round(total_points / total_coeff, 2)


# ==============================================================================
# 2. LA SUPER-FONCTION DE COLLECTE (POUR LE PDF)
# ==============================================================================
# documents/utils.py

def get_report_card_context(student, term_year):
    """
    Prépare TOUTES les données nécessaires pour générer le PDF du bulletin.
    Adapté aux modèles fournis (ClassTeacherYear, Year, Class...).
    """

    year = term_year.year

    # --- A. CONTEXTE GÉNÉRAL ---
    # On retrouve la classe de l'élève pour cette année via ClassStudentYear
    try:
        class_link = ClassStudentYear.objects.get(student=student, year=year, is_active=True)
        student_class = class_link.student_class
    except ClassStudentYear.DoesNotExist:
        return None # L'élève n'est pas inscrit dans une classe pour cette année

    # L'école est liée à l'Année (Year), pas directement à la Classe
    school = year.school
    
    # Le Prof Principal est dans ClassTeacherYear, pas dans Class
    main_teacher_name = "Non défini"
    main_teacher_rel = ClassTeacherYear.objects.filter(
        student_class=student_class,
        year=year,
        is_active=True,
        is_main_teacher=True
    ).first()

    if main_teacher_rel:
        # main_teacher_rel.teacher est un objet TeacherSubject
        # On suppose que TeacherSubject a une relation vers le User (souvent via .teacher.user)
        # Adapte '.teacher.user' si ton modèle TeacherSubject est différent
        mt_user = main_teacher_rel.teacher.teacher.user 
        main_teacher_name = f"{mt_user.first_name} {mt_user.last_name}"

    student_gender = ""

    if student.get_gender_display() == "Mister":
        student_gender = "M"
    else :
        student_gender = "F"

    # --- B. DONNÉES ADMINISTRATIVES ---
    context = {
        'school_name': school.name,
        'school_address': school.address, 
        'school_logo_url': school.logo.url if school.logo else None,
        'school_color': school.primary_color,
        'principal_signature_url': school.principal_signature.url if school.principal_signature else None,
        
        'term_name': f"Trimestre {term_year.counter}", 
        'year_name': year.name,

        'student_name': f"{student.user.last_name} {student.user.first_name}",
        'student_photo_url': student.user.profile_picture.url if student.user.profile_picture else None,
        'class_name': student_class.name,
        'main_teacher_name': main_teacher_name,
        'is_delegate': class_link.is_delegate,
        'birth_date': student.birth_date,
        'student_gender': student_gender, 
        'student_address': student.address,
        'national_number': student.national_number,  # Le numéro national (facultatif)
    }

    # --- C. BOUCLE SUR LES MATIÈRES ---
    # Récupérer les professeurs/matières de la classe via ClassTeacherYear
    class_teachers = ClassTeacherYear.objects.filter(
        student_class=student_class,
        year=year,
        is_active=True
    ).select_related('teacher', 'teacher__subject').order_by('teacher__subject__name')

    subjects_data = []
    
    for ct in class_teachers:
        # ct est un ClassTeacherYear, ct.teacher est un TeacherSubject
        teacher_subject = ct.teacher 
        
        # 1. Calculs des Moyennes (Appel de tes fonctions existantes)
        stud_avg = calculate_student_subject_average(student, teacher_subject, term_year)
        class_avg = calculate_subject_class_average(student_class, teacher_subject, term_year)
        min_avg, max_avg = calculate_subject_min_max_averages(student_class, teacher_subject, term_year)
        main_avg = calculate_student_main_grade_average(student, teacher_subject, term_year)

        # 2. Récupération des Notes (Détail)
        evaluations = get_evaluations_for_subject(teacher_subject, student_class, term_year)
        grades_list = []
        for eva in evaluations:
            # Récupérer la note spécifique
            g = Grade.objects.filter(evaluation=eva, student=student).first()
            val_display = "-"
            if g:
                if g.is_absent: val_display = "ABS"
                elif g.grade_value is not None: val_display = f"{g.grade_value}"
            
            grades_list.append({
                'name': eva.name,
                'value': val_display,
                'max': eva.max_grade,
                'is_main': eva.is_main_grade 
            })

        # 3. Récupération de l'Appréciation du Prof
        appreciation_obj = Appreciation.objects.filter(
            student=student,
            term_year=term_year,
            teacher_subject=teacher_subject,
            is_global=False
        ).first()
        appreciation_text = appreciation_obj.content if appreciation_obj else ""

        # Ajout au tableau
        subjects_data.append({
            'subject_name': teacher_subject.subject.name,
            'teacher_name': f"{teacher_subject.teacher.user.last_name}", # Nom du prof
            'grades': grades_list,
            'averages': {
                'student': stud_avg if stud_avg is not None else "-",
                'class': class_avg if class_avg is not None else "-",
                'min': min_avg if min_avg is not None else "-",
                'max': max_avg if max_avg is not None else "-",
                'main': main_avg if main_avg is not None else "-", 
            },
            'appreciation': appreciation_text
        })

    context['subjects'] = subjects_data


    # --- D. SYNTHÈSE GÉNÉRALE (PIED DE PAGE) ---
    
    # 1. Moyennes Générales
    context['overall_average_student'] = calculate_overall_student_average(student, term_year) or "-"
    context['overall_average_class'] = calculate_overall_class_average(student_class, term_year) or "-"
    
    # 2. Appréciation Générale (Conseil de classe)
    global_appr = Appreciation.objects.filter(
        student=student,
        term_year=term_year,
        is_global=True
    ).first()
    context['general_appreciation'] = global_appr.content if global_appr else ""

    # 3. Mention
    mention_obj = Mention.objects.filter(
        student=student,
        term_year=term_year
    ).first()
    context['mention'] = mention_obj.get_mention_type_display() if mention_obj else "-"


    # --- E. ASSIDUITÉ ---
    stats = get_student_attendance_stats(student, term_year=term_year)
    context['attendance'] = stats

    return context