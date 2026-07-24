from django.db.models import Q

from .models import Messaging, Message

from django.db import transaction

from .models import Messaging, AnnouncementRecipient, Announcement, Attachment, Message, HomeworkSubmission, SubmissionAttachment
from users.models import Student, Staff, Parent
from classes.models import Class, ClassStudentYear

from users.utils import get_user_type


from django.shortcuts import get_object_or_404
from django.core.exceptions import PermissionDenied


ROLE_LABELS = {
    "PRINCIPAL": "Proviseur",
    "TEACHER": "Professeur",
    "CPE": "CPE",
    "ADMINISTRATOR": "Administratif",
    "PARENT": "Parent",
    "STUDENT": "Élève",
}

def get_user_role(user):
    """
    Retourne le rôle métier de l'utilisateur.

    Valeurs possibles :

    PRINCIPAL
    TEACHER
    CPE
    ADMINISTRATOR
    PARENT
    STUDENT

    None = Super Administrateur ou utilisateur inconnu
    """

    if hasattr(user, "staff_user"):

        return user.staff_user.staff_type

    if hasattr(user, "parent_user"):
        return "PARENT"

    if hasattr(user, "student_user"):
        return "STUDENT"

    return None

def get_user_school(user):
    """
    Retourne l'école de l'utilisateur.

    None :
        - SuperAdmin
        - utilisateur invalide
    """

    if hasattr(user, "staff_user"):
        return user.staff_user.school

    if hasattr(user, "parent_user"):
        return user.parent_user.school

    if hasattr(user, "student_user"):
        return user.student_user.school

    return None

def get_role_label(user):

    role = get_user_role(user)

    return ROLE_LABELS.get(role, "Utilisateur")

def get_other_user(conversation, current_user):
    """
    Retourne l'autre participant d'une conversation.
    """

    if conversation.user1_id == current_user.id:
        return conversation.user2

    return conversation.user1

def same_school(user1, user2):
    """
    Vérifie que les deux utilisateurs appartiennent à la même école.
    """

    school1 = get_user_school(user1)
    school2 = get_user_school(user2)

    if school1 is None:
        return False

    if school2 is None:
        return False

    return school1.id == school2.id

def can_users_message(user1, user2):
    """
    Vérifie si deux utilisateurs peuvent communiquer.
    Toutes les règles métier sont centralisées ici.
    """

    if user1.id == user2.id:
        return False

    if not user1.is_active:
        return False

    if not user2.is_active:
        return False

    role1 = get_user_role(user1)
    role2 = get_user_role(user2)

    # Super administrateur
    if role1 is None or role2 is None:
        return False

    # écoles différentes
    if not same_school(user1, user2):
        return False

    #
    # -------- PROVISEUR ----------
    #

    if role1 == "PRINCIPAL":

        return role2 in {
            "PRINCIPAL",
            "TEACHER",
            "CPE",
            "ADMINISTRATOR"
        }

    if role2 == "PRINCIPAL":

        return role1 in {
            "PRINCIPAL",
            "TEACHER",
            "CPE",
            "ADMINISTRATOR"
        }

    #
    # -------- PARENT ----------
    #

    if role1 == "PARENT":

        return role2 in {
            "TEACHER",
            "CPE",
            "ADMINISTRATOR"
        }

    if role2 == "PARENT":

        return role1 in {
            "TEACHER",
            "CPE",
            "ADMINISTRATOR"
        }

    #
    # -------- ELEVE ----------
    #

    if role1 == "STUDENT":

        return role2 in {
            "STUDENT",
            "TEACHER",
            "CPE",
            "ADMINISTRATOR"
        }

    if role2 == "STUDENT":

        return role1 in {
            "STUDENT",
            "TEACHER",
            "CPE",
            "ADMINISTRATOR"
        }

    #
    # -------- PERSONNEL ----------
    #

    return True


def get_existing_conversation(user1, user2):
    """
    Retourne la conversation existante entre deux utilisateurs.
    """
    return Messaging.objects.filter(Q(user1=user1, user2=user2) | Q(user1=user2, user2=user1)).first()

def get_or_create_conversation(user1, user2):
    """
    Retourne la conversation si elle existe. Sinon la crée.
    """

    conversation = get_existing_conversation(user1,user2)

    if conversation:
        return conversation

    if not can_users_message(user1, user2):
        return None

    if user1.id > user2.id:
        user1, user2 = user2, user1

    return Messaging.objects.create(
        user1=user1,
        user2=user2
    )


