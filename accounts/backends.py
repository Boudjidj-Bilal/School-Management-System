import requests
import json
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

class MailerooBackend(BaseEmailBackend):
    """
    Backend email personnalisé pour l'API Maileroo.
    """
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently)
        self.api_key = settings.MAILEROO_API_KEY
        # URL API (Utiliser celle qui répond, même avec erreur 400)
        self.api_url = "https://smtp.maileroo.com/send" 

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        count = 0
        for message in email_messages:
            sent = self._send(message)
            if sent:
                count += 1
        return count

    def _send(self, email_message):
        if not email_message.recipients():
            return False

        # Extraction des données
        to_email = email_message.to[0] if email_message.to else ""
        subject = str(email_message.subject) if email_message.subject else "Pas de sujet"
        
        # Debug : Vérifier le contenu avant envoi
        print(f"--- Envoi Maileroo ---")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")

        # Préparation des données pour l'API
        # On utilise 'data' (Form Data) au lieu de 'json' pour une compatibilité maximale
        payload = {
            "from": email_message.from_email,
            "to": to_email,
            "subject": subject,
            "plain": email_message.body, # Certain APIs préfèrent 'plain' à 'text'
            "text": email_message.body,   # On envoie les deux pour être sûr
        }

        # Gestion du HTML
        html_content = None
        if isinstance(email_message, EmailMultiAlternatives):
            for content, mimetype in email_message.alternatives:
                if mimetype == "text/html":
                    html_content = content
                    break
        
        if not html_content and email_message.content_subtype == "html":
             html_content = email_message.body

        if html_content:
            payload["html"] = html_content

        headers = {
            "X-API-Key": self.api_key,
            # Pas de Content-Type ici, requests le mettra automatiquement pour le Form-Data
        }

        try:
            # Envoi en 'data' (application/x-www-form-urlencoded)
            response = requests.post(self.api_url, data=payload, headers=headers)
            
            if response.status_code in [200, 201, 202]:
                print("Maileroo: Succès")
                return True
            
            # Si échec 400 avec Form-Data, on tente en JSON (Fallback)
            if response.status_code >= 400:
                print(f"Maileroo (Form-Data) échoué: {response.text}. Tentative JSON...")
                headers["Content-Type"] = "application/json"
                response = requests.post(self.api_url, json=payload, headers=headers)
                
                if response.status_code in [200, 201, 202]:
                    print("Maileroo (JSON): Succès")
                    return True

            error_msg = f"Erreur API Maileroo ({response.status_code}): {response.text}"
            print(error_msg)
            
            if not self.fail_silently:
                raise Exception(error_msg)
            return False

        except Exception as e:
            print(f"Exception Maileroo: {e}")
            if not self.fail_silently:
                raise e
            return False