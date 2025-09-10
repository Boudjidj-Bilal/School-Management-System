from .utils import get_user_type

"""
Cette fonction sert à vérifier les types d'utilisateurs afin de faire des vérifications dans les pages html.
Elle est appelé depuis le fichier settings dans l'onglet TEMPLATE.
"""

def user_roles(request):
    """
    Rend les rôles des utilisateurs disponibles dans le contexte du template.
    """
    if not request.user.is_authenticated:
        return {
            'user_is_super_admin': False,
            'user_is_principal': False,
            'user_is_teacher': False,
            'user_is_cpe': False,
            'user_is_administrator': False,
            'user_is_student': False,
            'user_is_parent': False,
            'user_can_manage_users': False,
        }

    user_type = get_user_type(request.user)

    """
    Returns:
        str or None: Le type d'utilisateur ('SuperAdministrator', 'Principal', 'Teacher',
               'CPE', 'Administrator', 'Student', 'Parent'), ou None si le rôle n'est pas trouvé.
    """
    
    is_super_admin = (user_type == "SuperAdministrator")
    is_principal = (user_type == "Principal")
    is_teacher = (user_type == "Teacher")
    is_cpe = (user_type == "CPE")
    is_administrator = (user_type == "Administrator")
    is_student = (user_type == "Student")
    is_parent = (user_type == "Parent")
    
    # Calcul de la variable pour les permissions
    user_can_manage_users = is_super_admin or is_principal or is_administrator

    return {
        'user_is_super_admin': is_super_admin,
        'user_is_principal': is_principal,
        'user_is_teacher': is_teacher,
        'user_is_cpe': is_cpe,
        'user_is_administrator': is_administrator,
        'user_is_student': is_student,
        'user_is_parent': is_parent,
        'user_can_manage_users': user_can_manage_users,
    }