def get_user_conversations(user):
    """
    Récupère la liste des conversations de l'utilisateur connecté.
    """

    conversations_list = []

    # Les SuperAdministrateurs (ou utilisateurs inconnus)
    # n'ont pas accès à la messagerie.
    if get_user_role(user) is None:
        return []

    # Toutes les conversations où l'utilisateur participe
    qs = (
        Messaging.objects
        .filter(
            Q(user1=user) | Q(user2=user)
        )
        .select_related(
            "user1",
            "user2"
        )
        .prefetch_related(
            "messages"
        )
        .order_by("-last_message_date")
    )

    for conv in qs:

        # Récupération de l'autre participant
        interlocutor = get_other_user(conv, user)

        if interlocutor is None:
            continue

        # Dernier message
        last_msg = conv.messages.last()

        # Nombre de messages non lus
        unread_count = (
            conv.messages
            .filter(is_read=False)
            .exclude(sender=user)
            .count()
        )

        # Vérifie que la conversation est encore autorisée
        # (utile si les droits changent dans le futur)
        is_active_year = can_users_message(
            user,
            interlocutor
        )

        conversations_list.append({
            "id": conv.id,
            "interlocutor_name": interlocutor.username,
            "interlocutor_role": get_role_label(interlocutor),
            "interlocutor_id": interlocutor.id,
            "last_message": (
                last_msg.content
                if last_msg
                else "Aucun message"
            ),
            "last_message_date": (
                last_msg.date
                if last_msg
                else conv.last_message_date
            ),
            "unread_count": unread_count,
            "is_active": is_active_year,
        })

    # Même tri que l'ancien code
    conversations_list.sort(

        key=lambda x: (

            x["unread_count"] > 0,

            x["last_message_date"]

        ),

        reverse=True

    )

    return conversations_list

def get_available_contacts(user):
    """
    Retourne la liste des utilisateurs avec lesquels
    l'utilisateur peut créer une nouvelle conversation.

    - uniquement les utilisateurs de la même école
    - exclusion des conversations existantes
    - application des règles métier
    """

    contacts = []

    role = get_user_role(user)

    # Super administrateur
    if role is None:
        return contacts

    school = get_user_school(user)

    if school is None:
        return contacts

    # Conversations déjà existantes
    existing_ids = {
        conversation["interlocutor_id"]
        for conversation in get_user_conversations(user)
    }

    #
    # On ne récupère QUE les utilisateurs
    # appartenant à cette école
    #

    users = []

    staff_members = (
        Staff.objects
        .filter(
            school=school,
            user__is_active=True
        )
        .select_related("user")
    )

    users.extend(
        staff.user
        for staff in staff_members
    )

    parents = (
        Parent.objects
        .filter(
            school=school,
            user__is_active=True
        )
        .select_related("user")
    )

    users.extend(
        parent.user
        for parent in parents
    )

    students = (
        Student.objects
        .filter(
            school=school,
            user__is_active=True
        )
        .select_related("user")
    )

    users.extend(
        student.user
        for student in students
    )

    #
    # Construction de la liste
    #

    for other in users:

        if other.id == user.id:
            continue

        if other.id in existing_ids:
            continue

        if not can_users_message(user, other):
            continue

        contacts.append({
            "id": other.id,
            "type": get_user_role(other).lower(),
            "name": (
                f"{other.first_name} "
                f"{other.last_name}"
            ),
            "username": other.username,
            "role": get_role_label(other)
        })

    #
    # Tri :
    # 1. rôle
    # 2. nom
    #

    contacts.sort(
        key=lambda c: (
            c["role"],
            c["name"].lower()
        )
    )

    return contacts


def get_dashboard_messaging_stats(user):
    """
    Retourne les statistiques de messagerie
    affichées sur le dashboard.
    """

    if get_user_role(user) is None:
        return {"unread_count": 0}

    conversations = Messaging.objects.filter(
        Q(user1=user)|Q(user2=user)
    )

    unread_count = (Message.objects.filter(messaging__in=conversations,is_read=False).exclude(sender=user).count())

    return {
        "unread_count": unread_count
    }


