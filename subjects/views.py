from django.shortcuts import render, get_object_or_404
from django.http import HttpResponseBadRequest # <-- Importez-la depuis django.http

from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

from subjects.models import Subject 
from schools.models import School 

from users.utils import get_user_type
from schools.utils import get_user_school

# Choix des couleurs pour le formulaire de création/modification
COLOR_CHOICES = [
    ('RED', 'Rouge'), 
    ('BLUE', 'Bleu'), 
    ('GREEN', 'Vert'), 
    ('YELLOW', 'Jaune'), 
    ('ORANGE', 'Orange'), 
    ('PURPLE', 'Violet'), 
    ('GRAY', 'Gris'),
]

@login_required
def manage_subjects(request):
    """
    Affiche la page de gestion des matières, filtrées par l'école de l'utilisateur
    (Principal) ou l'école sélectionnée (SuperAdministrator).
    """
    user_type = get_user_type(request.user)
    school_filter = None
    
    # 1. Vérification des permissions
    if user_type not in ["SuperAdministrator", "Principal"]:
        return HttpResponseBadRequest("Vous n'avez pas la permission de gérer les matières (uniquement Super Admin ou Principal).") # TODO à la place de HttpResponseBadRequest dans le projet, retourner vers une page d'erreur et déconnexion de l'utilisateur

    # 2. Détermination de l'école cible pour le filtre
    if user_type == "SuperAdministrator":
        # Le Super Admin gère les matières pour l'école sélectionnée dans la session
        school_id_filter = request.session.get('selected_school_id')
        if not school_id_filter:
            return render(request, 'subjects/manage_subjects.html', {'error': 'Veuillez sélectionner une école pour gérer les matières.'})
        try:
            school_filter = School.objects.get(id=school_id_filter)
        except School.DoesNotExist:
            return render(request, 'subjects/manage_subjects.html', {'error': 'École sélectionnée introuvable.'})
        
    elif user_type == "Principal":
        # Le Principal gère les matières pour son école
        user_school = get_user_school(request.user, request.session.get('selected_school_id'))
        if not user_school:
            return render(request, 'subjects/manage_subjects.html', {'error': 'Impossible de déterminer l\'école associée à votre compte.'})
        school_filter = user_school
    
    # 3. Récupération des matières avec contrôle
    if school_filter:
        if school_filter.is_active == False:
            return HttpResponseBadRequest("L'école est inactive.") # TODO à la place de HttpResponseBadRequest dans le projet, retourner vers une page d'erreur
        else:
            subjects = Subject.objects.filter(school=school_filter).order_by('name')
    else:
        subjects = Subject.objects.none() # Aucune école déterminée = aucune matière


    context = {
        'subjects': subjects,
        'user_school': school_filter, # L'école utilisée pour le filtrage
        'color_choices': COLOR_CHOICES,
        # Ajoutez les variables de permission nécessaires pour le template si besoin
        'user_is_super_admin': (user_type == "SuperAdministrator"), 
        'user_is_principal': (user_type == "Principal"), 
    }
    
    return render(request, 'subjects/manage_subjects.html', context)


@require_http_methods(["POST"])
@csrf_exempt
@login_required
def create_or_update_subject(request):
    """
    Gère la création d'une nouvelle matière ou la modification d'une matière existante
    via requête AJAX POST.
    """
    user_type = get_user_type(request.user)
    
    # 1. Vérification des permissions
    if user_type not in ["SuperAdministrator", "Principal"]:
        return JsonResponse({"success": False, "message": "Accès refusé. Seuls les Super Admin et Principaux peuvent gérer les matières."}, status=403)

    try:
        data = json.loads(request.body)
        subject_id = data.get('subject_id')
        name = data.get('name')
        color = data.get('color')
        
        # 2. Validation des champs obligatoires
        if not name or not color:
            return JsonResponse({"success": False, "message": "Le nom de la matière et la couleur sont obligatoires."}, status=400)

        # 3. Détermination de l'école cible (Sécurité)
        
        # L'école est déterminée par la session (Super Admin) ou le profil (Principal)
        if user_type == "SuperAdministrator":
            school_id_filter = request.session.get('selected_school_id')
            if not school_id_filter:
                 return JsonResponse({"success": False, "message": "Veuillez sélectionner une école."}, status=400)
            school = get_object_or_404(School, id=school_id_filter)
        
        else: # Principal
            school = get_user_school(request.user, request.session.get('selected_school_id'))
            if not school:
                 return JsonResponse({"success": False, "message": "École utilisateur introuvable."}, status=403)
        
        
        if subject_id:
            # --- MODE MODIFICATION ---
            # On s'assure que la matière appartient bien à l'école de l'utilisateur/admin
            subject = get_object_or_404(Subject, id=subject_id, school=school)
            
            # Mise à jour des données
            subject.name = name
            subject.color = color
            subject.save()
            
            message = f'La matière **"{name}"** a été mise à jour avec succès.'
        
        else:
            # --- MODE CRÉATION ---
            # Vérifier l'unicité du nom pour cette école (optionnel mais recommandé)
            if Subject.objects.filter(school=school, name=name).exists():
                 return JsonResponse({"success": False, "message": f'Une matière nommée "{name}" existe déjà dans cette école.'}, status=400)
                 
            subject = Subject.objects.create(
                school=school,
                name=name,
                color=color,
                is_active=True # Nouvelle matière active par défaut
            )
            message = f'La matière **"{name}"** a été créée avec succès.'
            
        return JsonResponse({
            "success": True, 
            "message": message, 
            "subject_id": subject.id,
            "name": subject.name,
            "color": subject.color
        })

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Requête JSON invalide."}, status=400)
    except Subject.DoesNotExist:
         return JsonResponse({"success": False, "message": "Matière introuvable pour cette école."}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur inattendue : {str(e)}"}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required
def toggle_subject_status(request):
    """
    Gère l'activation ou la désactivation d'une matière via requête AJAX POST.
    """
    user_type = get_user_type(request.user)
    
    # 1. Vérification des permissions
    if user_type not in ["SuperAdministrator", "Principal"]:
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)

    try:
        data = json.loads(request.body)
        subject_id = data.get('subject_id')
        
        # 2. Détermination de l'école cible pour le filtre (Sécurité)
        if user_type == "SuperAdministrator":
            school_id_filter = request.session.get('selected_school_id')
            school = get_object_or_404(School, id=school_id_filter)
        else: # Principal
            school = get_user_school(request.user, request.session.get('selected_school_id'))
            if not school:
                 return JsonResponse({"success": False, "message": "École utilisateur introuvable."}, status=403)

        # 3. Récupération et mise à jour de la matière
        # On s'assure que la matière appartient à l'école cible
        subject = get_object_or_404(Subject, id=subject_id, school=school)
        
        new_status = not subject.is_active
        subject.is_active = new_status
        subject.save()
        
        action_str = "activée" if new_status else "désactivée"
        message = f'La matière **"{subject.name}"** a été {action_str} avec succès.'
        
        return JsonResponse({
            "success": True, 
            "message": message, 
            "is_active": new_status
        })

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Requête JSON invalide."}, status=400)
    except Subject.DoesNotExist:
         return JsonResponse({"success": False, "message": "Matière introuvable ou non associée à l'école cible."}, status=404)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Erreur inattendue : {str(e)}"}, status=500)

