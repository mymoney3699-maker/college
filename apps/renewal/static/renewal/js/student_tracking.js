/**
 * ============================================================
 * متابعة الطلاب - Student Tracking
 * student_tracking.js  v1.1.0
 * ============================================================
 */

console.log('✅ student_tracking.js v1.1.0 loaded');

// ============================================================
// جلب قاعدة بيانات الطلاب الحقيقية من Django View
// ============================================================
const trackingDataEl = document.getElementById('tracking-data');
if (trackingDataEl) {
    try {
        const data = JSON.parse(trackingDataEl.textContent);
        window.databaseStudents = data.students || [];
        window.databaseDepartments = data.departments || [];
        window.databaseLevels = data.levels || [];
    } catch (e) {
        console.error('Error parsing tracking-data JSON:', e);
    }
}

const studentDB = (window.databaseStudents && window.databaseStudents.length > 0) ? window.databaseStudents : [];

// ============================================================
// عناصر DOM
// ============================================================
const searchBtn = document.getElementById('searchBtn');
const idInput = document.getElementById('studentIdInput');
const nameInput = document.getElementById('studentNameInput');

const idSearchResults = document.getElementById('idSearchResults');
const nameSearchResults = document.getElementById('nameSearchResults');

const sName = document.getElementById('sName');
const sId = document.getElementById('sId');
const sNational = document.getElementById('sNational');
const sDept = document.getElementById('sDept');
const sMajor = document.getElementById('sMajor');
const sLevel = document.getElementById('sLevel');
const sAdvisor = document.getElementById('sAdvisor');
const sStatus = document.getElementById('sStatus');

const totalCourses = document.getElementById('totalCourses');
const passedCourses = document.getElementById('passedCourses');
const enrolledCourses = document.getElementById('enrolledCourses');
const remainingCourses = document.getElementById('remainingCourses');
const gpaDisplay = document.getElementById('gpaDisplay');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

const timelineContainer = document.getElementById('timelineContainer');
const coursesTableBody = document.getElementById('coursesTableBody');
const notesList = document.getElementById('notesList');
const alertsGrid = document.getElementById('alertsGrid');

const printBtn = document.getElementById('printBtn');
const resetBtn = document.getElementById('resetBtn');
const printPreview = document.getElementById('printPreview');
const printCertInner = document.getElementById('printCertInner');
const closePreviewBtn = document.getElementById('closePreviewBtn');

let currentStudent = null;

// ============================================================
// دوال تنميط ومطابقة الحروف العربية
// ============================================================
function normalizeArabic(text) {
    if (!text) return '';
    return text
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
        .toLowerCase();
}

function matchName(fullName, query) {
    const normQuery = normalizeArabic(query);
    if (!normQuery) return false;

    const normName = normalizeArabic(fullName);
    const words = normName.split(/\s+/);

    const matchesWordStart = words.some(w => {
        if (w.startsWith(normQuery)) return true;
        if (w.startsWith('ال') && w.slice(2).startsWith(normQuery)) return true;
        return false;
    });

    if (matchesWordStart) return true;
    if (normQuery.length >= 3 && normName.includes(normQuery)) return true;
    return false;
}

function hideAllResults() {
    if (idSearchResults) idSearchResults.classList.remove('show');
    if (nameSearchResults) nameSearchResults.classList.remove('show');
}

function selectStudent(student) {
    if (!student) return;
    currentStudent = student;
    showStudent(student);
    if (idInput) idInput.value = student.id;
    if (nameInput) nameInput.value = student.name;
    hideAllResults();
    // إظهار منطقة النتائج بعد اختيار الطالب
    showStudentArea();
}

