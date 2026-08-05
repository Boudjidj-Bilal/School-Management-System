from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse

import json
from datetime import date, time, datetime

from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from django.contrib import messages

from users.utils import create_user, create_staff, get_user_type, generate_unique_username, send_email_create_compte, get_user_by_username, generate_random_password, send_emails_for_year_stage
from .utils import create_school, get_user_school, get_current_year_for_school, get_authorisation_stape_creation_year, create_term_year_level, check_first_terms_for_school_year

from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError, transaction
from django.db.models import Q # Assurez-vous d'importer Q en haut du fichier views.py
from django.core.exceptions import ValidationError

from .models import School, Year, ExceptionDay, ExceptionTime, TermYearLevel
from classes.utils import get_levels_by_school
from classes.models import Level

from .forms import SchoolUpdateForm

from django.utils.translation import gettext_lazy as _

# --- Constantes pour la logique de gestion des trimestres ---
TERM_TYPE_TRIMESTRE = "TRIMESTRE"
TERM_TYPE_SEMESTRE = "SEMESTRE"
TERM_TYPE_UNIQUE = "UNIQUE"
MAX_COUNTER_TRIMESTRE = 3
MAX_COUNTER_SEMESTRE = 2
MAX_COUNTER_UNIQUE = 1

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
            
                # 1. Crée l'école
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
                
                username_principal = generate_unique_username(first_name, last_name) # On génère un nom d'utilisateur unique

                # 2. Crée l'utilisateur (proviseur)
                principal_user, message_error = create_user(
                    username=username_principal,
                    password=password,
                    email=principal_email,
                    first_name=first_name,
                    last_name=last_name
                )

                if not message_error:
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

                return JsonResponse({'success': True, 'message': _("École et proviseur créés avec succès. Voici le nom d'utilisateur du proviseur : ")+username_principal})
            except json.JSONDecodeError:
                return JsonResponse({'success': False, 'message': _('Données JSON invalides.')}, status=400)
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)}, status=500)
    else:
        return render(request, "404.html", status=404)


@login_required(login_url='login')
def manage_years_view(request):
    """
    Affiche la page de gestion des années scolaires.
    """
    user_type = get_user_type(request.user)

    if not user_type:
        return render(request, "404.html", status=404)
    
    # Vérifie si l'utilisateur a la permission de voir cette page : 
    if user_type not in ["SuperAdministrator", "Principal"]:
        return render(request, "404.html", status=404)

    school = get_user_school(request.user, request.session.get('selected_school_id'))

    if not school:
        return render(request, "404.html", status=404)

    if not school.is_active:
        return render(request, "404.html", status=404)

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

