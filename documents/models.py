from django.db import models
from users.models import Student, Staff
from ProjectSchool.settings import BASE_DIR
import os


# --> Représente les documents d'un élève
class StudentDocument(models.Model):
    TYPE_DOCUMENT_CHOICES = [
        ("SCHOOL REPORT", "school report"), # Document de type : Bulletin
        ("ADMINISTRATIVE", "administrative"), # Document de type : Administratif (tel que les certificats de scolarités par exemple)
    ]  # liste des types de documents

    name = models.CharField(max_length=100)                     # Nom du document
    uploaded_at = models.DateTimeField(auto_now_add=True)       # Date d'ajout du document
    type_document = models.CharField(max_length=40, choices=TYPE_DOCUMENT_CHOICES)  # Type de document

    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="student"
    )   # lien vers l'élève
    
    document = models.FileField(
        upload_to="documents/student/",  # chemin relatif à MEDIA_ROOT
        max_length=255
    )  # Le document sera enregistré automatiquement dans media/documents/student

    def __str__(self):
        return f"{self.name} ({self.student})"
    

# --> Représente les documents d'un membre du personnel (Professeur, CPE, Administrateur, Proviseur)
class StaffDocument(models.Model):
    name = models.CharField(max_length=100)                     # Nom du document
    uploaded_at = models.DateTimeField(auto_now_add=True)       # Date d'ajout du document

    staff = models.ForeignKey(
        Staff, on_delete=models.CASCADE, related_name="staff"
    )   # lien vers le personnel
    
    document = models.FileField(
        upload_to="documents/staff/",  # chemin relatif à MEDIA_ROOT
        max_length=255
    )  # Le document sera enregistré automatiquement dans media/documents/staff
    def __str__(self):
        return f"{self.name} ({self.student})"