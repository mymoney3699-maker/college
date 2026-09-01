'use strict';

/**
 * non_libyan_students.js – v1.0.0
 * ملف التحكم في استعلام وإحصائيات وطباعة تقارير الطلاب غير الليبيين
 */

console.log('🚀 non_libyan_students.js loaded');

// ============================================================
// 1. المتغيرات العامة
// ============================================================
let studentsData = [];
let currentPage = 1;
let pageSize = 20;
let currentSort = { field: 'student_id', direction: 'asc' };
let totalStudents = 0;
let statsData = {
    total: 0,
    nationalities: 0,
    active: 0,
    passport_holders: 0
};
let filterTimeout = null;
let debounceTimeout = null;

// ============================================================
// 2. أدوات مساعدة
// ============================================================
function getCsrfToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === ('csrftoken=')) {
                cookieValue = decodeURIComponent(cookie.substring(10));
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

function showToast(message, type = 'success') {
    if (typeof toastSuccess === 'function' && type === 'success') {
        toastSuccess(message);
    } else if (typeof toastError === 'function' && type === 'error') {
        toastError(message);
    } else if (typeof toastWarning === 'function' && type === 'warning') {
        toastWarning(message);
    } else if (typeof toastInfo === 'function' && type === 'info') {
        toastInfo(message);
    } else {
        console.log(`[${type}]`, message);
    }
}

// ============================================================
// 3. جلب الطلاب غير الليبيين تلقائياً من API
// ============================================================
function fetchNonLibyanStudents() {
    console.log('🔄 Fetching non-Libyan students...');
    
    const nationalitySelect = document.getElementById('filterNationality');
    const departmentSelect = document.getElementById('filterDepartment');
    const searchInput = document.getElementById('searchInput');
    
    const nationalityId = nationalitySelect ? nationalitySelect.value : '';
    const departmentId = departmentSelect ? departmentSelect.value : '';
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    
    const tbody = document.getElementById('studentsBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="non-libyan-table__td--empty">
                    <div class="non-libyan-empty-state">
                        <span class="material-symbols-outlined animate-spin">sync</span>
                        <p class="non-libyan-empty-state__title">جاري تحميل بيانات الطلاب غير الليبيين...</p>
                    </div>
                </td>
            </tr>
        `;
    }
    
    const baseUrl = window.NON_LIBYAN_API_URL || '/renewal/api/non-libyan-students/';
    let url = `${baseUrl}?`;
    
    if (nationalityId && nationalityId !== 'all' && nationalityId !== '0') {
        url += `nationality_id=${encodeURIComponent(nationalityId)}&`;
    }
    
    if (departmentId && departmentId !== 'all' && departmentId !== '0') {
        url += `department_id=${encodeURIComponent(departmentId)}&`;
    }
    
    if (searchQuery) {
        url += `search=${encodeURIComponent(searchQuery)}&`;
    }
    
    if (currentSort.field) {
        url += `order_by=${currentSort.direction === 'desc' ? '-' : ''}${currentSort.field}&`;
    }
    
    fetch(url, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': getCsrfToken()
        }
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.success) {
            studentsData = data.students || [];
            totalStudents = data.count || studentsData.length;
            
            if (data.stats) {
                statsData = data.stats;
            } else {
                calculateStats();
            }
            
            updateStatistics();
            renderTable();
            updateSearchSummary(searchQuery);
            updateActiveFilters();
            updateLastUpdateTime();
        } else {
            showToast(data.message || 'حدث خطأ في جلب البيانات', 'error');
            renderEmptyTable('حدث خطأ أثناء جلب البيانات');
        }
    })
    .catch(error => {
        console.error("خطأ في جلب البيانات:", error);
        showToast('حدث خطأ في الاتصال بالسيرفر', 'error');
        renderEmptyTable('فشل الاتصال بالسيرفر: ' + error.message);
    });
}

// ============================================================
// 4. حساب وتحديث الإحصائيات
// ============================================================
function calculateStats() {
    statsData.total = studentsData.length;
    
    const nationalities = new Set();
    studentsData.forEach(s => {
        if (s.nationality_id) nationalities.add(s.nationality_id);
    });
    statsData.nationalities = nationalities.size;
    
    statsData.active = studentsData.filter(s => {
        const status = s.status_name || '';
        return status.includes('مستمر') || status.includes('منتظم');
    }).length;
    
    statsData.passport_holders = studentsData.filter(s => 
        s.passport_number && s.passport_number.length > 0
    ).length;
}

function updateStatistics() {
    const totalEl = document.getElementById('totalStudents');
    if (totalEl) totalEl.textContent = statsData.total || 0;
    
    const nationalitiesEl = document.getElementById('totalNationalities');
    if (nationalitiesEl) nationalitiesEl.textContent = statsData.nationalities || 0;
    
    const activeEl = document.getElementById('activeStudents');
    if (activeEl) activeEl.textContent = statsData.active || 0;
    
    const passportEl = document.getElementById('passportHolders');
    if (passportEl) passportEl.textContent = statsData.passport_holders || 0;
}

// ============================================================
// 5. عرض الجدول والتنقل
// ============================================================
function renderTable() {
    const tbody = document.getElementById('studentsBody');
    if (!tbody) return;
    
    if (studentsData.length === 0) {
        renderEmptyTable('لا توجد نتائج مطابقة للبحث أو الفلترة');
        return;
    }
    
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, studentsData.length);
    const pageData = studentsData.slice(start, end);
    
    let html = '';
    pageData.forEach((student, index) => {
        let badgeClass = 'non-libyan-badge--info';
        const statusName = student.status_name || '';
        if (statusName.includes('مستمر') || statusName.includes('منتظم')) {
            badgeClass = 'non-libyan-badge--success';
        } else if (statusName.includes('موقوف') || statusName.includes('سحب')) {
            badgeClass = 'non-libyan-badge--danger';
        } else if (statusName.includes('جديد') || statusName.includes('مقبول')) {
            badgeClass = 'non-libyan-badge--warning';
        } else if (statusName.includes('خريج')) {
            badgeClass = 'non-libyan-badge--primary';
        }
        
        const isLibyan = (student.nationality_name || '').includes('ليبي') || (student.nationality_name || '').includes('ليبيا');
        let idVal = '';
        if (isLibyan || (student.national_id && student.national_id.trim() !== '')) {
            idVal = student.national_id || student.passport_number || '';
        } else {
            idVal = student.passport_number || student.national_id || '';
        }
        
        const passportDisplay = idVal.trim()
            ? `<span class="non-libyan-passport-code">${escapeHtml(idVal)}</span>` 
            : '<span style="color: #cbd5e1;">-</span>';
        
        const fullName = student.full_name || student.name || '-';
        
        html += `
            <tr>
                <td style="text-align: center; color: #64748b;">${start + index + 1}</td>
                <td><strong style="color: #2b7d91;">${escapeHtml(student.student_id || '-')}</strong></td>
                <td style="font-weight: 600;">${escapeHtml(fullName)}</td>
                <td><span class="non-libyan-badge non-libyan-badge--info">${escapeHtml(student.nationality_name || '-')}</span></td>
                <td>${passportDisplay}</td>
                <td>${escapeHtml(student.department_name || '-')}</td>
                <td><span class="non-libyan-badge ${badgeClass}">${escapeHtml(statusName || '-')}</span></td>
                <td style="text-align: center;">
                    <button type="button" class="non-libyan-btn-icon" onclick="window.viewStudent('${student.id}')" title="عرض التفاصيل">
                        <span class="material-symbols-outlined">visibility</span>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    updatePagination(start, end);
    
    const recordsCount = document.getElementById('recordsCount');
    if (recordsCount) recordsCount.textContent = `عرض ${start + 1} - ${end} من ${studentsData.length}`;
    
    const paginationInfo = document.getElementById('paginationInfo');
    if (paginationInfo) paginationInfo.textContent = `عرض ${start + 1} - ${end} من ${studentsData.length} نتيجة`;
    
    const footerTotalCount = document.getElementById('footerTotalCount');
    if (footerTotalCount) footerTotalCount.textContent = studentsData.length;
}

function renderEmptyTable(message) {
    const tbody = document.getElementById('studentsBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="non-libyan-table__td--empty">
                <div class="non-libyan-empty-state">
                    <span class="material-symbols-outlined">search_off</span>
                    <p class="non-libyan-empty-state__title">${message}</p>
                    <p class="non-libyan-empty-state__sub">حاول مسح الفلاتر أو تغيير معايير البحث</p>
                </div>
            </td>
        </tr>
    `;
    
    const rc = document.getElementById('recordsCount');
    if (rc) rc.textContent = 'عرض 0 - 0 من 0';
    const pi = document.getElementById('paginationInfo');
    if (pi) pi.textContent = 'عرض 0 - 0 من 0 نتيجة';
    const ftc = document.getElementById('footerTotalCount');
    if (ftc) ftc.textContent = '0';
    updatePagination(0, 0);
}

function updatePagination(start, end) {
    const totalPages = Math.ceil(studentsData.length / pageSize);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1 || studentsData.length === 0;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages || studentsData.length === 0;
    
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pageNumbers) return;
    
    if (studentsData.length === 0) {
        pageNumbers.innerHTML = '<span class="non-libyan-page-num non-libyan-page-num--active">1</span>';
        return;
    }
    
    let pagesHtml = '';
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        pagesHtml += `<span class="non-libyan-page-num" onclick="window.goToPage(1)">1</span>`;
        if (startPage > 2) {
            pagesHtml += `<span class="non-libyan-page-num" style="cursor: default; opacity: 0.5;">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<span class="non-libyan-page-num ${i === currentPage ? 'non-libyan-page-num--active' : ''}" onclick="window.goToPage(${i})">${i}</span>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pagesHtml += `<span class="non-libyan-page-num" style="cursor: default; opacity: 0.5;">...</span>`;
        }
        pagesHtml += `<span class="non-libyan-page-num" onclick="window.goToPage(${totalPages})">${totalPages}</span>`;
    }
    
    pageNumbers.innerHTML = pagesHtml || '<span class="non-libyan-page-num non-libyan-page-num--active">1</span>';
}

function updateSearchSummary(searchQuery) {
    const summary = document.getElementById('searchSummary');
    const summaryText = document.getElementById('searchSummaryText');
    if (!summary || !summaryText) return;
    
    const nationalityId = document.getElementById('filterNationality')?.value || '';
    const departmentId = document.getElementById('filterDepartment')?.value || '';
    const hasFilters = searchQuery || (nationalityId && nationalityId !== 'all') || (departmentId && departmentId !== 'all');
    
    if (hasFilters) {
        summary.classList.remove('non-libyan-search-summary--hidden');
        let message = `تم العثور على ${studentsData.length} طالب غير ليبي`;
        if (searchQuery) message += ` مطابق للبحث "${searchQuery}"`;
        summaryText.textContent = message;
    } else {
        summary.classList.add('non-libyan-search-summary--hidden');
    }
}

function updateActiveFilters() {
    const nationality = document.getElementById('filterNationality');
    const department = document.getElementById('filterDepartment');
    const search = document.getElementById('searchInput')?.value?.trim() || '';
    
    let filters = [];
    if (nationality && nationality.value && nationality.value !== 'all') {
        const text = nationality.options[nationality.selectedIndex]?.text || '';
        filters.push(`الجنسية: ${text}`);
    }
    if (department && department.value && department.value !== 'all') {
        const text = department.options[department.selectedIndex]?.text || '';
        filters.push(`التخصص: ${text}`);
    }
    if (search) {
        filters.push(`بحث: "${search}"`);
    }
    
    const activeFilters = document.getElementById('activeFilters');
    if (activeFilters) {
        activeFilters.textContent = filters.length > 0 ? filters.join(' | ') : 'لا يوجد (يعرض كافة الطلاب غير الليبيين)';
    }
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    
    const lastUpdate = document.getElementById('lastUpdateTime');
    if (lastUpdate) lastUpdate.textContent = `${dateStr} ${timeStr}`;
}

// ============================================================
// 6. 🔥 طباعة التقرير الموحد العمودي (A4 Portrait)
// ============================================================
function printReport() {
    const nationalitySelect = document.getElementById('filterNationality');
    const departmentSelect  = document.getElementById('filterDepartment');

    const nationalityText = (nationalitySelect && nationalitySelect.selectedIndex > 0 && nationalitySelect.value !== 'all')
        ? nationalitySelect.options[nationalitySelect.selectedIndex]?.text
        : 'جميع الجنسيات';

    const deptText = (departmentSelect && departmentSelect.selectedIndex > 0 && departmentSelect.value !== 'all')
        ? departmentSelect.options[departmentSelect.selectedIndex]?.text
        : 'جميع التخصصات';

    // ① تاريخ السحب فقط بدون وقت
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });

    // ② تعبئة عناصر الرأس في حاوية التقرير
    const rptDept = document.getElementById('rptPrintDept');
    const rptNat  = document.getElementById('rptPrintNationality');
    const rptDate = document.getElementById('rptPrintDateVal');
    const rptTotal= document.getElementById('rptPrintTotalCount');
    const rptBody = document.getElementById('rptPrintTableBody');

    if (rptDept)  rptDept.textContent  = deptText;
    if (rptNat)   rptNat.textContent   = nationalityText;
    if (rptDate)  rptDate.textContent  = dateStr;
    if (rptTotal) rptTotal.textContent = `${studentsData.length} طالب`;

    // ③ تعبئة جدول التقرير المطبوع من البيانات الفعالة كاملة
    if (rptBody) {
        if (studentsData && studentsData.length > 0) {
            rptBody.innerHTML = studentsData.map((student, idx) => {
                const isLibyan = (student.nationality_name || '').includes('ليبي') || (student.nationality_name || '').includes('ليبيا');
                const idVal = (isLibyan || student.national_id) ? (student.national_id || student.passport_number || '-') : (student.passport_number || student.national_id || '-');
                
                return `
                <tr>
                    <td style="text-align:center; font-weight:700;">${idx + 1}</td>
                    <td style="text-align:center; font-weight:700;">${escapeHtml(student.student_id || '-')}</td>
                    <td style="text-align:right; font-weight:600;">${escapeHtml(student.full_name || student.name || '-')}</td>
                    <td style="text-align:center;">${escapeHtml(student.nationality_name || '-')}</td>
                    <td style="text-align:center; font-family:monospace;">${escapeHtml(idVal)}</td>
                    <td style="text-align:center;">${escapeHtml(student.department_name || '-')}</td>
                    <td style="text-align:center;">${escapeHtml(student.status_name || '-')}</td>
                </tr>`;
            }).join('');
        } else {
            rptBody.innerHTML = `
            <tr>
                <td colspan="7" class="rpt-empty-cell">لا توجد بيانات طلاب مسجلة في هذا التقرير حالياً</td>
            </tr>`;
        }
    }

    // ④ نقل الحاوية إلى body إذا لم تكن فيه
    const container = document.getElementById('reportPrintContainer');
    if (container && container.parentElement !== document.body) {
        document.body.appendChild(container);
    }

    const doPrint = () => window.print();

    // ⑤ استدعاء OfficialsHelper مع دعم async/Promise
    if (typeof OfficialsHelper !== 'undefined' && OfficialsHelper.autoFill) {
        try {
            const result = OfficialsHelper.autoFill();
            if (result && typeof result.then === 'function') {
                result.then(doPrint).catch(doPrint);
            } else {
                setTimeout(doPrint, 400);
            }
        } catch (e) {
            console.warn('[non_libyan_students.js] OfficialsHelper error:', e);
            doPrint();
        }
    } else {
        doPrint();
    }
}

