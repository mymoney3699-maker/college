/**
 * ============================================================
 * كشف الطلاب حسب المعدل - Students by GPA
 * students_by_gpa.js  v1.7.0
 * ============================================================
 */

console.log('✅ students_by_gpa.js loaded');

// ============================================================
// DATA LOADING FROM DJANGO TEMPLATE
// ============================================================
function getDatabaseStudents() {
    const el = document.getElementById('gpa-students-data');
    if (el) {
        try {
            return JSON.parse(el.textContent) || [];
        } catch (e) {
            console.error('Error parsing gpa-students-data JSON:', e);
        }
    }
    return [];
}

let databaseStudents = [];

// ============================================================
// STATE
// ============================================================
let currentData = [];
let filteredData = [];
let currentPage = 1;
const pageSize = 10;
let currentSort = { field: 'gpa', direction: 'desc' };

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    databaseStudents = getDatabaseStudents();
    currentData = [...databaseStudents];
    filteredData = [...currentData];
    updateStats();
    renderTable();
    setupFilterType();
    showToast(`تم تحميل بيانات ${databaseStudents.length} طالب بنجاح`, 'success');
});

// ============================================================
// FILTER TYPE - Show/Hide GPA Range
// ============================================================
function setupFilterType() {
    const filterType = document.getElementById('filterType');
    const gpaRange = document.getElementById('gpaRange');

    if (filterType && gpaRange) {
        filterType.addEventListener('change', function() {
            if (this.value === 'range') {
                gpaRange.classList.add('visible');
            } else {
                gpaRange.classList.remove('visible');
            }
        });
    }
}

// ============================================================
// STATISTICS
// ============================================================
function updateStats() {
    const data = filteredData;
    const total = data.length;
    const gpas = data.map(s => Number(s.gpa) || 0);
    const maxGpa = gpas.length > 0 ? Math.max(...gpas) : 0;
    const minGpa = gpas.length > 0 ? Math.min(...gpas) : 0;
    const avgGpa = gpas.length > 0 ? (gpas.reduce((a, b) => a + b, 0) / gpas.length) : 0;

    const totalEl = document.getElementById('totalStudents');
    const maxEl = document.getElementById('maxGpa');
    const minEl = document.getElementById('minGpa');
    const avgEl = document.getElementById('avgGpa');

    if (totalEl) totalEl.textContent = total;
    if (maxEl) maxEl.textContent = maxGpa.toFixed(2);
    if (minEl) minEl.textContent = minGpa.toFixed(2);
    if (avgEl) avgEl.textContent = avgGpa.toFixed(2);
}

// ============================================================
// RENDER TABLE
// ============================================================
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, filteredData.length);
    const pageData = filteredData.slice(start, end);

    if (filteredData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <i class="fas fa-user-graduate"></i>
                        <h3>لا توجد بيانات</h3>
                        <p>لا يوجد طلاب مطابقين لمعايير البحث</p>
                    </div>
                </td>
            </tr>
        `;
        const dispEl = document.getElementById('displayCount');
        const totEl = document.getElementById('totalCount');
        if (dispEl) dispEl.textContent = '0';
        if (totEl) totEl.textContent = filteredData.length;
        updatePagination();
        updateStats();
        return;
    }

    let html = '';
    pageData.forEach((student, index) => {
        const rank = start + index + 1;
        const rankHtml = getRankHtml(rank);
        const gpaNum = Number(student.gpa) || 0;
        const gpaBadge = getGpaBadge(gpaNum);
        const gradeBadge = getGradeBadge(student.grade);

        html += `
            <tr>
                <td>${rank}</td>
                <td>${rankHtml}</td>
                <td>${student.id}</td>
                <td><strong>${student.name}</strong></td>
                <td>${student.dept || '—'}</td>
                <td>${student.level || '—'}</td>
                <td>${student.hours || '—'}</td>
                <td>${gpaBadge}</td>
                <td>${gradeBadge}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    const dispEl = document.getElementById('displayCount');
    const totEl = document.getElementById('totalCount');
    if (dispEl) dispEl.textContent = filteredData.length;
    if (totEl) totEl.textContent = filteredData.length;
    updatePagination();
    updateStats();
}

