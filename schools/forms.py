from django import forms
from .models import School

class SchoolUpdateForm(forms.ModelForm):
    class Meta:
        model = School
        # SEULS ces champs seront modifiables. 
        # Django ignorera toute tentative de modification des autres champs.
        fields = ['logo', 'principal_signature', 'primary_color']
        
        widgets = {
            # On transforme le champ texte en véritable sélecteur de couleur HTML5
            'primary_color': forms.TextInput(attrs={
                'type': 'color', 
                'class': 'h-10 w-20 p-1 rounded cursor-pointer border border-gray-300'
            }),
            # On peut ajouter du style pour les inputs fichiers
            'logo': forms.FileInput(attrs={'class': 'block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100'}),
            'principal_signature': forms.FileInput(attrs={'class': 'block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100'}),
        }
        labels = {
            'logo': 'Logo de l\'établissement',
            'principal_signature': 'Signature du Chef d\'établissement (Image)',
            'primary_color': 'Couleur principale (Utilisée sur les bulletins)',
        }