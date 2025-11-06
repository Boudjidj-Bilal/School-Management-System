from django.db.models import Q
from django.utils import timezone
from scheduling.models import ScheduledCourse
from schools.models import ExceptionDay, ExceptionTime
from subjects.models import TeacherSubject 
from classes.models import Class

from datetime import datetime
from datetime import timedelta

def _parse_iso_datetime(dt_string):
    """
    Helper pour parser les strings ISO 8601 de JS, y compris ceux finissant par 'Z'.
    """
    if dt_string.endswith('Z'):
        return datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
    return datetime.fromisoformat(dt_string)


def check_course_conflicts(courses_to_check, year):
    """
    Vérifie les conflits pour une liste de cours.
    Retourne une liste d'erreurs détaillant les problèmes trouvés.
    """
    all_errors = []

    # --- Pré-chargement des IDs de Professeur ---
    ts_ids = {course["teacher_subject_id"] for course in courses_to_check}
    ts_map = TeacherSubject.objects.filter(id__in=ts_ids).values('id', 'teacher__id')
    teacher_id_map = {item['id']: item['teacher__id'] for item in ts_map}
    
    # Modifie la liste 'courses_to_check' EN PLACE au lieu de la copier.
    # Cela préserve l'identité des dictionnaires pour la vue.
    valid_courses_for_check = []
    for course in courses_to_check:
        ts_id = course["teacher_subject_id"]
        teacher_id = teacher_id_map.get(ts_id)
        
        if not teacher_id:
            all_errors.append({"course": course, "reason": f"ID Prof/Matière {ts_id} invalide ou introuvable."})
        else:
            # [CORRIGÉ] Modifie le dictionnaire original en ajoutant une clé.
            course["teacher_id"] = teacher_id 
            valid_courses_for_check.append(course)
    
    # Les vérifications suivantes ne portent que sur les cours valides
    # (qui sont des RÉFÉRENCES aux originaux)
    courses_to_check = valid_courses_for_check 
    # --- Fin de la modification ---

    # Charger les données existantes pour l’année
    existing_courses = (
        ScheduledCourse.objects.filter(year=year)
        .select_related("teacher_subject__teacher", "classroom", "student_class") # Optimisation: inclure le professeur
    )

    exception_days = ExceptionDay.objects.filter(year=year)
    exception_times = ExceptionTime.objects.filter(year=year)

    # Étape 1 : Vérification temporelle (bornes année)
    all_errors += _check_time_bounds(courses_to_check, year)

    # Étape 2 : Vérification des jours d'exception
    all_errors += _check_exception_days(courses_to_check, exception_days)

    # Étape 3 : Vérification des horaires d'exception
    all_errors += _check_exception_times(courses_to_check, exception_times)

    # Étape 4 : Vérification des chevauchements avec les cours existants
    all_errors += _check_overlap_with_existing_courses(courses_to_check, existing_courses)

    # Étape 5 : Vérification des chevauchements internes
    all_errors += _check_internal_overlaps(courses_to_check)

    return all_errors


# -------------------- Vérifications unitaires -------------------- #

def _check_time_bounds(courses, year):
    """Vérifie que chaque cours respecte les bornes de l’année."""
    errors = []

    try:
        year_start_date = year.start_date.date()
        year_end_date = year.end_date.date()
        year_min_time = year.min_time
        year_max_time = year.max_time

        for course in courses:
            start_dt_aware = _parse_iso_datetime(course["start_datetime"])
            end_dt_aware = _parse_iso_datetime(course["end_datetime"])

            start_dt_local = timezone.localtime(start_dt_aware)
            end_dt_local = timezone.localtime(end_dt_aware)
            
            start_date_naive = start_dt_local.date()
            end_date_naive = end_dt_local.date()
            start_time_naive = start_dt_local.time()
            end_time_naive = end_dt_local.time()

            if start_date_naive < year_start_date or end_date_naive > year_end_date:
                errors.append({
                    "course": course,
                    "reason": "Le cours est en dehors des dates de l'année scolaire."
                })
            
            if start_time_naive < year_min_time or end_time_naive > year_max_time:
                errors.append({
                    "course": course,
                    "reason": f"Le cours ({start_time_naive}) dépasse les limites horaires ({year_min_time}-{year_max_time}) autorisées pour l'année."
                })
                
    except Exception as e:
        print(f"Erreur dans _check_time_bounds: {e}")
        errors.append({ "course": None, "reason": f"Erreur interne de validation d'heure : {e}" })

    return errors


