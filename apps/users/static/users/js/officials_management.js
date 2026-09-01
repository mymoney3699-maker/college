/**
 * ============================================================
 * إدارة المسؤولين المعتمدين - Officials Management (Backend Connected)
 * officials_management.js  v2.1.0
 * ============================================================
 */

console.log('✅ officials_management.js loaded (Connected to Backend)');

let officials = [];
let currentFilter = 'all';
let editingId = null;

// ============================================================
// عناصر DOM
// ============================================================
const tbody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const showFormBtn = document.getElementById('showFormBtn');
const formCard = document.getElementById('formCard');
const formTitle = document.getElementById('formTitle');
const inputPosition = document.getElementById('inputPosition');
const inputTitle = document.getElementById('inputTitle');
const inputName = document.getElementById('inputName');
const inputStatus = document.getElementById('inputStatus');
const inputStartDate = document.getElementById('inputStartDate');
const inputNotes = document.getElementById('inputNotes');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

const totalCount = document.getElementById('totalCount');
const activeCount = document.getElementById('activeCount');
const inactiveCount = document.getElementById('inactiveCount');
const lastUpdate = document.getElementById('lastUpdate');

// ============================================================
// 🔔 نظام الإشعارات العائمة الموحد (showNotification)
// ============================================================
function showNotification(type, message) {
    const toast = document.getElementById('toastNotification');
    const iconCircle = document.getElementById('toastIconCircle');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    if (!toast || !icon || !msg) {
        console.warn('⚠️ Toast Notification elements not found:', type, message);
        return;
    }
    
    msg.innerText = message;
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    
    // ضبط لون وخلفية البطاقة حسب النمط الليلي / النهاري
    if (isDark) {
        toast.style.background = '#1e293b';
        toast.style.backgroundColor = '#1e293b';
        toast.style.boxShadow = '0 14px 45px rgba(0, 0, 0, 0.7)';
        msg.style.color = '#f8fafc';
    } else {
        toast.style.background = '#ffffff';
        toast.style.backgroundColor = '#ffffff';
        toast.style.boxShadow = '0 12px 35px -5px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)';
        msg.style.color = '#1e293b';
    }
    
    if (type === 'success') {
        toast.style.borderRight = '4.5px solid #10b981';
        toast.style.borderRightColor = '#10b981';
        icon.innerText = "check_circle";
        icon.style.color = '#10b981';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)';
        }
    } else if (type === 'warning') {
        toast.style.borderRight = '4.5px solid #f59e0b';
        toast.style.borderRightColor = '#f59e0b';
        icon.innerText = "warning";
        icon.style.color = '#f59e0b';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)';
        }
    } else if (type === 'info') {
        toast.style.borderRight = '4.5px solid #3b82f6';
        toast.style.borderRightColor = '#3b82f6';
        icon.innerText = "info";
        icon.style.color = '#3b82f6';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)';
        }
    } else {
        toast.style.borderRight = '4.5px solid #e11d48';
        toast.style.borderRightColor = '#e11d48';
        icon.innerText = "error";
        icon.style.color = '#e11d48';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(225, 29, 72, 0.2)' : 'rgba(225, 29, 72, 0.12)';
        }
    }
    
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    
    clearTimeout(window.notificationTimeout);
    window.notificationTimeout = setTimeout(() => {
        toast.style.transform = 'translateY(80px)';
        toast.style.opacity = '0';
    }, 4000);
}

window.showNotification = showNotification;
window.toastSuccess = (msg) => showNotification('success', msg);
window.toastError = (msg) => showNotification('error', msg);
window.toastWarning = (msg) => showNotification('warning', msg);
window.toastInfo = (msg) => showNotification('info', msg);
window.showToast = (msg, type = 'info') => showNotification(type, msg);
window.showToastMessage = (message, isError = false, type = null) => {
    if (type) {
        showNotification(type, message);
    } else {
        showNotification(isError ? 'error' : 'success', message);
    }
};