def get_available_targets(user, current_year):
    """
    Retourne les cibles disponibles (Classes, Groupes, etc.) pour un expéditeur donné.
    """
    user_type = get_user_type(user)
    data = {
        'classes': [],
        'staff_groups': [],
        'can_target_individual_students': True, 
        'can_target_individual_staff': False,
    }

    # 1. PROFESSEUR : Ses classes uniquement
    if user_type == 'Teacher':
        try:
            staff = user.staff_user
            classes = Class.objects.filter(
                teacher_years__teacher__teacher=staff,
                teacher_years__year=current_year,
                teacher_years__is_active=True
            ).distinct().order_by('level__level', 'name')
            
            data['classes'] = [{'id': c.id, 'name': str(c)} for c in classes]
        except:
            pass

    # 2. CPE / ADMIN : Toutes les classes de l'école
    elif user_type in ['CPE', 'Administrator']:
        try:
            staff = user.staff_user
            classes = Class.objects.filter(
                level__school=staff.school,
                is_valid=True
            ).distinct().order_by('level__level', 'name')
            
            data['classes'] = [{'id': c.id, 'name': str(c)} for c in classes]
        except:
            pass

    # 3. PROVISEUR / SUPERADMIN : Tout le monde
    elif user_type in ['Principal', 'SuperAdministrator']:
        data['can_target_individual_staff'] = True
        
        data['staff_groups'] = [
            {'code': 'ALL_STAFF', 'name': 'Tout le personnel'},
            {'code': 'TEACHERS', 'name': 'Tous les professeurs'},
            {'code': 'ADMINISTRATION', 'name': 'Administration'},
        ]
        
        school = None
        if hasattr(user, 'staff_user'):
            school = user.staff_user.school
        elif current_year:
            school = current_year.school
            
        if school:
             classes = Class.objects.filter(
                level__school=school,
                is_valid=True
            ).distinct().order_by('level__level', 'name')
             data['classes'] = [{'id': c.id, 'name': str(c)} for c in classes]

    return data


def create_announcement_logic(sender, form_data, files, current_year):
    """
    Logique métier pour créer l'annonce et distribuer aux destinataires.
    """
    title = form_data.get('title')
    content = form_data.get('content')
    announcement_type = form_data.get('announcement_type')
    
    # Rendu requis uniquement si l'annonce est de type DEVOIR (HOMEWORK)
    raw_req_sub = form_data.get('requires_submission', False)
    requires_submission = True if (announcement_type == 'HOMEWORK' and raw_req_sub) else False

    targets = form_data.get('targets', {}) 

    school = None
    if hasattr(sender, 'staff_user'):
        school = sender.staff_user.school
    elif current_year:
        school = current_year.school

    with transaction.atomic():
        announcement = Announcement.objects.create(
            title=title,
            content=content,
            announcement_type=announcement_type,
            requires_submission=requires_submission,  # Enregistré en BDD
            sender=sender,
            school=school,
            target_display=generate_target_summary(targets) 
        )

        if files:
            for f in files:
                mime = getattr(f, 'content_type', '')
                f_type = 'DOCUMENT'
                if mime.startswith('image/'):
                    f_type = 'IMAGE'
                elif mime.startswith('video/'):
                    f_type = 'VIDEO'
                
                Attachment.objects.create(
                    announcement=announcement,
                    file=f,
                    file_type=f_type
                )

        recipient_users = set()

        class_ids = targets.get('classes', [])
        if class_ids:
            students_in_classes = ClassStudentYear.objects.filter(
                student_class_id__in=class_ids,
                year=current_year,
                is_active=True
            ).select_related('student__user')
            for link in students_in_classes:
                recipient_users.add(link.student.user)

        student_ids = targets.get('students', [])
        if student_ids:
            students = Student.objects.filter(id__in=student_ids).select_related('user')
            for s in students:
                recipient_users.add(s.user)

        staff_groups = targets.get('staff_groups', [])
        if staff_groups and school:
            if 'ALL_STAFF' in staff_groups:
                staff_members = Staff.objects.filter(school=school).select_related('user')
                for s in staff_members: recipient_users.add(s.user)
            else:
                if 'TEACHERS' in staff_groups:
                    staff_members = Staff.objects.filter(school=school, staff_type='TEACHER').select_related('user')
                    for s in staff_members: recipient_users.add(s.user)
                if 'ADMINISTRATION' in staff_groups:
                    staff_members = Staff.objects.filter(school=school).exclude(staff_type='TEACHER').select_related('user')
                    for s in staff_members: recipient_users.add(s.user)

        staff_ids = targets.get('staff_individuals', [])
        if staff_ids:
            staffs = Staff.objects.filter(id__in=staff_ids).select_related('user')
            for s in staffs:
                recipient_users.add(s.user)

        recipients_to_create = []
        for user in recipient_users:
            if user != sender:
                recipients_to_create.append(
                    AnnouncementRecipient(
                        announcement=announcement,
                        user=user
                    )
                )
        
        AnnouncementRecipient.objects.bulk_create(recipients_to_create, ignore_conflicts=True)

    return announcement


