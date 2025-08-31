from django.db import models
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

# --> Représente une notification destinée à différents types d'utilisateurs (parent, élève, professeur, superadmin)
class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ("INFO", "Information"),       # notification d'information générale
        ("ALERT", "Alerte"),           # alerte (ex: absence, retard)
        ("MESSAGE", "Message"),        # message reçu
        ("REMINDER", "Rappel"),        # rappel (ex: devoir, contrôle)
    ]

    # Champs pour la relation générique vers différents types d'utilisateurs
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)  
    object_id = models.PositiveIntegerField()
    user = GenericForeignKey("content_type", "object_id")  
    # ex: peut être un Parent, un Student, un Staff ou un SuperAdministrator

    type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)  # type de notification
    content = models.TextField()                       # contenu de la notification
    is_read = models.BooleanField(default=False)       # statut de lecture
    date = models.DateTimeField(auto_now_add=True)     # date de création

    def __str__(self):
        return f"Notification for {self.user} - {self.type}"