def _check_exception_days(courses, exception_days):
    """Vérifie que le cours ne tombe pas sur un jour d’exception (vacances, jour férié...)."""
    errors = []
    if not exception_days.exists():
        return errors

    for course in courses:
        try:
            start_dt_aware = _parse_iso_datetime(course["start_datetime"])
            start_date_local = timezone.localtime(start_dt_aware).date()
            
            for ex_day in exception_days:
                if ex_day.start_date <= start_date_local <= ex_day.end_date:
                    errors.append({
                        "course": course,
                        "reason": f"Le cours tombe pendant une période exceptionnelle ({ex_day.type})."
                    })
                    break 
        except Exception as e:
            print(f"Erreur dans _check_exception_days: {e}")

    return errors


def _check_exception_times(courses, exception_times):
    """Vérifie que le créneau horaire ne touche pas un créneau d’exception."""
    errors = []
    if not exception_times.exists():
        return errors

    for course in courses:
        try:
            start_dt_aware = _parse_iso_datetime(course["start_datetime"])
            end_dt_aware = _parse_iso_datetime(course["end_datetime"])

            start_t = timezone.localtime(start_dt_aware).time()
            end_t = timezone.localtime(end_dt_aware).time()

            for ex_time in exception_times:
                # Formule de chevauchement stricte (correcte)
                if (start_t < ex_time.end_time) and (end_t > ex_time.start_time):
                    errors.append({
                        "course": course,
                        "reason": f"Le cours ({start_t}-{end_t}) chevauche un horaire exceptionnel (ex: pause {ex_time.start_time}-{ex_time.end_time})."
                    })
                    break 
        except Exception as e:
            print(f"Erreur dans _check_exception_times: {e}")

    return errors


def _check_overlap_with_existing_courses(courses, existing_courses):
    """Vérifie les chevauchements (partiels ou totaux) avec les cours existants de l’année."""
    errors = []
    if not existing_courses.exists():
        return errors

    for new_course in courses:
        try:
            start_dt = _parse_iso_datetime(new_course["start_datetime"])
            end_dt = _parse_iso_datetime(new_course["end_datetime"])
            
            for existing in existing_courses:
                # Condition de chevauchement (comparaison aware vs aware)
                if (start_dt < existing.end_datetime) and (end_dt > existing.start_datetime):

                    # 1. Conflit professeur
                    # Compare le 'teacher_id' (Staff ID) du nouveau cours
                    # avec le 'teacher_id' (Staff ID) du cours existant.
                    if existing.teacher_subject.teacher.id == new_course["teacher_id"]:
                        errors.append({
                            "course": new_course,
                            "reason": f"Le professeur ({existing.teacher_subject.teacher}) a déjà un cours sur ce créneau (Classe: {existing.student_class.name}).",
                            "conflicting_course_id": existing.id
                        })

                    # 2. Conflit salle
                    if existing.classroom.id == new_course["classroom_id"]:
                        errors.append({
                            "course": new_course,
                            "reason": f"La salle ({existing.classroom.name}) est déjà occupée sur ce créneau.",
                            "conflicting_course_id": existing.id
                        })

                    # 3. Conflit classe
                    if existing.student_class.id == new_course["student_class_id"]:
                        errors.append({
                            "course": new_course,
                            "reason": "La classe a déjà un cours sur ce créneau.",
                            "conflicting_course_id": existing.id
                        })
        except Exception as e:
            print(f"Erreur dans _check_overlap_with_existing_courses: {e}")

    return errors


def _check_internal_overlaps(courses):
    """Vérifie les chevauchements entre les nouveaux cours (dans la même requête)."""
    errors = []
    if len(courses) < 2:
        return errors

    for i, c1 in enumerate(courses):
        try:
            start1 = _parse_iso_datetime(c1["start_datetime"])
            end1 = _parse_iso_datetime(c1["end_datetime"])

            for j, c2 in enumerate(courses):
                if i >= j:
                    continue 

                start2 = _parse_iso_datetime(c2["start_datetime"])
                end2 = _parse_iso_datetime(c2["end_datetime"])

                # Condition de chevauchement (comparaison aware vs aware)
                if (start1 < end2) and (end1 > start2):
                    
                    # [MODIFIÉ] 1. Conflit Professeur
                    if c1["teacher_id"] == c2["teacher_id"]:
                        errors.append({
                            "course": c1,
                            "reason": "Conflit interne: Le même professeur est assigné à deux cours en même temps.",
                            "conflict_with": c2
                        })

                    # 2. Conflit Salle
                    if c1["classroom_id"] == c2["classroom_id"]:
                        errors.append({
                            "course": c1,
                            "reason": "Conflit interne: La même salle est utilisée pour deux cours en même temps.",
                            "conflict_with": c2
                        })

                    # 3. Conflit Classe
                    if c1["student_class_id"] == c2["student_class_id"]:
                        errors.append({
                            "course": c1,
                            "reason": "Conflit interne: La même classe a deux cours en même temps.",
                            "conflict_with": c2
                        })
        except Exception as e:
            print(f"Erreur dans _check_internal_overlaps: {e}")

    return errors

