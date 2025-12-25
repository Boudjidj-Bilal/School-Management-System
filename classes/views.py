from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods, require_POST
from django.views.decorators.csrf import csrf_exempt
import json

from users.utils import get_user_type
from schools.utils import get_user_school, get_authorisation_stape_run_year, get_current_year_for_school, get_authorisation_stape_creation_year
from .models import Classroom, Level, Class, ClassStudentYear, ClassTeacherYear
from schools.models import School, TermYearLevel
from users.models import Student 
from subjects.models import TeacherSubject 

from django.db import IntegrityError, transaction


@require_http_methods(["GET", "POST"])
@csrf_exempt
@login_required
def classroom_management(request):
    """
    Vue unifiée pour la gestion des salles de classe (CRUD via POST et affichage via GET).
    La permission et le contexte de l'école sont déterminés par le rôle de l'utilisateur.
    """
    
    # 1. Détermination du contexte utilisateur et permission
    # Remplacez ceci par l'appel réel de votre helper
    user_type = get_user_type(request.user)

    # Les rôles autorisés à gérer les salles de classe
    allowed_roles = ["SuperAdministrator", "Principal"]
    if user_type not in allowed_roles:
        return render(request, "404.html", status=404)
    
    # 2. Détermination du contexte de l'école
    try:
        if user_type == "SuperAdministrator" or user_type == "Principal":
            school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
        else:
            return render(request, "404.html", status=404)
    except School.DoesNotExist:
        return render(request, "404.html", status=404)
    
    # Si l'école est désactiver, impossible de continuer
    if not school_filter.is_active:
        return render(request, "404.html", status=404)

    # --- 3. Gestion des requêtes POST (API CRUD) ---
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            action = data.get('action') 
            classroom_id = data.get('classroom_id')
            name = data.get('name', '').strip()
            is_active_data = data.get('is_active')

            if action == 'create':
                # Création d'une nouvelle salle
                if not name:
                    return JsonResponse({'success': False, 'message': 'Le nom de la salle est obligatoire.'}, status=400)
                
                # Vérification de l'unicité
                if Classroom.objects.filter(school=school_filter, name__iexact=name).exists():
                    return JsonResponse({'success': False, 'message': f'La salle "{name}" existe déjà dans cette école.'}, status=400)

                classroom = Classroom.objects.create(name=name, is_active=True, school=school_filter)
                return JsonResponse({
                    'success': True, 
                    'message': f'La salle "{classroom.name}" a été créée avec succès.',
                    'classroom': {'id': classroom.id, 'name': classroom.name, 'is_active': classroom.is_active}
                }, status=201)

            elif action == 'update' or action == 'toggle_active':
                # Modification ou changement de statut
                if not classroom_id:
                    return JsonResponse({'success': False, 'message': 'ID de la salle manquant.'}, status=400)
                
                try:
                    # On s'assure que la salle appartient bien à l'école gérée par l'utilisateur
                    classroom = Classroom.objects.get(pk=classroom_id, school=school_filter)
                except Classroom.DoesNotExist:
                    return JsonResponse({'success': False, 'message': 'Salle de classe non trouvée ou non rattachée à cette école.'}, status=404)

                if action == 'update':
                    if not name:
                        return JsonResponse({'success': False, 'message': 'Le nom de la salle est obligatoire.'}, status=400)

                    # Vérification de l'unicité (en excluant la salle elle-même)
                    if Classroom.objects.filter(school=school_filter, name__iexact=name).exclude(pk=classroom_id).exists():
                        return JsonResponse({'success': False, 'message': f'Le nom "{name}" est déjà utilisé.'}, status=400)
                    
                    classroom.name = name
                    classroom.is_active = bool(is_active_data) # Gère l'état actif lors de la modification
                    classroom.save()

                    return JsonResponse({
                        'success': True, 
                        'message': f'La salle "{classroom.name}" a été mise à jour.',
                        'classroom': {'id': classroom.id, 'name': classroom.name, 'is_active': classroom.is_active}
                    }, status=200)

                elif action == 'toggle_active':
                    # Logique de désactivation/activation
                    new_status = bool(is_active_data) 

                    # Si l'année de la classe est à l'étape de déroulement, impossible de la modifier.
                    if not new_status:
                        authorisation = get_authorisation_stape_run_year(classroom.school)
                        if not authorisation: 
                            return JsonResponse({'success': False, 'message': "Vous ne pouvez pas désactiver une salle de classe lorsque l'école est dans sa phase de déroulement."}, status=404)

                    classroom.is_active = new_status
                    classroom.save()
                    status_verb = "activée" if new_status else "désactivée"
                    
                    return JsonResponse({
                        'success': True, 
                        'message': f'La salle "{classroom.name}" a été {status_verb} avec succès.',
                        'classroom': {'id': classroom.id, 'name': classroom.name, 'is_active': classroom.is_active}
                    }, status=200)
            
            else:
                return JsonResponse({'success': False, 'message': 'Action non reconnue.'}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Données JSON invalides.'}, status=400)
        except Exception as e:
            # Pensez à logger l'erreur 'e' en production
            return JsonResponse({'success': False, 'message': f'Une erreur interne du serveur est survenue: {str(e)}'}, status=500)

    # --- 4. Gestion des requêtes GET (Affichage de la page) ---
    classrooms = Classroom.objects.filter(school=school_filter).order_by('name')

    context = {
        'school': school_filter,
        'classrooms': classrooms,
        'user_type': user_type,
    }
    
    # Ce template sera créé dans l'étape suivante pour l'interface utilisateur.
    return render(request, 'classes/classroom_management.html', context)


@require_http_methods(["GET", "POST"])
@csrf_exempt
@login_required
def level_management(request):
    """
    Vue unifiée pour la gestion des niveaux scolaires (Level) pour une école.
    Permet la création, modification et suppression des niveaux.
    """
    
    # 1. Détermination du contexte utilisateur et permission
    user_type = get_user_type(request.user)
    # Seuls les SuperAdministrators et Principals peuvent gérer les niveaux
    allowed_roles = ["SuperAdministrator", "Principal"] 
    
    if user_type not in allowed_roles:
        return render(request, "404.html", status=404)

    # 2. Détermination du contexte de l'école
    try:
        school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
    except School.DoesNotExist:
        return render(request, "404.html", status=404)
    
    if not school_filter:
        return render(request, "404.html", status=404)
    
    elif not school_filter.is_active:
        return render(request, "404.html", status=404)
        
    # 3. Détermination de l'année scolaire actuelle
    current_year = get_current_year_for_school(school_filter)

    # --- 4. Gestion des requêtes POST (API CRUD) ---
    if request.method == 'POST':
        try:
            # Vérification de l'étape de création (Condition clé)
            stape_creation_year = get_authorisation_stape_creation_year(school_filter)
            if not stape_creation_year:
                return JsonResponse(
                    {"success": False, 
                     "message": "Opération non autorisée. La gestion des niveaux n'est possible que lorsque l'année scolaire est à l'étape de Création."}, 
                    status=400
                )

            data = json.loads(request.body)
            action = data.get('action') 
            level_id = data.get('level_id')

            # Champs du modèle Level
            level_code = data.get('level_code') # Ex: '6E', 'T'
            term_type = data.get('term_type') # Ex: 'TRIMESTRE', 'SEMESTRE'

            if action == 'create' or action == 'update':
                # Validation des champs obligatoires
                if not level_code or not term_type:
                    return JsonResponse({'success': False, 'message': 'Le code de niveau et le type de niveau sont obligatoires.'}, status=400)
                
                # Validation des choix (optionnel mais recommandé pour la sécurité)
                # On utilise les choix définis dans le modèle Level
                valid_levels = [choice[0] for choice in Level.LEVEL_CHOICES]
                valid_terms = [choice[0] for choice in Level.TERM_TYPE_CHOICES]
                
                if level_code not in valid_levels:
                    return JsonResponse({'success': False, 'message': f'Code de niveau invalide: {level_code}.'}, status=400)
                
                if term_type not in valid_terms:
                    return JsonResponse({'success': False, 'message': f'Type de niveau invalide: {term_type}.'}, status=400)
                
                # Vérification d'unicité (un niveau ne doit pas être créé deux fois pour la même école)
                if Level.objects.filter(school=school_filter, level=level_code).exists() and action == 'create':
                    # Dans ce cas, nous renvoyons un message d'erreur si l'on tente de créer un niveau existant.
                    return JsonResponse({'success': False, 'message': f'Le niveau {Level.objects.get(level=level_code).get_level_display()} est déjà défini pour cette école.'}, status=409) # 409 Conflict

                if action == 'create':
                    Level.objects.create(
                        level=level_code,
                        term_type=term_type,
                        school=school_filter
                    )
                    # return JsonResponse({'success': True, 'message': f'Niveau "{Level.LEVEL_CHOICES[Level.LEVEL_CHOICES.index((level_code, Level.LEVEL_CHOICES[Level.LEVEL_CHOICES.index((level_code, ""))[1]])[1])]}" créé avec succès.'}, status=201)
                    return JsonResponse({'success': True, 'message': f'Niveau "{next((display for code, display in Level.LEVEL_CHOICES if code == level_code), level_code)}" créé avec succès.'}, status=201)

                elif action == 'update':
                    if not level_id:
                        return JsonResponse({'success': False, 'message': 'ID du niveau manquant pour la mise à jour.'}, status=400)
                    
                    try:
                        # Assurez-vous que l'objet Level appartient bien à l'école de l'utilisateur
                        level_obj = Level.objects.get(pk=level_id, school=school_filter)
                        
                        # Si l'utilisateur change le code de niveau, vérifiez si le nouveau code existe déjà
                        if level_obj.level != level_code and Level.objects.filter(school=school_filter, level=level_code).exclude(pk=level_id).exists():
                            # return JsonResponse({'success': False, 'message': f'Le niveau {Level.LEVEL_CHOICES[Level.LEVEL_CHOICES.index((level_code, Level.LEVEL_CHOICES[Level.LEVEL_CHOICES.index((level_code, ""))[1]])[1])]} existe déjà pour cette école.'}, status=409)
                            return JsonResponse({'success': False, 'message': f'Le niveau {next((display for code, display in Level.LEVEL_CHOICES if code == level_code), level_code)} existe déjà pour cette école.'}, status=409)

                        level_obj.level = level_code
                        level_obj.term_type = term_type
                        level_obj.save()
                        return JsonResponse({'success': True, 'message': f'Niveau mis à jour avec succès.'}, status=200)
                    
                    except Level.DoesNotExist:
                        return JsonResponse({'success': False, 'message': 'Niveau non trouvé pour cette école.'}, status=404)

            elif action == 'delete':
                # Si une année actuelle existe, on vérifie l'étape de celle ci :
                if current_year:
                    if not current_year.creation == True:
                        return JsonResponse({"success": False, "message": "L'année actuelle doit être à l'étape de la création. Impossible de supprimer un niveau ."}, status=400) 

                if not level_id:
                    return JsonResponse({'success': False, 'message': 'ID du niveau manquant pour la suppression.'}, status=400)
                
                try:
                    level_obj = Level.objects.get(pk=level_id, school=school_filter)
                    level_name = level_obj.get_level_display() # Utilisation de get_level_display() pour le nom convivial
                    level_obj.delete()
                    return JsonResponse({'success': True, 'message': f'Niveau "{level_name}" supprimé.'}, status=200)
                except Level.DoesNotExist:
                    return JsonResponse({'success': False, 'message': 'Niveau non trouvé pour cette école.'}, status=404)

            else:
                 return JsonResponse({'success': False, 'message': 'Action non reconnue.'}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Données JSON invalides.'}, status=400)
        except IntegrityError:
             return JsonResponse({'success': False, 'message': 'Erreur d\'intégrité de la base de données. Vérifiez les contraintes.'}, status=400)
        except Exception as e:
            # Log l'erreur 'e'
            return JsonResponse({'success': False, 'message': f'Une erreur interne du serveur est survenue: {str(e)}'}, status=500)

    # --- 5. Gestion des requêtes GET (Affichage de la page) ---
    
    # Récupérer tous les niveaux pour l'école en cours
    school_levels = Level.objects.filter(school=school_filter).order_by('level') # Vous pourriez vouloir un tri plus logique ici
    
    # Récupérer les choix pour les passer au JS/HTML si nécessaire
    level_choices = Level.LEVEL_CHOICES
    term_choices = Level.TERM_TYPE_CHOICES
    
    context = {
        'school': school_filter,
        'current_year': current_year,
        'school_levels': school_levels,
        'level_choices': level_choices,
        'term_choices': term_choices,
        'user_type': user_type,
    }
    
    # Le template pour l'interface utilisateur (à créer)
    return render(request, 'classes/level_management.html', context)

@require_http_methods(["GET", "POST"])
@csrf_exempt 
@login_required
def class_management(request):
    """
    Vue unifiée pour la gestion complète (CRUD) des classes académiques (Class)
    pour une école donnée.
    L'opération est uniquement autorisée lorsque l'année scolaire est en phase de Creation.
    """
    
    # 1. Détermination du contexte utilisateur et permission
    user_type = get_user_type(request.user)
    allowed_roles = ["SuperAdministrator", "Principal", "Administrator"]

    can_access_bulletin = False
    
    if user_type not in allowed_roles:
        return render(request, "404.html", status=404)
    
    if user_type == "Principal" or user_type == "SuperAdministrator": 
        can_access_bulletin = True

    # 2. Détermination du contexte de l'école
    try:
        school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
    except School.DoesNotExist:
        return render(request, "404.html", status=404)      
    if not school_filter or not school_filter.is_active:
        return render(request, "404.html", status=404)        
    # 3. Détermination de l'année scolaire actuelle
    current_year = get_current_year_for_school(school_filter)

    if current_year.creation or current_year.registration:
        can_access_bulletin = False

    # 4. Vérification du stade de l'année scolaire (Condition clé pour le CRUD)
    stape_creation_year = current_year and current_year.creation
    
    if stape_creation_year and request.method == 'POST':
        return JsonResponse(
            {"success": False, 
             "message": "Opération non autorisée. La gestion des classes (Création/Modification/Suppression) n'est possible que lorsque l'année scolaire est à l'étape de Création."}, 
            status=403
        )
    
    current_term = TermYearLevel.objects.filter(
        year__school=school_filter,
        year__current=True
    ).first()

    # Si on ne trouve pas par date (ex: vacances), on prend le dernier actif ou le premier
    if not current_term:
        current_term = TermYearLevel.objects.filter(year=current_year)

    current_term_id = current_term.id if current_term else None

    # --- 5. Gestion des requêtes POST (API CRUD) ---
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            action = data.get('action') # 'create', 'update', ou 'delete'
            
            # Utilisation de transaction.atomic() pour garantir l'intégrité
            with transaction.atomic():

                # --- A. Logique de Création ('create') ---
                if action == 'create':
                    class_name = data.get('class_name', '').strip()
                    level_id = data.get('level_id')
                    
                    if not class_name or not level_id:
                        return JsonResponse({'success': False, 'message': 'Le nom de la classe et le niveau sont obligatoires.'}, status=400)

                    try:
                        # Assurez que le niveau appartient bien à l'école de l'utilisateur
                        level_obj = Level.objects.get(pk=level_id, school=school_filter)
                    except Level.DoesNotExist:
                        return JsonResponse({'success': False, 'message': 'Niveau scolaire non trouvé ou non valide pour cette école.'}, status=404)
                    
                    # Vérifier l'unicité du nom de la classe DANS CE NIVEAU
                    if Class.objects.filter(name__iexact=class_name, level=level_obj).exists():
                         return JsonResponse(
                            {'success': False, 
                             'message': f'Une classe nommée "{class_name}" existe déjà pour le niveau {level_obj.get_level_display()}.'}, 
                            status=409 # Conflict
                        )

                    new_class = Class.objects.create(
                        name=class_name,
                        level=level_obj,
                        is_valid=True
                    )
                    
                    return JsonResponse(
                        {'success': True, 
                         'message': f'La classe "{new_class.name}" a été créée avec succès.',
                         'class_id': new_class.id}, 
                        status=201
                    )

                # --- B. Logique de Modification ('update') ---
                elif action == 'update':
                    class_id = data.get('class_id')
                    class_name = data.get('class_name', '').strip()
                    level_id = data.get('level_id')

                    if not class_id or not class_name or not level_id:
                        return JsonResponse({'success': False, 'message': 'L\'ID de la classe, le nom et le niveau sont obligatoires pour la mise à jour.'}, status=400)
                    
                    try:
                        # Assurez que la classe appartient bien à l'école via le niveau
                        class_obj = Class.objects.get(pk=class_id, level__school=school_filter)
                        level_obj = Level.objects.get(pk=level_id, school=school_filter) # Nouveau niveau
                    except (Class.DoesNotExist, Level.DoesNotExist):
                        return JsonResponse({'success': False, 'message': 'Classe ou Niveau non trouvé/valide pour cette école.'}, status=404)

                    # Vérifier l'unicité du nouveau nom DANS le nouveau niveau, en excluant la classe actuelle
                    if Class.objects.filter(name__iexact=class_name, level=level_obj).exclude(pk=class_id).exists():
                         return JsonResponse(
                            {'success': False, 
                             'message': f'Le nom de classe "{class_name}" existe déjà dans le niveau {level_obj.get_level_display()}.'}, 
                            status=409
                        )

                    # Mise à jour des champs
                    class_obj.name = class_name
                    class_obj.level = level_obj
                    class_obj.save()
                    
                    return JsonResponse({'success': True, 'message': f'La classe "{class_name}" a été mise à jour avec succès.'}, status=200)

                # --- C. Logique de Suppression ('delete') ---
                elif action == 'delete':
                    class_id = data.get('class_id')

                    if not class_id:
                        return JsonResponse({'success': False, 'message': 'ID de la classe manquant pour la suppression.'}, status=400)
                    
                    try:
                        class_obj = Class.objects.get(pk=class_id, level__school=school_filter)
                        class_name = class_obj.name
                        
                        # La suppression du Class entraînera la suppression en cascade des ClassStudentYear et ClassTeacherYear associées.
                        class_obj.delete()
                        return JsonResponse({'success': True, 'message': f'La classe "{class_name}" a été supprimée.'}, status=200)
                    except Class.DoesNotExist:
                        return JsonResponse({'success': False, 'message': 'Classe non trouvée pour cette école.'}, status=404)

                else:
                    return JsonResponse({'success': False, 'message': 'Action non reconnue.'}, status=400)


        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Données JSON invalides.'}, status=400)
        except IntegrityError:
             return JsonResponse({'success': False, 'message': 'Erreur d\'intégrité de la base de données. Opération annulée.'}, status=400)
        except Exception as e:
            print(f"Erreur lors de la gestion de la classe : {e}")
            return JsonResponse({'success': False, 'message': f'Une erreur interne du serveur est survenue: {str(e)}'}, status=500)

    # --- 6. Gestion des requêtes GET (Affichage de la page) ---
    stape_creation_year_html = current_year and current_year.creation

    
    # Récupérer tous les niveaux disponibles pour l'école
    school_levels = Level.objects.filter(school=school_filter).order_by('level') 
    
    # Récupérer toutes les classes existantes pour l'affichage
    existing_classes = Class.objects.filter(level__school=school_filter).select_related('level').order_by('level__level', 'name')

    context = {
        'school': school_filter,
        'current_year': current_year,
        'levels': school_levels,
        'existing_classes': existing_classes,
        'user_type': user_type,
        'can_access_bulletin' : can_access_bulletin,
        'current_term_id': current_term_id,
        'is_creation_stape': stape_creation_year_html, # Pour l'affichage conditionnel dans le template
    }
    
    return render(request, 'classes/class_management.html', context)


@login_required(login_url='login')
def class_assignment_main_view(request, pk):
    """
    Vue principale (GET) pour la gestion des associations (Élèves/Professeurs)
    pour une classe donnée.
    
    Retourne la page HTML en cas de succès ou un JsonResponse en cas d'erreur
    de permission ou d'objet introuvable.
    """
    
    user_type = get_user_type(request.user)
    allowed_roles = ["SuperAdministrator", "Principal", "Administrator"] 
    
    if user_type not in allowed_roles:
        return render(request, "404.html", status=404)
    
    try:
        school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
    except School.DoesNotExist:
        return render(request, "404.html", status=404)
        
    try:
        current_class = Class.objects.get(pk=pk)
    except Class.DoesNotExist:
        return render(request, "404.html", status=404)
        
    current_year = get_current_year_for_school(school_filter)
    
    # Vérification de la cohérence de l'école
    if current_class.level.school != school_filter:
        # Retourne JSON au lieu de rendre une page 403.html
        return render(request, "404.html", status=404)

    # --- 1. Élèves : Données disponibles (Ceux qui n'ont AUCUNE affectation active cette année) ---
    
    # Exclure les élèves ayant DÉJÀ une affectation active (ClassStudentYear) pour l'année en cours
    available_students_queryset = Student.objects.select_related('user').filter(
        school=school_filter, user__is_active=True
    ).exclude(
        class_years__year=current_year,
        class_years__is_active=True
    ).order_by('user__username').values(
        'pk', 'user__first_name', 'user__last_name', 'user__username'
    )
    
    available_students_json = json.dumps(list(available_students_queryset))

    # --- 1.bis Élèves : Données déjà affectées à CETTE classe ---
    
    # On récupère l'ID de l'affectation (pk de ClassStudentYear) et le statut délégué
    assigned_students_queryset = ClassStudentYear.objects.filter(
        student_class=current_class, 
        year=current_year, 
        is_active=True
    ).select_related('student__user').values(
        'pk', # ID de l'objet ClassStudentYear (nécessaire pour toggle_delegate/unlink)
        'student_id', 
        'is_delegate', 
        'student__user__first_name', 
        'student__user__last_name', 
        'student__user__username'
    ).order_by('student__user__username')
    
    assigned_students_json = json.dumps(list(assigned_students_queryset))

    # --- 2. Professeurs : Données disponibles ---

    # Exclure les TeacherSubject déjà affectés à CETTE classe pour l'année en cours
    # NOTE: Un TeacherSubject est l'unicité (Professeur + Matière).
    available_teacher_subjects_queryset = TeacherSubject.objects.select_related('teacher__user', 'subject').filter(
        # Filtre sur l'école (assumant Teacher a une relation avec School)
        teacher__school=school_filter, 
        teacher__user__is_active=True
    ).exclude(
        class_years__student_class=current_class, 
        class_years__year=current_year,
        class_years__is_active=True
    ).order_by('teacher__user__username', 'subject__name').values(
        'pk', 'subject__name', 'teacher__user__first_name', 'teacher__user__last_name', 'teacher__user__username'
    )
    
    available_teacher_subjects_json = json.dumps(list(available_teacher_subjects_queryset))

    # --- 2.bis Professeurs : Données déjà affectées à CETTE classe ---
    
    # On récupère l'ID de l'affectation (pk de ClassTeacherYear) et le statut principal
    assigned_teachers_queryset = ClassTeacherYear.objects.filter(
        student_class=current_class, 
        year=current_year, 
        is_active=True
    ).select_related('teacher__user', 'teacher__subject').values(
        'pk', # ID de l'objet ClassTeacherYear (nécessaire pour toggle_main_teacher/unlink)
        'teacher_id', # ID de l'objet TeacherSubject
        'is_main_teacher', 
        'teacher__subject__name', 
        'teacher__teacher__user__first_name', 
        'teacher__teacher__user__last_name'
    ).order_by('teacher__subject__name')
    
    assigned_teachers_json = json.dumps(list(assigned_teachers_queryset))

    # --- 3. Construction du Contexte ---

    context = {
        'current_class': current_class,
        'current_year': current_year,
        'assigned_students_json': assigned_students_json,
        'available_students_json': available_students_json,
        'assigned_teachers_json': assigned_teachers_json,
        'available_teacher_subjects_json': available_teacher_subjects_json,
    }

    # Le seul endroit où l'on retourne une page HTML
    return render(request, 'classes/class_assignment.html', context)


@require_POST
@login_required(login_url='login')
def toggle_class_assignment_api(request, pk):
    """
    Endpoint API (POST) pour gérer le cycle de vie complet des affectations :
    - Lier/Délier Élève/Professeur
    - Mettre à jour le statut (Délégué / Prof Principal)
    """

    user_type = get_user_type(request.user)
    allowed_roles = ["SuperAdministrator", "Principal", "Administrator"] 
    
    if user_type not in allowed_roles:
        return JsonResponse({"success": False, "message": "Permission refusée. Rôle non autorisé."}, status=403) 

    try:
        school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
    except School.DoesNotExist:
        return JsonResponse({"success": False, "message": "École introuvable."}, status=404)
        
    try:
        current_class = Class.objects.get(pk=pk)
    except Class.DoesNotExist:
         return JsonResponse({"success": False, "message": "Classe introuvable."}, status=404)

    current_year = get_current_year_for_school(school_filter)
    
    if current_class.level.school != school_filter:
        return JsonResponse({"success": False, "message": "Accès classe refusé. La classe n'appartient pas à votre école."}, status=403)
    
    try:
        data = json.loads(request.body)
        action = data.get('action')
        
        if action in ['link_student', 'unlink_student', 'set_delegate']:
            # Logique pour les Élèves
            
            with transaction.atomic():
                if action == 'link_student':
                    student_id = data.get('student_id')
                    try:
                        student = Student.objects.get(pk=student_id)
                    except Student.DoesNotExist:
                        return JsonResponse({'success': False, 'message': 'Élève introuvable.'}, status=404)
                        
                    entity_name = student.user.username

                    # 1. CONFORMITÉ : Désactiver toutes les affectations actives pour cet élève/année
                    # Garantit qu'un élève n'a qu'UNE seule classe active par an.
                    ClassStudentYear.objects.filter(
                        student=student, 
                        year=current_year, 
                        is_active=True
                    ).update(is_active=False)
                    
                    # 2. Créer ou réactiver la nouvelle affectation
                    assignment, created = ClassStudentYear.objects.get_or_create(
                        student_class=current_class, 
                        student=student, 
                        year=current_year,
                        defaults={'is_active': True}
                    )

                    # Si l'objet existait (et a été désactivé par la ligne 1, ou était déjà lié)
                    if not created and not assignment.is_active:
                         assignment.is_active = True
                         assignment.save()
                    elif not created and assignment.student_class != current_class:
                         assignment.student_class = current_class
                         assignment.is_active = True
                         assignment.save()
                    
                    message = f"L'élève {entity_name} a été affecté à {current_class}. Anciennes classes désaffectées."
                    
                    return JsonResponse({
                        'success': True, 
                        'message': message, 
                        'assignment_pk': assignment.pk, 
                        'student_id': str(student.pk)
                    })

                elif action == 'unlink_student':
                    assignment_pk = data.get('assignment_pk')
                    
                    # Désactive l'affectation spécifique (maintient l'historique)
                    deleted_count = ClassStudentYear.objects.filter(
                        pk=assignment_pk,
                        student_class=current_class, 
                        year=current_year,
                        is_active=True
                    ).update(is_active=False, is_delegate=False) # Désactive le statut délégué au passage
                    
                    if deleted_count > 0:
                        message = f"L'élève a été retiré de {current_class}."
                    else:
                        message = f"Affectation élève active non trouvée pour désactivation."
                    
                    return JsonResponse({'success': True, 'message': message})

                elif action == 'set_delegate':
                    assignment_pk = data.get('assignment_pk')
                    is_delegate = data.get('is_delegate') # Booléen
                    
                    try:
                        assignment = ClassStudentYear.objects.get(pk=assignment_pk)
                    except ClassStudentYear.DoesNotExist:
                        return JsonResponse({'success': False, 'message': 'Affectation élève introuvable.'}, status=404)

                    assignment.is_delegate = is_delegate
                    assignment.save()
                    
                    status_text = "Délégué" if is_delegate else "Non Délégué"
                    message = f"Statut élève mis à jour: {status_text}."
                    
                    return JsonResponse({'success': True, 'message': message, 'is_delegate': is_delegate})


        elif action in ['link_teacher', 'unlink_teacher', 'set_main_teacher']:
            # Logique pour les Professeurs
            
            with transaction.atomic():
                if action == 'link_teacher':
                    teacher_subject_id = data.get('teacher_subject_id')
                    try:
                        teacher_subject = TeacherSubject.objects.get(pk=teacher_subject_id)
                    except TeacherSubject.DoesNotExist:
                        return JsonResponse({'success': False, 'message': 'Affectation Professeur/Matière introuvable.'}, status=404)
                        
                    teacher_name = teacher_subject.teacher.user.username
                    subject_name = teacher_subject.subject.name

                    # CONFORMITÉ : Assuré par unique_together sur (student_class, teacher, year)
                    try:
                        assignment, created = ClassTeacherYear.objects.get_or_create(
                            student_class=current_class, 
                            teacher=teacher_subject, 
                            year=current_year,
                            defaults={'is_active': True}
                        )
                        
                        if not created and not assignment.is_active:
                             # Réactive si l'entrée historique existe mais a été désactivée
                             assignment.is_active = True
                             assignment.save()
                             created = True # Traiter comme une nouvelle affectation pour le message
                        
                        if created:
                            message = f"Affectation ajoutée : {teacher_name} pour {subject_name}."
                        else:
                            # Ce cas signifie que l'affectation était déjà active
                            message = f"Affectation {teacher_name} / {subject_name} est déjà enregistrée."
                            
                        return JsonResponse({
                            'success': True, 
                            'message': message, 
                            'assignment_pk': assignment.pk, 
                            'teacher_subject_id': str(teacher_subject.pk)
                        })
                    except IntegrityError:
                         message = f"Erreur d'intégrité : Affectation Professeur/Matière déjà enregistrée."
                         return JsonResponse({'success': False, 'message': message}, status=400)


                elif action == 'unlink_teacher':
                    assignment_pk = data.get('assignment_pk')
                    
                    # Désactive l'affectation spécifique (maintient l'historique)
                    deleted_count = ClassTeacherYear.objects.filter(
                        pk=assignment_pk,
                        student_class=current_class, 
                        year=current_year,
                        is_active=True 
                    ).update(is_active=False, is_main_teacher=False) # Désactive le statut principal
                    
                    if deleted_count > 0:
                        message = f"L'affectation professeur/matière a été retirée."
                    else:
                        message = f"Affectation professeur/classe active non trouvée pour désactivation."
                    
                    return JsonResponse({'success': True, 'message': message})


                elif action == 'set_main_teacher':
                    assignment_pk = data.get('assignment_pk')
                    is_main_teacher = data.get('is_main_teacher') # Booléen
                    
                    try:
                        assignment = ClassTeacherYear.objects.get(pk=assignment_pk)
                    except ClassTeacherYear.DoesNotExist:
                        return JsonResponse({'success': False, 'message': 'Affectation professeur introuvable.'}, status=404)

                    # CONFORMITÉ : Un seul professeur principal par classe/année
                    if is_main_teacher:
                        # Désactiver le statut principal de tous les autres professeurs dans cette classe/année
                        ClassTeacherYear.objects.filter(
                            student_class=current_class, 
                            year=current_year, 
                            is_active=True,
                            is_main_teacher=True
                        ).exclude(pk=assignment_pk).update(is_main_teacher=False)
                        
                    assignment.is_main_teacher = is_main_teacher
                    assignment.save()
                    
                    status_text = "Principal" if is_main_teacher else "Non Principal"
                    message = f"Statut professeur mis à jour: {status_text}."
                    
                    return JsonResponse({'success': True, 'message': message, 'is_main_teacher': is_main_teacher})

        else:
            return JsonResponse({'success': False, 'message': 'Action non reconnue.'}, status=400)

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Requête invalide (JSON non valide).'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Erreur interne du serveur: {str(e)}'}, status=500)
