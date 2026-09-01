// ============================================================
// grade_appeals.js v1.0.3 - إدارة طعون النتائج وتعديل الدرجات
// ============================================================

let currentAppealsList = [];
let activeEditAppealId = null;

// ============================================================
// صلاحية خدمة الطعون
// ============================================================

function applyAppealsPermissionUI(isOpen, message) {
    const isJobOpen = (typeof isOpen !== 'undefined') ? Boolean(isOpen) : Boolean(window.IS_GRADE_APPEALS_JOB_OPEN);
    const displayMsg = message || window.GRADE_APPEALS_JOB_MESSAGE || '⚠️ خدمة "الطعون" غير مفعلة حالياً';

    const banner     = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');
    if (banner) {
        if (!isJobOpen) { if (bannerText) bannerText.textContent = displayMsg; banner.style.display = 'flex'; }
        else banner.style.display = 'none';
    }

    const staticBtns = ['btn-open-create-modal','btn-fetch-appeals','btn-save-create-appeal','btn-save-edit-grade'];
    staticBtns.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (!isJobOpen) {
            btn.disabled = true;
            btn.style.setProperty('opacity','0.5','important');
            btn.style.setProperty('cursor','not-allowed','important');
            btn.style.setProperty('pointer-events','none','important');
            btn.style.setProperty('filter','grayscale(80%)','important');
            btn.title = displayMsg;
        } else {
            btn.disabled = false;
            btn.style.setProperty('opacity','1','important');
            btn.style.setProperty('cursor','pointer','important');
            btn.style.setProperty('pointer-events','auto','important');
            btn.style.setProperty('filter','none','important');
            btn.title = '';
        }
    });

    const filterIds = ['department-select','semester-select','level-select','course-select','status-select','search-input'];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !isJobOpen;
        el.style.setProperty('opacity', isJobOpen ? '1' : '0.6', 'important');
    });

    document.querySelectorAll('.btn-act, .btn-act-review, .btn-act-edit, .btn-act-reject').forEach(btn => {
        btn.disabled = !isJobOpen;
        btn.style.setProperty('opacity', isJobOpen ? '1' : '0.5', 'important');
        btn.style.setProperty('cursor', isJobOpen ? 'pointer' : 'not-allowed', 'important');
        btn.style.setProperty('pointer-events', isJobOpen ? 'auto' : 'none', 'important');
        if (!isJobOpen) btn.title = displayMsg;
    });
}

function updateJobPermissionState() {
    const isOpen  = Boolean(window.IS_GRADE_APPEALS_JOB_OPEN);
    const message = window.GRADE_APPEALS_JOB_MESSAGE || '';
    applyAppealsPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', { method:'GET', headers:{'X-Requested-With':'XMLHttpRequest'} })
        .then(r => r.json())
        .then(data => {
            if (data && data.success) {
                window.IS_GRADE_APPEALS_JOB_OPEN = Boolean(data.is_grade_appeals_job_open);
                window.GRADE_APPEALS_JOB_MESSAGE = data.grade_appeals_job_message || '';
                applyAppealsPermissionUI(window.IS_GRADE_APPEALS_JOB_OPEN, window.GRADE_APPEALS_JOB_MESSAGE);
            }
        })
        .catch(err => console.warn('⚠️ Permission check error:', err));
}
window.updateJobPermissionState = updateJobPermissionState;

// ============================================================
// تهيئة الصفحة
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Grade Appeals Module v1.0.3...');

    document.getElementById('btn-fetch-appeals')?.addEventListener('click', fetchAppeals);
    document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
    document.getElementById('btn-open-create-modal')?.addEventListener('click', openCreateModal);
    document.getElementById('btn-save-create-appeal')?.addEventListener('click', saveCreateAppeal);
    document.getElementById('btn-save-edit-grade')?.addEventListener('click', saveEditGrade);

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(fetchAppeals, 350); });
    }

    ['create-appeal-modal','edit-grade-modal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    });

    updateJobPermissionState();
    fetchAppeals();
});

// ============================================================
// جلب قائمة الطعون
// ============================================================

