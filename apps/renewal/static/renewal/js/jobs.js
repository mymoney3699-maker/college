/**
 * ============================================================
 * إدارة الوظائف والخدمات - Jobs Management
 * jobs.js v2.0.0
 * ============================================================
 */

console.log('✅ jobs.js loaded successfully');

// ============================================================
// State Management
// ============================================================

const state = {
    jobs: [],
    currentEditId: null,
    isLoading: false,
};

// ============================================================
// DOM References
// ============================================================

const DOM = {
    tbody: document.getElementById('jobsTableBody'),
    editArea: document.getElementById('editArea'),
    editLabel: document.getElementById('editLabel'),
    inputName: document.getElementById('inputName'),
    inputDate: document.getElementById('inputDate'),
    inputDuration: document.getElementById('inputDuration'),
    inputStatus: document.getElementById('inputStatus'),
    addJobBtn: document.getElementById('addJobBtn'),
};

// ============================================================
// Utility Functions
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function showToast(message, type = 'success') {
    // 1. التوجيه المباشر لدوال النظام الأساسية لتفادي الاستدعاء التكراري
    if (type === 'success' && typeof window.toastSuccess === 'function') {
        window.toastSuccess(message);
        return;
    }
    if (type === 'error' && typeof window.toastError === 'function') {
        window.toastError(message);
        return;
    }
    if (type === 'warning' && typeof window.toastWarning === 'function') {
        window.toastWarning(message);
        return;
    }
    if ((type === 'info' || type === 'default') && typeof window.toastInfo === 'function') {
        window.toastInfo(message);
        return;
    }

    // Toast مخصص بسيط
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '1.5rem',
        left: '1.5rem',
        backgroundColor: colors[type] || colors.info,
        color: 'white',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.75rem',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        zIndex: '9999',
        fontWeight: '700',
        fontSize: '0.875rem',
        fontFamily: "'Cairo', sans-serif",
        maxWidth: '400px',
        direction: 'rtl'
    });
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================================
// API Functions
// ============================================================

