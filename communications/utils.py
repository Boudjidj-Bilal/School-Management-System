from django.db import transaction

from .models import Messaging, AnnouncementRecipient, Announcement, Attachment
from users.models import Student, Child, Staff
from classes.models import Class, ClassStudentYear, ClassTeacherYear

from users.utils import get_user_type


# ====================================================================
# 1. LOGIQUE MÉTIER : VÉRIFICATION DES PERMISSIONS (RÈGLE A-B-C)
# ====================================================================

def is_conversation_active(messaging, current_year):
    """
    Détermine si une conversation est 'Active' (autorise l'écriture) 
    pour l'année scolaire donnée.
    
    Règle : Le professeur doit enseigner à l'élève (ou à l'enfant du parent) 
    durant l'année 'current_year'.
    """
    if not current_year:
        return False

    teacher = messaging.teacher
    
    # CAS 1 : Conversation Professeur <-> Élève
    if messaging.student:
        student = messaging.student
        return check_teacher_student_link(teacher, student, current_year)

    # CAS 2 : Conversation Professeur <-> Parent
    elif messaging.parent:
        parent = messaging.parent
        # On vérifie si le prof enseigne à AU MOINS UN des enfants du parent
        children = student_links = Student.objects.filter(parent_links__parent=parent)
        for child in children:
            if check_teacher_student_link(teacher, child, current_year):
                return True
        return False

    return False


def check_teacher_student_link(teacher, student, current_year):
    """
    Vérifie s'il existe un lien pédagogique entre un prof et un élève pour une année.
    (Est-ce qu'ils sont dans la même classe ?)
    """
    # 1. Trouver la classe de l'élève pour cette année
    try:
        class_student_link = ClassStudentYear.objects.get(
            student=student,
            year=current_year,
            is_active=True
        )
        student_class = class_student_link.student_class
    except ClassStudentYear.DoesNotExist:
        return False

    # 2. Vérifier si le prof enseigne dans cette classe
    is_teacher_in_class = ClassTeacherYear.objects.filter(
        teacher__teacher=teacher,
        student_class=student_class,
        year=current_year,
        is_active=True
    ).exists()

    return is_teacher_in_class


# ====================================================================
# 2. RÉCUPÉRATION DES DONNÉES (POUR LE DASHBOARD)
# ====================================================================

def get_user_conversations(user, current_year):
    """
    Récupère la liste des conversations pour l'utilisateur connecté.
    Enrichit chaque conversation avec :
    - Le nom de l'interlocuteur
    - Le dernier message
    - Le nombre de messages non lus
    - Le statut (Actif/Bloqué)
    """
    conversations_list = []
    
    # Déterminer qui est l'utilisateur (Prof, Parent ou Élève)
    try:
        if hasattr(user, 'staff_user') and user.staff_user.staff_type == 'TEACHER':
            # C'est un PROFESSEUR
            qs = Messaging.objects.filter(teacher=user.staff_user)
            role = 'TEACHER'
        elif hasattr(user, 'parent_user'):
            # C'est un PARENT
            qs = Messaging.objects.filter(parent=user.parent_user)
            role = 'PARENT'
        elif hasattr(user, 'student_user'):
            # C'est un ÉLÈVE
            qs = Messaging.objects.filter(student=user.student_user)
            role = 'STUDENT'
        else:
            return [] # Admin ou autre (exclu)
    except:
        return []

    # Optimisation : Pré-chargement
    qs = qs.select_related(
        'teacher', 'teacher__user', 
        'parent', 'parent__user', 
        'student', 'student__user'
    ).prefetch_related('messages')

    for conv in qs:
        # 1. Identifier l'interlocuteur
        interlocutor = None
        if role == 'TEACHER':
            if conv.parent:
                interlocutor = conv.parent.user
                interlocutor_role = "Parent d'élève"
            elif conv.student:
                interlocutor = conv.student.user
                interlocutor_role = "Élève"
        else:
            # Pour Parent ou Élève, l'interlocuteur est toujours le prof
            interlocutor = conv.teacher.user
            interlocutor_role = "Professeur"

        if not interlocutor: continue

        # 2. Récupérer le dernier message
        last_msg = conv.messages.last() # Grâce au ordering=['date'] dans Message
        
        # 3. Compter les non-lus (Messages reçus, non lus)
        unread_count = conv.messages.filter(
            is_read=False
        ).exclude(sender=user).count()

        # 4. Vérifier si la conversation est active cette année
        is_active_year = is_conversation_active(conv, current_year)

        conversations_list.append({
            'id': conv.id,
            'interlocutor_name': f"{interlocutor.username}",
            'interlocutor_role': interlocutor_role,
            'interlocutor_id': interlocutor.id, # Utile pour l'avatar
            'last_message': last_msg.content if last_msg else "Aucun message",
            'last_message_date': last_msg.date if last_msg else conv.last_message_date,
            'unread_count': unread_count,
            'is_active': is_active_year, # True = on peut écrire, False = archivé/bloqué
        })

    # Tri : Conversations avec messages non lus en premier, puis par date récente
    conversations_list.sort(key=lambda x: (x['unread_count'] > 0, x['last_message_date']), reverse=True)
    
    return conversations_list


