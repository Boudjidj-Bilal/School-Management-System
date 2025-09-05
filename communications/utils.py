from django.core.exceptions import ObjectDoesNotExist
from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError

from schools.models import School
from users.models import Staff, Student, Parent
from .models import Announcement, Recipient, Messaging, Message

"""
    Ce fichier centralise les fonctions utilitaires de l'application 'communications'.

    Il agit comme une couche de service entre les vues et les modèles/managers.
    Cela permet de séparer la logique métier de la logique de l'API,
    rendant le code plus propre, plus maintenable et plus facile à tester.
"""

"""
=====================
GESTION DES ANNONCES :
=====================
"""

# --- Fonctions CRUD pour la classe Announcement ---

def create_announcement(sender_id, school_id, announcement_type, content, photo=None, video=None):
    """
    Crée et enregistre une nouvelle annonce.

    Args:
        sender_id (int): L'ID du membre du personnel qui envoie l'annonce.
        school_id (int): L'ID de l'école concernée.
        announcement_type (str): Le type d'annonce ('HOMEWORK', 'TEST', 'COURSE', 'MESSAGE').
        content (str): Le contenu de l'annonce.
        photo (File, optional): Le fichier photo à associer. Par défaut, None.
        video (File, optional): Le fichier vidéo à associer. Par défaut, None.

    Returns:
        tuple: (Announcement, str) - L'objet Announcement créé ou un message d'erreur.
    """
    try:
        sender = Staff.objects.get(id=sender_id)
        school = School.objects.get(id=school_id)
        announcement = Announcement.objects.create(
            sender=sender,
            school=school,
            type=announcement_type,
            content=content,
            photo=photo,
            video=video
        )
        return announcement, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet spécifié (expéditeur ou école) n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de l'annonce : {str(e)}"

def get_announcement_by_id(announcement_id):
    """
    Récupère une annonce par son ID.

    Args:
        announcement_id (int): L'ID de l'annonce.

    Returns:
        Announcement: L'objet Announcement ou None si non trouvé.
    """
    try:
        return Announcement.objects.get(id=announcement_id)
    except Announcement.DoesNotExist:
        return None

def get_announcements_by_school(school_id):
    """
    Récupère toutes les annonces d'une école spécifique, triées par date de publication décroissante.

    Args:
        school_id (int): L'ID de l'école.

    Returns:
        QuerySet: Un QuerySet des objets Announcement correspondants.
    """
    try:
        return Announcement.objects.filter(school_id=school_id, is_active=True).order_by('-date')
    except Exception:
        return Announcement.objects.none()

def get_announcements_by_sender(sender_id):
    """
    Récupère toutes les annonces d'un expéditeur spécifique.

    Args:
        sender_id (int): L'ID de l'expéditeur (membre du personnel).

    Returns:
        QuerySet: Un QuerySet des objets Announcement correspondants.
    """
    try:
        return Announcement.objects.filter(sender_id=sender_id, is_active=True).order_by('-date')
    except Exception:
        return Announcement.objects.none()

def update_announcement(announcement_id, **kwargs):
    """
    Met à jour les informations d'une annonce.

    Args:
        announcement_id (int): L'ID de l'annonce à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: content='Nouveau contenu').

    Returns:
        tuple: (Announcement, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        announcement = Announcement.objects.get(id=announcement_id)
        for key, value in kwargs.items():
            setattr(announcement, key, value)
        announcement.save()
        return announcement, None
    except Announcement.DoesNotExist:
        return None, "Erreur: L'annonce spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de l'annonce : {str(e)}"

def delete_announcement(announcement_id):
    """
    Supprime une annonce par son ID.

    Args:
        announcement_id (int): L'ID de l'annonce à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        announcement = Announcement.objects.get(id=announcement_id)
        announcement.delete()
        return True
    except Announcement.DoesNotExist:
        return False
    except Exception:
        return False


"""
===========================
GESTION DES DESTINATAIRES :
===========================
"""

# --- Fonctions CRUD pour la classe Recipient ---

