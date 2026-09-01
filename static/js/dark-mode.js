// ========================================
// الوضع الليلي (Dark Mode) - بدون رمش
// ========================================

// تطبيق الوضع الليلي فوراً قبل تحميل الصفحة
(function() {
    const savedMode = localStorage.getItem('darkMode');
    const isDark = savedMode === 'dark';
    
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
})();

// دالة تبديل الوضع الليلي
function toggleDarkMode() {
    const html = document.documentElement;
    const icon = document.getElementById('darkIcon');
    
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        if (icon) icon.innerText = 'dark_mode';
        localStorage.setItem('darkMode', 'light');
    } else {
        html.classList.add('dark');
        if (icon) icon.innerText = 'light_mode';
        localStorage.setItem('darkMode', 'dark');
    }
}

// تحديث الأيقونة
function updateDarkIcon() {
    const icon = document.getElementById('darkIcon');
    if (icon) {
        const isDark = document.documentElement.classList.contains('dark');
        icon.innerText = isDark ? 'light_mode' : 'dark_mode';
    }
}

// عند تحميل الصفحة نحدث الأيقونة
document.addEventListener('DOMContentLoaded', function() {
    updateDarkIcon();
});