from django.db import models
from schools.models import TermYearLevel
from subjects.models import TeacherSubject
from users.models import Student
from classes.models import Class

# Représente une évaluation (un devoir, un examen)
class Evaluation(models.Model):
    name = models.CharField(max_length=100)  # nom du contrôle (ex: "Devoir maison 1")
    date = models.DateField(auto_now_add=True) # Date de création
    coefficient = models.FloatField(default=1.0)  # coefficient
    
    # [MODIFICATION] Ajout du champ pour "noté sur :"
    # Par défaut, une évaluation est sur 20.
    max_grade = models.FloatField(default=20.0) 

    # Liens
    term_year = models.ForeignKey(
        TermYearLevel, on_delete=models.CASCADE, related_name="evaluations"
    )  # lien vers le trimestre/semestre
    teacher_subject = models.ForeignKey(
        TeacherSubject, on_delete=models.CASCADE, related_name="evaluations"
    )  # lien vers la matière et le prof
    student_class = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="evaluations"
    ) # lien vers la classe qui a reçu le devoir

    class Meta:
        ordering = ['date'] # Ordonner par date

    def __str__(self):
        # [MODIFICATION] Ajout du max_grade à l'affichage pour plus de clarté
        return f"{self.name} (/{self.max_grade}) - {self.student_class.name} ({self.teacher_subject.subject.name})"

# Représente la note spécifique d'un élève pour une évaluation
class Grade(models.Model):
    grade_value = models.FloatField(null=True, blank=True)  # valeur (15.5) - Peut être nul si absent
    is_absent = models.BooleanField(default=False)  # élève absent lors de l'évaluation
    comment = models.TextField(blank=True, null=True) # Commentaire optionnel sur la note

    # Liens
    evaluation = models.ForeignKey(
        Evaluation, on_delete=models.CASCADE, related_name="student_grades"
    ) # Lien vers l'évaluation (Devoir 1)
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="student_grades"
    )  # lien vers l'élève

    class Meta:
        # Un élève ne peut avoir qu'une seule note par évaluation
        unique_together = ('evaluation', 'student')

    def __str__(self):
        if self.is_absent:
            return f"{self.student} - {self.evaluation.name}: ABSENT"
        # [MODIFICATION] Affiche aussi le max_grade pour plus de clarté
        return f"{self.student} - {self.evaluation.name}: {self.grade_value} /{self.evaluation.max_grade}"


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
        return f"{self.student} - {self.mention_type()} ({self.term_year})"
