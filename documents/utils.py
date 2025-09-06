"""
    Ce fichier centralise les fonctions utilitaires de l'application 'documents'.

    Il gère la logique métier liée à la gestion des documents des élèves et du personnel.
"""
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import QuerySet
from django.contrib.contenttypes.models import ContentType
from .models import Document
from users.models import Student, Staff

"""
=======================
GESTION DES DOCUMENTS : 
=======================
"""

def create_document(name: str, document_file, object_id: int, content_type_model_name: str, type_document: str = None):
    """
    Crée et enregistre un nouveau document lié à un élève ou un membre du personnel.

    Args:
        name (str): Le nom du document.
        document_file: Le fichier à télécharger.
        object_id (int): L'ID de l'objet lié (élève ou personnel).
        content_type_model_name (str): Le nom du modèle lié ('student' ou 'staff').
        type_document (str, optional): Le type de document.

    Returns:
        tuple: (Document, str) - L'objet Document créé ou un message d'erreur.
    """
    try:
        # Récupère le ContentType pour le modèle spécifié
        model_name_lower = content_type_model_name.lower()
        content_type = ContentType.objects.get(app_label='users', model=model_name_lower)
        
        # Vérifie si l'objet lié existe
        if content_type.model == 'student':
            linked_object = Student.objects.get(id=object_id)
        elif content_type.model == 'staff':
            linked_object = Staff.objects.get(id=object_id)
        else:
            return None, "Erreur: Le type de modèle lié n'est pas pris en charge."

        document = Document.objects.create(
            name=name,
            document=document_file,
            object_id=linked_object.id,
            content_type=content_type,
            type_document=type_document
        )
        return document, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur: L'objet lié n'existe pas. Détails: {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création du document : {str(e)}"


def get_document_by_id(document_id: int):
    """
    Récupère un document par son ID.

    Args:
        document_id (int): L'ID du document.

    Returns:
        Document: L'objet Document ou None si non trouvé.
    """
    try:
        return Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        return None


def get_documents_by_object(object_id: int, content_type_model_name: str) -> QuerySet:
    """
    Récupère tous les documents pour un objet lié (élève ou personnel) donné.

    Args:
        object_id (int): L'ID de l'objet lié.
        content_type_model_name (str): Le nom du modèle lié ('student' ou 'staff').

    Returns:
        QuerySet: Un QuerySet des objets Document correspondants.
    """
    try:
        content_type = ContentType.objects.get(app_label='users', model=content_type_model_name.lower())
        return Document.objects.filter(object_id=object_id, content_type=content_type).order_by('-uploaded_at')
    except ContentType.DoesNotExist:
        return Document.objects.none()


def update_document(document_id: int, **kwargs):
    """
    Met à jour un document existant.

    Args:
        document_id (int): L'ID du document à mettre à jour.
        **kwargs: Les champs à mettre à jour (ex: name='Nouveau Nom').

    Returns:
        tuple: (Document, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        document = Document.objects.get(id=document_id)
        for key, value in kwargs.items():
            setattr(document, key, value)
        document.save()
        return document, None
    except Document.DoesNotExist:
        return None, "Erreur: Le document spécifié n'existe pas."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour du document : {str(e)}"


def delete_document(document_id: int) -> bool:
    """
    Supprime un document par son ID.

    Args:
        document_id (int): L'ID du document à supprimer.

    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        document = Document.objects.get(id=document_id)
        document.delete()
        return True
    except Document.DoesNotExist:
        return False
    except Exception:
        return False

"""
========================
GENERATION DU BULLETIN : 
========================
"""

