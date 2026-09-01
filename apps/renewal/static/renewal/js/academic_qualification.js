// ============================================================
// بيانات المؤهل العلمي - Academic Qualification (Connected to Backend)
// academic_qualification.js v1.1.0
// ============================================================

console.log('✅ academic_qualification.js loaded successfully');

let qualificationsList = [];
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
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// دالة تطبيع الحروف العربية لتسهيل البحث وتفادي مشاكل الهمزات والتاء المربوطة
function normalizeArabic(str) {
    if (!str) return '';
    return str
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .toLowerCase();
}

// دالة لتطهير النصوص ومنع هجمات XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// دالة رندرة الجدول
function renderTable(filterQuery = '') {
    const tbody = document.getElementById('qualificationTableBody');
    const tableCard = document.getElementById('qualificationTableCard');
    if (!tbody || !tableCard) return;

    const normalizedQuery = normalizeArabic(filterQuery.trim());
    
    // إخفاء الجدول إذا لم يتم كتابة شيء للبحث
    if (normalizedQuery === '') {
        tableCard.classList.add('hidden');
        return;
    }

    tableCard.classList.remove('hidden');

    // فلترة المؤهلات بناءً على البحث
    const filtered = qualificationsList.filter(q => {
        return normalizeArabic(q.name).includes(normalizedQuery);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4" class="text-center py-4 text-gray-500">لا توجد نتائج مطابقة</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map((q, index) => {
        const actualIndex = qualificationsList.indexOf(q);
        const isActive = q.is_active !== false;
        const statusBadge = isActive
            ? `<button type="button" class="btn-toggle-status" onclick="window.toggleQualificationActive(${q.id}, ${actualIndex})" style="padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; background: #dcfce7; color: #166534; border: 1px solid #86efac; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;" title="انقر لإلغاء التفعيل">
                <span class="material-symbols-outlined" style="font-size: 16px;">check_circle</span> مفعل
               </button>`
            : `<button type="button" class="btn-toggle-status" onclick="window.toggleQualificationActive(${q.id}, ${actualIndex})" style="padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 0.8rem; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;" title="انقر للتفعيل">
                <span class="material-symbols-outlined" style="font-size: 16px;">cancel</span> معطل
               </button>`;

        return `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td class="text-center"><strong>${escapeHtml(q.name)}</strong></td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">
                    <div class="actions-cell" style="display: flex; justify-content: center; gap: 6px;">
                        <button type="button" class="btn-action-edit-row" onclick="window.editQualification(${actualIndex})" title="تعديل المؤهل" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 6px; background: rgba(14, 165, 233, 0.12); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); cursor: pointer; transition: all 0.2s;">
                            <span class="material-symbols-outlined" style="font-size: 18px;">edit</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// جلب المؤهلات من السيرفر
function loadQualifications() {
    console.log('🔄 Loading qualifications from backend...');
    fetch('/renewal/api/qualifications/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                qualificationsList = data.qualifications;
                console.log('✅ Loaded qualifications:', qualificationsList);
                const searchInput = document.getElementById('searchQualificationInput');
                if (searchInput && searchInput.value) {
                    renderTable(searchInput.value);
                } else {
                    renderTable('');
                }
            } else {
                console.error('❌ Failed to load qualifications:', data.error);
            }
        })
        .catch(err => console.error('❌ Error loading qualifications:', err));
}

// دالة لتعديل المؤهل
function editQualification(index) {
    console.log('📝 editQualification called for index:', index);
    editIndex = index;
    const item = qualificationsList[index];
    if (!item) return;
    
    const input = document.getElementById('qualificationInput');
    if (input) {
        input.value = item.name;
        input.focus();
    }
    
    const formGroupBox = document.getElementById('qualificationForm')?.closest('.group-box');
    if (formGroupBox) {
        const titleSpan = formGroupBox.querySelector('.group-title');
        if (titleSpan) titleSpan.textContent = `تعديل بيانات المؤهل العلمي: ${item.name}`;
    }
    
    const addBtn = document.querySelector('#qualificationForm .btn-new');
    if (addBtn) {
        addBtn.innerHTML = '<span class="material-symbols-outlined">save</span> تحديث المؤهل';
    }

    showNotification('info', `✏️ تم تفعيل وضع تعديل بيانات المؤهل العلمي (${item.name})`);
}

// دالة إضافة/تعديل مؤهل
function addQualification() {
    const input = document.getElementById('qualificationInput');
    if (!input) return;

    input.style.borderColor = '';
    input.placeholder = 'مثال: دبلوم عالي';

    const name = input.value.trim();

    if (!name) {
        input.style.borderColor = '#dc2626';
        input.placeholder = '⚠️ الرجاء إدخال اسم المؤهل';
        input.focus();
        showNotification('warning', '⚠️ الرجاء إدخال اسم المؤهل العلمي أولاً');
        return;
    }

    const isEdit = editIndex > -1;
    const url = isEdit 
        ? `/renewal/api/qualifications/update/${qualificationsList[editIndex].id}/`
        : '/renewal/api/qualifications/create/';

    console.log('📤 Sending qualification data:', { name });

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('success', data.message || (isEdit ? '✅ تم تحديث بيانات المؤهل بنجاح' : '✅ تم إضافة المؤهل بنجاح'));
            loadQualifications();
            input.value = '';
            
            // إعادة ضبط النموذج
            editIndex = -1;
            const formGroupBox = document.getElementById('qualificationForm')?.closest('.group-box');
            if (formGroupBox) {
                const titleSpan = formGroupBox.querySelector('.group-title');
                if (titleSpan) titleSpan.textContent = 'بيانات المؤهل العلمي والبحث';
            }
            const addBtn = document.querySelector('#qualificationForm .btn-new');
            if (addBtn) {
                addBtn.innerHTML = '<span class="material-symbols-outlined">add</span> إضافة مؤهل';
            }
            
            // تفعيل عرض الجدول للمؤهل الجديد
            const searchInput = document.getElementById('searchQualificationInput');
            if (searchInput) {
                searchInput.value = name;
            }
            renderTable(name);
        } else {
            showNotification('error', data.error || '❌ حدث خطأ أثناء حفظ المؤهل');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', '❌ حدث خطأ في الاتصال بالخادم');
    });
}

// دالة حذف مؤهل
function deleteQualification(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المؤهل العلمي؟')) return;

    fetch(`/renewal/api/qualifications/delete/${id}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('success', data.message || '✅ تم حذف المؤهل بنجاح');
            loadQualifications();
        } else {
            showNotification('error', data.error || '❌ فشل في حذف المؤهل');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', '❌ حدث خطأ في الاتصال بالخادم');
    });
}

