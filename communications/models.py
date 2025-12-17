from django.db import models
from django.db.models import Q
from users.models import Staff, Parent
from schools.models import School
from django.core.exceptions import ValidationError
from django.utils import timezone


from users.models import User, Staff, Student


# --> Le cœur de l'annonce (Contenu unique)
class Announcement(models.Model):
    TYPE_CHOICES = [
        ("HOMEWORK", "Devoir"),
        ("TEST", "Contrôle"),
        ("COURSE", "Cours"),
        ("MESSAGE", "Message Global"),
    ]

    title = models.CharField(max_length=255)
    content = models.TextField()
    announcement_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="MESSAGE")
    
    # L'expéditeur est un User pour permettre au SuperAdmin (qui n'est pas Staff) d'envoyer
    sender = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_announcements"
    )
    
    # L'école concernée (Facultatif si c'est une annonce globale du SuperAdmin)
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name="school_announcements",
        null=True, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Champ purement informatif pour l'historique (ex: "Envoyé à : 1ère A, 1ère B")
    # La vraie liste technique des destinataires est dans la table AnnouncementRecipient
    target_display = models.CharField(max_length=255, blank=True, help_text="Résumé des destinataires pour affichage")

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_announcement_type_display()}] {self.title} - {self.sender}"


# --> Pièces jointes (Multiples par annonce)
class Attachment(models.Model):
    FILE_TYPE_CHOICES = [
        ("IMAGE", "Image"),
        ("VIDEO", "Vidéo"),
        ("DOCUMENT", "Document"),
    ]

    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name="attachments"
    )
    file = models.FileField(upload_to="announcements_files/%Y/%m/")
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES, default="DOCUMENT")
    
    def __str__(self):
        return f"Fichier ({self.file_type}) pour {self.announcement.title}"


# --> Table de liaison : Gestion des destinataires et de la lecture
class AnnouncementRecipient(models.Model):
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name="recipients"
    )
    
    # Le destinataire (Élève, Prof, Parent, etc.)
    # On lie directement à User pour simplifier les requêtes "Mes annonces"
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="received_announcements"
    )

    # État de lecture (La case à cocher)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Un utilisateur ne reçoit qu'une fois la même annonce
        unique_together = ("announcement", "user")
        indexes = [
            models.Index(fields=['user', 'is_read']), # Optimisation pour filtrer "Non lues"
        ]

    def mark_as_read(self):
        """Marque l'annonce comme lue avec la date actuelle"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()

    def __str__(self):
        state = "Lu" if self.is_read else "Non lu"
        return f"{self.user.username} -> {self.announcement.title} ({state})"



# --> Représente une conversation (Fil de discussion)
class Messaging(models.Model):
    """
    Une conversation lie TOUJOURS un Professeur (Teacher) à :
    - SOIT un Parent
    - SOIT un Élève
    """
    teacher = models.ForeignKey(
        Staff, on_delete=models.CASCADE, related_name="messagings"
    )
    
    # Destinataire A : Le Parent (Optionnel)
    parent = models.ForeignKey(
        Parent, on_delete=models.CASCADE, related_name="messagings",
        null=True, blank=True
    )
    
    # Destinataire B : L'Élève (Optionnel) - [NOUVEAU]
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="messagings",
        null=True, blank=True
    )

    # Statut global de la conversation (pour soft delete / archivage manuel)
    # Note : Le blocage par année se fera via la logique métier (utils), pas ce champ.
    is_active = models.BooleanField(default=True)
    
    # Pour le tri : date du dernier message (mis à jour à chaque envoi)
    last_message_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_message_date'] # Les conversations récentes en premier
        constraints = [
            # Unicité Professeur <-> Parent
            models.UniqueConstraint(
                fields=["teacher", "parent"],
                condition=Q(student__isnull=True),
                name="unique_messaging_teacher_parent"
            ),
            # Unicité Professeur <-> Élève
            models.UniqueConstraint(
                fields=["teacher", "student"],
                condition=Q(parent__isnull=True),
                name="unique_messaging_teacher_student"
            )
        ]

    def clean(self):
        """Validation pour s'assurer qu'on a soit un parent, soit un élève, mais pas les deux."""
        if self.parent and self.student:
            raise ValidationError("Une conversation ne peut pas lier un professeur à un parent ET un élève en même temps.")
        if not self.parent and not self.student:
            raise ValidationError("Une conversation doit avoir un interlocuteur (Parent ou Élève).")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.parent:
            return f"Discussion : {self.teacher.user.last_name} <-> {self.parent.user.last_name} (Parent)"
        elif self.student:
            return f"Discussion : {self.teacher.user.last_name} <-> {self.student.user.last_name} (Élève)"
        return f"Discussion {self.id}"


# --> Représente un message individuel dans une conversation
class Message(models.Model):
    messaging = models.ForeignKey(
        Messaging, on_delete=models.CASCADE, related_name="messages"
    )
    
    # On lie directement à l'User pour savoir exactement qui écrit (Prof, Parent ou Élève)
    sender = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_messages"
    )
    
    content = models.TextField()
    date = models.DateTimeField(auto_now_add=True)
    
    # [AJOUT] Pour la fonctionnalité "Message non lu" (couleur différente)
    is_read = models.BooleanField(default=False)
    
    # Pour le "Soft Delete" individuel d'un message
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['date'] # Chronologique pour l'affichage du chat

    def __str__(self):
        return f"Message de {self.sender.username} le {self.date}"
    
    def save(self, *args, **kwargs):
        # À chaque nouveau message, on met à jour la date de la conversation pour le tri
        if not self.pk: # Seulement à la création
            self.messaging.last_message_date = self.date or models.functions.Now()
            self.messaging.save()
        super().save(*args, **kwargs)