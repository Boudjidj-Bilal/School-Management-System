import os
from django.conf import settings
from .models import User, SuperAdministrator, Staff, Student, Parent, Child
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash, get_user_model
import string
import secrets
from django.core.serializers.json import DjangoJSONEncoder


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
- Ce fichier contient des fonctions utilitaires de haut niveau pour les opérations de l'application `users`.
- Elles utilisent les gestionnaires de modèles (managers) pour interagir avec la base de données, permettant une séparation claire de la logique métier et de la persistance des données.
- Cela rend le code plus propre et plus facile à maintenir.
"""

"""
=========================
GESTION DES UTILISATEUR :
=========================
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
        # Vérifie si le nom d'utilisateur est fourni
        if "username" not in kwargs or not kwargs["username"]:
            raise ValueError("Le nom d'utilisateur est requis.")
        
        # Si un email est fourni, vérifie qu'il n'est pas déjà utilisé
        email = kwargs.get("email")
        if email:
            if User.objects.filter(email__iexact=email).exists():
                return "Un utilisateur avec cet email existe déjà.", False
        
        # Crée l'utilisateur si tout est valide
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
        user = User.objects.get(username=username)
        return user
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
    
def is_email_unique(email):
    """
    Vérifie si un email existe déjà dans la base de données.
    Args:
        email (str): L'adresse email à vérifier.
    Returns:
        bool: True si l'email n'existe pas encore, False sinon.
    """
    try:
        User.objects.get(email=email)
        # Si un utilisateur est trouvé, l'email existe déjà
        return True
    except User.DoesNotExist:
        # Si aucun utilisateur n'est trouvé, l'email est unique
        return False
    except Exception as e:
        # Gère les autres erreurs potentielles
        print(f"Une erreur s'est produite lors de la vérification de l'email : {e}")
        return True

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
    username2 = get_user_by_username(username)
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
    Change le mot de passe d'un utilisateur après avoir validé sa longueur.
    
    Args:
        user_id (int): L'ID de l'utilisateur.
        new_password (str): Le nouveau mot de passe.
        
    Returns:
        tuple: (bool, str) - Un tuple indiquant si l'opération a réussi et
               un message d'information.
    """
    # Vérifie que le mot de passe a au moins 4 caractères
    if len(new_password) < 4:
        return False, "Le mot de passe doit contenir au moins 4 caractères."
    
    try:
        # Récupère l'utilisateur par son ID
        user = User.objects.get(id=user_id)
        
        # Définit le nouveau mot de passe en utilisant la méthode de Django
        # pour s'assurer qu'il est haché et sécurisé.
        user.set_password(new_password)
        
        # Sauvegarde les modifications dans la base de données
        user.save()
        
        return True, "Mot de passe mis à jour avec succès."
        
    except User.DoesNotExist:
        # Gère le cas où l'utilisateur n'existe pas
        return False, "Utilisateur non trouvé."


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
        if isinstance(recipient_list, str):
            recipient_list = [recipient_list]

        from_email = settings.DEFAULT_FROM_EMAIL

        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,  # On veut lever une exception
        )
        return True
    except SMTPException as e:
        print(f"Erreur d'envoi d'email: {e}")
        return False
    
def send_email_create_compte(request, email, username, password):
    """
    Envoie un email de notification à l'utilisateur pour l'informer que son compte a été créé.

    Args:
        request : L'objet de requête HTTP.
        email (str): L'adresse email de l'utilisateur.
        username (str): Le nom d'utilisateur généré.
        password (str): Le mot de passe temporaire généré.
    """
    # Sujet de l'email
    subject = "Votre compte a été créé"
    domain = request.get_host()
    protocol = 'https' if request.is_secure() else 'http'
    reset_url = ""
    reset_link = f"{protocol}://{domain}{reset_url}" # TODO : Voir protocol et domain ?? Vérifier si sa fonctionne et/ou comment?. Si cela retourne bien vers la page voulue.
    # TODO Envoie du lien vers la page de connexion 

    # Message de l'email
    # Utilisation d'un f-string pour insérer dynamiquement les informations
    message = f"""
    Bonjour,

    Votre compte utilisateur sur la plateforme de gestion scolaire a été créé.

    Voici vos identifiants temporaires :
    - Nom d'utilisateur : {username}
    - Mot de passe : {password}

    Pour des raisons de sécurité, nous vous demandons de changer votre mot de passe immédiatement après votre première connexion pour un mot de passe plus robuste et sécurisé.

    Vous pouvez vous connecter en utilisant ce lien :
    {reset_link}

    Si vous rencontrez des difficultés, veuillez contacter le support technique.

    Cordialement,

    L'équipe de l'administration
    """

    # Envoi de l'email
    try:
        recipient_list = [email]
        send_email(subject, message, recipient_list)
        print(f"Email envoyé avec succès à {email}")
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email à {email} : {e}")


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
        user, message = change_user_password(user.id, new_password)
        if user:
            return True, message 
        else:
            return False, message
    
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


# -- FONCTION POUR RECUPERER LE TYPE D'UTILISATEUR --
def get_user_type(user):
    """
    Détermine le rôle d'un utilisateur en vérifiant son appartenance à
    différentes classes de profil.
    
    Args:
        user (User): L'objet utilisateur.
        
    Returns:
        str or None: Le type d'utilisateur ('SuperAdministrator', 'Principal', 'Teacher',
               'CPE', 'Administrator', 'Student', 'Parent'), ou None si le rôle n'est pas trouvé.
    """
    
    # Vérifie si l'utilisateur est un SuperAdministrator
    # La relation OneToOneField permet de vérifier l'existence de l'objet lié
    try:
        user.super_administrator_user
        return "SuperAdministrator"
    except get_user_model().super_administrator_user.RelatedObjectDoesNotExist:
        pass  # L'utilisateur n'est pas un SuperAdministrator, on continue

    # Vérifie si l'utilisateur est un Staff
    try:
        staff_member = user.staff_user
        # Utilise le type de personnel pour plus de précision
        return staff_member.get_staff_type_display()
    except get_user_model().staff_user.RelatedObjectDoesNotExist:
        pass  # L'utilisateur n'est pas un Staff, on continue

    # Vérifie si l'utilisateur est un Student
    try:
        user.student_user
        return "Student"
    except get_user_model().student_user.RelatedObjectDoesNotExist:
        pass # L'utilisateur n'est pas un Student, on continue
    
    # Vérifie si l'utilisateur est un Parent
    try:
        user.parent_user
        return "Parent"
    except get_user_model().parent_user.RelatedObjectDoesNotExist:
        pass  # L'utilisateur n'est pas un Parent, on continue
    
    # Si aucun rôle n'est trouvé, retourne None
    return None


def send_emails_for_year_stage(school, year_stape):
    """
    Envoie un email aux utilisateurs concernés d'une école, 
    en fonction de l'étape de l'année scolaire (year_stape).

    Args:
        subject (str): Le sujet de l'email.
        message (str): Le corps de l'email.
        school (School): L'objet École (ForeignKey de Staff) utilisé pour le filtrage.
        year_stape (str): L'étape de l'année ('registration', 'running', etc.).

    Returns:
        bool: True si au moins un email a été envoyé, False sinon.
    """
    recipient_emails = []
    subject = ""
    message = ""

    # 1. Filtrage des utilisateurs basés sur l'étape (year_stape)
    if year_stape == 'registration':
        # Cible : Tous les administrateurs actifs (STAFF_TYPE: PRINCIPAL, ADMINISTRATOR)
        
        # Sujet et message pour l'enregistrement
        subject = f"Année Scolaire. L'étape d'enregistrement commence : {school.name}"
        message = f"""
