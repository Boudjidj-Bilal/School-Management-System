from django.shortcuts import render

# Create your views here.

from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden, Http404, FileResponse
from django.template.loader import render_to_string
from django.core.files.base import ContentFile
from django.contrib import messages

from django.shortcuts import get_object_or_404

# Librairie PDF
try:
    from weasyprint import HTML
except ImportError:
    HTML = None 

# Imports locaux
from .models import ReportCard, StudentDocument
from .utils import get_report_card_context
from schools.models import TermYearLevel
from schools.utils import get_user_school
from classes.models import Class
from users.models import Student
from users.utils import get_user_type, get_student_context

# ==============================================================================
# 1. HELPER : GÉNÉRATION DU PDF (Backend pur)
# ==============================================================================
def _generate_and_save_pdf(student, term, request):
    """
    Fonction interne qui génère le PDF et ÉCRASE l'ancien fichier s'il existe.
    """
    if HTML is None:
        return False, "WeasyPrint n'est pas installé."

    # 1. Récupération du contexte complet
    context = get_report_card_context(student, term)
    if not context:
        return False, "Impossible de récupérer les données (élève non inscrit ?)"

    # Base URL pour les images
    base_url = request.build_absolute_uri('/')

    # 2. Rendu HTML
    html_string = render_to_string('documents/report_card_pdf.html', context, request=request)

    # 3. Conversion PDF
    try:
        pdf_file = HTML(string=html_string, base_url=base_url).write_pdf()
    except Exception as e:
        return False, f"Erreur WeasyPrint : {e}"

    # 4. Sauvegarde avec ÉCRASEMENT
    
    # On récupère l'objet s'il existe, sinon on le crée
    report_card, created = ReportCard.objects.get_or_create(
        student=student,
        term=term
    )

    # [CORRECTION IMPORTANTE] 
    # Si le bulletin existait déjà (pas created) et qu'il a un fichier lié,
    # on supprime physiquement l'ancien fichier du disque avant d'en mettre un nouveau.
    if not created and report_card.file:
        try:
            # delete(save=False) supprime le fichier du disque dur
            # save=False évite de déclencher une sauvegarde inutile de la BDD tout de suite
            report_card.file.delete(save=False)
        except Exception:
            pass # Si le fichier n'existait pas physiquement, on continue sans planter

    term_short_name = f"T{term.counter}"
    # Nom du fichier : Bulletin_Trimestre1_Nom_Prenom.pdf
    # On nettoie le nom du trimestre pour éviter des espaces dans le fichier
    filename = f"Bulletin_{term_short_name}_{student.user.last_name}_{student.user.first_name}.pdf".replace(" ", "_")   

    # Sauvegarde du nouveau contenu binaire
    # Comme l'ancien fichier a été supprimé juste avant, Django réutilisera le nom "propre" sans ajouter _123
    report_card.file.save(filename, ContentFile(pdf_file))
    
    # Mise à jour de la date de modification (updated_at)
    report_card.save()

    return True, "Succès"


# ==============================================================================
# 2. VUES GESTION (Proviseur / Prof Principal)
# ==============================================================================

