import json
from django.db.models import Q
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
 
# Modèles
from .models import Messaging, Message, Announcement, AnnouncementRecipient
from users.models import Staff, Student, Parent, User
from schools.models import School

# Utilitaires
from schools.utils import get_current_year_for_school, get_user_school
from users.utils import get_user_type, get_student_context
from .utils import (
    get_user_conversations,
    get_available_contacts,
    can_users_message,
    create_announcement_logic,
    get_available_targets,
    get_or_create_conversation
)


# --- HELPER : Identifier le rôle et le profil de l'utilisateur connecté ---
def get_user_role_profile(user):
    """
    Retourne un tuple (role, profile).

    Roles possibles :
        - PRINCIPAL
        - TEACHER
        - CPE
        - ADMINISTRATOR
        - STUDENT
        - PARENT

    Retourne (None, None) si l'utilisateur ne possède
    pas de profil de messagerie (SuperAdmin ou inconnu).
    """

    # Personnel
    if hasattr(user, "staff_user"):
        staff = user.staff_user

        if staff.staff_type == "PRINCIPAL":
            return "PRINCIPAL", staff

        if staff.staff_type == "TEACHER":
            return "TEACHER", staff

        if staff.staff_type == "CPE":
            return "CPE", staff

        if staff.staff_type == "ADMINISTRATOR":
            return "ADMINISTRATOR", staff

    # Élève
    if hasattr(user, "student_user"):
        return "STUDENT", user.student_user

    # Parent
    if hasattr(user, "parent_user"):
        return "PARENT", user.parent_user

    # Super administrateur ou utilisateur non autorisé
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
        if not school.is_active: 
            return render(request, "404.html", status=404)
    else:
        return render(request, "404.html", status=404)

    current_year = get_current_year_for_school(school)

    if current_year:
        if not current_year.running and not current_year.end_year and not current_year.registration :
            return render(request, "404.html", status=404)
    else: 
        return render(request, "404.html", status=404)

    if not role:
        return render(request, "404.html", status=404)

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
    
    conversations = get_user_conversations(request.user)
    
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
        if request.user not in (conversation.user1, conversation.user2):
            return JsonResponse({"success": False,"message": "Accès refusé"},status=403)

        # Marquer comme LU les messages qui ne viennent pas de moi
        conversation.messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)

        messages_data = conversation.messages.filter(is_active=True).values(
            'id', 'content', 'date', 'sender__id', 'sender__first_name', 'sender__last_name'
        ).order_by('date')

        # Formater la date pour le front
        formatted_messages = []
        for msg in messages_data:
            local_date = timezone.localtime(msg['date'])
            formatted_messages.append({
                'id': msg['id'],
                'content': msg['content'],
                'date': local_date.strftime('%d/%m %H:%M'),
                'is_me': (msg['sender__id'] == request.user.id),
                'sender_name': f"{msg['sender__first_name']} {msg['sender__last_name']}"
            })

        # Récupération du nom et du nom d'utilisateur via le helper
        interlocutor_name, interlocutor_username = get_interlocutor_details(conversation, request.user)

        return JsonResponse({
            'success': True, 
            'messages': formatted_messages,
            'is_active': True,
            'interlocutor_name': interlocutor_name,
            'interlocutor_username': interlocutor_username 
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
        if request.user in (conversation.user1, conversation.user2):
            is_participant = True
        
        if not is_participant:
            return JsonResponse({'success': False, 'message': 'Accès refusé'}, status=403)

        # 3. Création
        message = Message.objects.create(
            messaging=conversation,
            sender=request.user,
            content=content
        )

        local_date = timezone.localtime(message.date)

        return JsonResponse({
            'success': True,
            'message': {
                'id': message.id,
                'content': message.content,
                'date': local_date.strftime('%d/%m %H:%M'),
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
    
    contacts = get_available_contacts(request.user)

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
                
        messaging = None

        target = get_object_or_404(User, id=target_id)

        can_message = can_users_message(request.user, target)

        if can_message:

            messaging = (
                Messaging.objects.filter(
                    Q(user1=request.user, user2=target) |
                    Q(user1=target, user2=request.user)
                )
                .first()
            )

            if messaging is None:

                messaging = Messaging.objects.create(
                    user1=request.user,
                    user2=target
                )
            
        if messaging:
            return JsonResponse({'success': True, 'conversation_id': messaging.id})
        else:
            return JsonResponse({'success': False, 'message': 'Impossible de créer la conversation.'}, status=400)

    except Exception as e:
        print(f"Erreur create conv: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


def get_interlocutor_details(conversation, current_user):
    """
    Retourne le nom complet et le username
    de l'autre participant.
    """

    other = (
        conversation.user2
        if conversation.user1 == current_user
        else conversation.user1
    )

    return (
        f"{other.first_name} {other.last_name}",
        other.username
    )

@login_required(login_url='login')
def announcement_dashboard_view(request):
    """
    Page principale des annonces.
    Affiche la boîte de réception et, pour le personnel, le formulaire d'envoi.
    """
    user = request.user
    user_type = get_user_type(user)
    
    # Détermination du contexte (École / Année)
    # (Logique similaire aux autres modules pour trouver l'année active)
    current_year = None

    # 1. Déterminer l'école de l'utilisateur
    school = get_user_school(request.user, request.session.get('selected_school_id'))
    
    if school:
        if school.is_active:
            current_year = get_current_year_for_school(school)
            if not current_year:
                return render(request, "404.html", status=404)
        else:
            return render(request, "404.html", status=404)
    else: 
        return render(request, "404.html", status=404)

    # Permissions d'envoi
    can_send = user_type in ['Teacher', 'CPE', 'Principal', 'SuperAdministrator', 'Administrator']

    can_view_all = user_type in ['Principal', 'SuperAdministrator']

    # Chargement des cibles possibles (Classes, Groupes) si droit d'envoi
    available_targets = {}
    if can_send and current_year:
        available_targets = get_available_targets(user, current_year)

    context = {
        'user_type': user_type,
        'can_send': can_send,
        'can_view_all': can_view_all,
        'available_targets': json.dumps(available_targets), # Pour le JS
        'current_year': current_year,
        'announcement_types': Announcement.TYPE_CHOICES,
    }

    return render(request, 'communications/dashboard_announcements.html', context)


# ====================================================================
# APIs (JSON)
# ====================================================================

@require_http_methods(["GET"])
@login_required(login_url='login')
def api_get_announcements(request):
    """
    API Principale : Récupère Inbox, Sent et All.
    Intégration de la logique 'All' pour les admins.
    """
    user = request.user
    user_type = get_user_type(user)

    student = None
    
    if user_type == "Parent":
        student = get_student_context(request)
        user = student.user
    
    # Détermination du contexte (École / Année)
    # (Logique similaire aux autres modules pour trouver l'année active)
    current_year = None

    # 1. Déterminer l'école de l'utilisateur
    if user_type == "SuperAdministrator":
        school_id_filter = request.session.get('selected_school_id')
        school = School.objects.get(id=school_id_filter)
    else:
        school = get_user_school(request.user)
    
    if school:
        if school.is_active:
            current_year = get_current_year_for_school(school)
        else:
            return JsonResponse({'success': False, 'message': 'Ecole désactivé.'}, status=400)
    else: 
        return JsonResponse({'success': False, 'message': 'Ecole introuvable.'}, status=400)

    if current_year:
        if not current_year.running:
            if not current_year.finished:
                if not current_year.registration:
                    return JsonResponse({'success': False, 'message': "L'année n'est pas à l'état d'enregistrement, en cours ou fini."}, status=400)
    else: 
        return JsonResponse({'success': False, 'message': "Impossible de trouver l'année."}, status=400)

    data = {'inbox': [], 'sent': [], 'all': []}

    # --- Helper de formatage (DRY) ---
    def format_announcement(ann, recipient=None):
        sender_name = ann.sender.username
        try:
            if hasattr(ann.sender, 'staff_user'):
                sender_name = f"{ann.sender.staff_user.staff_type.capitalize()} {ann.sender.last_name}"
        except: pass
        
        local_date = timezone.localtime(ann.created_at)
        read_date = timezone.localtime(recipient.read_at) if (recipient and recipient.read_at) else None

        return {
            'id': ann.id,
            'title': ann.title,
            'content': ann.content,
            'type': ann.get_announcement_type_display(),
            'type_code': ann.announcement_type,
            'sender': sender_name,
            'date': local_date.strftime('%d/%m/%Y %H:%M'),
            'is_read': recipient.is_read if recipient else False,
            'read_at': read_date.strftime('%d/%m/%Y %H:%M') if read_date else None,
            'is_recipient': (recipient is not None),
            'attachments': [{'url': a.file.url, 'type': a.file_type, 'name': a.file.name.split('/')[-1]} for a in ann.attachments.all()]
        }

    # --- 1. INBOX (Reçus) ---
    received_qs = AnnouncementRecipient.objects.filter(user=user)\
        .select_related('announcement', 'announcement__sender')\
        .prefetch_related('announcement__attachments')\
        .order_by('-announcement__created_at')

    for rec in received_qs:
        data['inbox'].append(format_announcement(rec.announcement, rec))

    # --- 2. SENT (Envoyés) ---
    # Seulement si le user a le droit d'envoyer
    sent_qs = Announcement.objects.filter(sender=user).prefetch_related('recipients', 'attachments').order_by('-created_at')
    for ann in sent_qs:
        total = ann.recipients.count()
        read = ann.recipients.filter(is_read=True).count()
        percent = int((read/total)*100) if total > 0 else 0

        local_date = timezone.localtime(ann.created_at)
        
        data['sent'].append({
            'id': ann.id,
            'title': ann.title,
            'content': ann.content,
            'type': ann.get_announcement_type_display(),
            'date': local_date.strftime('%d/%m/%Y %H:%M'),
            'targets_summary': ann.target_display,
            'stats': {'total': total, 'read': read, 'percent': percent},
            'attachments': []
        })

    # --- 3. ALL (Global École - Proviseur/SuperAdmin) ---
    # [C'est cette partie qui manquait dans votre fichier]
    if user_type in ['Principal', 'SuperAdministrator']:
        
        # Récupérer toutes les annonces de l'école
        all_qs = Announcement.objects.filter(school=school)\
            .select_related('sender')\
            .prefetch_related('attachments')\
            .order_by('-created_at')

        # Optimisation : Récupérer mes propres statuts de lecture pour ces annonces
        # pour savoir si je dois afficher la case à cocher ou le mode lecture seule
        my_receipts = {
            r.announcement_id: r 
            for r in AnnouncementRecipient.objects.filter(user=user, announcement__in=all_qs)
        }

        for ann in all_qs:
            recipient_record = my_receipts.get(ann.id)
            # On utilise le même format que inbox
            data['all'].append(format_announcement(ann, recipient_record))
    
    return JsonResponse({'success': True, 'data': data})


@require_http_methods(["POST"])
@csrf_exempt # On gérera le CSRF via JS mais multipart peut être tricky
@login_required(login_url='login')
def api_create_announcement(request):
    """
    Création d'une annonce avec pièces jointes.
    Reçoit un FormData (pas du JSON pur à cause des fichiers).
    """
    user = request.user
    user_type = get_user_type(user)

    # Vérif permissions basique (redondant avec utils mais sécure)
    if user_type: 
        if user_type in ['Student', 'Parent']:
            return JsonResponse({'success': False, 'message': "Non autorisé."}, status=403)
    else:
        return JsonResponse({'success': False, 'message': "Non autorisé."}, status=403)

    try:
        # Récupération des données du formulaire
        # Les données complexes (listes d'IDs) sont envoyées sous forme de chaîne JSON dans 'targets'
        targets_json = request.POST.get('targets') 
        if not targets_json:
             return JsonResponse({'success': False, 'message': "Aucun destinataire sélectionné."}, status=400)
        
        targets = json.loads(targets_json)
        
        form_data = {
            'title': request.POST.get('title'),
            'content': request.POST.get('content'),
            'announcement_type': request.POST.get('type'),
            'targets': targets
        }

        # Récupération des fichiers
        files = request.FILES.getlist('attachments') # 'attachments' est le name du input file multiple

        # 1. Déterminer l'école de l'utilisateur
        if user_type == "SuperAdministrator":
            school_id_filter = request.session.get('selected_school_id')
            school = School.objects.get(id=school_id_filter)
        else:
            school = get_user_school(request.user)
        
        if school:
            if school.is_active:
                current_year = get_current_year_for_school(school)
            else:
                return JsonResponse({'success': False, 'message': 'Ecole désactivé.'}, status=400)
        else: 
            return JsonResponse({'success': False, 'message': 'Ecole introuvable.'}, status=400)

        if current_year:
            if not current_year.running:
                if not current_year.finished:
                    if not current_year.registration:
                        return JsonResponse({'success': False, 'message': "L'année n'est pas à l'état en cours ou fini."}, status=400)
        else: 
            return JsonResponse({'success': False, 'message': "Impossible de trouver l'année."}, status=400)
        
        # Appel de la logique métier (utils.py)
        create_announcement_logic(user, form_data, files, current_year)

        return JsonResponse({'success': True, 'message': "Annonce envoyée avec succès."})

    except Exception as e:
        print(f"Erreur création annonce: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_mark_as_read(request):
    """
    Marquer une annonce comme lue (Case à cocher).
    """
    try:
        user = request.user
        user_type = get_user_type(user)
        
        if user_type == "Parent":
            return JsonResponse({'success': False, 'message': "Le parent ne peut pas afficher l'annonce comme lu."}, status=404)

        data = json.loads(request.body)
        announcement_id = data.get('announcement_id')
        is_read = data.get('is_read', True)

        recipient = AnnouncementRecipient.objects.get(
            user=request.user, 
            announcement_id=announcement_id
        )
        
        if is_read:
            recipient.mark_as_read()
        # On ne gère généralement pas le "marquer comme non lu" pour des raisons légales/suivi,
        # mais si besoin, on pourrait reset ici.

        return JsonResponse({'success': True})

    except AnnouncementRecipient.DoesNotExist:
        return JsonResponse({'success': False, 'message': "Annonce introuvable."}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)