// دالة تبديل حالة تفعيل المؤهل العلمي
function toggleQualificationActive(id, index) {
    const item = qualificationsList[index];
    const willBeActive = item ? !item.is_active : true;

    fetch(`/renewal/api/qualifications/toggle-active/${id}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            if (qualificationsList[index]) {
                qualificationsList[index].is_active = data.is_active;
            }
            const searchInput = document.getElementById('searchQualificationInput');
            renderTable(searchInput ? searchInput.value : '');
            const notifType = data.is_active ? 'success' : 'warning';
            showNotification(notifType, data.message || (data.is_active ? '✅ تم تفعيل المؤهل بنجاح' : '⚠️ تم تعطيل المؤهل بنجاح'));
        } else {
            showNotification('error', data.error || '❌ فشل تغيير حالة تفعيل المؤهل');
        }
    })
    .catch(err => {
        console.error(err);
        showNotification('error', '❌ حدث خطأ في الاتصال بالخادم');
    });
}

// دالة فلترة المؤهلات من خانة البحث
function filterQualifications() {
    const searchInput = document.getElementById('searchQualificationInput');
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
    loadQualifications();
    
    const input = document.getElementById('qualificationInput');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addQualification();
            }
        });
        input.focus();
    }

    const searchInput = document.getElementById('searchQualificationInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterQualifications();
            }
        });
    }
}

// ربط الدوال لتمكين استدعائها من الـ HTML
window.addQualification = addQualification;
window.editQualification = editQualification;
window.deleteQualification = deleteQualification;
window.toggleQualificationActive = toggleQualificationActive;
window.filterQualifications = filterQualifications;
window.goBack = goBack;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