function showNameSearchResults(students) {
    if (!nameSearchResults) return;
    nameSearchResults.innerHTML = '';

    if (students.length === 0) {
        nameSearchResults.classList.remove('show');
        return;
    }

    students.forEach(student => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <span class="result-main">${student.name}</span>
            <span class="result-sub">رقم القيد: ${student.id}</span>
        `;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectStudent(student);
        });
        nameSearchResults.appendChild(item);
    });
    nameSearchResults.classList.add('show');
}

function showIdSearchResults(students) {
    if (!idSearchResults) return;
    idSearchResults.innerHTML = '';

    if (students.length === 0) {
        idSearchResults.classList.remove('show');
        return;
    }

    students.forEach(student => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <span class="result-main">${student.id}</span>
            <span class="result-sub">${student.name}</span>
        `;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectStudent(student);
        });
        idSearchResults.appendChild(item);
    });
    idSearchResults.classList.add('show');
}

// ============================================================
// عرض بيانات الطالب
// ============================================================
function showStudent(student) {
    if (!student) {
        const empty = '—';
        if (sName) sName.textContent = empty;
        if (sId) sId.textContent = empty;
        if (sNational) sNational.textContent = empty;
        if (sDept) sDept.textContent = empty;
        if (sMajor) sMajor.textContent = empty;
        if (sLevel) sLevel.textContent = empty;
        if (sAdvisor) sAdvisor.textContent = empty;
        if (sStatus) sStatus.textContent = empty;
        if (totalCourses) totalCourses.textContent = '0';
        if (passedCourses) passedCourses.textContent = '0';
        if (enrolledCourses) enrolledCourses.textContent = '0';
        if (remainingCourses) remainingCourses.textContent = '0';
        if (gpaDisplay) gpaDisplay.textContent = '0';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        if (timelineContainer) timelineContainer.innerHTML = '';
        if (coursesTableBody) coursesTableBody.innerHTML = '';
        if (notesList) notesList.innerHTML = '';
        if (alertsGrid) alertsGrid.innerHTML = '';
        return;
    }

    if (sName) sName.textContent = student.name;
    if (sId) sId.textContent = student.id;
    if (sNational) sNational.textContent = student.national;
    if (sDept) sDept.textContent = student.dept;
    if (sMajor) sMajor.textContent = student.major;
    if (sLevel) sLevel.textContent = student.level;
    if (sAdvisor) sAdvisor.textContent = student.advisor;
    if (sStatus) sStatus.textContent = student.status;

    if (totalCourses) totalCourses.textContent = student.totalCourses;
    if (passedCourses) passedCourses.textContent = student.passedCourses;
    if (enrolledCourses) enrolledCourses.textContent = student.enrolledCourses;
    if (remainingCourses) remainingCourses.textContent = student.remainingCourses;
    if (gpaDisplay) gpaDisplay.textContent = student.gpa;
    if (progressPercent) progressPercent.textContent = `${student.progress}%`;
    if (progressFill) progressFill.style.width = `${student.progress}%`;
    if (progressText) progressText.textContent = `${student.progress}%`;

    // المستويات
    const levels = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
    
    function getStudentLevelNum(s) {
        if (s.levelNumber) return parseInt(s.levelNumber, 10);
        if (s.level_number) return parseInt(s.level_number, 10);
        if (s.level) {
            const str = String(s.level);
            const match = str.match(/\d+/);
            if (match) return parseInt(match[0], 10);
            const arabicMap = {
                'الأول': 1, 'الاول': 1,
                'الثاني': 2,
                'الثالث': 3,
                'الرابع': 4,
                'الخامس': 5,
                'السادس': 6,
                'السابع': 7,
                'الثامن': 8
            };
            for (const [key, val] of Object.entries(arabicMap)) {
                if (str.includes(key)) return val;
            }
        }
        return 1;
    }

    const levelNum = getStudentLevelNum(student);
    const isGraduated = student.status && (student.status.includes('متخرج') || student.status.includes('خريج'));

    if (timelineContainer) {
        timelineContainer.innerHTML = levels.map((l, i) => {
            const stepLevel = i + 1;
            let cls = 'timeline-card-step';
            let badgeText = 'مكتمل';
            let icon = 'check_circle';

            if (isGraduated && stepLevel <= levelNum) {
                cls += ' done';
                badgeText = 'مكتمل';
                icon = 'check_circle';
            } else if (stepLevel < levelNum) {
                cls += ' done';
                badgeText = 'مكتمل';
                icon = 'check_circle';
            } else if (stepLevel === levelNum) {
                cls += ' current';
                badgeText = 'الحالي';
                icon = 'play_circle';
            } else {
                cls += ' pending';
                badgeText = 'قادم';
                icon = 'schedule';
            }

            return `
                <div class="${cls}">
                    <div class="step-icon"><span class="material-symbols-outlined">${icon}</span></div>
                    <div class="step-info">
                        <span class="step-name">المستوى ${l}</span>
                        <span class="step-badge">${badgeText}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // المواد
    const statusMap = {
        'passed': 'ناجح',
        'failed': 'راسب',
        'enrolled': 'مسجل حالياً',
        'withdrawn': 'منسحب'
    };
    const statusClass = {
        'passed': 'passed',
        'failed': 'failed',
        'enrolled': 'enrolled',
        'withdrawn': 'withdrawn'
    };
    if (coursesTableBody) {
        coursesTableBody.innerHTML = student.courses.map(c => {
            const statusText = statusMap[c.status] || c.status;
            const cls = statusClass[c.status] || '';
            return `
                <tr>
                    <td>${c.name}</td>
                    <td>${c.code}</td>
                    <td>${c.credits}</td>
                    <td>${c.grade !== null ? c.grade : '—'}</td>
                    <td>${c.score || '—'}</td>
                    <td><span class="badge-status ${cls}">${statusText}</span></td>
                </tr>
            `;
        }).join('');
    }

    // الملاحظات
    if (notesList) {
        notesList.innerHTML = student.notes.map(n => `
            <li class="note-card-item">
                <span class="material-symbols-outlined note-icon">sticky_note_2</span>
                <span class="note-text">${n}</span>
            </li>
        `).join('');
    }

    // التنبيهات
    const alertIcons = {
        'success': 'check_circle',
        'info': 'info',
        'warning': 'warning',
        'danger': 'error',
        'orange': 'report_problem'
    };
    if (alertsGrid) {
        alertsGrid.innerHTML = student.alerts.map(a => {
            const iconName = alertIcons[a.type] || 'info';
            const cleanText = a.text.replace(/^[🟢🔵🟡🔴🟠]\s*/, '');
            return `
                <div class="alert-card-item ${a.type}">
                    <div class="alert-card-icon"><span class="material-symbols-outlined">${iconName}</span></div>
                    <div class="alert-card-text">${cleanText}</div>
                </div>
            `;
        }).join('');
    }
}

// ============================================================
// أحداث البحث الفوري المباشر (مثل إفادة التخرج)
// ============================================================
if (nameInput) {
    nameInput.addEventListener('input', function() {
        const rawName = this.value.trim();
        if (rawName.length === 0) {
            if (nameSearchResults) nameSearchResults.classList.remove('show');
            return;
        }
        const matchedStudents = studentDB.filter(s => matchName(s.name, rawName));
        showNameSearchResults(matchedStudents);
    });
}

if (idInput) {
    idInput.addEventListener('input', function() {
        const rawId = this.value.trim();
        if (rawId.length === 0) {
            if (idSearchResults) idSearchResults.classList.remove('show');
            return;
        }
        const matchedStudents = studentDB.filter(s => s.id.includes(rawId));
        showIdSearchResults(matchedStudents);
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        hideAllResults();
    }
});

// ============================================================
// زر البحث
// ============================================================
function searchStudent() {
    const rawId = idInput ? idInput.value.trim() : '';
    const rawName = nameInput ? nameInput.value.trim() : '';

    if (!rawId && !rawName) {
        showTrackingToast('⚠️ الرجاء إدخال رقم القيد أو اسم الطالب للبحث', true);
        return;
    }

    let found = null;
    if (rawId.length > 0) {
        found = studentDB.find(s => s.id === rawId || s.id.includes(rawId));
    }
    if (!found && rawName.length > 0) {
        found = studentDB.find(s => matchName(s.name, rawName) || s.name.includes(rawName));
    }

    if (!found) {
        currentStudent = null;
        // إخفاء منطقة النتائج عند عدم العثور على طالب
        hideStudentArea();
        showTrackingToast('⚠️ لم يتم العثور على طالب بهذه البيانات', true);
        return;
    }

    selectStudent(found);
}

// ============================================================
// معاينة الطباعة
// ============================================================
function openPrintPreview() {
    if (!currentStudent) {
        showTrackingToast('⚠️ الرجاء البحث عن طالب أولاً', true);
        return;
    }
    const s = currentStudent;

    const now = new Date();
    const todayDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    const statusMap = {
        'passed': 'ناجح',
        'failed': 'راسب',
        'enrolled': 'مسجل حالياً',
        'withdrawn': 'منسحب'
    };

    const coursesRowsHTML = s.courses.map((c, index) => `
        <tr>
            <td>${index + 1}</td>
            <td style="text-align: right; font-weight: 800;">${c.name}</td>
            <td>${c.code}</td>
            <td>${c.credits}</td>
            <td>${c.grade !== null ? c.grade : '—'}</td>
            <td>${c.score || '—'}</td>
            <td>${statusMap[c.status] || c.status}</td>
        </tr>
    `).join('');

    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    printCertInner.innerHTML = `
        <div class="official-cert-frame">
            <!-- 1. الترويسة الرسمية ثنائية اللغة المعتمدة -->
            <div class="print-header-section" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;direction:rtl;">
                <!-- اليمين: العربية -->
                <div class="print-header-ar" style="flex:1;text-align:center;font-size:11.5px;line-height:1.45;color:#000;">
                    <div style="font-size:13.5px;font-weight:900;margin-bottom:2px;">دولة ليبيا</div>
                    <div style="font-size:11px;font-weight:800;margin-bottom:1px;">حكومة الوحدة الوطنية</div>
                    <div style="font-size:11px;font-weight:800;margin-bottom:1px;">وزارة التعليم التقني والفني</div>
                    <div style="font-size:12px;font-weight:900;margin-top:2px;">كلية طرابلس للعلوم والتقنية</div>
                </div>

                <!-- الوسط: الشعار الدائري -->
                <div class="print-header-logo-box" style="flex:0 0 95px;text-align:center;display:flex;justify-content:center;align-items:center;padding:0 10px;">
                    <img src="${logoUrl}" alt="شعار الكلية" class="print-college-logo" style="width:75px;height:75px;max-height:75px;max-width:75px;object-fit:contain;display:block;margin:0 auto;border-radius:50%;" onerror="this.onerror=null; this.src='/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';">
                </div>

                <!-- اليسار: الإنجليزية -->
                <div class="print-header-en" style="flex:1;text-align:center;font-size:10px;line-height:1.35;color:#000;direction:ltr;font-family:Arial,'Segoe UI',Tahoma,sans-serif;">
                    <div style="font-size:11.5px;font-weight:bold;margin-bottom:1px;">state of Libya</div>
                    <div style="font-weight:600;margin-bottom:1px;">government National Unity</div>
                    <div style="font-weight:600;margin-bottom:1px;">Ministry of Technical and Technical Education</div>
                    <div style="font-weight:600;margin-bottom:1px;">department of Technical</div>
                    <div style="font-size:10.5px;font-weight:bold;margin-top:2px;letter-spacing:0.5px;">TRIPOLI COLLAGE AND TECHNOLOGY</div>
                </div>
            </div>

            <div class="print-header-line" style="border-top: 1.5px solid #000; margin: 6px 0 10px; width: 100%; display: block;"></div>

            <!-- Title -->
            <div class="cert-title-container">
                <h2 class="cert-main-title">تقرير متابعة طالب</h2>
                <p class="cert-sub-title">سجل المسيرة الأكاديمية ونسبة الإنجاز المستندة إلى المنظومة الرسمية</p>
            </div>

            <!-- Section 1: Student Information -->
            <div class="cert-section-box">
                <div class="cert-section-title">أولاً: البيانات الأساسية للطالب</div>
                <table class="cert-info-table">
                    <tr>
                        <td class="tbl-label">اسم الطالب:</td>
                        <td class="tbl-val highlight">${s.name}</td>
                        <td class="tbl-label">رقم القيد:</td>
                        <td class="tbl-val highlight">${s.id}</td>
                    </tr>
                    <tr>
                        <td class="tbl-label">الرقم الوطني:</td>
                        <td class="tbl-val">${s.national}</td>
                        <td class="tbl-label">الحالة الأكاديمية:</td>
                        <td class="tbl-val">${s.status}</td>
                    </tr>
                    <tr>
                        <td class="tbl-label">القسم العلمي:</td>
                        <td class="tbl-val">${s.dept}</td>
                        <td class="tbl-label">التخصص:</td>
                        <td class="tbl-val">${s.major}</td>
                    </tr>
                    <tr>
                        <td class="tbl-label">المستوى الحالي:</td>
                        <td class="tbl-val">${s.level}</td>
                        <td class="tbl-label">المرشد الأكاديمي:</td>
                        <td class="tbl-val">${s.advisor}</td>
                    </tr>
                </table>
            </div>

            <!-- Section 2: Summary Stats -->
            <div class="cert-section-box">
                <div class="cert-section-title">ثانياً: ملخص الإحصائيات والأداء الأكاديمي</div>
                <table class="cert-stats-table">
                    <thead>
                        <tr>
                            <th>إجمالي المواد</th>
                            <th>المواد المجتازة</th>
                            <th>المسجلة حالياً</th>
                            <th>المواد المتبقية</th>
                            <th>المعدل التراكمي</th>
                            <th>نسبة الإنجاز</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${s.totalCourses}</td>
                            <td>${s.passedCourses}</td>
                            <td>${s.enrolledCourses}</td>
                            <td>${s.remainingCourses}</td>
                            <td>${s.gpa}</td>
                            <td>${s.progress}%</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Section 3: Courses Table -->
            <div class="cert-section-box">
                <div class="cert-section-title">ثالثاً: كشف المواد الدراسية المسجلة والسابقة</div>
                <table class="cert-courses-table">
                    <thead>
                        <tr>
                            <th style="width: 35px;">#</th>
                            <th style="text-align: right;">اسم المادة</th>
                            <th style="width: 90px;">رمز المادة</th>
                            <th style="width: 75px;">الوحدات</th>
                            <th style="width: 65px;">الدرجة</th>
                            <th style="width: 65px;">التقدير</th>
                            <th style="width: 100px;">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${coursesRowsHTML}
                    </tbody>
                </table>
            </div>

            <!-- Section 4: Notes -->
            ${s.notes && s.notes.length > 0 ? `
            <div class="cert-section-box">
                <div class="cert-section-title">رابعاً: الملاحظات والتوصيات الأكاديمية</div>
                <ul class="cert-notes-list">
                    ${s.notes.map(n => `<li>${n}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            <!-- Official Signatures & Seal -->
            <div class="cert-official-signatures" style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2rem; padding-top: 1rem; width: 100%;">
                <div class="sig-block stamp-center" style="text-align: right; flex: 0 0 auto;">
                    <div class="official-stamp-ring">
                        <span>ختم الكلية الرسمي</span>
                    </div>
                </div>
                <div class="sig-block" style="min-width: 220px; text-align: left; flex: 0 0 auto;" data-official="general_registrar">
                    <div class="sig-title off-pos" style="font-size: 13px; font-weight: 900; color: #000; margin-bottom: 4px;">المسجل العام بالكلية</div>
                    <div class="sig-name off-name" style="font-size: 13.5px; font-weight: 900; color: #000; margin-bottom: 6px;">أ. احمد محمد علي محمود</div>
                    <div class="sig-line" style="width: 170px; border-bottom: 1.5px dotted #000; margin: 4px 0 0 auto;"></div>
                </div>
            </div>

            <!-- Footer Notice -->
            <div class="cert-footer-notice">
                <span>تنبيه: هذه الوثيقة صادرة رسمياً من منظومة كلية طرابلس للعلوم والتقنية وتعتبر ملغاة في حال الكشط أو التعديل.</span>
            </div>
        </div>
    `;

    // دالة تنفيذ أمر الطباعة بعد التأكد من اكتمال تحميل الشعار
    const executePrint = () => {
        const logoImg = printCertInner.querySelector('.print-college-logo');
        if (logoImg && !logoImg.complete) {
            logoImg.onload = () => setTimeout(() => window.print(), 100);
            logoImg.onerror = () => setTimeout(() => window.print(), 100);
            setTimeout(() => window.print(), 350);
        } else {
            setTimeout(() => window.print(), 150);
        }
    };

    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') res.then(executePrint).catch(executePrint);
            else executePrint();
        } catch (e) {
            executePrint();
        }
    } else {
        executePrint();
    }
}

// ============================================================
// إغلاق المعاينة
// ============================================================
function closePrintPreview() {
    if (printPreview) printPreview.classList.remove('open');
}

// ============================================================
// إعادة تعيين
// ============================================================
function resetAll() {
    currentStudent = null;
    showStudent(null);
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    hideAllResults();
    if (printPreview) printPreview.classList.remove('open');
    // إخفاء منطقة النتائج عند إعادة التعيين
    hideStudentArea();
}

// ============================================================
// ربط الأحداث
// ============================================================
if (searchBtn) searchBtn.addEventListener('click', searchStudent);
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (document.activeElement === idInput || document.activeElement === nameInput)) {
        e.preventDefault();
        searchStudent();
    }
});

if (printBtn) printBtn.addEventListener('click', openPrintPreview);
if (resetBtn) resetBtn.addEventListener('click', resetAll);
if (closePreviewBtn) closePreviewBtn.addEventListener('click', closePrintPreview);

// ============================================================
// دوال إظهار/إخفاء منطقة نتائج الطالب
// ============================================================
function showStudentArea() {
    const studentDataEl = document.getElementById('studentData');
    const actionsEl = document.querySelector('.actions-standalone');
    if (studentDataEl) {
        studentDataEl.style.setProperty('display', 'block', 'important');
        studentDataEl.classList.remove('hidden');
    }
    if (actionsEl) {
        actionsEl.style.setProperty('display', 'block', 'important');
        actionsEl.classList.remove('hidden');
    }
}

function hideStudentArea() {
    const studentDataEl = document.getElementById('studentData');
    const actionsEl = document.querySelector('.actions-standalone');
    if (studentDataEl) {
        studentDataEl.style.setProperty('display', 'none', 'important');
        studentDataEl.classList.add('hidden');
    }
    if (actionsEl) {
        actionsEl.style.setProperty('display', 'none', 'important');
        actionsEl.classList.add('hidden');
    }
}

// ============================================================
// تنبيه خفيف (Toast) بدلاً من alert() القديم
// ============================================================
function showTrackingToast(message, isError = false) {
    // استخدام نظام التوست الموجود في النظام إن وُجد
    if (window.showToastMessage && typeof window.showToastMessage === 'function') {
        window.showToastMessage(message, isError);
        return;
    }
    // fallback: div مؤقت
    const existing = document.getElementById('_trackingToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = '_trackingToast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: ${isError ? '#dc2626' : '#10b981'};
        color: #fff; padding: 12px 28px; border-radius: 10px;
        font-weight: 700; font-size: 14px; z-index: 99999;
        box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        transition: opacity 0.4s ease; direction: rtl;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3000);
}

// ============================================================
// تهيئة الصفحة — لا عرض تلقائي
// ============================================================
// إخفاء منطقة النتائج عند أول تحميل — تظهر فقط عند الضغط على بحث
hideStudentArea();

// ============================================================
// تصدير الدوال للنافذة
// ============================================================
window.searchStudent = searchStudent;
window.showStudent = showStudent;
window.selectStudent = selectStudent;
window.openPrintPreview = openPrintPreview;
window.closePrintPreview = closePrintPreview;
window.resetAll = resetAll;