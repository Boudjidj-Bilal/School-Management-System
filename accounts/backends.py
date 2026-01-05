# accounts/backends.py
import requests
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
        self.api_url = "https://api.maileroo.com/v1/email" # Vérifie l'URL exacte dans la doc Maileroo

    def send_messages(self, email_messages):
        """
        Envoie un ou plusieurs objets EmailMessage.
        """
        if not email_messages:
            return 0

        count = 0
        for message in email_messages:
            sent = self._send(message)
            if sent:
                count += 1
        return count

    def _send(self, email_message):
        """
        Envoie un email unique via l'API HTTP de Maileroo.
        """
        if not email_message.recipients():
            return False

        # Préparation des données pour l'API
        payload = {
            "from": email_message.from_email,
            "to": email_message.to, # L'API attend souvent une liste ou un string
            "subject": email_message.subject,
            "html": None,
            "text": email_message.body,
        }

        # Gestion du HTML si présent (EmailMultiAlternatives)
        if isinstance(email_message, EmailMultiAlternatives):
            for content, mimetype in email_message.alternatives:
                if mimetype == "text/html":
                    payload["html"] = content
                    break
        
        # Si pas de HTML alternatif mais que le body est html (cas rare mais possible)
        if not payload["html"] and email_message.content_subtype == "html":
             payload["html"] = email_message.body

        headers = {
            "X-API-Key": self.api_key, # Vérifie le nom du header dans la doc Maileroo
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(self.api_url, json=payload, headers=headers)
            if response.status_code in [200, 201, 202]:
                return True
            else:
                if not self.fail_silently:
                    raise Exception(f"Erreur API Maileroo ({response.status_code}): {response.text}")
                return False
        except Exception as e:
            if not self.fail_silently:
                raise e
            return False