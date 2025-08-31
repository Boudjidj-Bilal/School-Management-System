from django.db import models
from schools.models import Year
from classes.models import Classroom, Class
from subjects.models import TeacherSubject


# --> Représente un planning hebdomadaire (cycle de semaines : 1, 2, 3 ou 4)
class WeeklyPlanning(models.Model):
    CYCLE_CHOICES = [
        (1, "Week Cycle 1"),
        (2, "Week Cycle 2"),
        (3, "Week Cycle 3"),
        (4, "Week Cycle 4"),
    ]  # choix possibles pour le cycle de semaine

    cycle_week = models.IntegerField(choices=CYCLE_CHOICES, default=1)  # cycle de semaine (par défaut 1)
    start_date = models.DateField()  # date de début
    end_date = models.DateField()    # date de fin
    year = models.ForeignKey(
        Year, on_delete=models.CASCADE, related_name="weekly_plannings"
    )  # relation Many-to-One avec Year

    def __str__(self):
        return f"Week {self.cycle_week} ({self.start_date} - {self.end_date})"

# --> Représente un cours planifié (jour, horaires, salle, professeur, matière…)
class Course(models.Model):
    day = models.DateField()                     # jour du cours (date)
    start_time = models.TimeField()              # horaire de début
    end_time = models.TimeField()                # horaire de fin
    classroom = models.ForeignKey(
        Classroom, on_delete=models.CASCADE, related_name="courses"
    )  # relation Many-to-One avec Classroom
    student_class = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="courses"
    )  # relation Many-to-One avec Class
    teacher_subject = models.ForeignKey(
        TeacherSubject, on_delete=models.CASCADE, related_name="courses"
    )  # relation Many-to-One avec TeacherSubject
    is_deleted = models.BooleanField(default=False)  # cours supprimé
    is_inactive = models.BooleanField(default=False)  # cours inactif
    weekly_planning = models.ForeignKey(
        WeeklyPlanning, on_delete=models.CASCADE, related_name="courses"
    )  # relation Many-to-One avec WeeklyPlanning

    class Meta:
        constraints = [
            # 1️ Un professeur ne peut avoir qu’un seul cours (classe + salle) pour un même créneau et jour dans la même semaine
            models.UniqueConstraint(
                fields=["day", "start_time", "end_time", "teacher_subject", "weekly_planning"],
                name="unique_teacher_course_per_week"
            ),

            # 2️ Une classe ne peut avoir qu’un seul cours pour un même créneau et jour dans la même semaine
            models.UniqueConstraint(
                fields=["day", "start_time", "end_time", "student_class", "weekly_planning"],
                name="unique_class_course_per_week"
            ),

            # 3️ Une salle ne peut être utilisée qu’une seule fois pour un même créneau et jour dans la même semaine
            models.UniqueConstraint(
                fields=["day", "start_time", "end_time", "classroom", "weekly_planning"],
                name="unique_classroom_course_per_week"
            ),

            # 4️ Sécurité supplémentaire : empêcher doublon strict sur tous les champs clés dans la même semaine
            models.UniqueConstraint(
                fields=["day", "start_time", "end_time", "teacher_subject", "student_class", "classroom", "weekly_planning"],
                name="unique_classroom_course_per_week_all"
            ),
        ]

    def __str__(self):
        return f"{self.teacher_subject} - {self.student_class} on {self.day} ({self.start_time}-{self.end_time})"
