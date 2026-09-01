// ============================================================
// إدارة بيانات الفصول الدراسية - Class/Semester Data (Connected to Backend)
// class_data.js v1.1.0
// ============================================================

console.log('✅ class_data.js loaded successfully');

let semestersList = [];
let editIndex = -1;

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
window.showToastMessage = (message, isError = false, type = null) => {
    if (type) {
        showNotification(type, message);
    } else {
        showNotification(isError ? 'error' : 'success', message);
    }
};

// دالة لجلب الـ CSRF Token من الكوكيز
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                try {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                } catch (e) {
                    cookieValue = cookie.substring(name.length + 1);
                }
                break;
            }
        }
    }
    return cookieValue;
}

// دالة لتطهير النصوص ومنع هجمات XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

// دالة رندرة الجدول
function renderTable(filterQuery = '') {
    const tbody = document.getElementById('semesterTableBody');
    const tableCard = document.getElementById('semesterTableCard');
    if (!tbody || !tableCard) return;

    const canManage = (typeof window.CAN_MANAGE_SEMESTERS !== 'undefined') ? window.CAN_MANAGE_SEMESTERS : true;
    const query = filterQuery.trim().toLowerCase();
    
    // إخفاء الجدول إذا لم يتم كتابة شيء للبحث
    if (query === '') {
        tableCard.classList.add('hidden');
        return;
    }

    tableCard.classList.remove('hidden');

    // فلترة الفصول بناءً على البحث
    const filtered = semestersList.filter(s => {
        const typeArabic = s.type_display || (s.type === 'spring' ? 'الربيع' : (s.type === 'fall' ? 'الخريف' : (s.type === 'summer' ? 'الصيف' : s.type)));
        const statusArabic = s.is_active ? 'مفعل' : 'غير فعال';
        const yearMatch = String(s.year).includes(query);
        const typeMatch = typeArabic.toLowerCase().includes(query);
        const statusMatch = statusArabic.toLowerCase().includes(query);
        return yearMatch || typeMatch || statusMatch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5" class="text-center py-4 text-gray-500">لا توجد نتائج مطابقة</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map((s, index) => {
        const actualIndex = semestersList.indexOf(s);
        const typeText = s.type_display || (s.type === 'spring' ? 'الربيع' : (s.type === 'fall' ? 'الخريف' : (s.type === 'summer' ? 'الصيف' : s.type)));
        
        let statusBadge = '';
        if (canManage) {
            statusBadge = s.is_active
                ? `<button type="button" class="btn-toggle-status" onclick="window.toggleSemesterActive(${s.id}, ${actualIndex})" style="padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; background: #dcfce7; color: #166534; border: 1px solid #86efac; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;" title="انقر لإلغاء التفعيل">
                    <span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span> مفعل
                   </button>`
                : `<button type="button" class="btn-toggle-status" onclick="window.toggleSemesterActive(${s.id}, ${actualIndex})" style="padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;" title="انقر للتفعيل">
                    <span class="material-symbols-outlined" style="font-size: 16px;">cancel</span> غير فعال
                   </button>`;
        } else {
            statusBadge = s.is_active
                ? `<span style="padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; background: #dcfce7; color: #166534; border: 1px solid #86efac; display: inline-flex; align-items: center; gap: 4px;">
                    <span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span> مفعل
                   </span>`
                : `<span style="padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; display: inline-flex; align-items: center; gap: 4px;">
                    <span class="material-symbols-outlined" style="font-size: 16px;">cancel</span> غير فعال
                   </span>`;
        }

        const actionsCell = canManage
            ? `<div class="actions-cell" style="display: flex; justify-content: center; gap: 6px;">
                    <button type="button" class="btn-action-edit-row" onclick="window.editSemester(${actualIndex})" title="تعديل الفصل" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; background: rgba(14, 165, 233, 0.12); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); cursor: pointer; transition: all 0.2s;">
                        <span class="material-symbols-outlined" style="font-size: 18px;">edit</span>
                    </button>
               </div>`
            : `<span style="font-size: 0.82rem; color: #94a3b8; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                    <span class="material-symbols-outlined" style="font-size: 16px;">lock</span> عرض فقط
               </span>`;
        
        return `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td class="text-center"><strong>${s.year}</strong></td>
                <td class="text-center">${escapeHtml(typeText)}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">${actionsCell}</td>
            </tr>
        `;
    }).join('');
}