// ============================================================
// RANK HTML
// ============================================================
function getRankHtml(rank) {
    return `<span class="rank-badge rank-number">${rank}</span>`;
}

// ============================================================
// GPA BADGE
// ============================================================
function getGpaBadge(gpa) {
    let cls = '';
    if (gpa >= 3.6) cls = 'gpa-excellent';
    else if (gpa >= 3.0) cls = 'gpa-very-good';
    else if (gpa >= 2.5) cls = 'gpa-good';
    else cls = 'gpa-weak';
    return `<span class="gpa-badge ${cls}">${gpa.toFixed(2)}</span>`;
}

// ============================================================
// GRADE BADGE
// ============================================================
function getGradeBadge(grade) {
    let cls = '';
    if (grade === 'امتياز') cls = 'grade-excellent';
    else if (grade === 'جيد جداً') cls = 'grade-very-good';
    else if (grade === 'جيد') cls = 'grade-good';
    else cls = 'grade-weak';
    return `<span class="grade-badge ${cls}">${grade || '—'}</span>`;
}

// ============================================================
// PAGINATION
// ============================================================
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) pageInfo.textContent = `الصفحة ${currentPage} من ${totalPages}`;

    const pageButtons = document.getElementById('pageButtons');
    if (!pageButtons) return;

    let buttonsHtml = '';
    buttonsHtml += `<button class="page-btn" onclick="changePage('prev')" id="prevBtn" ${currentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        buttonsHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    buttonsHtml += `<button class="page-btn" onclick="changePage('next')" id="nextBtn" ${currentPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

    pageButtons.innerHTML = buttonsHtml;
}

function changePage(direction) {
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    if (direction === 'prev' && currentPage > 1) currentPage--;
    else if (direction === 'next' && currentPage < totalPages) currentPage++;
    renderTable();
    const scrollEl = document.querySelector('.table-scroll');
    if (scrollEl) scrollEl.scrollTop = 0;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderTable();
        const scrollEl = document.querySelector('.table-scroll');
        if (scrollEl) scrollEl.scrollTop = 0;
    }
}

// ============================================================
// SEARCH
// ============================================================
function searchTable() {
    const searchEl = document.getElementById('tableSearch');
    const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
    if (query === '') {
        filteredData = [...currentData];
    } else {
        filteredData = currentData.filter(s =>
            (s.name || '').toLowerCase().includes(query) ||
            String(s.id || '').includes(query)
        );
    }
    currentPage = 1;
    renderTable();
}

// ============================================================
// SORT
// ============================================================
function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'desc';
    }

    filteredData.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];
        if (typeof valA === 'string') {
            valA = valA.localeCompare(valB, 'ar');
            valB = 0;
        }
        if (currentSort.direction === 'asc') {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });
    currentPage = 1;
    renderTable();
    showToast(`تم الترتيب حسب ${field}`, 'info');
}

// ============================================================
// APPLY FILTERS
// ============================================================
function applyFilters() {
    const yearVal    = (document.getElementById('filterYear')?.value || '').trim();
    const semester   = document.getElementById('filterSemester')?.value || 'all';
    const dept       = document.getElementById('filterDepartment')?.value || 'all';
    const level      = document.getElementById('filterLevel')?.value || 'all';
    const type       = document.getElementById('filterType')?.value || 'all';
    const gpaFrom    = parseFloat(document.getElementById('gpaFrom')?.value) || 0;
    const gpaTo      = parseFloat(document.getElementById('gpaTo')?.value) || 4.0;

    // إذا تم تحديد سنة أو فصل دراسي → إعادة توجيه إلى الخلفية لجلب بيانات دقيقة
    if (yearVal || semester !== 'all') {
        const params = new URLSearchParams();
        if (yearVal)          params.set('year', yearVal);
        if (semester !== 'all') params.set('semester', semester);
        if (dept !== 'all')   params.set('department', dept);
        if (level !== 'all')  params.set('level', level);
        if (type !== 'all')   params.set('type', type);
        if (type === 'range') {
            params.set('gpa_from', gpaFrom);
            params.set('gpa_to', gpaTo);
        }
        window.location.href = window.location.pathname + '?' + params.toString();
        return;
    }

    // فلترة على البيانات المحملة (client-side) عند عدم تحديد فصل/سنة
    let data = [...databaseStudents];

    if (dept !== 'all') {
        data = data.filter(s => s.dept === dept || s.major === dept);
    }
    if (level !== 'all') {
        data = data.filter(s => s.level === level);
    }

    if (type === 'range') {
        data = data.filter(s => s.gpa >= gpaFrom && s.gpa <= gpaTo);
    } else if (type === 'passed') {
        data = data.filter(s => (s.gpa <= 4.0 ? s.gpa >= 2.0 : s.gpa >= 50.0));
    } else if (type === 'failed') {
        data = data.filter(s => (s.gpa <= 4.0 ? s.gpa < 2.0 : s.gpa < 50.0));
    } else if (type === 'top') {
        data = data.filter(s => (s.gpa <= 4.0 ? s.gpa >= 3.5 : s.gpa >= 85.0));
        data.sort((a, b) => b.gpa - a.gpa);
    }

    currentData = data;
    filteredData = [...currentData];
    currentPage = 1;
    renderTable();
    showToast(`تم تطبيق الفلاتر - عرض ${filteredData.length} طالب`, 'success');
}