def get_week_schedule_data(classe, start_of_week):
    """
    Récupère et formate les cours pour une classe et une semaine données.
    """
    
    # Calcule la plage de dates (du Lundi 00:00 au Lundi suivant 00:00)
    start_date = start_of_week
    end_date = start_of_week + timedelta(days=7) # 7 jours complets
    # ============================================================
    # ERREUR NAVIGATION ENTRE LES SEMAINES VIENS PEUT ETRE D'ICI.
    # ============================================================
    # Interroge la BDD
    courses = ScheduledCourse.objects.filter(
        student_class=classe,
        start_datetime__gte=start_date, # Commence pendant la semaine
        start_datetime__lt=end_date     # (exclusif)
    ).select_related(
        'teacher_subject__teacher__user', # Optimisation pour le nom du prof
        'teacher_subject__subject',       # Optimisation pour le nom et la couleur
        'classroom'                       # Optimisation pour le nom de la salle
    ).order_by('start_datetime') # Important pour l'affichage
    
    courses_data = []
    for course in courses:
        
        # [CORRECTION] Convertir les datetimes UTC de la BDD en heure LOCALE
        # (ex: 06:00+00:00 devient 08:00 en France)
        start_local = timezone.localtime(course.start_datetime)
        end_local = timezone.localtime(course.end_datetime)
        
        courses_data.append({
            'id': course.id,
            'start_datetime': course.start_datetime.isoformat(), # Gardé pour info
            'end_datetime': course.end_datetime.isoformat(),     # Gardé pour info
            
            # --- [AJOUTÉ] Les champs clés manquants pour le JS ---
            'start_time_local': start_local.strftime('%H:%M'), # ex: "08:30"
            'end_time_local': end_local.strftime('%H:%M'),   # ex: "09:45"
            # --- Fin de l'ajout ---
            
            'status': course.status,
            'status_display': course.status,
            
            'subject_name': course.teacher_subject.subject.name,
            'teacher_name': course.teacher_subject.teacher.user.username, # Ajuste si tu préfères last_name
            'classroom_name': course.classroom.name,
            'subject_color': course.teacher_subject.subject.color,
        })
        
    return courses_data


def get_week_schedule_data_for_teacher(teacher_staff, start_of_week):
    """
    Récupère et formate les cours pour un PROFESSEUR spécifique et une semaine donnée.
    
    Prend en entrée un objet Staff (le professeur) et un objet Date (le Lundi).
    
    Retourne une liste de dictionnaires formatés pour le JSON, contenant
    le nom de la CLASSE au lieu du nom du professeur.
    """
    
    # 1. Calcule la plage de dates (du Lundi 00:00 au Lundi suivant 00:00)
    start_date = start_of_week
    end_date = start_of_week + timedelta(days=7) # 7 jours complets
    
    # 2. Interroge la BDD
    # La logique clé est de filtrer par 'teacher_subject__teacher'
    courses = ScheduledCourse.objects.filter(
        teacher_subject__teacher=teacher_staff,
        start_datetime__gte=start_date, # Commence pendant la semaine
        start_datetime__lt=end_date     # (exclusif)
    ).select_related(
        'teacher_subject__subject',       # Optimisation pour le nom et la couleur
        'classroom',                      # Optimisation pour le nom de la salle
        'student_class'                   # Optimisation pour le nom de la classe
    ).order_by('start_datetime')
    
    courses_data = []
    for course in courses:
        
        # 3. Convertir les datetimes UTC de la BDD en heure LOCALE
        start_local = timezone.localtime(course.start_datetime)
        end_local = timezone.localtime(course.end_datetime)
        
        courses_data.append({
            'id': course.id,
            'start_datetime': course.start_datetime.isoformat(),
            'end_datetime': course.end_datetime.isoformat(),
            
            # Heures locales pour l'affichage
            'start_time_local': start_local.strftime('%H:%M'),
            'end_time_local': end_local.strftime('%H:%M'),
            
            # Statut du cours
            'status': course.status,
            'status_display': course.status,
            
            # Informations sur le cours
            'subject_name': course.teacher_subject.subject.name,
            'subject_color': course.teacher_subject.subject.color,
            'classroom_name': course.classroom.name,
            
            # [DIFFÉRENCE CLÉ] : On renvoie le nom de la classe
            'class_name': course.student_class.name, 
        })
        
    return courses_data
