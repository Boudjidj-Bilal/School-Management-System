from django.db.models import Sum, F, ExpressionWrapper, FloatField
from django.utils import timezone
from django.shortcuts import get_object_or_404 

from .models import Evaluation, Grade, Appreciation, Mention
from schools.models import TermYearLevel
from subjects.models import TeacherSubject
from classes.models import ClassTeacherYear, ClassStudentYear, Class, Level

# ====================================================================
# FONCTIONS DE CALCUL DE MOYENNE
# ====================================================================

def get_evaluations_for_subject(teacher_subject, student_class, term_year):
    """
    1. Récupère toutes les évaluations (devoirs) pour un prof/matière, 
       une classe et un trimestre donnés.
    """
    return Evaluation.objects.filter(
        teacher_subject=teacher_subject,
        student_class=student_class,
        term_year=term_year
    ).prefetch_related(
        'student_grades'
    ).order_by('date')


def calculate_student_subject_average(student, teacher_subject, term_year):
    """
    2. Calcule la moyenne PONDÉRÉE d'un ÉLÈVE pour UNE matière 
       dans un trimestre donné.
       [MODIFIÉ] Gère la normalisation des notes (max_grade).
    """
    # Récupère toutes les notes valides (non-absent, non-nul)
    grades = Grade.objects.filter(
        student=student,
        evaluation__teacher_subject=teacher_subject,
        evaluation__term_year=term_year,
        is_absent=False,
        grade_value__isnull=False
    )

    # [NOUVELLE LOGIQUE]
    # Crée une expression pour 'note normalisée sur 20'
    # (note / max_grade) * 20
    normalized_grade_expr = ExpressionWrapper(
        (F('grade_value') / F('evaluation__max_grade')) * 20.0,
        output_field=FloatField()
    )
    
    # Crée une expression pour 'note_normalisée * coefficient'
    weighted_grade_expr = ExpressionWrapper(
        normalized_grade_expr * F('evaluation__coefficient'),
        output_field=FloatField()
    )

    # Calcule la somme des (note_normalisée * coeff) et la somme des (coeff)
    result = grades.aggregate(
        total_weighted=Sum(weighted_grade_expr),
        total_coeff=Sum('evaluation__coefficient')
    )

    total_weighted = result.get('total_weighted')
    total_coeff = result.get('total_coeff')

    # Évite la division par zéro
    if total_coeff is not None and total_coeff > 0 and total_weighted is not None:
        average = total_weighted / total_coeff
        return round(average, 2)
    
    return None # Aucune note valide trouvée



def calculate_subject_class_average(student_class, teacher_subject, term_year):
    """
    3. Calcule la moyenne PONDÉRÉE d'une CLASSE pour UNE matière 
       dans un trimestre donné.
       [MODIFIÉ] Gère la normalisation des notes (max_grade).
    """
    # C'est la même logique que pour l'élève, mais filtrée sur la classe
    grades = Grade.objects.filter(
        evaluation__student_class=student_class,
        evaluation__teacher_subject=teacher_subject,
        evaluation__term_year=term_year,
        is_absent=False,
        grade_value__isnull=False
    )
    
    # [NOUVELLE LOGIQUE]
    # Crée une expression pour 'note normalisée sur 20'
    # (note / max_grade) * 20
    normalized_grade_expr = ExpressionWrapper(
        (F('grade_value') / F('evaluation__max_grade')) * 20.0,
        output_field=FloatField()
    )

    # Crée une expression pour 'note_normalisée * coefficient'
    weighted_grade_expr = ExpressionWrapper(
        normalized_grade_expr * F('evaluation__coefficient'),
        output_field=FloatField()
    )
    
    result = grades.aggregate(
        total_weighted=Sum(weighted_grade_expr),
        total_coeff=Sum('evaluation__coefficient')
    )

    total_weighted = result.get('total_weighted')
    total_coeff = result.get('total_coeff')

    if total_coeff is not None and total_coeff > 0 and total_weighted is not None:
        average = total_weighted / total_coeff
        return round(average, 2)
    
    return None # Aucune note valide

