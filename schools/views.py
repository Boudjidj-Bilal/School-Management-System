from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden

import json
import datetime

from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from users.utils import create_user, create_staff, get_user_type, generate_unique_username, send_email_create_compte, get_user_by_username, generate_random_password
from .utils import create_school, get_user_school, create_year

from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError, transaction
from django.db.models import Q # Assurez-vous d'importer Q en haut du fichier views.py

from .models import School, Year

User = get_user_model()

@login_required(login_url='login')
def create_school_view(request):
    """
    Vue pour créer une nouvelle école et un proviseur.
    """
    type = get_user_type(request.user) 

    if type == "SuperAdministrator": # On vérifie si l'utilisateur est un super admin.
        if request.method == 'GET':
            # Affiche le formulaire
            return render(request, 'schools/form_school.html')
        
        if request.method == 'POST':
            try:
                data = json.loads(request.body)
                
                # Données de l'école
                school_data = data.get('school_data')
                
                # Données de l'utilisateur (proviseur)
                principal_data = data.get('principal_data')

                length_password = 10
                password = generate_random_password(length_password, include_digits = True, include_special_chars = False) # On génère un mot de passe automatique


                # Récupère l'utilisateur Super Administrateur
                super_admin = request.user

                first_name = principal_data['first_name']
                last_name = principal_data['last_name']

                principal_email = principal_data['email']

                username_principal = generate_unique_username(first_name, last_name) # On génère un nom d'utilisateur unique
                
                # 1. Crée l'utilisateur (proviseur)
                principal_user, message_error = create_user(
                    username=username_principal,
                    password=password,
                    email=principal_email,
                    first_name=first_name,
                    last_name=last_name
                )

                if message_error:
                    return JsonResponse({'success': False, 'message': message_error}, status=400)

                # 2. Crée l'école
                school, message_error = create_school(
                    name=school_data['name'],
                    address=school_data['address'],
                    type=school_data['type'],
                    email=school_data['email'],
                    super_admin_id=super_admin.id,
                    phone_number=school_data['phone_number']
                )

                if message_error:
                    return JsonResponse({'success': False, 'message': message_error}, status=400)

                # 3. Crée le membre du staff (proviseur)
                user_principal = get_user_by_username(username_principal)

                principal_staff, message_error = create_staff(
                    user=user_principal,
                    staff_type="PRINCIPAL",
                    school=school,
                    gender=principal_data['gender'],
                    address=principal_data['address'],
                    birth_date=principal_data.get('birth_date')
                )

                if message_error:
                    return JsonResponse({'success': False, 'message': message_error}, status=400)

                send_email_create_compte(request, principal_email, username_principal, password) # Envoie de l'email au proviseur

                return JsonResponse({'success': True, 'message': "École et proviseur créés avec succès. Voici le nom d'utilisateur du proviseur : "+username_principal})
            except json.JSONDecodeError:
                return JsonResponse({'success': False, 'message': 'Données JSON invalides.'}, status=400)
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)}, status=500)
    else:
        return JsonResponse({'success': False, 'message': 'Accès non autorisé.'}, status=403)


@login_required(login_url='login')
def update_school_view(request):
    """
    Vue pour modifier une école. #TODO
    """
    return "" # TODO Accessible pour le super admin et aussi pour le proviseur qui peut changer sa propre école




# TODO Envoyer un mail lorsque l'année commence à tous le personnel de l'école, sauf le proviseur.

