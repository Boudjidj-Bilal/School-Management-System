from django.utils import translation
from schools.utils import get_user_school
from users.utils import get_user_type

class SchoolLanguageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        language_code = 'fr'  # Langue par défaut de secours

        if request.user.is_authenticated:
            try:
                user_type = get_user_type(request.user)
                school = None
                
                # 1. Récupération de l'école selon le type d'utilisateur
                if user_type == "SuperAdministrator":
                    selected_school_id = request.session.get('selected_school_id')
                    school = get_user_school(request.user, selected_school_id)
                    
                    # --- CORRECTION ICI ---
                    # Si aucune école n'est en session (ex: 1ère connexion), on prend l'école par défaut
                    if not school:
                        # On appelle la fonction sans ID spécifique pour qu'elle renvoie la première école
                        school = get_user_school(request.user)
                        
                        # (Optionnel) Si ça ne suffit pas, on peut forcer la requête comme dans ta vue :
                        # from schools.models import School
                        # if not school:
                        #     school = School.objects.first()
                else:
                    school = get_user_school(request.user)

                # 2. Application de la langue si l'école en possède une
                if school and hasattr(school, 'language') and school.language:
                    language_code = school.language

            except Exception:
                pass

        # Active la langue pour la requête en cours
        translation.activate(language_code)
        request.LANGUAGE_CODE = language_code

        response = self.get_response(request)
        
        translation.deactivate()
        return response