// ============================================================
// 7. إجراءات الجداول والتنقل
// ============================================================
function viewStudent(studentId) {
    if (studentId) window.location.href = `/renewal/student-detail/${studentId}/`;
}

function editStudent(studentId) {
    if (studentId) window.location.href = `/renewal/edit-student/${studentId}/`;
}

function showStudentPassport(studentId) {
    const student = studentsData.find(s => s.id == studentId);
    if (student) {
        const isLibyan = (student.nationality_name || '').includes('ليبي') || (student.nationality_name || '').includes('ليبيا');
        const docVal = (isLibyan || student.national_id) ? (student.national_id || student.passport_number || 'لا يوجد رقم') : (student.passport_number || student.national_id || 'لا يوجد رقم');
        const docLabel = (isLibyan || student.national_id) ? 'الرقم الوطني / الهوية' : 'رقم جواز السفر';
        showToast(`${docLabel}: ${docVal}`, 'info');
    } else {
        showToast('لم يتم العثور على بيانات الطالب', 'error');
    }
}

function changePage(delta) {
    const totalPages = Math.ceil(studentsData.length / pageSize);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
        document.querySelector('.non-libyan-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function goToPage(page) {
    const totalPages = Math.ceil(studentsData.length / pageSize);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderTable();
        document.querySelector('.non-libyan-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function changePageSize(size) {
    pageSize = parseInt(size);
    currentPage = 1;
    renderTable();
}

function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }
    currentPage = 1;
    fetchNonLibyanStudents();
}

