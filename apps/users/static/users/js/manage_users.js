// ============================================
// إدارة الحسابات والمستخدمين - Manage Users JS
// ============================================

console.log('✅ manage_users.js loaded successfully');

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// دالة التنبيهات المنبثقة التلقائية (Toast Notification)
function showNotification(type, message) {
    const toast = document.getElementById('toastNotification');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    if (!toast || !icon || !msg) return;

    msg.innerText = message;
    if (type === 'success') {
        toast.className = "fixed bottom-5 left-5 z-50 transition-all duration-300 max-w-sm w-full bg-white dark:bg-[#1e293b] border-r-4 border-r-emerald-500 rounded-lg shadow-xl p-4 flex items-center gap-3";
        icon.className = "material-symbols-outlined text-emerald-500 text-2xl";
        icon.innerText = "check_circle";
    } else {
        toast.className = "fixed bottom-5 left-5 z-50 transition-all duration-300 max-w-sm w-full bg-white dark:bg-[#1e293b] border-r-4 border-r-rose-500 rounded-lg shadow-xl p-4 flex items-center gap-3";
        icon.className = "material-symbols-outlined text-rose-500 text-2xl";
        icon.innerText = "error";
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 4000);
}

// ============================================================
// تفعيل وتعطيل حالة المستخدم عبر AJAX (Toggle Switch)
// ============================================================
function toggleUserStatus(userId, username, btn) {
    const iconSpan = btn.querySelector('.material-symbols-outlined');
    const currentActive = btn.getAttribute('data-active') === 'true';

    // تأكيد بصري فوري أثناء الطلب
    if (iconSpan) {
        iconSpan.textContent = 'progress_activity';
        iconSpan.classList.add('animate-spin');
    }

    fetch(`/users/api/toggle-user-status/${userId}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
        .then(res => res.json())
        .then(data => {
            if (iconSpan) iconSpan.classList.remove('animate-spin');
            if (data.success) {
                if (data.is_active) {
                    btn.className = "p-1 rounded-lg transition-all focus:outline-none text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30";
                    btn.title = "الحساب مفعل (انقر للتعطيل)";
                    btn.setAttribute('data-active', 'true');
                    if (iconSpan) iconSpan.textContent = "toggle_on";
                    showNotification('success', `✅ تم تفعيل حساب المستخدم (${username}) بنجاح.`);
                } else {
                    btn.className = "p-1 rounded-lg transition-all focus:outline-none text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30";
                    btn.title = "الحساب معطل (انقر للتفعيل)";
                    btn.setAttribute('data-active', 'false');
                    if (iconSpan) iconSpan.textContent = "toggle_off";
                    showNotification('success', `⚠️ تم تعطيل حساب المستخدم (${username}) بنجاح.`);
                }
            } else {
                if (iconSpan) iconSpan.textContent = currentActive ? 'toggle_on' : 'toggle_off';
                showNotification('error', data.error || 'حدث خطأ أثناء تغيير حالة الحساب.');
            }
        })
        .catch(err => {
            if (iconSpan) {
                iconSpan.classList.remove('animate-spin');
                iconSpan.textContent = currentActive ? 'toggle_on' : 'toggle_off';
            }
            showNotification('error', 'فشل الاتصال بالخادم.');
            console.error(err);
        });
}

// Bind to window for templates to access
window.toggleUserStatus = toggleUserStatus;
window.showNotification = showNotification;

document.addEventListener('DOMContentLoaded', function () {
    const filterForm = document.getElementById('usersFilterForm');
    const roleSelect = document.getElementById('filterRole');
    const groupSelect = document.getElementById('filterGroup');

    if (roleSelect && filterForm) {
        roleSelect.addEventListener('change', function () {
            filterForm.submit();
        });
    }
    if (groupSelect && filterForm) {
        groupSelect.addEventListener('change', function () {
            filterForm.submit();
        });
    }
});
