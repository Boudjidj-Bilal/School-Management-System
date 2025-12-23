from django.urls import path
from . import views

app_name = 'documents'

urlpatterns = [
    # Gestion des Bulletins (Proviseur / Prof)
    path('manage/<int:class_id>/<int:term_id>/', views.manage_class_report_cards, name='manage_class_report_cards'),
    path('regenerate/<int:report_card_id>/', views.regenerate_single_report_card, name='regenerate_single_report_card'),

    # GED (Upload Admin)
    path('upload/', views.upload_document, name='upload_document'),
    
    path('download/<int:report_card_id>/', views.download_report_card, name='download_report_card'),

    # Vue Élève / Parent
    path('my-documents/', views.my_documents, name='my_documents'),

    path('statistiques/download/', views.download_school_statistics, name='download_stats'),
]