function resetFilters() {
    const nationality = document.getElementById('filterNationality');
    const department = document.getElementById('filterDepartment');
    const search = document.getElementById('searchInput');
    
    if (nationality) nationality.value = 'all';
    if (department) department.value = 'all';
    if (search) search.value = '';
    
    currentPage = 1;
    currentSort = { field: 'student_id', direction: 'asc' };
    fetchNonLibyanStudents();
    showToast('تم إرجاع كافة الطلاب غير الليبيين ومسح الفلاتر', 'info');
}

// ============================================================
// 8. تهيئة المستمعين والـ Init
// ============================================================
function initEventListeners() {
    const filterSelects = ['filterNationality', 'filterDepartment'];
    filterSelects.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', function() {
                clearTimeout(filterTimeout);
                filterTimeout = setTimeout(() => {
                    currentPage = 1;
                    fetchNonLibyanStudents();
                }, 200);
            });
        }
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimeout);
                currentPage = 1;
                fetchNonLibyanStudents();
            }
        });
        
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                currentPage = 1;
                fetchNonLibyanStudents();
            }, 300);
        });
    }
}

function initNonLibyanStudents() {
    console.log('🚀 Initializing non-libyan students module...');
    
    window.fetchNonLibyanStudents = fetchNonLibyanStudents;
    window.printReport            = printReport;
    window.viewStudent            = viewStudent;
    window.editStudent            = editStudent;
    window.showStudentPassport    = showStudentPassport;
    window.sortTable              = sortTable;
    window.changePage             = changePage;
    window.goToPage               = goToPage;
    window.changePageSize         = changePageSize;
    window.resetFilters           = resetFilters;
    window.showToast              = showToast;
    
    initEventListeners();
    fetchNonLibyanStudents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNonLibyanStudents);
} else {
    initNonLibyanStudents();
}

console.log('✅ non_libyan_students.js ready');