from .models import User, SuperAdministrator, Staff, Student, Parent, StaffType
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
import string
import secrets

# Gestion des emails automatique :
from django.core.mail import send_mail
from ProjectSchool.settings import EMAIL_HOST_USER
from smtplib import SMTPException

from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.urls import reverse
from django.utils.encoding import force_bytes, DjangoUnicodeDecodeError
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.db.models import Q

"""
=========================
GESTION DES UTILISATEUR :
=========================
"""

"""
- Ce fichier contient des fonctions utilitaires de haut niveau pour les opérations de l'application `users`.
- Elles utilisent les gestionnaires de modèles (managers) pour interagir avec la base de données, permettant une séparation claire de la logique métier et de la persistance des données.
- Cela rend le code plus propre et plus facile à maintenir.
"""

def create_user(**kwargs):
    """
    Crée un nouvel utilisateur.
    Args:
        **kwargs: Champs de l'utilisateur (username, password, phone_number, etc.).
    Returns:
        tuple: (User, bool) - L'objet utilisateur et un booléen indiquant la réussite.
    Raises:
        ValueError: Si le nom d'utilisateur n'est pas fourni.
    """
    try:
        if "username" not in kwargs:
            raise ValueError("Le nom d'utilisateur est requis.")
        
        user = User.objects.create_user(**kwargs)
        return user, True
    except (ValueError, IntegrityError) as e:
        return str(e), False


def get_user_by_username(username):
    """
    Récupère un utilisateur par son nom d'utilisateur.
    Args:
        username (str): Le nom d'utilisateur.
    Returns:
        User or None: L'objet utilisateur s'il existe, sinon None.
    """
    try:
        return User.objects.get(username=username)
    except ObjectDoesNotExist:
        return None

def get_user_by_id(user_id):
    """
    Récupère un utilisateur par son ID.
    Args:
        user_id (int): L'ID de l'utilisateur.
    Returns:
        User or None: L'objet utilisateur s'il existe, sinon None.
    """
    try:
        return User.objects.get(id=user_id)
    except ObjectDoesNotExist:
        return None

def get_all_users():
    """
    Récupère tous les utilisateurs.
    Returns:
        QuerySet: Un QuerySet contenant tous les objets utilisateurs.
    """
    return User.objects.all()


def update_user(user_id, **kwargs):
    """
    Met à jour un utilisateur.
    Args:
        user_id (int): L'ID de l'utilisateur à mettre à jour.
        **kwargs: Champs à mettre à jour.
    Returns:
        tuple: (User, bool) - L'objet utilisateur mis à jour et un booléen indiquant la réussite.
    """
    try:
        user = User.objects.get(id=user_id)
        for key, value in kwargs.items():
            setattr(user, key, value)
        user.save()
        return user, True
    except ObjectDoesNotExist:
        return "Utilisateur non trouvé.", False

def deactivate_user(user_id):
    """
    Désactive un utilisateur en définissant son statut 'is_active' sur False.
    Args:
        user_id (int): L'ID de l'utilisateur à désactiver.
    Returns:
        tuple: (User, bool) - L'objet utilisateur désactivé et un booléen indiquant la réussite.
    """
    try:
        user = User.objects.get(id=user_id)
        user.is_active = False
        user.save()
        return user, True
    except ObjectDoesNotExist:
        return "Utilisateur non trouvé.", False
    
def activate_user(user_id):
    """
    Active un compte utilisateur en définissant son statut 'is_active' sur True.
    Args:
        user_id (int): L'ID de l'utilisateur à activer.
    Returns:
        tuple: (User, bool) - L'objet utilisateur activé et un booléen indiquant la réussite.
    """
    try:
        user = User.objects.get(id=user_id)
        user.is_active = True
        user.save()

        return user, True
    except User.DoesNotExist:
        return "Utilisateur non trouvé.", False

def login_user(request, username, password):
    """
    Authentifie et connecte un utilisateur.
    Args:
        request: L'objet de requête HTTP.
        username (str): Le nom d'utilisateur.
        password (str): Le mot de passe.
    Returns:
        User or None: L'objet utilisateur si l'authentification est réussie, sinon None.
    """
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return user
    return None

def logout_user(request):
    """
    Déconnecte l'utilisateur actuellement connecté.
    Args:
        request: L'objet de requête HTTP.
    Returns:
        None
    """
    logout(request)

