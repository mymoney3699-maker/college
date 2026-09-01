// ============================================
// إعدادات حسابات المستخدمين - User Accounts Settings
// ============================================

console.log('✅ user_accounts.js loaded successfully');

var selectedUserId = null;
var selectedUsername = '';

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

function showMessage(type, message) {
    var msgDiv = document.getElementById('formMessage');
    if (!msgDiv) return;
    msgDiv.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-yellow-100');
    var bgColor = '';
    if (type === 'success') {
        bgColor = 'bg-green-100 text-green-700';
    } else if (type === 'error') {
        bgColor = 'bg-red-100 text-red-700';
    } else {
        bgColor = 'bg-yellow-100 text-yellow-700';
    }
    msgDiv.className = 'mt-4 p-3 rounded-lg text-center font-bold ' + bgColor;
    msgDiv.innerHTML = (type === 'success' ? '✅ ' : '❌ ') + message;
    msgDiv.classList.remove('hidden');
    setTimeout(function() { msgDiv.classList.add('hidden'); }, 5000);
}

function loadUserData() {
    var select = document.getElementById('userSelect');
    if (!select) return;
    var selectedOption = select.options[select.selectedIndex];
    
    if (select.value) {
        selectedUserId = parseInt(select.value);
        selectedUsername = selectedOption.getAttribute('data-username');
        document.getElementById('userIdDisplay').value = selectedUserId;
        document.getElementById('roleDisplay').value = selectedOption.getAttribute('data-role');
        document.getElementById('username').value = selectedOption.getAttribute('data-username');
        document.getElementById('firstName').value = selectedOption.getAttribute('data-first-name') || '';
        document.getElementById('lastName').value = selectedOption.getAttribute('data-last-name') || '';
        document.getElementById('email').value = selectedOption.getAttribute('data-email') || '';
        document.getElementById('phone').value = selectedOption.getAttribute('data-phone') || '';
        showMessage('info', 'تم تحميل بيانات المستخدم رقم ' + selectedUserId);
    }
}

function editUserData() {
    if (!selectedUserId) {
        showMessage('error', 'الرجاء اختيار مستخدم أولاً');
        return;
    }
    var fields = ['username', 'firstName', 'lastName', 'email', 'phone'];
    for (var i = 0; i < fields.length; i++) {
        var el = document.getElementById(fields[i]);
        if (el) el.readOnly = false;
        if (el) el.classList.remove('bg-gray-50');
        if (el) el.classList.add('bg-white');
    }
    document.getElementById('username').focus();
    showMessage('info', 'يمكنك الآن تعديل البيانات');
}

function saveUserData() {
    if (!selectedUserId) {
        showMessage('error', 'الرجاء اختيار مستخدم أولاً');
        return;
    }
    
    var userData = {
        user_id: selectedUserId,
        username: document.getElementById('username').value,
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value
    };
    
    fetch('/users/api/update-profile/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(userData)
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showMessage('success', data.message);
            setTimeout(function() { location.reload(); }, 1500);
        } else {
            showMessage('error', data.error);
        }
    })
    .catch(function() { showMessage('error', 'حدث خطأ في الاتصال'); });
}

// إعادة ضبط كلمة المرور (بدون الحاجة للقديمة)
function resetUserPassword() {
    if (!selectedUserId) {
        showMessage('error', 'الرجاء اختيار مستخدم أولاً');
        return;
    }
    
    var newPassword = document.getElementById('newPassword').value;
    var confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!newPassword) {
        showMessage('error', 'الرجاء إدخال كلمة المرور الجديدة');
        return;
    }
    if (newPassword.length < 6) {
        showMessage('error', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
    }
    if (newPassword !== confirmPassword) {
        showMessage('error', 'كلمة المرور غير متطابقة');
        return;
    }
    
    // فتح نافذة التأكيد
    document.getElementById('resetUsername').innerText = selectedUsername;
    var modal = document.getElementById('resetConfirmModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(function() {
        modal.classList.remove('opacity-0');
        var div = modal.querySelector('.transform');
        if (div) div.classList.remove('scale-95');
    }, 10);
}

