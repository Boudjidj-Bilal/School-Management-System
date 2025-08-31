from django.db import models
from schools.models import School, Year
from users.models import Student
from subjects.models import TeacherSubject

# --> Représente un niveau scolaire (ex: 6e, 5e, Terminale...)
class Level(models.Model):
    level = models.IntegerField()  # niveau numérique (ex: 6, 5, 12...)
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name="levels"
    )  # relation Many-to-One avec School

    def __str__(self):
        return f"Level {self.level} - {self.school.name}"


# --> Représente une salle de classe physique dans une école
class Classroom(models.Model):
    name = models.CharField(max_length=100)        # nom de la salle
    type = models.CharField(max_length=100)        # type de salle (ex: laboratoire, salle normale...)
    is_active = models.BooleanField(default=True)  # salle active ou non
    school = models.ForeignKey(
        School, on_delete=models.CASCADE, related_name="classrooms"
    )  # relation Many-to-One avec School

    def __str__(self):
        return f"{self.name} ({self.school.name})"


# --> Représente une classe académique, liée à un niveau
class Class(models.Model):
    name = models.CharField(max_length=100)  # nom de la classe (ex: 6A, Terminale S1...)
    level = models.ForeignKey(
        Level, on_delete=models.CASCADE, related_name="classes"
    )  # relation Many-to-One avec Level
    is_valid = models.BooleanField(default=True)  # classe validée pour enregistrement

    def __str__(self):
        return f"{self.name} - {self.level}"


# --> Représente l'inscription d'un élève dans une classe pour une année scolaire donnée
class ClassStudentYear(models.Model):
    student_class = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="student_years"
    )  # relation Many-to-One avec Class
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="class_years"
    )  # relation Many-to-One avec Student
    year = models.ForeignKey(
        Year, on_delete=models.CASCADE, related_name="student_classes"
    )  # relation Many-to-One avec Year
    is_active = models.BooleanField(default=True)   # inscription active
    is_delegate = models.BooleanField(default=False)  # élève délégué ou non

    class Meta:
        unique_together = ("student_class", "student", "year")  # éviter doublons

    def __str__(self):
        return f"{self.student} in {self.student_class} ({self.year})"


# --> Représente l'affectation d'un professeur à une classe pour une année donnée
class ClassTeacherYear(models.Model):
    student_class = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="teacher_years"
    )  # relation Many-to-One avec Class
    teacher = models.ForeignKey(
        TeacherSubject, on_delete=models.CASCADE, related_name="class_years"
    )  # relation Many-to-One avec TeacherSubject
    year = models.ForeignKey(
        Year, on_delete=models.CASCADE, related_name="teacher_classes"
    )  # relation Many-to-One avec Year
    is_active = models.BooleanField(default=True)       # affectation active
    is_main_teacher = models.BooleanField(default=False)  # professeur principal ou non

    class Meta:
        unique_together = ("student_class", "teacher", "year")  # éviter doublons

    def __str__(self):
        return f"{self.teacher} for {self.student_class} ({self.year})"