def calculate_overall_class_average(student_class, term_year):
    """
    4. Calcule la moyenne GÉNÉRALE d'une CLASSE (toutes matières)
       pour un trimestre donné.
       
    [MODIFIÉ] NOUVELLE LOGIQUE :
    Calcule la moyenne des "Moyennes Générales" de chaque élève de la classe.
    """
    
    # 1. Récupérer l'année scolaire via le trimestre
    current_year = term_year.year

    # 2. Récupérer tous les élèves inscrits dans cette classe pour cette année
    students_in_class = ClassStudentYear.objects.filter(
        student_class=student_class,
        year=current_year,
        is_active=True
    )

    if not students_in_class.exists():
        return None

    valid_student_averages = []

    # 3. Pour chaque élève, calculer sa moyenne générale
    for link in students_in_class:
        student = link.student
        
        # On appelle la fonction existante qui calcule la moyenne générale d'un élève
        # (Celle-ci boucle déjà sur toutes les matières de l'élève)
        student_avg = calculate_overall_student_average(student, term_year)
        
        if student_avg is not None:
            valid_student_averages.append(student_avg)

    # 4. Faire la moyenne de ces moyennes
    if valid_student_averages:
        overall_avg = sum(valid_student_averages) / len(valid_student_averages)
        return round(overall_avg, 2)
        
    return None

def calculate_overall_student_average(student, term_year):
    """
    5. Calcule la moyenne GÉNÉRALE d'un ÉLÈVE (toutes matières)
       pour un trimestre donné.
       
    (Ceci calcule la moyenne des moyennes de chaque matière pour cet élève)
    """
    
    # 1. Trouve toutes les matières pour lesquelles l'élève a une note ce trimestre
    teacher_subjects = TeacherSubject.objects.filter(
        evaluations__student_grades__student=student,
        evaluations__term_year=term_year
    ).distinct()

    if not teacher_subjects.exists():
        return None # L'élève n'a aucune note ce trimestre

    subject_averages = []
    
    # 2. Calcule la moyenne de l'élève pour chaque matière
    for ts in teacher_subjects:
        subject_avg = calculate_student_subject_average(
            student, 
            ts, 
            term_year
        )
        if subject_avg is not None:
            subject_averages.append(subject_avg)

    # 3. Calcule la moyenne générale (moyenne des moyennes)
    if subject_averages:
        overall_avg = sum(subject_averages) / len(subject_averages)
        return round(overall_avg, 2)
        
    return None

# ====================================================================
# FONCTIONS DE RÉCUPÉRATION DE DONNÉES (Pour les Vues)
# ====================================================================

def get_grades_data_for_specific_context(teacher_staff, current_year, student_class, teacher_subject_id, selected_term):
    """
    [MODIFIÉ] Récupère les données (évals, moyennes) pour UN SEUL CONTEXTE
    """
    
    if not selected_term:
        return {
            'evaluations': [],
            'class_average': 'N/A',
            'student_averages': [],
            'overall_class_average': 'N/A'
        }

    students_in_class = ClassStudentYear.objects.filter(
        student_class=student_class, 
        year=current_year, 
        is_active=True
    ).select_related('student', 'student__user')

    data_payload = {}

    if teacher_subject_id:
        ts = get_object_or_404(TeacherSubject, pk=teacher_subject_id)
        
        evaluations = get_evaluations_for_subject(ts, student_class, selected_term)
        
        data_payload['evaluations'] = list(evaluations.values(
            'id', 
            'name', 
            'date', 
            'coefficient',
            'max_grade'
        ))
        
        avg = calculate_subject_class_average(student_class, ts, selected_term)
        data_payload['class_average'] = avg if avg is not None else "N/A"

        student_averages_list = []
        for class_student in students_in_class:
            student_avg = calculate_student_subject_average(class_student.student, ts, selected_term)
            student_averages_list.append({
                'student_id': class_student.student.id,
                'student_name': f"{class_student.student.user.first_name} {class_student.student.user.last_name}",
                'average': student_avg if student_avg is not None else "N/A"
            })
        data_payload['student_averages'] = student_averages_list

    else: # Mode Prof Principal
        overall_class_avg = calculate_overall_class_average(student_class, selected_term)
        data_payload['overall_class_average'] = overall_class_avg if overall_class_avg is not None else "N/A"
        
        student_averages_list = []
        for class_student in students_in_class:
            student = class_student.student
            avg = calculate_overall_student_average(student, selected_term)
            student_averages_list.append({
                'student_id': student.id,
                'student_name': f"{student.user.first_name} {student.user.last_name}",
                'average': avg if avg is not None else "N/A"
            })
        data_payload['student_averages'] = student_averages_list

    return data_payload


