// ============================================
// إضافة مستخدم جديد - Add User
// ============================================

console.log('✅ add_user.js loaded successfully');

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

// التنقل بين التبويبات (Tabs)
function switchTab(tabId) {
    document.getElementById('tab-info').classList.add('hidden');
    document.getElementById('tab-groups').classList.add('hidden');
    document.getElementById('tab-permissions').classList.add('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active-tab');
    });

    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`tabBtn-${tabId}`).classList.add('active-tab');
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

function toggleDepartmentSelect() {
    const roleElem = document.getElementById('new_role');
    const deptContainer = document.getElementById('deptSelectContainer');
    const deptElem = document.getElementById('new_department');
    if (!roleElem || !deptContainer) return;

    if (roleElem.value === 'academic_dept') {
        deptContainer.classList.remove('hidden');
        if (deptElem) deptElem.required = true;
    } else {
        deptContainer.classList.add('hidden');
        if (deptElem) {
            deptElem.required = false;
            deptElem.value = '';
        }
    }
}

function submitCreateUser(event) {
    event.preventDefault();
    
    const submitBtn = document.querySelector('#createUserForm button[type="submit"]');
    const usernameInput = document.getElementById('new_username');
    const emailInput = document.getElementById('new_email');
    const passwordInput = document.getElementById('new_password');
    const phoneInput = document.getElementById('new_phone');
    const roleElem = document.getElementById('new_role');
    const deptElem = document.getElementById('new_department');

    const username = (usernameInput?.value || '').trim();
    if (!username) {
        showNotification('error', 'يرجى إدخال اسم المستخدم.');
        switchTab('info');
        usernameInput?.focus();
        return;
    }

    const selectedGroups = [];
    document.querySelectorAll('input[name="new_groups"]:checked').forEach(cb => {
        selectedGroups.push(cb.value);
    });

    const selectedPermissions = [];
    document.querySelectorAll('input[name="new_permissions"]:checked').forEach(cb => {
        selectedPermissions.push(cb.value);
    });

    const roleVal = roleElem ? roleElem.value : 'student';
    const departmentId = (roleVal === 'academic_dept' && deptElem) ? deptElem.value : null;

    if (roleVal === 'academic_dept' && !departmentId) {
        showNotification('error', 'يرجى اختيار القسم العلمي التابع له هذا الحساب.');
        switchTab('info');
        deptElem?.focus();
        return;
    }

    const payload = {
        username: username,
        email: (emailInput?.value || '').trim(),
        password: passwordInput ? passwordInput.value : '',
        phone: (phoneInput?.value || '').trim(),
        role: roleVal,
        department_id: departmentId,
        groups: selectedGroups,
        permissions: selectedPermissions
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-70', 'cursor-not-allowed');
    }

    fetch('/users/api/create-user/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
    })
    .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'حدث خطأ أثناء حفظ بيانات المستخدم.');
        }
        return data;
    })
    .then(data => {
        showNotification('success', data.message || 'تم إنشاء المستخدم بنجاح');
        document.getElementById('createUserForm').reset();
        toggleDepartmentSelect();
        switchTab('info');
    })
    .catch(err => {
        showNotification('error', err.message || 'فشل الإتصال بالخادم الرئيسي للنظام.');
        // إذا كان الخطأ متعلقاً باسم المستخدم أو البريد، ننتقل لتبويب البيانات ونركز على الحقل المعني
        if (err.message && err.message.includes('اسم المستخدم')) {
            switchTab('info');
            if (usernameInput) {
                usernameInput.focus();
                usernameInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/20');
                setTimeout(() => {
                    usernameInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
                }, 4000);
            }
        } else if (err.message && err.message.includes('البريد')) {
            switchTab('info');
            if (emailInput) {
                emailInput.focus();
                emailInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/20');
                setTimeout(() => {
                    emailInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
                }, 4000);
            }
        }
    })
    .finally(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        }
    });
}

// ============================================
// إدارة النافذة المنبثقة لإنشاء مجموعة جديدة (Modal Group)
// ============================================

