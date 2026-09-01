// ============================================
// لوحة التحكم - الملف الشخصي - Dashboard
// ============================================

console.log('✅ dashboard.js loaded successfully');

function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue || "";
}

function showNotification(type, message) {
    const toast = document.getElementById('toastNotification');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    msg.innerText = message;
    if(type === 'success') {
        toast.classList.remove('border-r-rose-500');
        toast.classList.add('border-r-emerald-500');
        icon.innerText = "check_circle";
        icon.className = "material-symbols-outlined text-emerald-500 text-2xl";
    } else {
        toast.classList.remove('border-r-emerald-500');
        toast.classList.add('border-r-rose-500');
        icon.innerText = "error";
        icon.className = "material-symbols-outlined text-rose-500 text-2xl";
    }
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 4000);
}

function showProfileTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    const activeTab = document.getElementById(tabName + 'Tab');
    if (activeTab) activeTab.classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active-tab');
    });
    
    const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick').includes(tabName));
    if (btn) {
        btn.classList.add('active-tab');
    }
}

function saveProfile() {
    const username = document.getElementById('username').value.trim();
    const fullName = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if (!username) {
        showNotification('error', 'اسم المستخدم مطلوب');
        return;
    }

    const spaceIndex = fullName.indexOf(' ');
    let firstName = fullName;
    let lastName = '';
    if (spaceIndex !== -1) {
        firstName = fullName.substring(0, spaceIndex);
        lastName = fullName.substring(spaceIndex + 1);
    }

    const targetUserIdEl = document.getElementById('targetUserId');
    const targetUserId = targetUserIdEl ? targetUserIdEl.value : document.body.getAttribute('data-user-id');
    const loggedInUserId = document.body.getAttribute('data-user-id');
    const isOwnProfile = (document.getElementById('oldPassword') !== null) || (targetUserId === loggedInUserId);
    
    const payload = {
        username: username,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone
    };
    if (!isOwnProfile) {
        payload.user_id = targetUserId;
    }

    fetch('/users/api/update-profile/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showNotification('success', data.message);
            document.getElementById('phone_display').innerText = phone || 'غير مدخل';
        } else {
            showNotification('error', data.error || 'حدث خطأ أثناء حفظ التغييرات');
        }
    })
    .catch(err => {
        showNotification('error', 'فشل الاتصال بالخادم');
        console.error(err);
    });
}

function changePassword() {
    const oldPasswordEl = document.getElementById('oldPassword');
    const oldPassword = oldPasswordEl ? oldPasswordEl.value : '';
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const targetUserIdEl = document.getElementById('targetUserId');
    const targetUserId = targetUserIdEl ? targetUserIdEl.value : document.body.getAttribute('data-user-id');
    const loggedInUserId = document.body.getAttribute('data-user-id');
    const isOwnProfile = (document.getElementById('oldPassword') !== null) || (targetUserId === loggedInUserId);

    if ((isOwnProfile && !oldPassword) || !newPassword || !confirmPassword) {
        showNotification('error', 'يرجى ملء كافة الحقول');
        return;
    }

    if (newPassword !== confirmPassword) {
        showNotification('error', 'كلمة المرور الجديدة غير متطابقة');
        return;
    }

    if (newPassword.length < 6) {
        showNotification('error', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
    }

    const payload = {
        new_password: newPassword,
        confirm_password: confirmPassword
    };

    if (isOwnProfile) {
        payload.old_password = oldPassword;
    } else {
        payload.user_id = targetUserId;
    }

    fetch('/users/api/change-password/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showNotification('success', data.message);
            if (oldPasswordEl) oldPasswordEl.value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            showNotification('error', data.error || 'حدث خطأ أثناء تغيير كلمة المرور');
        }
    })
    .catch(err => {
        showNotification('error', 'فشل الاتصال بالخادم');
        console.error(err);
    });
}

function goBack() {
    window.history.back();
}

// Bind to window for templates to access
window.showProfileTab = showProfileTab;
window.saveProfile = saveProfile;
window.changePassword = changePassword;
window.goBack = goBack;

// فتح التبويب المحدد من الرابط تلقائياً عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab) {
        showProfileTab(tab);
    }
});