// ============================================================
// دوال مساعدة و CSRF
// ============================================================
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

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

// ============================================================
// جلب البيانات من الـ Backend
// ============================================================
function fetchOfficials() {
    console.log('🔄 Fetching officials from Backend...');
    fetch('/users/api/officials/')
        .then(response => response.json())
        .then(data => {
            if (data.success && Array.isArray(data.officials)) {
                officials = data.officials;
                console.log(`✅ Loaded ${officials.length} officials from API:`, officials);
                renderTable();
            } else {
                console.warn('⚠️ Failed to load officials:', data);
            }
        })
        .catch(err => {
            console.error('❌ Error fetching officials:', err);
        });
}

function getFilteredData() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let filtered = officials;

    if (currentFilter === 'active') {
        filtered = filtered.filter(o => o.status === 'active');
    } else if (currentFilter === 'inactive') {
        filtered = filtered.filter(o => o.status === 'inactive');
    }

    if (query) {
        filtered = filtered.filter(o =>
            (o.name && o.name.toLowerCase().includes(query)) ||
            (o.position && o.position.toLowerCase().includes(query)) ||
            (o.title && o.title.toLowerCase().includes(query))
        );
    }

    return filtered;
}

function updateStats() {
    const total = officials.length;
    const active = officials.filter(o => o.status === 'active').length;
    const inactive = officials.filter(o => o.status === 'inactive').length;
    if (totalCount) totalCount.textContent = total;
    if (activeCount) activeCount.textContent = active;
    if (inactiveCount) inactiveCount.textContent = inactive;
    if (lastUpdate) {
        const now = new Date();
        lastUpdate.textContent = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

// ============================================================
// عرض الجدول
// ============================================================
function renderTable() {
    if (!tbody) return;
    const data = getFilteredData();
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" style="text-align:center;padding:2rem;color:#6f8f9a;">لا توجد بيانات مطابقة للبحث</td></tr>
        `;
        updateStats();
        return;
    }

    tbody.innerHTML = data.map(o => {
        const statusBadge = o.status === 'active' ?
            '<span class="badge-status active">مفعل / حالي</span>' :
            '<span class="badge-status inactive">غير مفعل / سابق</span>';

        const isActive = o.status === 'active';
        const fullName = o.title ? `${o.title} ${o.name}` : o.name;

        return `
            <tr>
                <td><strong>${o.position}</strong></td>
                <td><span style="font-weight: 700; color: #1e293b;">${fullName}</span></td>
                <td>${statusBadge}</td>
                <td>${formatDate(o.startDate)}</td>
                <td>${formatDate(o.updatedAt)}</td>
                <td>
                    <div class="actions-cell" style="display: flex; gap: 8px;">
                        <button class="btn-icon" onclick="window.editOfficial(${o.id})" title="تعديل البيانات" style="color: #2563eb;">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="btn-icon ${isActive ? 'danger' : ''}" onclick="window.toggleStatus(${o.id})" title="${isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}">
                            <span class="material-symbols-outlined">${isActive ? 'toggle_off' : 'toggle_on'}</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateStats();
}

// ============================================================
// تبديل حالة المسؤول (تفعيل / تعطيل)
// ============================================================
function toggleStatus(id) {
    const official = officials.find(o => o.id === id);
    const willBeActive = official ? (official.status !== 'active') : true;

    fetch(`/users/api/officials/toggle/${id}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const notifType = willBeActive ? 'success' : 'warning';
            showNotification(notifType, data.message || (willBeActive ? '✅ تم تفعيل حساب المسؤول بنجاح' : '⚠️ تم تعطيل حساب المسؤول بنجاح'));
            fetchOfficials();
        } else {
            showNotification('error', data.error || '❌ حدث خطأ أثناء تغيير حالة المسؤول');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', '❌ حدث خطأ في الاتصال بالخادم');
    });
}

// ============================================================
// إعادة تعيين النموذج (إضافة مسؤول جديد)
// ============================================================
function resetForm() {
    if (inputPosition) inputPosition.value = '';
    if (inputTitle) inputTitle.value = 'د.';
    if (inputName) inputName.value = '';
    if (inputStatus) inputStatus.value = 'active';
    if (inputStartDate) inputStartDate.value = '';
    if (inputNotes) inputNotes.value = '';
    editingId = null;
    if (formTitle) formTitle.textContent = 'إضافة مسؤول جديد';
    if (formCard) {
        formCard.classList.remove('hidden');
        formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (inputPosition) inputPosition.focus();
    showNotification('info', '📝 تم فتح نموذج إضافة مسؤول جديد');
}

// ============================================================
// تعديل مسؤول محدد
// ============================================================
function editOfficial(id) {
    const official = officials.find(o => o.id === id);
    if (!official) return;

    editingId = id;
    if (inputPosition) inputPosition.value = official.position || '';
    if (inputTitle) inputTitle.value = official.title || '';
    if (inputName) inputName.value = official.name || '';
    if (inputStatus) inputStatus.value = official.status || 'active';
    if (inputStartDate) inputStartDate.value = official.startDate || '';
    if (inputNotes) inputNotes.value = official.notes || '';

    if (formTitle) formTitle.textContent = `تعديل مسؤول: ${official.position}`;
    if (formCard) {
        formCard.classList.remove('hidden');
        formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (inputName) inputName.focus();
    showNotification('info', `✏️ تم تحميل بيانات المسؤول (${official.name}) للتعديل`);
}

// ============================================================
// حفظ المسؤول (إضافة / تعديل)
// ============================================================
function saveOfficial() {
    const position = inputPosition ? inputPosition.value.trim() : '';
    const title = inputTitle ? inputTitle.value.trim() : '';
    const name = inputName ? inputName.value.trim() : '';
    const status = inputStatus ? inputStatus.value : 'active';
    const startDate = inputStartDate ? inputStartDate.value : '';
    const notes = inputNotes ? inputNotes.value.trim() : '';

    if (!position || !name) {
        showNotification('warning', '⚠️ الرجاء تحديد المنصب وإدخال اسم المسؤول');
        return;
    }

    const payload = {
        id: editingId,
        position: position,
        title: title,
        name: name,
        status: status,
        startDate: startDate,
        notes: notes
    };

    const isEdit = Boolean(editingId);

    fetch('/users/api/officials/save/', {
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
            showNotification('success', data.message || (isEdit ? '✅ تم تحديث بيانات المسؤول بنجاح' : '✅ تم إضافة المسؤول بنجاح'));
            if (formCard) formCard.classList.add('hidden');
            editingId = null;
            fetchOfficials();
        } else {
            showNotification('error', data.error || '❌ حدث خطأ أثناء حفظ البيانات');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', '❌ حدث خطأ في الاتصال بالخادم');
    });
}

// ============================================================
// ربط الأحداث
// ============================================================
if (showFormBtn) showFormBtn.addEventListener('click', resetForm);
if (cancelBtn) cancelBtn.addEventListener('click', () => {
    if (formCard) formCard.classList.add('hidden');
    editingId = null;
    showNotification('info', 'تم إلغاء عملية التحرير');
});
if (saveBtn) saveBtn.addEventListener('click', saveOfficial);
if (searchInput) searchInput.addEventListener('input', renderTable);

const statusFilterSelect = document.getElementById('statusFilterSelect');
if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', function() {
        currentFilter = this.value;
        renderTable();
    });
}

filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        filterBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        renderTable();
    });
});

// تصدير الدوال لنطاق window
window.toggleStatus = toggleStatus;
window.editOfficial = editOfficial;
window.renderTable = renderTable;
window.saveOfficial = saveOfficial;
window.resetForm = resetForm;
window.fetchOfficials = fetchOfficials;

// تهيئة عند اكتمال الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchOfficials);
} else {
    fetchOfficials();
}