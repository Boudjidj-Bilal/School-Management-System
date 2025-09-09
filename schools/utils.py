from django.core.exceptions import ObjectDoesNotExist

# Import des modèles locaux et liés
from .models import School, Year, ExceptionDay, ExceptionTime, TermYearLevel
from users.utils import get_super_admin
from classes.models import Level
from django.db.models import QuerySet

"""
    Ce fichier centralise les fonctions utilitaires de l'application 'schools'.

    Il agit comme une couche de service entre les vues et les modèles/managers.
    Cela permet de séparer la logique métier de la logique de l'API,
    rendant le code plus propre, plus maintenable et plus facile à tester.
"""

"""
====================
GESTION DES ECOLES :
====================
"""

def create_school(name, address, type, email, super_admin_id, phone_number=None):
    """
    Crée et enregistre une nouvelle école.
    Args:
        name (str): Le nom de l'école.
        address (str): L'adresse de l'école.
        type_id (int): L'ID du type d'école.
        email (str): L'email de l'école.
        super_admin_id (int): L'ID du super administrateur.
        phone_number (str, optional): Le numéro de téléphone.
    Returns:
        tuple: (School, str) - L'objet école créé ou un message d'erreur.
    """
    try:
        super_admin = get_super_admin(super_admin_id)
        
        if School.objects.filter(email=email).exists():
            return None, "Une école avec cet email existe déjà."
            
        school = School.objects.create(
            name=name,
            address=address,
            type=type,
            email=email,
            super_administrator=super_admin,
            phone_number=phone_number
        )
        return school, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur de données : {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de l'école : {str(e)}"

def get_school_by_id(school_id):
    """
    Récupère une école par son ID.
    Args:
        school_id (int): L'ID de l'école.
    Returns:
        School: L'objet école ou None si non trouvé.
    """
    try:
        return School.objects.get(id=school_id)
    except School.DoesNotExist:
        return None

def get_all_schools():
    """
    Récupère toutes les écoles.
    Returns:
        QuerySet: Un QuerySet de tous les objets School.
    """
    return School.objects.all()

def get_schools_by_type(type):
    """
    Récupère les écoles par type.
    Args:
        type_id (int): Le type d'école.
    Returns:
        QuerySet: Un QuerySet des objets School correspondants.
    """
    try:
        return School.objects.filter(type=type)
    except:
        return School.objects.none()

def update_school(school_id, **kwargs):
    """
    Met à jour les informations d'une école.
    Args:
        school_id (int): L'ID de l'école à mettre à jour.
        kwargs (dict): Les champs à mettre à jour.
    Returns:
        tuple: (School, str) - L'objet école mis à jour ou un message d'erreur.
    """
    try:
        school = School.objects.get(id=school_id)
        for key, value in kwargs.items():
            setattr(school, key, value)
        school.save()
        return school, None
    except School.DoesNotExist:
        return None, "École non trouvée."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de l'école : {str(e)}"

def deactivate_school(school_id):
    """
    Désactive une école en définissant son statut 'is_active' sur False.
    Args:
        school_id (int): L'ID de l'école à désactiver.
    Returns:
        tuple: (School, bool) - L'objet école désactivée et un booléen de réussite.
    """
    try:
        school = School.objects.get(id=school_id)
        school.is_active = False
        school.save()
        return school, True
    except School.DoesNotExist:
        return "École non trouvée.", False
    except Exception as e:
        return f"Erreur lors de la désactivation de l'école : {str(e)}", False


def activate_school(school_id):
    """
    Active une école en définissant son statut 'is_active' sur True.
    Args:
        school_id (int): L'ID de l'école à activer.
    Returns:
        tuple: (School, bool) - L'objet école activée et un booléen de réussite.
    """
    try:
        school = School.objects.get(id=school_id)
        school.is_active = True
        school.save()
        return school, True
    except School.DoesNotExist:
        return "École non trouvée.", False
    except Exception as e:
        return f"Erreur lors de l'activation de l'école : {str(e)}", False

def delete_school(school_id):
    """
    Supprime un objet School.
    Args:
        school_id (int): L'ID de l'école à supprimer.
    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        school = School.objects.get(id=school_id)
        school.delete()
        return True
    except School.DoesNotExist:
        return False

"""
====================
GESTION DES ANNEES :
====================
"""

def create_year(name, start_date, end_date, min_time, max_time, school_id, term_type, **kwargs):
    """
    Crée et enregistre une nouvelle année scolaire.
    Args:
        name (str): Le nom de l'année (ex: 2024-2025).
        start_date (datetime): La date de début de l'année.
        end_date (datetime): La date de fin de l'année.
        min_time (time): L'horaire minimum de la journée.
        max_time (time): L'horaire maximum de la journée.
        school_id (int): L'ID de l'école.
        term_type (str): Le type de découpage (ex: 'TRIMESTRE').
        **kwargs: Champs supplémentaires pour l'année.
    Returns:
        tuple: (Year, str) - L'objet Year créé ou un message d'erreur.
    """
    try:
        school = School.objects.get(id=school_id)
        
        # S'assurer qu'une seule année est 'current' par école
        if kwargs.get('current', False):
            Year.objects.filter(school=school, current=True).update(current=False)

        year = Year.objects.create(
            name=name,
            start_date=start_date,
            end_date=end_date,
            min_time=min_time,
            max_time=max_time,
            school=school,
            term_type=term_type,
            **kwargs
        )
        return year, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur de données : {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de l'année : {str(e)}"


def get_year_by_id(year_id):
    """
    Récupère une année par son ID.
    Args:
        year_id (int): L'ID de l'année.
    Returns:
        Year: L'objet année ou None si non trouvé.
    """
    try:
        return Year.objects.get(id=year_id)
    except Year.DoesNotExist:
        return None

def get_years_by_school(school_id : int) -> QuerySet:
    """
    Récupère des années par leur école.
    Args:
        school_id (int): L'ID de l'école.
    Returns:
        QuerySet: Un QuerySet des objets Year correspondants.
    """
    try:
        obj_school = School.objects.get(id=school_id)
        years = Year.objects.filter(school=obj_school)
        return years
    except Exception:
        return Year.objects.none()


def update_year(year_id, **kwargs):
    """
    Met à jour les informations d'une année.
    Args:
        year_id (int): L'ID de l'année à mettre à jour.
        kwargs (dict): Les champs à mettre à jour.
    Returns:
        tuple: (Year, str) - L'objet année mis à jour ou un message d'erreur.
    """
    try:
        year = Year.objects.get(id=year_id)
        for key, value in kwargs.items():
            setattr(year, key, value)
        year.save()
        return year, None
    except Year.DoesNotExist:
        return None, "Année non trouvée."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de l'année : {str(e)}"

def delete_year(year_id):
    """
    Supprime un objet Year.
    Args:
        year_id (int): L'ID de l'année à supprimer.
    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        year = Year.objects.get(id=year_id)
        year.delete()
        return True
    except Year.DoesNotExist:
        return False

def advance_year_stage(year_id):
    """
    Fait avancer l'année scolaire d'une étape à la suivante (séquentielle).
    S'assure qu'un seul champ d'état (creation, registration, etc.) est True à la fois.
    Args:
        year_id (int): L'ID de l'année à faire avancer.
    Returns:
        tuple: (Year, str) - L'objet année mis à jour ou un message d'erreur.
    """
    try:
        year = Year.objects.get(id=year_id)
        
        if year.creation:
            year.creation = False
            year.registration = True
        elif year.registration:
            year.registration = False
            year.running = True 
            # Lorsque l'année se lance on créer tous les 1er trimesre ou semestre pour tout les niveaux
            levels = Level.objects.filter(school=year.school)
            for level in levels:
                # On créer tous les premiers trimestre ou semestre de l'année :
                create_term_year_level(1, year_id, level.id, start_date=None, end_date=None)
        elif year.running:
            year.running = False
            year.end_year = True
        elif year.end_year:
            year.end_year = False
            year.finished = True
        else:
            return None, "L'année est déjà terminée ou dans un état invalide."
            
        year.save()
        return year, None
    except Year.DoesNotExist:
        return None, "Année non trouvée."
    except Exception as e:
        return None, f"Erreur lors de l'avancement de l'étape de l'année : {str(e)}"

def get_school_by_year_id(year_id):
    """
    Récupère l'école associée à une année scolaire.
    Args:
        year_id (int): L'ID de l'année scolaire.
    Returns:
        School: L'objet école associé ou None si l'année n'est pas trouvée.
    """
    try:
        year = Year.objects.get(id=year_id)
        return year.school
    except Year.DoesNotExist:
        return None

"""
==============================
GESTION DES JOURS EXCEPTIONS :
==============================
"""

def create_exception_day(start_date, end_date, type, year_id):
    """
    Crée et enregistre une nouvelle exception dans le calendrier scolaire.
    Args:
        start_date (date): La date de début de l'exception.
        end_date (date): La date de fin de l'exception.
        type (str): Le type de l'exception (vacances, jour férié, etc.).
        year_id (int): L'ID de l'année scolaire à laquelle l'exception est liée.
    Returns:
        tuple: (ExceptionDay, str) - L'objet ExceptionDay créé ou un message d'erreur.
    """
    try:
        year = Year.objects.get(id=year_id)
        exception_day = ExceptionDay.objects.create(
            start_date=start_date,
            end_date=end_date,
            type=type,
            year=year
        )
        return exception_day, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur de données : {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de l'exception : {str(e)}"

def get_exception_day_by_id(exception_day_id):
    """
    Récupère une exception par son ID.
    Args:
        exception_day_id (int): L'ID de l'exception.
    Returns:
        ExceptionDay: L'objet exception ou None si non trouvé.
    """
    try:
        return ExceptionDay.objects.get(id=exception_day_id)
    except ExceptionDay.DoesNotExist:
        return None

def update_exception_day(exception_day_id, **kwargs):
    """
    Met à jour les informations d'une exception.
    Args:
        exception_day_id (int): L'ID de l'exception à mettre à jour.
        kwargs (dict): Les champs à mettre à jour.
    Returns:
        tuple: (ExceptionDay, str) - L'objet exception mis à jour ou un message d'erreur.
    """
    try:
        exception_day = ExceptionDay.objects.get(id=exception_day_id)
        for key, value in kwargs.items():
            setattr(exception_day, key, value)
        exception_day.save()
        return exception_day, None
    except ExceptionDay.DoesNotExist:
        return None, "Exception non trouvée."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de l'exception : {str(e)}"

def delete_exception_day(exception_day_id):
    """
    Supprime un objet ExceptionDay.
    Args:
        exception_day_id (int): L'ID de l'exception à supprimer.
    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        exception_day = ExceptionDay.objects.get(id=exception_day_id)
        exception_day.delete()
        return True
    except ExceptionDay.DoesNotExist:
        return False

"""
===============================
GESTION DES HEURES EXCEPTIONS :
===============================
"""

# Seulement si le proviseur souhaite mettre un temps de pause pour toute l'année commun à toutes les classes de son école.
def create_exception_time(start_time, end_time, year_id):
    """
    Crée et enregistre une nouvelle exception horaire.
    Args:
        start_time (time): L'heure de début de l'exception.
        end_time (time): L'heure de fin de l'exception.
        year_id (int): L'ID de l'année scolaire à laquelle l'exception est liée.
    Returns:
        tuple: (ExceptionTime, str) - L'objet ExceptionTime créé ou un message d'erreur.
    """
    try:
        year = Year.objects.get(id=year_id)
        exception_time = ExceptionTime.objects.create(
            start_time=start_time,
            end_time=end_time,
            year=year
        )
        return exception_time, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur de données : {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création de l'exception horaire : {str(e)}"

def get_exception_time_by_id(exception_time_id):
    """
    Récupère une exception horaire par son ID.
    Args:
        exception_time_id (int): L'ID de l'exception horaire.
    Returns:
        ExceptionTime: L'objet exception horaire ou None si non trouvé.
    """
    try:
        return ExceptionTime.objects.get(id=exception_time_id)
    except ExceptionTime.DoesNotExist:
        return None

def update_exception_time(exception_time_id, **kwargs):
    """
    Met à jour les informations d'une exception horaire.
    Args:
        exception_time_id (int): L'ID de l'exception horaire à mettre à jour.
        kwargs (dict): Les champs à mettre à jour.
    Returns:
        tuple: (ExceptionTime, str) - L'objet exception horaire mis à jour ou un message d'erreur.
    """
    try:
        exception_time = ExceptionTime.objects.get(id=exception_time_id)
        for key, value in kwargs.items():
            setattr(exception_time, key, value)
        exception_time.save()
        return exception_time, None
    except ExceptionTime.DoesNotExist:
        return None, "Exception horaire non trouvée."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour de l'exception horaire : {str(e)}"

def delete_exception_time(exception_time_id):
    """
    Supprime un objet ExceptionTime.
    Args:
        exception_time_id (int): L'ID de l'exception horaire à supprimer.
    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        exception_time = ExceptionTime.objects.get(id=exception_time_id)
        exception_time.delete()
        return True
    except ExceptionTime.DoesNotExist:
        return False


def create_term_year_level(counter, year_id, level_id, start_date=None, end_date=None):
    """
    Crée et enregistre un nouveau trimestre/semestre pour une année et un niveau donnés.
    Args:
        counter (int): Le numéro du trimestre/semestre (1, 2 ou 3).
        year_id (int): L'ID de l'année scolaire.
        level_id (int): L'ID du niveau scolaire.
        start_date (date, optional): La date de début.
        end_date (date, optional): La date de fin.
    Returns:
        tuple: (TermYearLevel, str) - L'objet créé ou un message d'erreur.
    """
    try:
        year = Year.objects.get(id=year_id)
        level = Level.objects.get(id=level_id)
        
        # Marque le trimestre/semestre précédent comme terminé, si un existe
        # et s'il est pour la même année et le même niveau.
        TermYearLevel.objects.filter(
            year=year,
            level=level,
            finished=False
        ).update(finished=True)

        term_year_level = TermYearLevel.objects.create(
            counter=counter,
            year=year,
            level=level,
            start_date=start_date,
            end_date=end_date,
            finished=False
        )
        return term_year_level, None
    except ObjectDoesNotExist as e:
        return None, f"Erreur de données : {str(e)}"
    except Exception as e:
        return None, f"Erreur lors de la création du trimestre/semestre : {str(e)}"


def get_term_year_level_by_id(term_id):
    """
    Récupère un trimestre/semestre par son ID.
    Args:
        term_id (int): L'ID du trimestre/semestre.
    Returns:
        TermYearLevel: L'objet ou None si non trouvé.
    """
    try:
        return TermYearLevel.objects.get(id=term_id)
    except TermYearLevel.DoesNotExist:
        return None


def update_term_year_level(term_id, **kwargs):
    """
    Met à jour les informations d'un trimestre/semestre.
    Args:
        term_id (int): L'ID du trimestre/semestre à mettre à jour.
        kwargs (dict): Les champs à mettre à jour.
    Returns:
        tuple: (TermYearLevel, str) - L'objet mis à jour ou un message d'erreur.
    """
    try:
        term = TermYearLevel.objects.get(id=term_id)
        for key, value in kwargs.items():
            setattr(term, key, value)
        term.save()
        return term, None
    except TermYearLevel.DoesNotExist:
        return None, "Trimestre/semestre non trouvé."
    except Exception as e:
        return None, f"Erreur lors de la mise à jour : {str(e)}"


def delete_term_year_level(term_id):
    """
    Supprime un objet TermYearLevel.
    Args:
        term_id (int): L'ID du trimestre/semestre à supprimer.
    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        term = TermYearLevel.objects.get(id=term_id)
        term.delete()
        return True
    except TermYearLevel.DoesNotExist:
        return False


def get_current_term_for_level(year_id, level_id):
    """
    Récupère le trimestre/semestre en cours (finished=False) pour un niveau et une année donnés.
    Args:
        year_id (int): L'ID de l'année scolaire.
        level_id (int): L'ID du niveau scolaire.
    Returns:
        TermYearLevel: L'objet en cours ou None si non trouvé.
    """
    try:
        return TermYearLevel.objects.get(year_id=year_id, level_id=level_id, finished=False)
    except TermYearLevel.DoesNotExist:
        return None



def finish_all_terms_for_level(year_id, level_id):
    """
    Marque tous les trimestres/semestres d'un niveau donné pour une année comme terminés.
    Args:
        year_id (int): L'ID de l'année scolaire.
        level_id (int): L'ID du niveau scolaire.
    Returns:
        tuple: (int, str) - Le nombre de termes mis à jour ou un message d'erreur.
    """
    try:
        # Utilise filter().update() pour une mise à jour efficace de la base de données
        updated_count = TermYearLevel.objects.filter(
            year_id=year_id,
            level_id=level_id,
            finished=False
        ).update(finished=True)
        
        return updated_count, None
    except Exception as e:
        return 0, f"Erreur lors de la mise à jour des termes : {str(e)}"


def advance_term_for_level(year_id, level_id, start_date=None, end_date=None):
    """
    Avance au trimestre/semestre suivant pour un niveau donné.
    Marque le terme actuel comme terminé et crée le suivant.
    Crée une exception horaire si les heures de début et de fin sont fournies.
    Args:
        year_id (int): L'ID de l'année scolaire.
        level_id (int): L'ID du niveau scolaire.
    Returns:
        tuple: (TermYearLevel, str) - Le nouveau terme ou un message d'erreur.
    """
    try:
        current_term = get_current_term_for_level(year_id, level_id)
        
        level = Level.objects.get(id=level_id)
        term_type = level.term_type
        
        max_counter = 3 if term_type == "TRIMESTRE" else 2
        next_counter = current_term.counter + 1 if current_term else 1
        
        # Vérifie si la création d'un nouveau trimestre/semestre est possible
        if next_counter > max_counter:
            # Mettre à fini le dernier trimestre/semestre
            finish_all_terms_for_level(year_id, level_id)
            return None, f"Le nombre maximum de {term_type.lower()}s a été atteint pour le niveau : "+level.level
            
        new_term, error = create_term_year_level(next_counter, year_id, level_id, start_date, end_date)
        
        if error:
            return None, error
        
        return new_term, None
    except Level.DoesNotExist:
        return None, "Niveau non trouvé."
    except Exception as e:
        return None, f"Erreur lors du passage au trimestre/semestre suivant : {str(e)}"

