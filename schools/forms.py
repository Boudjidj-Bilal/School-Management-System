from django import forms
from .models import School
from django.utils.translation import gettext_lazy as _

class SchoolUpdateForm(forms.ModelForm):
    class Meta:
        model = School
        # NOUVEAU : Ajout du champ 'language' pour qu'il soit modifiable dans le formulaire
        fields = ['language', 'logo', 'principal_signature', 'primary_color']
        
        widgets = {
            # NOUVEAU : Style Tailwind pour le sélecteur de langue (avec padding logique ps/pe pour l'Arabe)
            'language': forms.Select(attrs={
                'class': 'mt-1 block w-full ps-3 pe-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md'
            }),
            
            # On transforme le champ texte en véritable sélecteur de couleur HTML5
            'primary_color': forms.TextInput(attrs={
                'type': 'color', 
                'class': 'h-10 w-20 p-1 rounded cursor-pointer border border-gray-300'
            }),
            
            # RTL FIX : 'file:mr-4' est devenu 'file:me-4' pour l'Arabe
            'logo': forms.FileInput(attrs={
                'class': 'block w-full text-sm text-gray-500 file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100'
            }),
            'principal_signature': forms.FileInput(attrs={
                'class': 'block w-full text-sm text-gray-500 file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100'
            }),
        }
        labels = {
            # Label traduit pour la langue
            'language': _("Langue de l'établissement"),
            
            # Utilisation de doubles guillemets pour éviter les \
            'logo': _("Logo de l'établissement"),
            'principal_signature': _("Signature du Chef d'établissement (Image)"),
            'primary_color': _("Couleur principale (Utilisée sur les bulletins)"),
        }