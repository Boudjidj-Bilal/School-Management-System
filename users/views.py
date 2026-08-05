from django.shortcuts import render, redirect, get_object_or_404

from django.http import JsonResponse

import datetime, json

from django.utils.translation import gettext_lazy as _

from .utils import *
from schools.models import School
from scheduling.utils import get_dashboard_schedule
from grades.utils import get_dashboard_grades_summary, get_dashboard_school_grades_stats
from schools.utils import get_user_school, get_current_school_year, get_current_year_for_school
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.views.decorators.http import require_http_methods, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth.tokens import PasswordResetTokenGenerator

# Imports des Services (Utils des autres apps)
from attendance.utils import get_dashboard_attendance_summary, get_school_attendance_kpis
from attendance.models import Attendance # Pour les alertes CPE
from communications.utils import get_dashboard_messaging_stats, get_dashboard_last_announcement


from .models import User, GENDER_CHOICES

def login(request):
    """
    Rend la page HTML de connexion et gère l'authentification.
    """

    if request.user.is_authenticated:
        return redirect('dashboard')
        
    if request.method == 'GET':
        return render(request, 'users/login_page.html')
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')

            user = get_user_by_username(username)

            if not user:
                return JsonResponse({'success': False, 'message': _("Nom d'utilisateur ou mot de passe incorrect.")})

            user_type = get_user_type(user)

            if not user_type:
                return JsonResponse({'success': False, 'message': _('Impossible de vous connecter.')})


            # 1. Déterminer l'école 
            if not user_type == "SuperAdministrator":
                school = get_user_school(user)                
                # Erreur : S'il n'y a pas d'école
                if not school:
                    return JsonResponse({"success": False, "message": _("Impossible de vous connecter.")}, status=400)
                
                # Erreur : Si l'école est inactive
                if school.is_active == False:
                    return JsonResponse({"success": False, "message": _("Impossible de vous connecter.")}, status=400)

                # On vérifie si ces utilisateurs on le droit de se connecter :
                if user_type in ["Teacher", "CPE", "Administrator", "Student", "Parent"]:

                    # On importe ici pour éviter les imports circulaires :
                    from schools.utils import get_current_school_year 

                    # On récupère l'année en fonction de l'école
                    year = get_current_school_year(school.id)

                    # S'il n'y a pas d'année, impossible de se connecter pour le moment
                    if not year:
                        return JsonResponse({"success": False, "message": _("Impossible de vous connecter pour le moment.")}, status=400)

                    # Si on est à l'étape de creation ou fini d'une année, impossible de se connecter
                    if year.creation or year.finished:
                        return JsonResponse({"success": False, "message": _("Impossible de vous connecter pour le moment.")}, status=400)
                    
                    # On vérifie si ces utilisateurs on le droit de se connecter :
                    elif user_type in ["Teacher", "CPE", "Student", "Parent"]:

                        # Si on est à l'étape d'enregistrement d'une année, impossible de se connecter
                        if year.registration:
                            return JsonResponse({"success": False, "message": _("Impossible de vous connecter pour le moment.")}, status=400)

            user_login = login_user(request, username, password)

            if user_login:
                # Si c'est un étudiant, on récupère les coordonnées envoyées par le JSON
                if user_type == "Student":
                    latitude = data.get('latitude')
                    longitude = data.get('longitude')
                    
                    print(f"DEBUG - Coordonnées reçues pour l'étudiant {username} : Lat={latitude}, Lon={longitude}")
                    
                    if latitude is not None and longitude is not None:
                        # On appelle directement notre fonction de service
                        update_student_location(user_login.student_user, latitude, longitude)
                    else:
                        print("DEBUG - Coordonnées absentes ou refusées par l'utilisateur.")
                
                return JsonResponse({'success': True, 'message': _('Connexion réussie.')})
            else:
                return JsonResponse({'success': False, 'message': _("Nom d'utilisateur ou mot de passe incorrect.")})
                
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': _('Données JSON invalides.')}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)

def logout(request):
    """
    Déconnecte l'utilisateur et le redirige vers la page de connexion.
    """
    logout_user(request)
    return redirect('login')