function fetchAppeals() {
    const semesterId   = document.getElementById('semester-select')?.value   || '';
    const departmentId = document.getElementById('department-select')?.value || '';
    const levelId      = document.getElementById('level-select')?.value      || '';
    const courseId     = document.getElementById('course-select')?.value     || '';
    const status       = document.getElementById('status-select')?.value     || '';
    const search       = document.getElementById('search-input')?.value.trim() || '';

    const tbody = document.getElementById('appeals-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="table-empty-state"><span class="material-symbols-outlined empty-icon spin">sync</span><p>جاري تحديث كشف الطعون...</p></td></tr>`;

    fetch(`/grades/api/appeals/?semester_id=${encodeURIComponent(semesterId)}&department_id=${encodeURIComponent(departmentId)}&level_id=${encodeURIComponent(levelId)}&course_id=${encodeURIComponent(courseId)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.appeals) {
                currentAppealsList = data.appeals;
                renderAppealsTable(currentAppealsList);
                updateStats(currentAppealsList);
            } else {
                showToast(data.message || 'حدث خطأ أثناء جلب قائمة الطعون', true);
                if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="table-empty-state">❌ ${escapeHtml(data.message || 'فشل جلب الطعون')}</td></tr>`;
            }
        })
        .catch(err => {
            console.error(err);
            showToast('حدث خطأ في الاتصال بالخادم', true);
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" class="table-empty-state">❌ حدث خطأ في الاتصال</td></tr>`;
        });
}

// ============================================================
// رسم جدول الطعون
// ============================================================