@login_required
def manage_class_report_cards(request, class_id, term_id):
    """
    Tableau de bord pour générer/publier les bulletins d'une classe.
    """
    user = request.user
    user_type = get_user_type(user)

    student_class = get_object_or_404(Class, pk=class_id)
    current_term = get_object_or_404(TermYearLevel, pk=term_id)

    can_generate = current_term.finished

    all_terms = TermYearLevel.objects.filter(
        year=current_term.year,
        level=student_class.level
    ).order_by('counter') # 1, 2, 3

    # --- 1. Vérification Permissions ---
    is_admin = user_type in ["SuperAdministrator", "Principal"]
    is_main_teacher = False
    
    if user_type == "Teacher" and hasattr(user, 'staff_user'):
        if student_class.main_teacher == user.staff_user:
            is_main_teacher = True
    
    if not (is_admin or is_main_teacher):
        return render(request, "404.html", status=403)

    # --- 2. Gestion des Actions (POST) ---
    if request.method == "POST":
        action = request.POST.get('action')
        
        # Action : GÉNÉRER TOUT
        if action == "generate_all":
            # [REGLE] Le trimestre doit être fini (ou on est admin et on force)
            if not current_term.finished:
                messages.error(request, "Le trimestre n'est pas terminé. Impossible de générer les bulletins.")
            else:
                students = Student.objects.filter(class_years__student_class=student_class, class_years__year=current_term.year, class_years__is_active=True)
                count = 0
                for student in students:
                    success, msg = _generate_and_save_pdf(student, current_term, request)
                    if success: count += 1
                messages.success(request, f"{count} bulletins générés avec succès.")
        
        # Action : PUBLIER TOUT / DÉPUBLIER TOUT
        elif action in ["publish_all", "unpublish_all"]:
            is_pub = (action == "publish_all")
            
            ReportCard.objects.filter(
                term=current_term,
                # CORRECTION ICI : on utilise 'class_years' et on vérifie l'année
                student__class_years__student_class=student_class,
                student__class_years__year=current_term.year
            ).update(is_published=is_pub)
            
            status_msg = "publiés" if is_pub else "masqués"
            messages.success(request, f"Les bulletins ont été {status_msg} pour les élèves.")

        return redirect('documents:manage_class_report_cards', class_id=class_id, term_id=term_id)

    # --- 3. Affichage (GET) ---
    # On récupère la liste des élèves et leur bulletin s'il existe
    students = Student.objects.filter(
        class_years__student_class=student_class,
        class_years__year=current_term.year,
        class_years__is_active=True
    ).order_by('user__last_name')

    students_data = []
    for student in students:
        rc = ReportCard.objects.filter(student=student, term=current_term).first()
        students_data.append({
            'student': student,
            'report_card': rc # Peut être None
        })

    context = {
        'student_class': student_class,
        'term': current_term,
        'all_terms': all_terms,
        'students_data': students_data,
        'can_generate': can_generate, # Condition pour afficher le bouton
    }
    return render(request, 'documents/manage_report_cards.html', context)


@login_required
def regenerate_single_report_card(request, report_card_id):
    """
    Action unitaire : Régénérer un seul bulletin spécifique.
    """
    rc = get_object_or_404(ReportCard, pk=report_card_id)
    # Vérification permission rapide (à améliorer selon rigueur souhaitée)
    user_type = get_user_type(request.user)
    if user_type not in ["SuperAdministrator", "Principal", "Teacher"]:
        return HttpResponseForbidden()
    
    if not rc.term.finished:
        messages.error(request, "Impossible de régénérer : Le trimestre n'est pas clôturé.")
        return redirect(request.META.get('HTTP_REFERER', '/'))

    success, msg = _generate_and_save_pdf(rc.student, rc.term, request)
    if success:
        messages.success(request, f"Bulletin de {rc.student} mis à jour.")
    else:
        messages.error(request, f"Erreur : {msg}")
    
    # Retour à la page précédente
    return redirect(request.META.get('HTTP_REFERER', '/'))


# ==============================================================================
# 3. VUE GED (Upload de Documents Divers)
# ==============================================================================