@login_required(login_url='login')
def dashboard_page(request):
    """
    Tableau de bord principal agrégateur.
    Charge les widgets spécifiques selon le rôle de l'utilisateur.
    """
    user = request.user
    user_type = get_user_type(user)
    
    # Contexte de base
    context = {
        'username': user.username,
        'user_type': user_type,
        'widgets': {} # Contiendra toutes les données des cartes
    }

    # --- 1. Détermination de l'École et de l'Année ---
    school = None
    current_year = None

    # Logique SuperAdmin (Sélecteur d'école)
    if user_type == "SuperAdministrator":
        schools = School.objects.filter()
        context['schools'] = schools
        
        selected_school_id = request.session.get('selected_school_id')
        if not selected_school_id and schools.exists():
            selected_school_id = schools.last().id
            request.session['selected_school_id'] = selected_school_id
        
        if selected_school_id:
            try:
                school = School.objects.get(id=selected_school_id)
                context['selected_school'] = school
            except School.DoesNotExist: pass

    # Logique Parent (Pas d'école directe, dépend de l'enfant)
    elif user_type == "Parent":
        pass 
    
    # Logique Staff/Student (École liée au profil)
    else:
        school = get_user_school(user)
        context['user_school'] = school

    # Récupération de l'année pour l'école identifiée
    if school:
        current_year = get_current_year_for_school(school)
        context['current_year'] = current_year


    # --- 2. Chargement des Widgets par Rôle ---

    # A. ÉTUDIANT (ou PARENT visualisant un enfant)
    if user_type == 'Student' or user_type == 'Parent':
        target_student = None

        if user_type == 'Student':
            target_student = user.student_user
        
        elif user_type == 'Parent':
            # Gestion du sélecteur d'enfant
            try:
                parent = user.parent_user
                children_links = Child.objects.filter(parent=parent).select_related('student', 'student__user')
                children = [link.student for link in children_links]
                context['children'] = children
                
                # Utilisation de l'utilitaire intelligent pour récupérer l'enfant actif
                # (ou le premier par défaut)
                target_student = get_student_context(request)
                
                # Mise à jour de l'ID sélectionné pour le template (selecteur)
                if target_student:
                    context['selected_child_id'] = target_student.id
                    # Pour le Parent, l'année dépend de l'école de l'enfant
                    current_year = get_current_year_for_school(target_student.school)
                    context['current_year'] = current_year
            
            except Exception as e:
                print(f"Erreur Dashboard Parent: {e}")

        # Si on a un élève valide (Soit le user Student, soit l'enfant du Parent)
        if target_student and current_year:
            # 1. Planning
            context['widgets']['schedule'] = get_dashboard_schedule(request.user, current_year, student_profile=target_student)
            # 2. Notes
            context['widgets']['grades'] = get_dashboard_grades_summary(target_student, current_year)
            # 3. Absences (Alerte)
            context['widgets']['attendance'] = get_dashboard_attendance_summary(target_student, current_year)
            # 4. Annonces (Destinataire = User lié à l'élève)
            context['widgets']['announcement'] = get_dashboard_last_announcement(target_student.user)
            
            # 5. Messagerie : 
            # - Si Student : ses messages
            # - Si Parent : SES PROPRES messages (pas ceux de l'enfant)
            msg_user = user if user_type == 'Parent' else target_student.user
            context['widgets']['messaging'] = get_dashboard_messaging_stats(msg_user)

            # 6. Géolocalisation (Récupération de la dernière position via le modèle StudentLocation)
            last_location = target_student.locations.order_by('-updated_at').first()
            context['widgets']['geolocation'] = {
                'address': last_location.address_text if last_location else None,
                'updated_at': last_location.updated_at if last_location else None
            }


    # B. PROFESSEUR
    elif user_type == 'Teacher':
        if current_year:
            # 1. Planning (Utilise la même fonction utilitaire, adaptée pour le prof)
            context['widgets']['schedule'] = get_dashboard_schedule(user, current_year)

            # 2. Annonces
            context['widgets']['announcement'] = get_dashboard_last_announcement(user)
            
            # 3. Messagerie
            context['widgets']['messaging'] = get_dashboard_messaging_stats(user)


    # C. CPE
    elif user_type == 'CPE':
        if current_year and school:
            # 1. Alertes Assiduité (Derniers incidents non justifiés de l'école)
            alerts = Attendance.objects.filter(
                session__term_year__year=current_year,
                session__student_class__level__school=school,
                justified=False
            ).select_related('student__user', 'session__student_class').order_by('-session__date', '-session__start_time')[:10]
            
            context['widgets']['attendance_alerts'] = alerts
            
            # 2. Annonces
            context['widgets']['announcement'] = get_dashboard_last_announcement(user)


    # D. PROVISEUR & SUPER ADMIN
    elif user_type in ['Principal', 'SuperAdministrator']:
        if current_year and school:
            # 1. Stats Assiduité (KPIs globaux)
            context['widgets']['attendance_kpis'] = get_school_attendance_kpis(school, current_year)
            
            # 2. Annonces
            context['widgets']['announcement'] = get_dashboard_last_announcement(user)
            
            # 3. Stats
            context['widgets']['grades_stats'] = get_dashboard_school_grades_stats(school, current_year)


    # E. ADMINISTRATEUR (Simple)
    elif user_type == 'Administrator':
        context['widgets']['announcement'] = get_dashboard_last_announcement(user)


    return render(request, 'users/dashboard_page.html', context)