def get_student_grades_view_data(student, current_year):
    """
    Récupère toutes les données de notes pour l'interface d'un ÉLÈVE.
    Retourne un dictionnaire structuré par trimestre.
    """
    
    # 1. Trouver la classe de l'élève pour l'année en cours
    try:
        student_class_link = ClassStudentYear.objects.get(
            student=student,
            year=current_year,
            is_active=True
        )
        student_class = student_class_link.student_class
    except ClassStudentYear.DoesNotExist:
        return None # L'élève n'est pas inscrit cette année

    # 2. Récupérer les trimestres/semestres pour le niveau de cette classe
    terms = TermYearLevel.objects.filter(
        year=current_year,
        level=student_class.level
    ).order_by('start_date')

    # 3. Récupérer les matières enseignées dans cette classe
    class_teachers = ClassTeacherYear.objects.filter(
        student_class=student_class,
        year=current_year,
        is_active=True
    ).select_related('teacher', 'teacher__subject').order_by('teacher__subject__name')

    terms_data = []

    # 4. Boucle sur chaque trimestre
    for term in terms:
        term_payload = {
            'term_id': term.id,
            'term_name': f"Trimestre {term.counter}" if student_class.level.term_type == "TRIMESTRE" else f"Semestre {term.counter}",
            'is_active': not term.finished,
            'subjects': [],
            'overall_student_average': 'N/A',
            'overall_class_average': 'N/A'
        }

        # Calcul des moyennes générales
        stud_overall = calculate_overall_student_average(student, term)
        class_overall = calculate_overall_class_average(student_class, term)
        
        term_payload['overall_student_average'] = stud_overall if stud_overall is not None else "N/A"
        term_payload['overall_class_average'] = class_overall if class_overall is not None else "N/A"

        # Boucle sur les matières
        for link in class_teachers:
            ts = link.teacher 
            
            evaluations = Evaluation.objects.filter(
                teacher_subject=ts,
                student_class=student_class,
                term_year=term
            ).order_by('date')
            
            subject_data = {
                'subject_name': ts.subject.name,
                'subject_color': ts.subject.color,
                'teacher_name': f"{ts.teacher.user.last_name} {ts.teacher.user.first_name}",
                'student_average': 'N/A',
                'class_average': 'N/A',
                'grades': []
            }

            # Calcul des moyennes par matière
            stud_subj_avg = calculate_student_subject_average(student, ts, term)
            class_subj_avg = calculate_subject_class_average(student_class, ts, term)
            
            if stud_subj_avg is not None:
                subject_data['student_average'] = stud_subj_avg
            if class_subj_avg is not None:
                subject_data['class_average'] = class_subj_avg

            # Détail des notes
            for evaluation in evaluations:
                grade_obj = Grade.objects.filter(evaluation=evaluation, student=student).first()
                
                grade_info = {
                    'evaluation_name': evaluation.name,
                    'date': evaluation.date,
                    'coefficient': evaluation.coefficient,
                    'max_grade': evaluation.max_grade,
                    
                    # [AJOUT ICI] On passe l'info "Note Principale" au template
                    'is_main_grade': evaluation.is_main_grade, 
                    
                    'value': 'N/A',
                    'is_absent': False,
                }

                if grade_obj:
                    if grade_obj.is_absent:
                        grade_info['value'] = "ABS"
                        grade_info['is_absent'] = True
                    elif grade_obj.grade_value is not None:
                        grade_info['value'] = grade_obj.grade_value
                else:
                    grade_info['value'] = "-" 

                subject_data['grades'].append(grade_info)

            term_payload['subjects'].append(subject_data)
        
        terms_data.append(term_payload)

    return {
        'student': student,
        'student_class': student_class,
        'terms_data': terms_data
    }


