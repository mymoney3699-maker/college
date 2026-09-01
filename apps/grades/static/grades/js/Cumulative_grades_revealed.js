// ============================================================
// كشف الدرجات التراكمي الكامل - Cumulative Grades Transcript
// v3.3 - Fixed 8 Levels (Level per semester) + Full Page Frames
// ============================================================

console.log('✅ Cumulative_grades_revealed.js v3.3 loaded');

// جلب البيانات من القالب
const cumulativeDataEl = document.getElementById('cumulative-data');
if (cumulativeDataEl) {
    try {
        const data = JSON.parse(cumulativeDataEl.textContent);
        window.databaseStudents    = data.students    || [];
        window.databaseSemesters   = data.semesters   || [];
        window.databaseDepartments = data.departments || [];
    } catch (e) {
        console.error('Error parsing cumulative-data JSON:', e);
    }
}

const transcriptStudentsDb = window.databaseStudents || [];
let _currentStudent = null;

// أسماء المستويات الـ 8 العربية الصريحة
const ARABIC_LEVELS = [
    'المستوى الأول',
    'المستوى الثاني',
    'المستوى الثالث',
    'المستوى الرابع',
    'المستوى الخامس',
    'المستوى السادس',
    'المستوى السابع',
    'المستوى الثامن',
    'المستوى التاسع',
    'المستوى العاشر'
];

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

// ─── جلب اسم المستوى التراكمي (كل فصل = مستوى مستقل 1 إلى 8) ───
function getLevelName(semIndex) {
    return ARABIC_LEVELS[semIndex] || `المستوى ${semIndex + 1}`;
}

// ─── البحث الحي ───
let _liveTimer;
function liveSearchTranscript(mode) {
    clearTimeout(_liveTimer);
    _liveTimer = setTimeout(() => _doLiveSearch(mode), 200);
}

function _doLiveSearch(mode) {
    const regInput  = document.getElementById('search-reg-num');
    const nameInput = document.getElementById('search-input');
    const dropReg   = document.getElementById('autocomplete-reg');
    const dropName  = document.getElementById('autocomplete-name');

    const regVal  = (regInput?.value  || '').trim();
    const nameVal = (nameInput?.value || '').trim();

    if (mode === 'reg') {
        _closeDropdown(dropName);
        if (!regVal) { _closeDropdown(dropReg); return; }
        const matches = transcriptStudentsDb.filter(s => s.reg_num.includes(regVal));
        _renderDropdown(dropReg, matches);
    } else {
        _closeDropdown(dropReg);
        if (!nameVal) { _closeDropdown(dropName); return; }
        const normQ = normalizeAr(nameVal);
        const words = normQ.split(' ').filter(Boolean);
        const matches = transcriptStudentsDb.filter(s =>
            words.every(w => normalizeAr(s.name).includes(w))
        );
        _renderDropdown(dropName, matches);
    }
}

function _renderDropdown(container, students) {
    if (!container) return;
    if (students.length === 0) {
        container.innerHTML = `<div style="padding:.5rem .75rem;font-size:.78rem;color:#dc2626;font-weight:600;">❌ لا توجد نتائج مطابقة</div>`;
    } else {
        container.innerHTML = students.map(s => `
            <div class="ac-i" onclick="window.selectTranscriptStudent('${s.reg_num}')">
                <span class="ac-nm">${s.name}</span>
                <span class="ac-rg">${s.reg_num} &bull; ${s.major}</span>
            </div>
        `).join('');
    }
    container.classList.remove('hidden');
}

function _closeDropdown(el) {
    if (!el) return;
    el.innerHTML = '';
    el.classList.add('hidden');
}

function selectTranscriptStudent(regNum) {
    const student = transcriptStudentsDb.find(s => s.reg_num === regNum);
    if (!student) return;

    const regInput   = document.getElementById('search-reg-num');
    const nameInput  = document.getElementById('search-input');
    const majorInput = document.getElementById('search-major');

    if (regInput)   regInput.value   = student.reg_num;
    if (nameInput)  nameInput.value  = student.name;
    if (majorInput) majorInput.value = student.major;

    _closeDropdown(document.getElementById('autocomplete-reg'));
    _closeDropdown(document.getElementById('autocomplete-name'));

    generateFullTranscript();
}

