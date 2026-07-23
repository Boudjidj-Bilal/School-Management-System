// document.addEventListener('DOMContentLoaded', function() {
//     const loginForm = document.getElementById('loginForm');
//     if (!loginForm) return;

//     const geoUrl = loginForm.dataset.geoUrl;
//     const loginUrl = loginForm.dataset.loginUrl;

//     console.log("Geolocation script chargé. URL de géo:", geoUrl);

//     function handleStudentGeolocation() {
//         console.log("Tentative de récupération de la géolocalisation...");
//         if (!navigator.geolocation) {
//             console.warn("La géolocalisation n'est pas supportée par ce navigateur.");
//             return;
//         }

//         // Vérification de l'environnement (Rappel: HTTPS requis hors localhost)
//         if (location.protocol !== 'http:' && location.protocol !== 'https:') {
//             console.warn("Protocole non pris en charge pour la géolocalisation.");
//         }

//         navigator.geolocation.getCurrentPosition(
//             function(position) {
//                 console.log("Position GPS obtenue avec succès :", position.coords.latitude, position.coords.longitude);
//                 const latitude = position.coords.latitude;
//                 const longitude = position.coords.longitude;
//                 const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

//                 fetch(geoUrl, {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json',
//                         'X-CSRFToken': csrfToken
//                     },
//                     body: JSON.stringify({
//                         latitude: latitude,
//                         longitude: longitude
//                     })
//                 })
//                 .then(res => res.json())
//                 .then(data => console.log("Réponse du serveur (géo) :", data))
//                 .catch(err => console.error("Erreur réseau lors de l'envoi de la géo:", err));
//             },
//             function(error) {
//                 console.warn("Erreur ou refus de géolocalisation par l'utilisateur (Code " + error.code + ") :", error.message);
//             },
//             {
//                 timeout: 10000,
//                 maximumAge: 60000
//             }
//         );
//     }

//     // 1. Interception universelle de FETCH
//     const originalFetch = window.fetch;
//     window.fetch = async function(...args) {
//         const response = await originalFetch.apply(this, args);
//         if (args[0] && typeof args[0] === 'string' && args[0].includes(loginUrl)) {
//             const clone = response.clone();
//             clone.json().then(data => {
//                 console.log("Fetch login intercepté, data:", data);
//                 if (data.success && data.is_student === true) {
//                     handleStudentGeolocation();
//                 }
//             }).catch(() => {});
//         }
//         return response;
//     };

//     // 2. Interception universelle de XMLHTTPREQUEST (au cas où login_page.js utilise AJAX classique)
//     const originalOpen = XMLHttpRequest.prototype.open;
//     XMLHttpRequest.prototype.open = function(method, url) {
//         this._url = url;
//         return originalOpen.apply(this, arguments);
//     };

//     const originalSend = XMLHttpRequest.prototype.send;
//     XMLHttpRequest.prototype.send = function() {
//         this.addEventListener('load', function() {
//             if (this._url && this._url.includes(loginUrl)) {
//                 try {
//                     const data = JSON.parse(this.responseText);
//                     console.log("XHR login intercepté, data:", data);
//                     if (data.success && data.is_student === true) {
//                         handleStudentGeolocation();
//                     }
//                 } catch(e) {}
//             }
//         });
//         return originalSend.apply(this, arguments);
//     };
// });