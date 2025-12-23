import pandas as pd
from django.http import HttpResponse

# Imports de tes modèles
from schools.models import TermYearLevel
from grades.models import Grade, Mention, Appreciation
from classes.models import ClassStudentYear

# Imports de tes fonctions de calcul existantes
from .utils import (
    calculate_overall_student_average,
    calculate_overall_class_average,
    get_student_attendance_stats
)

def calculate_global_main_average(student, term_year):
    """
    Fonction utilitaire locale pour calculer la Moyenne Générale "Principale"
    (Uniquement les évaluations avec is_main_grade=True sur toutes les matières)
    """
    grades = Grade.objects.filter(
        student=student,
        evaluation__term_year=term_year,
        evaluation__is_main_grade=True, # LE FILTRE IMPORTANT
        is_absent=False,
        grade_value__isnull=False
    ).select_related('evaluation')

    total_points = 0
    total_coeff = 0

    for g in grades:
        # On normalise sur 20 pour être cohérent
        normalized_value = (g.grade_value / g.evaluation.max_grade) * 20
        total_points += normalized_value * g.evaluation.coefficient
        total_coeff += g.evaluation.coefficient

    if total_coeff == 0:
        return None
    
    return round(total_points / total_coeff, 2)


def generate_statistics_excel(school=None):
    """
    Génère un fichier Excel contenant les statistiques détaillées.
    - Si school est fourni : Export pour cette école uniquement (Proviseur).
    - Si school est None : Export de TOUTES les écoles (SuperAdmin).
    """
    
    # 1. Sélection des données
    # On récupère tous les liens Élève-Année actifs
    # Si une école est spécifiée, on filtre, sinon on prend tout
    qs = ClassStudentYear.objects.filter(is_active=True).select_related(
        'student', 'student__user', 'student__school', 
        'student_class', 'student_class__level', 
        'year'
    )

    if school:
        qs = qs.filter(student__school=school)

    data = []

    # 2. Boucle de traitement (C'est la partie intensive)
    # On itère sur chaque inscription d'élève
    for link in qs:
        student = link.student
        student_class = link.student_class
        year = link.year
        
        # On doit récupérer les trimestres de cette année scolaire
        terms = TermYearLevel.objects.filter(year=year, level=student_class.level).order_by('counter')

        for term in terms:
            # Pour chaque trimestre, on calcule les données
            
            # A. Calculs Moyennes
            avg_gen_student = calculate_overall_student_average(student, term)
            avg_gen_class = calculate_overall_class_average(student_class, term)
            avg_main_student = calculate_global_main_average(student, term)
            # Pour la moyenne principale de classe, on pourrait faire une moyenne des avg_main_student de la classe
            # Mais pour l'instant, laissons vide ou calculons-le si critique (gourmand en ressources)
            
            # B. Mentions & Appréciations
            mention_obj = Mention.objects.filter(student=student, term_year=term).first()
            mention_text = mention_obj.get_mention_type_display() if mention_obj else ""
            
            appr_obj = Appreciation.objects.filter(student=student, term_year=term, is_global=True).first()
            appr_text = appr_obj.content if appr_obj else ""

            # C. Assiduité
            # Ta fonction retourne un dictionnaire { 'total_absences': X, ... }
            attendance = get_student_attendance_stats(student, term_year=term)

            # D. Construction de la ligne Excel
            row = {
                # --- CONTEXTE ---
                "École": student.school.name,
                "Année Scolaire": year.name,
                "Période": f"Trimestre {term.counter}",
                
                # --- IDENTITÉ ---
                "Niveau": student_class.level.get_level_display(),
                "Classe": student_class.name,
                "Nom": student.user.last_name,
                "Prénom": student.user.first_name,
                "Genre": student.get_gender_display(), # M ou F
                "Date Naissance": student.birth_date.strftime("%d/%m/%Y") if student.birth_date else "",

                # --- RÉSULTATS ---
                "Moy. Générale Élève": avg_gen_student,
                "Moy. Générale Classe": avg_gen_class,
                "Moy. Principale Élève": avg_main_student,
                # "Moy. Principale Classe": (Calculable mais lourd, on saute pour l'instant),
                "Mention": mention_text,
                "Appréciation": appr_text,

                # --- VIE SCOLAIRE ---
                "Absences Totales": attendance.get('total_absences', 0),
                "Absences Non Justif.": attendance.get('unjustified_absences', 0),
                "Retards Totaux": attendance.get('total_delays', 0),
                "Retards Non Justif.": attendance.get('unjustified_delays', 0),
            }
            data.append(row)

    # 3. Création du DataFrame Pandas
    if not data:
        # Si vide, on crée un Excel vide avec les colonnes
        df = pd.DataFrame(columns=["École", "Nom", "Message"])
        row = {"École": "-", "Nom": "-", "Message": "Aucune donnée trouvée pour les critères sélectionnés."}
        df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
    else:
        df = pd.DataFrame(data)

    # 4. Préparation de la réponse HTTP (Téléchargement)
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    filename = f"Statistiques_{school.name if school else 'GLOBAL'}.xlsx"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    # Export avec le moteur openpyxl
    df.to_excel(response, index=False, engine='openpyxl')
    
    return response

