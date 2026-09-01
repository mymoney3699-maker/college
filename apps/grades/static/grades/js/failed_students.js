/**
 * ============================================================
 * رصد ومتابعة الطلاب المتعثرين - Failed Students Monitor
 * failed_students.js v6.0.28
 * ============================================================
 */

console.log('✅ failed_students.js v6.0.28 loaded');

// ============================================================
// دالة escapeHtml
// ============================================================
function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// جلب البيانات من القالب
// ============================================================
const failedDataEl = document.getElementById('failed-data');
if (failedDataEl) {
    try {
        const data = JSON.parse(failedDataEl.textContent);
        window.databaseStudents    = data.students    || [];
        window.databaseSemesters   = data.semesters   || [];
        window.databaseDepartments = data.departments || [];
    } catch (e) {
        console.error('Error parsing failed-data JSON:', e);
    }
}

// ============================================================
// متغيّرات عامة
// ============================================================
let selectInteracted = false;

const studentsData = window.databaseStudents || [];

// ============================================================
// دوال مساعدة للتعامل مع النصوص العربية وحالة التكرار
// ============================================================

function normalizeArabic(text) {
    if (!text) return '';
    return text.trim()
        .toLocaleLowerCase('ar-LY')
        .replace(/أ/g, 'ا')
        .replace(/إ/g, 'ا')
        .replace(/آ/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي');
}

function getRepeatText(count, repetitionStatus) {
    if (repetitionStatus && typeof repetitionStatus === 'string' && repetitionStatus.trim() !== '') {
        return repetitionStatus.trim();
    }
    const c = Number(count || 1);
    if (c <= 1) return 'أول مرة';
    if (c === 2) return 'معاود مرتين';
    if (c >= 3 && c <= 10) return `معاود ${c} مرات`;
    return `معاود ${c} مرة`;
}

function getRepeatBadge(count, repetitionStatus) {
    const text = getRepeatText(count, repetitionStatus);
    const c = Number(count || 1);
    if (c <= 1) return `<span class="badge badge-warning">${escapeHtml(text)}</span>`;
    if (c === 2) return `<span class="badge badge-danger">${escapeHtml(text)}</span>`;
    return `<span class="badge badge-danger" style="background:rgba(180,0,0,0.12);color:#7f0000;font-weight:700;">${escapeHtml(text)}</span>`;
}

function getAction(maxRepeat, gpa) {
    if (maxRepeat >= 3 || gpa < 1.50) {
        return { text: "إيقاف قيد وفصل مؤقت للعرض على اللجنة", class: "badge-danger" };
    } else if (maxRepeat === 2 || gpa < 2.00) {
        return { text: "توجيه إنذار أكاديمي أول وتنبيه المسجل", class: "badge-warning" };
    } else {
        return { text: "فرصة إعادة مادة لتحسين المعدل", class: "badge-info" };
    }
}

function getGpaColor(gpa) {
    if (gpa < 1.50) return '#dc2626';
    if (gpa < 2.00) return '#d97706';
    return '#307e92';
}

function calculateFailGrade(gpa) {
    const gpaNum = Number(gpa || 0);
    if (gpaNum < 1.50) return "راسب (إنذار ثانٍ)";
    if (gpaNum < 2.00) return "ضعيف (إنذار أول)";
    return "مستمر بعثر";
}

// ============================================================
// بناء بطاقة طالب واحد
// ============================================================

function buildStudentCard(student) {
    const failedCourses = student.failedCourses || [];
    const maxRepeat = failedCourses.length > 0
        ? Math.max(...failedCourses.map(c => Number(c.count || c.attempt_number || 1)))
        : Number(student.repeat || student.max_repeat || 1);

    const gpaColor = getGpaColor(student.gpa);

    let coursesHTML = '';
    failedCourses.forEach(course => {
        const count = Number(course.count || course.attempt_number || 1);
        const repStatus = course.repetition_status || course.repeat_status || getRepeatText(count);
        const courseAction = getAction(count, student.gpa);
        coursesHTML += `
            <tr>
                <td class="cell-code">${escapeHtml(course.code)}</td>
                <td class="cell-name">${escapeHtml(course.name)}</td>
                <td>${getRepeatBadge(count, repStatus)}</td>
                <td><span class="badge ${courseAction.class}">${courseAction.text}</span></td>
            </tr>
        `;
    });

    return `
        <div class="failed-student-block"
             data-id="${escapeHtml(student.id)}"
             data-name="${normalizeArabic(student.name)}"
             data-major="${escapeHtml(student.major)}"
             data-repeat="${maxRepeat}">
            <div class="failed-student-header">
                <div class="failed-student-info">
                    <span class="failed-student-id">
                        <span class="material-symbols-outlined" style="font-size:15px;vertical-align:middle;">badge</span>
                        ${escapeHtml(student.id)}
                    </span>
                    <span class="failed-student-name">
                        <span class="material-symbols-outlined" style="font-size:15px;vertical-align:middle;">person</span>
                        ${escapeHtml(student.name)}
                    </span>
                    <span class="failed-student-major">
                        <span class="material-symbols-outlined" style="font-size:15px;vertical-align:middle;">school</span>
                        ${escapeHtml(student.major)}
                    </span>
                </div>
                <div class="failed-student-gpa" style="color:${gpaColor};">
                    المعدل التراكمي: <strong>${Number(student.gpa || 0).toFixed(2)}</strong>
                </div>
            </div>
            <div class="table-responsive">
                <table class="data-table failed-table">
                    <thead>
                        <tr>
                            <th class="col-code">رمز المادة</th>
                            <th>اسم المادة الدراسية</th>
                            <th>حالة تكرار الرسوب</th>
                            <th>الإجراء الإداري</th>
                        </tr>
                    </thead>
                    <tbody>${coursesHTML}</tbody>
                </table>
            </div>
        </div>
    `;
}

// ============================================================
// بناء جميع البطاقات
// ============================================================

function buildAllStudents() {
    const wrapper = document.getElementById('students-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    studentsData.forEach(student => {
        wrapper.innerHTML += buildStudentCard(student);
    });
    updateResultsCount(studentsData.length);
}