def get_available_contacts(user, current_year):
    """
    Récupère la liste des personnes à qui l'utilisateur peut envoyer un NOUVEAU message.
    (Exclut les personnes avec qui une conversation existe déjà).
    [CORRECTION] Filtre les doublons de professeurs (si un prof enseigne plusieurs matières).
    """
    contacts = []
    existing_conversations = get_user_conversations(user, current_year)
    existing_ids = [c['interlocutor_id'] for c in existing_conversations] # IDs des Users déjà contactés

    # A. Si c'est un PROFESSEUR
    if hasattr(user, 'staff_user') and user.staff_user.staff_type == 'TEACHER':
        teacher = user.staff_user
        
        teacher_classes = ClassTeacherYear.objects.filter(
            teacher__teacher=teacher,
            year=current_year,
            is_active=True
        ).values_list('student_class', flat=True)

        students = ClassStudentYear.objects.filter(
            student_class__in=teacher_classes,
            year=current_year,
            is_active=True
        ).select_related('student__user')

        for link in students:
            if link.student.user.id not in existing_ids:
                contacts.append({
                    'type': 'student',
                    'id': link.student.id, 
                    'name': f"{link.student.user.first_name} {link.student.user.last_name} (Élève - {link.student_class.name})"
                })
            
            child_links = Child.objects.filter(student=link.student)
            
            for child_link in child_links:
                parent = child_link.parent
                
                if parent.user.id not in existing_ids:
                    if not any(c['id'] == parent.id and c['type'] == 'parent' for c in contacts):
                        contacts.append({
                            'type': 'parent',
                            'id': parent.id, 
                            'name': f"{parent.user.first_name} {parent.user.last_name} (Parent de {link.student.user.first_name})"
                        })

    # B. Si c'est un ÉLÈVE
    elif hasattr(user, 'student_user'):
        student = user.student_user
        try:
            class_link = ClassStudentYear.objects.get(student=student, year=current_year, is_active=True)
            my_class = class_link.student_class
            
            teachers = ClassTeacherYear.objects.filter(
                student_class=my_class,
                year=current_year,
                is_active=True
            ).select_related('teacher__teacher__user', 'teacher__subject')
            
            # [CORRECTION] Set pour éviter les doublons de professeurs
            added_prof_ids = set()

            for link in teachers:
                prof = link.teacher.teacher # Objet Staff
                
                # Si le prof n'a pas de conversation ET qu'on ne l'a pas encore ajouté à la liste locale
                if prof.user.id not in existing_ids and prof.id not in added_prof_ids:
                    contacts.append({
                        'type': 'teacher',
                        'id': prof.id,
                        # On n'affiche plus la matière dans le nom car elle n'est pas unique
                        'name': f"{prof.user.last_name} {prof.user.first_name}" 
                    })
                    added_prof_ids.add(prof.id)
        except:
            pass 

    # C. Si c'est un PARENT
    elif hasattr(user, 'parent_user'):
        parent = user.parent_user
        children_links = Child.objects.filter(parent=parent)
        
        processed_teacher_ids = []

        for link in children_links:
            student = link.student
            try:
                class_link = ClassStudentYear.objects.get(student=student, year=current_year, is_active=True)
                
                teachers = ClassTeacherYear.objects.filter(
                    student_class=class_link.student_class,
                    year=current_year,
                    is_active=True
                ).select_related('teacher__teacher__user', 'teacher__subject')

                for t_link in teachers:
                    prof = t_link.teacher.teacher
                    
                    # [CORRECTION] Vérification des doublons locale et globale
                    if prof.id not in processed_teacher_ids and prof.user.id not in existing_ids:
                        contacts.append({
                            'type': 'teacher',
                            'id': prof.id,
                            'name': f"{prof.user.last_name} {prof.user.first_name} (Prof de {student.user.first_name})"
                        })
                        processed_teacher_ids.append(prof.id)
            except:
                continue

    return contacts