// ============================================================
// RESET FILTERS
// ============================================================
function resetFilters() {
    // إذا كانت هناك معاملات URL نشطة (سنة/فصل) → إعادة توجيه لتنظيف الفلاتر من الخلفية
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('year') || urlParams.has('semester')) {
        window.location.href = window.location.pathname;
        return;
    }

    // إعادة تعيين الفلاتر المحلية فقط
    if (document.getElementById('filterYear')) document.getElementById('filterYear').value = '';
    if (document.getElementById('filterSemester')) document.getElementById('filterSemester').value = 'all';
    if (document.getElementById('filterDepartment')) document.getElementById('filterDepartment').value = 'all';
    if (document.getElementById('filterLevel')) document.getElementById('filterLevel').value = 'all';
    if (document.getElementById('filterType')) document.getElementById('filterType').value = 'all';
    if (document.getElementById('gpaFrom')) document.getElementById('gpaFrom').value = '2.0';
    if (document.getElementById('gpaTo')) document.getElementById('gpaTo').value = '4.0';
    if (document.getElementById('tableSearch')) document.getElementById('tableSearch').value = '';
    document.getElementById('gpaRange')?.classList.remove('visible');

    currentData = [...databaseStudents];
    filteredData = [...currentData];
    currentPage = 1;
    renderTable();
    showToast('تم إعادة تعيين جميع الفلاتر', 'info');
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerHTML = `
        <span class="toast-icon"><i class="${icons[type] || icons.success}"></i></span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ============================================================
// 🔥 PREPARE & TRIGGER UNIFIED PRINT REPORT (A4 PORTRAIT)
// ============================================================
function updateGpaPrintTemplate() {
    const data = filteredData.length > 0 ? filteredData : currentData;

    const yearVal     = (document.getElementById('filterYear')?.value || '').trim();
    const semesterEl  = document.getElementById('filterSemester');
    const semesterText = semesterEl && semesterEl.selectedIndex > 0 && semesterEl.value !== 'all'
                         ? semesterEl.options[semesterEl.selectedIndex].text
                         : 'جميع الفصول';
    
    let combinedSemesterYear = semesterText;
    if (yearVal) {
        if (semesterText !== 'جميع الفصول') {
            combinedSemesterYear = `${semesterText} ${yearVal}`;
        } else {
            combinedSemesterYear = yearVal;
        }
    }

    const deptEl  = document.getElementById('filterDepartment');
    const deptVal = deptEl && deptEl.selectedIndex > 0 && deptEl.value !== 'all'
                    ? deptEl.options[deptEl.selectedIndex].text
                    : 'جميع الأقسام';

    const typeEl  = document.getElementById('filterType');
    const typeVal = typeEl && typeEl.selectedIndex >= 0 && typeEl.value !== 'all'
                    ? typeEl.options[typeEl.selectedIndex].text
                    : 'جميع الطلاب';

    // ① تاريخ السحب فقط بدون وقت
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });

    const pDept   = document.getElementById('pDept');
    const pSem    = document.getElementById('pSemester');
    const pType   = document.getElementById('pType');
    const pDate   = document.getElementById('rptPrintDateVal');
    const pBody   = document.getElementById('printGpaTableBody');

    if (pDept)  pDept.textContent  = deptVal;
    if (pSem)   pSem.textContent   = combinedSemesterYear;
    if (pType)  pType.textContent  = typeVal;
    if (pDate)  pDate.textContent  = dateStr;

    // ② تعبئة جدول التقرير بـ 5 أعمدة رسمية
    if (pBody) {
        if (data.length === 0) {
            pBody.innerHTML = `<tr><td colspan="5" class="rpt-empty-cell">لا توجد بيانات مطابقة للطباعة حالياً</td></tr>`;
        } else {
            let html = '';
            data.forEach((student, index) => {
                const rank = index + 1;
                const gpaNum = Number(student.gpa) || 0;
                html += `
                    <tr>
                        <td style="text-align:center; font-weight:700;">${rank}</td>
                        <td style="text-align:center; font-weight:700;">${student.id || '—'}</td>
                        <td style="text-align:right; font-weight:600;"><strong>${student.name || '—'}</strong></td>
                        <td style="text-align:center; font-weight:bold;">${gpaNum.toFixed(2)}</td>
                        <td style="text-align:center;">${student.grade || '—'}</td>
                    </tr>
                `;
            });
            pBody.innerHTML = html;
        }
    }
}

function printReportDirect() {
    const data = filteredData.length > 0 ? filteredData : currentData;
    if (data.length === 0) {
        showToast('لا توجد بيانات للطباعة', 'error');
        return;
    }

    updateGpaPrintTemplate();

    const container = document.getElementById('reportPrintContainer');
    if (container && container.parentElement !== document.body) {
        document.body.appendChild(container);
    }

    const executePrint = () => {
        window.print();
    };

    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') {
                res.then(executePrint).catch(executePrint);
            } else {
                setTimeout(executePrint, 400);
            }
        } catch (e) {
            console.warn('OfficialsHelper autoFill error:', e);
            executePrint();
        }
    } else {
        executePrint();
    }
}

// ============================================================
// REAL PDF EXPORT (DOWNLOADABLE .PDF FILE / VECTOR PRINT)
// ============================================================
function exportPDFDirect() {
    const data = filteredData.length > 0 ? filteredData : currentData;
    if (data.length === 0) {
        showToast('لا توجد بيانات لتصديرها كـ PDF', 'error');
        return;
    }

    showToast('📄 جاري تجهيز وفتح نافذة تصدير PDF المعتمدة...', 'info');
    printReportDirect();
}

// ============================================================
// EXPORT EXCEL (REAL .XLSX DOWNLOAD FROM BACKEND OPENPYXL)
// ============================================================
function exportExcel() {
    const deptEl = document.getElementById('filterDepartment');
    const levelEl = document.getElementById('filterLevel');
    const yearEl = document.getElementById('filterYear');
    const semEl = document.getElementById('filterSemester');
    const typeEl = document.getElementById('filterType');
    const searchEl = document.getElementById('tableSearch');

    const params = new URLSearchParams();
    if (deptEl && deptEl.value && deptEl.value !== 'all') params.append('department', deptEl.value);
    if (levelEl && levelEl.value && levelEl.value !== 'all') params.append('level', levelEl.value);
    if (yearEl && yearEl.value && yearEl.value !== 'all') params.append('year', yearEl.value);
    if (semEl && semEl.value && semEl.value !== 'all') params.append('semester', semEl.value);
    if (typeEl && typeEl.value && typeEl.value !== 'all') params.append('type', typeEl.value);
    if (searchEl && searchEl.value.trim()) params.append('search', searchEl.value.trim());

    showToast('📊 جاري توليد ملف Excel حقيقي بصيغة XLSX...', 'info');
    window.location.href = `/renewal/export-students-gpa-excel/?${params.toString()}`;
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        printReportDirect();
    }
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchEl = document.getElementById('tableSearch');
        if (searchEl) searchEl.focus();
    }
});

// ============================================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================================
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.printReportDirect = printReportDirect;
window.exportPDFDirect = exportPDFDirect;
window.exportExcel = exportExcel;
window.searchTable = searchTable;
window.sortTable = sortTable;
window.changePage = changePage;
window.goToPage = goToPage;