def create_recipient(announcement_id, recipient_id, recipient_type):
    """
    Crée et enregistre un nouveau destinataire pour une annonce.

    Args:
        announcement_id (int): L'ID de l'annonce.
        recipient_id (int): L'ID du destinataire (élève ou membre du personnel).
        recipient_type (str): Le type de destinataire ('student' ou 'staff').

    Returns:
        tuple: (Recipient, str) - L'objet Recipient créé ou un message d'erreur.
    """
    try:
        announcement = Announcement.objects.get(id=announcement_id)
        
        if recipient_type == 'student':
            recipient_obj = Student.objects.get(id=recipient_id)
            content_type = ContentType.objects.get_for_model(Student)
        elif recipient_type == 'staff':
            recipient_obj = Staff.objects.get(id=recipient_id)
            content_type = ContentType.objects.get_for_model(Staff)
        else:
            return None, "Erreur: Le type de destinataire spécifié est invalide. Utilisez 'student' ou 'staff'."

        recipient = Recipient.objects.create(
            announcement=announcement,
            content_type=content_type,
            object_id=recipient_obj.id,
            recipient=recipient_obj
        )
        return recipient, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet spécifié (annonce ou destinataire) n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création du destinataire : {str(e)}"

def get_recipient_by_id(recipient_id):
    """
    Récupère un destinataire par son ID.

    Args:
        recipient_id (int): L'ID du destinataire.

    Returns:
        Recipient: L'objet Recipient ou None si non trouvé.
    """
    try:
        return Recipient.objects.get(id=recipient_id)
    except Recipient.DoesNotExist:
        return None

def get_announcements_for_recipient(recipient_id, recipient_type):
    """
    Récupère toutes les annonces pour un destinataire spécifique.

    Args:
        recipient_id (int): L'ID du destinataire (élève ou membre du personnel).
        recipient_type (str): Le type de destinataire ('student' ou 'staff').

    Returns:
        QuerySet: Un QuerySet des objets Announcement correspondants.
    """
    try:
        if recipient_type == 'student':
            recipient_obj = Student.objects.get(id=recipient_id)
        elif recipient_type == 'staff':
            recipient_obj = Staff.objects.get(id=recipient_id)
        else:
            return Announcement.objects.none()

        content_type = ContentType.objects.get_for_model(recipient_obj)

        recipient_entries = Recipient.objects.filter(
            content_type=content_type,
            object_id=recipient_id
        ).values_list('announcement_id', flat=True)

        return Announcement.objects.filter(id__in=recipient_entries, is_active=True).order_by('-date')

    except ObjectDoesNotExist:
        return Announcement.objects.none()
    except Exception:
        return Announcement.objects.none()

def update_recipient(recipient_id, **kwargs):
    """
    Met à jour les informations d'un destinataire.

    Args:
        recipient_id (int): L'ID du destinataire à mettre à jour.
        **kwargs: Champs à mettre à jour (ex: announcement_id=1).

    Returns:
        tuple: (Recipient, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        recipient = Recipient.objects.get(id=recipient_id)
        for key, value in kwargs.items():
            setattr(recipient, key, value)
        recipient.save()
        return recipient, None
    except Recipient.DoesNotExist:
        return None, "Erreur: Le destinataire spécifié n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour du destinataire : {str(e)}"

def delete_recipient(recipient_id):
    """
    Supprime un destinataire par son ID.

    Args:
        recipient_id (int): L'ID du destinataire à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        recipient = Recipient.objects.get(id=recipient_id)
        recipient.delete()
        return True
    except Recipient.DoesNotExist:
        return False
    except Exception:
        return False


"""
=====================
GESTION DES MESSAGERIES :
=====================
"""

# --- Fonctions CRUD pour la classe Messaging ---