async function apiFetch(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'same-origin',
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, finalOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================================
// Core Functions
// ============================================================

async function loadJobs() {
    if (state.isLoading) return;
    state.isLoading = true;
    
    try {
        const data = await apiFetch('/renewal/api/jobs/');
        
        if (data.success) {
            state.jobs = data.jobs;
            renderTable();
            console.log(`✅ Loaded ${state.jobs.length} jobs`);
        } else {
            showToast('❌ فشل تحميل البيانات: ' + (data.error || 'خطأ غير معروف'), 'error');
        }
    } catch (error) {
        showToast('❌ خطأ في الاتصال بالسيرفر: ' + error.message, 'error');
        console.error('Error loading jobs:', error);
    } finally {
        state.isLoading = false;
    }
}

function renderTable() {
    if (!DOM.tbody) return;

    if (state.jobs.length === 0) {
        DOM.tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-12 text-[#64748b] dark:text-slate-400">
                    <span class="material-symbols-outlined text-5xl text-[#94a3b8] mb-2">work_off</span>
                    <p class="text-base font-semibold">لا توجد وظائف أو خدمات مسجلة حالياً في النظام.</p>
                </td>
            </tr>
        `;
        return;
    }

    const canEdit = (window.USER_CAN_EDIT !== false);
    const canDelete = (window.USER_CAN_DELETE !== false);

    DOM.tbody.innerHTML = state.jobs.map((job) => {
        const isCurrentlyOpen = job.is_currently_open;
        const isActive = job.is_active;
        
        let statusBadgeHtml = '';
        if (isCurrentlyOpen) {
            statusBadgeHtml = `
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    مفتوحة للتقديم
                </span>`;
        } else if (isActive) {
            statusBadgeHtml = `
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                    مفعلة (خارج فترة التقديم)
                </span>`;
        } else {
            statusBadgeHtml = `
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                    موقوفة / غير مفعلة
                </span>`;
        }

        let actionButtonsHtml = '';
        if (canEdit) {
            actionButtonsHtml += `
                <button onclick="toggleJobStatus(${job.id}, ${job.is_active})" 
                        class="action-icon-card" 
                        title="${job.is_active ? 'تعطيل الوظيفة' : 'تفعيل الوظيفة'}">
                    <span class="material-symbols-outlined text-lg">${job.is_active ? 'power_settings_new' : 'play_circle'}</span>
                </button>
                <button onclick="openEdit(${job.id})" 
                        class="action-icon-card" 
                        title="تعديل بيانات الوظيفة">
                    <span class="material-symbols-outlined text-lg">edit</span>
                </button>
            `;
        }
        if (!actionButtonsHtml) {
            actionButtonsHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold"><span class="material-symbols-outlined text-xs">lock</span> عرض فقط</span>`;
        }

        return `
            <tr class="plan-row border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <td class="px-6 py-4 font-bold text-slate-800 dark:text-slate-100 text-right">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-lg bg-[#307e92]/10 dark:bg-[#38bdf8]/10 text-[#307e92] dark:text-[#38bdf8] flex items-center justify-center font-bold">
                            <span class="material-symbols-outlined text-xl">work</span>
                        </div>
                        <div>
                            <div class="text-base font-extrabold text-slate-800 dark:text-slate-100">${escapeHtml(job.name)}</div>
                            <div class="text-xs text-slate-500 font-medium">رمز الوظيفة: ${escapeHtml(job.code)}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <div class="font-bold text-slate-700 dark:text-slate-200 text-sm">${formatDate(job.start_date)}</div>
                    <div class="text-xs text-slate-500 font-semibold mt-0.5">ينتهي: ${formatDate(job.end_date)}</div>
                </td>
                <td class="px-6 py-4 text-center font-extrabold text-[#b59b66] dark:text-[#fcd34d]">
                    <span class="text-base">${job.duration_days}</span> <span class="text-xs font-semibold">يوم</span>
                    ${job.days_remaining > 0 ? `<div class="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">متبقي ${job.days_remaining} يوم</div>` : ''}
                </td>
                <td class="px-6 py-4 text-center">
                    ${statusBadgeHtml}
                </td>
                <td class="px-6 py-4 text-center">
                    <div class="action-box-container">
                        ${actionButtonsHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showConfirmModal(title, message, icon = 'help', confirmText = 'تأكيد', cancelText = 'إلغاء', isDanger = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalConfirmCustom');
        const titleEl = document.getElementById('confirmModalTitle');
        const messageEl = document.getElementById('confirmModalMessage');
        const iconEl = document.getElementById('confirmModalIcon');
        const btnConfirm = document.getElementById('confirmModalBtnOk');
        const btnCancel = document.getElementById('confirmModalBtnCancel');

        if (!modal) {
            resolve(window.confirm(message));
            return;
        }

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (iconEl) iconEl.textContent = icon;

        if (isDanger) {
            btnConfirm.className = 'px-4 py-2 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all cursor-pointer';
        } else {
            btnConfirm.className = 'btn-teal-action text-xs';
        }
        btnConfirm.textContent = confirmText;

        const handleConfirm = () => {
            cleanup();
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            resolve(false);
        };

        const cleanup = () => {
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    });
}

async function toggleJobStatus(jobId, currentStatus) {
    if (window.USER_CAN_EDIT === false) {
        showToast('⚠️ عذراً، لا تمتلك صلاحية تعديل حالة الوظائف.', 'error');
        return;
    }

    const job = state.jobs.find(j => j.id === jobId);
    const targetStatus = !currentStatus;
    const actionText = targetStatus ? 'تفعيل' : 'تعطيل';
    
    const confirmed = await showConfirmModal(
        `${actionText} الوظيفة / الخدمة`,
        `هل أنت متأكد من رغبتك في ${actionText} الوظيفة "${job ? job.name : ''}"؟`,
        targetStatus ? 'play_circle' : 'power_settings_new',
        `${actionText} الآن`,
        'إلغاء',
        !targetStatus
    );

    if (!confirmed) return;

    try {
        const data = await apiFetch(`/renewal/api/jobs/update/${jobId}/`, {
            method: 'POST',
            body: JSON.stringify({ is_active: targetStatus })
        });

        if (data.success) {
            showToast(data.message || `✅ تم ${actionText} الوظيفة بنجاح`);
            const idx = state.jobs.findIndex(j => j.id === jobId);
            if (idx !== -1) {
                if (data.job) {
                    state.jobs[idx] = data.job;
                } else {
                    state.jobs[idx].is_active = targetStatus;
                }
            } else {
                await loadJobs();
            }
            renderTable();
        } else {
            showToast('❌ فشل تغيير الحالة: ' + (data.error || 'خطأ غير معروف'), 'error');
        }
    } catch (error) {
        showToast('❌ خطأ في الاتصال بالسيرفر: ' + error.message, 'error');
        console.error('Toggle status error:', error);
    }
}

async function openEdit(jobId) {
    if (window.USER_CAN_EDIT === false) {
        showToast('⚠️ عذراً، لا تمتلك صلاحية تعديل بيانات الوظائف.', 'error');
        return;
    }

    const job = state.jobs.find(j => j.id === jobId);
    if (!job) {
        showToast('❌ الوظيفة غير موجودة', 'error');
        return;
    }

    state.currentEditId = jobId;

    DOM.editArea.classList.remove('hidden');
    DOM.editLabel.innerText = `تعديل الوظيفة: ${job.name}`;
    DOM.inputName.value = job.name;
    DOM.inputDate.value = job.start_date;
    DOM.inputDuration.value = job.duration_days;
    DOM.inputStatus.checked = job.is_active;

    DOM.inputName.readOnly = false;
    DOM.inputName.removeAttribute('readonly');

    DOM.editArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetEditForm() {
    DOM.editArea.classList.add('hidden');
    DOM.editLabel.innerText = 'تعديل الوظيفة';
    DOM.inputName.value = '';
    DOM.inputName.readOnly = false;
    DOM.inputName.removeAttribute('readonly');
    DOM.inputDate.value = '';
    DOM.inputDuration.value = '';
    DOM.inputStatus.checked = true;
    state.currentEditId = null;
}

async function deleteJob(jobId) {
    if (window.USER_CAN_DELETE === false) {
        showToast('⚠️ عذراً، لا تمتلك صلاحية حذف الوظائف.', 'error');
        return;
    }

    const job = state.jobs.find(j => j.id === jobId);
    const jobName = job ? job.name : '';

    const confirmed = await showConfirmModal(
        'حذف الوظيفة',
        `هل أنت متأكد من رغبتك في حذف الوظيفة "${jobName}" نهائياً من النظام؟`,
        'delete',
        'حذف الآن',
        'إلغاء',
        true
    );

    if (!confirmed) return;

    try {
        const data = await apiFetch(`/renewal/api/jobs/delete/${jobId}/`, {
            method: 'POST'
        });

        if (data.success) {
            showToast(data.message || '✅ تم حذف الوظيفة بنجاح');
            state.jobs = state.jobs.filter(j => j.id !== jobId);
            if (state.currentEditId === jobId) {
                resetEditForm();
            }
            renderTable();
        } else {
            showToast('❌ فشل حذف الوظيفة: ' + (data.error || 'خطأ غير معروف'), 'error');
        }
    } catch (error) {
        showToast('❌ خطأ في الاتصال بالسيرفر: ' + error.message, 'error');
        console.error('Delete error:', error);
    }
}

async function saveJob() {
    const name = DOM.inputName.value.trim();
    const startDate = DOM.inputDate.value.trim();
    const duration = DOM.inputDuration.value.trim();
    const isActive = DOM.inputStatus.checked;

    // التحقق من صحة البيانات
    if (!name) {
        showToast('⚠️ اسم الوظيفة مطلوب', 'warning');
        DOM.inputName.focus();
        return;
    }

    if (!startDate) {
        showToast('⚠️ تاريخ الفتح مطلوب', 'warning');
        DOM.inputDate.focus();
        return;
    }

    if (!duration) {
        showToast('⚠️ المدة بالأيام مطلوبة', 'warning');
        DOM.inputDuration.focus();
        return;
    }

    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum < 1) {
        showToast('⚠️ المدة يجب أن تكون رقماً موجباً أكبر من 0', 'warning');
        DOM.inputDuration.focus();
        return;
    }

    // توليد رمز رمزي للوظيفة (يدعم الحروف العربية والإنجليزية ومطابقة إضافة طالب)
    let code = name.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

    if (!code || code.startsWith('job_')) {
        if (name.includes('إضافة') || name.includes('طالب')) {
            code = 'add_student';
        } else if (name.includes('تسجيل')) {
            code = 'registration';
        } else {
            code = 'job_' + Date.now();
        }
    }

    try {
        if (state.currentEditId) {
            // === تحديث وظيفة موجودة ===
            const data = await apiFetch(`/renewal/api/jobs/update/${state.currentEditId}/`, {
                method: 'POST',
                body: JSON.stringify({
                    name: name,
                    start_date: startDate,
                    duration_days: durationNum,
                    is_active: isActive,
                })
            });

            if (data.success) {
                showToast(data.message || '✅ تم حفظ التعديلات بنجاح');
                if (data.job) {
                    const idx = state.jobs.findIndex(j => j.id === state.currentEditId);
                    if (idx !== -1) {
                        state.jobs[idx] = data.job;
                    } else {
                        await loadJobs();
                    }
                } else {
                    await loadJobs();
                }
                renderTable();
                resetEditForm();
            } else {
                showToast('❌ فشل حفظ التعديلات: ' + (data.error || 'خطأ غير معروف'), 'error');
            }
        } else {
            // === إضافة وظيفة جديدة ===
            const data = await apiFetch('/renewal/api/jobs/create/', {
                method: 'POST',
                body: JSON.stringify({
                    name: name,
                    code: code,
                    start_date: startDate,
                    duration_days: durationNum,
                    is_active: isActive,
                })
            });

            if (data.success) {
                showToast(data.message || '✅ تم إضافة الوظيفة بنجاح');
                if (data.job) {
                    state.jobs.unshift(data.job);
                } else {
                    await loadJobs();
                }
                renderTable();
                resetEditForm();
            } else {
                showToast('❌ فشل إضافة الوظيفة: ' + (data.error || 'خطأ غير معروف'), 'error');
            }
        }
    } catch (error) {
        showToast('❌ خطأ في الاتصال بالسيرفر: ' + error.message, 'error');
        console.error('Save error:', error);
    }
}

function showAddJobForm() {
    if (window.USER_CAN_ADD === false) {
        showToast('⚠️ عذراً، لا تمتلك صلاحية إضافة وظائف جديدة.', 'error');
        return;
    }

    resetEditForm();
    state.currentEditId = null;

    DOM.editArea.classList.remove('hidden');
    DOM.editLabel.innerText = '➕ إضافة وظيفة جديدة';
    DOM.inputName.value = '';
    DOM.inputName.readOnly = false;
    DOM.inputName.removeAttribute('readonly');

    const todayStr = new Date().toISOString().split('T')[0];
    DOM.inputDate.value = todayStr;
    DOM.inputDuration.value = '7';
    DOM.inputStatus.checked = true;

    DOM.editArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    DOM.inputName.focus();
}

// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing jobs management...');
    
    // Read permissions from DOM dataset if available
    const mainEl = document.querySelector('main[data-user-can-add]');
    if (mainEl) {
        if (mainEl.dataset.userCanAdd === 'false') window.USER_CAN_ADD = false;
        if (mainEl.dataset.userCanDelete === 'false') window.USER_CAN_DELETE = false;
        if (mainEl.dataset.userCanEdit === 'false') window.USER_CAN_EDIT = false;
    }

    const addBtn = document.getElementById('addJobBtn');
    if (addBtn) {
        if (window.USER_CAN_ADD === false) {
            addBtn.style.display = 'none';
        } else {
            addBtn.addEventListener('click', showAddJobForm);
        }
    }

    loadJobs();
    console.log('✅ Jobs management initialized successfully');
});

// ============================================================
// Expose functions to global scope
// ============================================================

window.openEdit = openEdit;
window.deleteJob = deleteJob;
window.saveJob = saveJob;
window.showAddJobForm = showAddJobForm;
window.loadJobs = loadJobs;
window.resetEditForm = resetEditForm;
window.toggleJobStatus = toggleJobStatus;
if (typeof window.showToast !== 'function') {
    window.showToast = showToast;
}