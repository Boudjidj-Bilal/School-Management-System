from django.apps import AppConfig
import os
from django.conf import settings

class DocumentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'documents' # Nom de l'app du dossier

    def ready(self):
        """
        Cette méthode est exécutée une seule fois au démarrage de Django.
        Nous l'utilisons pour garantir que l'arborescence de fichiers privés existe.
        """
        self.ensure_private_storage_exists()

    def ensure_private_storage_exists(self):
        # 1. On définit le chemin racine (ex: /var/www/ProjectSchool/private_files)
        private_root = os.path.join(settings.BASE_DIR, 'private_files')

        # 2. On liste les dossiers qu'on veut garantir
        folders_to_check = [
            private_root,                                      # La racine
            os.path.join(private_root, 'student_documents'),   # Pour l'upload
            os.path.join(private_root, 'report_cards'),        # Pour les bulletins
        ]

        # 3. Boucle de création sécurisée
        for folder_path in folders_to_check:
            if not os.path.exists(folder_path):
                try:
                    # makedirs crée le dossier et les parents si besoin
                    # mode=0o755 donne lecture/écriture au propriétaire (Django) et lecture aux autres
                    os.makedirs(folder_path, mode=0o755, exist_ok=True)
                    print(f"[Système] Dossier privé créé automatiquement : {folder_path}")
                except OSError as e:
                    # En cas d'erreur critique (permissions bloquées par l'hébergeur)
                    print(f"[Erreur Critique] Impossible de créer le dossier {folder_path} : {e}")