def password_reset(request):
    """
    Gère la demande de réinitialisation de mot de passe.
    """
    if request.method == 'GET':
        return render(request, 'users/password_reset.html')
    
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            
            try:
                user = get_user_by_username(username)
                domain = request.get_host()
                protocol = 'https' if request.is_secure() else 'http'
                
                if send_password_reset_link(user, domain, protocol):
                    return JsonResponse({'success': True, 'message': _('Un lien de réinitialisation a été envoyé à votre adresse e-mail.')})
                else:
                    return JsonResponse({'success': False, 'message': _("Erreur lors de l’envoi de l'e-mail.")})
            except User.DoesNotExist:
                return JsonResponse({'success': False, 'message': _("Nom d'utilisateur invalide.")})
                
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': _('Données JSON invalides.')}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


def password_reset_confirm_old(request, uidb64, token):
    """
    Gère la page de confirmation de réinitialisation de mot de passe et le changement du mot de passe.
    """
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and PasswordResetTokenGenerator().check_token(user, token):
        if request.method == 'GET':
            return render(request, 'users/password_reset_confirm.html', {'uidb64': uidb64, 'token': token})
        
        if request.method == 'POST':
            try:
                data = json.loads(request.body)
                new_password = data.get('new_password')
                
                user, message = change_user_password(user.id, new_password)

                if user:
                    return JsonResponse({'success': True, 'message': message})
                else: 
                    return JsonResponse({'success': False, 'message': message})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)}, status=500)
    else:
        return render(request, 'error_page.html', {
            'message': _('Le lien de réinitialisation est invalide ou a expiré.')
        })


def password_reset_confirm(request, uidb64, token):
    """
    Gère la page de confirmation de réinitialisation de mot de passe et le changement du mot de passe.
    """
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and PasswordResetTokenGenerator().check_token(user, token):
        if request.method == 'GET':
            return render(request, 'users/password_reset_confirm.html', {'uidb64': uidb64, 'token': token})
        
        if request.method == 'POST':
            try:
                data = json.loads(request.body)
                new_password = data.get('new_password')
                
                # Vérification de la robustesse
                is_valid, pwd_message = is_strong_password(new_password)
                if not is_valid:
                    # Si le mot de passe n'est pas robuste, on retourne l'erreur directement
                    return JsonResponse({'success': False, 'message': pwd_message})
                
                user, message = change_user_password(user.id, new_password)

                if user:
                    return JsonResponse({'success': True, 'message': message})
                else: 
                    return JsonResponse({'success': False, 'message': message})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)}, status=500)
    else:
        return render(request, 'error_page.html', {
            'message': _('Le lien de réinitialisation est invalide ou a expiré.')
        })


