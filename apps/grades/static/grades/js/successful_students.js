// ============================================
// تقارير الطلاب الناجحين - Successful Students Logic
// v1.0.4
// ============================================

console.log('✅ successful_students.js v1.0.4 loaded');

let allStudentsCached = [];

function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function normalizeArabic(text) {
    if (!text) return '';
    return text.trim()
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ىي]/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function getCurrentDate() {
    const now = new Date();
    return now.toLocaleDateString('ar-LY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// جلب البيانات من القالب
const successfulDataEl = document.getElementById('successful-data');
if (successfulDataEl) {
    try {
        const data = JSON.parse(successfulDataEl.textContent);
        window.databaseStudents    = data.students    || [];
        window.databaseSemesters   = data.semesters   || [];
        window.databaseDepartments = data.departments || [];
    } catch (e) {
        console.error('Error parsing successful-data JSON:', e);
    }
}

const mockSemesters   = window.databaseSemesters   || [];
const mockDepartments = window.databaseDepartments || [];
const mockStudents    = window.databaseStudents    || [];

// تحميل الخيارات الديناميكية للفلاتر
function loadFilters() {
    const majorSelect = document.getElementById('filter-major');
    if (majorSelect) {
        majorSelect.innerHTML = '<option value="الكل">كافة التخصصات</option>' +
            mockDepartments.map(d => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join('');
    }
    allStudentsCached = mockStudents;
    setupSmartSearch();
}

// البحث الذكي
function setupSmartSearch() {
    const nameInput       = document.getElementById('filter-student-name');
    const idInput         = document.getElementById('filter-student-id');
    const nameSuggestions = document.getElementById('student-name-suggestions');
    const idSuggestions   = document.getElementById('student-id-suggestions');

    if (!nameInput || !idInput || !nameSuggestions || !idSuggestions) return;

    function clearSuggestions(el) { el.innerHTML = ''; el.classList.add('hidden'); }

    nameInput.addEventListener('input', () => {
        const val = nameInput.value;
        const normalizedVal = normalizeArabic(val);
        if (!normalizedVal) { idInput.value = ''; clearSuggestions(nameSuggestions); return; }

        const matches = allStudentsCached.filter(s => normalizeArabic(s.name).includes(normalizedVal));
        nameSuggestions.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(student => {
                const item = document.createElement('div');
                item.className = 'autocomplete-suggestion-item';
                item.innerHTML = escapeHtml(student.name);
                item.addEventListener('click', e => {
                    e.stopPropagation();
                    nameInput.value = student.name;
                    idInput.value   = student.id;
                    clearSuggestions(nameSuggestions);
                    clearSuggestions(idSuggestions);
                });
                nameSuggestions.appendChild(item);
            });
            nameSuggestions.classList.remove('hidden');
        } else {
            nameSuggestions.classList.add('hidden');
        }
        idInput.value = (matches.length === 1) ? matches[0].id : '';
    });

    idInput.addEventListener('input', () => {
        const val = idInput.value.trim();
        if (!val) { nameInput.value = ''; clearSuggestions(idSuggestions); return; }

        const matches = allStudentsCached.filter(s => s.id.includes(val));
        idSuggestions.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(student => {
                const item = document.createElement('div');
                item.className = 'autocomplete-suggestion-item';
                item.innerHTML = `${escapeHtml(student.id)} - ${escapeHtml(student.name)}`;
                item.addEventListener('click', e => {
                    e.stopPropagation();
                    idInput.value   = student.id;
                    nameInput.value = student.name;
                    clearSuggestions(nameSuggestions);
                    clearSuggestions(idSuggestions);
                });
                idSuggestions.appendChild(item);
            });
            idSuggestions.classList.remove('hidden');
        } else {
            idSuggestions.classList.add('hidden');
        }
        nameInput.value = (matches.length === 1) ? matches[0].name : '';
    });

    document.addEventListener('click', () => {
        clearSuggestions(nameSuggestions);
        clearSuggestions(idSuggestions);
    });
}

// استدعاء وحصر الطلاب الناجحين
function generatePassedReport() {
    const semTypeFilter = document.getElementById('filter-semester-type')?.value || 'الكل';
    const semYearFilter = document.getElementById('filter-semester-year')?.value?.trim() || '';
    const majorFilter   = document.getElementById('filter-major')?.value || 'الكل';
    const gradeFilter   = document.getElementById('filter-grade')?.value || 'الكل';
    const nameQuery     = document.getElementById('filter-student-name')?.value || '';
    const idQuery       = document.getElementById('filter-student-id')?.value || '';

    const semTypeLabel = { spring: 'ربيع', fall: 'خريف', 'الكل': 'كل الفصول' }[semTypeFilter] || semTypeFilter;
    const seasonDisplayLabel = semTypeFilter === 'الكل'
        ? 'كل الفصول'
        : `${semTypeLabel}${semYearFilter ? ' ' + semYearFilter : ''}`;

    const printSeasonTarget  = document.getElementById('print-season-target');
    const printSemesterTarget = document.getElementById('print-semester-target');
    const reportDateText     = document.getElementById('report-date-text');

    if (printSeasonTarget)   printSeasonTarget.innerText   = seasonDisplayLabel;
    if (printSemesterTarget) printSemesterTarget.innerText = seasonDisplayLabel;
    if (reportDateText)      reportDateText.textContent    = `تاريخ الاستخراج: ${getCurrentDate()}`;

    const wrapper = document.getElementById('students-wrapper');
    if (wrapper) wrapper.innerHTML = '<div style="text-align:center;padding:1rem;">⏳ جاري جلب وحصر البيانات...</div>';

    const filteredStudents = mockStudents.filter(student => {
        if (semTypeFilter !== 'الكل' && student.semester_type !== semTypeFilter && !(student.semester_types || []).includes(semTypeFilter)) return false;
        if (semYearFilter && student.semester_year !== semYearFilter && !(student.semester_years || []).includes(semYearFilter)) return false;
        if (majorFilter !== 'الكل' && student.major !== majorFilter) return false;
        if (gradeFilter !== 'الكل') {
            const grade = calculateGeneralGrade(student.gpa);
            if (grade !== gradeFilter) return false;
        }
        if (nameQuery) {
            const words = normalizeArabic(nameQuery).split(' ').filter(Boolean);
            const normName = normalizeArabic(student.name);
            if (!words.every(w => normName.includes(w))) return false;
        }
        if (idQuery && !student.id.includes(idQuery.trim())) return false;
        return true;
    });

    setTimeout(() => {
        if (filteredStudents.length > 0) {
            wrapper.innerHTML = filteredStudents.map(student => {
                let passedCourses = student.passedCourses || [];
                if (semTypeFilter !== 'الكل') {
                    passedCourses = passedCourses.filter(c => c.season.includes(semTypeLabel));
                }

                const coursesHTML = passedCourses.map(course => `
                    <tr>
                        <td class="cell-code">${escapeHtml(course.code)}</td>
                        <td class="cell-name">${escapeHtml(course.name)}</td>
                        <td class="cell-credits">${escapeHtml(course.credits)}</td>
                        <td class="cell-season">${escapeHtml(course.season)}</td>
                        <td class="cell-total">${escapeHtml(course.total)}</td>
                        <td class="cell-status">✓ اجتياز بنجاح</td>
                    </tr>
                `).join('');

                return `
                    <div class="student-block">
                        <div class="student-header">
                            <div class="student-info">
                                <span>رقم القيد: <span class="student-id">${escapeHtml(student.id)}</span></span>
                                <span class="separator">|</span>
                                <span>اسم الطالب: <span class="student-name">${escapeHtml(student.name)}</span></span>
                                <span class="separator">|</span>
                                <span>التخصص: <span class="student-major">${escapeHtml(student.major)}</span></span>
                                <span class="separator">|</span>
                                <span>المستوى (السمستر): <span class="student-semester">${escapeHtml(student.currentSemester)}</span></span>
                            </div>
                            <div class="student-gpa-section">
                                <span>المعدل الشامل: <span class="student-gpa">${Number(student.gpa).toFixed(2)}</span></span>
                                <span class="grade-badge">التقدير: ${escapeHtml(calculateGeneralGrade(student.gpa))}</span>
                            </div>
                        </div>
                        <div class="table-wrapper">
                            <table class="grades-table">
                                <thead>
                                    <tr>
                                        <th class="col-code">رمز المادة</th>
                                        <th>اسم المادة الدراسية المنجزة</th>
                                        <th class="col-credits">الوحدات</th>
                                        <th class="col-season">الموسم الدراسي</th>
                                        <th class="col-total">الدرجة النهائية</th>
                                        <th class="col-status">الحالة الأكاديمية</th>
                                    </tr>
                                </thead>
                                <tbody>${coursesHTML}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('report-container')?.classList.remove('hidden');
            document.getElementById('no-results-message')?.classList.remove('visible');
        } else {
            if (wrapper) wrapper.innerHTML = '';
            document.getElementById('report-container')?.classList.remove('hidden');
            document.getElementById('no-results-message')?.classList.add('visible');
        }

        updatePrintReport(filteredStudents, seasonDisplayLabel, semTypeLabel, majorFilter, semYearFilter);
    }, 150);
}

function ensurePrintContainerInBody() {
    const container = document.getElementById('printReportContainer');
    if (container && container.parentNode !== document.body) {
        document.body.appendChild(container);
    }
}

// ✅ تحديث جدول الطباعة - 6 أعمدة بدون القسم والمستوى والموسم
function updatePrintReport(filteredStudents, seasonDisplayLabel, semTypeLabel, majorFilter, semYearFilter) {
    ensurePrintContainerInBody();

    const printSeasonVal   = document.getElementById('printSeasonVal');
    const printSemesterVal = document.getElementById('printSemesterVal');
    const printDeptVal     = document.getElementById('printDeptVal');
    const printLevelVal    = document.getElementById('printLevelVal');
    const printTableBody   = document.getElementById('printTableBody');

    if (printSeasonVal)   printSeasonVal.textContent   = seasonDisplayLabel || 'كل الفصول';
    if (printSemesterVal) printSemesterVal.textContent = semTypeLabel       || 'الكل';
    if (printDeptVal)     printDeptVal.textContent     = majorFilter        || 'كافة التخصصات';
    if (printLevelVal)    printLevelVal.textContent    = semYearFilter ? `سنة ${semYearFilter}` : 'الكل';

    if (printTableBody) {
        if (!filteredStudents || filteredStudents.length === 0) {
            printTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding:20px;text-align:center;font-size:13.5px;font-weight:bold;border:1px solid #000;">
                        لا توجد بيانات مطابقة لمعايير البحث.
                    </td>
                </tr>`;
        } else {
            printTableBody.innerHTML = filteredStudents.map((st, idx) => `
                <tr>
                    <td style="padding:8px 6px;border:1px solid #000;text-align:center;">${idx + 1}</td>
                    <td style="padding:8px 6px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(st.id || '-')}</td>
                    <td style="padding:8px 6px;border:1px solid #000;text-align:right;padding-right:10px;font-weight:600;">${escapeHtml(st.name || '-')}</td>
                    <td style="padding:8px 6px;border:1px solid #000;text-align:center;">${escapeHtml(st.major || '-')}</td>
                    <td style="padding:8px 6px;border:1px solid #000;text-align:center;font-weight:bold;">${Number(st.gpa || 0).toFixed(2)}</td>
                    <td style="padding:8px 6px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(calculateGeneralGrade(st.gpa))}</td>
                </tr>
            `).join('');
        }
    }
}

// ============================================
// دالة الطباعة مع جلب منسق الدراسة والامتحانات تلقائياً
// ============================================
function triggerPrintWithOfficials() {
    ensurePrintContainerInBody();
    generatePassedReport();

    const majorSelect = document.getElementById('filter-major');
    const selectedDept = majorSelect ? majorSelect.value : '';

    if (window.OfficialsHelper) {
        window.OfficialsHelper.autoFill(selectedDept).finally(() => {
            window.print();
        });
    } else {
        window.print();
    }
}

window.triggerPrintWithOfficials = triggerPrintWithOfficials;

function calculateGeneralGrade(gpa) {
    const gpaNum = Number(gpa);
    if (gpaNum >= 3.50) return "ممتاز";
    if (gpaNum >= 3.00) return "جيد جداً";
    if (gpaNum >= 2.00) return "جيد";
    return "مقبول";
}

function resetAllFilters() {
    const semTypeSelect = document.getElementById('filter-semester-type');
    if (semTypeSelect) semTypeSelect.value = 'الكل';

    const semYearInput = document.getElementById('filter-semester-year');
    if (semYearInput) semYearInput.value = '';

    const majorSelect = document.getElementById('filter-major');
    if (majorSelect) majorSelect.value = 'الكل';

    const gradeSelect = document.getElementById('filter-grade');
    if (gradeSelect) gradeSelect.value = 'الكل';

    const nameInput = document.getElementById('filter-student-name');
    if (nameInput) nameInput.value = '';

    const idInput = document.getElementById('filter-student-id');
    if (idInput) idInput.value = '';

    document.getElementById('student-name-suggestions')?.classList.add('hidden');
    document.getElementById('student-id-suggestions')?.classList.add('hidden');
    document.getElementById('report-container')?.classList.add('hidden');
    document.getElementById('no-results-message')?.classList.remove('visible');
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadFilters();
    ensurePrintContainerInBody();
    if (window.OfficialsHelper) window.OfficialsHelper.autoFill();
});

window.addEventListener('beforeprint', () => {
    ensurePrintContainerInBody();
    generatePassedReport();
    if (window.OfficialsHelper) window.OfficialsHelper.autoFill();
});

window.generatePassedReport = generatePassedReport;
window.resetAllFilters      = resetAllFilters;