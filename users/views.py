from django.shortcuts import render, redirect
from django.http import JsonResponse
import json
from .utils import *
from django.contrib.auth.decorators import login_required
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth.tokens import PasswordResetTokenGenerator

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
            
            user = login_user(request, username, password)
            
            if user:
                return JsonResponse({'success': True, 'message': 'Connexion réussie.'})
            else:
                return JsonResponse({'success': False, 'message': 'Nom d\'utilisateur ou mot de passe incorrect.'})
                
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Données JSON invalides.'}, status=400)
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
    Rend la page principale (tableau de bord) accessible uniquement aux utilisateurs connectés.
    """
    context = {
        'username': request.user.username
    }
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
                    return JsonResponse({'success': True, 'message': 'Un lien de réinitialisation a été envoyé à votre adresse e-mail.'})
                else:
                    return JsonResponse({'success': False, 'message': 'Erreur lors de l\'envoi de l\'e-mail.'})
            except User.DoesNotExist:
                return JsonResponse({'success': False, 'message': 'Nom d\'utilisateur invalide.'})
                
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Données JSON invalides.'}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)



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
                
                user, message = change_user_password(user.id, new_password)

                if user:
                    return JsonResponse({'success': True, 'message': message})
                else: 
                    return JsonResponse({'success': False, 'message': message})
            except Exception as e:
                return JsonResponse({'success': False, 'message': str(e)}, status=500)
    else:
        return render(request, 'error_page.html', {
            'message': 'Le lien de réinitialisation est invalide ou a expiré.'
        })