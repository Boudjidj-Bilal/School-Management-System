from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json

from users.utils import get_user_type
from schools.utils import get_user_school, get_authorisation_stape_run_year

from .models import Classroom 
from schools.models import School 


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
