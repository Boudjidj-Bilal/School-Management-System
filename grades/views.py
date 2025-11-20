import json

from django.http import JsonResponse, HttpResponseForbidden
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods

# Import des modèles
from .models import Evaluation, Grade
from schools.models import TermYearLevel
from subjects.models import TeacherSubject
from users.models import Staff, Student
from classes.models import Class

# Import des utilitaires
# Importe les 2 fonctions de 'utils.py'
from .utils import (
    get_grades_dashboard_data, 
    get_grades_data_for_specific_context
)
from users.utils import get_user_type
from schools.utils import get_current_year_for_school

# ---
# Le professeur consulte son propre tableau de bord
# ---
@login_required(login_url='login')
def view_my_grades_dashboard(request):
    """
    Affiche le tableau de bord des évaluations pour le PROFESSEUR CONNECTÉ.
    L'utilisateur EST le professeur.
    """
    user = request.user
    user_type = get_user_type(user)

    # 1. Vérification des permissions
    if not (user_type == "Teacher" or user_type == "Principal" or user_type == "SuperAdministrator"):
        return HttpResponseForbidden("Accès refusé. Cette page est réservée aux enseignants et à l'administration.")
        
    try:
        teacher_staff = get_object_or_404(Staff, user=user)
    except Staff.DoesNotExist:
         return HttpResponseForbidden("Erreur: Profil enseignant non trouvé pour cet utilisateur.")

    # 2. Vérification de l'année scolaire
    current_year = get_current_year_for_school(teacher_staff.school)
    if not current_year:
        return HttpResponseForbidden("Aucune année scolaire courante n'est définie.")
        
    if not current_year.running:
        return HttpResponseForbidden("La gestion des évaluations n'est disponible que lorsqu'une année scolaire est en cours ('running').")

    # 3. Récupération des données structurées par classe et matière
    # [APPEL UTILS]
    dashboard_data = get_grades_dashboard_data(teacher_staff, current_year)

    # 4. Contexte pour le template HTML
    context = {
        'teacher_staff': teacher_staff, # Le professeur, c'est l'utilisateur
        'current_year': current_year,
        
        # Permissions
        'is_admin_user': False, # N'est pas en mode "vue admin"
        'can_edit_grades': True,  # [IMPORTANT] Le prof peut modifier
        
        # Données principales structurées (pour le HTML direct et pour JS)
        'dashboard_data': dashboard_data, # Nouveau format de données

        # ID du prof pour les appels API
        'staff_pk_for_js': teacher_staff.pk,
    }
    
    # [CORRECTION] Ne plus utiliser json.dumps() ici.
    # On passe le dictionnaire Python brut pour que |json_script| s'en charge.
    context['initial_data_for_script'] = {
        'main_class_data': dashboard_data['main_class_data'],
        'taught_classes_data': dashboard_data['taught_classes_data'],
    }


    return render(request, 'grades/grades_dashboard.html', context)


# ---
# Un admin/proviseur consulte le tableau de bord d'un prof
# ---
@login_required(login_url='login')
def view_teacher_grades_as_admin(request, pk_staff):
    """
    Affiche le tableau de bord des évaluations d'un PROFESSEUR CIBLÉ.
    L'utilisateur est un Admin/Principal.
    """
    user = request.user
    user_type = get_user_type(user)

    # 1. Vérification des permissions
    if user_type not in ["SuperAdministrator", "Principal"]:
        return HttpResponseForbidden("Accès refusé. Seuls les Proviseurs et Super-Administrateurs peuvent consulter cette page.")
        
    try:
        # C'est le prof qu'on REGARDE
        teacher_staff = get_object_or_404(Staff, pk=pk_staff) 
    except Staff.DoesNotExist:
         return HttpResponseForbidden("Erreur: Profil enseignant cible non trouvé.")

    # 2. Vérification de l'année scolaire
    current_year = get_current_year_for_school(teacher_staff.school)
    if not current_year:
        return HttpResponseForbidden("Aucune année scolaire courante n'est définie.")
    
    # (On permet de voir même si l'année n'est pas 'running', car c'est une vue admin)
    
    # 3. Récupération des données structurées
    # [APPEL UTILS]
    dashboard_data = get_grades_dashboard_data(teacher_staff, current_year)

    # 4. Contexte
    context = {
        'teacher_staff': teacher_staff, # Le professeur CIBLÉ
        'current_year': current_year,
        
        # Permissions
        'is_admin_user': True, # Est en mode "vue admin"
        'can_edit_grades': False, # [IMPORTANT] L'admin ne peut pas modifier
        
        # Données principales structurées (pour le HTML direct et pour JS)
        'dashboard_data': dashboard_data, 
        
        # ID du prof CIBLÉ pour les appels API
        'staff_pk_for_js': teacher_staff.pk,
    }

    # [CORRECTION] Ne plus utiliser json.dumps() ici.
    # On passe le dictionnaire Python brut pour que |json_script| s'en charge.
    context['initial_data_for_script'] = {
        'main_class_data': dashboard_data['main_class_data'],
        'taught_classes_data': dashboard_data['taught_classes_data'],
    }

    return render(request, 'grades/grades_dashboard.html', context)


