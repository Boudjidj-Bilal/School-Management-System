from django.db import models
from schools.models import Year
from classes.models import Classroom, Class
from subjects.models import TeacherSubject
from users.models import User

class WeeklyScheduleTemplate(models.Model):
    name = models.CharField(max_length=150, default="Semaine Type")
    description = models.TextField(blank=True, null=True)
    
    # Le template est spécifique à une année
    year = models.ForeignKey( 
        Year, on_delete=models.CASCADE, related_name="weekly_template_years"
    )
    # Le template est spécifique à UNE classe pour cette année
    student_class = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="weekly_template_class"
    )

    def __str__(self):
        return f"Template {self.name} - {self.student_class} ({self.year})"


# Modèle Course (représente un cours DANS UN TEMPLATE de semaine)
class CourseTemplate(models.Model): # Renommé pour plus de clarté
    day_of_week = models.IntegerField(
        choices=[(1, 'Lundi'), (2, 'Mardi'), (3, 'Mercredi'), (4, 'Jeudi'), (5, 'Vendredi'), (6, 'Samedi'), (7, 'Dimanche')]
    )           
    start_time = models.TimeField()              
    end_time = models.TimeField()                
    classroom = models.ForeignKey(
        Classroom, on_delete=models.CASCADE, related_name="course_templates"
    )  
    teacher_subject = models.ForeignKey(
        TeacherSubject, on_delete=models.CASCADE, related_name="course_templates"
    )  # Contient la matière et le professeur
    
    # Lien avec le nouveau WeeklyScheduleTemplate
    weekly_template = models.ForeignKey(
        WeeklyScheduleTemplate, on_delete=models.CASCADE, 
        related_name="course_templates" 
    )  

    class Meta:
        constraints = [
            # 1️ Un professeur ne peut avoir qu’un seul cours (dans CE template) pour un même créneau et jour
            models.UniqueConstraint(
                fields=["day_of_week", "start_time", "end_time", "teacher_subject", "weekly_template"],
                name="unique_teacher_course_per_template"
            ),
            # 2️ Une salle ne peut être utilisée qu’une seule fois (dans CE template) pour un même créneau et jour
            models.UniqueConstraint(
                fields=["day_of_week", "start_time", "end_time", "classroom", "weekly_template"],
                name="unique_classroom_course_per_template"
            ),
            # Règle de la classe (n°2 de votre liste initiale) : 
            # Comme le template est lié à UNE SEULE classe, la classe est implicitement unique pour le template.
        ]

    def __str__(self):
        # La classe est accessible via self.weekly_template.student_class
        return f"{self.teacher_subject} - {self.weekly_template.student_class} ({self.day_of_week}) ({self.start_time}-{self.end_time})"
    


# --> Représente l'enregistrement d'un cours réel pour une date précise.
class ScheduledCourse(models.Model):
    
    # [MODIFIÉ] Ajout des choix de statut
    STATUS_CHOICES = [
        ('ACTIVE', 'Actif'),
        ('CANCELLED', 'Cours annulé'),
        ('TEACHER_ABSENT', 'Professeur absent'),
    ]

    # Lien vers l'objet "template" qui a servi à le créer (pour la traçabilité)
    course_template = models.ForeignKey(
        CourseTemplate, on_delete=models.SET_NULL, null=True, related_name="scheduled_instances"
    )
    
    # Informations de planification fixes (copiées du template)
    classroom = models.ForeignKey(
        Classroom, on_delete=models.PROTECT, related_name="scheduled_courses_classroom"
    )
    teacher_subject = models.ForeignKey(
        TeacherSubject, on_delete=models.PROTECT, related_name="scheduled_courses_teacher"
    )
    student_class = models.ForeignKey(
        Class, on_delete=models.PROTECT, related_name="scheduled_courses_class"
    )

    # Informations temporelles précises
    start_datetime = models.DateTimeField() # Date et heure de début
    end_datetime = models.DateTimeField()   # Date et heure de fin
    
    # [MODIFIÉ] Ajout du champ status
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='ACTIVE',
        db_index=True # Ajout d'un index pour accélérer les filtrages sur le statut
    )

    # Métadonnées
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_courses"
    ) # Assurez-vous d'importer le modèle User
    
    year = models.ForeignKey(
        Year, on_delete=models.PROTECT, related_name="scheduled_courses_year"
    ) 
    
    def __str__(self):
        # Amélioration du __str__ pour inclure le statut
        return f"{self.teacher_subject} - {self.student_class} ({self.start_datetime.strftime('%Y-%m-%d %H:%M')}) [{self.status}]"