@login_required(login_url='login')
def manage_years_view(request):
    """
    Affiche la page de gestion des années scolaires.
    """
    user_type = get_user_type(request.user)
    
    # Vérifie si l'utilisateur a la permission : SuperAdministrator, Principal
    if user_type not in ["SuperAdministrator", "Principal"]:
        return HttpResponseForbidden("Accès refusé. Vous n'avez pas les droits nécessaires pour gérer les années scolaires.")

    # 1. Déterminer l'école de l'utilisateur
    if user_type == "SuperAdministrator":
        school_id_filter = request.session.get('selected_school_id')
        school = School.objects.get(id=school_id_filter)
    else:
        school = get_user_school(request.user)
        # TODO : Vérifie si l'école est actif ou inactif
        # Si inactif, retourne un message d'erreur

    if not school:
        # Si SuperAdmin n'a pas sélectionné d'école ou si l'utilisateur n'est pas lié
        return HttpResponseForbidden("Aucune école associée à cet utilisateur ou sélectionnée.")

    # 2. Récupérer toutes les années scolaires pour cette école, triées par date de début
    all_years = Year.objects.filter(school=school).order_by('-start_date')

    current_year = all_years.filter(current=True).first()
    other_years = all_years.exclude(id=current_year.id) if current_year else all_years

    context = {
        'school_id': school.id,
        'current_year': current_year,
        'other_years': other_years,
    }

    return render(request, 'schools/manage_years.html', context)


# TODO Si l'école est inactif, impossible d'accéder à cette fonction
@require_http_methods(["POST"])
@csrf_exempt
@login_required
def create_or_update_year_api(request):
    """
    API pour créer ou modifier une année scolaire.
    """
    user_type = get_user_type(request.user)
    if user_type not in ["SuperAdministrator", "Principal"]:
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)
        
    try:
        data = json.loads(request.body)
        year_id = data.get('year_id')
        
        name = data.get('name')
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        min_time_str = data.get('min_time')
        max_time_str = data.get('max_time')
        
        # 1. Validation des données de base
        if not all([name, start_date_str, end_date_str, min_time_str, max_time_str]):
            return JsonResponse({"success": False, "message": "Veuillez compléter tous les champs obligatoires (nom, dates, heures)."}, status=400)
            
        # Conversion des chaînes en objets Python
        start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        min_time = datetime.datetime.strptime(min_time_str, '%H:%M').time()
        max_time = datetime.datetime.strptime(max_time_str, '%H:%M').time()
        
        # 2. Déterminer l'école (même logique que dans la vue)
        if user_type == "SuperAdministrator":
            school_id_filter = request.session.get('selected_school_id')
            school = School.objects.get(id=school_id_filter)
        else:
            school = get_user_school(request.user)

        if not school:
            return JsonResponse({"success": False, "message": "École non déterminée."}, status=400)

        with transaction.atomic():
            if year_id:
                # --- MODE MODIFICATION ---
                year = get_object_or_404(Year, pk=year_id, school=school)
                
                # Mise à jour des champs
                year.name = name
                year.start_date = start_date
                year.end_date = end_date
                year.min_time = min_time
                year.max_time = max_time
                
                # Le statut 'current' ne devrait pas être modifiable facilement
                # (il est géré par la création d'une nouvelle année)
                # Mais si l'utilisateur sélectionne explicitement 'current' via un autre mécanisme, on peut le gérer ici.

                year.save()
                message = f"L'année scolaire **{year.name}** a été modifiée avec succès."

            else:
                # --- MODE CRÉATION ---
                
                # Vérification de la non-chevauchement des dates (simplifié)
                if Year.objects.filter(school=school, name=name).exists():
                     return JsonResponse({"success": False, "message": f"Une année scolaire nommée '{name}' existe déjà."}, status=400)

                # 3. Gérer le drapeau 'current' : Si on crée une nouvelle année, l'ancienne est désactivée
                # Note: La nouvelle année est mise à 'current=True' par défaut
                Year.objects.filter(school=school, current=True).update(current=False)
                
                # Création                
                new_year = Year.objects.create(
                    name=name,
                    start_date=start_date,
                    end_date=end_date,
                    min_time=min_time,
                    max_time=max_time,
                    school=school,
                    current=True,         # La nouvelle année est automatiquement l'année actuelle
                    creation=True,        # État initial
                    registration=False,
                    running=False,
                    end_year=False,
                    finished=False,
                )

                # 1. Sélectionner toutes les autres années de la même école.
                # Nous utilisons Q(pk=new_year.pk) pour exclure l'année que nous venons de créer.
                other_years = Year.objects.filter(school=school).exclude(Q(pk=new_year.pk))

                # 2. Mettre à jour ces années : elles ne sont plus 'current' et sont 'finished' (terminées).
                other_years.update(
                    current=False,
                    finished=True,
                    # Par sécurité, nous mettons aussi tous les autres statuts à False
                    creation=False,
                    registration=False,
                    running=False,
                    end_year=False
                )

                message = f"La nouvelle année scolaire **{new_year.name}** a été créée et est maintenant l'année actuelle."
                
            return JsonResponse({"success": True, "message": message})

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": "Requête invalide (JSON non valide)."}, status=400)
    except IntegrityError as e:
        return JsonResponse({"success": False, "message": f"Erreur d'intégrité de la base de données : {str(e)}"}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "message": f"Une erreur interne est survenue: {str(e)}"}, status=500)