# ---
# Navigation
# ---
@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_get_grades_for_term_views(request):
    """
    API (POST) pour la navigation par trimestre.
    Recharge les données pour un trimestre/semestre différent pour une classe/matière donnée.
    """
    # ... (fonction inchangée) ...
    user = request.user
    user_type = get_user_type(user)

    try:
        data = json.loads(request.body)
        term_id = data.get("term_id")
        staff_id = data.get("staff_id") # ID du prof dont on regarde le dashboard
        class_id = data.get("class_id")
        ts_id = data.get("ts_id") # Peut être None si c'est pour un prof principal

        term_year = get_object_or_404(TermYearLevel, pk=term_id)
        current_year = term_year.year
        teacher_staff = get_object_or_404(Staff, pk=staff_id)
        student_class = get_object_or_404(Class, pk=class_id)

        # 1. Permissions (identiques aux vues de page)
        is_admin_or_principal = user_type in ["SuperAdministrator", "Principal"]
        is_self = (hasattr(user, 'staff_user') and user.staff_user.id == teacher_staff.id)
        
        if not (is_admin_or_principal or is_self):
            return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)
        
        # 2. Récupération des données SPÉCIFIQUES pour ce contexte
        # [APPEL UTILS]
        context_data = get_grades_data_for_specific_context(
            teacher_staff=teacher_staff, 
            current_year=current_year, 
            student_class=student_class, 
            teacher_subject_id=ts_id, # Peut être None
            selected_term=term_year
        )
        
        if not context_data:
            return JsonResponse({"success": False, "message": "Aucune donnée trouvée pour ce contexte."}, status=404)

        return JsonResponse({"success": True, "data": context_data})

    except Exception as e:
        print(f"Erreur dans api_get_grades_for_term: {e}")
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)


