from django.shortcuts import render, redirect
from django.http import JsonResponse
import json
from django.contrib.auth.decorators import login_required
from django.contrib.auth import get_user_model
from users.utils import create_user, create_staff, get_user_type, generate_unique_username, send_email_create_compte_principal, get_user_by_username, generate_random_password
from .utils import create_school

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

                send_email_create_compte_principal(request, principal_email, username_principal, password) # Envoie de l'email au proviseur

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
    Vue pour modifier une école.
    """
    return "" # TODO Accessible pour le super admin et aussi pour le proviseur qui peut changer sa propre école

