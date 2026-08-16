from django.db import models
from schools.models import School
from django.core.exceptions import ValidationError
from django.utils import timezone

from users.models import User, Student
from django.utils.translation import gettext_lazy as _

# --> Le cœur de l'annonce (Contenu unique)
class Announcement(models.Model):
    TYPE_CHOICES = [
        ("HOMEWORK", _("Devoir")),
        ("TEST", _("Contrôle")),
        ("COURSE", _("Cours")),
        ("MESSAGE", _("Message Global")),
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

    # Si l'annonce de type devoir demande un rendu de la part des élèves.
    requires_submission = models.BooleanField(
        default=False, 
        help_text=_("Coché si ce devoir nécessite un rendu de la part des élèves.")
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Champ purement informatif pour l'historique (ex: "Envoyé à : 1ère A, 1ère B")
    # La vraie liste technique des destinataires est dans la table AnnouncementRecipient
    target_display = models.CharField(max_length=255, blank=True, help_text=_("Résumé des destinataires pour affichage"))

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
        return _("Fichier ({file_type}) pour {title}").format(file_type=self.file_type, title=self.announcement.title)


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
        state = _("Lu") if self.is_read else _("Non lu")
        return f"{self.user.username} -> {self.announcement.title} ({state})"

class HomeworkSubmission(models.Model):
    # L'annonce concernée (qui doit obligatoirement être de type HOMEWORK)
    announcement = models.ForeignKey(
        Announcement, 
        on_delete=models.CASCADE, 
        related_name="submissions"
    )
    
    # L'élève qui rend le devoir (lié au profil Student ou directement à User)
    student = models.ForeignKey(
        Student, 
        on_delete=models.CASCADE, 
        related_name="homework_submissions"
    )
    
    # Commentaire optionnel de l'élève
    comment = models.TextField(blank=True, null=True)
    
# Traçabilité des dates
    submitted_at = models.DateTimeField(auto_now_add=True)  # Date de création du rendu
    updated_at = models.DateTimeField(auto_now=True)        # Date de la dernière modification

    class Meta:
        # Un élève ne fait qu'un seul rendu principal par devoir (ou on gère des versions)
        unique_together = ("announcement", "student")

    def __str__(self):
        return _("Rendu de {student} pour {title}").format(student=self.student, title=self.announcement.title)


class SubmissionAttachment(models.Model):
    submission = models.ForeignKey(
        HomeworkSubmission, 
        on_delete=models.CASCADE, 
        related_name="files"
    )
    file = models.FileField(upload_to="homework_submissions/%Y/%m/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return _("Fichier de rendu pour {submission}").format(submission=self.submission)

class Messaging(models.Model):

    user1 = models.ForeignKey(
        User,
        related_name="messaging_user1",
        on_delete=models.CASCADE
    )

    user2 = models.ForeignKey(
        User,
        related_name="messaging_user2",
        on_delete=models.CASCADE
    )

    is_active = models.BooleanField(default=True)

    last_message_date = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["user1", "user2"],
                name="unique_conversation"
            )
        ]

    def clean(self):
        if self.user1 == self.user2:
            raise ValidationError(
                _("Un utilisateur ne peut pas discuter avec lui-même.")
            )

    def save(self, *args, **kwargs):
        # Toujours stocker le plus petit id en premier
        if self.user1_id and self.user2_id:
            if self.user1_id > self.user2_id:
                self.user1, self.user2 = self.user2, self.user1

        self.clean()
        super().save(*args, **kwargs)

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
        return _("Message de {username} le {date}").format(username=self.sender.username, date=self.date)
    
    def save(self, *args, **kwargs):
        # À chaque nouveau message, on met à jour la date de la conversation pour le tri
        if not self.pk: # Seulement à la création
            self.messaging.last_message_date = self.date or models.functions.Now()
            self.messaging.save()
        super().save(*args, **kwargs)