def create_messaging(parent_id, teacher_id):
    """
    Crée une nouvelle messagerie entre un parent et un professeur.

    Args:
        parent_id (int): L'ID du parent.
        teacher_id (int): L'ID du professeur.

    Returns:
        tuple: (Messaging, str) - L'objet Messaging créé ou un message d'erreur.
    """
    try:
        parent = Parent.objects.get(id=parent_id)
        teacher = Staff.objects.get(id=teacher_id)
        messaging = Messaging.objects.create(parent=parent, teacher=teacher)
        return messaging, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: Le parent ou le professeur n'existe pas. Détails: {str(e)}"
    except IntegrityError:
        return None, "Erreur: Une messagerie active existe déjà entre ce parent et ce professeur."
    except Exception as e:
        return None, f"Erreur lors de la création de la messagerie : {str(e)}"


def get_messaging_by_id(messaging_id):
    """
    Récupère une messagerie par son ID.

    Args:
        messaging_id (int): L'ID de la messagerie.

    Returns:
        Messaging: L'objet Messaging ou None si non trouvé.
    """
    try:
        return Messaging.objects.get(id=messaging_id)
    except Messaging.DoesNotExist:
        return None


def get_active_messaging(parent_id, teacher_id):
    """
    Récupère la messagerie active entre un parent et un professeur.

    Args:
        parent_id (int): L'ID du parent.
        teacher_id (int): L'ID du professeur.

    Returns:
        Messaging: L'objet Messaging ou None si non trouvé.
    """
    try:
        return Messaging.objects.get(parent_id=parent_id, teacher_id=teacher_id, is_active=True)
    except Messaging.DoesNotExist:
        return None


def update_messaging_status(messaging_id, is_active):
    """
    Met à jour le statut (actif/inactif) d'une messagerie.

    Args:
        messaging_id (int): L'ID de la messagerie.
        is_active (bool): Le nouveau statut.

    Returns:
        tuple: (Messaging, str) - L'objet Messaging mis à jour ou un message d'erreur.
    """
    try:
        messaging = Messaging.objects.get(id=messaging_id)
        messaging.is_active = is_active
        messaging.save()
        return messaging, None
    except Messaging.DoesNotExist:
        return None, "Erreur: La messagerie spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour du statut de la messagerie : {str(e)}"

"""
======================
GESTION DES MESSAGES :
======================
"""

# --- Fonctions CRUD pour la classe Message ---

def create_message(messaging_id, sender_type, content):
    """
    Crée un nouveau message dans une messagerie existante.

    Args:
        messaging_id (int): L'ID de la messagerie parente.
        sender_type (str): Le type d'expéditeur ('PARENT' ou 'TEACHER').
        content (str): Le contenu du message.

    Returns:
        tuple: (Message, str) - L'objet Message créé ou un message d'erreur.
    """
    try:
        messaging = Messaging.objects.get(id=messaging_id, is_active=True)
        message = Message.objects.create(
            messaging=messaging,
            sender_type=sender_type,
            content=content
        )
        return message, None
    except Messaging.DoesNotExist:
        return None, "Erreur: La messagerie spécifiée n'existe pas ou n'est pas active."
    except Exception as e:
        return None, f"Erreur lors de la création du message : {str(e)}"


def get_messages_for_messaging(messaging_id):
    """
    Récupère tous les messages d'une messagerie, triés par date d'envoi.

    Args:
        messaging_id (int): L'ID de la messagerie.

    Returns:
        QuerySet: Un QuerySet des objets Message correspondants.
    """
    try:
        return Message.objects.filter(messaging_id=messaging_id, is_active=True).order_by('date')
    except Exception:
        return Message.objects.none()


def update_message_content(message_id, new_content):
    """
    Met à jour le contenu d'un message.

    Args:
        message_id (int): L'ID du message.
        new_content (str): Le nouveau contenu.

    Returns:
        tuple: (Message, str) - L'objet Message mis à jour ou un message d'erreur.
    """
    try:
        message = Message.objects.get(id=message_id)
        message.content = new_content
        message.save()
        return message, None
    except Message.DoesNotExist:
        return None, "Erreur: Le message spécifié n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour du message : {str(e)}"


def delete_message(message_id):
    """
    Supprime un message par son ID.

    Args:
        message_id (int): L'ID du message à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        message = Message.objects.get(id=message_id)
        message.is_active = False
        message.save()
        return True
    except Message.DoesNotExist:
        return False
    except Exception:
        return False
