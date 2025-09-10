from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from .managers import CustomUserManager
from django.core.exceptions import ObjectDoesNotExist


class User(AbstractBaseUser, PermissionsMixin):
    """
    Utilisateur central du projet
    - gère login, mot de passe, email, first_name, last_name, is_active, etc.
    """
    username = models.CharField(max_length=150, unique=True, blank=True, null=True)
    email = models.EmailField(default="email_a_remplir@gmail.com", null=True, blank=True, unique=True) # TODO Lors de la création d'un user il faut bien passer l'email avec le champs vide si on ne veut pas lui mettre d'email
    phone_number = models.CharField(max_length=20, blank=True, null=True)

    # Ajout manuel des champs de nom
    first_name = models.CharField(max_length=150, blank=True, null=True)
    last_name = models.CharField(max_length=150, blank=True, null=True)

    # Permissions / statut
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Accès admin

    # Manager personnalisé
    objects = CustomUserManager()

    # Champ utilisé pour l'authentification
    USERNAME_FIELD = "username"

    def __str__(self):
        return self.username or self.email


# Gère le modèle pour le super administrateur de la plateforme.
class SuperAdministrator(models.Model):
    user = models.OneToOneField(
        "users.User",
        on_delete=models.CASCADE,
        related_name="super_administrator_user"
    )
    # Champs spécifiques à un super admin
    # (par ex. droits spéciaux, zone de gestion, etc.)

    def __str__(self):
        return f"SuperAdmin: {self.user.username}"


# --> Liste de choix pour la civilité
GENDER_CHOICES = [
    ("M", "Mister"),   # Monsieur
    ("F", "Miss"),     # Madame
]

# --> Liste de choix pour le type de personnel
STAFF_TYPE_CHOICES = [
    ("PRINCIPAL", "Principal"),       # Proviseur
    ("TEACHER", "Teacher"),           # Professeur
    ("CPE", "CPE"),                   # Conseiller Principal d'Éducation
    ("ADMINISTRATOR", "Administrator")  # Administratif
]

# --> Personnel appartenant à une école
class Staff(models.Model):
    """
    Représente un membre du personnel d'une école
    (lié à un compte utilisateur central).
    """
    user = models.OneToOneField("users.User",
    on_delete=models.CASCADE, related_name="staff_user")

    staff_type = models.CharField(
        max_length=20,
        choices=STAFF_TYPE_CHOICES
    )  # Type de personnel (professeur, CPE, etc.)

    school = models.ForeignKey("schools.School", 
    on_delete=models.CASCADE, related_name="staff_members_school")  # École à laquelle le personnel appartient

    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)  # Civilité (M ou F)
    birth_date = models.DateField(blank=True, null=True)  # Date de naissance (optionnelle)
    address = models.TextField()                      # adresse étudiant

    def __str__(self):
        return f"{self.user.username} ({self.staff_type}) - {self.school.name}"


# --> Élèves inscrits dans une école
class Student(models.Model):
    """
    Représente un élève inscrit dans une école.
    Chaque élève est lié à un compte utilisateur central (User).
    """
    user = models.OneToOneField("users.User",
    on_delete=models.CASCADE, related_name="student_user")

    school = models.ForeignKey("schools.School",
    on_delete=models.CASCADE, related_name="students_school")  # L'école de l'élève

    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)  # Civilité (M ou F)
    birth_date = models.DateField(blank=True,null=True)  # Date de naissance (optionnelle)
    address = models.TextField()                      # adresse étudiant

    def __str__(self):
        return f"Élève: {self.user.username} - {self.school.name}"
    

# --> Parents liés à une école et à un ou plusieurs enfants
class Parent(models.Model):
    """
    Représente un parent d'élève.
    Chaque parent est lié à un compte utilisateur central (User).
    """
    TYPE_CHOICES = [
        ("MOTHER", "Mother"),
        ("FATHER", "Father"),
    ]

    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="parent_user")
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="parents_school")  # L'école de rattachement
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)  # Civilité (M ou F)
    parent_type = models.CharField(max_length=10, choices=TYPE_CHOICES)  # Type (Mère ou Père)
    birth_date = models.DateField(blank=True,null=True)  # Date de naissance (optionnelle)
    address = models.TextField()                      # adresse étudiant

    def __str__(self):
        return f"{self.parent_type} - {self.user.username} - {self.school.name}"


# --> Table d'association entre Parent et Student (Many-to-Many)
class Child(models.Model):
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="parent_links"
    )  # lien vers l'élève
    parent = models.ForeignKey(
        Parent, on_delete=models.CASCADE, related_name="student_links"
    )  # lien vers le parent

    class Meta:
        unique_together = ("student", "parent")  # empêche les doublons

    def __str__(self):
        return f"{self.student} child of {self.parent}"
