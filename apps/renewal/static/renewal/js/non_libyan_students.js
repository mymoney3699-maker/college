'use strict';

/**
 * non_libyan_students.js – v2.0.0 (Enhanced & Auto-detecting)
 * معالجة ذكية لكافة مسميات الحقول والفلترة التلقائية
 */

console.log('🚀 non_libyan_students.js v2.0.0 loaded');

// المتغيرات العامة
let studentsData = [];
let currentPage = 1;
let pageSize = 20;
let currentSort = { field: 'student_id', direction: 'asc' };
let statsData = { total: 0, nationalities: 0, active: 0, passport_holders: 0 };
let debounceTimeout = null;

function getCsrfToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith('csrftoken=')) {
                cookieValue = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    return cookieValue;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    if (typeof toastSuccess === 'function' && type === 'success') toastSuccess(message);
    else if (typeof toastError === 'function' && type === 'error') toastError(message);
    else if (typeof toastInfo === 'function' && type === 'info') toastInfo(message);
    else console.log(`[${type}]`, message);
}

// ── 1. جلب البيانات من الـ API ──────────────────────────────
function fetchNonLibyanStudents() {
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
                        <span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span>
                        <p class="non-libyan-empty-state__title">جاري استرجاع بيانات الطلاب غير الليبيين...</p>
                    </div>
                </td>
            </tr>
        `;
    }
    
    const baseUrl = window.NON_LIBYAN_API_URL || '/renewal/api/non-libyan-students/';
    const params = new URLSearchParams();
    
    // إرسال المسميات المزدوجة لضمان توافق أي فيو في الباك إند
    if (nationalityId && nationalityId !== 'all' && nationalityId !== '0') {
        params.append('nationality_id', nationalityId);
        params.append('nationality', nationalityId);
    }
    
    if (departmentId && departmentId !== 'all' && departmentId !== '0') {
        params.append('department_id', departmentId);
        params.append('department', departmentId);
    }
    
    if (searchQuery) {
        params.append('search', searchQuery);
        params.append('q', searchQuery);
    }
    
    if (currentSort.field) {
        params.append('order_by', (currentSort.direction === 'desc' ? '-' : '') + currentSort.field);
    }
    
    const finalUrl = `${baseUrl}?${params.toString()}`;
    
    fetch(finalUrl, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': getCsrfToken()
        }
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
    })
    .then(data => {
        // دعم ذكي لأي نمط استجابة من الباك إند
        let rawList = [];
        if (Array.isArray(data)) {
            rawList = data;
        } else if (Array.isArray(data.students)) {
            rawList = data.students;
        } else if (Array.isArray(data.data)) {
            rawList = data.data;
        } else if (Array.isArray(data.results)) {
            rawList = data.results;
        }
        
        // توحيد وتنسيق كائنات الطلاب
        studentsData = rawList.map(s => {
            const fullName = s.full_name || 
                [s.name, s.father_name, s.grandfather_name, s.last_name].filter(Boolean).join(' ') || 
                s.name || '-';
                
            const nationalityName = s.nationality_name || 
                (typeof s.nationality === 'object' && s.nationality ? s.nationality.name : s.nationality) || '-';
                
            const deptName = s.department_name || 
                (typeof s.department === 'object' && s.department ? s.department.name : s.department) || '-';
                
            const statusName = s.status_name || 
                (typeof s.student_status === 'object' && s.student_status ? s.student_status.name : s.student_status) || 
                s.status || 'منتظم';

            const passportNo = s.passport_number || s.passport || s.national_id || '-';

            return {
                id: s.id,
                student_id: s.student_id || '-',
                full_name: fullName,
                nationality_name: nationalityName,
                nationality_id: s.nationality_id || (typeof s.nationality === 'object' ? s.nationality?.id : null),
                passport_number: passportNo,
                department_name: deptName,
                status_name: statusName
            };
        });

        // إذا كان هناك ترتيب محلي
        sortLocalData();

        // حساب الإحصائيات
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
    })
    .catch(err => {
        console.error("Fetch Error:", err);
        renderEmptyTable('تعذر جلب البيانات من السيرفر. تأكد من تفعيل السيرفر أو الاتصال بالشبكة.');
    });
}

// ── 2. حساب وتحديث الإحصائيات ──────────────────────────────
function calculateStats() {
    statsData.total = studentsData.length;
    
    const nats = new Set();
    studentsData.forEach(s => {
        if (s.nationality_name && s.nationality_name !== '-') nats.add(s.nationality_name);
    });
    statsData.nationalities = nats.size;
    
    statsData.active = studentsData.filter(s => {
        const st = s.status_name || '';
        return st.includes('مستمر') || st.includes('منتظم') || st.includes('نشط');
    }).length;
    
    statsData.passport_holders = studentsData.filter(s => 
        s.passport_number && s.passport_number !== '-' && s.passport_number.trim().length > 0
    ).length;
}

function updateStatistics() {
    const elTotal = document.getElementById('totalStudents');
    const elNats = document.getElementById('totalNationalities');
    const elActive = document.getElementById('activeStudents');
    const elPass = document.getElementById('passportHolders');
    
    if (elTotal) elTotal.textContent = statsData.total || 0;
    if (elNats) elNats.textContent = statsData.nationalities || 0;
    if (elActive) elActive.textContent = statsData.active || 0;
    if (elPass) elPass.textContent = statsData.passport_holders || 0;
}

// ── 3. ترتيب البيانات محلياً ────────────────────────────────
function sortLocalData() {
    if (!currentSort.field) return;
    studentsData.sort((a, b) => {
        let valA = (a[currentSort.field] || '').toString().toLowerCase();
        let valB = (b[currentSort.field] || '').toString().toLowerCase();
        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
}

// ── 4. رسم الجدول والتصفح ───────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('studentsBody');
    if (!tbody) return;
    
    if (studentsData.length === 0) {
        renderEmptyTable('لا توجد بيانات طلاب غير ليبيين مطابقة');
        return;
    }
    
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, studentsData.length);
    const pageData = studentsData.slice(start, end);
    
    let html = '';
    pageData.forEach((student, index) => {
        let badgeClass = 'non-libyan-badge--info';
        const st = student.status_name || '';
        if (st.includes('مستمر') || st.includes('منتظم')) badgeClass = 'non-libyan-badge--success';
        else if (st.includes('موقوف') || st.includes('سحب')) badgeClass = 'non-libyan-badge--danger';
        else if (st.includes('جديد') || st.includes('مقبول')) badgeClass = 'non-libyan-badge--warning';
        else if (st.includes('خريج')) badgeClass = 'non-libyan-badge--primary';
        
        const passportDisplay = (student.passport_number && student.passport_number !== '-') 
            ? `<span class="non-libyan-passport-code">${escapeHtml(student.passport_number)}</span>`
            : `<span style="color:#94a3b8;">-</span>`;
            
        html += `
            <tr>
                <td style="text-align: center; color: #64748b; font-weight: 700;">${start + index + 1}</td>
                <td><strong style="color: #2b7d91; font-family: monospace; font-size: 0.95rem;">${escapeHtml(student.student_id)}</strong></td>
                <td style="font-weight: 700; color: #0f172a;">${escapeHtml(student.full_name)}</td>
                <td><span class="non-libyan-badge non-libyan-badge--info" style="font-weight: 800;">${escapeHtml(student.nationality_name)}</span></td>
                <td style="text-align: center;">${passportDisplay}</td>
                <td>${escapeHtml(student.department_name)}</td>
                <td><span class="non-libyan-badge ${badgeClass}">${escapeHtml(student.status_name)}</span></td>
                <td style="text-align: center;">
                    <button type="button" class="non-libyan-btn-icon" onclick="window.viewStudent('${student.id}')" title="عرض الملف الكامل">
                        <span class="material-symbols-outlined">visibility</span>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    updatePagination(start, end);
    
    const rc = document.getElementById('recordsCount');
    if (rc) rc.textContent = `عرض ${start + 1} - ${end} من ${studentsData.length}`;
    
    const pi = document.getElementById('paginationInfo');
    if (pi) pi.textContent = `عرض ${start + 1} - ${end} من ${studentsData.length} نتيجة`;
    
    const ftc = document.getElementById('footerTotalCount');
    if (ftc) ftc.textContent = studentsData.length;
}

