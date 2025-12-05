import json
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Q

# Modèles
from .models import Messaging, Message
from users.models import User, Staff, Student, Parent
from schools.utils import get_current_year_for_school

# Utilitaires
from .utils import (
    get_user_conversations,
    get_available_contacts,
    is_conversation_active,
)

# --- HELPER: Identifier le rôle de l'utilisateur connecté ---
def get_user_role_profile(user):
    if hasattr(user, 'staff_user') and user.staff_user.staff_type == 'TEACHER':
        return 'TEACHER', user.staff_user
    elif hasattr(user, 'student_user'):
        return 'STUDENT', user.student_user
    elif hasattr(user, 'parent_user'):
        return 'PARENT', user.parent_user
    return None, None


# ====================================================================
# 1. VUE PRINCIPALE (HTML)
# ====================================================================

@login_required(login_url='login')
def messaging_dashboard_view(request):
    """
    Page principale de la messagerie.
    Charge le squelette HTML. Les données sont chargées via API (JS).
    """

    role, profile = get_user_role_profile(request.user)
    
    school = profile.school

    if school:
        if school.is_active == False : 
            return HttpResponseForbidden("Accès refusé. L'école est inactive.")
    else:
        return HttpResponseForbidden("Accès refusé. Aucune école trouvé.")

    current_year = get_current_year_for_school(school)

    if not current_year.running == True or current_year.finished == True:
        return HttpResponseForbidden("Accès refusé. L'année n'es ni en cours, ni à l'état fini.")


    if not role:
        return HttpResponseForbidden("Accès refusé. Messagerie réservée aux Enseignants, Élèves et Parents.")

    # On passe juste le rôle au template pour adapter l'interface si besoin
    context = {
        'user_role': role,
        'user_id': request.user.id
    }
    return render(request, 'communications/dashboard_communication.html', context)


# ====================================================================
# 2. APIs (JSON)
# ====================================================================

@login_required(login_url='login')
def api_get_conversations(request):
    """
    Retourne la liste des conversations de l'utilisateur.
    """
    role, profile = get_user_role_profile(request.user)
    if not role: return JsonResponse({'success': False}, status=403)

    # Récupérer l'année courante est complexe car un Parent peut avoir des enfants dans plusieurs écoles.
    # Pour simplifier l'affichage de la liste, on va déduire l'année active contextuellement dans utils.
    # Ici, on prend l'année de l'école du profil (ou du premier enfant pour le parent) pour référence.
    
    school = None
    if role == 'TEACHER' or role == 'STUDENT':
        school = profile.school
    elif role == 'PARENT':
        # On prend l'école du premier enfant pour référence d'année par défaut
        # (Dans un système multi-école parfait, il faudrait boucler, mais restons simples)
        from users.models import Child
        first_child = Child.objects.filter(parent=profile).first()
        if first_child:
            school = first_child.student.school
            
    current_year = get_current_year_for_school(school) if school else None

    conversations = get_user_conversations(request.user, current_year)
    
    return JsonResponse({'success': True, 'conversations': conversations})


@login_required(login_url='login')
def api_get_messages(request, conversation_id):
    """
    Retourne les messages d'une conversation spécifique.
    Marque les messages reçus comme "Lu".
    """
    try:
        conversation = Messaging.objects.get(id=conversation_id)
        
        # Vérification sécurité : L'utilisateur doit faire partie de la conversation
        is_participant = False
        if conversation.teacher.user == request.user: is_participant = True
        if conversation.student and conversation.student.user == request.user: is_participant = True
        if conversation.parent and conversation.parent.user == request.user: is_participant = True
        
        if not is_participant:
            return JsonResponse({'success': False, 'message': 'Accès refusé'}, status=403)

        # Marquer comme LU les messages qui ne viennent pas de moi
        conversation.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)

        messages_data = conversation.messages.filter(is_active=True).values(
            'id', 'content', 'date', 'sender__id', 'sender__first_name', 'sender__last_name'
        ).order_by('date')

        # Formater la date pour le front
        formatted_messages = []
        for msg in messages_data:
            formatted_messages.append({
                'id': msg['id'],
                'content': msg['content'],
                'date': msg['date'].strftime('%d/%m %H:%M'),
                'is_me': (msg['sender__id'] == request.user.id),
                'sender_name': f"{msg['sender__first_name']} {msg['sender__last_name']}"
            })

        # Vérifier si la conversation est active pour l'écriture (Règle A-B-C)
        # On récupère l'année scolaire de l'école du prof
        prof_school_year = get_current_year_for_school(conversation.teacher.school)
        is_active = is_conversation_active(conversation, prof_school_year)

        return JsonResponse({
            'success': True, 
            'messages': formatted_messages,
            'is_active': is_active,
            'interlocutor_name': get_interlocutor_name(conversation, request.user)
        })

    except Messaging.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Conversation introuvable'}, status=404)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_send_message(request):
    """
    Envoie un nouveau message.
    """
    try:
        data = json.loads(request.body)
        conversation_id = data.get('conversation_id')
        content = data.get('content', '').strip()

        if not content:
            return JsonResponse({'success': False, 'message': 'Message vide'}, status=400)

        conversation = get_object_or_404(Messaging, id=conversation_id)

        # 1. Vérification participant (Sécurité)
        is_participant = False
        if conversation.teacher.user == request.user: is_participant = True
        if conversation.student and conversation.student.user == request.user: is_participant = True
        if conversation.parent and conversation.parent.user == request.user: is_participant = True
        
        if not is_participant:
            return JsonResponse({'success': False, 'message': 'Accès refusé'}, status=403)

        # 2. Vérification Règle A-B-C (Année active)
        prof_school_year = get_current_year_for_school(conversation.teacher.school)
        if not is_conversation_active(conversation, prof_school_year):
            return JsonResponse({'success': False, 'message': 'Cette conversation est archivée (année scolaire terminée ou lien rompu).'}, status=403)

        # 3. Création
        message = Message.objects.create(
            messaging=conversation,
            sender=request.user,
            content=content
        )

        return JsonResponse({
            'success': True,
            'message': {
                'id': message.id,
                'content': message.content,
                'date': message.date.strftime('%d/%m %H:%M'),
                'is_me': True
            }
        })

    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@login_required(login_url='login')
