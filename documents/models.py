from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from users.models import Student, Staff

# Cette fonction gère le chemin de téléversement de manière dynamique
def get_document_upload_path(instance, filename):
    """
    Génère un chemin de téléversement dynamique basé sur le type d'objet lié au document.
    """
    if isinstance(instance.content_object, Student):
        return f'documents/students/{filename}'
    elif isinstance(instance.content_object, Staff):
        return f'documents/staff/{filename}'
    else:
        return f'documents/other/{filename}'


# --> Représente un document lié à un élève ou à un membre du personnel
class Document(models.Model):
    TYPE_DOCUMENT_CHOICES = [
        ("SCHOOL REPORT", "school report"), # Document de type : Bulletin
        ("ADMINISTRATIVE", "administrative"), # Document de type : Administratif
    ]  # liste des types de documents

    name = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    type_document = models.CharField(
        max_length=40, 
        choices=TYPE_DOCUMENT_CHOICES,
        blank=True, # Rend le champ facultatif si besoin
        null=True
    )  

    # Champs génériques pour le lien vers n'importe quel modèle
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    # Le document sera enregistré automatiquement dans un chemin dynamique
    document = models.FileField(
        upload_to=get_document_upload_path,
        max_length=255
    )

    def __str__(self):
        return f"{self.name} ({self.content_object})"
    
    class Meta:
        verbose_name = "Document"
        verbose_name_plural = "Documents"
