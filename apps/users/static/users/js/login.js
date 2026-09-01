// ============================================
// تهيئة إعدادات Tailwind لتجنب الأكواد المدمجة في الـ HTML
// ============================================
if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                colors: {
                    primary: "#307e92",
                    accent: "#b59b66",
                }
            },
        },
    };
}

// ============================================
// تسجيل الدخول - الوضع الليلي - Login Page Dark Mode
// ============================================

console.log('✅ login.js loaded successfully');

// الوضع الليلي
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

// استعادة الوضع الليلي
if (localStorage.getItem('darkMode') === 'dark') {
    document.documentElement.classList.add('dark');
    const icon = document.getElementById('darkIcon');
    if (icon) icon.innerText = 'light_mode';
}

// إضافة كلاس dark للتايلويند
if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.add('dark');
}

// Bind to window for global access
window.toggleDarkMode = toggleDarkMode;

// تفعيل ميزة إظهار وإخفاء كلمة المرور
document.addEventListener('DOMContentLoaded', () => {
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');
    
    if (togglePasswordBtn && passwordInput && eyeIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                eyeIcon.innerText = 'visibility';
            } else {
                passwordInput.type = 'password';
                eyeIcon.innerText = 'visibility_off';
            }
        });
    }
});
