/**
 * ============================================================
 * تغيير كلمة المرور - بوابة الطالب
 * personal_info.js  v1.1.0
 * ============================================================
 */

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

function togglePass(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const icon = btnElement ? btnElement.querySelector('.material-symbols-outlined') : null;

    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        if (icon) icon.textContent = 'visibility';
    }
}

function showPasswordAlert(message, isError = false) {
    const alertBox = document.getElementById('passwordAlert');
    if (!alertBox) {
        showToast(message, isError ? 'error' : 'success');
        return;
    }

    alertBox.textContent = message;
    alertBox.style.display = 'block';
    alertBox.className = isError 
        ? 'mb-4 p-3 rounded-xl text-sm font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
        : 'mb-4 p-3 rounded-xl text-sm font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700';

    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showToast(message, type = 'success') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type === 'error');
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: type === 'error' ? '#dc2626' : '#10b981',
        color: 'white',
        padding: '0.85rem 1.75rem',
        borderRadius: '1rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        zIndex: '99999',
        fontWeight: '800',
        fontSize: '0.92rem',
        fontFamily: "'Cairo', sans-serif",
        direction: 'rtl',
        textAlign: 'center'
    });
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('passwordForm');
    const submitBtn = document.getElementById('btnSubmitPassword');
    const submitText = document.getElementById('btnSubmitText');

    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const currentPass = document.getElementById('currentPass').value.trim();
            const newPass = document.getElementById('newPass').value.trim();
            const confirmPass = document.getElementById('confirmPass').value.trim();

            if (!currentPass) {
                showPasswordAlert('يرجى إدخال كلمة المرور الحالية', true);
                document.getElementById('currentPass').focus();
                return;
            }

            if (!newPass) {
                showPasswordAlert('يرجى إدخال كلمة المرور الجديدة', true);
                document.getElementById('newPass').focus();
                return;
            }

            if (newPass.length < 6) {
                showPasswordAlert('كلمة المرور الجديدة يجب أن تتكون من 6 أحرف على الأقل', true);
                document.getElementById('newPass').focus();
                return;
            }

            if (newPass !== confirmPass) {
                showPasswordAlert('كلمة المرور الجديدة غير مطابقة لتأكيد كلمة المرور', true);
                document.getElementById('confirmPass').focus();
                return;
            }

            if (newPass === currentPass) {
                showPasswordAlert('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية', true);
                document.getElementById('newPass').focus();
                return;
            }

            // إرسال الطلب عبر AJAX
            if (submitBtn) submitBtn.disabled = true;
            if (submitText) submitText.textContent = 'جاري التحديث...';

            fetch('/student/api/change-password/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken') || document.querySelector('[name=csrfmiddlewaretoken]')?.value || '',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    old_password: currentPass,
                    new_password: newPass
                })
            })
            .then(res => res.json())
            .then(data => {
                if (submitBtn) submitBtn.disabled = false;
                if (submitText) submitText.textContent = 'حفظ وتحديث كلمة المرور';

                if (data.success) {
                    showPasswordAlert('✅ ' + (data.message || 'تم تغيير كلمة المرور بنجاح'), false);
                    form.reset();
                } else {
                    showPasswordAlert('❌ ' + (data.message || 'فشل تغيير كلمة المرور'), true);
                }
            })
            .catch(err => {
                if (submitBtn) submitBtn.disabled = false;
                if (submitText) submitText.textContent = 'حفظ وتحديث كلمة المرور';
                showPasswordAlert('❌ حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً', true);
            });
        });
    }
});

window.togglePass = togglePass;
window.showToast = showToast;