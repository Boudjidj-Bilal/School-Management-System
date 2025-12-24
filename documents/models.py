from django.db import models
from users.models import Student, User
from schools.models import TermYearLevel

from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os

# ======================================
# MODÈLE BULLETIN SCOLAIRE (Généré auto)
# ======================================

# On définit un stockage privé (hors de l'URL publique)
# On crée un dossier 'private_files' à la racine du projet (au même niveau que 'manage.py')
PRIVATE_STORAGE = FileSystemStorage(location=os.path.join(settings.BASE_DIR, 'private_files'))

class ReportCard(models.Model):
    student = models.ForeignKey(
        Student, 
        on_delete=models.CASCADE, 
        related_name='report_cards'
    )
    term = models.ForeignKey(
        TermYearLevel, 
        on_delete=models.CASCADE, 
        related_name='report_cards'
    )
    
    # Le fichier PDF généré (Snapshot)
    file = models.FileField(
        storage=PRIVATE_STORAGE, # <--- C'est ici que la magie opère
        upload_to='report_cards/%Y/%m/', # L'organisation des dossiers reste la même à l'intérieur
        null=True, 
        blank=True
    )
    
    # Pour savoir si l'élève/parent peut le voir
    is_published = models.BooleanField(default=False, verbose_name="Publié")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Un seul bulletin par élève et par trimestre ? 
        # Non, on peut vouloir le régénérer, mais on veut surtout pouvoir retrouver le dernier facilement.
        # On trie par date de création inverse (le plus récent en premier)
        ordering = ['-created_at']
        verbose_name = "Bulletin Scolaire"

    def __str__(self):
        return f"Bulletin - {self.student} - {self.term}"


# ===================================
# MODÈLE DOCUMENT ADMINISTRATIF (GED)
# ===================================
class StudentDocument(models.Model):
    CATEGORIES = (
        ('ADMIN', 'Administratif'),
        ('CERTIFICATE', 'Certificat de scolarité'),
        ('SANCTION', 'Sanction / Discipline'),
        ('MEDICAL', 'Médical'),
        ('OTHER', 'Autre'),
    )

    student = models.ForeignKey(
        Student, 
        on_delete=models.CASCADE, 
        related_name='documents'
    )
    
    # Qui a déposé le document ? (Proviseur, CPE, Admin...)
    uploaded_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True,
        related_name='uploaded_documents'
    )
    
    title = models.CharField(max_length=255, verbose_name="Titre du document")
    category = models.CharField(max_length=20, choices=CATEGORIES, default='ADMIN')
    
    file = models.FileField(
        storage=PRIVATE_STORAGE, 
        upload_to='student_documents/%Y/%m/'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Document Élève"

    def __str__(self):
        return f"{self.title} - {self.student}"