from django import template
from schools.models import TermYearLevel

from schools.utils import get_current_year_for_school

register = template.Library()

@register.simple_tag
def get_current_term_id(school_class):
    """
    Renvoie l'ID du trimestre actif pour une classe.
    Logique :
    1. Récupère tous les trimestres de l'année active pour ce niveau.
    2. Retourne le premier qui a finished=False.
    3. Si tous sont finished=True, retourne le dernier (fin d'année).
    """
    try:
        school = school_class.level.school
        current_year = get_current_year_for_school(school) 

        # 1. On récupère tous les trimestres du niveau pour l'année en cours
        # On trie par 'counter' (1, 2, 3) pour respecter l'ordre chronologique
        terms = TermYearLevel.objects.filter(
            level=school_class.level,
            year=current_year
        ).order_by('counter')

        # S'il n'y a pas de trimestres configurés, on ne renvoie rien
        if not terms.exists():
            return ""

        # 2. On cherche le premier qui n'est PAS fini
        current_term = terms.filter(finished=False).first()

        if current_term:
            # Cas normal : on est en cours de T1, T2 ou T3
            return current_term.id
        
        # 3. Si aucun n'est trouvé (donc ils sont tous finished=True),
        # cela signifie que l'année est terminée pour ce niveau.
        # On renvoie le dernier trimestre pour permettre l'accès aux archives/bulletins finaux.
        last_term = terms.last()
        return last_term.id

    except Exception:
        return ""