function renderAppealsTable(appeals) {
    const tbody    = document.getElementById('appeals-table-body');
    const badge    = document.getElementById('table-count-badge');
    const isJobOpen = Boolean(window.IS_GRADE_APPEALS_JOB_OPEN);
    if (badge) badge.textContent = `${appeals.length} طعن`;
    if (!tbody) return;

    if (!appeals || appeals.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="table-empty-state"><span class="material-symbols-outlined empty-icon">rule</span><p>لا توجد طعونات مسجلة مطابقة لمعايير البحث الحالية</p></td></tr>`;
        return;
    }

    tbody.innerHTML = appeals.map((app, idx) => {
        let badgeClass = 'badge-pending';
        if (app.status === 'under_review') badgeClass = 'badge-under-review';
        if (app.status === 'completed')    badgeClass = 'badge-completed';
        if (app.status === 'rejected')     badgeClass = 'badge-rejected';

        const dis     = !isJobOpen ? 'disabled style="opacity:0.5!important;cursor:not-allowed!important;"' : '';
        const disCls  = !isJobOpen ? 'opacity-50 pointer-events-none cursor-not-allowed' : '';

        let currentGradeText = `نصفي: ${app.current_midterm_grade} | نهائي: ${app.current_final_grade}`;
        if (app.status === 'completed') {
            const m = app.new_midterm_grade !== null ? app.new_midterm_grade : app.current_midterm_grade;
            const f = app.new_final_grade   !== null ? app.new_final_grade   : app.current_final_grade;
            currentGradeText = `نصفي: ${m} | نهائي: ${f}`;
        }

        // صف الإجراءات
        let actionsHtml = '';
        const canEditAppeals = (typeof window.CAN_EDIT_APPEALS === 'undefined' || window.CAN_EDIT_APPEALS === true);
        if (!canEditAppeals) {
            actionsHtml = `<span class="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-bold"><span class="material-symbols-outlined text-sm">visibility</span> عرض فقط</span>`;
        } else if (app.status === 'pending') {
            actionsHtml = `
                <button type="button" class="btn-act btn-act-review ${disCls}" ${dis} onclick="updateAppealStatus(${app.appeal_id},'under_review')">
                    <span class="material-symbols-outlined">pending</span> جاري التعديل
                </button>
                <button type="button" class="btn-act btn-act-edit ${disCls}" ${dis} onclick="openEditModal(${app.appeal_id},'${escapeJsString(app.student_name)}','${escapeJsString(app.course_code)} - ${escapeJsString(app.course_name)}',${app.current_midterm_grade},${app.current_final_grade})">
                    <span class="material-symbols-outlined">edit_square</span> تم تعديل ورصد
                </button>
                <button type="button" class="btn-act btn-act-reject ${disCls}" ${dis} onclick="updateAppealStatus(${app.appeal_id},'rejected')">
                    <span class="material-symbols-outlined">cancel</span> رفض
                </button>`;
        } else if (app.status === 'under_review') {
            actionsHtml = `
                <button type="button" class="btn-act btn-act-edit ${disCls}" ${dis} onclick="openEditModal(${app.appeal_id},'${escapeJsString(app.student_name)}','${escapeJsString(app.course_code)} - ${escapeJsString(app.course_name)}',${app.current_midterm_grade},${app.current_final_grade})">
                    <span class="material-symbols-outlined">verified</span> تم تعديل ورصد 🟢
                </button>
                <button type="button" class="btn-act btn-act-reject ${disCls}" ${dis} onclick="updateAppealStatus(${app.appeal_id},'rejected')">
                    <span class="material-symbols-outlined">cancel</span> رفض
                </button>`;
        } else if (app.status === 'completed') {
            actionsHtml = `<span class="text-green font-bold" style="font-size:0.8rem;">✅ تم تعديل الدرجة بكشف الطالب</span>`;
        } else {
            actionsHtml = `<span class="text-muted" style="font-size:0.8rem;">تم الإغلاق (مرفوض)</span>`;
        }

        return `
            <tr id="row-appeal-${app.appeal_id}">
                <td class="text-center font-bold">${idx + 1}</td>
                <td class="font-bold text-primary">${escapeHtml(app.student_id)}</td>
                <td class="font-semibold">${escapeHtml(app.student_name)}</td>
                <td>${escapeHtml(app.department_name)} / مـ ${escapeHtml(app.level_number)}</td>
                <td class="font-medium">${escapeHtml(app.course_name)} (${escapeHtml(app.course_code)})</td>
                <td class="text-center font-bold">${escapeHtml(app.appeal_type_display)}</td>
                <td class="text-center font-bold" style="font-size:0.85rem;">${escapeHtml(currentGradeText)}</td>
                <td class="text-center"><span class="badge-status ${badgeClass}">${escapeHtml(app.status_display)}</span></td>
                <!-- ✅ زر نموذج الطباعة -->
                <td class="text-center">
                    <button type="button" class="btn-act"
                            style="background:#b59b66;color:white;padding:4px 8px;border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;display:inline-flex;align-items:center;gap:4px;"
                            onclick="printAppealForm(${app.appeal_id})"
                            title="طباعة نموذج الطعن">
                        <span class="material-symbols-outlined" style="font-size:15px;">print</span>
                    </button>
                </td>
                <td class="text-center">
                    <div class="actions-group">${actionsHtml}</div>
                </td>
            </tr>`;
    }).join('');

    applyAppealsPermissionUI(isJobOpen);
}

// ============================================================
// تحديث حالة طعن
// ============================================================

function updateAppealStatus(appealId, newStatus) {
    if (!window.IS_GRADE_APPEALS_JOB_OPEN) { showToast(window.GRADE_APPEALS_JOB_MESSAGE || '⚠️ الخدمة موقوفة', true); return; }
    fetch('/grades/api/appeals/update-status/', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ appeal_id: appealId, status: newStatus })
    })
    .then(r => r.json())
    .then(data => { showToast(data.message || 'تم تحديث الحالة', !data.success); if (data.success) fetchAppeals(); })
    .catch(() => showToast('حدث خطأ في الاتصال', true));
}

// ============================================================
// نافذة تسجيل طعن جديد
// ============================================================

function openCreateModal() {
    if (!window.IS_GRADE_APPEALS_JOB_OPEN) { showToast(window.GRADE_APPEALS_JOB_MESSAGE || '⚠️ الخدمة موقوفة', true); return; }
    document.getElementById('create-appeal-modal')?.classList.remove('hidden');
}
window.openCreateModal = openCreateModal;

function closeCreateModal() {
    document.getElementById('create-appeal-modal')?.classList.add('hidden');
    document.getElementById('modal-student-query').value = '';
    document.getElementById('modal-notes-input').value   = '';
}
window.closeCreateModal = closeCreateModal;

function saveCreateAppeal() {
    if (!window.IS_GRADE_APPEALS_JOB_OPEN) { showToast(window.GRADE_APPEALS_JOB_MESSAGE || '⚠️ الخدمة موقوفة', true); return; }
    const studentQuery = document.getElementById('modal-student-query')?.value.trim();
    const courseId     = document.getElementById('modal-course-select')?.value;
    const semesterId   = document.getElementById('modal-semester-select')?.value;
    const appealType   = document.getElementById('modal-type-select')?.value || 'midterm';
    const notes        = document.getElementById('modal-notes-input')?.value.trim();
    if (!studentQuery || !courseId || !semesterId) { showToast('يرجى إدخال رقم القيد وتحديد المادة والموسم', true); return; }
    fetch('/grades/api/appeals/create/', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ student_id: studentQuery, course_id: courseId, semester_id: semesterId, appeal_type: appealType, notes })
    })
    .then(r => r.json())
    .then(data => { showToast(data.message || 'تم تسجيل الطعن', !data.success); if (data.success) { closeCreateModal(); fetchAppeals(); } })
    .catch(() => showToast('حدث خطأ في الاتصال', true));
}

// ============================================================
// نافذة تعديل الدرجة
// ============================================================

function openEditModal(appealId, studentName, courseFullName, prevMidterm, prevFinal) {
    if (!window.IS_GRADE_APPEALS_JOB_OPEN) { showToast(window.GRADE_APPEALS_JOB_MESSAGE || '⚠️ الخدمة موقوفة', true); return; }
    activeEditAppealId = appealId;
    document.getElementById('edit-student-name').textContent = studentName;
    document.getElementById('edit-course-name').textContent  = courseFullName;
    document.getElementById('edit-prev-midterm').textContent = prevMidterm;
    document.getElementById('edit-prev-final').textContent   = prevFinal;
    document.getElementById('edit-midterm-grade').value = prevMidterm || 0;
    document.getElementById('edit-final-grade').value   = prevFinal   || 0;
    document.getElementById('edit-notes-input').value   = '';
    document.getElementById('edit-grade-modal')?.classList.remove('hidden');
}
window.openEditModal = openEditModal;

function closeEditModal() {
    document.getElementById('edit-grade-modal')?.classList.add('hidden');
    activeEditAppealId = null;
}
window.closeEditModal = closeEditModal;

function saveEditGrade() {
    if (!window.IS_GRADE_APPEALS_JOB_OPEN) { showToast(window.GRADE_APPEALS_JOB_MESSAGE || '⚠️ الخدمة موقوفة', true); return; }
    if (!activeEditAppealId) return;
    fetch('/grades/api/appeals/update-grade/', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({
            appeal_id:       activeEditAppealId,
            new_midterm_grade: document.getElementById('edit-midterm-grade')?.value,
            new_final_grade:   document.getElementById('edit-final-grade')?.value,
            notes:             document.getElementById('edit-notes-input')?.value.trim()
        })
    })
    .then(r => r.json())
    .then(data => { showToast(data.message || 'تم تعديل الدرجة', !data.success); if (data.success) { closeEditModal(); fetchAppeals(); } })
    .catch(() => showToast('حدث خطأ في الاتصال', true));
}

// ============================================================
// 🖨️ طباعة نموذج الطعن الفردي
// ============================================================

function printAppealForm(appealId) {
    // إيجاد بيانات الطعن من القائمة المحملة
    const app = currentAppealsList.find(a => a.appeal_id === appealId);
    if (!app) { showToast('⚠️ لم يتم العثور على بيانات الطعن', true); return; }

    const logoUrl  = window.COLLEGE_LOGO_URL || '';
    const now      = new Date();
    const dateStr  = now.toLocaleDateString('ar-LY', { year:'numeric', month:'2-digit', day:'2-digit' });

    // الدرجة قبل الطعن (النهائي)
    const gradeBeforeAppeal = app.current_final_grade !== null && app.current_final_grade !== undefined
        ? app.current_final_grade : '___';
    // الدرجة بعد الطعن (تُملأ يوم الطعن)
    const gradeAfterAppeal = (app.status === 'completed' && app.new_final_grade !== null)
        ? app.new_final_grade : '___';
    const appealReason = app.notes || '___________________________________';
    const professorSig = '___________________';

    const html = `
<div class="ap-page">
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
            <img class="ap-logo" src="${logoUrl}" alt="شعار الكلية" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.style.display='none'">
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
    <div class="ap-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">نموذج طعن في نتائج الامتحانات</div>

    <!-- بيانات الطالب -->
    <div class="ap-student-grid">
        <div class="ap-field"><span class="ap-lbl">الاسم الرباعي الكامل:</span>
            <span class="ap-val">${escapeHtml(app.student_name)}</span></div>
        <div class="ap-field"><span class="ap-lbl">رقم القيد:</span>
            <span class="ap-val">${escapeHtml(app.student_id)}</span></div>
        <div class="ap-field"><span class="ap-lbl">التخصص:</span>
            <span class="ap-val">${escapeHtml(app.department_name)}</span></div>
        <div class="ap-field"><span class="ap-lbl">المستوى:</span>
            <span class="ap-val">${escapeHtml(app.level_number || '-')}</span></div>
        <div class="ap-field"><span class="ap-lbl">الفصل الدراسي:</span>
            <span class="ap-val">${escapeHtml(app.semester_display || '-')}</span></div>
        <div class="ap-field"><span class="ap-lbl">التاريخ:</span>
            <span class="ap-val">${dateStr}</span></div>
    </div>

    <!-- نص تعريفي -->
    <div class="ap-intro">
        أتقدم أنا الطالب/ة المذكور/ة بياناته/ا أعلاه بطعن في نتيجة الامتحان للمادة/المواد الآتية
        (لا تتجاوز مادتين)، وأطلب مراجعتها وفق الإجراءات المعتمدة:
    </div>

    <!-- جدول المواد المطعون فيها -->
    <table class="ap-table">
        <thead>
            <tr>
                <th style="width:8%">م</th>
                <th style="width:22%">اسم المادة</th>
                <th style="width:18%">أستاذ المادة</th>
                <th style="width:14%">درجة النهائي<br>قبل الطعن</th>
                <th style="width:14%">درجة النهائي<br>بعد الطعن *</th>
                <th style="width:16%">السبب</th>
                <th style="width:8%">توقيع<br>الأستاذ</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>1</td>
                <td class="subject-name">${escapeHtml(app.course_name)}<br><small style="color:#555;">${escapeHtml(app.course_code)}</small></td>
                <td>${escapeHtml(app.instructor_name || '____________________')}</td>
                <td style="font-weight:bold;">${escapeHtml(String(gradeBeforeAppeal))}</td>
                <td class="after-grade" style="font-weight:bold;">${app.status === 'completed' ? escapeHtml(String(gradeAfterAppeal)) : ''}</td>
                <td class="reason-cell">${app.status === 'completed' ? escapeHtml(app.resolution_notes || 'تبقى كما هي') : ''}</td>
                <td>${app.status === 'completed' ? '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;✓' : ''}</td>
            </tr>
            <!-- صف فارغ للمادة الثانية -->
            <tr class="empty-row">
                <td>2</td>
                <td class="subject-name"></td>
                <td></td>
                <td></td>
                <td class="after-grade"></td>
                <td class="reason-cell"></td>
                <td></td>
            </tr>
        </tbody>
    </table>
    <div style="font-size:11px;margin-bottom:14px;">* تُملأ خانة "الدرجة بعد الطعن" من قِبَل الأستاذ يوم المراجعة الحضورية</div>

    <!-- إقرار الطالب وتوقيعه -->
    <div class="ap-student-sig">
        <div style="font-weight:bold;margin-bottom:6px;">إقرار الطالب/ة بصحة البيانات:</div>
        <div>أُقرّ أنا الطالب/ة بصحة البيانات المدوّنة أعلاه وأن طعني مقدَّم وفق اللوائح الأكاديمية المعتمدة بالكلية.</div>
        <div class="ap-student-sig-line">
            <div class="ap-sig-block">
                <div class="ap-sig-line-dots"></div>
                <div>توقيع الطالب/ة</div>
            </div>
            <div class="ap-sig-block">
                <div style="font-size:12px;color:#555;">رقم الوصل / الإيصال المالي</div>
                <div class="ap-sig-line-dots"></div>
            </div>
        </div>
    </div>

    <!-- قسم الأستاذ يوم الطعن (يُكمله الأستاذ) -->
    <div class="ap-prof-section">
        <div class="ap-prof-title">🗓️ يُكمَل من قِبَل الأستاذ يوم المراجعة الحضورية:</div>
        <div class="ap-prof-row">
            <div class="ap-prof-field">
                <div style="font-weight:bold;margin-bottom:4px;">الدرجة بعد المراجعة:</div>
                <div style="border-bottom:1px solid #000;min-width:120px;height:22px;"></div>
            </div>
            <div class="ap-prof-field" style="flex:2;">
                <div style="font-weight:bold;margin-bottom:4px;">سبب التعديل / القرار:</div>
                <div style="border-bottom:1px solid #000;min-width:200px;height:22px;"></div>
            </div>
            <div class="ap-prof-field">
                <div style="font-weight:bold;margin-bottom:4px;">توقيع الأستاذ:</div>
                <div style="border-bottom:1px solid #000;min-width:100px;height:22px;"></div>
            </div>
        </div>
        <div style="font-size:11px;color:#444;">ملاحظة: في حال عدم تغيير الدرجة يُكتب "تبقى كما هي" في خانة السبب.</div>
    </div>

    <!-- ختم اللجنة -->
    <div class="ap-committee">
        <div style="font-weight:bold;margin-bottom:6px;">ختم لجنة الطعون ومراجعة الدرجات</div>
        <div style="height:60px;border:1px dashed #999;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;">
            مكان الختم الرسمي للجنة
        </div>
    </div>

    <!-- توقيع منسق الدراسة والامتحانات -->
    <div style="margin-top:auto;padding-top:20px;text-align:left;margin-left:20px;" data-official="exams_coordinator">
        <span class="off-name" style="display:block;font-size:13px;font-weight:bold;min-height:1.3em;"></span>
        <span class="off-pos" style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">منسق الدراسة والامتحانات</span>
        <span style="display:block;font-size:12px;letter-spacing:1px;">التوقيع والختم: ....................................</span>
    </div>
</div>`;

    ensurePrintContainerInBody('printAppealFormContainer');
    const container = document.getElementById('printAppealFormContainer');
    container.innerHTML = html;

    // إخفاء حاوية الحصر لو ظهرت
    const summaryContainer = document.getElementById('printSummaryReportContainer');
    if (summaryContainer) summaryContainer.innerHTML = '';

    // جلب اسم المسجل العام إن وُجد
    const doPrint = () => window.print();
    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') res.then(doPrint).catch(doPrint);
            else setTimeout(doPrint, 300);
        } catch (e) { doPrint(); }
    } else { doPrint(); }
}
window.printAppealForm = printAppealForm;

// ============================================================
// 🖨️ طباعة كشف الحصر (نموذج ملخص كل الطعون)
// ============================================================

function printSummaryReport() {
    if (!currentAppealsList || currentAppealsList.length === 0) {
        showToast('⚠️ لا توجد طعونات محملة في الجدول', true);
        return;
    }

    const logoUrl = window.COLLEGE_LOGO_URL || '';
    const now     = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year:'numeric', month:'2-digit', day:'2-digit' });

    // معلومات الفلاتر الحالية
    const deptEl    = document.getElementById('department-select');
    const semEl     = document.getElementById('semester-select');
    const deptName  = (deptEl && deptEl.selectedIndex > 0) ? deptEl.options[deptEl.selectedIndex].text : 'جميع التخصصات';
    const semName   = (semEl  && semEl.selectedIndex  > 0) ? semEl.options[semEl.selectedIndex].text   : 'جميع المواسم';

    const rows = currentAppealsList.map((app, idx) => {
        const gradeAfter = (app.status === 'completed' && app.new_final_grade !== null)
            ? app.new_final_grade : '___';
        const reason = app.resolution_notes || app.notes || '---';
        const status = app.status_display || '---';
        return `
            <tr>
                <td>${idx + 1}</td>
                <td class="name-cell">${escapeHtml(app.student_name)}</td>
                <td>${escapeHtml(app.student_id)}</td>
                <td class="name-cell">${escapeHtml(app.course_name)}</td>
                <td>${escapeHtml(String(app.current_final_grade))}</td>
                <td style="font-weight:bold;">${escapeHtml(String(gradeAfter))}</td>
                <td class="name-cell">${escapeHtml(reason)}</td>
                <td>${escapeHtml(status)}</td>
            </tr>`;
    }).join('');

    const html = `
<div class="ap-page">
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
            <img class="ap-logo" src="${logoUrl}" alt="شعار الكلية" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.style.display='none'">
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
    <div class="ap-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">كشف حصر طعونات نتائج الامتحانات</div>

    <!-- معلومات الكشف -->
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:12px;font-weight:600;">
        <div>التخصص: <span style="font-weight:bold;">${escapeHtml(deptName)}</span></div>
        <div>الموسم الدراسي: <span style="font-weight:bold;">${escapeHtml(semName)}</span></div>
        <div>التاريخ: <span style="font-weight:bold;">${dateStr}</span></div>
        <div>عدد الطعون: <span style="font-weight:bold;">${currentAppealsList.length}</span></div>
    </div>

    <!-- جدول الحصر -->
    <table class="sr-table">
        <thead>
            <tr>
                <th style="width:5%">م</th>
                <th style="width:20%">اسم الطالب</th>
                <th style="width:12%">رقم القيد</th>
                <th style="width:18%">المادة</th>
                <th style="width:10%">الدرجة<br>قبل الطعن</th>
                <th style="width:10%">الدرجة<br>بعد الطعن</th>
                <th style="width:17%">السبب / القرار</th>
                <th style="width:8%">الحالة</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>

    <!-- توقيع منسق الدراسة والامتحانات -->
    <div style="margin-top:auto;padding-top:24px;text-align:left;margin-left:20px;" data-official="exams_coordinator">
        <span class="off-name" style="display:block;font-size:13px;font-weight:bold;min-height:1.3em;"></span>
        <span class="off-pos" style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">منسق الدراسة والامتحانات</span>
        <span style="display:block;font-size:12px;letter-spacing:1px;">التوقيع والختم: ....................................</span>
    </div>
</div>`;

    // إخفاء نموذج الطعن الفردي
    const formContainer = document.getElementById('printAppealFormContainer');
    if (formContainer) formContainer.innerHTML = '';

    ensurePrintContainerInBody('printSummaryReportContainer');
    const container = document.getElementById('printSummaryReportContainer');
    container.innerHTML = html;

    const doPrint = () => window.print();
    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') res.then(doPrint).catch(doPrint);
            else setTimeout(doPrint, 300);
        } catch (e) { doPrint(); }
    } else { doPrint(); }
}
window.printSummaryReport = printSummaryReport;

// ============================================================
// دوال مساعدة
// ============================================================

function ensurePrintContainerInBody(containerId) {
    const container = document.getElementById(containerId);
    if (container && container.parentNode !== document.body) document.body.appendChild(container);
}

function updateStats(appeals) {
    const total       = appeals ? appeals.length : 0;
    const underReview = appeals ? appeals.filter(a => a.status === 'under_review' || a.status === 'pending').length : 0;
    const completed   = appeals ? appeals.filter(a => a.status === 'completed').length : 0;
    const el = id => document.getElementById(id);
    if (el('stat-total-appeals'))    el('stat-total-appeals').textContent   = total;
    if (el('stat-review-appeals'))   el('stat-review-appeals').textContent  = underReview;
    if (el('stat-completed-appeals'))el('stat-completed-appeals').textContent = completed;
}

function resetFilters() {
    ['department-select','semester-select','level-select','course-select','status-select'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const si = document.getElementById('search-input');
    if (si) si.value = '';
    fetchAppeals();
}

function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `pub-toast ${isError ? 'pub-toast-error' : 'pub-toast-success'}`;
    toast.innerHTML = `<span class="material-symbols-outlined">${isError ? 'error' : 'verified'}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function escapeJsString(str) {
    if (!str) return '';
    return String(str).replace(/'/g,"\\'").replace(/"/g,'\\"');
}

function getCookie(name) {
    let v = null;
    if (document.cookie) {
        document.cookie.split(';').forEach(c => {
            c = c.trim();
            if (c.startsWith(name + '=')) v = decodeURIComponent(c.substring(name.length + 1));
        });
    }
    return v;
}

console.log('✅ grade_appeals.js v1.0.3 ready');