function closeResetConfirmModal() {
    var modal = document.getElementById('resetConfirmModal');
    modal.classList.add('opacity-0');
    var div = modal.querySelector('.transform');
    if (div) div.classList.add('scale-95');
    setTimeout(function() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function confirmResetPassword() {
    var newPassword = document.getElementById('newPassword').value;
    
    fetch('/users/api/reset-user-password/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            user_id: selectedUserId,
            new_password: newPassword
        })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showMessage('success', '✅ تم تغيير كلمة المرور بنجاح');
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            closeResetConfirmModal();
        } else {
            showMessage('error', data.error);
        }
    })
    .catch(function() { showMessage('error', 'حدث خطأ في الاتصال'); });
}

function cancelUserForm() {
    location.reload();
}

function goBack() {
    window.location.href = '/users/dashboard/';
}

function liveSearch() {
    console.log('⌨️ liveSearch called');
    var input = document.getElementById('userSearchInput');
    if (!input) return;
    var query = input.value.toLowerCase().trim();
    var resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) return;
    
    if (query === '' || query.includes(' - ')) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
        return;
    }
    
    var select = document.getElementById('userSelect');
    if (!select) return;
    var options = select.options;
    var matches = [];
    
    for (var i = 1; i < options.length; i++) {
        var opt = options[i];
        var username = (opt.getAttribute('data-username') || '').toLowerCase();
        var userId = opt.value.toLowerCase();
        
        if (username.includes(query) || userId.includes(query)) {
            matches.push({
                id: opt.value,
                username: opt.getAttribute('data-username'),
                role: opt.getAttribute('data-role') || opt.textContent.trim().split(' - ').pop()
            });
        }
    }
    
    if (matches.length > 0) {
        var html = `
            <div class="mb-2 text-sm text-primary font-bold">📋 عدد النتائج: ${matches.length}</div>
            <div class="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
        `;
        matches.forEach(function(u) {
            html += `
                <div class="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer flex justify-between items-center transition-colors duration-150"
                     onclick="selectUser('${u.id}', '${u.id} - ${u.username}')">
                    <div class="flex flex-col text-right">
                        <span class="font-bold text-slate-800 dark:text-slate-200 text-[15px]">${u.username}</span>
                        <span class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            رقم المستخدم: ${u.id} | الدور: ${u.role}
                        </span>
                    </div>
                    <span class="text-primary hover:underline text-sm font-bold">
                        ← اختيار
                    </span>
                </div>
            `;
        });
        html += `
            </div>
        `;
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove('hidden');
    } else {
        resultsDiv.innerHTML = `<div class="text-center text-yellow-600 p-4 border border-slate-200 dark:border-slate-700 rounded-lg font-bold">❌ لا توجد نتائج مطابقة</div>`;
        resultsDiv.classList.remove('hidden');
    }
}

function selectUser(val, text) {
    var input = document.getElementById('userSearchInput');
    if (input) input.value = text;
    
    var select = document.getElementById('userSelect');
    if (select) {
        select.value = val;
        var event = new Event('change');
        select.dispatchEvent(event);
    }
    
    var resultsDiv = document.getElementById('searchResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
    }
}

// Automatically load user from query parameter (?user_id=X)
document.addEventListener('DOMContentLoaded', function() {
    var urlParams = new URLSearchParams(window.location.search);
    var userId = urlParams.get('user_id');
    if (userId) {
        var select = document.getElementById('userSelect');
        if (select) {
            select.value = userId;
            
            var option = select.querySelector('option[value="' + userId + '"]');
            if (option) {
                var username = option.getAttribute('data-username');
                var roleDisplay = option.textContent.trim().split(' - ').pop();
                var searchInput = document.getElementById('userSearchInput');
                if (searchInput) {
                    searchInput.value = userId + ' - ' + username + ' (' + roleDisplay + ')';
                }
            }
            
            var event = new Event('change');
            select.dispatchEvent(event);
        }
    }
});

document.addEventListener('click', function(event) {
    var dropdown = document.getElementById('customUserDropdown');
    var resultsDiv = document.getElementById('searchResults');
    if (dropdown && !dropdown.contains(event.target) && resultsDiv && !resultsDiv.contains(event.target)) {
        resultsDiv.classList.add('hidden');
    }
});

// Bind to window for global access
window.loadUserData = loadUserData;
window.editUserData = editUserData;
window.saveUserData = saveUserData;
window.resetUserPassword = resetUserPassword;
window.closeResetConfirmModal = closeResetConfirmModal;
window.confirmResetPassword = confirmResetPassword;
window.cancelUserForm = cancelUserForm;
window.goBack = goBack;
window.liveSearch = liveSearch;
window.selectUser = selectUser;
