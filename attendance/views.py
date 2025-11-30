import json
from datetime import datetime

from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.utils import timezone

from users.models import Student
from classes.models import Class
from schools.models import TermYearLevel
from .models import AttendanceSession, Attendance

from users.utils import get_user_type
from schools.utils import get_current_year_for_school, get_user_school
from .utils import (
    get_attendance_classes_for_user,
    get_class_students_for_attendance,
    get_teacher_attendance_history,
    get_class_attendance_records,
    get_active_term_for_class,
    get_student_attendance_view_data
)

from schools.models import School

@login_required(login_url='login')
def attendance_hub_view(request):
    """
    Page 1 : Hub des classes pour l'appel.
    - Professeur : Voit ses classes -> Clic mène à la saisie.
    - CPE/Admin : Voit toutes les classes -> Clic mène à la gestion/justification.
    """
    user = request.user
    user_type = get_user_type(user)
   
    if user_type == "SuperAdministrator":
        school_id_filter = request.session.get('selected_school_id')
        school_filter = School.objects.get(id=school_id_filter)

    elif user_type in ["Teacher", "CPE", "Principal"]:
        school_filter = get_user_school(user, request.session.get('selected_school_id'))

    else:
        return HttpResponseForbidden("Accès refusé.")

    # Vérification Année Scolaire
    current_year = get_current_year_for_school(school_filter)
    if not current_year or not current_year.running:
        return render(request, 'attendance/class_hub.html', {
            'error_message': "L'année scolaire n'est pas active ou non définie."
        })

    # Récupération des classes via Utils
    classes_list = get_attendance_classes_for_user(user, current_year, user_type)

    # Détermination du rôle pour l'interface
    # Permet au template de savoir quelle URL générer pour chaque classe
    role_mode = "VIEWER" # Par défaut
    if user_type == "Teacher":
        role_mode = "TEACHER" # Fait l'appel
    elif user_type == "CPE":
        role_mode = "CPE" # Justifie
    elif user_type in ["Principal", "SuperAdministrator"]:
        role_mode = "ADMIN" # Lecture seule des justifications

    context = {
        'classes_list': classes_list,
        'current_year': current_year,
        'role_mode': role_mode,
        'user_type': user_type
    }

    return render(request, 'attendance/class_hub.html', context)


