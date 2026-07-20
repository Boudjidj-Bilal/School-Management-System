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
        self.api_url = "https://smtp.maileroo.com/api/v2/emails"

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

        to_email = email_message.to[0] if email_message.to else ""
        subject = str(email_message.subject) if email_message.subject else "Pas de sujet"

        # STRUCTURE EXACTE DU PAYLOAD FONCTIONNEL
        payload = {
            "from": {
                "address": email_message.from_email,
                "display_name": "Theranotes"
            },
            "to": [
                {
                    "address": to_email
                }
            ],
            "subject": subject,
            "plain": email_message.body, # API Maileroo utilise 'plain' et non 'text'
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
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        try:

            print(json.dumps(payload, indent=4))
            
            print(settings.DEFAULT_FROM_EMAIL)

            # Envoi direct en JSON
            response = requests.post(self.api_url, json=payload, headers=headers, timeout=30)
            
            if response.status_code in [200, 201, 202]:

                print("STATUS :", response.status_code)
                print("BODY :", response.text)
                print("JSON :", response.json() if response.headers.get("Content-Type","").startswith("application/json") else response.text)
                
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