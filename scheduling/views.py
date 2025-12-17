import json
import datetime
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, render, redirect
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError, transaction
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.db.models import F # Assurez-vous d'importer F en haut du fichier
from django.utils import timezone

# Import des modèles
from scheduling.models import WeeklyScheduleTemplate, CourseTemplate, ScheduledCourse
from schools.models import Year, ExceptionDay, ExceptionTime
from classes.models import Class, Classroom, ClassTeacherYear, ClassStudentYear
from users.models import Staff, Student


# Import des utilitaires
from .utils import check_course_conflicts, get_week_schedule_data, get_week_schedule_data_for_teacher
from users.utils import get_user_type, get_student_context
from schools.utils import get_current_year_for_school


@login_required(login_url='login')
def schedul_management_view(request, pk_class):
    """
    Affiche la page principale interactive de gestion des plannings.
    """
    user_type = get_user_type(request.user)
    
    # Vérifie si l'utilisateur a la permission de créer des cours
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return HttpResponseForbidden("Accès refusé. Vous n'avez pas les droits nécessaires pour gérer les plannings.")
    
    try:
        classe = Class.objects.get(pk=pk_class)
        school = classe.level.school

        if not school.is_active:
            return JsonResponse({"success": False, "message": "L'école sélectionnée est désactivé."}, status=404) # TODO : Retourner une page d'erreur (qui déonnecte l'utilisateur)

        current_year = get_current_year_for_school(school)

        if not current_year:
            return JsonResponse({"success": False, "message": "Aucune année scolaire courante n'est définie."}, status=404)# TODO : Retourner une page d'erreur (qui déonnecte l'utilisateur)
        
        if current_year.creation:
            return JsonResponse({"success": False, "message": "Impossible de gérer le planning lorsque l'année est à l'étape de création."}, status=404)# TODO : Retourner une page d'erreur (qui déonnecte l'utilisateur)


        # --- 1. Récupération des QuerySets (inchangé) ---
        classrooms = Classroom.objects.filter(school=school)
        teacher_subjects = ClassTeacherYear.objects.filter(student_class=classe, year=current_year)
        exception_days = ExceptionDay.objects.filter(year=current_year)
        exception_times = ExceptionTime.objects.filter(year=current_year)
        weekly_scheduling_templates = WeeklyScheduleTemplate.objects.filter(year=current_year, student_class=classe)
        course_templates = CourseTemplate.objects.filter(weekly_template__in=weekly_scheduling_templates) 

        # --- 2. Conversion des QuerySets en listes de dictionnaires pour JSON ---
        # C'est la partie cruciale. Nous utilisons .values() pour sélectionner
        # les champs exacts dont le JS a besoin (y compris les champs liés avec __)
        # et list() pour forcer l'évaluation.
        
        classrooms_data = list(classrooms.values('pk', 'name', 'is_active'))
        
        exception_days_data = list(exception_days.values(
            'pk', 
            'start_date', 
            'end_date', 
            'type'
        ))

        exception_times_data = list(exception_times.values(
            'pk', 
            'start_time', 
            'end_time'
        ))

        weekly_scheduling_templates_data = list(weekly_scheduling_templates.values('pk', 'name'))

        # Votre JS a besoin des champs liés (FK) comme des IDs.
        course_templates_data = list(course_templates.values(
            'pk', 
            'weekly_template__id',  # Renvoie l'ID du template lié
            'day_of_week', 
            'start_time', 
            'end_time', 
            'teacher_subject__id',  # Renvoie l'ID du teacher_subject lié
            'classroom__id'         # Renvoie l'ID de la salle liée
        ))

        teacher_subjects_annotated = teacher_subjects.annotate(
            # 'pk' pour le JS sera l'ID de TeacherSubject
            js_pk=F('teacher__id'),
            # Nom de la matière
            subject_name=F('teacher__subject__name'),
            # Nom du professeur (utilisez username, ou last_name / first_name)
            teacher_name=F('teacher__teacher__user__username')
            
        )

        # Ensuite, .values() ne sélectionne que ces champs propres
        teacher_subjects_data = list(teacher_subjects_annotated.values(
            'js_pk',
            'subject_name',
            'teacher_name',
            'is_active'
        ))
        
    except Exception as e:
        # Gérer le cas où l'école ou les relations n'existent pas
        print(e)
        return HttpResponseForbidden("Erreur de configuration: impossible de charger les données liées à l'école.")

    # --- 3. Construction du Contexte ---
    context = {
        'current_year': current_year,
        'classe': classe,
        
        # Données pour le rendu HTML (les QuerySets originaux)
        'classrooms': classrooms,
        'teacher_subjects': teacher_subjects,
        'weekly_scheduling_templates': weekly_scheduling_templates,
        
        # Données pour la sérialisation JSON (les listes de dictionnaires)
        'classrooms_data': classrooms_data,
        'teacher_subjects_data': teacher_subjects_data,
        'exception_days_data' : exception_days_data,
        'exception_times_data' : exception_times_data,
        'weekly_scheduling_templates_data' : weekly_scheduling_templates_data,
        'course_templates_data' : course_templates_data,
    }

    return render(request, 'scheduling/schedul_management.html', context)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def manage_weekly_schedule_template_view(request):
    """
    API pour créer, modifier ou supprimer un WeeklyScheduleTemplate.
    Accessible uniquement aux administrateurs, proviseurs et super administrateurs.
    """
    user_type = get_user_type(request.user)
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)

    try:
        data = json.loads(request.body)
        action = data.get("action")

        if action not in ["create", "update", "delete"]:
            return JsonResponse({"success": False, "message": "Action non reconnue."}, status=400)

        # --- CREATE ---
        if action == "create":
            name = data.get("name", "Semaine Type")
            description = data.get("description", "")
            year_id = data.get("year_id")
            class_id = data.get("class_id")

            if not year_id or not class_id:
                return JsonResponse({"success": False, "message": "Les champs 'year_id' et 'class_id' sont obligatoires."}, status=400)

            year = get_object_or_404(Year, pk=year_id)
            student_class = get_object_or_404(Class, pk=class_id)

            with transaction.atomic(): 
                template= WeeklyScheduleTemplate.objects.create(
                    year=year,
                    student_class=student_class,
                    name = name,
                    description=description
                )

            return JsonResponse({
                "success": True,
                "message": "Template de semaine créé avec succès." ,
                "template_id": template.id
            })

        # --- UPDATE ---
        elif action == "update":
            template_id = data.get("template_id")
            if not template_id:
                return JsonResponse({"success": False, "message": "L'ID du template est requis pour une mise à jour."}, status=400)

            template = get_object_or_404(WeeklyScheduleTemplate, pk=template_id)

            name = data.get("name", template.name)
            description = data.get("description", template.description)

            template.name = name
            template.description = description
            template.save()

            return JsonResponse({
                "success": True,
                "message": "Template de semaine mis à jour avec succès.",
                "template_id": template.id
            })

        # --- DELETE ---
        elif action == "delete":
            template_id = data.get("template_id")
            if not template_id:
                return JsonResponse({"success": False, "message": "L'ID du template est requis pour une suppression."}, status=400)

            template = get_object_or_404(WeeklyScheduleTemplate, pk=template_id)

            with transaction.atomic():
                template.delete()

            return JsonResponse({
                "success": True,
                "message": "Template de semaine supprimé avec succès."
            })

    except IntegrityError:
        return JsonResponse({"success": False, "message": "Erreur d’unicité : un template similaire existe déjà."}, status=409)
    except WeeklyScheduleTemplate.DoesNotExist:
        return JsonResponse({"success": False, "message": "Template introuvable."}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def manage_course_template_view(request):
    """
    API pour ajouter, modifier ou supprimer un CourseTemplate
    (cours dans un WeeklyScheduleTemplate existant).
    """
    user_type = get_user_type(request.user)
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)

    try:
        data = json.loads(request.body)
        action = data.get('action')
        template_pk = data.get('weekly_template_pk')
        weekly_template = get_object_or_404(WeeklyScheduleTemplate, pk=template_pk)

        if action in ['add', 'update']:
            day_of_week = data.get('day_of_week')
            start_time = datetime.datetime.strptime(data.get('start_time'), '%H:%M:%S').time()
            end_time = datetime.datetime.strptime(data.get('end_time'), '%H:%M:%S').time()
            classroom_id = data.get('classroom_id')
            teacher_subject_id = data.get('teacher_subject_id')

            with transaction.atomic():
                if action == 'add':
                    new_course = CourseTemplate.objects.create(
                        weekly_template=weekly_template,
                        day_of_week=day_of_week,
                        start_time=start_time,
                        end_time=end_time,
                        classroom_id=classroom_id,
                        teacher_subject_id=teacher_subject_id
                    )
                    return JsonResponse({
                        "success": True,
                        "message": "Cours ajouté avec succès.",
                        "course_id": new_course.id
                    })

                elif action == 'update':
                    course_pk = data.get('course_pk')
                    course = get_object_or_404(CourseTemplate, pk=course_pk, weekly_template=weekly_template)
                    course.day_of_week = day_of_week
                    course.start_time = start_time
                    course.end_time = end_time
                    course.classroom.id = classroom_id
                    course.teacher_subject.id = teacher_subject_id
                    course.save()
                    return JsonResponse({"success": True, "message": "Cours mis à jour avec succès."})

        elif action == 'delete':
            course_pk = data.get('course_pk')
            CourseTemplate.objects.filter(pk=course_pk, weekly_template=weekly_template).delete()
            return JsonResponse({"success": True, "message": "Cours supprimé avec succès."})

        else:
            return JsonResponse({"success": False, "message": "Action non reconnue."}, status=400)

    except WeeklyScheduleTemplate.DoesNotExist:
        return JsonResponse({'success': False, 'message': "Template de semaine non trouvé."}, status=404)
    except IntegrityError:
        return JsonResponse({'success': False, 'message': "Conflit ou erreur d’unicité dans le template."}, status=409)
    except Exception as e:
        return JsonResponse({'success': False, 'message': f"Erreur interne : {str(e)}"}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def create_scheduled_courses_view(request):
    """
    API pour la création des cours réels (ScheduledCourse).
    - Vérifie toutes les contraintes
    - Enregistre les cours valides (Sauvegarde Partielle)
    - Retourne la liste des cours créés ET la liste des erreurs
    """
    user_type = get_user_type(request.user)
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)

    try:
        # 1. Lecture et validation des données
        data = json.loads(request.body)
        courses_list = data.get("courses_list", [])
        year_id = data.get("year_id")

        if not courses_list or not year_id:
            return JsonResponse({
                "success": False,
                "message": "Les champs 'courses_list' et 'year_id' sont obligatoires."
            }, status=400)

        year = get_object_or_404(Year, pk=year_id)

        # --------------------------------------------------------
        # 2. Vérification des conflits (Logique inversée)
        # --------------------------------------------------------
        
        all_conflicts = check_course_conflicts(courses_list, year)
        
        # --- [MODIFIÉ] Correction du bug 'unhashable type: dict' ---
        
        # Utiliser une 'list' au lieu d'un 'set'
        courses_in_error_list = []
        
        for e in all_conflicts:
            # Ajoute le cours principal de l'erreur
            if e.get('course') and e['course'] not in courses_in_error_list:
                courses_in_error_list.append(e['course'])
                
            # Ajoute le cours en "conflit avec" (pour les conflits internes)
            if e.get('conflict_with') and e['conflict_with'] not in courses_in_error_list:
                courses_in_error_list.append(e['conflict_with'])

        # Séparer les cours valides et invalides
        valid_courses_data = []
        invalid_courses_errors = all_conflicts # Garde la liste complète des erreurs pour le rapport

        # Re-construit la liste des cours valides
        for course_data in courses_list:
            if course_data not in courses_in_error_list:
                valid_courses_data.append(course_data)
        
        # --- Fin de la modification ---

        # --------------------------------------------------------
        # 3. Création des cours VALIDES uniquement
        # --------------------------------------------------------
        created_courses_list = []
        creation_errors = [] 

        if valid_courses_data:
            with transaction.atomic():
                for course_data in valid_courses_data:
                    try:
                        start_dt = datetime.datetime.fromisoformat(
                            course_data['start_datetime'].replace('Z', '+00:00')
                        )
                        end_dt = datetime.datetime.fromisoformat(
                            course_data['end_datetime'].replace('Z', '+00:00')
                        )

                        new_course = ScheduledCourse.objects.create(
                            classroom_id=course_data["classroom_id"],
                            teacher_subject_id=course_data["teacher_subject_id"],
                            student_class_id=course_data["student_class_id"],
                            start_datetime=start_dt,
                            end_datetime=end_dt,
                            year=year,
                            created_by=request.user,
                        )

                        created_courses_list.append({
                            "id": new_course.id,
                            "teacher_subject_id": new_course.teacher_subject.id,
                            "classroom_id": new_course.classroom.id,
                            "start_datetime": str(new_course.start_datetime),
                        })

                    except Exception as e:
                        creation_errors.append({
                            "course_data": course_data,
                            "error": f"Erreur interne lors de la sauvegarde : {str(e)}"
                        })

        # --------------------------------------------------------
        # 4. Réponse finale (compilation des deux types d'erreurs)
        # --------------------------------------------------------
        
        final_errors = invalid_courses_errors + creation_errors
        
        if not final_errors:
            message = f"{len(created_courses_list)} cours ont été créés avec succès."
        else:
            message = f"{len(created_courses_list)} cours créés. {len(final_errors)} cours en erreur (voir détails)."

        return JsonResponse({
            "success": True, 
            "message": message,
            "created_count": len(created_courses_list),
            "errors_count": len(final_errors),
            "created_courses": created_courses_list, 
            "errors": final_errors 
        })

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Requête JSON invalide."}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)