def update_user_session(request, user):
    """
    Met à jour la session après un changement de mot de passe.
    Cela prévient la déconnexion après un changement de mot de passe.
    Args:
        request (HttpRequest): L'objet requête de Django.
        user (User): L'objet utilisateur.
    """
    update_session_auth_hash(request, user)

def change_user_password(user_id, new_password):
    """
    Change le mot de passe d'un utilisateur.
    Args:
        user (User): L'objet utilisateur.
        new_password (str): Le nouveau mot de passe.
    Returns:
        User: L'objet utilisateur mis à jour.
    """
    user = User.objects.get(id=user_id)
    user.set_password(new_password)
    user.save()
    return user

def send_email(subject, message, recipient_list):
    """
    Envoie un email en utilisant la configuration de Django.
    Args:
        subject (str): Le sujet de l'email.
        message (str): Le corps de l'email.
        recipient_list (list): Liste des destinataires.
    Returns:
        bool: True si l'envoi est réussi, False sinon.
    """
    try:
        send_mail(
            subject,
            message,
            EMAIL_HOST_USER, # Utilise l'expéditeur configuré dans settings.py
            recipient_list,
            fail_silently=False, # Lève une exception si l'envoi échoue
        )
        return True
    except SMTPException as e:
        print(f"Erreur d'envoi d'email: {e}")
        return False


def generate_random_password(length: int = 8, include_digits: bool = True, include_special_chars: bool = True) -> str:
    """
    Génère un mot de passe aléatoire.
    Args:
        length (int): La longueur du mot de passe.
        include_digits (bool): Inclut des chiffres si True.
        include_special_chars (bool): Inclut des caractères spéciaux si True.
    Returns:
        str: Le mot de passe généré.
    """
    
    characters = string.ascii_letters
    if include_digits:
        characters += string.digits
    if include_special_chars:
        characters += string.punctuation
    
    password = ''.join(secrets.choice(characters) for i in range(length))
    return password


def send_password_reset_link(user, domain, protocol):
    """
    Génère un token sécurisé et envoie un e-mail avec un lien de réinitialisation.
    Args:
        user (User): L'utilisateur pour lequel le mot de passe doit être réinitialisé.
        domain (str): Le domaine de l'application (ex: 'localhost:8000').
        protocol (str): Le protocole (ex: 'http' ou 'https').
    Returns:
        bool: True si l'envoi est réussi, False sinon.
    """
    token = PasswordResetTokenGenerator().make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    reset_url = reverse('password_reset_confirm', kwargs={'uidb64': uid, 'token': token})
    reset_link = f"{protocol}://{domain}{reset_url}" # TODO : Voir protocol et domain ?? Vérifier si sa fonctionne et/ou comment?. Si cela retourne bien vers la page voulue.
    subject = "Réinitialisation de votre mot de passe"
    message = f"""
    Bonjour,

    Vous avez demandé la réinitialisation de votre mot de passe.
    Veuillez utiliser le lien suivant pour créer un nouveau mot de passe :

    {reset_link}

    Ce lien est valide pendant 3 jours. Pour des raisons de sécurité, ne le partagez avec personne.

    Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.
    """
    return send_email(subject, message, [user.email])


def reset_password_with_token(uidb64, token, new_password):
    """
    Vérifie la validité du token et de l'utilisateur, puis change le mot de passe.
    Args:
        uidb64 (str): L'ID utilisateur encodé.
        token (str): Le token de réinitialisation.
        new_password (str): Le nouveau mot de passe.
    Returns:
        bool: True si la réinitialisation est réussie, False sinon.
    """
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, DjangoUnicodeDecodeError, User.DoesNotExist):
        return False
    
    if user is not None and PasswordResetTokenGenerator().check_token(user, token):
        user.set_password(new_password)
        user.save()
        return True
    
    return False


def search_users(query):
    """
    Recherche des utilisateurs par nom d'utilisateur, prénom, nom ou email.
    Args:
        query (str): La chaîne de caractères à rechercher.
    Returns:
        QuerySet: Un QuerySet d'utilisateurs correspondants.
    """
    if not query:
        return User.objects.all()
   
    """
    La fonction ne lève pas d'erreur. Si un utilisateur n'a pas de nom, de prénom ou d'email,
    la recherche sur ce champ en particulier ne renverra aucun résultat pour cet utilisateur,
    mais la requête continuera à chercher dans les autres champs.
    """

    users = User.objects.filter(
        Q(username__icontains=query) |
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query) |
        Q(email__icontains=query)
    ).distinct()

    return users


"""
==================================
GESTION DES SUPER ADMINISTRATEUR :
==================================
"""


