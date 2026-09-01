// ============================================
// إدارة الصلاحيات - User Permissions
// ============================================

console.log('✅ permissions.js loaded successfully');

let selectedUserId = null;
let userGroups = [];
let userPermissions = [];
let allPermissions = [];

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
    return cookieValue || "";
}

function showMessage(type, message) {
    const msgDiv = document.getElementById('formMessage');
    if (!msgDiv) return;
    msgDiv.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-yellow-100', 'bg-blue-100');
    let bgColor = '', icon = '';
    if (type === 'success') { bgColor = 'bg-green-100 text-green-700'; icon = '✅'; }
    else if (type === 'error') { bgColor = 'bg-red-100 text-red-700'; icon = '❌'; }
    else { bgColor = 'bg-yellow-100 text-yellow-700'; icon = '⚠️'; }
    msgDiv.className = `mt-4 p-3 rounded-lg text-center font-bold ${bgColor}`;
    msgDiv.innerHTML = `${icon} ${message}`;
    msgDiv.classList.remove('hidden');
    setTimeout(() => msgDiv.classList.add('hidden'), 5000);
}

function loadUserPermissions() {
    const select = document.getElementById('userSelect');
    const selectedOption = select.options[select.selectedIndex];
    
    if (!select.value) {
        selectedUserId = null;
        document.getElementById('selectedUsername').value = '';
        document.getElementById('currentRole').value = '';
        document.getElementById('groupsList').innerHTML = '<div class="text-center text-gray-500 col-span-full">اختر مستخدم أولاً</div>';
        document.getElementById('permissionsList').innerHTML = '<div class="text-center text-gray-500 col-span-full">اختر مستخدم أولاً</div>';
        return;
    }
    
    selectedUserId = select.value;
    document.getElementById('selectedUsername').value = selectedOption.getAttribute('data-username');
    document.getElementById('currentRole').value = selectedOption.getAttribute('data-role');
    document.getElementById('roleSelect').value = selectedOption.getAttribute('data-role');
    
    // جلب المجموعات والصلاحيات
    fetch(`/users/api/get-user-groups/${selectedUserId}/`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                userGroups = data.groups;
                renderGroupsList(data.all_groups);
            }
        });
    
    fetch(`/users/api/get-permissions/${selectedUserId}/`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                userPermissions = data.user_permissions;
                allPermissions = data.all_permissions;
                renderPermissionsList();
            }
        });
}

function renderGroupsList(allGroups) {
    const container = document.getElementById('groupsList');
    if (!allGroups || allGroups.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 col-span-full">لا توجد مجموعات</div>';
        return;
    }
    container.innerHTML = allGroups.map(group => `
        <label class="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" class="group-checkbox" value="${group.id}" data-name="${group.name}"
                ${userGroups.includes(group.id) ? 'checked' : ''}>
            <span class="text-sm font-bold">${group.name}</span>
        </label>
    `).join('');
}

function renderPermissionsList() {
    const container = document.getElementById('permissionsList');
    if (!allPermissions || allPermissions.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 col-span-full">لا توجد صلاحيات</div>';
        return;
    }
    container.innerHTML = allPermissions.map(perm => `
        <label class="flex items-start gap-2.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-indigo-50/40 dark:hover:bg-slate-800/80 cursor-pointer transition-all bg-white dark:bg-slate-800/50">
            <input type="checkbox" class="perm-checkbox mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" value="${perm.codename}"
                ${userPermissions.includes(perm.codename) ? 'checked' : ''} style="width: auto !important; height: auto !important;">
            <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1 leading-snug">${perm.name}</div>
                <div class="flex flex-wrap items-center gap-1 text-[10px]">
                    <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/50">
                        <span class="material-symbols-outlined text-[11px] text-indigo-500">category</span>
                        <span>${perm.model_ar || perm.model_name || ''}</span>
                    </span>
                    <span class="font-mono text-[9px] text-slate-400 dark:text-slate-500" dir="ltr">
                        ${perm.codename}
                    </span>
                </div>
            </div>
        </label>
    `).join('');
}

function selectAllPermissions(select) {
    document.querySelectorAll('.perm-checkbox').forEach(cb => cb.checked = select);
}

function savePermissions() {
    if (!selectedUserId) { showMessage('error', 'اختر مستخدم أولاً'); return; }
    const selected = [];
    document.querySelectorAll('.perm-checkbox:checked').forEach(cb => selected.push(cb.value));
    
    fetch(`/users/api/update-permissions/${selectedUserId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ permissions: selected })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) { showMessage('success', data.message); userPermissions = selected; }
        else { showMessage('error', data.error); }
    })
    .catch(() => showMessage('error', 'حدث خطأ'));
}

function saveUserGroups() {
    if (!selectedUserId) { showMessage('error', 'اختر مستخدم أولاً'); return; }
    const selected = [];
    document.querySelectorAll('.group-checkbox:checked').forEach(cb => selected.push(parseInt(cb.value)));
    
    fetch(`/users/api/update-user-groups/${selectedUserId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ groups: selected })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) { showMessage('success', data.message); userGroups = selected; }
        else { showMessage('error', data.error); }
    })
    .catch(() => showMessage('error', 'حدث خطأ'));
}

function updateRole() {
    if (!selectedUserId) { showMessage('error', 'اختر مستخدم أولاً'); return; }
    const newRole = document.getElementById('roleSelect').value;
    if (!newRole) { showMessage('error', 'اختر دور'); return; }
    
    fetch(`/users/api/update-user-role/${selectedUserId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ role: newRole })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showMessage('success', data.message);
            document.getElementById('currentRole').value = newRole;
            const select = document.getElementById('userSelect');
            const option = select.querySelector(`option[value="${selectedUserId}"]`);
            if (option) {
                let roleDisplay = {
                    admin: 'مدير النظام',
                    general_registrar: 'مسجل عام',
                    registrar: 'موظف تسجيل وقبول',
                    exam_officer: 'موظف دراسة وامتحانات',
                    graduate_officer: 'قسم الخريجين',
                    academic_dept: 'رئيس / قسم علمي',
                    teacher: 'أستاذ',
                    student: 'طالب'
                }[newRole] || newRole;
                option.setAttribute('data-role', newRole);
                option.textContent = `${selectedUserId} - ${option.getAttribute('data-username')} (${roleDisplay})`;
            }
        } else {
            showMessage('error', data.error);
        }
    })
    .catch(() => showMessage('error', 'حدث خطأ في الاتصال'));
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
                role: opt.textContent.trim().split(' (').pop().replace(')', '')
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
                var searchInput = document.getElementById('userSearchInput');
                if (searchInput) {
                    searchInput.value = option.textContent.trim();
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

// Bind functions to window object for templates to access
window.loadUserPermissions = loadUserPermissions;
window.selectAllPermissions = selectAllPermissions;
window.savePermissions = savePermissions;
window.saveUserGroups = saveUserGroups;
window.updateRole = updateRole;
window.liveSearch = liveSearch;
window.selectUser = selectUser;