# ====================================================================
# FONCTIONS POUR LE TABLEAU DE BORD DES APPRÉCIATIONS
# ====================================================================

def get_appreciations_data_for_context(current_year, student_class, teacher_subject_id, selected_term, is_global=False):
    # ... (fonction inchangée) ...
    if not selected_term:
        return {'students_data': []}

    # 1. Récupérer les élèves
    students_in_class = ClassStudentYear.objects.filter(
        student_class=student_class, 
        year=current_year, 
        is_active=True
    ).select_related('student', 'student__user').order_by('student__user__last_name')

    students_data = []
    
    # 2. Pré-charger les appréciations pour éviter N requêtes
    appreciations_qs = Appreciation.objects.filter(
        term_year=selected_term,
        student__in=[link.student for link in students_in_class],
        is_global=is_global
    )
    
    if not is_global and teacher_subject_id:
        appreciations_qs = appreciations_qs.filter(teacher_subject_id=teacher_subject_id)
    
    # Dictionnaire pour accès rapide : {student_id: appreciation_obj}
    appreciations_map = {app.student_id: app for app in appreciations_qs}

    # 3. Pré-charger les mentions (Uniquement si Global)
    mentions_map = {}
    if is_global:
        mentions_qs = Mention.objects.filter(
            term_year=selected_term,
            student__in=[link.student for link in students_in_class]
        )
        mentions_map = {m.student_id: m.mention_type for m in mentions_qs}

    # 4. Construire la liste finale
    for link in students_in_class:
        student = link.student
        appreciation = appreciations_map.get(student.id)
        
        student_info = {
            'student_id': student.id,
            'name': f"{student.user.last_name} {student.user.first_name}",
            'appreciation_content': appreciation.content if appreciation else "",
            'appreciation_id': appreciation.id if appreciation else None,
        }
        
        if is_global:
            student_info['mention'] = mentions_map.get(student.id, "")

        students_data.append(student_info)

    return {'students_data': students_data}


def get_grades_dashboard_data(teacher_staff, current_year):
    # ... (Code existant pour le dashboard notes prof) ...
    teacher_subjects_links = ClassTeacherYear.objects.filter(
        teacher__teacher=teacher_staff,
        year=current_year,
        is_active=True
    ).select_related('student_class__level', 'teacher__subject').order_by('student_class__name', 'teacher__subject__name')

    main_classes_links = teacher_subjects_links.filter(is_main_teacher=True)
    main_classes = list(set([link.student_class for link in main_classes_links]))

    taught_classes_data = {}
    taught_classes_list_for_template = []

    for link in teacher_subjects_links:
        student_class = link.student_class
        ts = link.teacher
        
        terms_for_level = TermYearLevel.objects.filter(year=current_year, level=student_class.level).order_by('start_date')
        
        today = timezone.now().date()
        current_term = terms_for_level.filter(start_date__lte=today, end_date__gte=today).first()
        if not current_term: current_term = terms_for_level.first()
        
        context_data = get_grades_data_for_specific_context(teacher_staff, current_year, student_class, ts.id, current_term)
        context_data['available_terms'] = list(terms_for_level.values('id', 'counter', 'start_date', 'end_date'))
        context_data['current_term_id'] = current_term.id if current_term else None
        
        key = f"{student_class.id}-{ts.id}"
        taught_classes_data[key] = context_data

        list_item = context_data.copy()
        list_item.update({'key': key, 'student_class': student_class, 'teacher_subject': ts})
        taught_classes_list_for_template.append(list_item)

    main_class_data = {}
    for main_class in main_classes:
        terms_for_level = TermYearLevel.objects.filter(year=current_year, level=main_class.level).order_by('start_date')
        today = timezone.now().date()
        current_term = terms_for_level.filter(start_date__lte=today, end_date__gte=today).first()
        if not current_term: current_term = terms_for_level.first()

        context_data = get_grades_data_for_specific_context(teacher_staff, current_year, main_class, None, current_term)
        context_data['class_name'] = main_class.name
        context_data['available_terms'] = list(terms_for_level.values('id', 'counter', 'start_date', 'end_date'))
        context_data['current_term_id'] = current_term.id if current_term else None

        main_class_data[str(main_class.id)] = context_data

    return {
        'taught_classes_data': taught_classes_data,
        'main_class_data': main_class_data,
        'taught_classes_list_for_template': taught_classes_list_for_template
    }


