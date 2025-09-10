from schools.models import School
from users.utils import get_user_type
from schools.utils import get_all_schools
from users.models import Student, Staff, Parent

def school_context(request):
    """
    Rend l'objet School disponible dans le contexte du template pour tous les utilisateurs.
    """
    user = request.user
    if not user.is_authenticated:
        return {'user_school': None}

    user_type = get_user_type(user)
    user_school = None

    if user_type == "SuperAdministrator":
        selected_school_id = request.session.get('selected_school_id')
        try:
            user_school = School.objects.get(id=selected_school_id)
        except (School.DoesNotExist, TypeError):
            # Si l'école n'est pas trouvée ou si l'ID n'est pas un entier
            schools = get_all_schools()
            if schools.exists():
                user_school = schools.last()
                request.session['selected_school_id'] = user_school.id
    else:
        # Pour les autres utilisateurs, trouver leur école associée
        try:
            if user_type == "Staff":
                user_school = user.staff.school
            elif user_type == "Student":
                user_school = user.student.school
            elif user_type == "Parent":
                user_school = user.parent.school
        except (Staff.DoesNotExist, Student.DoesNotExist, Parent.DoesNotExist):
            user_school = None

    return {'user_school': user_school}