// ============================================================
// دالة البحث والتصفية الرئيسية
// ============================================================

function filterStudents() {
    console.log('🔍 تطبيق الفلترة...');

    const major     = document.getElementById('filter-major').value;
    const repeat    = document.getElementById('filter-repeat').value;
    const nameQuery = normalizeArabic(document.getElementById('student-name').value);
    const idQuery   = document.getElementById('student-id').value.trim();

    const blocks = document.querySelectorAll('.failed-student-block');
    let visibleCount = 0;
    const visibleStudents = [];

    blocks.forEach(block => {
        const blockMajor  = block.dataset.major;
        const blockRepeat = parseInt(block.dataset.repeat);
        const blockName   = block.dataset.name;
        const blockId     = block.dataset.id;

        const matchMajor = (major === 'الكل' || blockMajor === major);

        let matchRepeat = false;
        if (repeat === 'الكل') {
            matchRepeat = true;
        } else if (repeat === '3') {
            matchRepeat = (blockRepeat >= 3);
        } else {
            matchRepeat = (blockRepeat === parseInt(repeat));
        }

        const matchName = (nameQuery === '' || blockName.includes(nameQuery));
        const matchId   = (idQuery   === '' || blockId.includes(idQuery));

        const visible = matchMajor && matchRepeat && matchName && matchId;

        if (visible) {
            block.style.display = '';
            visibleCount++;
            const stObj = studentsData.find(s => String(s.id) === String(blockId));
            if (stObj) visibleStudents.push(stObj);
        } else {
            block.style.display = 'none';
        }
    });

    console.log('📊 عدد النتائج بعد التصفية:', visibleCount);

    updateResultsCount(visibleCount);
    showHideReport(visibleCount);
    updatePrintReport(visibleStudents);
}

// ============================================================
// إظهار/إخفاء التقرير
// ============================================================

function showHideReport(count) {
    const container = document.getElementById('report-container');
    const name = document.getElementById('student-name').value.trim();
    const id   = document.getElementById('student-id').value.trim();
    const hasActiveSearch = (name !== '' || id !== '');

    if (selectInteracted || hasActiveSearch) {
        container?.classList.remove('hidden');
        if (count === 0) {
            container?.classList.add('no-results-state');
        } else {
            container?.classList.remove('no-results-state');
            const wrapper = document.getElementById('students-wrapper');
            if (wrapper && wrapper.innerHTML === '') buildAllStudents();
        }
    } else {
        container?.classList.add('hidden');
        container?.classList.remove('no-results-state');
    }
}

// ============================================================
// تحديث عداد النتائج
// ============================================================

function updateResultsCount(count) {
    const dateEl = document.getElementById('report-date-text');
    if (!dateEl) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = now.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = `تاريخ الاستخراج: ${dateStr} - ${timeStr} | عدد المتعثرين: ${count}`;
}

// ============================================================
// تحديث جدول التقرير المطبوع
// ============================================================

