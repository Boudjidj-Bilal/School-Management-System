# school/models.py
from django.db import models
from users.models import SuperAdministrator


class TypeSchool(models.Model):
    name = models.CharField(max_length=200)           # type d'école (ex: lycée, collège…)

    def __str__(self):
        return self.name

# --> Représente une école, liée à un super administrateur
class School(models.Model):
    name = models.CharField(max_length=200)           # nom de l'école
    address = models.TextField()                      # adresse
    created_at = models.DateTimeField(auto_now_add=True)  # date de création
    type = models.ForeignKey(
        TypeSchool, on_delete=models.CASCADE, related_name="type_schools"
    )  # relation Many-to-One avec TypeSchool
    phone_number = models.CharField(max_length=50, blank=True, null=True)  # numéro de téléphone
    email = models.EmailField(unique=True)            # email unique de l'école
    is_active = models.BooleanField(default=True)     # statut actif
    super_administrator = models.ForeignKey(
        "users.SuperAdministrator",  # référence par string (app.Model) afin d'éviter les imports circulaire, 
        on_delete=models.CASCADE, related_name="schools"
    )  # relation Many-to-One avec SuperAdministrator

    def __str__(self):
        return self.name

TERM_TYPE_CHOICES = [
    ("TRIMESTRE", "Trimestre"),
    ("SEMESTRE", "Semestre"),
]

# --> Représente une année scolaire liée à une école
class Year(models.Model):
    
    name = models.CharField(max_length=100)        # nom de l'année (ex: 2024-2025)
    start_date = models.DateTimeField()            # date de début de l'année
    end_date = models.DateTimeField()              # date de fin de l'année
    min_time = models.TimeField()                  # horaire minimum de la journée
    max_time = models.TimeField()                  # horaire maximum de la journée
    
    # États de l'année
    creation = models.BooleanField(default=True)   # état : création et validation
    registration = models.BooleanField(default=False) 
    running = models.BooleanField(default=False)   # état : déroulement en cours
    end_year = models.BooleanField(default=False)  
    finished = models.BooleanField(default=False)  

    school = models.ForeignKey(
        "schools.School", on_delete=models.CASCADE, related_name="years"
    )
    current = models.BooleanField(default=False)   # indique si l'année est actuelle

    # Ajout du type de découpage
    term_type = models.CharField(
        max_length=10,
        choices=TERM_TYPE_CHOICES,
        default="TRIMESTRE"
    )

    def __str__(self):
        return f"{self.name} - {self.school.name}"

# --> Représente une exception dans le calendrier scolaire (vacances, jours fériés…)
class ExceptionDay(models.Model):
    start_date = models.DateField()                               # date de début de l'exception
    end_date = models.DateField()                                 # date de fin de l'exception
    type = models.CharField(max_length=200)                       # type (vacances, jour férié…)
    year = models.ForeignKey(
        Year, on_delete=models.CASCADE, related_name="exception_days"
    )  # relation Many-to-One avec Year

    def __str__(self):
        return f"{self.type} ({self.start_date} - {self.end_date})"


# --> Représente une exception horaire valable toute l'année
class ExceptionTime(models.Model):
    start_time = models.TimeField()                               # heure de début
    end_time = models.TimeField()                                 # heure de fin
    year = models.ForeignKey(
        Year, on_delete=models.CASCADE, related_name="exception_times"
    )  # relation Many-to-One avec Year

    def __str__(self):
        return f"{self.start_time} - {self.end_time} ({self.year.name})"
    

# --> Associe un trimestre/semestre à une année scolaire
class TermYear(models.Model):
    COUNTER_CHOICES = [
        (1, "1"),
        (2, "2"),
        (3, "3"),
    ]
    counter = models.IntegerField(choices=COUNTER_CHOICES)  # numéro limité : 1, 2 ou 3
    year = models.ForeignKey(
        Year, on_delete=models.CASCADE, related_name="term_years"
    )  # relation Many-to-One avec Year
    start_date = models.DateField(null=True)       # date de début
    end_date = models.DateField(null=True)         # date de fin
    finished = models.BooleanField(default=False)  # état : terminé

    def __str__(self):
        return f"{self.counter} - {self.year.name}"