document.addEventListener('click', function (e) {
    const dropReg   = document.getElementById('autocomplete-reg');
    const dropName  = document.getElementById('autocomplete-name');
    const regInput  = document.getElementById('search-reg-num');
    const nameInput = document.getElementById('search-input');

    if (dropReg  && !regInput?.contains(e.target)  && !dropReg.contains(e.target))  _closeDropdown(dropReg);
    if (dropName && !nameInput?.contains(e.target) && !dropName.contains(e.target)) _closeDropdown(dropName);
});

function resetTranscript() {
    const regInput  = document.getElementById('search-reg-num');
    const nameInput = document.getElementById('search-input');
    const deptSel   = document.getElementById('filter-department');

    if (regInput)  regInput.value  = '';
    if (nameInput) nameInput.value = '';
    if (deptSel)   deptSel.value  = 'all';

    _closeDropdown(document.getElementById('autocomplete-reg'));
    _closeDropdown(document.getElementById('autocomplete-name'));

    _currentStudent = null;
    const container = document.getElementById('transcript-container');
    if (container) container.classList.add('hidden');
}

window.resetTranscript = resetTranscript;

function filterTranscriptByDept(deptName) {
    if (deptName === 'all' || !deptName) return;
    const matched = transcriptStudentsDb.find(s => s.major === deptName || s.dept_id == deptName);
    if (matched) selectTranscriptStudent(matched.reg_num);
}

function toggleSemesterDetail(index) {
    const detailRow  = document.getElementById(`sem-detail-${index}`);
    const btnIcon    = document.getElementById(`toggle-icon-${index}`);
    const btnText    = document.getElementById(`toggle-text-${index}`);
    const summaryRow = document.getElementById(`sem-row-${index}`);

    if (!detailRow) return;

    const isHidden = detailRow.classList.contains('hidden');
    detailRow.classList.toggle('hidden', !isHidden);

    if (btnIcon) btnIcon.textContent = isHidden ? 'expand_less' : 'visibility';
    if (btnText) btnText.textContent = isHidden ? 'إخفاء' : 'عرض';
    if (summaryRow) summaryRow.classList.toggle('open', isHidden);
}

window.toggleSemesterDetail = toggleSemesterDetail;

function gradeFromTotal(total) {
    const t = Number(total);
    if (t >= 90) return 'ممتاز';
    if (t >= 80) return 'جيد جداً';
    if (t >= 70) return 'جيد';
    if (t >= 60) return 'مقبول';
    return 'راسب';
}

function gradeBadgeClass(grade) {
    if (!grade) return 'gb-a';
    if (grade.includes('ممتاز'))                                   return 'gb-a';
    if (grade.includes('جيد جدا') || grade.includes('جيد جداً')) return 'gb-b';
    if (grade.includes('جيد'))                                     return 'gb-c';
    if (grade.includes('مقبول'))                                   return 'gb-d';
    return 'gb-f';
}

function getOfficialInfo(role) {
    let name  = '';
    let title = role === 'general_registrar' ? 'المسجل العام بالكلية' : 'منسق الدراسة والامتحانات';

    const el = document.querySelector(`[data-official="${role}"] .off-name`);
    if (el && el.textContent.trim()) {
        name = el.textContent.trim();
        const posEl = document.querySelector(`[data-official="${role}"] .off-pos`);
        if (posEl && posEl.textContent.trim()) title = posEl.textContent.trim();
        return { name, title };
    }

    if (window.OfficialsHelper && typeof window.OfficialsHelper.getOfficial === 'function') {
        const off = window.OfficialsHelper.getOfficial(role);
        if (off && off.name) {
            name  = (off.title ? off.title + ' ' : '') + off.name;
            title = off.position || title;
            return { name, title };
        }
    }

    const allOffs = document.querySelectorAll('.off-name');
    if (allOffs.length > 0 && role === 'general_registrar') {
        name = allOffs[0].textContent.trim();
    } else if (allOffs.length > 1) {
        name = allOffs[1].textContent.trim();
    }

    return { name, title };
}