@login_required
def manage_users_view(request):
    user_type_choice = request.GET.get('type')
    staff_type = request.GET.get('staff_type', None)

    users = []
    
    user_type = get_user_type(request.user)

    if not user_type:
        return render(request, "404.html", status=404)

    user_school = get_user_school(request.user, request.session.get('selected_school_id'))

    if not user_school:
        return render(request, "404.html", status=404)
    
    # Vérifie si l'utilisateur a la permission de voir cette page
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return render(request, "404.html", status=404)

    if user_type == "SuperAdministrator":
        # Le super admin peut gérer les utilisateurs de n'importe quelle école
        school_id_filter = request.session.get('selected_school_id')
        school_filter = School.objects.get(id=school_id_filter)
        
        if user_type_choice == 'student':
            users = Student.objects.filter(school=school_filter).order_by('user__first_name', 'user__last_name')
        elif user_type_choice == 'parent':
            users = Parent.objects.filter(school=school_filter).order_by('user__first_name', 'user__last_name')
        elif user_type_choice == 'staff':
            if staff_type:
                users = Staff.objects.filter(staff_type=staff_type, school=school_filter).order_by('user__first_name', 'user__last_name')
            else:
                users = Staff.objects.filter(school=school_filter).order_by('user__first_name', 'user__last_name')

    elif user_type == "Principal":
        # Le proviseur peut voir tous les utilisateurs de son école sauf les autres proviseurs
        school_filter = user_school
        
        if user_type_choice == 'student':
            users = Student.objects.filter(school=school_filter).order_by('user__first_name', 'user__last_name')
        elif user_type_choice == 'parent':
            users = Parent.objects.filter(school=school_filter).order_by('user__first_name', 'user__last_name')
        elif user_type_choice == 'staff':
            if staff_type == 'PRINCIPAL':
                # Un proviseur ne peut pas voir les autres proviseurs
                users = Staff.objects.none()
            elif staff_type:
                users = Staff.objects.filter(staff_type=staff_type, school=school_filter).order_by('user__first_name', 'user__last_name')
            else:
                # Tous les membres du personnel sauf les proviseurs
                users = Staff.objects.filter(school=school_filter).exclude(staff_type='PRINCIPAL').order_by('user__first_name', 'user__last_name')

    elif user_type == "Administrator":
        # L'administrateur ne voit que les étudiants et les parents de son école
        school_filter = user_school
        if user_type_choice == 'student':
            users = Student.objects.filter(school=school_filter).order_by('user__first_name', 'user__last_name')
        elif user_type_choice == 'parent':
            users = Parent.objects.filter(school=school_filter).order_by('user__first_name', 'user__last_name')
        else:
            # Si le type d'utilisateur demandé n'est pas 'student' ou 'parent'
            # (par exemple, 'staff'), on retourne une liste vide
            users = []
    
    staff_types_fr = {
        "PRINCIPAL": _("Proviseur"),
        "TEACHER": _("Professeur"),
        "CPE": _("CPE"),
        "ADMINISTRATOR": _("Administrateur")
    }
    
    context = {
        "users": users,
        "user_type": user_type_choice,
        "staff_types": staff_types_fr,
        "gender_choices": dict(GENDER_CHOICES),
        "user_school": user_school
    }

    return render(request, "users/manage_users.html", context)