def get_appreciations_dashboard_data(teacher_staff, current_year):
    taught_subjects_ids = TeacherSubject.objects.filter(teacher=teacher_staff).values_list('id', flat=True)
    teacher_subjects_links = ClassTeacherYear.objects.filter(teacher__id__in=taught_subjects_ids, year=current_year, is_active=True).select_related('student_class__level', 'teacher__subject').order_by('student_class__name', 'teacher__subject__name')
    main_classes_links = teacher_subjects_links.filter(is_main_teacher=True)
    main_classes = list(set([link.student_class for link in main_classes_links]))

    taught_classes_list = []
    for link in teacher_subjects_links:
        student_class = link.student_class
        ts = link.teacher
        terms_for_level = TermYearLevel.objects.filter(year=current_year, level=student_class.level).order_by('start_date')
        today = timezone.now().date()
        editable_term = terms_for_level.filter(start_date__lte=today, end_date__gte=today, finished=False).first()
        if not editable_term: editable_term = terms_for_level.filter(finished=False).first()
        display_term = editable_term if editable_term else terms_for_level.last()
        editable_term_id = editable_term.id if editable_term else None

        context_data = get_appreciations_data_for_context(current_year, student_class, ts.id, display_term, is_global=False)
        context_data.update({
            'key': f"{student_class.id}-{ts.id}",
            'student_class': {'id': student_class.id, 'name': student_class.name},
            'teacher_subject': {'id': ts.id, 'subject': {'name': ts.subject.name, 'color': ts.subject.color}},
            'available_terms': list(terms_for_level.values('id', 'counter', 'start_date', 'end_date', 'finished')),
            'current_term_id': editable_term_id
        })
        taught_classes_list.append(context_data)

    main_classes_data = {}
    for main_class in main_classes:
        terms_for_level = TermYearLevel.objects.filter(year=current_year, level=main_class.level).order_by('start_date')
        today = timezone.now().date()
        editable_term = terms_for_level.filter(start_date__lte=today, end_date__gte=today, finished=False).first()
        if not editable_term: editable_term = terms_for_level.filter(finished=False).first()
        display_term = editable_term if editable_term else terms_for_level.last()
        editable_term_id = editable_term.id if editable_term else None

        context_data = get_appreciations_data_for_context(current_year, main_class, None, display_term, is_global=True)
        context_data.update({
            'class_name': main_class.name,
            'available_terms': list(terms_for_level.values('id', 'counter', 'start_date', 'end_date', 'finished')),
            'current_term_id': editable_term_id,
            'mentions_choices': Mention.MENTION_CHOICES,
        })
        main_classes_data[str(main_class.id)] = context_data

    return {'taught_classes_list': taught_classes_list, 'main_classes_data': main_classes_data}