def create_super_admin(user_id):
    """
    Crée un objet SuperAdministrator pour un utilisateur existant.
    Args:
        user_id (int): L'ID de l'utilisateur.
    Returns:
        tuple: (SuperAdministrator, bool) - L'objet créé et un booléen de réussite.
    """
    try:
        user = User.objects.get(id=user_id)
        if SuperAdministrator.objects.filter(user=user).exists():
            return "Cet utilisateur est déjà un super administrateur.", False
        
        super_admin = SuperAdministrator.objects.create(user=user)
        return super_admin, True
    except User.DoesNotExist:
        return "Utilisateur non trouvé.", False

def get_super_admin(user_id):
    """
    Récupère un objet SuperAdministrator par l'ID de l'utilisateur.
    Args:
        user_id (int): L'ID de l'utilisateur.
    Returns:
        SuperAdministrator: L'objet SuperAdministrator ou None.
    """
    try:
        return SuperAdministrator.objects.get(user__id=user_id)
    except SuperAdministrator.DoesNotExist:
        return None

def get_all_super_admin():
    """
    Récupère tous les supers administrateurs.
    Returns:
        QuerySet: Un QuerySet contenant tous les objets supers administrateurs.
    """
    return SuperAdministrator.objects.all()


"""
======================
GESTION DU PERSONNEL :
======================
"""


def create_staff(user, staff_type, school, gender, birth_date=None):
    """
    Crée un nouvel objet Staff lié à un utilisateur existant.
    Args:
        user_id (int): L'ID de l'utilisateur à lier.
        staff_type (StaffType): Le type de personnel.
        school_id (int): L'ID de l'école de rattachement.
        gender (str): Le genre du personnel.
        birth_date (date, optional): La date de naissance du personnel.
    Returns:
        tuple: (Staff, str) - L'objet Staff créé ou un message d'erreur.
    """
    try:
        if Staff.objects.filter(user=user).exists():
            return None, "Cet utilisateur est déjà lié à un membre du personnel."
        staff = Staff.objects.create(
            user=user,
            staff_type=staff_type,
            school=school,
            gender=gender,
            birth_date=birth_date
        )
        return staff, None
    except Exception as e:
        return None, str(e)
    
def get_all_staff():
    """
    Récupère tous les membres du personnel.
    Returns:
        QuerySet: Un QuerySet de tous les objets Staff.
    """
    return Staff.objects.all()


def get_staff_by_id(staff_id):
    """
    Récupère un objet Staff par son ID.
    Args:
        staff_id (int): L'ID de l'objet Staff.
    Returns:
        Staff: L'objet Staff ou None s'il n'existe pas.
    """
    try:
        return Staff.objects.get(id=staff_id)
    except Staff.DoesNotExist:
        return None
    
def get_staff_by_type(staff_type_id):
    """
    Récupère tous les membres du personnel d'un type donné.
    Args:
        staff_type_id (int): L'ID du type de personnel.
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(staff_type__id=staff_type_id)

def get_staff_by_gender_and_type(gender, staff_type_id):
    """
    Récupère les membres du personnel en fonction du genre et du type.
    Args:
        gender (str): Le genre du personnel ('M' ou 'F').
        staff_type_id (int): L'ID du type de personnel.
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(gender=gender, staff_type__id=staff_type_id)

def update_staff(staff_id, **kwargs):
    """
    Met à jour les informations d'un membre du personnel.
    Args:
        staff_id (int): L'ID de l'objet Staff à mettre à jour.
        kwargs (dict): Les champs à mettre à jour.
    Returns:
        tuple: (Staff, str) - L'objet Staff mis à jour ou un message d'erreur.
    """
    try:
        staff = Staff.objects.get(id=staff_id)
        for key, value in kwargs.items():
            setattr(staff, key, value)
        staff.save()
        return staff, None
    except Staff.DoesNotExist:
        return None, "Membre du personnel non trouvé."
    except Exception as e:
        return None, str(e)

def get_all_staff_school(school_id):
    """
    Récupère tous les membres du personnel d'une école donnée.
    Args:
        school_id (int): L'ID de l'école.
    Returns:
        QuerySet: Un QuerySet des objets Staff de l'école.
    """
    return Staff.objects.filter(school__id=school_id)