# Mappage des clés de statut du JS vers les noms des champs booléens du modèle Year
# Assurez-vous que ces noms de champs correspondent à ceux de votre modèle Year
STATUS_FIELDS = {
    'creation': 'creation',
    'registration': 'registration',
    'running': 'running',
    'end_year': 'end_year',
    'finished': 'finished',
}

@require_http_methods(["POST"])
@login_required
def change_year_status_api(request, year_id):
    """
    Change le statut (étape) de l'année scolaire actuelle.
    La requête doit contenir 'new_status' avec une clé valide (e.g., 'registration').
    """
    try:
        user_type = get_user_type(request.user)

        if user_type not in ["SuperAdministrator", "Principal"]:
            return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)
        
        # 1. Charger l'objet Year
        year = get_object_or_404(Year, pk=year_id)

        # 2. On vérifie si on est bien dans l'année actuelle :
        if year.current == False :
            return JsonResponse({'success': False, 'message': 'Impossible de modifier le statut d\'une année terminée.'}, status=400)
   
        # 3. Charger les données du corps de la requête
        try:
            data = json.loads(request.body)
            new_status_key = data.get('new_status')
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Format de données JSON invalide.'}, status=400)

        # 4. Validation de la clé de statut
        if new_status_key not in STATUS_FIELDS:
            return JsonResponse({'success': False, 'message': f"Statut invalide: '{new_status_key}'."}, status=400)
            
        new_field_name = STATUS_FIELDS[new_status_key]
        
        # 5. Vérification de la permission pour une année terminée
        if year.finished:
            # Si l'année est 'finished', le seul changement autorisé est de revenir à 'end_year'.
            if new_status_key != 'end_year':
                return JsonResponse({'success': False, 'message': 'Une année terminée ne peut être modifiée que pour revenir à l\'étape "Fin d\'année".'}, status=403)
        
        # 6. Réinitialiser tous les champs de statut booléens à False pour garantir l'unicité
        # N'inclut pas is_current_year
        for field_name in STATUS_FIELDS.values():
            setattr(year, field_name, False)
            
        # 7. Définir le nouveau champ de statut à True
        setattr(year, new_field_name, True)

        # TODO Ajouter une vérification dans le js, lorsqu"on clique sur passer à une étape suivante il faut un message de vérfication
        
        message = f"L'année '{year.name}' est passée à l'étape '{new_status_key.capitalize()}'. (Veuillez recharger la page)"


        # 8. Sauvegarder les modifications
        year.save()

        if new_field_name == 'registration':
            pass # TODO Envoie un mail à tout les administrateur actif de cette école afin de les prévenir que l'étape de l'enregistrement à commencé
        elif new_field_name == 'running': 
            pass # TODO Envoie un mail à tout les profs et les CPE actif de cette école afin de les prévenir que l'étape de l'enregistrement à commencé
        
        return JsonResponse({'success': True, 'message': message})

    except Year.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Année scolaire non trouvée ou accès refusé.'}, status=404)
    except Exception as e:
        print(f"Erreur lors du changement de statut: {e}")
        return JsonResponse({'success': False, 'message': 'Une erreur serveur est survenue lors du changement de statut.'}, status=500)
