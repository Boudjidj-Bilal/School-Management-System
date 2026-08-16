/**
 * statistics_dashboard.js
 * Logique du tableau de bord des statistiques (Chart.js, Fetch API, Export PDF)
 * Multilingue & Production Safe
 */

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------------------
    // 1. CONFIGURATION & RÉFÉRENCES DOM
    // ----------------------------------------------------------------------
    const container = document.getElementById('statistics-container');
    if (!container) return;

    // Récupération des URLs et Messages depuis les data-attributes (i18n)
    const API_URL = container.dataset.apiUrl;
    const MSG_ERROR = container.dataset.msgError || "Une erreur est survenue.";
    const MSG_EMPTY = container.dataset.msgEmpty || "Aucune donnée.";
    const MSG_TITLE_AVERAGES = container.dataset.msgTitleAverages || "Moyenne";
    const MSG_TITLE_ABSENCES = container.dataset.msgTitleAbsences || "Absences";
    const MSG_TITLE_DELAYS = container.dataset.msgTitleDelays || "Retards";

    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;

    // Références UI
    const loaderOverlay = document.getElementById('loader-overlay');
    const errorNotification = document.getElementById('error-notification');
    const errorMessageText = document.getElementById('error-message-text');
    
    // Filtres
    const yearSelect = document.getElementById('year-select');
    const termSelect = document.getElementById('term-select');
    
    // Bouton & Formulaire PDF
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const pdfExportForm = document.getElementById('pdf-export-form');

    // Dictionnaire pour stocker les instances des graphiques
    let chartInstances = {
        averages: null,
        mentions: null,
        attendance: null,
        demographics: null
    };

    // Couleurs globales pour Chart.js (esthétique)
    const colors = {
        indigo: 'rgba(79, 70, 229, 0.8)',
        indigoBorder: 'rgba(79, 70, 229, 1)',
        pink: 'rgba(236, 72, 153, 0.8)',
        pinkBorder: 'rgba(236, 72, 153, 1)',
        orange: 'rgba(249, 115, 22, 0.8)',
        orangeBorder: 'rgba(249, 115, 22, 1)',
        red: 'rgba(239, 68, 68, 0.8)',
        redBorder: 'rgba(239, 68, 68, 1)',
        green: 'rgba(34, 197, 94, 0.8)',
        greenBorder: 'rgba(34, 197, 94, 1)',
        yellow: 'rgba(234, 179, 8, 0.8)',
        yellowBorder: 'rgba(234, 179, 8, 1)'
    };


    // ----------------------------------------------------------------------
    // 2. UTILITAIRES UX
    // ----------------------------------------------------------------------
    function showLoader() {
        loaderOverlay.classList.remove('hidden');
        loaderOverlay.classList.add('flex');
        btnExportPdf.disabled = true;
    }

    function hideLoader() {
        loaderOverlay.classList.remove('flex');
        loaderOverlay.classList.add('hidden');
        btnExportPdf.disabled = false;
    }

    function showError(message) {
        errorMessageText.textContent = message;
        errorNotification.classList.remove('hidden');
        // Masquer les canvas s'il y a une erreur
        document.querySelectorAll('canvas').forEach(c => c.style.display = 'none');
        btnExportPdf.disabled = true;
    }

    function hideError() {
        errorNotification.classList.add('hidden');
        document.querySelectorAll('canvas').forEach(c => c.style.display = 'block');
    }


    // ----------------------------------------------------------------------
    // 3. LOGIQUE DE FETCH (APPEL API)
    // ----------------------------------------------------------------------
    async function loadStatistics() {
        const yearId = yearSelect.value;
        const termId = termSelect.value;

        if (!yearId) return;

        showLoader();
        hideError();

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ year_id: yearId, term_id: termId })
            });

            const result = await response.json();

            if (result.success) {
                renderCharts(result.data);
            } else {
                showError(result.message || MSG_ERROR);
            }
        } catch (error) {
            console.error("API Error:", error);
            showError(MSG_ERROR);
        } finally {
            hideLoader();
        }
    }


    // ----------------------------------------------------------------------
    // 4. MOTEUR DE RENDU CHART.JS
    // ----------------------------------------------------------------------
    function renderCharts(data) {
        
        // --- A. Graphique : Moyennes par Niveau (Bar Chart) ---
        if (chartInstances.averages) chartInstances.averages.destroy();
        const ctxAverages = document.getElementById('chart-averages').getContext('2d');
        chartInstances.averages = new Chart(ctxAverages, {
            type: 'bar',
            data: {
                labels: data.averages.labels,
                datasets: [{
                    label: MSG_TITLE_AVERAGES,
                    data: data.averages.data,
                    backgroundColor: colors.indigo,
                    borderColor: colors.indigoBorder,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 20 }
                }
            }
        });

        // --- B. Graphique : Répartition des Mentions (Doughnut) ---
        if (chartInstances.mentions) chartInstances.mentions.destroy();
        const ctxMentions = document.getElementById('chart-mentions').getContext('2d');
        chartInstances.mentions = new Chart(ctxMentions, {
            type: 'doughnut',
            data: {
                labels: data.mentions.labels,
                datasets: [{
                    data: data.mentions.data,
                    backgroundColor: [colors.green, colors.indigo, colors.yellow, colors.orange, colors.pink, colors.red],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });

        // --- C. Graphique : Bilan d'Assiduité (Grouped Bar Chart) ---
        if (chartInstances.attendance) chartInstances.attendance.destroy();
        const ctxAttendance = document.getElementById('chart-attendance').getContext('2d');
        chartInstances.attendance = new Chart(ctxAttendance, {
            type: 'bar',
            data: {
                labels: data.attendance.labels, // ["Justifié", "Non Justifié"]
                datasets: [
                    {
                        label: MSG_TITLE_ABSENCES,
                        data: data.attendance.absences,
                        backgroundColor: colors.red,
                        borderColor: colors.redBorder,
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: MSG_TITLE_DELAYS,
                        data: data.attendance.delays,
                        backgroundColor: colors.orange,
                        borderColor: colors.orangeBorder,
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // --- D. Graphique : Démographie (Pie Chart) ---
        if (chartInstances.demographics) chartInstances.demographics.destroy();
        const ctxDemographics = document.getElementById('chart-demographics').getContext('2d');
        chartInstances.demographics = new Chart(ctxDemographics, {
            type: 'pie',
            data: {
                labels: data.demographics.labels, // ["Filles", "Garçons"]
                datasets: [{
                    data: data.demographics.data,
                    backgroundColor: [colors.pink, colors.indigo],
                    borderColor: [colors.pinkBorder, colors.indigoBorder],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }


    // ----------------------------------------------------------------------
    // 5. LOGIQUE EXPORT PDF (Capture Base64)
    // ----------------------------------------------------------------------
    function exportToPDF() {
        // Vérifier que les graphiques sont bien initialisés
        if (!chartInstances.averages || !chartInstances.mentions) return;

        // 1. Récupération du texte des filtres pour l'en-tête du PDF
        const yearText = yearSelect.options[yearSelect.selectedIndex].text;
        const termText = termSelect.options[termSelect.selectedIndex] 
                         ? termSelect.options[termSelect.selectedIndex].text 
                         : "";

        // 2. Remplissage des champs textuels
        document.getElementById('pdf-year-name').value = yearText;
        document.getElementById('pdf-term-name').value = termText;

        // 3. Transformation de chaque Canvas en image Base64
        // L'astuce .toBase64Image() est native à Chart.js et capture le canvas
        document.getElementById('pdf-chart-averages').value = chartInstances.averages.toBase64Image();
        document.getElementById('pdf-chart-mentions').value = chartInstances.mentions.toBase64Image();
        document.getElementById('pdf-chart-attendance').value = chartInstances.attendance.toBase64Image();
        document.getElementById('pdf-chart-demographics').value = chartInstances.demographics.toBase64Image();

        // 4. Soumission du formulaire caché (Post vers la vue WeasyPrint)
        pdfExportForm.submit();
    }


    // ----------------------------------------------------------------------
    // 6. INITIALISATION & LISTENERS
    // ----------------------------------------------------------------------
    
    // Écouteurs de changement sur les filtres
    yearSelect.addEventListener('change', loadStatistics);
    termSelect.addEventListener('change', loadStatistics);
    
    // Écouteur sur le bouton Export PDF
    btnExportPdf.addEventListener('click', exportToPDF);

    // Lancement au premier chargement de la page
    loadStatistics();

});