function renderEmptyTable(message) {
    const tbody = document.getElementById('studentsBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="non-libyan-table__td--empty">
                <div class="non-libyan-empty-state">
                    <span class="material-symbols-outlined">search_off</span>
                    <p class="non-libyan-empty-state__title">${escapeHtml(message)}</p>
                    <p class="non-libyan-empty-state__sub">تأكد من عدم وجود فلاتر مقيدة، أو اضغط على "مسح الفلاتر"</p>
                </div>
            </td>
        </tr>
    `;
    
    updatePagination(0, 0);
}

function updatePagination(start, end) {
    const totalPages = Math.ceil(studentsData.length / pageSize) || 1;
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
    
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<span class="non-libyan-page-num ${i === currentPage ? 'non-libyan-page-num--active' : ''}" onclick="window.goToPage(${i})">${i}</span>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="non-libyan-page-num" style="cursor:default;opacity:0.5;">...</span>`;
        }
    }
    pageNumbers.innerHTML = html;
}

function updateSearchSummary(query) {
    const summary = document.getElementById('searchSummary');
    const summaryText = document.getElementById('searchSummaryText');
    if (!summary || !summaryText) return;
    
    if (query) {
        summary.classList.remove('non-libyan-search-summary--hidden');
        summaryText.textContent = `تم العثور على ${studentsData.length} طالب مطابق لـ "${query}"`;
    } else {
        summary.classList.add('non-libyan-search-summary--hidden');
    }
}