Cher Administrateur,

L'étape d'enregistrement de la nouvelle année scolaire a officiellement commencé pour l'école {school.name}.

Vous pouvez maintenant vous connecter à la plateforme pour :
1. Valider les inscriptions des nouveaux élèves.
2. Finaliser la configuration des classes et des cours. 
3. Mettre à jour les plannings.

Veuillez procéder aux vérifications nécessaires pour assurer une transition fluide.

Cordialement,
L'Équipe de Gestion.
        """

        # Détermination des types de personnel à cibler pour l'enregistrement
        admin_types = ["PRINCIPAL", "ADMINISTRATOR"]

        # Récupération des membres du personnel de l'école correspondant aux types d'admins
        staff_members = Staff.objects.filter(
            school=school, 
            staff_type__in=admin_types
        ).select_related('user') # Optimisation pour charger les données de l'utilisateur

        # Extraction des emails des utilisateurs actifs
        for staff in staff_members:
            if staff.user.is_active and staff.user.email:
                recipient_emails.append(staff.user.email)
                
    elif year_stape == 'running':
        # Cible : Tous les profs et CPE actifs (STAFF_TYPE: TEACHER, CPE) ainsi que les principal et les administrateurs

        # Sujet et message pour le déroulement en cours
        subject = f"Année Scolaire. Le déroulement normal commence : {school.name}"
        message = f"""
