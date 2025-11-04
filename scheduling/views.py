import json
import datetime
from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError, transaction
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.db.models import F # Assurez-vous d'importer F en haut du fichier

# Import des modèles
from scheduling.models import WeeklyScheduleTemplate, CourseTemplate, ScheduledCourse
from schools.models import Year, ExceptionDay, ExceptionTime
from classes.models import Class, Classroom, ClassTeacherYear
from subjects.models import TeacherSubject


# Import des utilitaires
from .utils import check_course_conflicts
from users.utils import get_user_type
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
def create_scheduled_courses_view2(request):
    """
    API pour la création des cours réels (ScheduledCourse) à partir des données envoyées.
    - Vérifie toutes les contraintes (règles de chevauchement, heures, exceptions, etc.)
    - Enregistre uniquement les cours valides
    - Retourne la liste complète des erreurs si des conflits sont détectés

    Corps JSON attendu :
    {
        "courses_list": [
            {
                "teacher_subject_id": int,
                "classroom_id": int,
                "student_class_id": int,
                "start_datetime": "2025-09-01T08:00:00",
                "end_datetime": "2025-09-01T09:30:00"
            },
            ...
        ],
        "year_id": int
    }
    """

    # Vérification du rôle utilisateur
    user_type = get_user_type(request.user)
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)

    try:
        # --------------------------------------------------------
        # 1. Lecture et validation des données reçues
        # --------------------------------------------------------
        data = json.loads(request.body)
        courses_list = data.get("courses_list", [])
        year_id = data.get("year_id")

        if not courses_list or not year_id:
            return JsonResponse({
                "success": False,
                "message": "Les champs 'courses_list' et 'year_id' sont obligatoires."
            }, status=400)

        # Vérification de l'existence de l'année
        year = get_object_or_404(Year, pk=year_id)

        # --------------------------------------------------------
        # 2. Vérification des conflits
        # --------------------------------------------------------
        conflicts = check_course_conflicts(courses_list, year_id)
        if conflicts:
            return JsonResponse({
                "success": False,
                "message": "Certains cours présentent des conflits.",
                "errors": conflicts
            }, status=409)

        # --------------------------------------------------------
        # 3. Création des cours valides
        # --------------------------------------------------------
        created_courses = []
        errors = []

        with transaction.atomic():
            for course_data in courses_list:
                try:
                    start_dt = datetime.datetime.fromisoformat(
                        course_data['start_datetime'].replace('Z', '+00:00')
                    )
                    end_dt = datetime.datetime.fromisoformat(
                        course_data['end_datetime'].replace('Z', '+00:00')
                    )

                    new_course = ScheduledCourse.objects.create(
                        classroom__id=course_data["classroom_id"],
                        teacher_subject__id=course_data["teacher_subject_id"],
                        student_class__id=course_data["student_class_id"],
                        start_datetime=start_dt,
                        end_datetime=end_dt,
                        year=year,
                        created_by=request.user,
                    )

                    created_courses.append({
                        "id": new_course.id,
                        "teacher_subject_id": new_course.teacher_subject.id,
                        "classroom_id": new_course.classroom.id,
                        "student_class_id": new_course.student_class.id,
                        "start_datetime": str(new_course.start_datetime),
                        "end_datetime": str(new_course.end_datetime)
                    })

                except IntegrityError as e:
                    errors.append({
                        "course_data": course_data,
                        "error": f"Erreur d'intégrité : {str(e)}"
                    })
                except Exception as e:
                    errors.append({
                        "course_data": course_data,
                        "error": f"Erreur lors de la création : {str(e)}"
                    })

        # --------------------------------------------------------
        # 4. Réponse finale
        # --------------------------------------------------------
        return JsonResponse({
            "success": True if not errors else False,
            "message": (
                "Tous les cours ont été créés avec succès."
                if not errors
                else "Certains cours n'ont pas pu être créés."
            ),
            "created_count": len(created_courses),
            "errors_count": len(errors),
            "created_courses": created_courses,
            "errors": errors
        })

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Requête JSON invalide."}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)


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






# ====================================================================================
# ====================================================================================
# ====================================================================================
# ====================================================================================
# ====================================================================================




# --- API 3: RÉCUPÉRATION DU CALENDRIER (FRONT-END) ---

@require_http_methods(["GET"])
@login_required(login_url='login')
def planningCalendarView(request):
    """
    API pour récupérer les cours planifiés pour l'affichage du calendrier (élève ou professeur).
    """
    year_pk = request.GET.get('year_pk')
    class_pk = request.GET.get('class_pk')
    teacher_pk = request.GET.get('teacher_pk')

    if not year_pk:
        return JsonResponse({"success": False, "message": "L'ID de l'année est obligatoire."}, status=400)

    try:
        courses = ScheduledCourse.objects.filter(year_id=year_pk)
        
        # Filtrage par classe
        if class_pk:
            courses = courses.filter(student_class_id=class_pk)
            
        # Filtrage par professeur
        elif teacher_pk:
            teacher_subjects_ids = TeacherSubject.objects.filter(teacher_id=teacher_pk).values_list('pk', flat=True)
            courses = courses.filter(teacher_subject_id__in=teacher_subjects_ids)

        # Récupération des données formatées
        course_data = list(courses.select_related(
            'student_class', 'classroom', 'teacher_subject__subject', 'teacher_subject__teacher__user'
        ).values(
            'pk', 
            'start_datetime', 
            'end_datetime', 
            'classroom__name',
            'student_class__name', 
            'teacher_subject__subject__name',
            'teacher_subject__teacher__user__first_name',
            'teacher_subject__teacher__user__last_name'
        ))
        
        formatted_courses = []
        for course in course_data:
            start_iso = course['start_datetime'].isoformat() if course['start_datetime'] else None
            end_iso = course['end_datetime'].isoformat() if course['end_datetime'] else None
            
            title = f"{course['teacher_subject__subject__name']} - {course['student_class__name']}"
            teacher_name = f"{course['teacher_subject__teacher__user__first_name']} {course['teacher_subject__teacher__user__last_name']}"
            
            formatted_courses.append({
                'id': course['pk'],
                'title': title,
                'start': start_iso,
                'end': end_iso,
                'classroom': course['classroom__name'],
                'class_name': course['student_class__name'],
                'teacher_name': teacher_name
            })


        return JsonResponse({
            'success': True, 
            'data': formatted_courses
        })
        
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur lors de la récupération du calendrier: {str(e)}"}, status=500)