@require_http_methods(["POST"])
@csrf_exempt
@login_required
def create_user_view(request):
    """
    Vue unifiée pour créer et modifier des utilisateurs.
    """
    user_type = get_user_type(request.user)
    
    # Vérifie si l'utilisateur a la permission de voir cette page
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return render(request, "404.html", status=404)
    
    try:
        data = json.loads(request.body)
        user_type = data.get('user_type')
        user_id = data.get('user_id')
        
        # Récupération des données communes
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        phone_number = data.get('phone_number')
        email = data.get('email', None)
        gender = data.get('gender')
        address = data.get('address')
        birth_date_str = data.get('birth_date')
        password = data.get('password')

        staff_type = data.get('staff_type')
        
        # Récupération du Numéro National
        national_number = data.get('national_number')

        if get_user_type(request.user) == "SuperAdministrator":
            school_id = request.session.get('selected_school_id')
        else:
            school_id = data.get('school_id')

         # Convertir la date de naissance en objet date si elle existe
        birth_date = None
        if birth_date_str:
            birth_date = datetime.datetime.strptime(birth_date_str, '%Y-%m-%d').date()

        if user_id:
            # Mode modification
            user_to_update = get_user_by_id(user_id)
            if not user_to_update:
                return JsonResponse({"success": False, "message": _("L'utilisateur est introuvable.")}, status=404)
            
            if first_name:
                user_to_update.first_name = first_name
            if last_name:
                user_to_update.last_name = last_name
            if email:
                user_to_update.email = email
            if phone_number:
                user_to_update.phone_number = phone_number
            if password:
                user_to_update.set_password(password)

            user_to_update.save()

            year = get_current_school_year(school_id)

            modif_status = False

            if user_type == 'student':
                specific_user = Student.objects.get(user=user_to_update)
                # Sauvegarde du numéro national pour l'étudiant
                if national_number is not None:
                    specific_user.national_number = national_number

            elif user_type == 'parent':
                specific_user = Parent.objects.get(user=user_to_update)

            elif user_type == 'staff':
                specific_user = Staff.objects.get(user=user_to_update)
                if staff_type != specific_user.staff_type :
                    modif_status = True
                    specific_user.staff_type = staff_type

            if gender:
                specific_user.gender = gender
            if address:
                specific_user.address = address
            if birth_date:
                specific_user.birth_date = birth_date

            if modif_status == True:
                if year.running == False:
                    specific_user.save()
                else:
                    return JsonResponse({"success": False, "message": _("Impossible de modifier le statut d'un utilisateur lorsque l'année est en cours de déroulement.")}, status=404)
            else:
                specific_user.save()

            return JsonResponse({"success": True, "message": _("L'utilisateur a bien été modifié.")})

        else:
            # Mode création

            # vérification des champs obligatoire
            if not email or not first_name or not last_name or not gender or not address:
                return JsonResponse({"success": False, "message": _("Veuillez compléter le formulaire.")}, status=404)

            # Vérifier si l'email existe déjà dans la bdd :
            unique_email = is_email_unique(email)
            if unique_email:
                return JsonResponse({"success": False, "message": _("L'adresse email existe déjà.")}, status=404)
            
            # On formate le nom est le prénom pour le nom d'utilisateur. 
            formater_first_name = formater_name(first_name)
            formater_last_name = formater_name(last_name)

            username = generate_unique_username(formater_first_name, formater_last_name) # Génération du nom d'utilisateur

            # Génération du mot de passe
            length_password = 10 
            password = generate_random_password(length_password, include_digits = True, include_special_chars = False) # On génère un mot de passe automatique

            try:
                school = School.objects.get(id=school_id)
            except School.DoesNotExist:
                return JsonResponse({"success": False, "message": _("L'école est introuvale.")}, status=404)

            new_user, error = create_user(
                username=username,
                password=password,
                email=email,
                phone_number=phone_number,
                first_name=formater_first_name,
                last_name=formater_last_name
            )

            if not error: # Si il y a une erreur
                return JsonResponse({"success": False, "message": new_user}, status=404)

            user_add = get_user_by_username(username)

            if user_type == 'staff':
                staff, message_error = create_staff(
                    user=user_add, 
                    staff_type=staff_type, 
                    school=school, 
                    gender=gender, 
                    address=address, 
                    birth_date=birth_date
                )
                
            elif user_type == 'student':
                student, message_error = create_student(
                    user=user_add,
                    school=school,
                    gender=gender,
                    address=address,
                    national_number=national_number,
                    birth_date=birth_date
                )
            elif user_type == 'parent':
                parent, message_error = create_parent(
                    user=user_add,
                    school=school,
                    gender=gender,
                    address=address,
                    birth_date=birth_date,
                )

            send_email_create_compte(request, email, username, password) # Envoie de l'email à l'utilisateur
            
            if message_error: 
                return JsonResponse({"success": False, "message": message_error})

            return JsonResponse({"success": True, "message": _("L'utilisateur a bien été crée.")})

    except IntegrityError as e:
        return JsonResponse({"success": False, "message": _("Integrity error: {error}").format(error=str(e))}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "message": _("An error occurred: {error}").format(error=str(e))}, status=500)