@require_http_methods(["POST"])
@csrf_exempt
@login_required
def create_or_update_year_api(request):
    """
    API pour créer ou modifier une année scolaire.
    """
    user_type = get_user_type(request.user)

    if user_type not in ["SuperAdministrator", "Principal"]:
        return render(request, "404.html", status=404)
        
    # 1. Déterminer l'école
    school = get_user_school(request.user, request.session.get('selected_school_id'))

    if school:
        if not school.is_active:
            return render(request, "404.html", status=404)
    else: 
        return render(request, "404.html", status=404)

    try:
        data = json.loads(request.body)
        year_id = data.get('year_id')
        
        name = data.get('name')
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        min_time_str = data.get('min_time')
        max_time_str = data.get('max_time')
        
        # 2. Validation des données de base
        if not all([name, start_date_str, end_date_str, min_time_str, max_time_str]):
            return JsonResponse({"success": False, "message": _("Veuillez compléter tous les champs obligatoires (nom, dates, heures).")}, status=400)
            
        # Conversion des chaînes en objets Python
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        min_time = datetime.strptime(min_time_str, '%H:%M').time()
        max_time = datetime.strptime(max_time_str, '%H:%M').time()
                
        with transaction.atomic():
            if year_id:
                # --- MODE MODIFICATION ---
                
                year = get_object_or_404(Year, pk=year_id, school=school)

                if not year.creation:
                    return JsonResponse({"success": False, "message": _("Impossible de modifier l'année, vous devez être dans la phase de création.")}, status=400)

                year.name = name
                year.start_date = start_date
                year.end_date = end_date
                year.min_time = min_time
                year.max_time = max_time
                
                year.save()
                message = _("L'année scolaire {year} a été modifiée avec succès.").format(year=year.name)

            else:
                # --- MODE CRÉATION ---

                current_year = get_current_year_for_school(school)
                if current_year:
                    if not current_year.finished:
                        return JsonResponse({"success": False, "message": _("Impossible de créer une nouvelle année, vous devez d'abord terminer la précédente.")}, status=400)
   
                if Year.objects.filter(school=school, name=name).exists():
                     return JsonResponse({"success": False, "message": _("Une année scolaire nommée '{name}' existe déjà.").format(name=name)}, status=400)

                # Mise à jour du flag 'current' pour sécurité
                Year.objects.filter(school=school, current=True).update(current=False)
                
                # Création de la nouvelle année              
                new_year = Year.objects.create(
                    name=name,
                    start_date=start_date,
                    end_date=end_date,
                    min_time=min_time,
                    max_time=max_time,
                    school=school,
                    current=True,
                    creation=True,
                    registration=False,
                    running=False,
                    end_year=False,
                    finished=False,
                )

                # 1. Sélectionner toutes les autres années de la même école (les anciennes)
                other_years = Year.objects.filter(school=school).exclude(Q(pk=new_year.pk))

                # NETTOYAGE DES RELATIONS PROF-CLASSE ---
                # On récupère toutes les affectations liées aux années précédentes et on les supprime.
                # Cela libère le couple (Prof, Classe) pour la nouvelle année.
                from classes.models import ClassTeacherYear # Import local pour éviter les cycles si besoin
                
                ClassTeacherYear.objects.filter(
                    year__in=other_years
                ).update(is_active=False)

                # 2. Mettre à jour ces années (archivage)
                other_years.update(
                    current=False,
                    finished=True,
                    creation=False,
                    registration=False,
                    running=False,
                    end_year=False
                )

                message = _("La nouvelle année scolaire {year} a été créée et est maintenant l'année actuelle.").format(year=new_year.name)
                
            return JsonResponse({"success": True, "message": message})

    except json.JSONDecodeError:
        return JsonResponse({"success": False, "message": _("Requête invalide (JSON non valide).")}, status=400)
    except IntegrityError as e:
        return JsonResponse({"success": False, "message": _("Erreur d'intégrité de la base de données : {error}").format(error=str(e))}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "message": _("Une erreur interne est survenue: {error}").format(error=str(e))}, status=500)


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
            return render(request, "404.html", status=404)
        
        # 1. Charger l'objet Year
        year = get_object_or_404(Year, pk=year_id)

        # 2. On vérifie si on est bien dans l'année actuelle :
        if not year or not year.current:
            return JsonResponse({'success': False, 'message': _('Impossible de modifier le statut d’une année terminée.')}, status=400)
   
        # 3. Charger les données du corps de la requête
        try:
            data = json.loads(request.body)
            new_status_key = data.get('new_status')
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': _('Format de données JSON invalide.')}, status=400)

        # 4. Validation de la clé de statut
        if new_status_key not in STATUS_FIELDS:
            return JsonResponse({'success': False, 'message': _("Statut invalide: '{new_status}'.").format(new_status=new_status_key)}, status=400)
            
        new_field_name = STATUS_FIELDS[new_status_key]
        
        # 5. Vérification de la permission pour une année terminée
        if year.finished:
            # Si l'année est 'finished', le seul changement autorisé est de revenir à 'end_year'.
            if new_status_key != 'end_year':
                return JsonResponse({'success': False, 'message': _('Une année terminée ne peut être modifiée que pour revenir à l’étape "Fin d’année".')}, status=403)

        # On vérifie que tous les trimestres/semestres soit bien terminés pour passer à la fin de l'année. 
        if new_field_name == 'end_year':
            school_levels = Level.objects.filter(school=year.school)
            for level in school_levels:
                # Si un seul trimestre n'est pas terminé, retourne un message d'erreur.
                terms = TermYearLevel.objects.filter(year=year, level=level)
                if terms :
                    for term in terms:
                        if term.finished == False:
                            return JsonResponse({'success': False, 'message': _("Impossible de passer à l'étape de fin d'année car vous avez encore un trimestre ou un semestre qui n'es pas terminé.")}, status=403)

        # 6. Réinitialiser tous les champs de statut booléens à False pour garantir l'unicité
        # N'inclut pas is_current_year
        for field_name in STATUS_FIELDS.values():
            setattr(year, field_name, False)
            
        # 7. Définir le nouveau champ de statut à True
        setattr(year, new_field_name, True)

        message = _("L'année '{year}' est passée à l'étape '{statut}'. (Veuillez recharger la page)").format(year=year.name, statut=new_status_key.capitalize())

        if new_field_name == "running":
            # On récupère l'id de l'école :
            school_id = year.school.id

            # On vérifie dabord si les premier trimestres ou semestres existes déjà pour cette année, pour tous les niveaux, s'ils existes déjà, on ne fait rien, sinon on les créer
            terme_created, message_response = check_first_terms_for_school_year(school_id, year_id)

            if not terme_created:
                # On créer tous les premiers trimestres et les premiers semestres :
                levels = get_levels_by_school(school_id)
                for level in levels:
                    create_term_year_level(1, year_id, level.id)

                message = _("L'année '{year}' est passée à l'étape '{statut}', les premier trimestres ou semestres ont été créer. (Veuillez recharger la page)").format(year=year.name, statut=new_status_key.capitalize())
        
        # 8. Sauvegarder les modifications
        year.save()

        # 9. On récupère l'école
        school = year.school

        # 10. Envoie des emails 
        if new_field_name == 'registration':
            send_emails_for_year_stage(school, new_field_name) # Envoie un mail à tous les administrateurs actif de cette école afin de les prévenir que l'étape de l'enregistrement à commencé
        elif new_field_name == 'running': 
            send_emails_for_year_stage(school, new_field_name)  # Envoie un mail à tous les professeurs et les CPE actif de cette école afin de les prévenir que l'étape du déroulé à commencé
        
        return JsonResponse({'success': True, 'message': message})

    except Year.DoesNotExist:
        return JsonResponse({'success': False, 'message': _('Année scolaire non trouvée ou accès refusé.')}, status=404)
    except Exception:
        return JsonResponse({'success': False, 'message': _('Une erreur serveur est survenue lors du changement de statut.')}, status=500)


