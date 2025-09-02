from django.db import models
from schools.models import Year
from classes.models import Classroom, Class
from subjects.models import TeacherSubject


class WeeklyScheduleTemplate(models.Model):
    name = models.CharField(max_length=150, default = "Semaine 1") # Nom du modèle (ex: "Planning-Type-1", "Semaine-Examen")
    description = models.TextField()                     # description du modèle
    year = models.ForeignKey( 
        Year, on_delete=models.CASCADE, related_name="weekly_template_annee"
    )  # relation Many-to-One avec Year

    def __str__(self):
        return f"Week ({self.name} - {self.year})"


# --> Représente une instance précise de planning hebdomadaire
class WeeklyScheduleInstance(models.Model):
    start_date = models.DateField()  # date de début
    end_date = models.DateField()    # date de fin

    schedule_template = models.ForeignKey( 
        WeeklyScheduleTemplate, on_delete=models.CASCADE, related_name="weekly_template"
    )  # relation Many-to-One avec Year

    def __str__(self):
        return f"Week ({self.start_date} - {self.end_date} - template : {self.schedule_template.name})"
    

# --> Représente un cours planifié (jour, horaires, salle, professeur, matière…)
class Course(models.Model):
    day_of_week = models.IntegerField(
        choices=[(1, 'Lundi'), (2, 'Mardi'), (3, 'Mercredi'), (4, 'Jeudi'), (5, 'Vendredi'), (6, 'Samedi'), (7, 'Dimanche')],
        default = 1
    )           
    start_time = models.TimeField()              # horaire de début
    end_time = models.TimeField()                # horaire de fin
    classroom = models.ForeignKey(
        Classroom, on_delete=models.CASCADE, related_name="courses_classroom"
    )  # relation Many-to-One avec Classroom
    student_class = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="courses_student_class"
    )  # relation Many-to-One avec Class
    teacher_subject = models.ForeignKey(
        TeacherSubject, on_delete=models.CASCADE, related_name="courses_teacher_subject"
    )  # relation Many-to-One avec TeacherSubject
    is_deleted = models.BooleanField(default=False)  # cours supprimé
    is_inactive = models.BooleanField(default=False)  # cours inactif
    weekly_planning_template = models.ForeignKey(
        WeeklyScheduleTemplate, on_delete=models.CASCADE, 
        related_name="courses_weekly_planning_template", default=1
    )  # relation Many-to-One avec WeeklyScheduleTemplate

    class Meta:
        constraints = [
            # 1️ Un professeur ne peut avoir qu’un seul cours (classe + salle) pour un même créneau et jour dans la même semaine
            models.UniqueConstraint(
                fields=["day_of_week", "start_time", "end_time", "teacher_subject", "weekly_planning_template"],
                name="unique_teacher_course_per_week"
            ),

            # 2️ Une classe ne peut avoir qu’un seul cours pour un même créneau et jour dans la même semaine
            models.UniqueConstraint(
                fields=["day_of_week", "start_time", "end_time", "student_class", "weekly_planning_template"],
                name="unique_class_course_per_week"
            ),

            # 3️ Une salle ne peut être utilisée qu’une seule fois pour un même créneau et jour dans la même semaine
            models.UniqueConstraint(
                fields=["day_of_week", "start_time", "end_time", "classroom", "weekly_planning_template"],
                name="unique_classroom_course_per_week"
            ),

            # 4️ Sécurité supplémentaire : empêcher doublon strict sur tous les champs clés dans la même semaine
            models.UniqueConstraint(
                fields=["day_of_week", "start_time", "end_time", "teacher_subject", "student_class", "classroom", "weekly_planning_template"],
                name="unique_classroom_course_per_week_all"
            ),
        ]

    def __str__(self):
        return f"{self.teacher_subject} - {self.student_class} on {self.day_of_week} ({self.start_time}-{self.end_time})"