@login_required
def upload_document(request):
    """
    Page pour déposer un document administratif pour un élève.
    CORRIGÉ : Filtre par école et Design amélioré.
    """
    user_type = get_user_type(request.user)
    if user_type not in ["SuperAdministrator", "Principal", "Administrator", "CPE"]:
        return render(request, "404.html", status=403)

    if request.method == "POST":
        student_id = request.POST.get('student_id')
        title = request.POST.get('title')
        category = request.POST.get('category')
        pdf_file = request.FILES.get('pdf_file')

        if student_id and title and pdf_file:
            # Sécurité supplémentaire : On vérifie que l'élève appartient bien à l'école du staff
            # (Sauf pour le SuperAdmin qui a tous les droits)
            student_qs = Student.objects.filter(pk=student_id)
            
            if user_type != "SuperAdministrator":
                try:
                    # On s'assure que le staff existe
                    current_school = request.user.staff_user.school
                    # On filtre pour vérifier que l'élève est bien dans cette école
                    student_qs = student_qs.filter(school=current_school)
                except AttributeError:
                    messages.error(request, "Erreur : Votre profil staff est incomplet.")
                    return redirect('documents:upload_document')

            student = student_qs.first()

            if student:
                StudentDocument.objects.create(
                    student=student,
                    uploaded_by=request.user,
                    title=title,
                    category=category,
                    file=pdf_file
                )
                messages.success(request, f"Document ajouté avec succès pour {student}.")
                return redirect('documents:upload_document')
            else:
                messages.error(request, "Élève introuvable ou ne faisant pas partie de votre établissement.")
        else:
            messages.error(request, "Veuillez remplir tous les champs.")

    # --- RÉCUPÉRATION DES CLASSES (FILTRÉE PAR ÉCOLE) ---
    classes_qs = Class.objects.filter(student_years__year__running=True)

    if user_type != "SuperAdministrator":
        # Si c'est un Proviseur/CPE/Admin, on filtre par SON école
        try:
            current_school = request.user.staff_user.school
            # On suppose que l'année (Year) est liée à l'école (School)
            classes_qs = classes_qs.filter(student_years__year__school=current_school)
        except AttributeError:
             classes_qs = Class.objects.none() # Sécurité

    # .distinct() est vital car le join sur student_years peut dupliquer les lignes
    classes = classes_qs.distinct().order_by('name')
    
    return render(request, 'documents/upload_document.html', {'classes': classes})

# ==============================================================================
# 4. VUE ÉLÈVE / PARENT (Mes Documents)
# ==============================================================================

@login_required
def my_documents(request):
    """
    Affiche les bulletins PUBLIÉS et les documents administratifs.
    """
    user_type = get_user_type(request.user)
    student = None

    if user_type == "Student":
        student = Student.objects.get(user=request.user)
    elif user_type == "Parent":
        student = get_student_context(request)
    
    if not student:
        return render(request, "404.html", status=404)

    # 1. Récupérer les bulletins PUBLIÉS
    report_cards = ReportCard.objects.filter(
        student=student, 
        is_published=True
    ).select_related('term', 'term__year').order_by('-term__year__start_date', '-term__counter')

    # 2. Récupérer les autres documents
    documents = StudentDocument.objects.filter(
        student=student
    ).order_by('-created_at')

    context = {
        'report_cards': report_cards,
        'documents': documents,
        'student': student
    }
    return render(request, 'documents/student_documents.html', context)


@login_required
def download_report_card(request, report_card_id):
    # 1. On récupère l'objet en base de données
    rc = get_object_or_404(ReportCard, pk=report_card_id)

    user = request.user
    type = get_user_type(user) 

    # 2. VÉRIFICATION DES DROITS (Le Portier)
    is_owner = (user == rc.student.user)

    if not is_owner:
        if type not in ("SuperAdministrator", "Principal", "Parent"):
            return render(request, "404.html", status=404)

        
        school = get_user_school(request.user, request.session.get('selected_school_id'))
        if not school == rc.student.school:
            return render(request, "404.html", status=404)

        
        if type == "Parent":
            student = get_student_context(request)
            if not student == rc.student:
                return render(request, "404.html", status=404)


    # 3. Si tout est OK, on envoie le fichier manuellement
    if not rc.file:
        raise Http404("Le fichier n'existe pas.")

    # On ouvre le fichier depuis le dossier privé et on l'envoie
    response = FileResponse(rc.file.open('rb'), content_type='application/pdf')
    
    # Optionnel : Forcer le téléchargement ou l'affichage (ici 'inline' pour afficher dans le navigateur)
    response['Content-Disposition'] = f'inline; filename="Bulletin_{rc.student.user.last_name}.pdf"'
    return response