// جلب الفصول الدراسية من السيرفر
function loadSemesters() {
    console.log('🔄 Loading semesters from backend...');
    fetch('/renewal/api/semesters/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                semestersList = data.semesters;
                console.log('✅ Loaded semesters:', semestersList);
                const searchInput = document.getElementById('searchSemesterInput');
                if (searchInput && searchInput.value) {
                    renderTable(searchInput.value);
                } else {
                    renderTable('');
                }
            } else {
                console.error('❌ Failed to load semesters:', data.error);
            }
        })
        .catch(err => console.error('❌ Error loading semesters:', err));
}

// إظهار صفحة الإضافة
function showAddPage() {
    if (typeof window.CAN_MANAGE_SEMESTERS !== 'undefined' && !window.CAN_MANAGE_SEMESTERS) {
        showNotification('warning', '❌ ليس لديك الصلاحية الدقيقة لإضافة أو تعديل الفصول الدراسية.');
        return;
    }

    const viewList = document.getElementById('viewList');
    const viewAdd = document.getElementById('viewAdd');
    
    if (viewList) viewList.classList.add('hidden');
    if (viewAdd) viewAdd.classList.remove('hidden');
    
    const yearInput = document.getElementById('semesterYearInput');
    if (yearInput && editIndex === -1) {
        yearInput.value = new Date().getFullYear();
        yearInput.focus();
    }
}

// إظهار صفحة القائمة
function showListPage() {
    const viewList = document.getElementById('viewList');
    const viewAdd = document.getElementById('viewAdd');
    
    if (viewAdd) viewAdd.classList.add('hidden');
    if (viewList) viewList.classList.remove('hidden');

    editIndex = -1;
    const titleSpan = document.querySelector('#viewAdd .group-title');
    if (titleSpan) titleSpan.textContent = 'إضافة فصل دراسي جديد';
    
    const saveBtn = document.querySelector('#viewAdd .btn-save');
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> تخزين';
    }
}

// دالة لتعديل الفصل الدراسي
function editSemester(index) {
    if (typeof window.CAN_MANAGE_SEMESTERS !== 'undefined' && !window.CAN_MANAGE_SEMESTERS) {
        showNotification('warning', '❌ ليس لديك الصلاحية الدقيقة لتعديل الفصول الدراسية.');
        return;
    }

    console.log('📝 editSemester called for index:', index);
    editIndex = index;
    
    const sem = semestersList[index];
    if (!sem) return;

    const yearInput = document.getElementById('semesterYearInput');
    const typeInput = document.getElementById('semesterTypeInput');
    const statusInput = document.getElementById('semesterStatusInput');
    
    if (yearInput) yearInput.value = sem.year;
    
    // تحويل القيمة العربية إلى القيمة المقابلة في الـ select
    let typeVal = 'ربيع';
    if (sem.type === 'fall' || sem.type_display === 'الخريف' || sem.type_display === 'خريف') typeVal = 'خريف';
    else if (sem.type === 'spring' || sem.type_display === 'الربيع' || sem.type_display === 'ربيع') typeVal = 'ربيع';
    else if (sem.type === 'summer' || sem.type_display === 'الصيف' || sem.type_display === 'صيف') typeVal = 'صيف';
    
    if (typeInput) typeInput.value = typeVal;
    if (statusInput) statusInput.value = sem.is_active ? 'مفعل' : 'غير فعال';
    
    const titleSpan = document.querySelector('#viewAdd .group-title');
    if (titleSpan) titleSpan.textContent = `تعديل بيانات الفصل الدراسي: ${sem.type_display || sem.type} ${sem.year}`;
    
    const saveBtn = document.querySelector('#viewAdd .btn-save');
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> تحديث';
    }
    
    showAddPage();
    showNotification('info', `✏️ تم تفعيل وضع تعديل بيانات الفصل الدراسي (${sem.type_display || sem.type} ${sem.year})`);
}

