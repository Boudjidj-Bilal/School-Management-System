from django.db import models
from schools.models import TermYearLevel
from users.models import Student, Staff
from classes.models import Class

from django.utils.translation import gettext_lazy as _

# --> 1. La Feuille d'Appel (Le contenant)
class AttendanceSession(models.Model):
    teacher = models.ForeignKey(
        Staff, on_delete=models.CASCADE, related_name="attendance_sessions"
    ) # Le prof qui fait l'appel
    
    student_class = models.ForeignKey(
        Class, on_delete=models.CASCADE, related_name="attendance_sessions"
    ) # La classe concernée
    
    term_year = models.ForeignKey(
        TermYearLevel, on_delete=models.CASCADE, related_name="attendance_sessions"
    ) # Pour filtrer par trimestre facilement

    date = models.DateField() # Date du cours
    start_time = models.TimeField() # Heure début
    end_time = models.TimeField()   # Heure fin

    date_created = models.DateTimeField(auto_now_add=True) # Pour savoir quand l'appel a été saisi

    class Meta:
        # On trie par date décroissante (le plus récent en haut)
        ordering = ['-date', '-start_time']

    def __str__(self):
        return _("Appel {student_class} - {self.teacher} ({self.date})").format(student_class=self.student_class, teacher=self.teacher, date=self.date)


# --> 2. L'Absence ou le Retard (Le contenu)
class Attendance(models.Model):
    ATTENDANCE_CHOICES = [
        ("DELAY", _("Retard")),
        ("ABSENCE", _("Absence")),
    ]

    session = models.ForeignKey(
        AttendanceSession, on_delete=models.CASCADE, related_name="attendances"
    ) # Lien vers la feuille d'appel
    
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name="attendances"
    ) # L'élève concerné

    status = models.CharField(max_length=10, choices=ATTENDANCE_CHOICES) # Type (Absence ou Retard)
    
    # Gestion de la justification (CPE)
    justified = models.BooleanField(default=False) # Par défaut, injustifié
    justification_reason = models.TextField(blank=True, null=True, help_text=_("Motif donné par le CPE"))
    justification_date = models.DateField(blank=True, null=True) # Date de la justification

    class Meta:
        # Un élève ne peut avoir qu'un seul statut (soit absent, soit en retard) pour une même session d'appel
        unique_together = ("session", "student")

    def __str__(self):
        return f"{self.get_status_display()} - {self.student} ({self.session.date})"