from django.db import models
from schools.models import TermYearLevel
from subjects.models import TeacherSubject
from users.models import Student
from scheduling.models import Course

# --> Représente une note obtenue par un élève dans un cours
class Grade(models.Model):
    grade_value = models.FloatField()  # valeur de la note (ex: 15.5)
    name = models.CharField(max_length=100)  # nom du contrôle (ex: "Devoir maison 1")
    coefficient = models.FloatField(default=1.0)  # coefficient de la note
    term_year = models.ForeignKey(
        TermYearLevel, on_delete=models.CASCADE, related_name="grades"
    )  # lien vers le trimestre/semestre/année
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="grades"
    )  # lien vers l'élève
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="grades"
    )  # lien vers le cours concerné
    is_absent = models.BooleanField(default=False)  # élève absent lors de l'évaluation

    def __str__(self):
        return f"{self.student} - {self.name}: {self.grade_value}"


# --> Représente une appréciation donnée à un élève
class Appreciation(models.Model):
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="appreciations"
    )  # élève concerné
    term_year = models.ForeignKey(
        TermYearLevel, on_delete=models.CASCADE, related_name="appreciations"
    )  # période concernée (trimestre/semestre/année)
    teacher_subject = models.ForeignKey(
        TeacherSubject, on_delete=models.CASCADE, related_name="appreciations",
        null=True, blank=True
    )  # professeur et matière (facultatif si appréciation globale)
    content = models.TextField(default="Aucune apréciation.")  # contenus de l'appréciation
    is_global = models.BooleanField(default=False)  # True = appréciation générale, False = par matière

    def __str__(self):
        if self.is_global:
            return f"Global appreciation for {self.student} ({self.term_year})"
        return f"Appreciation {self.teacher_subject} for {self.student} ({self.term_year})"


# --> Représente une mention attribuée à un élève (Assez bien, Bien, Très bien...)
class Mention(models.Model):
    MENTION_CHOICES = [
        ("AB", "Assez Bien"),  # assez bien
        ("B", "Bien"),         # bien
        ("TB", "Très Bien"),   # très bien
    ]

    mention_type = models.CharField(max_length=2, choices=MENTION_CHOICES)  # type de mention
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="mentions"
    )  # élève concerné
    term_year = models.ForeignKey(
        TermYearLevel, on_delete=models.CASCADE, related_name="mentions"
    )  # période concernée

    class Meta:
        unique_together = ("student", "term_year")  
        # un élève ne peut avoir qu'une seule mention par période

    def __str__(self):
        return f"{self.student} - {self.get_mention_type_display()} ({self.term_year})"
