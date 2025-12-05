from django.db import models
from django.db.models import Q
from users.models import Staff, Parent
from schools.models import School
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError


from users.models import User, Staff, Student

# --> Représente une annonce (devoir, contrôle, cours ou message) envoyée dans l'école
class Announcement(models.Model):
    ANNOUNCEMENT_TYPE_CHOICES = [
        ("HOMEWORK", "homework"),   # devoir
        ("TEST", "test"),           # contrôle
        ("COURSE", "course"),       # cours
        ("MESSAGE", "message"),     # message
    ]

    type = models.CharField(max_length=20, choices=ANNOUNCEMENT_TYPE_CHOICES)  # type d'annonce
    content = models.TextField()                     # contenu du message/annonce
    photo = models.ImageField(upload_to="announcements/photos/", blank=True, null=True)  # photo éventuelle
    video = models.FileField(upload_to="announcements/videos/", blank=True, null=True)   # vidéo éventuelle
    date = models.DateTimeField(auto_now_add=True)   # date de publication
    sender = models.ForeignKey(
        Staff, on_delete=models.CASCADE, related_name="sent_announcements"
    )  # personnel qui a créé l’annonce
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name="announcements"
    )  # école concernée
    is_active = models.BooleanField(default=True)    # statut actif

    def __str__(self):
        return f"{self.type} - {self.sender}"

class Recipient(models.Model):
    """
    Représente un destinataire unique pour une annonce, qu'il soit un membre du personnel
    ou un élève, en utilisant une clé étrangère générique.
    """
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE) # Le type de model : Staff ou Student
    object_id = models.PositiveIntegerField() # L'id de l'étudiant ou du membre du personnel
    recipient = GenericForeignKey('content_type', 'object_id') # Stock les deux informations dans un champs
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name="recipients"
    )

    def __str__(self):
        return f"{self.recipient} -> {self.announcement}"


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
    
    # [MODIFIÉ] On lie directement à l'User pour savoir exactement qui écrit (Prof, Parent ou Élève)
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