def get_dashboard_grades_summary(student, current_year):
    """
    Récupère les données pour le widget Notes (Élève).
    """
    if not student or not current_year:
        return None

    # 1. Dernières notes
    last_grades_qs = Grade.objects.filter(
        student=student,
        evaluation__term_year__year=current_year
    ).select_related('evaluation', 'evaluation__teacher_subject__subject').order_by('-evaluation__date')[:5]

    last_grades = []
    for grade in last_grades_qs:
        val_display = "ABS"
        if grade.grade_value is not None:
             val_display = grade.grade_value
        
        last_grades.append({
            'subject': grade.evaluation.teacher_subject.subject.name,
            'color': grade.evaluation.teacher_subject.subject.color,
            'value': val_display,
            'max': grade.evaluation.max_grade,
            'date': grade.evaluation.date
        })

    # 2. Moyenne du trimestre ACTIF
    today = timezone.now().date()
    
    # On cherche le niveau de l'élève
    try:
        link = ClassStudentYear.objects.get(student=student, year=current_year, is_active=True)
        level = link.student_class.level
    except ClassStudentYear.DoesNotExist:
        return {'last_grades': last_grades, 'average': "N/A", 'term_name': "-"}

    # Cherche trimestre actif
    active_term = TermYearLevel.objects.filter(year=current_year, level=level, start_date__lte=today, end_date__gte=today).first()
    if not active_term: active_term = TermYearLevel.objects.filter(year=current_year, level=level, finished=False).order_by('start_date').first()
    if not active_term: active_term = TermYearLevel.objects.filter(year=current_year, level=level).last()

    overall_average = "N/A"
    term_name = "Aucune période"
    
    if active_term:
        avg = calculate_overall_student_average(student, active_term)
        if avg: overall_average = avg
        term_name = f"{active_term.level.term_type.capitalize()} {active_term.counter}"

    return {
        'last_grades': last_grades,
        'average': overall_average,
        'term_name': term_name
    }

# --- STATISTIQUES ÉCOLE (KPIs) ---

def get_dashboard_school_grades_stats(school, current_year):
    """
    Récupère les statistiques pédagogiques pour le Proviseur/SuperAdmin.
    Calcule la moyenne globale de l'école et les moyennes par niveau
    pour le trimestre actif.
    """
    if not school or not current_year:
        return {'by_level': [], 'global_average': "N/A"}

    # 1. Récupérer tous les niveaux de l'école
    levels = Level.objects.filter(school=school)
    
    stats_by_level = []
    total_school_sum = 0
    total_classes_count = 0

    today = timezone.now().date()

    for level in levels:
        # Trouver le trimestre actif pour ce niveau
        active_term = TermYearLevel.objects.filter(
            year=current_year,
            level=level,
            start_date__lte=today,
            end_date__gte=today
        ).first()
        
        # Fallback si pas de date active
        if not active_term:
            active_term = TermYearLevel.objects.filter(year=current_year, level=level, finished=False).first()
        if not active_term:
            active_term = TermYearLevel.objects.filter(year=current_year, level=level).last()

        if not active_term:
            continue

        # Récupérer les classes de ce niveau
        classes = Class.objects.filter(level=level, is_valid=True)
        
        level_sum = 0
        valid_classes_in_level = 0

        for student_class in classes:
            # On utilise TA fonction qui calcule la moyenne de la classe
            # (basée sur la moyenne des élèves)
            class_avg = calculate_overall_class_average(student_class, active_term)
            
            if class_avg is not None:
                level_sum += class_avg
                valid_classes_in_level += 1
                
                # Accumulateurs pour la moyenne globale de l'école
                total_school_sum += class_avg
                total_classes_count += 1

        if valid_classes_in_level > 0:
            level_avg = level_sum / valid_classes_in_level
            stats_by_level.append({
                'level_name': level.level, # Ex: "6E", "5E"
                'average': round(level_avg, 2),
                'term': f"{active_term.level.term_type.capitalize()} {active_term.counter}"
            })

    # Moyenne Globale de l'École
    # (On fait la moyenne des moyennes de classes pour ne pas déséquilibrer si une classe a bcp d'élèves)
    global_average = "N/A"
    if total_classes_count > 0:
        global_average = round(total_school_sum / total_classes_count, 2)
    
    # Tri par nom de niveau pour un affichage propre (ex: 6E, 5E...)
    # Note: Le tri alphabétique n'est pas parfait pour les niveaux, mais suffisant pour l'instant
    stats_by_level.sort(key=lambda x: x['level_name'])

    return {
        'by_level': stats_by_level,
        'global_average': global_average
    }