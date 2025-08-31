from django.db import models
from users.models import Staff, Student, Parent
from schools.models import School


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


# --> Représente un destinataire de type personnel pour une annonce
class StaffRecipient(models.Model):
    recipient = models.ForeignKey(
        Staff, on_delete=models.CASCADE, related_name="received_announcements"
    )  # personnel destinataire
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name="staff_recipients"
    )  # annonce concernée

    def __str__(self):
        return f"{self.recipient} -> {self.announcement}"


# --> Représente un destinataire de type élève pour une annonce
class StudentRecipient(models.Model):
    recipient = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="received_announcements"
    )  # élève destinataire
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, related_name="student_recipients"
    )  # annonce concernée

    def __str__(self):
        return f"{self.recipient} -> {self.announcement}"


# --> Représente une messagerie entre un parent et un professeur
class Messaging(models.Model):
    parent = models.ForeignKey(
        Parent, on_delete=models.CASCADE, related_name="messagings"
    )  # parent concerné
    teacher = models.ForeignKey(
        Staff, on_delete=models.CASCADE, related_name="messagings"
    )  # professeur concerné
    is_active = models.BooleanField(default=True)    # statut actif (True par défaut)

    class Meta:
        constraints = [
            # Un parent et un professeur ne peuvent avoir qu’une seule messagerie active en même temps
            models.UniqueConstraint(
                fields=["parent", "teacher"],
                condition=models.Q(is_active=True),
                name="unique_active_messaging_parent_teacher"
            )
        ]

    def __str__(self):
        return f"Messaging {self.parent} <-> {self.teacher}"


# --> Représente un message dans une messagerie
class Message(models.Model):
    SENDER_TYPE_CHOICES = [
        ("PARENT", "parent"),       # message envoyé par un parent
        ("TEACHER", "teacher"),     # message envoyé par un professeur
    ]

    sender_type = models.CharField(max_length=20, choices=SENDER_TYPE_CHOICES)  # type d’expéditeur
    content = models.TextField()                     # contenu du message
    date = models.DateTimeField(auto_now_add=True)   # date d’envoi
    messaging = models.ForeignKey(
        Messaging, on_delete=models.CASCADE, related_name="messages"
    )  # messagerie liée
    is_active = models.BooleanField(default=True)    # statut actif

    def __str__(self):
        return f"{self.sender_type} - {self.messaging} ({self.date})"