@login_required
@require_http_methods(["POST"])
@csrf_exempt
def select_school_view(request):
    try:
        data = json.loads(request.body)
        school_id = data.get('school_id')
        if not school_id:
            return JsonResponse({"success": False, "message": _("School ID is required.")}, status=400)

        # Vérifier que l'école existe et que l'utilisateur est un super administrateur
        if get_user_type(request.user) == "SuperAdministrator":
            try:
                school = School.objects.get(id=school_id)
                request.session['selected_school_id'] = school.id
                return JsonResponse({"success": True, "message": _("School selected successfully.")})
            except School.DoesNotExist:
                return JsonResponse({"success": False, "message": _("School not found.")}, status=404)
        else:
            return JsonResponse({"success": False, "message": _("Permission denied.")}, status=403)

    except Exception as e:
        return JsonResponse({"success": False, "message": _("An error occurred: {error}").format(error=str(e))}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required
def toggle_user_status_view(request):
    """
    Vue pour activer ou désactiver un utilisateur.
    """
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        action = data.get('action') # 'activate' ou 'deactivate'

        # Récupérer l'utilisateur à modifier
        user_to_toggle = get_object_or_404(User, id=user_id)
        
        # Récupérer les types d'utilisateur pour les vérifications de permissions
        current_user_type = get_user_type(request.user)
        user_type_to_toggle = get_user_type(user_to_toggle)

        # Vérification des permissions
        # Un SuperAdministrateur peut modifier n'importe quel utilisateur
        if current_user_type == "SuperAdministrator":
            pass # Aucune restriction pour le SuperAdmin
        elif current_user_type == "Principal": # Un Principal ne peut pas modifier un autre Principal
            if user_type_to_toggle == "Principal":
                return JsonResponse({"success": False, "message": _("Vous ne pouvez pas modifier le statut d'un autre proviseur.")}, status=403)
        elif current_user_type == "Administrator": # Un Administrateur ne peut modifier que les étudiants et les parents
            forbidden_types = ["Principal", "Teacher", "CPE", "Administrator"]
            if user_type_to_toggle in forbidden_types:
                return JsonResponse({"success": False, "message": _("Vous ne pouvez pas modifier le statut d'un membre du personnel.")}, status=403)
        # Tous les autres types d'utilisateurs n'ont pas la permission
        else:
            return JsonResponse({"success": False, "message": _("Permission denied.")}, status=403)

        # Logique d'activation/désactivation
        if action == 'activate':
            user_to_toggle.is_active = True
            message = _("Utilisateur activé avec succès.")
        elif action == 'deactivate':
            user_to_toggle.is_active = False
            message = _("Utilisateur désactivé avec succès.")
        else:
            return JsonResponse({"success": False, "message": _("Action invalide.")}, status=400)

        user_to_toggle.save()
        return JsonResponse({"success": True, "message": message})

    except Exception as e:
        return JsonResponse({"success": False, "message": _("Une erreur est survenue: {error}").format(error=str(e))}, status=500)


@login_required(login_url='login')
def assign_children_view(request):
    """
    Vue principale pour afficher la page d'attribution.
    Récupère toutes les données nécessaires (avec les champs du User associé) 
    et les passe au template en JSON.
    """

    user_type = get_user_type(request.user)

    if not user_type:
        return render(request, "404.html", status=404)

    
    # Vérifie si l'utilisateur a la permission de voir cette page : 
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return render(request, "404.html", status=404)

    user_school = get_user_school(request.user, request.session.get('selected_school_id'))

    if not user_school:
        return render(request, "404.html", status=404)

    # 1. Récupérer tous les parents et étudiants en préchargeant l'objet User pour les noms.
    # Ceci optimise les requêtes SQL (select_related).
    # Condition : Récupérer uniquement les parents et étudiants d'une même école, qui sont actif 
    if user_type == "SuperAdministrator":
        school_id_filter = request.session.get('selected_school_id')
        school_filter = School.objects.get(id=school_id_filter)

        parents_queryset = Parent.objects.select_related('user').filter(user__is_active=True, school=school_filter).order_by('user__first_name', 'user__last_name')
        students_queryset = Student.objects.select_related('user').filter(user__is_active=True, school=school_filter).order_by('user__first_name', 'user__last_name')
    else:
        school_filter = user_school

        parents_queryset = Parent.objects.select_related('user').filter(user__is_active=True, school=school_filter).order_by('user__first_name', 'user__last_name')
        students_queryset = Student.objects.select_related('user').filter(user__is_active=True, school=school_filter).order_by('user__first_name', 'user__last_name')

    # 2. Construire la liste des étudiants pour l'objet JSON (pour le JS)
    students_to_serialize = []
    for student in students_queryset:
        students_to_serialize.append({
            # On utilise str(id) pour garantir que le JS manipule des chaînes (cohérence)
            'id': str(student.id), 
            # Les noms sont récupérés via la relation 'user'
            'username': student.user.username,
        })

    # 3. Construire la structure des liens (links_data)
    # Format désiré: { parent_id: [student_id1, student_id2, ...], ... }
    
    # Récupérer tous les liens existants
    all_links = Child.objects.all()
    links_data = {}

    for link in all_links:
        parent_id_str = str(link.parent_id)
        student_id_str = str(link.student_id)

        if parent_id_str not in links_data:
            links_data[parent_id_str] = []
        
        links_data[parent_id_str].append(student_id_str)

    # 4. Sérialisation des données en chaînes JSON
    students_json = json.dumps(students_to_serialize)
    links_json = json.dumps(links_data)

    context = {
        # 'parents': QuerySet directement passé au template pour le loop Django
        'parents': parents_queryset, 
        # 'students': Données sérialisées pour la logique JavaScript
        'students': students_json, 
        'links_data': links_json,
    }

    return render(request, 'users/assign_children.html', context)


@require_POST
def toggle_child_assignment_api(request):
    """
    Endpoint API pour lier ou délier un enfant à un parent.
    Nécessite: parent_id, student_id, action ('link' ou 'unlink').
    """
    user_type = get_user_type(request.user)
    
    # Vérifie si l'utilisateur a la permission de voir cette page
    if user_type not in ["SuperAdministrator", "Principal", "Administrator"]:
        return render(request, "404.html", status=404)
    
    try:
        data = json.loads(request.body)
        parent_id = data.get('parent_id')
        student_id = data.get('student_id')
        action = data.get('action')

        if not all([parent_id, student_id, action]):
            return JsonResponse({'success': False, 'message': _('Données manquantes (parent_id, student_id, action).')}, status=400)

        # Récupérer les objets Parent et Student AVEC leurs utilisateurs pour les messages
        # Si un Parent/Student n'existe pas, une exception DoesNotExist sera levée
        parent = Parent.objects.select_related('user').get(pk=parent_id)
        student = Student.objects.select_related('user').get(pk=student_id)
        
        # Accès aux noms via l'objet user (fallback sur le username si le prénom est null)
        parent_name = parent.user.first_name or parent.user.username 
        student_name = student.user.first_name or student.user.username


        if action == 'link':
            try:
                # Utiliser transaction.atomic pour s'assurer que l'opération est atomique
                with transaction.atomic():
                    Child.objects.create(parent=parent, student=student)
                message = _("Lien créé : {student_name} est maintenant un enfant de {parent_name}.").format(student_name=student_name, parent_name=parent_name)
                return JsonResponse({'success': True, 'message': message})
            except IntegrityError:
                # Gère le cas où le lien existe déjà (unique_together)
                message = _("Le lien existe déjà.")
                return JsonResponse({'success': True, 'message': message}) 

        elif action == 'unlink':
            try:
                # Supprime le lien existant
                deleted_count, _ = Child.objects.filter(parent=parent, student=student).delete()
                
                if deleted_count > 0:
                    message = _("Lien supprimé : {student_name} n'est plus un enfant de {parent_name}.").format(student_name=student_name, parent_name=parent_name)
                    return JsonResponse({'success': True, 'message': message})
                else:
                    message = _("Le lien n'existe pas, aucune suppression effectuée.")
                    return JsonResponse({'success': True, 'message': message})
            except Exception as e:
                return JsonResponse({'success': False, 'message': _("Erreur lors de la suppression: {error}").format(error=str(e))}, status=500)
        
        else:
            return JsonResponse({'success': False, 'message': _('Action non reconnue. Utilisez "link" ou "unlink".')}, status=400)

    except Parent.DoesNotExist:
        return JsonResponse({'success': False, 'message': _('Parent non trouvé.')}, status=404)
    except Student.DoesNotExist:
        return JsonResponse({'success': False, 'message': _('Étudiant non trouvé.')}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': _('Requête invalide (JSON non valide).')}, status=400)
    except Exception as e:
        # Gère toutes les autres erreurs imprévues
        return JsonResponse({'success': False, 'message': _('Erreur interne du serveur: {error}').format(error=str(e))}, status=500)



@login_required
def select_child_view(request):
    """
    API pour permettre au parent de changer d'enfant actif (Session).
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            child_id = data.get('child_id')
            
            if get_user_type(request.user) != 'Parent':
                return render(request, "404.html", status=404)
                
            parent = request.user.parent_user
            
            if Child.objects.filter(parent=parent, student__id=child_id).exists():
                request.session['selected_child_id'] = int(child_id)
                return JsonResponse({'success': True})
            else:
                return JsonResponse({'success': False, 'message': _("Cet enfant n'est pas lié à votre compte.")}, status=403)
                
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)
    
    return render(request, "404.html", status=404)



@login_required(login_url='login')
def profile_view(request):
    """
    Affiche la page de profil de l'utilisateur.
    Permet principalement de changer le mot de passe.
    """
    user = request.user
    user_type = get_user_type(user)
    
    context = {
        'user': user,
        'user_type': user_type,
    }
    return render(request, 'users/profil.html', context)


@login_required(login_url='login')
def api_change_password(request):
    """
    API pour changer le mot de passe de l'utilisateur connecté.
    """
    if not request.method == 'POST':
        return render(request, "404.html", status=404)

    try:
        data = json.loads(request.body)
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        # 1. Validation basique
        if not current_password or not new_password or not confirm_password:
            return JsonResponse({'success': False, 'message': _("Tous les champs sont obligatoires.")}, status=400)

        if new_password != confirm_password:
            return JsonResponse({'success': False, 'message': _("Les nouveaux mots de passe ne correspondent pas.")}, status=400)

        # Vérification de la robustesse
        is_valid, pwd_message = is_strong_password(new_password)
        if not is_valid:
            # Retourne directement l'erreur spécifique générée par is_strong_password
            return JsonResponse({'success': False, 'message': pwd_message}, status=400)

        # 2. Vérification de l'ancien mot de passe
        user = request.user
        if not user.check_password(current_password):
            return JsonResponse({'success': False, 'message': _("Votre mot de passe actuel est incorrect.")}, status=400)

        # 3. Changement du mot de passe
        user.set_password(new_password)
        user.save()

        # 4. Maintien de la session (IMPORTANT)
        # Sans cela, changer le mot de passe déconnecterait l'utilisateur immédiatement
        update_session_auth_hash(request, user)

        return JsonResponse({'success': True, 'message': _("Votre mot de passe a été modifié avec succès.")})

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': _("Données JSON invalides.")}, status=400)
    except Exception as e:
        print(f"Erreur changement mot de passe: {e}")
        return JsonResponse({'success': False, 'message': _("Une erreur serveur est survenue.")}, status=500)

def custom_page_not_found_view(request, exception=None):
    """
    Vue personnalisée pour l'erreur 404 (Page non trouvée).
    Peut être appelée automatiquement par Django ou manuellement.
    """
    return render(request, "404.html", status=404)


@login_required
@require_http_methods(["POST", "DELETE"])
def api_manage_profile_picture(request):
    """
    API pour gérer la photo de profil :
    - POST : Upload et remplace la photo.
    - DELETE : Supprime la photo.
    """
    user = request.user

    # --- CAS 1 : UPLOAD D'UNE NOUVELLE PHOTO ---
    if request.method == "POST":
        # Vérifie si un fichier a été envoyé
        if 'profile_picture' not in request.FILES:
            return JsonResponse({'success': False, 'message': _('Aucun fichier reçu.')}, status=400)

        image_file = request.FILES['profile_picture']

        # Optionnel : Vérification basique du type de fichier
        if not image_file.content_type.startswith('image'):
            return JsonResponse({'success': False, 'message': _('Le fichier doit être une image.')}, status=400)

        try:
            # 1. Supprimer l'ancienne image physiquement
            remove_old_profile_image(user)

            # 2. Sauvegarder la nouvelle
            user.profile_picture = image_file
            user.save()

            # 3. Retourner l'URL de la nouvelle image pour l'affichage JS immédiat
            return JsonResponse({
                'success': True,
                'message': _('Photo mise à jour avec succès.'),
                'new_image_url': user.profile_picture.url
            })

        except Exception as e:
            return JsonResponse({'success': False, 'message': _('Erreur serveur : {error}').format(error=str(e))}, status=500)

    # --- CAS 2 : SUPPRESSION DE LA PHOTO ---
    elif request.method == "DELETE":
        try:
            if user.profile_picture:
                # 1. Supprimer l'ancienne image physiquement
                remove_old_profile_image(user)
                
                # 2. Mettre le champ à None en base de données
                user.profile_picture = None
                user.save()

            return JsonResponse({
                'success': True, 
                'message': _('Photo supprimée.')
            })
            
        except Exception as e:
            return JsonResponse({'success': False, 'message': _('Erreur lors de la suppression : {error}').format(error=str(e))}, status=500)
        

# GEOLOCALISATION ELEVE
@login_required
@require_POST
def api_save_student_location(request):
    """
    Reçoit les coordonnées GPS de l'élève, interroge Nominatim 
    et met à jour la position en BDD, puis renvoie un succès JSON.
    """
    try:
        data = json.loads(request.body)
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        if latitude is None or longitude is None:
            return JsonResponse({'success': False, 'message': _('Coordonnées manquantes.')}, status=400)

        # Vérification du profil étudiant
        try:
            student_profile = request.user.student_user
        except ObjectDoesNotExist:
            return JsonResponse({'success': False, 'message': _('Utilisateur non autorisé.')}, status=403)

        # Appel du service (Nominatim + Rate Limiting + sauvegarde)
        success = update_student_location(student_profile, latitude, longitude)

        if success:
            return JsonResponse({'success': True, 'message': _('Position enregistrée avec succès.')})
        else:
            return JsonResponse({'success': False, 'message': _('Erreur lors de la géolocalisation.')}, status=500)

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': _('Données JSON invalides.')}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)