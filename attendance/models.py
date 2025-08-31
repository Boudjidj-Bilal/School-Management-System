from django.db import models
from schools.models import TermYear
from users.models import Student
from scheduling.models import Course


# --> Représente les absences et les retards d'un élève
class Attendance(models.Model):
    ATTENDANCE_CHOICES = [
        ("DELAY", "delay"), # Retard
        ("ABSENCE", "absence"), # Absence
    ]  # liste des présences possibles

    type = models.CharField(max_length=40, choices=ATTENDANCE_CHOICES)  # couleur associée
    justified = models.BooleanField(default=True)         # Absence ou retard justifié ou non
    term_year = models.ForeignKey(
        TermYear, on_delete=models.CASCADE, related_name="term_year_attendance"
    )  # lien vers le trimestre/semestre/année
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="student_attendance"
    )  # lien vers l'élève
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="course_attendance"
    )  # lien vers le cours

    class Meta:
        unique_together = ("student", "course")  
        # un élève ne peut avoir qu'une seule absence ou qu'un seul retard par cours

    def __str__(self):
        return f"{self.type} ({self.student.first_name} / {self.course.day})"