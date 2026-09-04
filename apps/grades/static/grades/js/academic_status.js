// ========================================================
// منظومة حصر وتدقيق الحالات الأكاديمية للطلاب - Academic Status JS v1.1.0
// ========================================================

console.log('✅ academic_status.js v1.1.0 loaded successfully');

let reportRequested = false;

function escapeHtml(text) {
    if (!text && text !== 0) return '';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeAr(text) {
    if (!text) return '';
    return text.toString()
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ىي]/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function getStatusBadgeClass(status) {
    if (!status) return 'status-active';
    const s = normalizeAr(status);
    if (s.includes('منتظم') || s.includes('نشط') || s.includes('مستمر')) return 'status-active';
    if (s.includes('موقوف') || s.includes('ايقاف') || s.includes('موجل') || s.includes('تاجيل')) return 'status-suspended';
    if (s.includes('سحب') || s.includes('مسحوب')) return 'status-withdrawn';
    if (s.includes('اخلاء') || s.includes('خريج') || s.includes('تخرج')) return 'status-graduated';
    if (s.includes('مفصول') || s.includes('فصل')) return 'status-dismissed';
    if (s.includes('جديد')) return 'status-new';
    return 'status-active';
}

function getCurrentDateFormatted() {
    const now = new Date();
    return now.toLocaleDateString('ar-LY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getCurrentDateShort() {
    const now = new Date();
    return now.toLocaleDateString('ar-LY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// جلب البيانات من القالب
const academicDataEl = document.getElementById('academic-data');
if (academicDataEl) {
    try {
        const data = JSON.parse(academicDataEl.textContent);
        window.databaseStudents = data.students || [];
        window.databaseSemesters = data.semesters || [];
        window.databaseDepartments = data.departments || [];
        window.databaseStatuses = data.statuses || [];
    } catch (e) {
        console.error('Error parsing academic-data JSON:', e);
    }
}

const academicStatusDatabase = window.databaseStudents || [];

// مزامنة قائمة الحالات في القائمة المنسدلة للتأكد من وجود كافة الحالات الفعلية
function syncStatusDropdown() {
    const statusSelect = document.getElementById('filter-status');
    if (!statusSelect) return;

    const existingValues = new Set(Array.from(statusSelect.options).map(o => o.value.trim()));

    // إضافة الحالات القادمة من قاعدة البيانات
    if (window.databaseStatuses && Array.isArray(window.databaseStatuses)) {
        window.databaseStatuses.forEach(st => {
            const name = typeof st === 'string' ? st.trim() : (st.name ? st.name.trim() : '');
            if (name && !existingValues.has(name)) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                statusSelect.appendChild(opt);
                existingValues.add(name);
            }
        });
    }

    // وأيضاً الحالات الموجودة بالفعل لدى الطلاب
    if (academicStatusDatabase && Array.isArray(academicStatusDatabase)) {
        academicStatusDatabase.forEach(st => {
            const name = st.status ? st.status.trim() : '';
            if (name && !existingValues.has(name)) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                statusSelect.appendChild(opt);
                existingValues.add(name);
            }
        });
    }
}

// استخراج التقرير
function generateStatusReport() {
    reportRequested = true;
    const semTypeSelect  = document.getElementById('filter-semester-type');
    const semYearInput   = document.getElementById('filter-semester-year');
    const statusSelect   = document.getElementById('filter-status');
    const searchRegInput = document.getElementById('search-reg-num');
    const searchNameInput= document.getElementById('search-name');

    const semTypeFilter  = semTypeSelect  ? semTypeSelect.value.trim()  : 'الكل';
    const semYearFilter  = semYearInput   ? semYearInput.value.trim()   : '';
    const statusFilter   = statusSelect   ? statusSelect.value.trim()   : 'الكل';
    const searchReg  = searchRegInput  ? searchRegInput.value.trim().toLowerCase()  : '';
    const searchName = searchNameInput ? searchNameInput.value.trim() : '';

    const semTypeLabel = { spring: 'ربيع', fall: 'خريف', 'الكل': 'كل الفصول' }[semTypeFilter] || semTypeFilter;
    const seasonDisplayLabel = semTypeFilter === 'الكل'
        ? (semYearFilter ? `سنة ${semYearFilter}` : 'كل الفصول')
        : `${semTypeLabel}${semYearFilter ? ' ' + semYearFilter : ''}`;

    const tbody = document.getElementById('report-table-body');
    const container = document.getElementById('report-container');
    
    if (!tbody || !container) return;

    // فلترة البيانات محلياً
    const filteredStudents = academicStatusDatabase.filter(student => {
        // فلترة نوع الفصل
        if (semTypeFilter !== 'الكل') {
            const stSemType = (student.semester_type || '').trim().toLowerCase();
            if (stSemType !== semTypeFilter.toLowerCase()) {
                // فحص إضافي في نص الموسم
                const normSeason = normalizeAr(student.season || student.semester || '');
                const targetSeason = semTypeFilter === 'spring' ? 'ربيع' : (semTypeFilter === 'fall' ? 'خريف' : semTypeFilter);
                if (!normSeason.includes(normalizeAr(targetSeason))) return false;
            }
        }

        // فلترة السنة
        if (semYearFilter) {
            const stYear = String(student.semester_year || '').trim();
            const normSeason = String(student.season || student.semester || '');
            if (stYear !== semYearFilter && !normSeason.includes(semYearFilter)) {
                return false;
            }
        }

        // فلترة حالة القيد
        if (statusFilter !== 'الكل') {
            const normFilter = normalizeAr(statusFilter);
            const normStatus = normalizeAr(student.status || '');
            if (normStatus !== normFilter && !normStatus.includes(normFilter)) {
                return false;
            }
        }

        // فلترة رقم القيد
        if (searchReg && !String(student.id || '').toLowerCase().includes(searchReg)) {
            return false;
        }

        // فلترة اسم الطالب
        if (searchName) {
            const normQ = normalizeAr(searchName);
            const words = normQ.split(' ').filter(Boolean);
            const normName = normalizeAr(student.name || '');
            if (!words.every(w => normName.includes(w))) return false;
        }

        return true;
    });

    // تحديث ترويسة التقرير على الشاشة
    const printSeasonTarget = document.getElementById('print-season-target');
    const printStatusTarget = document.getElementById('print-status-target');
    const reportDateText    = document.getElementById('report-date-text');

    if (printSeasonTarget) printSeasonTarget.innerText = seasonDisplayLabel;
    if (printStatusTarget) printStatusTarget.innerText = statusFilter === 'الكل' ? 'كافة الحالات' : statusFilter;
    if (reportDateText) reportDateText.textContent = `تاريخ الاستخراج: ${getCurrentDateShort()}`;

    // تعبئة الجدول التفاعلي للشاشة
    tbody.innerHTML = '';

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell" style="text-align: center; padding: 2rem; color: #64748b; font-weight: bold;">
                    ⚠️ لا توجد سجلات تطابق خيارات البحث المحددة.
                </td>
            </tr>
        `;
    } else {
        filteredStudents.forEach(student => {
            const badgeClass = getStatusBadgeClass(student.status);
            const levelVal  = student.level || student.semester_level || student.level_name || '—';
            const seasonVal = student.season || (student.semester_type ? `${student.semester_type === 'spring' ? 'ربيع' : 'خريف'} ${student.semester_year || ''}` : '—');
            
            const rowHtml = `
                <tr class="student-row">
                    <td class="cell-id">${escapeHtml(student.id)}</td>
                    <td class="cell-name">${escapeHtml(student.name)}</td>
                    <td class="cell-major">${escapeHtml(student.major || student.department_name || '—')}</td>
                    <td class="cell-semester">${escapeHtml(levelVal)}</td>
                    <td class="cell-season">${escapeHtml(seasonVal)}</td>
                    <td>
                        <span class="status-badge ${badgeClass}">
                            ${escapeHtml(student.status || '—')}
                        </span>
                    </td>
                </tr>
            `;
            tbody.innerHTML += rowHtml;
        });
    }

    container.classList.remove('hidden');

    // =============================================
    // تعبئة تقرير الطباعة الرسمي الموحد (A4)
    // =============================================
    ensurePrintContainerInBody();

    const printSemesterVal = document.getElementById('printSemesterVal');
    const printYearVal     = document.getElementById('printYearVal');
    const printStatusVal   = document.getElementById('printStatusVal');
    const printDateVal     = document.getElementById('printDateVal');
    const printTableBody   = document.getElementById('printTableBody');

    if (printSemesterVal) printSemesterVal.textContent = semTypeLabel;
    if (printYearVal)     printYearVal.textContent     = semYearFilter || 'كافة السنوات';
    if (printStatusVal)   printStatusVal.textContent   = statusFilter === 'الكل' ? 'كافة الحالات' : statusFilter;
    if (printDateVal)     printDateVal.textContent     = getCurrentDateFormatted();

    if (printTableBody) {
        if (filteredStudents.length === 0) {
            printTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-print-cell" style="padding: 20px; text-align: center; font-size: 13.5px; font-weight: bold; border: 1px solid #000;">
                        لا توجد بيانات مطابقة لمعايير البحث.
                    </td>
                </tr>
            `;
        } else {
            printTableBody.innerHTML = filteredStudents.map((st, idx) => {
                const levelVal  = st.level || st.semester_level || st.level_name || '—';
                const seasonVal = st.season || (st.semester_type ? `${st.semester_type === 'spring' ? 'ربيع' : 'خريف'} ${st.semester_year || ''}` : '—');
                
                return `
                    <tr>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center;">${idx + 1}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: bold;">${escapeHtml(st.id || '-')}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: right; padding-right: 8px; font-weight: 600;">${escapeHtml(st.name || '-')}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center;">${escapeHtml(st.major || st.department_name || '-')}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: bold;">${escapeHtml(levelVal)}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center;">${escapeHtml(seasonVal)}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: bold;">${escapeHtml(st.status || '-')}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

function ensurePrintContainerInBody() {
    const container = document.getElementById('printReportContainer');
    if (container && container.parentNode !== document.body) {
        document.body.appendChild(container);
    }
}

// دالة الطباعة الرسمية مع جلب التوقيعات المعتمدة
function triggerOfficialPrint() {
    ensurePrintContainerInBody();
    generateStatusReport();

    const doPrint = () => window.print();

    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') {
                res.then(doPrint).catch(doPrint);
            } else {
                setTimeout(doPrint, 300);
            }
        } catch (e) {
            console.warn('OfficialsHelper error:', e);
            doPrint();
        }
    } else {
        doPrint();
    }
}

// البحث اللحظي و autocomplete
let _liveTimer = null;
window.liveSearchAcademicStatus = function(mode) {
    clearTimeout(_liveTimer);
    _liveTimer = setTimeout(() => _doLiveSearch(mode), 200);
};

function _doLiveSearch(mode) {
    const regInput  = document.getElementById('search-reg-num');
    const nameInput = document.getElementById('search-name');
    const dropReg   = document.getElementById('autocomplete-reg');
    const dropName  = document.getElementById('autocomplete-name');

    if (!regInput || !nameInput || !dropReg || !dropName) return;

    const regVal  = regInput.value.trim().toLowerCase();
    const nameVal = nameInput.value.trim().toLowerCase();

    const uniqueStudents = [];
    const seen = new Set();
    academicStatusDatabase.forEach(s => {
        if (!seen.has(s.id)) {
            seen.add(s.id);
            uniqueStudents.push({ reg_num: s.id, name: s.name, major: s.major });
        }
    });

    if (mode === 'reg') {
        _closeDropdown(dropName);
        if (!regVal) { _closeDropdown(dropReg); return; }
        const matches = uniqueStudents.filter(s => String(s.reg_num).toLowerCase().includes(regVal));
        _renderDropdown(dropReg, matches, 'reg');
    } else {
        _closeDropdown(dropReg);
        if (!nameVal) { _closeDropdown(dropName); return; }
        const normQ = normalizeAr(nameVal);
        const words = normQ.split(' ').filter(Boolean);
        const matches = uniqueStudents.filter(s =>
            words.every(w => normalizeAr(s.name).includes(w))
        );
        _renderDropdown(dropName, matches, 'name');
    }
}

function _renderDropdown(container, students, mode) {
    if (!container) return;

    let estimatedHeight = 0;

    if (students.length === 0) {
        container.innerHTML = `
            <div style="padding:0.6rem 0.75rem; font-size:0.8rem; color:#dc2626; font-weight:600;">
                ❌ لا توجد نتائج مطابقة
            </div>`;
        estimatedHeight = 40;
    } else {
        container.innerHTML = students.map(s => `
            <div class="transcript-autocomplete-item"
                 onclick="window.selectStatusStudent('${escapeHtml(s.reg_num)}')">
                <span class="tac-name">${escapeHtml(s.name)}</span>
                <span class="tac-reg">${escapeHtml(s.reg_num)} &bull; ${escapeHtml(s.major)}</span>
            </div>
        `).join('');
        estimatedHeight = Math.min(students.length * 48, 220);
    }

    const groupBox = container.closest('.group-box');
    if (groupBox) {
        groupBox.style.setProperty('padding-bottom', `${estimatedHeight + 15}px`, 'important');
    }

    container.classList.remove('hidden');
}

function _closeDropdown(el) {
    if (!el) return;
    el.innerHTML = '';
    el.classList.add('hidden');
    
    const groupBox = el.closest('.group-box');
    if (groupBox) {
        groupBox.style.removeProperty('padding-bottom');
    }
}

window.selectStatusStudent = function(regNum) {
    const student = academicStatusDatabase.find(s => String(s.id) === String(regNum));
    if (!student) return;

    const regInput  = document.getElementById('search-reg-num');
    const nameInput = document.getElementById('search-name');
    const semTypeSelect = document.getElementById('filter-semester-type');
    const statusSelect = document.getElementById('filter-status');

    if (semTypeSelect) semTypeSelect.value = 'الكل';
    if (statusSelect)  statusSelect.value  = 'الكل';

    if (regInput)  regInput.value  = student.id;
    if (nameInput) nameInput.value = student.name;

    _closeDropdown(document.getElementById('autocomplete-reg'));
    _closeDropdown(document.getElementById('autocomplete-name'));

    generateStatusReport();
};

// تهيئة الأحداث عند تحميل DOM
document.addEventListener('DOMContentLoaded', () => {
    syncStatusDropdown();

    const semTypeSelect  = document.getElementById('filter-semester-type');
    const semYearInput   = document.getElementById('filter-semester-year');
    const statusSelect   = document.getElementById('filter-status');
    const searchRegInput = document.getElementById('search-reg-num');
    const searchNameInput= document.getElementById('search-name');

    const autoUpdate = () => {
        if (reportRequested) generateStatusReport();
    };

    if (semTypeSelect) semTypeSelect.addEventListener('change', autoUpdate);
    if (semYearInput)  semYearInput.addEventListener('input', autoUpdate);
    if (statusSelect)  statusSelect.addEventListener('change', autoUpdate);
    
    if (searchRegInput) {
        searchRegInput.addEventListener('input', () => {
            window.liveSearchAcademicStatus('reg');
            autoUpdate();
        });
    }
    if (searchNameInput) {
        searchNameInput.addEventListener('input', () => {
            window.liveSearchAcademicStatus('name');
            autoUpdate();
        });
    }

    document.addEventListener('click', (e) => {
        const dropReg  = document.getElementById('autocomplete-reg');
        const dropName = document.getElementById('autocomplete-name');
        if (dropReg && !searchRegInput?.contains(e.target) && !dropReg.contains(e.target)) _closeDropdown(dropReg);
        if (dropName && !searchNameInput?.contains(e.target) && !dropName.contains(e.target)) _closeDropdown(dropName);
    });
});

window.generateStatusReport = generateStatusReport;
window.triggerOfficialPrint = triggerOfficialPrint;

window.addEventListener('beforeprint', () => {
    ensurePrintContainerInBody();
    generateStatusReport();
    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        window.OfficialsHelper.autoFill();
    }
});