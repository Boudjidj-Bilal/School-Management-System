from django.shortcuts import render, redirect
from django.http import JsonResponse
import json
from .utils import login_user
from django.contrib.auth.decorators import login_required

def login_page(request):
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

@login_required(login_url='login')
def dashboard_page(request):
    """
    Rend la page principale (tableau de bord) accessible uniquement aux utilisateurs connectés.
    """
    context = {
        'username': request.user.username
    }
    return render(request, 'users/dashboard_page.html', context)