function updateActiveFilters() {
    const nat = document.getElementById('filterNationality');
    const dept = document.getElementById('filterDepartment');
    const search = document.getElementById('searchInput')?.value?.trim();
    
    let list = [];
    if (nat && nat.value && nat.value !== 'all') list.push(`الجنسية: ${nat.options[nat.selectedIndex]?.text}`);
    if (dept && dept.value && dept.value !== 'all') list.push(`التخصص: ${dept.options[dept.selectedIndex]?.text}`);
    if (search) list.push(`بحث: "${search}"`);
    
    const el = document.getElementById('activeFilters');
    if (el) el.textContent = list.length > 0 ? list.join(' | ') : 'كافة الطلاب غير الليبيين';
}

function updateLastUpdateTime() {
    const el = document.getElementById('lastUpdateTime');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
    }
}

// ── 5. الطباعة والتنقل ──────────────────────────────────────
function printReport() {
    const rptDept = document.getElementById('rptPrintDept');
    const rptNat = document.getElementById('rptPrintNationality');
    const rptDate = document.getElementById('rptPrintDateVal');
    const rptTotal = document.getElementById('rptPrintTotalCount');
    const rptBody = document.getElementById('rptPrintTableBody');

    const natSelect = document.getElementById('filterNationality');
    const deptSelect = document.getElementById('filterDepartment');

    if (rptDept) rptDept.textContent = (deptSelect && deptSelect.value !== 'all') ? deptSelect.options[deptSelect.selectedIndex]?.text : 'جميع التخصصات';
    if (rptNat) rptNat.textContent = (natSelect && natSelect.value !== 'all') ? natSelect.options[natSelect.selectedIndex]?.text : 'جميع الجنسيات';
    if (rptDate) rptDate.textContent = new Date().toLocaleDateString('ar-LY');
    if (rptTotal) rptTotal.textContent = `${studentsData.length} طالب`;

    if (rptBody) {
        if (studentsData.length > 0) {
            rptBody.innerHTML = studentsData.map((s, idx) => `
                <tr>
                    <td style="text-align:center; font-weight:700;">${idx + 1}</td>
                    <td style="text-align:center; font-family:monospace; font-weight:700;">${escapeHtml(s.student_id)}</td>
                    <td style="text-align:right; font-weight:700;">${escapeHtml(s.full_name)}</td>
                    <td style="text-align:center;">${escapeHtml(s.nationality_name)}</td>
                    <td style="text-align:center; font-family:monospace;">${escapeHtml(s.passport_number)}</td>
                    <td style="text-align:center;">${escapeHtml(s.department_name)}</td>
                    <td style="text-align:center;">${escapeHtml(s.status_name)}</td>
                </tr>
            `).join('');
        } else {
            rptBody.innerHTML = `<tr><td colspan="7" class="rpt-empty-cell">لا توجد بيانات طلاب مسجلة</td></tr>`;
        }
    }

    const container = document.getElementById('reportPrintContainer');
    if (container && container.parentElement !== document.body) {
        document.body.appendChild(container);
    }

    if (typeof OfficialsHelper !== 'undefined' && OfficialsHelper.autoFill) {
        OfficialsHelper.autoFill().then(() => window.print()).catch(() => window.print());
    } else {
        window.print();
    }
}

function viewStudent(id) {
    if (id) window.location.href = `/renewal/student-data/?q=${id}`;
}

function changePage(delta) {
    const totalPages = Math.ceil(studentsData.length / pageSize);
    const target = currentPage + delta;
    if (target >= 1 && target <= totalPages) {
        currentPage = target;
        renderTable();
    }
}

function goToPage(p) {
    currentPage = p;
    renderTable();
}

function changePageSize(size) {
    pageSize = parseInt(size) || 20;
    currentPage = 1;
    renderTable();
}

function sortTable(field) {
    if (currentSort.field === field) {
        currentSort.direction = (currentSort.direction === 'asc') ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }
    sortLocalData();
    renderTable();
}

// ── 6. التهيئة ومستمعات الأحداث ─────────────────────────────
function init() {
    window.fetchNonLibyanStudents = fetchNonLibyanStudents;
    window.printReport = printReport;
    window.viewStudent = viewStudent;
    window.sortTable = sortTable;
    window.changePage = changePage;
    window.goToPage = goToPage;
    window.changePageSize = changePageSize;

    const natEl = document.getElementById('filterNationality');
    const deptEl = document.getElementById('filterDepartment');
    const searchEl = document.getElementById('searchInput');

    if (natEl) natEl.addEventListener('change', () => { currentPage = 1; fetchNonLibyanStudents(); });
    if (deptEl) deptEl.addEventListener('change', () => { currentPage = 1; fetchNonLibyanStudents(); });
    
    if (searchEl) {
        searchEl.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                currentPage = 1;
                fetchNonLibyanStudents();
            }, 300);
        });
        searchEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimeout);
                currentPage = 1;
                fetchNonLibyanStudents();
            }
        });
    }

    // جلب البيانات فور تحميل الصفحة
    fetchNonLibyanStudents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}