def get_available_targets(user, current_year):
    """
    Retourne les cibles disponibles (Classes, Groupes, etc.) pour un expéditeur donné.
    Utilisé pour remplir les sélecteurs dans le formulaire d'envoi (Front-end).
    """
    user_type = get_user_type(user)
    data = {
        'classes': [],
        'staff_groups': [],
        'can_target_individual_students': True, # Vrai pour tous les expéditeurs autorisés
        'can_target_individual_staff': False,
    }

    # 1. PROFESSEUR : Ses classes uniquement
    if user_type == 'Teacher':
        try:
            staff = user.staff_user
            # Récupère les classes où le prof enseigne cette année
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
        
        # Groupes de Staff prédéfinis
        data['staff_groups'] = [
            {'code': 'ALL_STAFF', 'name': 'Tout le personnel'},
            {'code': 'TEACHERS', 'name': 'Tous les professeurs'},
            {'code': 'ADMINISTRATION', 'name': 'Administration (CPE, Secrétariat...)'},
        ]
        
        # Pour le SuperAdmin, on prend l'école du contexte ou la sienne
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
    
    Args:
        sender: User object (l'expéditeur)
        form_data: Dict contenant title, content, type, et 'targets' (dict de listes d'IDs)
        files: List of UploadedFile objects
        current_year: Year object
    """
    
    title = form_data.get('title')
    content = form_data.get('content')
    announcement_type = form_data.get('announcement_type')
    targets = form_data.get('targets', {}) # {'classes': [], 'students': [], 'staff_groups': []}

    # Détermination de l'école (pour le filtrage futur)
    school = None
    if hasattr(sender, 'staff_user'):
        school = sender.staff_user.school
    elif current_year:
        school = current_year.school

    with transaction.atomic():
        # 1. Création de l'annonce
        announcement = Announcement.objects.create(
            title=title,
            content=content,
            announcement_type=announcement_type,
            sender=sender,
            school=school,
            # On génère un résumé textuel des destinataires pour l'affichage rapide dans l'historique
            target_display=generate_target_summary(targets) 
        )

        # 2. Gestion des fichiers joints
        if files:
            for f in files:
                # Détection simple du type
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

        # 3. Résolution des destinataires (User IDs uniques)
        recipient_users = set() # Set pour éviter les doublons (ex: un élève ciblé par sa classe ET individuellement)

        # A. Classes entières -> On récupère tous les élèves de ces classes
        class_ids = targets.get('classes', [])
        if class_ids:
            students_in_classes = ClassStudentYear.objects.filter(
                student_class_id__in=class_ids,
                year=current_year,
                is_active=True
            ).select_related('student__user')
            
            for link in students_in_classes:
                recipient_users.add(link.student.user)

        # B. Élèves individuels
        student_ids = targets.get('students', [])
        if student_ids:
            students = Student.objects.filter(id__in=student_ids).select_related('user')
            for s in students:
                recipient_users.add(s.user)

        # C. Groupes de Staff (Seulement si autorisé et école définie)
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
                    # Tout ce qui n'est pas PROF
                    staff_members = Staff.objects.filter(school=school).exclude(staff_type='TEACHER').select_related('user')
                    for s in staff_members: recipient_users.add(s.user)

        # D. Staff individuel
        staff_ids = targets.get('staff_individuals', [])
        if staff_ids:
            staffs = Staff.objects.filter(id__in=staff_ids).select_related('user')
            for s in staffs:
                recipient_users.add(s.user)

        # 4. Création des liaisons (Bulk Create pour la performance)
        recipients_to_create = []
        for user in recipient_users:
            # On évite de s'envoyer à soi-même
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
    """Génère une chaîne lisible résumant les destinataires."""
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
        # On pourrait mapper les codes vers des noms plus jolis, ici on garde simple
        summary_parts.append(f"Groupes: {', '.join(staff_groups)}")
        
    staff_ids = targets.get('staff_individuals', [])
    if staff_ids:
        count = len(staff_ids)
        summary_parts.append(f"{count} Membre{'s' if count > 1 else ''} du personnel")
        
    return ", ".join(summary_parts)