// دالة إضافة/تعديل فصل دراسي
function addSemester() {
    if (typeof window.CAN_MANAGE_SEMESTERS !== 'undefined' && !window.CAN_MANAGE_SEMESTERS) {
        showNotification('warning', '❌ ليس لديك الصلاحية الدقيقة لإضافة أو تعديل الفصول الدراسية.');
        return;
    }

    const yearInput = document.getElementById('semesterYearInput');
    const typeInput = document.getElementById('semesterTypeInput');
    const statusInput = document.getElementById('semesterStatusInput');
    if (!yearInput || !typeInput || !statusInput) return;

    yearInput.style.borderColor = '';
    yearInput.placeholder = 'مثال: 2026';

    const year = parseInt(yearInput.value, 10);
    const typeArabic = typeInput.value.trim();
    const status = statusInput.value.trim();

    if (!year || isNaN(year)) {
        yearInput.style.borderColor = '#dc2626';
        yearInput.placeholder = '⚠️ أدخل سنة صحيحة';
        yearInput.focus();
        showNotification('warning', '⚠️ الرجاء إدخال سنة أكاديمية صحيحة');
        return;
    }

    // تحويل القيمة للباك اند
    let typeVal = 'spring';
    if (typeArabic === 'خريف') typeVal = 'fall';
    else if (typeArabic === 'ربيع') typeVal = 'spring';
    else if (typeArabic === 'صيف') typeVal = 'summer';

    const is_active = (status === 'مفعل');
    const isEdit = editIndex > -1;

    const url = isEdit 
        ? `/renewal/api/semesters/update/${semestersList[editIndex].id}/`
        : '/renewal/api/semesters/create/';

    console.log('📤 Sending semester data:', { year, type: typeVal, is_active });

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            year: year,
            type: typeVal,
            is_active: is_active
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('success', data.message || (isEdit ? '✅ تم تحديث الفصل الدراسي بنجاح' : '✅ تم إضافة الفصل الدراسي بنجاح'));
            loadSemesters();
            showListPage();
            yearInput.value = '';
            
            const searchInput = document.getElementById('searchSemesterInput');
            if (searchInput) {
                searchInput.value = String(year);
            }
            renderTable(String(year));
        } else {
            showNotification('error', data.error || '❌ حدث خطأ أثناء حفظ الفصل الدراسي');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', '❌ حدث خطأ في الاتصال بالخادم');
    });
}

// دالة حذف الفصل الدراسي
function deleteSemester(id) {
    if (typeof window.CAN_MANAGE_SEMESTERS !== 'undefined' && !window.CAN_MANAGE_SEMESTERS) {
        showNotification('warning', '❌ ليس لديك الصلاحية الدقيقة لحذف الفصول الدراسية.');
        return;
    }

    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الفصل الدراسي؟')) return;

    fetch(`/renewal/api/semesters/delete/${id}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('success', data.message || '✅ تم حذف الفصل الدراسي');
            loadSemesters();
        } else {
            showNotification('error', data.error || '❌ فشل في حذف الفصل الدراسي');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', '❌ حدث خطأ في الاتصال بالخادم');
    });
}

// دالة تبديل تفعيل الفصل الدراسي
function toggleSemesterActive(id, index) {
    if (typeof window.CAN_MANAGE_SEMESTERS !== 'undefined' && !window.CAN_MANAGE_SEMESTERS) {
        showNotification('warning', '❌ ليس لديك الصلاحية الدقيقة لتفعيل أو تغيير حالة الفصول الدراسية.');
        return;
    }

    const sem = semestersList[index];
    if (!sem) return;
    const newActiveState = !sem.is_active;

    fetch(`/renewal/api/semesters/update/${id}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            year: sem.year,
            type: sem.type,
            is_active: newActiveState
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            loadSemesters();
            const notifType = newActiveState ? 'success' : 'warning';
            showNotification(notifType, newActiveState ? `✅ تم تفعيل الفصل الدراسي (${sem.type_display || sem.type} ${sem.year}) بنجاح` : `⚠️ تم تعطيل الفصل الدراسي (${sem.type_display || sem.type} ${sem.year})`);
        } else {
            showNotification('error', data.error || '❌ فشل تغيير حالة تفعيل الفصل');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', '❌ حدث خطأ في الاتصال بالخادم');
    });
}

// دالة فلترة الفصول من خانة البحث
function filterSemesters() {
    const searchInput = document.getElementById('searchSemesterInput');
    const query = searchInput ? searchInput.value : '';
    renderTable(query);
}

// دالة الرجوع للخلف
function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

// بدء التشغيل
function init() {
    loadSemesters();

    const searchInput = document.getElementById('searchSemesterInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterSemesters();
            }
        });
    }

    const yearInput = document.getElementById('semesterYearInput');
    if (yearInput) {
        yearInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSemester();
            }
        });
    }

    const typeInput = document.getElementById('semesterTypeInput');
    if (typeInput) {
        typeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSemester();
            }
        });
    }

    const statusInput = document.getElementById('semesterStatusInput');
    if (statusInput) {
        statusInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSemester();
            }
        });
    }
}

window.addSemester = addSemester;
window.editSemester = editSemester;
window.deleteSemester = deleteSemester;
window.toggleSemesterActive = toggleSemesterActive;
window.filterSemesters = filterSemesters;
window.showAddPage = showAddPage;
window.showListPage = showListPage;
window.goBack = goBack;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