Cher Membre du Personnel (Professeur / CPE / Administrateur),

L'étape de déroulement normal de l'année scolaire est maintenant activée pour l'école {school.name}.

La plateforme est pleinement opérationnelle pour :
1. L'entrée des notes et des appréciations.
2. La gestion des absences et des retards.
3. L'accès aux outils de communication avec les parents et élèves.

Nous vous souhaitons une excellente année !

Cordialement,
L'Administration {school.name}.
        """
        
        # Détermination des types de personnel à cibler pour l'étape en cours
        teaching_staff_types = ["TEACHER", "CPE", "ADMINISTRATOR", "PRINCIPAL"]

        # Récupération des membres du personnel de l'école correspondant aux types d'enseignants/éducateurs
        staff_members = Staff.objects.filter(
            school=school, 
            staff_type__in=teaching_staff_types
        ).select_related('user')

        # Extraction des emails des utilisateurs actifs
        for staff in staff_members:
            if staff.user.is_active and staff.user.email:
                recipient_emails.append(staff.user.email)

    # Note : Ajoutez ici d'autres conditions (elif year_stape == 'end_year', etc.) si nécessaire.

    # 2. Nettoyage et envoi des emails
    
    # Assurer l'unicité des adresses et la validité (ex: filtrer les adresses vides ou par défaut)
    unique_recipients = list(set([email for email in recipient_emails if email and email != "email_a_remplir@gmail.com"]))
    
    if not unique_recipients:
        print(f"Aucun destinataire trouvé pour l'étape '{year_stape}' à l'école {school.name}.")
        return False

    # Envoi
    print(f"Tentative d'envoi à {len(unique_recipients)} destinataire(s) pour l'étape '{year_stape}'...")
    mail_envoye = send_email(subject, message, unique_recipients)

    return mail_envoye


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


def create_staff(user, staff_type, school, gender, address, birth_date=None):
    """
    Crée un nouvel objet Staff lié à un utilisateur existant.
    Args:
        user_id (int): L'ID de l'utilisateur à lier.
        staff_type (str): Le type de personnel.
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
            birth_date=birth_date,
            address=address
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
    
def get_staff_by_type(staff_type):
    """
    Récupère tous les membres du personnel d'un type donné.
    Args:
        staff_type (str): Le type de personnel.
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(staff_type=staff_type)

def get_staff_by_gender_and_type(gender, staff_type):
    """
    Récupère les membres du personnel en fonction du genre et du type.
    Args:
        gender (str): Le genre du personnel ('M' ou 'F').
        staff_type (str): L'ID du type de personnel.
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(gender=gender, staff_type=staff_type)

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

def get_staff_by_type_school(school_id, staff_type):
    """
    Récupère les membres du personnel d'une école par type.
    Args:
        school_id (int): L'ID de l'école.
        staff_type (str): L'ID du type de personnel.
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(school__id=school_id, staff_type=staff_type)

def get_staff_by_gender_and_type_school(school_id, gender, staff_type):
    """
    Récupère les membres du personnel d'une école en fonction du genre et du type.
    Args:
        school_id (int): L'ID de l'école.
        gender (str): Le genre du personnel ('M' ou 'F').
        staff_type (str): L'ID du type de personnel.
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(school__id=school_id, gender=gender, staff_type=staff_type)

def get_staff_by_gender_and_school(school_id, gender):
    """
    Récupère les membres du personnel d'une école en fonction du genre.
    Args:
        school_id (int): L'ID de l'école.
        gender (str): Le genre du personnel ('M' ou 'F').
    Returns:
        QuerySet: Un QuerySet des objets Staff correspondants.
    """
    return Staff.objects.filter(school__id=school_id, gender=gender)

# Fonction pour récupérer un Staff à partir d'un user.id
def get_staff_by_user_id(user_id):
    try:
        return Staff.objects.get(user__id=user_id)
    except ObjectDoesNotExist:
        return None

"""
=======================
GESTION DES ETUDIANTS :
=======================
"""

