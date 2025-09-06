from django.core.exceptions import ObjectDoesNotExist
from django.db.models import QuerySet
from django.contrib.contenttypes.models import ContentType
from .models import Notification
from users.models import Student, Staff, Parent, SuperAdministrator

"""
    Ce fichier centralise les fonctions utilitaires de l'application 'notifications'.

    Il gère la logique métier liée à la création et à la gestion des notifications
    pour différents types d'utilisateurs.
"""

"""
===========================
GESTION DES NOTIFICATIONS :
===========================
"""

def create_notification(user_id: int, user_model_name: str, type: str, content: str):
    """
    Crée et enregistre une nouvelle notification pour un utilisateur spécifique.

    Args:
        user_id (int): L'ID de l'utilisateur.
        user_model_name (str): Le nom du modèle de l'utilisateur ('student', 'staff', 'parent', 'superadministrator').
        type (str): Le type de notification (INFO, ALERT, etc.).
        content (str): Le contenu du message.

    Returns:
        tuple: (Notification, str) - L'objet Notification créé ou un message d'erreur.
    """
    try:
        model_name_lower = user_model_name.lower()
        
        # Récupère le ContentType pour le modèle spécifié
        content_type = ContentType.objects.get(app_label='users', model=model_name_lower)
        
        # Vérifie si l'objet utilisateur existe
        if model_name_lower == 'student':
            user = Student.objects.get(id=user_id)
        elif model_name_lower == 'staff':
            user = Staff.objects.get(id=user_id)
        elif model_name_lower == 'parent':
            user = Parent.objects.get(id=user_id)
        elif model_name_lower == 'superadministrator':
            user = SuperAdministrator.objects.get(id=user_id)
        else:
            return None, "Erreur: Le type d'utilisateur spécifié n'est pas pris en charge."

        notification = Notification.objects.create(
            user=user,
            type=type,
            content=content,
            content_type=content_type,
            object_id=user.id
        )
        return notification, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'utilisateur spécifié n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de la notification : {str(e)}"

def get_notification_by_id(notification_id: int):
    """
    Récupère une notification par son ID.

    Args:
        notification_id (int): L'ID de la notification.

    Returns:
        Notification: L'objet Notification ou None si non trouvé.
    """
    try:
        return Notification.objects.get(id=notification_id)
    except Notification.DoesNotExist:
        return None

def get_notifications_for_user(user_id: int, user_model_name: str) -> QuerySet:
    """
    Récupère toutes les notifications pour un utilisateur donné.

    Args:
        user_id (int): L'ID de l'utilisateur.
        user_model_name (str): Le nom du modèle de l'utilisateur ('student', 'staff', etc.).

    Returns:
        QuerySet: Un QuerySet des objets Notification correspondants.
    """
    try:
        content_type = ContentType.objects.get(app_label='users', model=user_model_name.lower())
        return Notification.objects.filter(object_id=user_id, content_type=content_type).order_by('-date')
    except ContentType.DoesNotExist:
        return Notification.objects.none()

def update_notification(notification_id: int, **kwargs):
    """
    Met à jour une notification existante.

    Args:
        notification_id (int): L'ID de la notification à mettre à jour.
        **kwargs: Les champs à mettre à jour (ex: is_read=True).

    Returns:
        tuple: (Notification, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        notification = Notification.objects.get(id=notification_id)
        for key, value in kwargs.items():
            setattr(notification, key, value)
        notification.save()
        return notification, None
    except Notification.DoesNotExist:
        return None, "Erreur: La notification spécifiée n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de la notification : {str(e)}"

def mark_notification_as_read(notification_id: int) -> bool:
    """
    Marque une notification comme lue.

    Args:
        notification_id (int): L'ID de la notification à marquer comme lue.

    Returns:
        bool: True si la mise à jour est réussie, False sinon.
    """
    try:
        notification = Notification.objects.get(id=notification_id)
        notification.is_read = True
        notification.save()
        return True
    except Notification.DoesNotExist:
        return False
    except Exception:
        return False

def delete_notification(notification_id: int) -> bool:
    """
    Supprime une notification par son ID.

    Args:
        notification_id (int): L'ID de la notification à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        notification = Notification.objects.get(id=notification_id)
        notification.delete()
        return True
    except Notification.DoesNotExist:
        return False
    except Exception:
        return False