@require_http_methods(["GET", "POST"])
@csrf_exempt
@login_required
def exception_management(request):
    """
    Vue unifiée pour la gestion des jours d'exception (vacances) et des horaires d'exception (pause déjeuner).
    La permission et le contexte de l'école/année sont déterminés par le rôle de l'utilisateur.
    """
    
    # 1. Détermination du contexte utilisateur et permission
    user_type = get_user_type(request.user)
    allowed_roles = ["SuperAdministrator", "Principal"]
    
    if user_type not in allowed_roles:
        return render(request, "404.html", status=404)

    # 2. Détermination du contexte de l'école
    try:
        school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
    except School.DoesNotExist:
        return render(request, "404.html", status=404)
    
    # Vérification de l'état actif de l'école (relecture forcée pour la sécurité)
    # (En se basant sur la correction précédente, nous supposons que school_filter est l'instance fraîche)
    if school_filter:
        if not school_filter.is_active:
            return render(request, "404.html", status=404)
    else:
        return render(request, "404.html", status=404)
        
    # 3. Détermination de l'année scolaire actuelle
    current_year = get_current_year_for_school(school_filter)

    # --- 4. Gestion des requêtes POST (API CRUD) ---
    if request.method == 'POST':
        try:
            if not current_year:
                return JsonResponse({"success": False, "message": _("Aucune année scolaire active n'est définie pour cette école.")}, status=400)

            stape_creation_year = get_authorisation_stape_creation_year(school_filter)

            if not stape_creation_year:
                return JsonResponse({"success": False, "message": _("Opération non autorisée. La gestion des exceptions n'est possible que lorsque l'année scolaire est à l'étape de création")}, status=400)

            data = json.loads(request.body)
            action = data.get('action') 
            exception_type = data.get('exception_type') # 'day' ou 'time'
            exception_id = data.get('exception_id')

            if exception_type not in ['day', 'time']:
                 return JsonResponse({'success': False, 'message': _('Type d’exception invalide.')}, status=400)

            # Helpers de conversion de données pour la création/mise à jour
            def get_date_or_none(date_str):
                return date.fromisoformat(date_str) if date_str else None
            
            def get_time_or_none(time_str):
                return time.fromisoformat(time_str) if time_str else None

            # --- CRUD pour ExceptionDay (Jours d'exception) ---
            if exception_type == 'day':
                # Champs spécifiques aux jours d'exception
                start_date_str = data.get('start_date')
                end_date_str = data.get('end_date')
                type_name = data.get('type', '').strip()

                if action == 'create' or action == 'update':
                    if not start_date_str or not end_date_str or not type_name:
                         return JsonResponse({'success': False, 'message': _('La date de début, la date de fin et le type sont obligatoires.')}, status=400)
                    
                    start_date = get_date_or_none(start_date_str)
                    end_date = get_date_or_none(end_date_str)

                    if action == 'create':
                        ExceptionDay.objects.create(
                            start_date=start_date,
                            end_date=end_date,
                            type=type_name,
                            year=current_year
                        )
                        return JsonResponse({'success': True, 'message': _('Exception de jour "{type_name}" créée avec succès.').format(type_name=type_name)}, status=201)
                    
                    elif action == 'update':
                        if not exception_id:
                            return JsonResponse({'success': False, 'message': _('ID de l’exception manquant pour la mise à jour.')}, status=400)
                        
                        try:
                            exception_obj = ExceptionDay.objects.get(pk=exception_id, year=current_year)
                            exception_obj.start_date = start_date
                            exception_obj.end_date = end_date
                            exception_obj.type = type_name
                            exception_obj.save()
                            return JsonResponse({'success': True, 'message': _('Exception de jour "{type_name}" mise à jour avec succès.').format(type_name=type_name)}, status=200)                        
                        except ExceptionDay.DoesNotExist:
                            return JsonResponse({'success': False, 'message': _('Exception de jour non trouvée.')}, status=404)
                
                elif action == 'delete':
                    if not exception_id:
                        return JsonResponse({'success': False, 'message': _('ID de l’exception manquant pour la suppression.')}, status=400)
                    
                    try:
                        exception_obj = ExceptionDay.objects.get(pk=exception_id, year=current_year)
                        exception_name = str(exception_obj)
                        exception_obj.delete()
                        return JsonResponse({'success': True, 'message': _('Exception de jour "{exception_name}" supprimée.').format(exception_name=exception_name)}, status=200)
                    except ExceptionDay.DoesNotExist:
                        return JsonResponse({'success': False, 'message': _('Exception de jour non trouvée.')}, status=404)

            # --- CRUD pour ExceptionTime (Horaires d'exception) ---
            elif exception_type == 'time':
                # Champs spécifiques aux horaires d'exception
                start_time_str = data.get('start_time')
                end_time_str = data.get('end_time')

                if action == 'create' or action == 'update':
                    if not start_time_str or not end_time_str:
                        return JsonResponse({'success': False, 'message': _('L’heure de début et l’heure de fin sont obligatoires.')}, status=400)
                    
                    start_time = get_time_or_none(start_time_str)
                    end_time = get_time_or_none(end_time_str)
                    
                    if action == 'create':
                        # Vérification simple de non-chevauchement (facultatif mais recommandé)
                        ExceptionTime.objects.create(
                            start_time=start_time,
                            end_time=end_time,
                            year=current_year
                        )
                        return JsonResponse({'success': True, 'message': _('Horaire d’exception créé avec succès.')}, status=201)
                    
                    elif action == 'update':
                        if not exception_id:
                            return JsonResponse({'success': False, 'message': _('ID de l’exception manquant pour la mise à jour.')}, status=400)
                        
                        try:
                            exception_obj = ExceptionTime.objects.get(pk=exception_id, year=current_year)
                            exception_obj.start_time = start_time
                            exception_obj.end_time = end_time
                            exception_obj.save()
                            return JsonResponse({'success': True, 'message': _('Horaire d’exception mis à jour avec succès.')}, status=200)
                        except ExceptionTime.DoesNotExist:
                            return JsonResponse({'success': False, 'message': _('Horaire d’exception non trouvé.')}, status=404)

                elif action == 'delete':
                    if not exception_id:
                        return JsonResponse({'success': False, 'message': _('ID de l’exception manquant pour la suppression.')}, status=400)
                    
                    try:
                        exception_obj = ExceptionTime.objects.get(pk=exception_id, year=current_year)
                        exception_name = str(exception_obj)
                        exception_obj.delete()
                        return JsonResponse({'success': True, 'message': _('Horaire d’exception "{exception_name}" supprimé.').format(exception_name=exception_name)}, status=200)
                    except ExceptionTime.DoesNotExist:
                        return JsonResponse({'success': False, 'message': _('Horaire d’exception non trouvé.')}, status=404)
                
            else:
                 return JsonResponse({'success': False, 'message': _('Action non reconnue.')}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': _('Données JSON invalides.')}, status=400)
        except ValidationError as e:
             # Gérer les erreurs de validation de date/heure (ex: format incorrect)
            return JsonResponse({'success': False, 'message': _('Erreur de format de donnée: {error}').format(error=e.message)}, status=400)
        except Exception as e:
            # Pensez à logger l'erreur 'e' en production
            return JsonResponse({'success': False, 'message': _('Une erreur interne du serveur est survenue: {error}').format(error=str(e))}, status=500)

    # --- 5. Gestion des requêtes GET (Affichage de la page) ---
    
    # Récupérer toutes les exceptions pour l'année en cours
    exception_days = ExceptionDay.objects.filter(year=current_year).order_by('start_date')
    exception_times = ExceptionTime.objects.filter(year=current_year).order_by('start_time')
    
    context = {
        'school': school_filter,
        'current_year': current_year,
        'exception_days': exception_days,
        'exception_times': exception_times,
        'user_type': user_type,
    }
    
    # Le template pour l'interface utilisateur (à créer)
    return render(request, 'schools/exception_management.html', context)

@require_http_methods(["GET", "POST"])
@csrf_exempt 
@login_required
def manage_term(request):
    """
    Vue unifiée pour la gestion de l'avancement et de la finalisation des trimestres/semestres
    pour tous les niveaux d'une école et l'année en cours.
    
    Actions POST possibles:
    - 'advance': Crée le trimestre/semestre suivant si la limite n'est pas atteinte.
    - 'finish': Marque le dernier trimestre/semestre comme terminé si la limite est atteinte.
    """
    
    # 1. Détermination du contexte utilisateur et permission
    user_type = get_user_type(request.user)
    allowed_roles = ["SuperAdministrator", "Principal"] 
    
    if user_type not in allowed_roles:
        return render(request, "404.html", status=404)

    # 2. Détermination du contexte de l'école
    try:
        school_filter = get_user_school(request.user, request.session.get('selected_school_id'))
        if not school_filter:
            return render(request, "404.html", status=404)
    except School.DoesNotExist:
        return render(request, "404.html", status=404)
    
    if not school_filter or not school_filter.is_active:
        return render(request, "404.html", status=404)
        
    # 3. Détermination de l'année scolaire actuelle
    current_year = get_current_year_for_school(school_filter)

    # --- 4. Gestion des requêtes POST (API d'avancement) ---
    if request.method == 'POST':
        try:
            # On vérifie si l'année existe
            if not current_year: 
                return JsonResponse(
                    {"success": False, 
                    "message": _("Opération non autorisée. La gestion des trimestres/semestres n'est possible que lorsque l'année est créer.")}, 
                    status=400
                )
            
            # La gestion des trimestres n'est possible que si l'année est en mode 'running'
            if not current_year.running: 
                return JsonResponse(
                    {"success": False,
                    "message": _("Opération non autorisée. La gestion des trimestres/semestres n'est possible que lorsque l'année scolaire est à l'étape de Déroulement (Running).")}, 
                    status=400
                )
                
            data = json.loads(request.body)
            action = data.get('action') # 'advance' ou 'finish'
            level_id = data.get('level_id')

            if not level_id or not action:
                return JsonResponse({'success': False, 'message': _('L’ID du niveau et l’action sont obligatoires.')}, status=400)

            # Utilisation de transaction.atomic() pour garantir que les opérations sont atomiques
            with transaction.atomic():
                # A. Récupérer le niveau et le terme *actuel* non terminé
                try:
                    level_obj = Level.objects.get(pk=level_id, school=school_filter)
                    
                    # Récupérer l'unique terme actif (finished=False) pour ce niveau et cette année
                    current_term = TermYearLevel.objects.get(
                        year=current_year,
                        level=level_obj,
                        finished=False
                    )
                except Level.DoesNotExist:
                    return JsonResponse({'success': False, 'message': _('Niveau non trouvé pour cette école.')}, status=404)
                except TermYearLevel.DoesNotExist:
                    # Le terme 1 est soit non créé, soit tous les termes sont finis
                    return JsonResponse({'success': False, 'message': _('Aucun trimestre/semestre actif trouvé pour le niveau {level} et l’année en cours.').format(level=level_obj.get_level_display())}, status=404)
                
                # Déterminer la limite en fonction du type de niveau
                # is_trimestre = level_obj.term_type == TERM_TYPE_TRIMESTRE
                # MAX_COUNTER = MAX_COUNTER_TRIMESTRE if is_trimestre else MAX_COUNTER_SEMESTRE
                # term_type_name = "trimestre" if is_trimestre else "semestre"

                if level_obj.term_type == TERM_TYPE_TRIMESTRE:
                    term_type_name = "trimestre"
                    MAX_COUNTER = MAX_COUNTER_TRIMESTRE
                elif level_obj.term_type == TERM_TYPE_SEMESTRE:
                    term_type_name = "semestre"
                    MAX_COUNTER = MAX_COUNTER_SEMESTRE
                else:
                    term_type_name = "unique"
                    MAX_COUNTER = MAX_COUNTER_UNIQUE
                
                # B. Logique d'Avancement ('advance')
                if action == 'advance':
                    next_counter = current_term.counter + 1
                    
                    # 1. Vérification de la progression possible
                    if next_counter > MAX_COUNTER:
                        return JsonResponse(
                            {'success': False, 
                            'message': _('Impossible d’avancer. Le {counter}e {term_type} est le dernier possible ({max_counter}) pour ce niveau.').format(counter=current_term.counter, term_type=term_type_name, max_counter=MAX_COUNTER)},
                            status=400
                        )
                    
                    # 2. Avancement (Marquer l'ancien comme terminé et créer le nouveau)
                    
                    # Marquer l'actuel comme terminé
                    current_term.finished = True
                    current_term.save()
                    
                    # Créer le nouveau terme
                    TermYearLevel.objects.create(
                        counter=next_counter,
                        year=current_year,
                        level=level_obj,
                        start_date=None, 
                        end_date=None, 
                        finished=False
                    )
                    
                    return JsonResponse(
                        {'success': True, 
                        'message': _('Avancement réussi ! Le niveau {level} est maintenant au {next_counter}e {term_type}.').format(level=level_obj.get_level_display(), next_counter=next_counter, term_type=term_type_name)},
                        status=201
                    )

                # C. Logique de Finalisation ('finish')
                elif action == 'finish':
                    
                    # 1. Vérification que c'est bien le dernier terme
                    if current_term.counter < MAX_COUNTER:
                        return JsonResponse(
                            {'success': False, 
                             'message': _('Impossible de terminer le cycle. Le niveau {level} est seulement au {counter}e {term_type}. Il reste encore des termes à créer.').format(level=level_obj.get_level_display(), counter=current_term.counter, term_type=term_type_name)},
                            status=400
                        )
                    
                    # 2. Marquer le dernier terme comme terminé
                    current_term.finished = True
                    current_term.save()
                    
                    return JsonResponse(
                        {'success': True, 
                         'message': _('Cycle terminé ! Le {counter}e et dernier {term_type} du niveau {level} est maintenant marqué comme terminé pour l’année {year}.').format(counter=current_term.counter, term_type=term_type_name, level=level_obj.get_level_display(), year=current_year.name)},
                        status=200
                    )
                
                else:
                    return JsonResponse({'success': False, 'message': _('Action non reconnue.')}, status=400)


        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': _('Données JSON invalides.')}, status=400)
        except IntegrityError as e:
             # Cette erreur est levée si la transaction échoue (ex: doublon inattendu, contrainte violée)
             error_message = _("Erreur de base de données. Opération annulée: {error}").format(error=str(e))
             return JsonResponse({'success': False, 'message': error_message}, status=400)
        except Exception as e:
            # print(f"Erreur lors de la gestion des termes : {e}")
            return JsonResponse({'success': False, 'message': _('Une erreur interne du serveur est survenue: {error}').format(error=str(e))}, status=500)

    # --- 5. Gestion des requêtes GET (Affichage de la page) ---
    
    # Récupérer tous les niveaux pour l'école en cours
    school_levels = Level.objects.filter(school=school_filter).order_by('level') 
    
    # Récupérer le statut actuel pour chaque niveau
    levels_status = []
    
    for level in school_levels:
        # Trouver le terme actif (finished=False) pour l'année actuelle
        current_term = TermYearLevel.objects.filter(
            year=current_year,
            level=level,
            finished=False
        ).order_by('-counter').first()
        
        # Trouver le dernier terme créé (actif ou terminé)
        last_term_created = TermYearLevel.objects.filter(
            year=current_year,
            level=level,
        ).order_by('-counter').first()

        # Déterminer la limite max
        # is_trimestre = level.term_type == TERM_TYPE_TRIMESTRE
        # MAX_COUNTER = MAX_COUNTER_TRIMESTRE if is_trimestre else MAX_COUNTER_SEMESTRE

        if level.term_type == TERM_TYPE_TRIMESTRE:
            MAX_COUNTER = MAX_COUNTER_TRIMESTRE
        elif level.term_type == TERM_TYPE_SEMESTRE:
            MAX_COUNTER = MAX_COUNTER_SEMESTRE
        else:
            MAX_COUNTER = MAX_COUNTER_UNIQUE
        
        # Calculer le statut
        status = {
            'level_id': level.id,
            'level_code': level.level,
            'level_name': level.get_level_display(),
            'term_type': level.term_type,
            'max_counter': MAX_COUNTER,
            'current_counter': current_term.counter if current_term else 0,
            'is_active': bool(current_term),
            # Cycle Terminé si le dernier terme créé est finished=True ET qu'il est au counter max
            'is_finished': bool(last_term_created and last_term_created.finished and last_term_created.counter == MAX_COUNTER),
            'can_advance': bool(current_term and current_term.counter < MAX_COUNTER), # Avancer si actif et pas au max
            'can_finish': bool(current_term and current_term.counter == MAX_COUNTER), # Finir si actif et au max
            'has_term_1': bool(TermYearLevel.objects.filter(year=current_year, level=level, counter=1).exists()), # Terme 1 créé
        }
        levels_status.append(status)

    context = {
        'school': school_filter,
        'current_year': current_year,
        'levels_status': levels_status,
        'user_type': user_type,
    }
    
    return render(request, 'schools/manage_term.html', context)

@login_required(login_url='login')
def edit_school_view(request):
    """
    Affiche le formulaire de modification pour une école spécifique.
    Accessible uniquement au Super Administrateur.
    """
    user_type = get_user_type(request.user)

    if not user_type == "SuperAdministrator":
        return render(request, "404.html", status=404)

    try:
        # On récupère l'école ou on renvoie une 404
        school = get_user_school(request.user, request.session.get('selected_school_id'))

        school_types_fr = [
            ("HIGHSCHOOL", _("Lycée")),
            ("COLLEGE", _("Collège")),
            ("UNIVERSITY", _("Université")), 
            ("SCHOOL", _("Ecole"))
        ]
        
        context = {
            'school': school,
            'school_types': school_types_fr, # Pour le select du type
        }
        return render(request, 'schools/edit_school.html', context)
        
    except Exception:
        return render(request, "404.html", status=404)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_update_school(request, school_id):
    """
    API pour mettre à jour les informations d'une école.
    """
    user_type = get_user_type(request.user)

    if not user_type == "SuperAdministrator":
        return render(request, "404.html", status=404)

    try:
        school = get_object_or_404(School, pk=school_id)
        data = json.loads(request.body)
        
        # Récupération des données
        name = data.get('name')
        address = data.get('address')
        school_type = data.get('type')
        phone_number = data.get('phone_number')
        email = data.get('email')
        is_active = data.get('is_active') # Booléen

        # Validation basique
        if not name or not address or not school_type or not email:
             return JsonResponse({'success': False, 'message': _('Veuillez remplir tous les champs obligatoires.')}, status=400)

        # Vérification unicité email (en excluant l'école actuelle)
        if School.objects.filter(email=email).exclude(pk=school_id).exists():
            return JsonResponse({'success': False, 'message': _('Une autre école utilise déjà cet email.')}, status=400)

        # Mise à jour des champs autorisés
        school.name = name
        school.address = address
        school.type = school_type
        school.phone_number = phone_number
        school.email = email
        
        # Gestion explicite du booléen is_active
        if is_active is not None:
            school.is_active = bool(is_active)

        # On ne touche PAS à created_at ni super_administrator
        school.save()

        return JsonResponse({
            'success': True, 
            'message': _("L'école {school} a été mise à jour avec succès.").format(school=school.name)
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': _('Données JSON invalides.')}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@login_required
def update_school_settings(request):
    """
    Permet au proviseur de modifier le logo, la signature, la couleur et la langue.
    """
    user = request.user
    type = get_user_type(user) 

    if type not in ("SuperAdministrator", "Principal"):
        messages.error(request, _("Vous n'avez pas accès à cette fonctionnalité."))
        return redirect('dashboard')
    
    try:
        school = get_user_school(request.user, request.session.get('selected_school_id'))
    except AttributeError:
        if request.user.is_superuser:
            school = School.objects.first()
        else:
            messages.error(request, _("Aucune école associée à votre compte."))
            return redirect('dashboard')

    if not school:
        messages.error(request, _("École introuvable."))
        return redirect('dashboard')
    elif not school.is_active:
        messages.error(request, _("École non active."))
        return redirect('dashboard')
        
    # Vérification si on peut changer la langue ---
    current_year = get_current_year_for_school(school)
    can_change_language = True
    if current_year and not current_year.creation:
        can_change_language = False

    if request.method == 'POST':
        form = SchoolUpdateForm(request.POST, request.FILES, instance=school)
        if form.is_valid():
            form.save()
            messages.success(request, _("Les paramètres de l'école ont été mis à jour."))
            return redirect('settings')
        else:
            messages.error(request, _("Veuillez corriger les erreurs ci-dessous."))
    else:
        form = SchoolUpdateForm(instance=school)
        # Bloquer le champ langue si on n'a pas le droit
        if not can_change_language and 'language' in form.fields:
            form.fields['language'].disabled = True

    context = {
        'form': form,
        'school': school,
        'can_change_language': can_change_language, # On envoie l'info au HTML
    }
    return render(request, 'schools/settings.html', context)