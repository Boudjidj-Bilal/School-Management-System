# Fichier managers.py

from django.contrib.auth.models import BaseUserManager
from django.utils.translation import gettext_lazy as _

# Gère la création des utilisateurs pour les modèles personnalisés.
# Ce manager remplace le gestionnaire par défaut de Django pour permettre l'utilisation
# de l'email comme identifiant unique, au lieu du nom d'utilisateur.
class CustomUserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        """
        Crée et sauvegarde un utilisateur avec l'email et le mot de passe donnés.
        
        Args:
            username (str): L'username de l'utilisateur, utilisée comme identifiant.
            password (str, optional): Le mot de passe non haché de l'utilisateur.
            **extra_fields: Des champs supplémentaires à passer lors de la création.
        
        Raises:
            ValueError: Si l'email n'est pas fourni.
        
        Returns:
            User: L'instance de l'utilisateur nouvellement créé.
        """
        # Vérifie que l'email est présent.
        if not username:
            raise ValueError(_("Le nom d'utilisateur doit être définie."))
        
        # Crée une instance du modèle utilisateur (sans la sauvegarder).
        user = self.model(username=username, **extra_fields)

        
        # Hache et définit le mot de passe.
        user.set_password(password)
        
        # Sauvegarde l'utilisateur dans la base de données.
        user.save(using=self._db)
        
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        """
        Crée et sauvegarde un super-utilisateur avec tous les privilèges.
        
        Args:
            email (str): L'adresse email du super-utilisateur.
            password (str, optional): Le mot de passe du super-utilisateur.
            **extra_fields: Des champs supplémentaires.
            
        Raises:
            ValueError: Si 'is_staff' ou 'is_superuser' ne sont pas 'True'.
        
        Returns:
            User: L'instance du super-utilisateur nouvellement créé.
        """
        # Définit les permissions par défaut pour un super-utilisateur.
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        # S'assure que les permissions de staff et super-utilisateur sont bien actives.
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_("Le super-utilisateur doit avoir is_staff=True."))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_("Le super-utilisateur doit avoir is_superuser=True."))

        # Appelle la méthode 'create_user' pour créer l'utilisateur avec les permissions de super-utilisateur.
        return self.create_user(username, password, **extra_fields)