from django.shortcuts import render, get_object_or_404
from django.http import HttpResponseBadRequest 
from django.db import transaction, IntegrityError


from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

from subjects.models import Subject, TeacherSubject
from schools.models import School, Year
from users.models import Staff

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

        # Si on veut désactiver une matière 
        if new_status == False:
            # Récupération de l'année actuelle en fonction de l'école de la matière 
            all_years = Year.objects.filter(school=subject.school).order_by('-start_date')
            current_year = all_years.filter(current=True).first()

            # Si l'année est en cours de déroulement, impossible d'enlever une matière d'un professeurs
            if current_year.running == True:
                return JsonResponse({'success': False, 'message': "Vous ne pouvez pas désactiver une matière lorsque l'école est dans sa phase de déroulement."}, status=500)


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


@login_required(login_url='login')
def assign_subjects_view(request):
    """
    Vue principale pour afficher la page d'attribution des matières aux professeurs.
    Récupère tous les professeurs, les matières et les liens existants de l'école de l'utilisateur.
    """

    user_type = get_user_type(request.user)
    
    # 1. Vérification de permission : SuperAdmin ou Principal
    if user_type not in ["SuperAdministrator", "Principal"]:
        return HttpResponseBadRequest("Accès refusé. Seuls les Principaux et Administrateurs peuvent gérer les attributions.")

    # 2. Détermination de l'école cible pour le filtre (Sécurité)
    if user_type == "SuperAdministrator":
        school_id_filter = request.session.get('selected_school_id')
        school = get_object_or_404(School, id=school_id_filter)
    else: # Principal
        school = get_user_school(request.user, request.session.get('selected_school_id'))
        if not school:
            return JsonResponse({"success": False, "message": "École utilisateur introuvable."}, status=403)

    if school.is_active == False:
        return JsonResponse({"success": False, "message": "École inactive."}, status=403)

    try:
        # 3. Récupérer les Professeurs actifs (Staff type 'TEACHER') de l'école.
        teachers_queryset = Staff.objects.select_related('user').filter(
            school=school, 
            staff_type='TEACHER', 
            user__is_active=True
        ).order_by('user__username')
        
        # 4. Récupérer les Matières actives de l'école.
        subjects_queryset = Subject.objects.filter(
            school=school, 
            is_active=True
        ).order_by('name')

        # 5. Récupérer les liens existants pour l'école
        # On filtre par l'école via le professeur pour s'assurer de la cohérence
        all_links = TeacherSubject.objects.filter(
            teacher__school=school
        ).select_related('teacher', 'subject')

        # 6. Construire la liste des matières pour le front-end JSON
        subjects_to_serialize = []
        for subject in subjects_queryset:
            subjects_to_serialize.append({
                'id': str(subject.id), 
                'name': subject.name,
                'color': subject.color, 
            })

        # 7. Construire la structure des liens existants (links_data)
        # Format: { teacher_id: [subject_id1, subject_id2, ...], ... }
        links_data = {}

        for link in all_links:
            teacher_id_str = str(link.teacher_id)
            subject_id_str = str(link.subject_id)

            if teacher_id_str not in links_data:
                links_data[teacher_id_str] = []
            
            links_data[teacher_id_str].append(subject_id_str)

        # 8. Sérialisation des données
        subjects_json = json.dumps(subjects_to_serialize)
        links_json = json.dumps(links_data)

        context = {
            'teachers': teachers_queryset, 
            'subjects_data': subjects_json, 
            'links_data': links_json,
            'user_school': school, # Passé pour affichage dans le template
        }

        return render(request, 'subjects/assign_subjects.html', context)

    except Exception as e:
        return HttpResponseBadRequest("Erreur interne lors du chargement des données.")


@require_http_methods(["POST"])
@login_required
def toggle_teacher_subject_assignment_api(request):
    """
    Endpoint API pour lier ou délier un professeur à une matière.
    """
    
    # 1. Vérification de permission
    user_type = get_user_type(request.user)
    
    if user_type not in ["SuperAdministrator", "Principal"]:
        return JsonResponse({'success': False, 'message': 'Permission refusée.'}, status=403)
    
    try:
        data = json.loads(request.body)
        teacher_id = data.get('teacher_id')
        subject_id = data.get('subject_id')
        action = data.get('action') # 'link' ou 'unlink'

        if not all([teacher_id, subject_id, action]):
            return JsonResponse({'success': False, 'message': 'Données manquantes.'}, status=400)

        # 2. Récupérer les objets (l'utilisateur DOIT être un TEACHER)
        try:
            teacher = Staff.objects.select_related('user').get(pk=teacher_id, staff_type='TEACHER')
        except Staff.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Professeur non trouvé ou type de personnel incorrect.'}, status=404)

        try:
            subject = Subject.objects.get(pk=subject_id)
        except Subject.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Matière non trouvée.'}, status=404)
        
        
        # 3. Vérification de la cohésion de l'école (Prof et Matière dans la même école)
        if teacher.school.id != subject.school.id:
            return JsonResponse({'success': False, 'message': 'Cohésion échouée: Le professeur et la matière n\'appartiennent pas à la même école.'}, status=400)
            
        
        teacher_full_name = f"{teacher.user.username}"
        
        if action == 'link':
            try:
                # Création du lien
                with transaction.atomic():
                    TeacherSubject.objects.create(teacher=teacher, subject=subject)
                
                message = f"Lien créé : {teacher_full_name} enseignera {subject.name}."
                return JsonResponse({'success': True, 'message': message})
            except IntegrityError:
                # Le lien existe déjà (géré par unique_together)
                message = "Le lien existe déjà."
                return JsonResponse({'success': True, 'message': message}) 

        elif action == 'unlink':
            # Suppression du lien
            try:
                # Récupération de l'année actuelle en fonction de l'école de la matière 
                all_years = Year.objects.filter(school=subject.school).order_by('-start_date')
                current_year = all_years.filter(current=True).first()

                # Si l'année est en cours de déroulement, impossible d'enlever une matière d'un professeurs
                if current_year.running == True:
                    return JsonResponse({'success': False, 'message': "Vous ne pouvez pas désactiver une matière lorsque l'école est dans sa phase de déroulement."}, status=500)

                deleted_count, _ = TeacherSubject.objects.filter(teacher=teacher, subject=subject).delete()

                if deleted_count > 0:
                    message = f"Lien supprimé : {teacher_full_name} n'enseignera plus {subject.name}."
                    return JsonResponse({'success': True, 'message': message})
                else:
                    message = "Le lien n'existe pas."
                    return JsonResponse({'success': True, 'message': message})
            except Exception as e:
                return JsonResponse({'success': False, 'message': f"Erreur lors de la suppression: {str(e)}"}, status=500)
        
        else:
            return JsonResponse({'success': False, 'message': 'Action non reconnue. Utilisez "link" ou "unlink".'}, status=400)

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Requête invalide (JSON non valide).'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Erreur interne du serveur: {str(e)}'}, status=500)