@login_required(login_url='login')
def create_attendance_session_view(request, class_id):
    """
    Page 2 : Formulaire de saisie d'un appel pour une classe spécifique.
    Accessible uniquement aux professeurs.
    """
    user = request.user
    user_type = get_user_type(user)

    if user_type != "Teacher":
        return HttpResponseForbidden("Accès refusé. Seuls les professeurs peuvent faire l'appel.")

    try:
        teacher_staff = user.staff_user
        student_class = get_object_or_404(Class, pk=class_id)
    except Exception:
        return HttpResponseForbidden("Erreur de profil ou de classe.")

    current_year = get_current_year_for_school(teacher_staff.school)
    if not current_year or not current_year.running:
        return HttpResponseForbidden("Année scolaire non active.")

    # 1. Récupérer les élèves de la classe
    students = get_class_students_for_attendance(student_class, current_year)

    # 2. Récupérer l'historique des appels
    history = get_teacher_attendance_history(teacher_staff, student_class, current_year)

    context = {
        'student_class': student_class,
        'teacher_staff': teacher_staff,
        'students': students,
        'history': history,
        'today': timezone.now().date().isoformat(),
        'current_time': timezone.now().strftime('%H:%M')
    }

    return render(request, 'attendance/create_session.html', context)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_save_attendance_session(request):
    """
    Enregistre ou met à jour une séance d'appel et les présences associées.
    """
    user = request.user
    user_type = get_user_type(user)

    if user_type != "Teacher":
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)

    try:
        data = json.loads(request.body)
        session_id = data.get('session_id') # Si update
        class_id = data.get('class_id')
        date_str = data.get('date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        attendances_data = data.get('attendances', []) # Liste [{student_id, status}, ...]

        teacher_staff = user.staff_user
        student_class = get_object_or_404(Class, pk=class_id)
        
        # Validation de la date et du trimestre
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({"success": False, "message": "Format de date invalide."}, status=400)

        try:
            school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
        except School.DoesNotExist:
            return JsonResponse({"success": False, "message": "L'école sélectionnée est introuvable."}, status=404) # TODO : return une page d'erreur
        
        if not school_filter:
            return JsonResponse({"success": False, "message": "L'école sélectionnée est introuvable."}, status=404) # TODO : return une page d'erreur
        
        elif not school_filter.is_active:
            return JsonResponse({"success": False, "message": "L'école sélectionnée est désactivée. Impossible de procéder."}, status=403) # TODO : return une page d'erreur
            
        current_year = get_current_year_for_school(school_filter)

        try: 
            if current_year.running == True:
                term_year = TermYearLevel.objects.get(level=student_class.level, year=current_year, finished=False)

                if not term_year:
                    return JsonResponse({"success": False, "message": "Aucun trimestre correspondant à cette date n'a été trouvé."}, status=400)
                
                if term_year.finished:
                    return JsonResponse({"success": False, "message": "Ce trimestre est clos. Impossible de modifier ou créer un appel."}, status=403)
            else:
                return JsonResponse({"success": False, "message": "L'année scolaire n'est pas active ou non définie."}, status=403) # TODO : return une page d'erreur
        except:
            return JsonResponse({"success": False, "message": "L'année scolaire n'est pas active ou non définie."}, status=403) # TODO : return une page d'erreur

        
        with transaction.atomic():
            # 1. Création ou Récupération de la Session
            if session_id:
                session = get_object_or_404(AttendanceSession, pk=session_id, teacher=teacher_staff)
                # Mise à jour des infos de base
                session.date = date_obj
                session.start_time = start_time
                session.end_time = end_time
                session.save()
            else:
                session = AttendanceSession.objects.create(
                    teacher=teacher_staff,
                    student_class=student_class,
                    term_year=term_year,
                    date=date_obj,
                    start_time=start_time,
                    end_time=end_time
                )

            # 2. Gestion des Absences/Retards
            # On récupère les IDs des élèves traités
            processed_student_ids = []

            for item in attendances_data:
                student_id = item.get('student_id')
                status = item.get('status') # 'ABSENCE', 'DELAY', ou '' (Présent)
                
                processed_student_ids.append(student_id)
                student = get_object_or_404(Student, pk=student_id)

                # Cherche une entrée existante pour cet élève dans cette session
                existing_att = Attendance.objects.filter(session=session, student=student).first()

                # Si l'absence est déjà justifiée, on NE TOUCHE PAS (Règle Métier)
                if existing_att and existing_att.justified:
                    continue 

                if status in ['ABSENCE', 'DELAY']:
                    # Création ou Mise à jour
                    Attendance.objects.update_or_create(
                        session=session,
                        student=student,
                        defaults={'status': status}
                    )
                else:
                    # L'élève est marqué PRÉSENT (ou statut vide)
                    # S'il y avait une absence INJUSTIFIÉE, on la supprime
                    if existing_att:
                        existing_att.delete()

        return JsonResponse({"success": True, "message": "Appel enregistré avec succès.", "session_id": session.id})

    except Exception as e:
        print(f"Erreur Save Attendance: {e}")
        return JsonResponse({"success": False, "message": str(e)}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_get_session_details(request):
    """
    Récupère les détails d'une session (pour modification).
    """
    try:
        data = json.loads(request.body)
        session_id = data.get('session_id')
        
        # Vérifie que la session appartient bien au prof connecté
        session = get_object_or_404(AttendanceSession, pk=session_id, teacher=request.user.staff_user)
        
        # Récupère les absences liées
        attendances = session.attendances.all()
        attendance_map = {}
        for att in attendances:
            attendance_map[att.student.id] = {
                'status': att.status,
                'justified': att.justified
            }
            
        return JsonResponse({
            "success": True,
            "data": {
                "id": session.id,
                "date": session.date.isoformat(),
                "start_time": session.start_time.strftime('%H:%M'),
                "end_time": session.end_time.strftime('%H:%M'),
                "attendances": attendance_map
            }
        })

    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=500)
    



@login_required(login_url='login')
def manage_attendance_view(request, class_id):
    """
    Page 3 : Tableau de bord de gestion des absences pour une classe.
    - CPE : Peut justifier (si trimestre actif).
    - Admin/Proviseur : Lecture seule.
    """
    user = request.user
    user_type = get_user_type(user)

    # 1. Permissions d'accès à la page
    if user_type not in ["CPE", "Principal", "SuperAdministrator"]:
        return HttpResponseForbidden("Accès refusé. Réservé à la Vie Scolaire et à l'Administration.")

    # 2. Récupération du contexte
    try:
        if user_type == "SuperAdministrator":
            school_id = request.session.get('selected_school_id')
            student_class = get_object_or_404(Class, pk=class_id, level__school_id=school_id)
            current_year = get_current_year_for_school(student_class.level.school)
        else:
            staff = user.staff_user
            student_class = get_object_or_404(Class, pk=class_id, level__school=staff.school)
            current_year = get_current_year_for_school(staff.school)
            
    except Exception:
        return HttpResponseForbidden("Erreur de récupération de la classe ou de l'école.")

    if not current_year or not current_year.running:
        return HttpResponseForbidden("Année scolaire non active.")

    # 3. Récupération des incidents (Absences/Retards)
    attendance_records = get_class_attendance_records(student_class, current_year)

    # 4. Vérification des droits d'édition (Justification)
    # Seul le CPE peut modifier, et seulement si le trimestre est actif.
    active_term = get_active_term_for_class(student_class)
    
    can_edit = False
    if user_type == "CPE":
        # Le CPE peut éditer si un trimestre est actif
        can_edit = (active_term is not None)

    context = {
        'student_class': student_class,
        'attendance_records': attendance_records,
        'can_edit': can_edit,
        'active_term': active_term,
        'user_type': user_type
    }

    return render(request, 'attendance/manage_attendance.html', context)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_justify_attendance(request):
    """
    API pour Justifier (ou dé-justifier) une absence/retard.
    Accessible uniquement au CPE.
    """
    user = request.user
    user_type = get_user_type(user)

    if user_type != "CPE":
        return JsonResponse({"success": False, "message": "Seul le CPE peut justifier les absences."}, status=403)

    try:
        data = json.loads(request.body)
        attendance_id = data.get('attendance_id')
        justified = data.get('justified') # True ou False
        reason = data.get('reason', '').strip()

        attendance = get_object_or_404(Attendance, pk=attendance_id)
        
        # Vérification du trimestre
        term_year = attendance.session.term_year
        if term_year.finished:
            return JsonResponse({"success": False, "message": "Impossible de modifier : le trimestre de cette absence est clos."}, status=403)

        # Mise à jour
        attendance.justified = justified
        attendance.justification_reason = reason if justified else "" # On vide la raison si on dé-justifie
        
        # La date de justification est gérée automatiquement par la méthode save() du modèle
        attendance.save()

        status_text = "Justifié" if justified else "Non justifié"
        return JsonResponse({
            "success": True, 
            "message": f"Statut mis à jour : {status_text}.",
            "justification_date": attendance.justification_date.strftime('%d/%m/%Y') if attendance.justification_date else None
        })

    except Exception as e:
        return JsonResponse({"success": False, "message": str(e)}, status=500)
    

@login_required(login_url='login')
def student_attendance_dashboard_view(request):
    """
    Page 4 : Tableau de bord d'assiduité pour l'ÉLÈVE connecté.
    """
    user = request.user
    user_type = get_user_type(user)

    if user_type != "Student":
        return HttpResponseForbidden("Accès refusé. Réservé aux élèves.")

    try:
        student = user.student_user
    except:
        return HttpResponseForbidden("Profil élève non trouvé.")

    current_year = get_current_year_for_school(student.school)
    if not current_year:
        return render(request, 'attendance/student_attendance.html', {
            'error_message': "Aucune année scolaire active."
        })

    data = get_student_attendance_view_data(student, current_year)

    if not data:
        return render(request, 'attendance/student_attendance.html', {
            'error_message': "Vous n'êtes inscrit dans aucune classe pour cette année."
        })

    context = {
        'student': student,
        'current_year': current_year,
        'student_class': data['student_class'],
        'terms_data': data['terms_data'],
        'global_stats': data['global_stats'],
        'current_term_stats': data.get('current_term_stats'), 
        'user_type': user_type
    }

    return render(request, 'attendance/student_attendance.html', context)