def generate_target_summary(targets):
    summary_parts = []
    
    class_ids = targets.get('classes', [])
    if class_ids:
        count = len(class_ids)
        summary_parts.append(f"{count} Classe{'s' if count > 1 else ''}")
        
    student_ids = targets.get('students', [])
    if student_ids:
        count = len(student_ids)
        summary_parts.append(f"{count} Élève{'s' if count > 1 else ''}")
        
    staff_groups = targets.get('staff_groups', [])
    if staff_groups:
        summary_parts.append(f"Groupes: {', '.join(staff_groups)}")
        
    staff_ids = targets.get('staff_individuals', [])
    if staff_ids:
        count = len(staff_ids)
        summary_parts.append(f"{count} Membre{'s' if count > 1 else ''} du personnel")
        
    return ", ".join(summary_parts)


def get_dashboard_last_announcement(user):
    """
    Récupère la toute dernière annonce reçue par l'utilisateur.
    Utilisé pour le widget "Annonces" du dashboard principal.
    """
    try:
        # On cherche dans la table de liaison Recipient pour voir ce que l'utilisateur a reçu
        last_recipient = AnnouncementRecipient.objects.filter(user=user)\
            .select_related('announcement', 'announcement__sender')\
            .order_by('-announcement__created_at').first()
        
        if last_recipient:
            ann = last_recipient.announcement
            
            # Formatage du nom de l'expéditeur
            sender_name = ann.sender.username
            # Si c'est un membre du staff, on essaie d'avoir un nom plus joli
            if hasattr(ann.sender, 'staff_user'):
                sender_name = f"{ann.sender.staff_user.user.last_name} {ann.sender.staff_user.user.first_name}"

            return {
                'title': ann.title,
                'sender': sender_name,
                'date': ann.created_at, # Le template se chargera du formatage date
                'type': ann.get_announcement_type_display(),
                'is_read': last_recipient.is_read
            }
            
        return None # Aucune annonce reçue

    except Exception:
        return None
    

def get_homework_detail_context(announcement_id, user):
    """
    Prépare le contexte pour la page unique d'un devoir (Professeur ou Élève).
    """
    announcement = get_object_or_404(Announcement, id=announcement_id)
    
    if announcement.announcement_type != "HOMEWORK":
        raise PermissionDenied("Cette annonce n'est pas un devoir.")

    context = {
        'announcement': announcement,
        'is_teacher': False,
        'is_student': False,
    }

    user_type = get_user_type(user)

    # Cas du Professeur (Créateur ou SuperAdmin)
    if announcement.sender == user or user_type == "Principal" or user_type == "SuperAdministrator":
        context['is_teacher'] = True
        context['submissions'] = announcement.submissions.select_related('student__user').prefetch_related('files')
        return context

    # Cas de l'Élève destinataire
    elif user_type == "Student":
        student_profile = user.student_user
        
        is_recipient = announcement.recipients.filter(user=user).exists()
        if not is_recipient and not user.is_superuser:
            raise PermissionDenied("Vous n'êtes pas destinataire de ce devoir.")

        context['is_student'] = True
        context['requires_submission'] = announcement.requires_submission
        
        try:
            context['my_submission'] = HomeworkSubmission.objects.prefetch_related('files').get(
                announcement=announcement, 
                student=student_profile
            )
        except HomeworkSubmission.DoesNotExist:
            context['my_submission'] = None
            
        return context

    else:
        raise PermissionDenied("Accès non autorisé à cette page de devoir.")


def handle_student_submission(announcement, student_user, comment, files_list):
    """
    Gère le dépôt ou la modification d'un rendu par un élève, 
    avec nettoyage physique des anciens fichiers de CET élève pour CE devoir.
    """
    if not announcement.requires_submission:
        raise PermissionDenied("Ce devoir ne nécessite pas de rendu.")
        
    student_profile = student_user.student_user

    # 1. Récupère ou crée l'unique rendu de cet élève pour ce devoir
    submission, created = HomeworkSubmission.objects.get_or_create(
        announcement=announcement,
        student=student_profile,
        defaults={'comment': comment}
    )

    # 2. Si le rendu existait déjà, on met à jour le commentaire
    if not created:
        submission.comment = comment
        submission.save()

    # 3. Si de nouveaux fichiers sont fournis par l'élève :
    if files_list:
        # Parcours et suppression physique des anciens fichiers de CET élève
        for old_attachment in submission.files.all():
            if old_attachment.file:
                # Supprime le fichier du stockage (dossier media)
                old_attachment.file.delete(save=False)
            # Supprime l'enregistrement en base de données
            old_attachment.delete()
        
        # Enregistrement du nouveau lot de fichiers
        for f in files_list:
            SubmissionAttachment.objects.create(submission=submission, file=f)

    return submission