function openCreateGroupModal() {
    const modal = document.getElementById('modalCreateGroup');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeCreateGroupModal() {
    const modal = document.getElementById('modalCreateGroup');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
    const nameInput = document.getElementById('modal_group_name');
    if (nameInput) nameInput.value = '';
    const permInput = document.getElementById('permSearchInput');
    if (permInput) {
        permInput.value = '';
        filterGroupPermissions();
    }
    document.querySelectorAll('input[name="modal_group_perms"]:checked').forEach(cb => {
        cb.checked = false;
    });
    updateSelectedPermsCount();
}

function filterGroupPermissions() {
    const query = (document.getElementById('permSearchInput').value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('.perm-item-row');
    rows.forEach(row => {
        const text = (row.getAttribute('data-perm-text') || '').toLowerCase();
        if (text.includes(query)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
}

function updateSelectedPermsCount() {
    const count = document.querySelectorAll('input[name="modal_group_perms"]:checked').length;
    const badge = document.getElementById('selectedPermsCount');
    if (badge) badge.textContent = `محدد (${count})`;
}

function submitCreateGroup(event) {
    event.preventDefault();
    const groupNameInput = document.getElementById('modal_group_name');
    const groupName = groupNameInput ? groupNameInput.value.trim() : '';

    if (!groupName) {
        showNotification('error', 'يرجى إدخال اسم المجموعة.');
        return;
    }

    const selectedPerms = [];
    document.querySelectorAll('input[name="modal_group_perms"]:checked').forEach(cb => {
        selectedPerms.push(parseInt(cb.value));
    });

    const payload = {
        name: groupName,
        permissions: selectedPerms
    };

    fetch('/users/api/groups/create/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.group) {
            showNotification('success', data.message || 'تمت إضافة المجموعة وتحديدها بنجاح');

            // 1. إخفاء التنبيه الفارغ فوراً
            const emptyAlert = document.getElementById('emptyGroupsAlert');
            if (emptyAlert) emptyAlert.classList.add('hidden');

            // 2. إنشاء عنصر للمجموعة الجديدة وإضافته وتحديده تلقائياً (Checked=true)
            const gridContainer = document.getElementById('groupsGridContainer');
            if (gridContainer) {
                const card = document.createElement('div');
                card.id = `group-card-${data.group.id}`;
                card.className = "group-card flex items-center justify-between p-3 border border-[#297373] dark:border-[#297373] rounded-lg bg-teal-50/50 dark:bg-slate-800 transition-colors animate-pulse";
                card.innerHTML = `
                    <label class="flex items-center gap-3 cursor-pointer flex-1 m-0">
                        <input type="checkbox" name="new_groups" value="${data.group.name}" id="group-checkbox-${data.group.id}" checked class="w-4 h-4 text-primary rounded focus:ring-primary" style="width: auto !important; height: auto !important;">
                        <span id="group-name-display-${data.group.id}" class="text-sm font-bold text-slate-700 dark:text-slate-300">${data.group.name}</span>
                    </label>
                    <button type="button" onclick="startInlineEditGroup(${data.group.id}, '${data.group.name.replace(/'/g, "\\'")}', event)" title="تعديل المجموعة وصلاحياتها" class="text-slate-400 hover:text-[#297373] p-1 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold">
                        <span class="material-symbols-outlined text-base">edit</span> تعديل
                    </button>
                `;
                gridContainer.prepend(card);
                setTimeout(() => card.classList.remove('animate-pulse'), 1500);
            }

            // 3. إغلاق النافذة المنبثقة وتصفية الحقول
            closeCreateGroupModal();
        } else {
            showNotification('error', data.error || 'حدث خطأ أثناء إضافة المجموعة.');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', 'فشل الاتصال بالخادم عند إضافة المجموعة.');
    });
}

// ============================================
// تعديل المجموعة وصلاحياتها مباشرة (Inline Group Editing)
// ============================================

function startInlineEditGroup(groupId, groupName, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const editor = document.getElementById('inlineGroupEditor');
    const idInput = document.getElementById('inline_group_id');
    const nameInput = document.getElementById('inline_group_name');
    const titleSpan = document.getElementById('inlineEditingGroupNameTitle');
    const searchInput = document.getElementById('inlinePermSearchInput');

    if (!editor || !idInput || !nameInput) return;

    idInput.value = groupId;
    nameInput.value = groupName;
    if (titleSpan) titleSpan.textContent = groupName;
    if (searchInput) {
        searchInput.value = '';
        filterInlineGroupPermissions();
    }

    // تصفية الاختيارات السابقة
    document.querySelectorAll('input[name="inline_group_perms"]').forEach(cb => {
        cb.checked = false;
    });

    // جلب الصلاحيات الحالية للمجموعة من الخادم
    fetch(`/users/api/groups/${groupId}/`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.group) {
                const perms = data.group.permissions || [];
                perms.forEach(permId => {
                    const cb = document.querySelector(`input[name="inline_group_perms"][value="${permId}"]`);
                    if (cb) cb.checked = true;
                });
                updateInlineSelectedPermsCount();
            }
        })
        .catch(err => {
            console.error('Error loading group permissions:', err);
        });

    // إظهار لوحة التعديل المباشر والتمرير إليها بسلاسة
    editor.classList.remove('hidden');
    editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    nameInput.focus();
}

function cancelInlineEditGroup() {
    const editor = document.getElementById('inlineGroupEditor');
    if (editor) {
        editor.classList.add('hidden');
    }
    const idInput = document.getElementById('inline_group_id');
    if (idInput) idInput.value = '';
    const nameInput = document.getElementById('inline_group_name');
    if (nameInput) nameInput.value = '';
}

function filterInlineGroupPermissions() {
    const query = (document.getElementById('inlinePermSearchInput').value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('.inline-perm-item-row');
    rows.forEach(row => {
        const text = (row.getAttribute('data-perm-text') || '').toLowerCase();
        if (text.includes(query)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
}

function updateInlineSelectedPermsCount() {
    const count = document.querySelectorAll('input[name="inline_group_perms"]:checked').length;
    const badge = document.getElementById('inlineSelectedPermsCount');
    if (badge) badge.textContent = `محدد (${count})`;
}

function saveInlineEditGroup() {
    const groupId = document.getElementById('inline_group_id').value;
    const groupName = document.getElementById('inline_group_name').value.trim();

    if (!groupId) {
        showNotification('error', 'معرف المجموعة غير صالح.');
        return;
    }

    if (!groupName) {
        showNotification('error', 'يرجى إدخال اسم المجموعة.');
        return;
    }

    const selectedPerms = [];
    document.querySelectorAll('input[name="inline_group_perms"]:checked').forEach(cb => {
        selectedPerms.push(parseInt(cb.value));
    });

    const btn = document.getElementById('btnSaveInlineGroup');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">refresh</span> جاري الحفظ...';
    }

    fetch(`/users/api/groups/${groupId}/update/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            name: groupName,
            permissions: selectedPerms
        })
    })
    .then(res => res.json())
    .then(data => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> حفظ التعديلات';
        }

        if (data.success && data.group) {
            showNotification('success', data.message || 'تم تحديث المجموعة وصلاحياتها بنجاح');

            // تحديث العرض في الصفحة مباشرة (DOM Update)
            const nameDisplay = document.getElementById(`group-name-display-${data.group.id}`);
            if (nameDisplay) nameDisplay.textContent = data.group.name;

            const checkbox = document.getElementById(`group-checkbox-${data.group.id}`);
            if (checkbox) checkbox.value = data.group.name;

            const editBtn = document.querySelector(`#group-card-${data.group.id} button`);
            if (editBtn) {
                editBtn.setAttribute('onclick', `startInlineEditGroup(${data.group.id}, '${data.group.name.replace(/'/g, "\\'")}', event)`);
            }

            cancelInlineEditGroup();
        } else {
            showNotification('error', data.error || 'حدث خطأ أثناء تعديل المجموعة.');
        }
    })
    .catch(err => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> حفظ التعديلات';
        }
        console.error(err);
        showNotification('error', 'فشل الاتصال بالخادم أثناء تعديل المجموعة.');
    });
}

function filterDirectPermissions() {
    const query = (document.getElementById('directPermSearchInput')?.value || '').toLowerCase().trim();
    const rows = document.querySelectorAll('.direct-perm-item-row');
    rows.forEach(row => {
        const text = (row.getAttribute('data-perm-text') || '').toLowerCase();
        if (text.includes(query)) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
}

function updateDirectSelectedPermsCount() {
    const count = document.querySelectorAll('input[name="new_permissions"]:checked').length;
    const badge = document.getElementById('selectedDirectPermsCount');
    if (badge) badge.textContent = `محدد (${count})`;
}

document.addEventListener('DOMContentLoaded', function() {
    toggleDepartmentSelect();
    updateDirectSelectedPermsCount();
});

// Bind to window for templates to access
window.switchTab = switchTab;
window.submitCreateUser = submitCreateUser;
window.toggleDepartmentSelect = toggleDepartmentSelect;
window.openCreateGroupModal = openCreateGroupModal;
window.closeCreateGroupModal = closeCreateGroupModal;
window.filterGroupPermissions = filterGroupPermissions;
window.updateSelectedPermsCount = updateSelectedPermsCount;
window.submitCreateGroup = submitCreateGroup;
window.startInlineEditGroup = startInlineEditGroup;
window.cancelInlineEditGroup = cancelInlineEditGroup;
window.filterInlineGroupPermissions = filterInlineGroupPermissions;
window.updateInlineSelectedPermsCount = updateInlineSelectedPermsCount;
window.saveInlineEditGroup = saveInlineEditGroup;
window.filterDirectPermissions = filterDirectPermissions;
window.updateDirectSelectedPermsCount = updateDirectSelectedPermsCount;

