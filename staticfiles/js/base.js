document.addEventListener('DOMContentLoaded', function() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('sidebar-wrapper');
    const overlay = document.getElementById('sidebar-overlay');
    
    // On détecte si on est en Arabe (RTL) ou en Français (LTR)
    const isRTL = document.documentElement.dir === 'rtl';
    
    // En RTL, on cache le menu vers la droite (translate-x-full)
    // En LTR, on cache le menu vers la gauche (-translate-x-full)
    const hideClass = isRTL ? 'translate-x-full' : '-translate-x-full';
    
    function openSidebar() {
        if (!sidebar || !overlay) return;
        
        // On retire la classe de masquage
        sidebar.classList.remove(hideClass);
        
        overlay.classList.remove('hidden');
        setTimeout(() => { overlay.classList.remove('opacity-0'); }, 10);
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        if (!sidebar || !overlay) return;
        
        // On remet la classe de masquage
        sidebar.classList.add(hideClass);
        
        overlay.classList.add('opacity-0');
        setTimeout(() => { overlay.classList.add('hidden'); }, 300);
        document.body.style.overflow = '';
    }

    if(mobileBtn) mobileBtn.addEventListener('click', openSidebar);
    if(closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if(overlay) overlay.addEventListener('click', closeSidebar);
});