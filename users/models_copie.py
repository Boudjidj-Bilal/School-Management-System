from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPERADMIN = "SUPERADMIN", _("Super Administrateur")
        PROVISEUR = "PROVISEUR", _("Proviseur")
        ADMINISTRATEUR = "ADMINISTRATEUR", _("Administrateur")
        PROFESSEUR = "PROFESSEUR", _("Professeur")
        CPE = "CPE", _("CPE")
        PARENT = "PARENT", _("Parent")
        ELEVE = "ELEVE", _("Élève")

    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    civility = models.CharField(max_length=10, blank=True, null=True)  # M., Mme...
    school = models.ForeignKey("school.School", on_delete=models.CASCADE, null=True, blank=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class PersonnelProfile(models.Model):
    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="personnel_profile")
    type = models.CharField(max_length=20, choices=User.Role.choices)  # Proviseur, Professeur...

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.type})"

class StudentProfile(models.Model):
    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="student_profile")

    def __str__(self):
        return f"Élève: {self.user.get_full_name()}"

class ParentProfile(models.Model):
    class ParentType(models.TextChoices):
        MOTHER = "MOTHER", _("Mère")
        FATHER = "FATHER", _("Père")

    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="parent_profile")
    parent_type = models.CharField(max_length=10, choices=ParentType.choices)
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"Parent: {self.user.get_full_name()} ({self.parent_type})"

class ChildRelation(models.Model):
    parent = models.ForeignKey("users.ParentProfile", on_delete=models.CASCADE, related_name="children")
    student = models.ForeignKey("users.StudentProfile", on_delete=models.CASCADE, related_name="parents")

    class Meta:
        unique_together = ("parent", "student")

    def __str__(self):
        return f"{self.parent.user.last_name} -> {self.student.user.last_name}"

class TeacherSubject(models.Model):
    teacher = models.ForeignKey("users.PersonnelProfile", on_delete=models.CASCADE, related_name="subjects")
    subject = models.ForeignKey("subjects.Subject", on_delete=models.CASCADE, related_name="teachers")
    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("teacher", "subject")

    def __str__(self):
        return f"{self.teacher.user.get_full_name()} - {self.subject.name}"
