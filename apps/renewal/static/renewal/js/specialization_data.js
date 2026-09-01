// ============================================================
// بيانات التخصص - Specialization Data (Connected to Backend)
// ============================================================

console.log('✅ specialization_data.js loaded successfully');

let specialtiesList = [];
let editIndex = -1;

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
    const tbody = document.getElementById('specialtyTableBody');
    const tableCard = document.getElementById('specialtyTableCard');
    if (!tbody || !tableCard) return;

    const normalizedQuery = normalizeArabic(filterQuery.trim());
    
    // إخفاء الجدول إذا لم يتم كتابة شيء للبحث
    if (normalizedQuery === '') {
        tableCard.classList.add('hidden');
        return;
    }

    tableCard.classList.remove('hidden');

    // فلترة التخصصات بناءً على البحث
    const filtered = specialtiesList.filter(s => {
        return normalizeArabic(s.name).includes(normalizedQuery) || normalizeArabic(s.code || '').includes(normalizedQuery);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4" class="text-center py-4 text-gray-500">لا توجد نتائج مطابقة</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map((s, index) => {
        const actualIndex = specialtiesList.indexOf(s);
        return `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td class="text-center"><strong>${escapeHtml(s.name)}</strong></td>
                <td class="text-center">${escapeHtml(s.code || '')}</td>
                <td class="text-center">
                    <div class="actions-cell">
                        <button type="button" class="btn-action-edit-row" onclick="window.editSpecialty(${actualIndex})" title="تعديل" style="margin-left: 6px;">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// جلب الأقسام/التخصصات من السيرفر
function loadSpecialties() {
    console.log('🔄 Loading specialties from backend...');
    fetch('/renewal/api/departments/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                specialtiesList = data.departments;
                console.log('✅ Loaded specialties:', specialtiesList);
                const searchInput = document.getElementById('searchSpecialtyInput');
                if (searchInput && searchInput.value) {
                    renderTable(searchInput.value);
                } else {
                    renderTable('');
                }
            } else {
                console.error('❌ Failed to load specialties:', data.error);
            }
        })
        .catch(err => console.error('❌ Error loading specialties:', err));
}

// إظهار صفحة الإضافة
function showAddPage() {
    const viewList = document.getElementById('viewList');
    const viewAdd = document.getElementById('viewAdd');
    
    if (viewList) viewList.classList.add('hidden');
    if (viewAdd) viewAdd.classList.remove('hidden');
    
    const nameInput = document.getElementById('specialtyNameInput');
    const codeInput = document.getElementById('specialtyCodeInput');
    if (nameInput && editIndex === -1) {
        nameInput.value = '';
        nameInput.focus();
    }
    if (codeInput && editIndex === -1) {
        codeInput.value = '';
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
    if (titleSpan) titleSpan.textContent = 'إضافة تخصص جديد';
    
    const saveBtn = document.querySelector('#viewAdd .btn-save');
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> تخزين';
    }
}

// دالة لتعديل التخصص
function editSpecialty(index) {
    console.log('📝 editSpecialty called for index:', index);
    editIndex = index;
    
    const nameInput = document.getElementById('specialtyNameInput');
    const codeInput = document.getElementById('specialtyCodeInput');
    
    if (nameInput) nameInput.value = specialtiesList[index].name;
    if (codeInput) codeInput.value = specialtiesList[index].code || '';
    
    const titleSpan = document.querySelector('#viewAdd .group-title');
    if (titleSpan) titleSpan.textContent = 'تعديل بيانات التخصص';
    
    const saveBtn = document.querySelector('#viewAdd .btn-save');
    if (saveBtn) {
        saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> تحديث';
    }
    
    showAddPage();
}

// دالة إضافة/تعديل تخصص
function addSpecialty() {
    const nameInput = document.getElementById('specialtyNameInput');
    const codeInput = document.getElementById('specialtyCodeInput');
    if (!nameInput || !codeInput) return;

    nameInput.style.borderColor = '';
    nameInput.placeholder = 'مثال: هندسة البرمجيات';
    codeInput.style.borderColor = '';
    codeInput.placeholder = 'مثال: SWE';

    const name = nameInput.value.trim();
    const code = codeInput.value.trim();

    if (!name) {
        nameInput.style.borderColor = '#dc2626';
        nameInput.placeholder = '⚠️ الرجاء إدخال اسم التخصص';
        nameInput.focus();
        if (typeof toastError === 'function') toastError('الرجاء إدخال اسم التخصص');
        return;
    }

    if (!code) {
        codeInput.style.borderColor = '#dc2626';
        codeInput.placeholder = '⚠️ الرجاء إدخال رمز التخصص';
        codeInput.focus();
        if (typeof toastError === 'function') toastError('الرجاء إدخال رمز التخصص');
        return;
    }

    const url = editIndex > -1 
        ? `/renewal/api/departments/update/${specialtiesList[editIndex].id}/`
        : '/renewal/api/departments/create/';

    console.log('📤 Sending specialty data:', { name, code });

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({ name, code })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (typeof toastSuccess === 'function') {
                toastSuccess(data.message || '✅ تم التخزين بنجاح');
            }
            loadSpecialties();
            showListPage();
            nameInput.value = '';
            codeInput.value = '';
        } else {
            if (typeof toastError === 'function') {
                toastError(data.error || '❌ حدث خطأ أثناء الحفظ');
            }
        }
    })
    .catch(err => {
        console.error(err);
        if (typeof toastError === 'function') toastError('❌ حدث خطأ في الاتصال بالخادم');
    });
}

// دالة حذف التخصص
function deleteSpecialty(id) {
    if (!confirm('هل أنت متأكد من حذف هذا التخصص؟')) return;

    fetch(`/renewal/api/departments/delete/${id}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (typeof toastSuccess === 'function') {
                toastSuccess(data.message || '✅ تم حذف التخصص بنجاح');
            }
            loadSpecialties();
        } else {
            if (typeof toastError === 'function') {
                toastError(data.error || '❌ فشل في حذف التخصص');
            }
        }
    })
    .catch(err => {
        console.error(err);
        if (typeof toastError === 'function') toastError('❌ حدث خطأ في الاتصال بالخادم');
    });
}

// دالة فلترة التخصصات من خانة البحث
function filterSpecialties() {
    const searchInput = document.getElementById('searchSpecialtyInput');
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
    loadSpecialties();

    const searchInput = document.getElementById('searchSpecialtyInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterSpecialties();
            }
        });
    }

    const nameInput = document.getElementById('specialtyNameInput');
    if (nameInput) {
        nameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSpecialty();
            }
        });
    }

    const codeInput = document.getElementById('specialtyCodeInput');
    if (codeInput) {
        codeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSpecialty();
            }
        });
    }
}

window.addSpecialty = addSpecialty;
window.editSpecialty = editSpecialty;
window.deleteSpecialty = deleteSpecialty;
window.filterSpecialties = filterSpecialties;
window.showAddPage = showAddPage;
window.showListPage = showListPage;
window.goBack = goBack;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
