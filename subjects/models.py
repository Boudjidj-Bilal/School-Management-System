from django.db import models
from schools.models import School
from users.models import Staff


# --> Représente une matière scolaire (ex: Mathématiques, Histoire, Physique...)
class Subject(models.Model):
    COLOR_CHOICES = [
        ("RED", "Red"),
        ("BLUE", "Blue"),
        ("GREEN", "Green"),
        ("YELLOW", "Yellow"),
        ("ORANGE", "Orange"),
        ("PURPLE", "Purple"),
        ("GRAY", "Gray"),
    ]  # liste des couleurs possibles (pour affichage dans l'UI)

    name = models.CharField(max_length=100)                 # nom de la matière
    color = models.CharField(max_length=20, choices=COLOR_CHOICES)  # couleur associée
    is_active = models.BooleanField(default=True)           # matière active ou non
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name="subjects"
    )  # relation Many-to-One avec School

    def __str__(self):
        return f"{self.name} ({self.school.name})"
    

# --> Représente l'affectation d'un professeur à une matière
# --> Un professeur (type Personnel = professeur) peut enseigner plusieurs matières
class TeacherSubject(models.Model):
    subject = models.ForeignKey(
        Subject, on_delete=models.CASCADE, related_name="teacher_subjects"
    )  # relation Many-to-One avec Subject
    teacher = models.ForeignKey(
        Staff, on_delete=models.CASCADE, related_name="teacher_subjects"
    )  # relation Many-to-One avec Staff (uniquement si type = professeur)
    is_active = models.BooleanField(default=True)  # actif ou non

    class Meta:
        unique_together = ("subject", "teacher")  # empêche doublons (même prof - même matière)

    def __str__(self):
        return f"{self.teacher} teaches {self.subject}"