def create_student(user, school, gender, address, birth_date=None):
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
        if Student.objects.filter(user=user).exists():
            return None, "Cet utilisateur est déjà lié à un élève."
        student = Student.objects.create(
            user=user,
            school=school,
            gender=gender,
            address=address,
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

def deactivate_student(student_id):
    """
    Désactive un élève en désactivant son compte utilisateur.
    Args:
        student_id (int): L'ID de l'objet Student.
    Returns:
        tuple: (Student, bool) - L'objet Student désactivé et un booléen de réussite.
    """
    try:
        student = Student.objects.get(id=student_id)
        student.user.is_active = False
        student.user.save()
        return student, True
    except Student.DoesNotExist:
        return "Élève non trouvé.", False
    except Exception as e:
        return f"Erreur lors de la désactivation de l'élève : {str(e)}", False

def activate_student(student_id):
    """
    Active un élève en activant son compte utilisateur.
    Args:
        student_id (int): L'ID de l'objet Student.
    Returns:
        tuple: (Student, bool) - L'objet Student activé et un booléen de réussite.
    """
    try:
        student = Student.objects.get(id=student_id)
        student.user.is_active = True
        student.user.save()
        return student, True
    except Student.DoesNotExist:
        return "Élève non trouvé.", False
    except Exception as e:
        return f"Erreur lors de l'activation de l'élève : {str(e)}", False

# Fonction pour récupérer un Student à partir d'un user.id
def get_student_by_user_id(user_id):
    try:
        return Student.objects.get(user__id=user_id)
    except ObjectDoesNotExist:
        return None

"""
=======================
GESTION DES PARENT :
=======================
"""

def create_parent(user, school, gender, address, birth_date=None):
    """
    Crée un nouvel objet Parent lié à un utilisateur existant.
    Args:
        user_id (int): L'ID de l'utilisateur à lier.
        school_id (int): L'ID de l'école de rattachement.
        gender (str): Le genre du parent.
        birth_date (date, optional): La date de naissance du parent.
    Returns:
        tuple: (Parent, str) - L'objet Parent créé ou un message d'erreur.
    """
    try:
        if Parent.objects.filter(user=user).exists():
            return None, "Cet utilisateur est déjà lié à un parent."
        parent = Parent.objects.create(
            user=user,
            school=school,
            gender=gender,
            address=address,
            birth_date=birth_date
        )
        return parent, None
    except User.DoesNotExist:
        return None, "Utilisateur non trouvé."
    except ObjectDoesNotExist:
        return None, "École non trouvée."
    except Exception as e:
        return None, str(e)

def get_parent_by_id(parent_id):
    """
    Récupère un objet Parent par son ID.
    Args:
        parent_id (int): L'ID de l'objet Parent.
    Returns:
        Parent: L'objet Parent ou None s'il n'existe pas.
    """
    try:
        return Parent.objects.get(id=parent_id)
    except Parent.DoesNotExist:
        return None

def update_parent(parent_id, **kwargs):
    """
    Met à jour les informations d'un parent.
    Args:
        parent_id (int): L'ID de l'objet Parent à mettre à jour.
        kwargs (dict): Les champs à mettre à jour.
    Returns:
        tuple: (Parent, str) - L'objet Parent mis à jour ou un message d'erreur.
    """
    try:
        parent = Parent.objects.get(id=parent_id)
        for key, value in kwargs.items():
            setattr(parent, key, value)
        parent.save()
        return parent, None
    except Parent.DoesNotExist:
        return None, "Parent non trouvé."
    except Exception as e:
        return None, str(e)

def delete_parent(parent_id):
    """
    Supprime un objet Parent.
    Args:
        parent_id (int): L'ID de l'objet Parent à supprimer.
    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        parent = Parent.objects.get(id=parent_id)
        parent.delete()
        return True
    except Parent.DoesNotExist:
        return False

def get_all_parents():
    """
    Récupère tous les objets Parent.
    Returns:
        QuerySet: Un QuerySet de tous les objets Parent.
    """
    return Parent.objects.all()

def get_all_parents_school(school_id):
    """
    Récupère tous les parents d'une école donnée.
    Args:
        school_id (int): L'ID de l'école.
    Returns:
        QuerySet: Un QuerySet des objets Parent de l'école.
    """
    return Parent.objects.filter(school__id=school_id)

def deactivate_parent(parent_id):
    """
    Désactive un parent en désactivant son compte utilisateur.
    Args:
        parent_id (int): L'ID de l'objet Parent.
    Returns:
        tuple: (Parent, bool) - L'objet Parent désactivé et un booléen de réussite.
    """
    try:
        parent = Parent.objects.get(id=parent_id)
        parent.user.is_active = False
        parent.user.save()
        return parent, True
    except Parent.DoesNotExist:
        return "Parent non trouvé.", False
    except Exception as e:
        return f"Erreur lors de la désactivation du parent : {str(e)}", False


def activate_parent(parent_id):
    """
    Active un parent en activant son compte utilisateur.
    Args:
        parent_id (int): L'ID de l'objet Parent.
    Returns:
        tuple: (Parent, bool) - L'objet Parent activé et un booléen de réussite.
    """
    try:
        parent = Parent.objects.get(id=parent_id)
        parent.user.is_active = True
        parent.user.save()
        return parent, True
    except Parent.DoesNotExist:
        return "Parent non trouvé.", False
    except Exception as e:
        return f"Erreur lors de l'activation du parent : {str(e)}", False

def update_profile_parent_or_student(user_id, **kwargs):
    """
    Met à jour le profil d'un utilisateur (parent ou élève).
    Args:
        user_id (int): L'ID de l'utilisateur dont le profil doit être mis à jour.
        kwargs (dict): Les champs à mettre à jour pour le profil.
    Returns:
        tuple: (object, str) - L'objet mis à jour (Parent ou Student) ou un message d'erreur.
    """
    try:
        # Tente de récupérer le profil Parent lié à l'utilisateur
        profile = Parent.objects.get(user__id=user_id)
        return update_parent(profile.id, **kwargs)
    except Parent.DoesNotExist:
        try:
            # Si ce n'est pas un Parent, tente de récupérer le profil Student
            profile = Student.objects.get(user__id=user_id)
            return update_student(profile.id, **kwargs)
        except Student.DoesNotExist:
            return "Profil non trouvé pour cet utilisateur.", False
        except Exception as e:
            return f"Erreur lors de la mise à jour du profil de l'élève : {str(e)}", False
    except Exception as e:
        return f"Erreur lors de la mise à jour du profil du parent : {str(e)}", False

# Fonction pour récupérer un Parent à partir d'un user.id
def get_parent_by_user_id(user_id):
    try:
        return Parent.objects.get(user__id=user_id)
    except ObjectDoesNotExist:
        return None

"""
=====================
GESTION DES ENFANT :
=====================
"""

# --- Fonctions CRUD pour la classe Child ---
def create_child(student_id, parent_id):
    """
    Crée un nouvel objet Child liant un élève à un parent.
    Args:
        student_id (int): L'ID de l'élève.
        parent_id (int): L'ID du parent.
    Returns:
        tuple: (Child, str) - L'objet Child créé ou un message d'erreur.
    """
    try:
        student = Student.objects.get(id=student_id)
        parent = Parent.objects.get(id=parent_id)
        if Child.objects.filter(student=student, parent=parent).exists():
            return None, "Le lien entre cet élève et ce parent existe déjà."
        child = Child.objects.create(student=student, parent=parent)
        return child, None
    except Student.DoesNotExist:
        return None, "Élève non trouvé."
    except Parent.DoesNotExist:
        return None, "Parent non trouvé."
    except Exception as e:
        return None, str(e)

def get_child_by_id(child_id):
    """
    Récupère un objet Child par son ID.
    Args:
        child_id (int): L'ID de l'objet Child.
    Returns:
        Child: L'objet Child ou None s'il n'existe pas.
    """
    try:
        return Child.objects.get(id=child_id)
    except Child.DoesNotExist:
        return None

def update_child(child_id, new_student_id=None, new_parent_id=None):
    """
    Met à jour les liens d'un enfant vers un nouvel élève ou parent.
    Args:
        child_id (int): L'ID de l'objet Child à mettre à jour.
        new_student_id (int, optional): Le nouvel ID de l'élève.
        new_parent_id (int, optional): Le nouvel ID du parent.
    Returns:
        tuple: (Child, str) - L'objet Child mis à jour ou un message d'erreur.
    """
    try:
        child = Child.objects.get(id=child_id)
        if new_student_id:
            student = Student.objects.get(id=new_student_id)
            child.student = student
        if new_parent_id:
            parent = Parent.objects.get(id=new_parent_id)
            child.parent = parent
        child.save()
        return child, None
    except Child.DoesNotExist:
        return None, "Lien enfant/parent non trouvé."
    except Student.DoesNotExist:
        return None, "Nouvel élève non trouvé."
    except Parent.DoesNotExist:
        return None, "Nouveau parent non trouvé."
    except Exception as e:
        return None, str(e)

def delete_child(child_id):
    """
    Supprime un objet Child.
    Args:
        child_id (int): L'ID de l'objet Child à supprimer.
    Returns:
        bool: True si la suppression est réussie, False sinon.
    """
    try:
        child = Child.objects.get(id=child_id)
        child.delete()
        return True
    except Child.DoesNotExist:
        return False

def get_children_by_parent(parent_id):
    """
    Récupère tous les élèves liés à un parent donné.
    Args:
        parent_id (int): L'ID du parent.
    Returns:
        QuerySet: Un QuerySet des objets Child correspondant aux élèves.
    """
    return Child.objects.filter(parent__id=parent_id)

def get_parents_by_student(student_id):
    """
    Récupère tous les parents liés à un élève donné.
    Args:
        student_id (int): L'ID de l'élève.
    Returns:
        QuerySet: Un QuerySet des objets Child correspondant aux parents.
    """
    return Child.objects.filter(student__id=student_id)

"""
===============================
CREATION DES NOMS UTILISATEUR :
===============================
"""

def generate_unique_username(first_name, last_name):
    """
    Génère un nom d'utilisateur unique à partir du prénom et du nom de famille.
    Args:
        first_name (str): Le prénom de l'utilisateur.
        last_name (str): Le nom de famille de l'utilisateur.
    Returns:
        str: Le nom d'utilisateur unique généré.
    """
    base_username = f"{first_name.lower()}.{last_name.lower()}"
    username_to_check = base_username
    counter = 2

    # Vérifie si le nom d'utilisateur de base existe déjà
    while User.objects.filter(username=username_to_check).exists():
        username_to_check = f"{base_username}{counter:02d}"
        counter += 1

    return username_to_check


class CustomDjangoJSONEncoder(DjangoJSONEncoder):
    """
    Encodeur personnalisé pour gérer les décimaux, dates, etc.,
    spécifiques à Django lors de la sérialisation en JSON.
    """
    def default(self, o):
        if isinstance(o, (Parent, Student, Child)):
            # Si nous passons les objets directement, nous pourrions avoir besoin
            # de sérialiser leurs champs manuellement, mais ici, nous nous
            # concentrons sur les IDs et les noms/prénoms.
            return {
                'id': o.id,
                'first_name': getattr(o, 'first_name', ''),
                'last_name': getattr(o, 'last_name', ''),
            }
        return super().default(o)
    
    
def get_student_context(request):
    """
    Récupère le profil 'Student' actif pour le contexte actuel.
    
    - Si l'utilisateur est un Étudiant : Retourne son propre profil.
    - Si l'utilisateur est un Parent : 
        1. Cherche l'ID de l'enfant dans la session.
        2. Vérifie que cet enfant appartient bien au parent (Sécurité).
        3. Retourne l'objet Student correspondant.
        4. Si aucun enfant en session (ou ID invalide), retourne le premier enfant trouvé par défaut.
    
    Retourne None si aucun profil étudiant valide n'est trouvé.
    """
    user = request.user

    # CAS 2 : L'utilisateur EST un Parent
    if hasattr(user, 'parent_user'):
        parent = user.parent_user
        selected_child_id = request.session.get('selected_child_id')

        # A. Essai avec l'ID en session
        if selected_child_id:
            try:
                # VÉRIFICATION DE SÉCURITÉ CRUCIALE
                # On vérifie que l'enfant est bien lié à ce parent via la table Child
                child_link = Child.objects.get(parent=parent, student__id=selected_child_id)
                return child_link.student
            except Child.DoesNotExist:
                # L'ID en session ne correspond pas à un enfant de ce parent (ou n'existe plus)
                # On continue vers le fallback
                pass

        # B. Fallback (Premier chargement ou ID invalide) : On prend le premier enfant
        first_child_link = Child.objects.filter(parent=parent).first()
        if first_child_link:
            # On met à jour la session pour la prochaine fois
            request.session['selected_child_id'] = first_child_link.student.id
            return first_child_link.student

    # CAS 3 : Autre (Prof, Admin...) -> Pas d'accès en tant qu'élève
    return None


def remove_old_profile_image(user):
    """
    Supprime physiquement l'ancienne image de profil du disque dur
    si elle existe.
    """
    if user.profile_picture and user.profile_picture.name:
        # Construit le chemin absolu du fichier
        file_path = os.path.join(settings.MEDIA_ROOT, user.profile_picture.name)
        
        # Vérifie si le fichier existe et le supprime
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Erreur lors de la suppression de l'image : {e}")