def api_get_contacts(request):
    """
    Récupère l'annuaire des contacts disponibles pour une NOUVELLE conversation.
    """
    role, profile = get_user_role_profile(request.user)
    
    # Détermination de l'année scolaire de référence
    school = None
    if role == 'TEACHER' or role == 'STUDENT':
        school = profile.school
    elif role == 'PARENT':
        # On essaie de trouver une école via les enfants
        from users.models import Child
        child = Child.objects.filter(parent=profile).first()
        if child: school = child.student.school
    
    if not school:
        return JsonResponse({'success': True, 'contacts': []})

    current_year = get_current_year_for_school(school)
    
    contacts = get_available_contacts(request.user, current_year)

    print(contacts)

    return JsonResponse({'success': True, 'contacts': contacts})


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_create_conversation(request):
    """
    Crée une nouvelle conversation (ou retourne l'existante) avec un contact cible.
    """
    try:
        data = json.loads(request.body)
        target_id = data.get('target_id') # ID du profil (Staff, Student, Parent)
        target_type = data.get('target_type') # 'teacher', 'student', 'parent'
        
        role, my_profile = get_user_role_profile(request.user)
        
        messaging = None

        # Logique de création selon qui parle à qui
        if role == 'TEACHER':
            # Le prof parle à un élève ou un parent
            if target_type == 'student':
                student = get_object_or_404(Student, id=target_id)
                messaging, created = Messaging.objects.get_or_create(
                    teacher=my_profile, student=student
                )
            elif target_type == 'parent':
                parent = get_object_or_404(Parent, id=target_id)
                messaging, created = Messaging.objects.get_or_create(
                    teacher=my_profile, parent=parent
                )
        
        elif role == 'STUDENT':
            # L'élève parle à un prof
            if target_type == 'teacher':
                teacher = get_object_or_404(Staff, id=target_id)
                messaging, created = Messaging.objects.get_or_create(
                    teacher=teacher, student=my_profile
                )

        elif role == 'PARENT':
            # Le parent parle à un prof
            if target_type == 'teacher':
                teacher = get_object_or_404(Staff, id=target_id)
                messaging, created = Messaging.objects.get_or_create(
                    teacher=teacher, parent=my_profile
                )

        if messaging:
            return JsonResponse({'success': True, 'conversation_id': messaging.id})
        else:
            return JsonResponse({'success': False, 'message': 'Impossible de créer la conversation.'}, status=400)

    except Exception as e:
        print(f"Erreur create conv: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


# Helper local
def get_interlocutor_name(conversation, current_user):
    # Logique simple pour trouver le nom de "l'autre"
    if conversation.teacher.user == current_user:
        # Je suis le prof
        if conversation.student: return f"{conversation.student.user.first_name} {conversation.student.user.last_name}"
        if conversation.parent: return f"{conversation.parent.user.first_name} {conversation.parent.user.last_name}"
    else:
        # Je suis l'élève ou le parent, je parle au prof
        return f"{conversation.teacher.user.first_name} {conversation.teacher.user.last_name}"
    return "Inconnu"