# ---
# Actions (CRUD)
# ---
@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_manage_evaluation_views(request):
    """
    API (POST) pour Créer, Modifier ou Supprimer une Évaluation et ses Notes.
    [MODIFIÉ] Ajout de la validation (note <= max_grade) côté serveur.
    """
    user = request.user
    user_type = get_user_type(user)

    # 1. Permissions
    if user_type != "Teacher":
        return JsonResponse({"success": False, "message": "Accès refusé. Seuls les enseignants peuvent gérer les évaluations."}, status=403)
        
    try:
        teacher_staff = get_object_or_404(Staff, user=user)
    except Staff.DoesNotExist:
         return JsonResponse({"success": False, "message": "Profil enseignant non trouvé."}, status=403)

    try:
        data = json.loads(request.body)
        action = data.get("action")

        with transaction.atomic():
            
            # --- ACTION: CREATE ---
            if action == "create":
                class_id = data.get("class_id")
                ts_id = data.get("ts_id")
                term_id = data.get("term_id")
                name = data.get("name")
                coefficient = float(data.get("coefficient", 1.0))
                max_grade = float(data.get("max_grade", 20.0))
                grades_list = data.get("grades", []) 

                # --- [NOUVELLE VALIDATION SERVEUR] ---
                for grade_data in grades_list:
                    grade_val_str = grade_data.get("grade")
                    is_absent = bool(grade_data.get("absent", False))
                    
                    if not is_absent and grade_val_str is not None:
                        try:
                            grade_val_float = float(grade_val_str)
                            if grade_val_float > max_grade:
                                # Essaye de trouver le nom de l'élève pour une erreur claire
                                try:
                                    student = Student.objects.get(pk=grade_data.get("student_id"))
                                    student_name = f"{student.user.first_name} {student.user.last_name}"
                                except Student.DoesNotExist:
                                    student_name = f"l'élève ID {grade_data.get('student_id')}"
                                
                                return JsonResponse({
                                    "success": False, 
                                    "message": f"Validation échouée : La note {grade_val_float} pour {student_name} est supérieure au maximum ({max_grade})."
                                }, status=400) # 400 Bad Request
                        except ValueError:
                             return JsonResponse({"success": False, "message": f"La note '{grade_val_str}' n'est pas un nombre valide."}, status=400)
                # --- [FIN VALIDATION SERVEUR] ---

                student_class = get_object_or_404(Class, pk=class_id)
                teacher_subject = get_object_or_404(TeacherSubject, pk=ts_id)
                term_year = get_object_or_404(TermYearLevel, pk=term_id)

                if teacher_subject.teacher != teacher_staff:
                     return JsonResponse({"success": False, "message": "Vous ne pouvez pas créer d'évaluation pour une matière que vous n'enseignez pas."}, status=403)
                
                new_evaluation = Evaluation.objects.create(
                    name=name,
                    coefficient=coefficient,
                    max_grade=max_grade,
                    term_year=term_year,
                    teacher_subject=teacher_subject,
                    student_class=student_class
                )
                
                for grade_data in grades_list:
                    student = get_object_or_404(Student, pk=grade_data.get("student_id"))
                    Grade.objects.create(
                        evaluation=new_evaluation,
                        student=student,
                        grade_value=float(grade_data.get("grade")) if grade_data.get("grade") else None,
                        is_absent=bool(grade_data.get("absent", False))
                    )
                
                return JsonResponse({"success": True, "message": "Évaluation créée avec succès."})

            # --- ACTION: UPDATE ---
            elif action == "update":
                evaluation_id = data.get("evaluation_id")
                name = data.get("name")
                coefficient = float(data.get("coefficient", 1.0))
                max_grade = float(data.get("max_grade", 20.0))
                grades_list = data.get("grades", [])
                
                evaluation = get_object_or_404(Evaluation, pk=evaluation_id)

                # --- [NOUVELLE VALIDATION SERVEUR] ---
                for grade_data in grades_list:
                    grade_val_str = grade_data.get("grade")
                    is_absent = bool(grade_data.get("absent", False))
                    
                    if not is_absent and grade_val_str is not None:
                        try:
                            grade_val_float = float(grade_val_str)
                            # Vérifie si la note est supérieure au max autorisé
                            # (Utilise max_grade de la *nouvelle* data, pas evaluation.max_grade)
                            if grade_val_float > max_grade: 
                                try:
                                    student = Student.objects.get(pk=grade_data.get("student_id"))
                                    student_name = f"{student.user.first_name} {student.user.last_name}"
                                except Student.DoesNotExist:
                                    student_name = f"l'élève ID {grade_data.get('student_id')}"
                                
                                return JsonResponse({
                                    "success": False, 
                                    "message": f"Validation échouée : La note {grade_val_float} pour {student_name} est supérieure au maximum ({max_grade})."
                                }, status=400)
                        except ValueError:
                             return JsonResponse({"success": False, "message": f"La note '{grade_val_str}' n'est pas un nombre valide."}, status=400)
                # --- [FIN VALIDATION SERVEUR] ---

                if evaluation.teacher_subject.teacher != teacher_staff:
                     return JsonResponse({"success": False, "message": "Vous ne pouvez pas modifier cette évaluation."}, status=403)

                evaluation.name = name
                evaluation.coefficient = coefficient
                evaluation.max_grade = max_grade
                evaluation.save()
                
                for grade_data in grades_list:
                    Grade.objects.update_or_create(
                        evaluation=evaluation,
                        student_id=grade_data.get("student_id"),
                        defaults={
                            'grade_value': float(grade_data.get("grade")) if grade_data.get("grade") else None,
                            'is_absent': bool(grade_data.get("absent", False))
                        }
                    )

                return JsonResponse({"success": True, "message": "Évaluation mise à jour."})

            # --- ACTION: DELETE ---
            elif action == "delete":
                # ... (non modifié) ...
                evaluation_id = data.get("evaluation_id")
                evaluation = get_object_or_404(Evaluation, pk=evaluation_id)
                
                if evaluation.teacher_subject.teacher != teacher_staff:
                     return JsonResponse({"success": False, "message": "Vous ne pouvez pas supprimer cette évaluation."}, status=403)

                evaluation.delete() 
                return JsonResponse({"success": True, "message": "Évaluation supprimée."})

            # --- ACTION: GET_DETAILS ---
            elif action == "get_details":
                # ... (non modifié) ...
                evaluation_id = data.get("evaluation_id")
                evaluation = get_object_or_404(Evaluation, pk=evaluation_id)
                
                grades = Grade.objects.filter(evaluation=evaluation)
                grades_data = list(grades.values(
                    'student_id', 
                    'grade_value', 
                    'is_absent'
                ))
                
                evaluation_details = {
                    "name": evaluation.name,
                    "coefficient": evaluation.coefficient,
                    "max_grade": evaluation.max_grade
                }
                
                return JsonResponse({"success": True, "grades": grades_data, "details": evaluation_details})
                
            else:
                return JsonResponse({"success": False, "message": "Action non reconnue."}, status=400)

    except Exception as e:
        print(f"Erreur dans api_manage_evaluation: {e}")
        return JsonResponse({"success": False, "message": f"Erreur interne : {str(e)}"}, status=500)