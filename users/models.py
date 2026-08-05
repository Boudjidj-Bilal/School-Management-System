from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from .managers import CustomUserManager

from django.utils.translation import gettext_lazy as _

# --- Fonction utilitaire pour le chemin de l'image ---
def user_profile_image_path(instance, filename):
    """
    Génère un chemin unique pour la photo de profil :
    profile_images/user_<id>/profile_<id>.<ext>
    """
    # Récupère l'extension du fichier (ex: .jpg, .png)
    ext = filename.split('.')[-1]
    # Renomme le fichier : profile_ID.extension (ex: profile_42.jpg)
    filename = f"profile_{instance.id}.{ext}"
    # Retourne le chemin complet relatif à MEDIA_ROOT
    return f'profile_images/user_{instance.id}/{filename}'

class User(AbstractBaseUser, PermissionsMixin):
    """
    Utilisateur central du projet
    - gère login, mot de passe, email, first_name, last_name, is_active, etc.
    """
    username = models.CharField(max_length=150, unique=True, blank=True, null=True)
    email = models.EmailField(default="email_a_remplir@gmail.com", null=True, blank=True, unique=True) 
    phone_number = models.CharField(max_length=20, blank=True, null=True)

    # Ajout manuel des champs de nom
    first_name = models.CharField(max_length=150, blank=True, null=True)
    last_name = models.CharField(max_length=150, blank=True, null=True)

    profile_picture = models.ImageField(
        upload_to=user_profile_image_path, 
        null=True, 
        blank=True,
        verbose_name=_("Photo de profil")
    )

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
    birth_date = models.DateField(blank=True, null=True)  # Date de naissance (optionnelle)
    address = models.TextField()                          # adresse étudiant
    
    # Numéro d'identification national (ex: INE en France) - Non obligatoire
    national_number = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return _("Élève: {username} - {school_name}").format(username=self.user.username, school_name=self.school.name)
    

# --> Parents liés à une école et à un ou plusieurs enfants
class Parent(models.Model):
    """
    Représente un parent d'élève.
    Chaque parent est lié à un compte utilisateur central (User).
    """

    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="parent_user")
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="parents_school")  # L'école de rattachement
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES)  # Civilité (M ou F)
    birth_date = models.DateField(blank=True,null=True)  # Date de naissance (optionnelle)
    address = models.TextField()                      # adresse étudiant

    def __str__(self):
        return f"{self.user.username} - {self.school.name}"


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
        return _("{student_username} child of {parent_username} {school_name}").format(student_username=self.student.user.username, parent_username=self.parent.user.username, school_name=self.student.school.name)


class StudentLocation(models.Model):
    """
    Stocke la dernière position géographique textuelle d'un élève.
    Lié en ForeignKey pour permettre une relation propre.
    """
    student = models.ForeignKey(
        Student, 
        on_delete=models.CASCADE, 
        related_name="locations"
    )
    
    # Informations textuelles issues de Nominatim
    address_text = models.TextField(verbose_name=_("Adresse complète"))
    city = models.CharField(max_length=150, blank=True, null=True, verbose_name=_("Ville"))
    country = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("Pays"))
    
    # Traçabilité de la dernière mise à jour
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Dernière mise à jour"))

    def __str__(self):
        return _("Position de {username} - {date}").format(username=self.student.user.username, date=self.updated_at.strftime('%d/%m/%Y à %H:%M'))