def get_staff_by_type_school(school_id, staff_type_id):
    """
    Récupère les membres du personnel d'une école par type.
    Args:
        school_id (int): L'ID de l'école.
        staff_type_id (int): L'ID du type de personnel.
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(school__id=school_id, staff_type__id=staff_type_id)

def get_staff_by_gender_and_type_school(school_id, gender, staff_type_id):
    """
    Récupère les membres du personnel d'une école en fonction du genre et du type.
    Args:
        school_id (int): L'ID de l'école.
        gender (str): Le genre du personnel ('M' ou 'F').
        staff_type_id (int): L'ID du type de personnel.
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(school__id=school_id, gender=gender, staff_type__id=staff_type_id)

"""
=======================
GESTION DES ETUDIANTS :
=======================
"""

def create_student(user_id, school_id, gender, birth_date=None):
    """
    Crée un nouvel objet Student lié à un utilisateur existant.
    Args:
        user_id (int): L'ID de l'utilisateur à lier.
        school_id (int): L'ID de l'école de rattachement.
        gender (str): Le genre de l'élève.
        birth_date (date, optional): La date de naissance de l'élève.
    Returns:
        tuple: (Student, str) - L'objet Student créé ou un message d'erreur.
    """
    try:
        user = User.objects.get(id=user_id)
        # Import local pour éviter les dépendances circulaires
        from schools.models import School
        school = School.objects.get(id=school_id)
        if Student.objects.filter(user=user).exists():
            return None, "Cet utilisateur est déjà lié à un élève."
        student = Student.objects.create(
            user=user,
            school=school,
            gender=gender,
            birth_date=birth_date
        )
        return student, None
    except User.DoesNotExist:
        return None, "Utilisateur non trouvé."
    except ObjectDoesNotExist:
        return None, "École non trouvée."
    except Exception as e:
        return None, str(e)

def get_student_by_id(student_id):
    """
    Récupère un objet Student par son ID.
    Args:
        student_id (int): L'ID de l'objet Student.
    Returns:
        Student: L'objet Student ou None s'il n'existe pas.
    """
    try:
        return Student.objects.get(id=student_id)
    except Student.DoesNotExist:
        return None

def get_all_student():
    """
    Récupère tous les étudiants.
    Returns:
        QuerySet: Un QuerySet de tous les objets Student.
    """
    return Student.objects.all()

def get_all_student_school(school_id):
    """
    Récupère tous les étudiants d'une école donnée.
    Args:
        school_id (int): L'ID de l'école.
    Returns:
        QuerySet: Un QuerySet des objets Student de l'école.
    """
    return Student.objects.filter(school__id=school_id)

def update_student(student_id, **kwargs):
    """
    Met à jour les informations d'un élève.
    Args:
        student_id (int): L'ID de l'objet Student à mettre à jour.
        kwargs (dict): Les champs à mettre à jour.
    Returns:
        tuple: (Student, str) - L'objet Student mis à jour ou un message d'erreur.
    """
    try:
        student = Student.objects.get(id=student_id)
        for key, value in kwargs.items():
            setattr(student, key, value)
        student.save()
        return student, None
    except Student.DoesNotExist:
        return None, "Élève non trouvé."
    except Exception as e:
        return None, str(e)

def get_student_by_gender(gender):
    """
    Récupère tous les élèves d'un genre donné.
    Args:
        gender (str): Le genre des élèves ('M' ou 'F').
    Returns:
        QuerySet: Un QuerySet des objets Student correspondants.
    """
    return Student.objects.filter(gender=gender)

def get_student_by_birth_year(year):
    """
    Récupère tous les élèves nés au cours d'une année donnée.
    Args:
        year (int): L'année de naissance.
    Returns:
        QuerySet: Un QuerySet des objets Student correspondants.
    """
    return Student.objects.filter(birth_date__year=year)

def get_student_by_gender_school(school_id, gender):
    """
    Récupère tous les élèves d'un genre donné en fonction d'une école.
    Args:
        gender (str): Le genre des élèves ('M' ou 'F').
        school_id (int): L'ID de l'école.    
    Returns:
        QuerySet: Un QuerySet des objets Student correspondants.
    """
    return Student.objects.filter(school__id=school_id, gender=gender)

def get_student_by_birth_year_school(school_id, year):
    """
    Récupère tous les élèves nés au cours d'une année donnée en fonction d'une école.
    Args:
        year (int): L'année de naissance.     
        school_id (int): L'ID de l'école.    
    Returns:
        QuerySet: Un QuerySet des objets Student correspondants.
    """
    return Student.objects.filter(school__id=school_id,birth_date__year=year)

"""
=======================
GESTION DES PARENT :
=======================
"""
### code
"""
=======================
GESTION DES ENFANT :
=======================
"""
### code