// ─── توليد الكشف على الشاشة ───
function generateFullTranscript() {
    console.log('📋 generateFullTranscript v3.3 called');

    const regNum  = (document.getElementById('search-reg-num')?.value || '').trim();
    const name    = (document.getElementById('search-input')?.value   || '').trim();
    const deptVal = (document.getElementById('filter-department')?.value || 'all').trim();

    let student = null;
    if (regNum) student = transcriptStudentsDb.find(s => s.reg_num === regNum);
    if (!student && name) {
        const normQ = normalizeAr(name);
        student = transcriptStudentsDb.find(s => normalizeAr(s.name).includes(normQ));
    }
    if (!student && deptVal !== 'all') {
        student = transcriptStudentsDb.find(s => s.major === deptVal || s.dept_id == deptVal);
    }
    if (!student && transcriptStudentsDb.length > 0) student = transcriptStudentsDb[0];

    const wrapper = document.getElementById('semesters-wrapper');
    if (!wrapper) return;

    if (!student) {
        wrapper.innerHTML = `<div style="padding:2rem;text-align:center;color:#dc2626;font-weight:bold;">⚠️ لا يوجد سجل دراسي مطابق.</div>`;
        document.getElementById('transcript-container')?.classList.remove('hidden');
        return;
    }

    _currentStudent = student;

    const dispName  = document.getElementById('display-name');
    const dispId    = document.getElementById('display-student-id');
    const dispMajor = document.getElementById('display-major');
    if (dispName)  dispName.innerText  = student.name;
    if (dispId)    dispId.innerText    = student.reg_num;
    if (dispMajor) dispMajor.innerText = student.major;

    // الفصول مرتبة تصاعدياً (الفصل الأول ثم الثاني... حتى الثامن)
    const semestersToUse = [...(student.semesters || [])].reverse();

    let totalGpaSum = 0;
    let totalCreditsCount = 0;
    let tbodyHtml = '';

    semestersToUse.forEach((sem, index) => {
        const semGpa     = Number(sem.gpa || 0);
        const semCourses = sem.courses || [];
        const semCredits = semCourses.reduce((s, c) => s + (Number(c.credits) || 0), 0);
        const semStatus  = sem.status || 'مكتمل';
        const semYear    = sem.year || '--';
        const levelLabel = getLevelName(index);

        totalGpaSum       += semGpa;
        totalCreditsCount += semCredits;

        const pillClass = semStatus === 'مكتمل' ? 'sp sp-ok' : 'sp sp-wip';

        tbodyHtml += `
        <tr class="srow" id="sem-row-${index}">
            <td class="tn">${sem.semesterName || ('الفصل ' + (index + 1))} <span style="color:#94a3b8;font-weight:600;font-size:.76rem;">— ${levelLabel}</span></td>
            <td>${semYear}</td>
            <td>${semCourses.length}</td>
            <td class="tg">${semGpa.toFixed(2)}</td>
            <td>${semCredits}</td>
            <td><span class="${pillClass}">${semStatus}</span></td>
            <td>
                <button class="btn-tog" onclick="toggleSemesterDetail(${index})">
                    <span class="material-symbols-outlined" id="toggle-icon-${index}" style="font-size:13px;vertical-align:middle;">visibility</span>
                    <span id="toggle-text-${index}">عرض</span>
                </button>
            </td>
        </tr>`;

        let courseRowsHtml = '';
        semCourses.forEach(course => {
            const gradeLabel = course.grade || gradeFromTotal(course.total);
            const passStatus = course.status || (Number(course.total) >= 50 ? 'ناجح' : 'راسب');
            courseRowsHtml += `
                <tr>
                    <td class="cc">${course.code || '--'}</td>
                    <td class="cn">${course.name || '--'}</td>
                    <td>${course.credits || '--'}</td>
                    <td>${course.midterm ?? '--'}</td>
                    <td>${course.final ?? '--'}</td>
                    <td><strong>${course.total ?? '--'}</strong></td>
                    <td><span class="gb ${gradeBadgeClass(gradeLabel)}">${gradeLabel}</span></td>
                    <td><span class="sp ${passStatus === 'ناجح' ? 'sp-ok' : 'sp-err'}">${passStatus}</span></td>
                </tr>`;
        });

        const overallGrade = gradeFromTotal(semGpa);

        tbodyHtml += `
        <tr class="acc hidden" id="sem-detail-${index}">
            <td colspan="7" style="padding:0;border-top:none;">
                <div class="acc-inner">
                    <div class="acc-hd">
                        <span class="acc-title">${sem.semesterName} — ${levelLabel}</span>
                        <span class="sp ${pillClass}">${semStatus}</span>
                        <button class="acc-cls" onclick="toggleSemesterDetail(${index})">
                            <span class="material-symbols-outlined">expand_less</span>
                            إخفاء
                        </button>
                    </div>
                    <table class="ctbl">
                        <thead>
                            <tr>
                                <th>رمز المادة</th>
                                <th class="cn">اسم المادة</th>
                                <th>الوحدات</th>
                                <th>أعمال الفصل</th>
                                <th>الامتحان النهائي</th>
                                <th>الدرجة النهائية</th>
                                <th>التقدير</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>${courseRowsHtml}</tbody>
                    </table>
                    <div class="acc-ft">
                        <div class="aft-s"><span class="aft-l">معدل الفصل</span><strong class="aft-v green">${semGpa.toFixed(2)}</strong></div>
                        <div class="aft-s"><span class="aft-l">إجمالي الوحدات</span><strong class="aft-v">${semCredits}</strong></div>
                        <div class="aft-s"><span class="aft-l">حالة الفصل</span><span class="sp ${pillClass}">${semStatus}</span></div>
                        <div class="aft-s"><span class="aft-l">التقدير العام</span><span class="gb ${gradeBadgeClass(overallGrade)}">${overallGrade}</span></div>
                    </div>
                </div>
            </td>
        </tr>`;
    });

    const cgpa = student.cgpa
        ? Number(student.cgpa).toFixed(2)
        : (semestersToUse.length > 0 ? (totalGpaSum / semestersToUse.length).toFixed(2) : '0.00');

    const dispCgpa    = document.getElementById('display-cgpa');
    const dispCredits = document.getElementById('display-total-credits');
    if (dispCgpa)    dispCgpa.innerText    = cgpa;
    if (dispCredits) dispCredits.innerText = student.total_credits || totalCreditsCount;

    wrapper.innerHTML = `
        <div class="sem-tbl-wrap">
            <div class="sem-tbl-hd">
                <span class="material-symbols-outlined">calendar_month</span>
                الفصول الدراسية
            </div>
            <table class="stbl">
                <thead>
                    <tr>
                        <th class="th-n">الفصل الدراسي</th>
                        <th>السنة</th>
                        <th>المواد</th>
                        <th>المعدل الفصلي</th>
                        <th>الوحدات</th>
                        <th>الحالة</th>
                        <th>التفاصيل</th>
                    </tr>
                </thead>
                <tbody>${tbodyHtml}</tbody>
            </table>
        </div>`;

    const transcriptContainer = document.getElementById('transcript-container');
    if (transcriptContainer) {
        transcriptContainer.classList.remove('hidden');
        transcriptContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================================
// 🖨️ طباعة النموذج الرسمي A4 - v3.3
// إطار مستقل لكل صفحة + 8 مستويات + الترتيب التصاعدي
// ============================================================
let _isPrintingTranscript = false;

function printTranscriptReport() {
    if (_isPrintingTranscript) return;
    if (!_currentStudent) {
        alert('يرجى استدعاء السجل الأكاديمي أولاً قبل الطباعة.');
        return;
    }
    _isPrintingTranscript = true;

    const student        = _currentStudent;
    // ترتيب تصاعدي (الفصل 1 👈 المستوى الأول ... الفصل 8 👈 المستوى الثامن)
    const semestersToUse = [...(student.semesters || [])].reverse();
    const logoUrl        = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    const now     = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });

    let totalGpaSum  = 0;
    let totalCredits = 0;
    semestersToUse.forEach(sem => {
        totalGpaSum  += Number(sem.gpa || 0);
        totalCredits += (sem.courses || []).reduce((s, c) => s + (Number(c.credits) || 0), 0);
    });
    const cgpa = student.cgpa
        ? Number(student.cgpa).toFixed(2)
        : (semestersToUse.length > 0 ? (totalGpaSum / semestersToUse.length).toFixed(2) : '0.00');
    const totalCreds = student.total_credits || totalCredits;

    // جلب بيانات المسجل العام المعتمد
    const registrar = getOfficialInfo('general_registrar');
    const registrarName = registrar.name || 'أ. أحمد محمد علي محمود';

    // توليد رابط وبيانات رمز التحقق QR Code الخاص بالطالب المحدد
    const studentIdentifier = student.student_id || student.reg_num || student.id || '';
    const verifyUrl = student.verify_url || `${window.location.origin}/student/verify/${encodeURIComponent(studentIdentifier)}/`;
    let qrDataUrl = '';
    try {
        if (typeof QRCode !== 'undefined') {
            const qrContainer = document.createElement('div');
            new QRCode(qrContainer, {
                text: verifyUrl,
                width: 75,
                height: 75,
                correctLevel: QRCode.CorrectLevel.M
            });
            const qrEl = qrContainer.querySelector('img') || qrContainer.querySelector('canvas');
            if (qrEl) {
                qrDataUrl = qrEl.src || (qrEl.toDataURL ? qrEl.toDataURL() : '');
            }
        }
    } catch (e) {
        console.warn('QR Generation notice:', e);
    }
    if (!qrDataUrl) {
        qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=75x75&data=${encodeURIComponent(verifyUrl)}`;
    }

    // ─── بناء جداول الفصول ───
    let semestersHtml = '';
    semestersToUse.forEach((sem, index) => {
        const semGpa     = Number(sem.gpa || 0);
        const semCourses = sem.courses || [];
        const semCredits = semCourses.reduce((s, c) => s + (Number(c.credits) || 0), 0);
        const semStatus  = sem.status || 'مكتمل';
        const levelLabel = getLevelName(index); // مستوى منفصل لكل فصل (الأول إلى الثامن)

        let courseRowsHtml = '';
        semCourses.forEach((course, ci) => {
            const gradeLabel = course.grade || gradeFromTotal(course.total);
            const passStatus = course.status || (Number(course.total) >= 50 ? 'ناجح' : 'راسب');
            const bg = ci % 2 === 0 ? '#fff' : '#f8fafc';
            courseRowsHtml += `
                <tr style="background:${bg};">
                    <td style="padding:4px 5px;border:1px solid #000;text-align:center;font-family:monospace;font-weight:900;font-size:11px;">${escapeHtml(course.code || '--')}</td>
                    <td style="padding:4px 8px;border:1px solid #000;text-align:right;font-weight:800;font-size:11.5px;">${escapeHtml(course.name || '--')}</td>
                    <td style="padding:4px 4px;border:1px solid #000;text-align:center;font-weight:800;font-size:11px;">${course.credits ?? '--'}</td>
                    <td style="padding:4px 4px;border:1px solid #000;text-align:center;font-weight:700;font-size:11px;">${course.midterm ?? '--'}</td>
                    <td style="padding:4px 4px;border:1px solid #000;text-align:center;font-weight:700;font-size:11px;">${course.final ?? '--'}</td>
                    <td style="padding:4px 4px;border:1px solid #000;text-align:center;font-weight:900;font-size:12px;">${course.total ?? '--'}</td>
                    <td style="padding:4px 4px;border:1px solid #000;text-align:center;font-weight:800;font-size:11px;">${escapeHtml(gradeLabel)}</td>
                    <td style="padding:4px 4px;border:1px solid #000;text-align:center;font-weight:700;font-size:11px;">${escapeHtml(passStatus)}</td>
                </tr>`;
        });

        semestersHtml += `
            <div style="margin-bottom:10px; page-break-inside:avoid;">
                <div style="background:#1e3a5f;color:#fff;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:900;">
                    <span>${escapeHtml(sem.semesterName || 'الفصل ' + (index + 1))} &nbsp;—&nbsp; ${levelLabel}</span>
                    <span style="font-size:11px;font-weight:700;opacity:0.95;">
                        معدل الفصل: ${semGpa.toFixed(2)} &nbsp;|&nbsp; الوحدات: ${semCredits} &nbsp;|&nbsp; ${escapeHtml(semStatus)}
                    </span>
                </div>
                <table style="width:100%;border-collapse:collapse;border:1px solid #000;">
                    <thead>
                        <tr style="background:#e2e8f0;">
                            <th style="padding:4px 5px;border:1px solid #000;font-size:11px;font-weight:900;text-align:center;width:85px;">رمز المادة</th>
                            <th style="padding:4px 8px;border:1px solid #000;font-size:11px;font-weight:900;text-align:right;">اسم المادة الدراسية</th>
                            <th style="padding:4px 5px;border:1px solid #000;font-size:11px;font-weight:900;text-align:center;width:50px;">الوحدات</th>
                            <th style="padding:4px 5px;border:1px solid #000;font-size:11px;font-weight:900;text-align:center;width:65px;">أعمال الفصل</th>
                            <th style="padding:4px 5px;border:1px solid #000;font-size:11px;font-weight:900;text-align:center;width:75px;">الامتحان النهائي</th>
                            <th style="padding:4px 5px;border:1px solid #000;font-size:11px;font-weight:900;text-align:center;width:60px;">المجموع</th>
                            <th style="padding:4px 5px;border:1px solid #000;font-size:11px;font-weight:900;text-align:center;width:60px;">التقدير</th>
                            <th style="padding:4px 5px;border:1px solid #000;font-size:11px;font-weight:900;text-align:center;width:50px;">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>${courseRowsHtml}</tbody>
                </table>
            </div>`;
    });

    // ─── HTML الطباعة مع إطار يلتف حول كل صفحة بصورة كاملة ───
    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>كشف الدرجات التراكمي - ${escapeHtml(student.name)}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

    @page {
        size: A4 portrait;
        margin: 6mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
        font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
        font-size: 11.5px;
        direction: rtl;
        background: #fff;
        color: #000;
        width: 100%;
    }

    /*
     * إطار أسود كامل ومغلق على كل صفحة
     */
    .print-frame {
        border: 2px solid #000000;
        padding: 14px 18px;
        box-sizing: border-box;
        width: 100%;
        min-height: 275mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    /* ─── الترويسة ─── */
    .doc-header { text-align: center; margin-bottom: 6px; }
    .doc-logo   { width: 65px; height: 65px; object-fit: contain; display: block; margin: 0 auto 2px; }
    .doc-gov    { font-size: 11.5px; font-weight: 700; line-height: 1.25; }
    .doc-college { font-size: 14.5px; font-weight: 900; margin-top: 1px; }
    .doc-line   { border-bottom: 1.5px solid #000; margin: 6px 0; }
    .doc-title  { font-size: 17px; font-weight: 900; text-align: center; margin: 5px 0; }

    /* ─── بيانات الطالبة والتاريخ والرقم الإشاري ─── */
    .student-info-block {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin: 8px 0 10px;
        font-size: 12px;
        font-weight: 800;
    }
    .student-info-main {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .info-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .info-lbl { font-weight: 800; white-space: nowrap; }
    .info-val { font-weight: 900; }
    
    .student-info-meta-box {
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-align: left;
        font-size: 12px;
        font-weight: 800;
        min-width: 175px;
    }
    .meta-item {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        white-space: nowrap;
    }
    .meta-lbl {
        font-weight: 900;
        color: #000;
    }
    .meta-val {
        font-weight: 900;
        color: #000;
    }
    .meta-dots {
        letter-spacing: 1px;
        font-weight: 700;
    }

    /* ─── شريط CGPA ─── */
    .cgpa-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f0fdf4;
        border: 1.5px solid #000;
        border-radius: 4px;
        padding: 6px 12px;
        margin-bottom: 10px;
        font-size: 11.5px;
        font-weight: 800;
    }
    .cgpa-num { font-size: 18px; font-weight: 900; color: #16a34a; }

    /* ─── تذييل كشف الدرجات الرسمي (المسجل العام باليمين و QR باليسار) ─── */
    .signatures-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-top: auto;
        padding-top: 14px;
        border-top: 1.5px dashed #000;
        page-break-inside: avoid;
        break-inside: avoid;
        direction: rtl;
        width: 100%;
    }
    .sig-col.right-col {
        text-align: right;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-end;
    }
    .sig-col.left-col {
        text-align: left;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-left: 10px;
    }

    .sig-name {
        font-size: 13px;
        font-weight: 900;
        color: #000;
        margin-bottom: 2px;
        min-height: 16px;
    }
    .sig-title {
        font-size: 12px;
        font-weight: 800;
        color: #111;
        margin-bottom: 12px;
    }
    .sig-line {
        font-size: 12px;
        font-weight: 800;
        color: #000;
        letter-spacing: 0.5px;
    }

    .qr-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
    }
    .qr-img {
        width: 72px;
        height: 72px;
        object-fit: contain;
        display: block;
        margin: 0 auto 3px auto;
        border: 1px solid #000;
        border-radius: 4px;
        padding: 2px;
        background: #fff;
    }
    .qr-label {
        font-size: 9.5px;
        font-weight: 800;
        color: #000;
    }

    @media print {
        @page { size: A4 portrait; margin: 4mm; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-frame {
            border: 2px solid #000000 !important;
            min-height: 280mm;
        }
    }
</style>
</head>
<body>
<div class="print-frame">
    <div>
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
                <img class="doc-logo" src="${logoUrl}" alt="شعار الكلية" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.onerror=null;this.style.display='none';">
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
        <div class="doc-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">كشف الدرجات التراكمي الشامل</div>

        <!-- بيانات الطالبة: الاسم والقيد والتخصص باليمين، والرقم الإشاري والتاريخ باليسار بجانب بعضهما -->
        <div class="student-info-block">
            <div class="student-info-main">
                <div class="info-row">
                    <span class="info-lbl">اسم الطالبة الكامل /</span>
                    <span class="info-val">${escapeHtml(student.name)}</span>
                </div>
                <div class="info-row">
                    <span class="info-lbl">رقم القيد /</span>
                    <span class="info-val">${escapeHtml(student.reg_num)}</span>
                </div>
                <div class="info-row">
                    <span class="info-lbl">القسم / التخصص /</span>
                    <span class="info-val">${escapeHtml(student.major)}</span>
                </div>
            </div>
            <div class="student-info-meta-box">
                <div class="meta-item">
                    <span class="meta-lbl">الرقم الإشاري:</span>
                    <span class="meta-dots">................................</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">التاريخ:</span>
                    <span class="meta-val">${dateStr}</span>
                </div>
            </div>
        </div>

        <!-- شريط الملخص التراكمي -->
        <div class="cgpa-banner">
            <div>
                إجمالي الوحدات المعتمدة:
                <strong style="font-size:14px;margin-right:4px;">${totalCreds}</strong> وحدة
            </div>
            <div>
                الوضع الأكاديمي:
                <strong style="margin-right:4px;">${escapeHtml(student.academic_status || 'مستمرة')}</strong>
            </div>
            <div>
                المعدل التراكمي (CGPA):
                <span class="cgpa-num">${cgpa}</span>
            </div>
        </div>

        <!-- جداول الفصول الدراسية (مرتبة تصاعدياً من 1 إلى 8) -->
        ${semestersHtml}
    </div>

    <!-- التوقيعات وتذييل الكشف الرسمي (المسجل العام باليمين و QR Code باليسار) -->
    <div class="signatures-row">
        <!-- جهة اليمين: توقيع واعتماد المسجل العام فقط -->
        <div class="sig-col right-col">
            <div class="sig-name">${escapeHtml(registrarName)}</div>
            <div class="sig-title">المسجل العام بالكلية</div>
            <div class="sig-line">التوقيع والختم: ................................</div>
        </div>

        <!-- جهة اليسار: رمز الاستجابة السريعة (QR Code) للتحقق -->
        <div class="sig-col left-col">
            <div class="qr-box">
                <img class="qr-img" src="${qrDataUrl}" alt="رمز التحقق QR" onerror="this.onerror=null;this.style.display='none';">
                <span class="qr-label">رمز التحقق من صحة المستند</span>
            </div>
        </div>
    </div>

</div>
<script>
    window.onload = function() {
        setTimeout(function() { window.print(); }, 300);
    };
<\/script>
</body>
</html>`;

    // iframe للطباعة
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
        _isPrintingTranscript = false;
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 5000);
}

window.printTranscriptReport = printTranscriptReport;

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.generateFullTranscript  = generateFullTranscript;
window.liveSearchTranscript    = liveSearchTranscript;
window.selectTranscriptStudent = selectTranscriptStudent;
window.filterTranscriptByDept  = filterTranscriptByDept;
window.toggleSemesterDetail    = toggleSemesterDetail;

function initPage() { console.log('🚀 Cumulative grades page v3.3 ready'); }
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}