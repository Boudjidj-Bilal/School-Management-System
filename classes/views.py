from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json

from users.utils import get_user_type
from schools.utils import get_user_school, get_authorisation_stape_run_year, get_current_year_for_school, get_authorisation_stape_creation_year

from .models import Classroom, Level, Class
from schools.models import School 

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
        return JsonResponse({"success": False, "message": "Vous n'avez pas la permission de gérer les salles de classe."}, status=403)

    # 2. Détermination du contexte de l'école
    try:
        if user_type == "SuperAdministrator" or user_type == "Principal":
            school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
        else:
            return JsonResponse({"success": False, "message": "Contexte de l'école non défini."}, status=400)
    except School.DoesNotExist:
        return JsonResponse({"success": False, "message": "L'école sélectionnée est introuvable."}, status=404)
    
    # Si l'école est désactiver, impossible de continuer
    if not school_filter.is_active:
        return JsonResponse({"success": False, "message": "L'école sélectionnée est désactivé."}, status=404) # TODO : Retourner une page d'erreur (qui déonnecte l'utilisateur)

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
        return JsonResponse({"success": False, "message": "Vous n'avez pas la permission de gérer les niveaux scolaires."}, status=403) 

    # 2. Détermination du contexte de l'école
    try:
        school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
    except School.DoesNotExist:
        return JsonResponse({"success": False, "message": "L'école sélectionnée est introuvable."}, status=404) # TODO : return une page d'erreur
    
    if not school_filter:
        return JsonResponse({"success": False, "message": "L'école sélectionnée est introuvable."}, status=404) # TODO : return une page d'erreur
    
    elif not school_filter.is_active:
        return JsonResponse({"success": False, "message": "L'école sélectionnée est désactivée. Impossible de procéder."}, status=403) # TODO : return une page d'erreur
        
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

# TODO Lorsqu'on clique sur une classe, possibilité de lui ajouter des élèves et des professeurs 
# (principal (1 seul) délégués de classe), un élève peut être que dans une seul classe par année, 
# un prof peut apparaitre dans plusieurs classes mais peut être le professeurs principal d'une seul 
# classe par année
@require_http_methods(["GET", "POST"])
@csrf_exempt 
@login_required
def class_management(request):
    """
    Vue unifiée pour la gestion complète (CRUD) des classes académiques (Class)
    pour une école donnée.
    L'opération est uniquement autorisée lorsque l'année scolaire est en phase de Création.
    """
    
    # 1. Détermination du contexte utilisateur et permission
    user_type = get_user_type(request.user)
    allowed_roles = ["SuperAdministrator", "Principal", "Administrator"] 
    
    if user_type not in allowed_roles:
        return JsonResponse({"success": False, "message": "Vous n'avez pas la permission de gérer les classes."}, status=403) 

    # 2. Détermination du contexte de l'école
    try:
        school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
    except School.DoesNotExist:
        return JsonResponse({"success": False, "message": "L'école sélectionnée est introuvable."}, status=404)
    
    if not school_filter or not school_filter.is_active:
        message = "L'école sélectionnée est introuvable ou désactivée. Impossible de procéder."
        return JsonResponse({"success": False, "message": message}, status=404 if not school_filter else 403)
        
    # 3. Détermination de l'année scolaire actuelle
    current_year = get_current_year_for_school(school_filter)

    # 4. Vérification du stade de l'année scolaire (Condition clé pour le CRUD)
    stape_creation_year = current_year and current_year.creation
    
    if stape_creation_year and request.method == 'POST':
        return JsonResponse(
            {"success": False, 
             "message": "Opération non autorisée. La gestion des classes (Création/Modification/Suppression) n'est possible que lorsque l'année scolaire est à l'étape de Création."}, 
            status=403
        )

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
        'is_creation_stape': stape_creation_year_html, # Pour l'affichage conditionnel dans le template
    }
    
    return render(request, 'classes/class_management.html', context)