function ensurePrintContainerInBody() {
    const container = document.getElementById('printReportContainer');
    if (container && container.parentNode !== document.body) {
        document.body.appendChild(container);
    }
}

function updatePrintReport(visibleStudents) {
    ensurePrintContainerInBody();

    const majorSelect  = document.getElementById('filter-major');
    const repeatSelect = document.getElementById('filter-repeat');

    let majorText = 'كافة التخصصات';
    if (majorSelect && majorSelect.selectedIndex >= 0) {
        majorText = majorSelect.options[majorSelect.selectedIndex].text;
    }

    let repeatText = 'جميع الحالات';
    if (repeatSelect && repeatSelect.selectedIndex >= 0) {
        repeatText = repeatSelect.options[repeatSelect.selectedIndex].text;
    }

    const printRepeatVal = document.getElementById('printRepeatVal');
    const printDeptVal   = document.getElementById('printDeptVal');
    const printTableBody = document.getElementById('printTableBody');

    if (printRepeatVal) printRepeatVal.textContent = repeatText;
    if (printDeptVal)   printDeptVal.textContent   = majorText;

    if (printTableBody) {
        if (!visibleStudents || visibleStudents.length === 0) {
            printTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding:20px;text-align:center;font-size:13.5px;font-weight:bold;border:1px solid #000;">
                        لا توجد بيانات مطابقة لمعايير البحث.
                    </td>
                </tr>`;
        } else {
            printTableBody.innerHTML = visibleStudents.map((st, idx) => {
                const failedCourses = st.failedCourses || [];
                const maxRepeat = failedCourses.length > 0
                    ? Math.max(...failedCourses.map(c => Number(c.count || c.attempt_number || 1)))
                    : Number(st.repeat || st.max_repeat || 1);
                
                const repeatLabel = st.repeat_status || st.repetition_status || getRepeatText(maxRepeat);

                return `
                    <tr>
                        <td style="padding:8px 6px;border:1px solid #000;text-align:center;">${idx + 1}</td>
                        <td style="padding:8px 6px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(st.id || '-')}</td>
                        <td style="padding:8px 6px;border:1px solid #000;text-align:right;padding-right:10px;font-weight:600;">${escapeHtml(st.name || '-')}</td>
                        <td style="padding:8px 6px;border:1px solid #000;text-align:center;">${escapeHtml(st.major || '-')}</td>
                        <td style="padding:8px 6px;border:1px solid #000;text-align:center;font-weight:bold;">${Number(st.gpa || 0).toFixed(2)}</td>
                        <td style="padding:8px 6px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(repeatLabel)}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// ============================================================
// دوال الأحداث
// ============================================================

function generateReport() {
    selectInteracted = true;
    const wrapper = document.getElementById('students-wrapper');
    if (!wrapper || !wrapper.querySelector('.failed-student-block')) buildAllStudents();
    filterStudents();
    const container = document.getElementById('report-container');
    setTimeout(() => { container?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
}

function handleFilterChange() {
    if (document.activeElement && document.activeElement.tagName === 'SELECT') {
        selectInteracted = true;
    }
    const wrapper = document.getElementById('students-wrapper');
    if (!wrapper || !wrapper.querySelector('.failed-student-block')) buildAllStudents();
    filterStudents();
}

function resetAll() {
    selectInteracted = false;
    document.getElementById('filter-major').selectedIndex  = 0;
    document.getElementById('filter-repeat').selectedIndex = 0;
    document.getElementById('student-name').value = '';
    document.getElementById('student-id').value   = '';

    const nameSuggestions = document.getElementById('student-name-suggestions');
    const idSuggestions   = document.getElementById('student-id-suggestions');
    if (nameSuggestions) { nameSuggestions.innerHTML = ''; nameSuggestions.style.display = 'none'; }
    if (idSuggestions)   { idSuggestions.innerHTML   = ''; idSuggestions.style.display   = 'none'; }

    document.querySelectorAll('.failed-student-block').forEach(b => { b.style.display = ''; });

    const container = document.getElementById('report-container');
    container?.classList.add('hidden');
    container?.classList.remove('no-results-state');

    updateResultsCount(document.querySelectorAll('.failed-student-block').length);
}

// ============================================================
// البحث الذكي مع الاقتراحات التلقائية
// ============================================================

function setupSmartSearch() {
    const nameInput       = document.getElementById('student-name');
    const idInput         = document.getElementById('student-id');
    const nameSuggestions = document.getElementById('student-name-suggestions');
    const idSuggestions   = document.getElementById('student-id-suggestions');

    if (!nameInput || !idInput || !nameSuggestions || !idSuggestions) return;

    function clearSuggestions(el) { el.innerHTML = ''; el.style.display = 'none'; }

    function handleNameInput() {
        const val          = nameInput.value;
        const normalizedVal = normalizeArabic(val);
        if (!normalizedVal) {
            idInput.value = '';
            clearSuggestions(nameSuggestions);
            handleFilterChange();
            return;
        }
        const matches = studentsData.filter(s => normalizeArabic(s.name).includes(normalizedVal));
        nameSuggestions.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(student => {
                const item = document.createElement('div');
                item.className = 'autocomplete-suggestion-item';
                item.innerHTML = `<span class="suggestion-main">${escapeHtml(student.name)}</span>`;
                item.addEventListener('click', e => {
                    e.stopPropagation();
                    nameInput.value = student.name;
                    idInput.value   = student.id;
                    clearSuggestions(nameSuggestions);
                    clearSuggestions(idSuggestions);
                    handleFilterChange();
                });
                nameSuggestions.appendChild(item);
            });
            nameSuggestions.style.display = 'block';
        } else {
            nameSuggestions.style.display = 'none';
        }
        idInput.value = (matches.length === 1) ? matches[0].id : '';
        handleFilterChange();
    }

    function handleIdInput() {
        const val = idInput.value.trim();
        if (!val) {
            nameInput.value = '';
            clearSuggestions(idSuggestions);
            handleFilterChange();
            return;
        }
        const matches = studentsData.filter(s => String(s.id).includes(val));
        idSuggestions.innerHTML = '';
        if (matches.length > 0) {
            matches.forEach(student => {
                const item = document.createElement('div');
                item.className = 'autocomplete-suggestion-item';
                item.innerHTML = `<span class="suggestion-main">${escapeHtml(student.id)}</span>`;
                item.addEventListener('click', e => {
                    e.stopPropagation();
                    nameInput.value = student.name;
                    idInput.value   = student.id;
                    clearSuggestions(nameSuggestions);
                    clearSuggestions(idSuggestions);
                    handleFilterChange();
                });
                idSuggestions.appendChild(item);
            });
            idSuggestions.style.display = 'block';
        } else {
            idSuggestions.style.display = 'none';
        }
        nameInput.value = (matches.length === 1) ? matches[0].name : '';
        handleFilterChange();
    }

    nameInput.addEventListener('input', handleNameInput);
    idInput.addEventListener('input', handleIdInput);
    nameInput.addEventListener('focus', () => { if (nameInput.value) handleNameInput(); });
    idInput.addEventListener('focus',   () => { if (idInput.value)   handleIdInput();   });

    document.addEventListener('click', e => {
        if (!nameInput.contains(e.target) && !nameSuggestions.contains(e.target)) clearSuggestions(nameSuggestions);
        if (!idInput.contains(e.target)   && !idSuggestions.contains(e.target))   clearSuggestions(idSuggestions);
    });
}

// ============================================================
// دالة الطباعة مع تعبئة المسؤولين
// ============================================================

function triggerPrintWithOfficials() {
    ensurePrintContainerInBody();
    filterStudents();

    if (window.OfficialsHelper) {
        window.OfficialsHelper.autoFill().finally(() => {
            window.print();
        });
    } else {
        window.print();
    }
}

// ============================================================
// تصدير الدوال للنافذة
// ============================================================
window.filterStudents          = filterStudents;
window.generateReport          = generateReport;
window.resetAll                = resetAll;
window.handleFilterChange      = handleFilterChange;
window.triggerPrintWithOfficials = triggerPrintWithOfficials;

// ============================================================
// تهيئة الصفحة
// ============================================================
let initialized = false;

function initPage() {
    if (initialized) return;
    initialized = true;
    console.log('🚀 Failed Students page v6.0.28 ready');

    buildAllStudents();

    const container = document.getElementById('report-container');
    if (container) {
        container.classList.add('hidden');
        container.classList.remove('no-results-state');
    }

    const majorSelect  = document.getElementById('filter-major');
    const repeatSelect = document.getElementById('filter-repeat');
    if (majorSelect)  majorSelect.addEventListener('change',  () => { selectInteracted = true; });
    if (repeatSelect) repeatSelect.addEventListener('change', () => { selectInteracted = true; });

    setupSmartSearch();

    if (window.OfficialsHelper) window.OfficialsHelper.autoFill();
}

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    ensurePrintContainerInBody();
    filterStudents();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initPage();
}

window.addEventListener('beforeprint', () => {
    ensurePrintContainerInBody();
    filterStudents();
    if (window.OfficialsHelper) window.OfficialsHelper.autoFill();
});