@login_required(login_url='login')
def view_class_schedule_page(request, pk_class):
    """
    Affiche la page principale de l'AFFICHAGE du planning pour une classe.
    """
    try:
        classe = get_object_or_404(Class, pk=pk_class)
        school = classe.level.school
        current_year = get_current_year_for_school(school)

        if not current_year:
            return HttpResponseForbidden("Aucune année scolaire courante n'est définie pour cette école.")

        # --- 1. Logique de Date ---
        today = timezone.now().date()
        year_start_date = current_year.start_date.date()
        year_end_date = current_year.end_date.date()
        
        target_date = today
        
        # Gère les cas hors-limites
        if today < year_start_date:
            target_date = year_start_date
        elif today > year_end_date:
            target_date = year_end_date
            
        # Calcule le Lundi de la semaine cible
        start_of_week = target_date - datetime.timedelta(days=target_date.weekday())
        
        # --- 2. Permissions ---
        user_type = get_user_type(request.user)
        is_admin_user = user_type in ["SuperAdministrator", "Principal", "Administrator"]

        # --- 3. Données initiales ---
        courses_data = get_week_schedule_data(classe, start_of_week)
        
        # --- 4. Contexte ---
        context = {
            'current_year': current_year,
            'classe': classe,
            'is_admin_user': is_admin_user,
            
            # Données pour le JS
            'courses_data': courses_data, # Données de la première semaine
            'week_start_date_iso': start_of_week.isoformat(),
            'year_min_time': current_year.min_time.strftime('%H:%M'),
            'year_max_time': current_year.max_time.strftime('%H:%M'),
            'year_start_date_iso': year_start_date.isoformat(),
            'year_end_date_iso': year_end_date.isoformat(),
            'exception_times_data': list(ExceptionTime.objects.filter(year=current_year).values('start_time', 'end_time')),
        }
        
        return render(request, 'scheduling/view_schedule.html', context)

    except Exception as e:
        print(f"Erreur dans view_class_schedule_page: {e}")
        return HttpResponseForbidden("Erreur lors du chargement de la page.")


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_get_week_schedule_views(request):
    """
    API pour récupérer les cours d'une semaine spécifique via JS (navigation).
    """
    try:
        data = json.loads(request.body)
        start_date_str = data.get("start_date")
        class_id = data.get("class_id")

        if not start_date_str or not class_id:
            return JsonResponse({"success": False, "message": "Date de début ou ID de classe manquant."}, status=400)

        classe = get_object_or_404(Class, pk=class_id)
        start_of_week = datetime.date.fromisoformat(start_date_str)

        # Appelle le même utilitaire que la vue principale
        courses_data = get_week_schedule_data(classe, start_of_week)
        
        return JsonResponse({"success": True, "courses": courses_data})

    except Class.DoesNotExist:
        return JsonResponse({"success": False, "message": "Classe introuvable."}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_manage_course_status_views(request):
    """
    API sécurisée pour les Admins pour modifier le statut d'un cours
    (Annuler, Marquer absent, Réactiver) ou le Supprimer.
    """
    # --- 1. Sécurité ---
    user_type = get_user_type(request.user)
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return JsonResponse({"success": False, "message": "Accès refusé. Droits insuffisants."}, status=403)

    try:
        data = json.loads(request.body)
        course_id = data.get("course_id")
        action = data.get("action") # ex: "DELETE", "SET_CANCELLED", "SET_ACTIVE", "SET_TEACHER_ABSENT"

        if not course_id or not action:
            return JsonResponse({"success": False, "message": "ID de cours ou action manquante."}, status=400)

        new_status = None
        message = ""

        with transaction.atomic():
            course = get_object_or_404(ScheduledCourse, pk=course_id)
            
            # [TODO] Vérification de sécurité :
            # Vérifier si l'utilisateur a le droit d'agir sur un cours de CETTE école ?
            # (Pour l'instant, on fait confiance au rôle)

            if action == "DELETE":
                course.delete()
                message = "Cours supprimé définitivement."
                
            elif action == "SET_ACTIVE":
                course.status = 'ACTIVE'
                course.save()
                message = "Cours marqué comme 'Actif'."
                new_status = course.get_status_display()
                
            elif action == "SET_CANCELLED":
                course.status = 'CANCELLED'
                course.save()
                message = "Cours marqué comme 'Annulé'."
                new_status = course.get_status_display()

            elif action == "SET_TEACHER_ABSENT":
                course.status = 'TEACHER_ABSENT'
                course.save()
                message = "Cours marqué comme 'Professeur absent'."
                new_status = course.get_status_display()
                
            else:
                return JsonResponse({"success": False, "message": "Action non reconnue."}, status=400)

        return JsonResponse({
            "success": True, 
            "message": message,
            "new_status": new_status, # Renvoie le nouveau statut (ex: "Cours annulé")
            "new_status_key": course.get_status_display() if action != "DELETE" else None # Renvoie la clé (ex: "CANCELLED")
        })

    except ScheduledCourse.DoesNotExist:
        return JsonResponse({"success": False, "message": "Cours introuvable."}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)


@login_required(login_url='login')
def view_teacher_schedule_page(request, pk_staff):
    """
    Affiche la page principale de l'AFFICHAGE du planning pour un PROFESSEUR.
    """
    try:
        # 1. Récupérer le professeur cible
        teacher_staff = get_object_or_404(Staff, pk=pk_staff)
        school = teacher_staff.school
        current_year = get_current_year_for_school(school)

        if not current_year:
            return HttpResponseForbidden("Aucune année scolaire courante n'est définie pour cette école.")

        # --- 2. Logique de Permission ---
        user = request.user
        user_type = get_user_type(user)
        
        is_admin_or_principal = user_type in ["SuperAdministrator", "Principal"]
        is_self = (hasattr(user, 'staff_user') and user.staff_user.id == teacher_staff.id)

        # Vérifie si l'utilisateur est Admin/Principal OU s'il consulte son propre planning
        if not (is_admin_or_principal or is_self):
            return HttpResponseForbidden("Accès refusé. Vous ne pouvez consulter que votre propre planning ou vous n'avez pas les droits suffisants.")

        # --- 3. Logique de Date ---
        today = timezone.now().date()
        year_start_date = current_year.start_date.date()
        year_end_date = current_year.end_date.date()
        
        target_date = today
        
        # Gère les cas hors-limites
        if today < year_start_date:
            target_date = year_start_date
        elif today > year_end_date:
            target_date = year_end_date
            
        # Calcule le Lundi de la semaine cible
        start_of_week = target_date - datetime.timedelta(days=target_date.weekday())
        
        # --- 4. Données initiales ---
        courses_data = get_week_schedule_data_for_teacher(teacher_staff, start_of_week)
        
        # --- 5. Contexte ---
        context = {
            'current_year': current_year,
            'teacher_staff': teacher_staff, # Le professeur dont on voit le planning
            
            # Booléens pour la logique d'affichage dans le JS
            'is_admin_user': is_admin_or_principal,
            'is_teacher_owner': is_self,
            
            # Données pour le JS
            'courses_data': courses_data, # Données de la première semaine
            'week_start_date_iso': start_of_week.isoformat(),
            'year_min_time': current_year.min_time.strftime('%H:%M'),
            'year_max_time': current_year.max_time.strftime('%H:%M'),
            'year_start_date_iso': year_start_date.isoformat(),
            'year_end_date_iso': year_end_date.isoformat(),
            'exception_times_data': list(ExceptionTime.objects.filter(year=current_year).values('start_time', 'end_time')),
        }
        
        return render(request, 'scheduling/view_teacher_schedule.html', context)

    except Exception as e:
        print(f"Erreur dans view_teacher_schedule_page: {e}")
        return HttpResponseForbidden("Erreur lors du chargement de la page.")


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_get_teacher_week_schedule_views(request):
    """
    API pour récupérer les cours d'un PROFESSEUR pour une semaine spécifique.
    """
    try:
        data = json.loads(request.body)
        start_date_str = data.get("start_date")
        staff_id = data.get("staff_id") # L'ID du prof dont on regarde le planning

        if not start_date_str or not staff_id:
            return JsonResponse({"success": False, "message": "Date de début ou ID de professeur manquant."}, status=400)

        # --- Re-vérification des permissions ---
        teacher_staff = get_object_or_404(Staff, pk=staff_id)
        user = request.user
        user_type = get_user_type(user)
        is_admin_or_principal = user_type in ["SuperAdministrator", "Principal", "Administrator"]
        is_self = (hasattr(user, 'staff_user') and user.staff_user.id == teacher_staff.id)

        if not (is_admin_or_principal or is_self):
            return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)
        # --- Fin des permissions ---

        start_of_week = datetime.date.fromisoformat(start_date_str)

        # Appelle le nouvel utilitaire
        courses_data = get_week_schedule_data_for_teacher(teacher_staff, start_of_week)
        
        return JsonResponse({"success": True, "courses": courses_data})

    except Staff.DoesNotExist:
        return JsonResponse({"success": False, "message": "Professeur introuvable."}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_manage_teacher_course_status_views(request):
    """
    API sécurisée pour modifier le statut d'un cours (Vue Professeur).
    - Admins/Principals : peuvent tout faire (Supprimer, Annuler, Absent, Actif).
    - Professeurs : ne peuvent que marquer 'Absent' ou 'Actif'.
    """
    try:
        data = json.loads(request.body)
        course_id = data.get("course_id")
        action = data.get("action") # ex: "DELETE", "SET_CANCELLED", "SET_ACTIVE", "SET_TEACHER_ABSENT"

        if not course_id or not action:
            return JsonResponse({"success": False, "message": "ID de cours ou action manquante."}, status=400)

        course = get_object_or_404(ScheduledCourse, pk=course_id)
        
        # --- 1. Logique de Permission d'Action ---
        user = request.user
        user_type = get_user_type(user)
        
        is_admin_or_principal = user_type in ["SuperAdministrator", "Principal", "Administrator"]
        is_teacher_owner = (hasattr(user, 'staff_user') and user.staff_user.id == course.teacher_subject.teacher.id)

        # Si l'action est restreinte (Delete/Cancel)
        if action in ["DELETE", "SET_CANCELLED"]:
            if not is_admin_or_principal:
                return JsonResponse({"success": False, "message": "Accès refusé. Seul un administrateur peut supprimer ou annuler un cours."}, status=403)
        
        # Si l'action est autorisée (Active/Absent)
        elif action in ["SET_ACTIVE", "SET_TEACHER_ABSENT"]:
            if not (is_admin_or_principal or is_teacher_owner):
                return JsonResponse({"success": False, "message": "Accès refusé. Vous n'êtes pas l'enseignant de ce cours."}, status=403)
        
        # Si l'action n'est pas reconnue
        elif action not in ["Faire l'appel", "Mettre des notes"]: # Accepte les placeholders
             return JsonResponse({"success": False, "message": "Action non reconnue."}, status=400)

        # --- 2. Exécution de l'Action ---
        new_status = None
        message = ""

        with transaction.atomic():
            if action == "DELETE":
                course.delete()
                message = "Cours supprimé définitivement."
                
            elif action == "SET_ACTIVE":
                course.status = 'ACTIVE'
                course.save()
                message = "Cours marqué comme 'Actif'."
                new_status = course.get_status_display()
                
            elif action == "SET_CANCELLED":
                course.status = 'CANCELLED'
                course.save()
                message = "Cours marqué comme 'Annulé'."
                new_status = course.get_status_display()

            elif action == "SET_TEACHER_ABSENT":
                course.status = 'TEACHER_ABSENT'
                course.save()
                message = "Cours marqué comme 'Professeur absent'."
                new_status = course.get_status_display()
            
            # Gère les actions "placeholder"
            elif action in ["Faire l'appel", "Mettre des notes"]:
                # Ne fait rien au backend, mais renvoie un succès pour que la modale se ferme
                message = f"Fonctionnalité '{action}' non implémentée."
                new_status = course.get_status_display() # Garde le statut actuel

        return JsonResponse({
            "success": True, 
            "message": message,
            "new_status": new_status,
            "new_status_key": course.get_status_display() if action != "DELETE" else None
        })

    except ScheduledCourse.DoesNotExist:
        return JsonResponse({"success": False, "message": "Cours introuvable."}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)



@login_required(login_url='login')
def redirect_to_my_schedule(request):
    """
    Vue intermédiaire qui détermine la classe de l'élève (ou de l'enfant sélectionné)
    et redirige vers la page d'affichage du planning correspondante.
    """

    user = request.user
    user_type = get_user_type(user)

    if user_type not in ["Parent", "Student"]:
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)

    # 1. Récupérer le contexte étudiant (Enfant du parent)
    if user_type == "Parent":
        student = get_student_context(request)
    else: 
        student = Student.objects.get(user=user)

    if not student:
        # Si ce n'est ni un élève ni un parent avec enfant sélectionné
        return HttpResponseForbidden("Accès refusé. Aucun profil élève identifié.")

    # 2. Trouver l'année en cours pour son école
    current_year = get_current_year_for_school(student.school)
    if not current_year:
        return HttpResponseForbidden("Aucune année scolaire active.")

    # 3. Trouver la classe de l'élève pour cette année
    try:
        link = ClassStudentYear.objects.get(
            student=student,
            year=current_year,
            is_active=True
        )
        # 4. Redirection vers la vue existante avec le bon ID
        return redirect('scheduling:view_class_schedule_page', pk_class=link.student_class.id)
        
    except ClassStudentYear.DoesNotExist:
        return HttpResponseForbidden("L'élève n'est inscrit dans aucune classe pour l'année en cours.")
    except Exception as e:
        print(f"Erreur redirection planning: {e}")
        return HttpResponseForbidden("Erreur lors de la redirection.")