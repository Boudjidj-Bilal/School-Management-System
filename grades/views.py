import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods

# Import des modèles
from .models import Evaluation, Grade, Appreciation, Mention
from schools.models import TermYearLevel
from subjects.models import TeacherSubject
from users.models import Staff, Student
from classes.models import Class

# Import des utilitaires
# Importe les 2 fonctions de 'utils.py'
from .utils import (
    get_grades_dashboard_data, 
    get_grades_data_for_specific_context,
    get_student_grades_view_data,
    get_appreciations_dashboard_data,
    get_appreciations_data_for_context
)
from users.utils import get_user_type, get_student_context
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
        return render(request, "404.html", status=404)
        
    try:
        teacher_staff = get_object_or_404(Staff, user=user)
    except Staff.DoesNotExist:
        return render(request, "404.html", status=404)

    # 2. Vérification de l'année scolaire
    current_year = get_current_year_for_school(teacher_staff.school)
    if not current_year:
        return render(request, "404.html", status=404)
        
    if not current_year.running:
        return render(request, "404.html", status=404)

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
    
    # Ne plus utiliser json.dumps() ici.
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
        return render(request, "404.html", status=404)
        
    try:
        # C'est le prof qu'on REGARDE
        teacher_staff = get_object_or_404(Staff, pk=pk_staff) 
    except Staff.DoesNotExist:
        return render(request, "404.html", status=404)

    # 2. Vérification de l'année scolaire
    current_year = get_current_year_for_school(teacher_staff.school)
    if not current_year:
        return render(request, "404.html", status=404)
    
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

    # Ne pas utiliser json.dumps() ici.
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
    [CORRIGÉ] Gestion correcte de la note 0 et validations renforcées.
    """
    user = request.user
    user_type = get_user_type(user)

    if user_type != "Teacher":
        return JsonResponse({"success": False, "message": "Accès refusé."}, status=403)
       
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

                student_class = get_object_or_404(Class, pk=class_id)
                teacher_subject = get_object_or_404(TeacherSubject, pk=ts_id)
                term_year = get_object_or_404(TermYearLevel, pk=term_id)

                # Validation Trimestre
                if term_year.finished:
                    return JsonResponse({"success": False, "message": "Action impossible : ce trimestre est clôturé."}, status=403)

                if term_year.level != student_class.level:
                    return JsonResponse({"success": False, "message": "Le trimestre ne correspond pas au niveau de la classe."}, status=400)

                if teacher_subject.teacher != teacher_staff:
                     return JsonResponse({"success": False, "message": "Matière non autorisée."}, status=403)
                
                # Validation des notes
                for grade_data in grades_list:
                    grade_val = grade_data.get("grade") # Peut être 0, "15", "" ou null
                    is_absent = bool(grade_data.get("absent", False))
                   
                    # On vérifie si la valeur n'est pas vide (0 est valide !)
                    if not is_absent and grade_val is not None and grade_val != "":
                        try:
                            grade_float = float(grade_val)
                            if grade_float > max_grade:
                                return JsonResponse({"success": False, "message": f"La note {grade_float} dépasse le maximum ({max_grade})."}, status=400)
                        except ValueError:
                             return JsonResponse({"success": False, "message": f"Note invalide : {grade_val}"}, status=400)

                new_evaluation = Evaluation.objects.create(
                    name=name, coefficient=coefficient, max_grade=max_grade,
                    term_year=term_year, teacher_subject=teacher_subject, student_class=student_class
                )
               
                for grade_data in grades_list:
                    student = get_object_or_404(Student, pk=grade_data.get("student_id"))
                    
                    # [CORRECTION] Gestion propre de la valeur (0 inclus)
                    val = None
                    raw_val = grade_data.get("grade")
                    if raw_val is not None and raw_val != "":
                        val = float(raw_val)

                    Grade.objects.create(
                        evaluation=new_evaluation,
                        student=student,
                        grade_value=val,
                        is_absent=bool(grade_data.get("absent", False))
                    )
               
                return JsonResponse({"success": True, "message": "Évaluation créée."})

            # --- ACTION: UPDATE ---
            elif action == "update":
                evaluation_id = data.get("evaluation_id")
                # ... (Récupération données) ...
                name = data.get("name")
                coefficient = float(data.get("coefficient", 1.0))
                max_grade = float(data.get("max_grade", 20.0))
                grades_list = data.get("grades", [])
               
                evaluation = get_object_or_404(Evaluation, pk=evaluation_id)

                if evaluation.term_year.finished:
                    return JsonResponse({"success": False, "message": "Trimestre clos."}, status=403)

                if evaluation.teacher_subject.teacher != teacher_staff:
                     return JsonResponse({"success": False, "message": "Non autorisé."}, status=403)

                # Validation (Même logique)
                for grade_data in grades_list:
                    grade_val = grade_data.get("grade")
                    is_absent = bool(grade_data.get("absent", False))
                    if not is_absent and grade_val is not None and grade_val != "":
                        try:
                            if float(grade_val) > max_grade:
                                return JsonResponse({"success": False, "message": "Note hors limite."}, status=400)
                        except ValueError:
                             return JsonResponse({"success": False, "message": "Note invalide."}, status=400)

                evaluation.name = name
                evaluation.coefficient = coefficient
                evaluation.max_grade = max_grade
                evaluation.save()
               
                for grade_data in grades_list:
                    val = None
                    raw_val = grade_data.get("grade")
                    if raw_val is not None and raw_val != "":
                        val = float(raw_val)

                    Grade.objects.update_or_create(
                        evaluation=evaluation,
                        student_id=grade_data.get("student_id"),
                        defaults={
                            'grade_value': val,
                            'is_absent': bool(grade_data.get("absent", False))
                        }
                    )

                return JsonResponse({"success": True, "message": "Évaluation mise à jour."})

            # --- ACTION: DELETE ---
            elif action == "delete":
                evaluation_id = data.get("evaluation_id")
                evaluation = get_object_or_404(Evaluation, pk=evaluation_id)
                
                if evaluation.term_year.finished:
                    return JsonResponse({"success": False, "message": "Trimestre clos."}, status=403)
               
                if evaluation.teacher_subject.teacher != teacher_staff:
                     return JsonResponse({"success": False, "message": "Non autorisé."}, status=403)

                evaluation.delete()
                return JsonResponse({"success": True, "message": "Évaluation supprimée."})

            # --- ACTION: GET_DETAILS ---
            elif action == "get_details":
                evaluation_id = data.get("evaluation_id")
                evaluation = get_object_or_404(Evaluation, pk=evaluation_id)
                
                grades = Grade.objects.filter(evaluation=evaluation)
                grades_data = list(grades.values('student_id', 'grade_value', 'is_absent'))
                
                return JsonResponse({
                    "success": True, 
                    "grades": grades_data, 
                    "details": {
                        "name": evaluation.name,
                        "coefficient": evaluation.coefficient,
                        "max_grade": evaluation.max_grade
                    }
                })
               
            else:
                return JsonResponse({"success": False, "message": "Action inconnue."}, status=400)

    except Exception as e:
        print(f"Erreur api_manage_evaluation: {e}")
        return JsonResponse({"success": False, "message": f"Erreur interne: {str(e)}"}, status=500)
    

@login_required(login_url='login')
def view_my_grades_student(request):
    """
    Affiche le relevé de notes pour l'ÉLÈVE connecté.
    Lecture seule.
    """
    user = request.user
    user_type = get_user_type(user)

    student = None
    
    if user_type == "Parent":
        student = get_student_context(request)
    # 1. Vérification des permissions
    elif user_type == "Student":
        try:
            # On récupère le profil Student lié au User
            student = Student.objects.get(user=user)
        except Student.DoesNotExist:
            return render(request, "404.html", status=404)
    else:
        return render(request, "404.html", status=404)


    # 2. Vérification de l'année scolaire
    current_year = get_current_year_for_school(student.school)
    if not current_year:
        return render(request, 'grades/student_grades.html', {
            'error': "Aucune année scolaire active configurée pour votre école."
        })

    # 3. Récupération des données via l'utilitaire
    data = get_student_grades_view_data(student, current_year)

    if data is None:
        return render(request, 'grades/student_grades.html', {
            'error': "Vous n'êtes inscrit dans aucune classe pour cette année scolaire."
        })

    # 4. Construction du contexte
    context = {
        'student': data['student'],
        'student_class': data['student_class'],
        'terms_data': data['terms_data'], # La liste structurée par trimestre
        'current_year': current_year,
    }

    # Note: Nous n'avons pas besoin de 'initial_data_for_script' ici car 
    # la vue élève est plus simple (pas d'AJAX complexe, tout est chargé au rendu).
    
    return render(request, 'grades/student_grades.html', context)



# ====================================================================
# VUES POUR LES APPRÉCIATIONS
# ====================================================================

@login_required(login_url='login')
def view_appreciations_dashboard(request):
    """
    Affiche le tableau de bord de saisie des appréciations pour le PROFESSEUR CONNECTÉ.
    """
    user = request.user
    user_type = get_user_type(user)

    # 1. Permissions
    if user_type not in ["Teacher"]:
        return render(request, "404.html", status=404)
        
    try:
        # Le prof connecté
        teacher_staff = get_object_or_404(Staff, user=user)
    except Staff.DoesNotExist:
        return render(request, "404.html", status=404)

    # 2. Année scolaire
    current_year = get_current_year_for_school(teacher_staff.school)
    if not current_year:
        return render(request, "404.html", status=404)

    # 3. Récupération des données
    dashboard_data = get_appreciations_dashboard_data(teacher_staff, current_year)

    # 4. Contexte
    context = {
        'teacher_staff': teacher_staff,
        'current_year': current_year,
        'dashboard_data': dashboard_data,
        'initial_data_for_script': dashboard_data,
        'can_edit_appreciations': True, 
    }

    return render(request, 'grades/appreciations_dashboard.html', context)


@login_required(login_url='login')
def view_teacher_appreciations_as_admin(request, pk_staff):
    """
    Affiche le tableau de bord des appréciations d'un PROFESSEUR CIBLÉ.
    Vue réservée aux Admins/Proviseurs (Lecture Seule).
    """
    user = request.user
    user_type = get_user_type(user)

    # 1. Vérification des permissions
    if user_type not in ["SuperAdministrator", "Principal"]:
        return render(request, "404.html", status=404)        
    try:
        # C'est le prof qu'on REGARDE
        teacher_staff = get_object_or_404(Staff, pk=pk_staff) 
    except Staff.DoesNotExist:
        return render(request, "404.html", status=404)

    # 2. Vérification de l'année scolaire
    current_year = get_current_year_for_school(teacher_staff.school)
    if not current_year:
        return render(request, "404.html", status=404)

    # 3. Récupération des données
    dashboard_data = get_appreciations_dashboard_data(teacher_staff, current_year)

    # 4. Contexte
    context = {
        'teacher_staff': teacher_staff, # Le prof ciblé
        'current_year': current_year,
        'dashboard_data': dashboard_data,
        'initial_data_for_script': dashboard_data,
        'can_edit_appreciations': False,
    }

    return render(request, 'grades/appreciations_dashboard.html', context)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_get_appreciations_for_term(request):
    """
    API pour récupérer la liste des élèves et leurs appréciations.
    Utilisée par les deux vues (Prof et Admin).
    """
    try:
        data = json.loads(request.body)
        term_id = data.get("term_id")
        class_id = data.get("class_id")
        ts_id = data.get("ts_id")
        is_global = data.get("is_global", False)

        term_year = get_object_or_404(TermYearLevel, pk=term_id)
        student_class = get_object_or_404(Class, pk=class_id)
        current_year = term_year.year

        context_data = get_appreciations_data_for_context(
            current_year, 
            student_class, 
            teacher_subject_id=ts_id, 
            selected_term=term_year, 
            is_global=is_global
        )
        
        return JsonResponse({"success": True, "data": context_data})

    except Exception as e:
        print(f"Erreur API Appreciations Get: {e}")
        return JsonResponse({"success": False, "message": str(e)}, status=500)


@require_http_methods(["POST"])
@csrf_exempt
@login_required(login_url='login')
def api_save_appreciations(request):
    """
    API pour ENREGISTRER les appréciations.
    Réservée strictement aux professeurs.
    """
    user = request.user
    user_type = get_user_type(user)

    # Sécurité supplémentaire côté API
    if user_type != "Teacher":
        return JsonResponse({"success": False, "message": "Seuls les professeurs peuvent saisir des appréciations."}, status=403)

    try:
        data = json.loads(request.body)
        
        term_id = data.get("term_id")
        ts_id = data.get("ts_id")
        is_global = data.get("is_global", False)
        students_data = data.get("students_data", [])

        term_year = get_object_or_404(TermYearLevel, pk=term_id)
        
        if term_year.finished:
             return JsonResponse({"success": False, "message": "Ce trimestre est clos. Modification impossible."}, status=403)

        teacher_subject = None
        if not is_global and ts_id:
            teacher_subject = get_object_or_404(TeacherSubject, pk=ts_id)
            if teacher_subject.teacher.user != user:
                return JsonResponse({"success": False, "message": "Vous ne pouvez pas modifier les appréciations d'un autre professeur."}, status=403)

        with transaction.atomic():
            count_updated = 0
            
            for item in students_data:
                student_id = item.get("student_id")
                content = item.get("content", "").strip()
                mention_code = item.get("mention", "")

                student = get_object_or_404(Student, pk=student_id)

                Appreciation.objects.update_or_create(
                    student=student,
                    term_year=term_year,
                    teacher_subject=teacher_subject,
                    is_global=is_global,
                    defaults={'content': content}
                )

                if is_global:
                    if mention_code:
                        Mention.objects.update_or_create(
                            student=student,
                            term_year=term_year,
                            defaults={'mention_type': mention_code}
                        )
                    else:
                        Mention.objects.filter(student=student, term_year=term_year).delete()
                
                count_updated += 1

        return JsonResponse({"success": True, "message": f"{count_updated} appréciations enregistrées."})

    except Exception as e:
        print(f"Erreur API Appreciations Save: {e}")
        return JsonResponse({"success": False, "message": str(e)}, status=500)