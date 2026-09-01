// ============================================
// تنزيل مواد (حالة خاصة) - special_download.js v1.0.23
// ============================================

console.log('✅ special_download.js v1.0.23 loaded successfully');

let selectedStudentId = null;
let selectedStudentData = null;
let availableCourses = [];

// ============================================================
// دوال مساعدة
// ============================================================

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const c = cookies[i].trim();
            if (c.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(c.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// ============================================================
// 🔔 نظام الإشعارات العائمة الموحد (showNotification)
// ============================================================
function showNotification(type, message) {
    const toast = document.getElementById('toastNotification');
    const iconCircle = document.getElementById('toastIconCircle');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    if (!toast || !icon || !msg) {
        console.warn('⚠️ Toast Notification elements not found:', type, message);
        return;
    }
    
    msg.innerText = message;
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    
    // ضبط لون وخلفية البطاقة حسب النمط الليلي / النهاري
    if (isDark) {
        toast.style.background = '#1e293b';
        toast.style.backgroundColor = '#1e293b';
        toast.style.boxShadow = '0 14px 45px rgba(0, 0, 0, 0.7)';
        msg.style.color = '#f8fafc';
    } else {
        toast.style.background = '#ffffff';
        toast.style.backgroundColor = '#ffffff';
        toast.style.boxShadow = '0 12px 35px -5px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)';
        msg.style.color = '#1e293b';
    }
    
    if (type === 'success') {
        toast.style.borderRight = '4.5px solid #10b981';
        toast.style.borderRightColor = '#10b981';
        icon.innerText = "check_circle";
        icon.style.color = '#10b981';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)';
        }
    } else if (type === 'warning') {
        toast.style.borderRight = '4.5px solid #f59e0b';
        toast.style.borderRightColor = '#f59e0b';
        icon.innerText = "warning";
        icon.style.color = '#f59e0b';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)';
        }
    } else if (type === 'info') {
        toast.style.borderRight = '4.5px solid #3b82f6';
        toast.style.borderRightColor = '#3b82f6';
        icon.innerText = "info";
        icon.style.color = '#3b82f6';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)';
        }
    } else {
        toast.style.borderRight = '4.5px solid #e11d48';
        toast.style.borderRightColor = '#e11d48';
        icon.innerText = "error";
        icon.style.color = '#e11d48';
        if (iconCircle) {
            iconCircle.style.background = isDark ? 'rgba(225, 29, 72, 0.2)' : 'rgba(225, 29, 72, 0.12)';
        }
    }
    
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    
    clearTimeout(window.notificationTimeout);
    window.notificationTimeout = setTimeout(() => {
        toast.style.transform = 'translateY(80px)';
        toast.style.opacity = '0';
    }, 4000);
}

window.showNotification = showNotification;
window.toastSuccess = (msg) => showNotification('success', msg);
window.toastError = (msg) => showNotification('error', msg);
window.toastWarning = (msg) => showNotification('warning', msg);
window.toastInfo = (msg) => showNotification('info', msg);
window.showToastMessage = (message, isError = false, type = null) => {
    if (type) {
        showNotification(type, message);
    } else {
        showNotification(isError ? 'error' : 'success', message);
    }
};

// ============================================================
// البحث عن طالب
// ============================================================

function searchStudentForDownload() {
    const isDownloadOpen = (typeof window.IS_DOWNLOAD_JOB_OPEN !== 'undefined') ? Boolean(window.IS_DOWNLOAD_JOB_OPEN) : false;
    if (!isDownloadOpen) {
        showNotification('error', window.DOWNLOAD_JOB_MESSAGE || '⚠️ خدمة تنزيل المواد موقوفة حالياً.');
        return;
    }
    const query = document.getElementById('searchStudentInput')?.value.trim();
    if (!query) { showNotification('warning', '⚠️ الرجاء إدخال رقم قيد أو اسم الطالب'); return; }

    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '<div class="autocomplete-item" style="color:#94a3b8;cursor:default;padding:10px;">⏳ جاري البحث...</div>';
    resultsContainer.classList.remove('hidden');

    fetch(`/renewal/api/search-student-for-download/?search=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.students && data.students.length > 0) {
                resultsContainer.innerHTML = data.students.map(s => `
                    <div class="autocomplete-item" onclick="selectStudentForDownload(${s.id})" style="padding:10px 15px;cursor:pointer;border-bottom:1px solid #f1f5f9;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <strong>${escapeHtml(s.name)}</strong>
                                <span style="font-size:0.75rem;color:#64748b;margin-right:10px;">رقم القيد: ${escapeHtml(s.student_id)}</span>
                            </div>
                            <span style="font-size:0.7rem;color:${s.can_download ? '#0f766e' : '#e11d48'};font-weight:bold;">
                                ${s.can_download ? '✅' : '⛔'} ${escapeHtml(s.status_message || (s.can_download ? 'نشط' : 'غير نشط'))}
                            </span>
                        </div>
                        <div style="font-size:0.7rem;color:#94a3b8;margin-top:4px;">
                            ${escapeHtml(s.department_name)} - المستوى ${s.level_number}
                            ${s.special_case_type === 'delayed' ? ' ⚠️ حالة خاصة' : ''}
                        </div>
                    </div>`).join('');
                resultsContainer.classList.remove('hidden');
            } else {
                resultsContainer.innerHTML = `<div class="autocomplete-item" style="color:#e11d48;cursor:default;padding:10px;">❌ ${data.error || 'لا توجد نتائج'}</div>`;
                resultsContainer.classList.remove('hidden');
            }
        })
        .catch(err => {
            console.error(err);
            resultsContainer.innerHTML = '<div class="autocomplete-item" style="color:#e11d48;cursor:default;padding:10px;">❌ حدث خطأ في البحث</div>';
        });
}

// ============================================================
// اختيار طالب
// ============================================================

function selectStudentForDownload(studentId) {
    fetch(`/renewal/api/search-student-for-download/?search=${studentId}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.students && data.students.length > 0) {
                const student = data.students.find(s => s.id === studentId);
                if (student) {
                    displayStudentInfo(student);
                    selectedStudentId = student.id;
                    selectedStudentData = student;
                    document.getElementById('searchResults').classList.add('hidden');
                    document.getElementById('searchStudentInput').value = `${student.name} (${student.student_id})`;
                    if (student.can_download) loadAvailableCourses(student.id);
                }
            }
        })
        .catch(err => console.error(err));
}

// ============================================================
// عرض معلومات الطالب
// ============================================================

function displayStudentInfo(student) {
    document.getElementById('studentNameDisplay').textContent = student.name;
    document.getElementById('studentIdDisplay').textContent = student.student_id;
    document.getElementById('studentDeptDisplay').textContent = student.department_name;
    document.getElementById('studentLevelDisplay').textContent = student.level_number || '-';

    const statusSpan = document.getElementById('studentStatusDisplay');
    const statusColors = { success: { bg: '#dcfce7', text: '#166534' }, error: { bg: '#fef2f2', text: '#991b1b' }, warning: { bg: '#fef3c7', text: '#92400e' } };
    const colors = statusColors[student.status_class] || statusColors.warning;
    statusSpan.textContent = student.status_message || (student.can_download ? '✅ نشط' : '⛔ غير نشط');
    statusSpan.style.backgroundColor = colors.bg;
    statusSpan.style.color = colors.text;
    statusSpan.style.padding = '4px 12px';
    statusSpan.style.borderRadius = '9999px';
    statusSpan.style.fontWeight = '700';

    const enrollEl = document.getElementById('enrollmentStatusDisplay');
    if (student.is_active && student.can_download) {
        enrollEl.textContent = '✅ قيد نشط'; enrollEl.style.backgroundColor = '#dcfce7'; enrollEl.style.color = '#166534';
    } else if (student.enrollment_status === 'suspended') {
        enrollEl.textContent = '⛔ قيد موقوف'; enrollEl.style.backgroundColor = '#fef2f2'; enrollEl.style.color = '#991b1b';
    } else {
        enrollEl.textContent = '⚠️ لا يوجد قيد نشط'; enrollEl.style.backgroundColor = '#fef3c7'; enrollEl.style.color = '#92400e';
    }

    const badge = document.getElementById('specialCaseBadge');
    if (student.special_case_type === 'delayed') {
        badge.style.display = 'inline-block'; badge.textContent = '⚠️ تسجيل متأخر (حالة خاصة)';
    } else { badge.style.display = 'none'; }

    document.getElementById('studentInfoCard').classList.remove('hidden');
    const downloadPanel = document.getElementById('downloadPanel');
    const blockedPanel = document.getElementById('blockedPanel');
    if (student.can_download && student.is_active) {
        downloadPanel.style.display = 'block'; blockedPanel.style.display = 'none';
    } else {
        downloadPanel.style.display = 'none'; blockedPanel.style.display = 'block';
    }
}

// ============================================================
// تحميل المواد المتاحة للطالب
// ============================================================

function loadAvailableCourses(studentId) {
    const container = document.getElementById('coursesContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">⏳ جاري تحميل المواد...</div>';

    fetch('/renewal/api/semesters/')
        .then(r => r.json())
        .then(semestersData => {
            const semester = semestersData.semesters?.find(s => s.is_active);
            if (!semester) throw new Error('لا يوجد فصل دراسي نشط');
            return fetch(`/renewal/api/get-available-courses/?student_id=${studentId}&semester_id=${semester.id}`).then(r => r.json()).then(data => {
                if (data.success) { availableCourses = data.courses || []; renderCourses(availableCourses, semester); }
                else throw new Error(data.error || 'فشل تحميل المواد');
            });
        })
        .catch(err => {
            console.error(err);
            if (container) container.innerHTML = `<div style="text-align:center;padding:20px;color:#e11d48;">❌ ${err.message}</div>`;
        });
}

// ============================================================
// عرض المواد في القائمة
// ============================================================

function renderCourses(courses, semester) {
    const container = document.getElementById('coursesContainer');
    if (!container) return;
    if (!courses || courses.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;">لا توجد مواد متاحة للتنزيل في هذا الفصل</div>';
        return;
    }
    let html = `<div style="margin-top:15px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-weight:700;color:#1e293b;">📚 المواد المتاحة (${courses.length})</span>
        <div style="display:flex;align-items:center;gap:8px;">
            <input type="checkbox" id="selectAllCourses" onchange="toggleAllCourses(this)" style="width:18px;height:18px;cursor:pointer;">
            <label for="selectAllCourses" style="font-size:0.875rem;font-weight:600;cursor:pointer;">تحديد الكل</label>
        </div></div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <div style="background:#f1f5f9;padding:10px 15px;display:grid;grid-template-columns:40px 1fr 1fr 80px;gap:10px;font-weight:700;font-size:0.875rem;color:#475569;border-bottom:2px solid #e2e8f0;">
            <span>#</span><span>رمز المادة</span><span>اسم المادة</span><span style="text-align:center;">الساعات</span></div>`;
    courses.forEach((course, index) => {
        const ok = course.can_register !== false;
        html += `<div style="padding:10px 15px;display:grid;grid-template-columns:40px 1fr 1fr 80px;gap:10px;border-bottom:1px solid #f1f5f9;align-items:center;${!ok ? 'opacity:0.5;' : ''}">
            <div style="text-align:center;"><input type="checkbox" class="course-checkbox" data-course-id="${course.id}" ${!ok ? 'disabled' : ''} onchange="updateDownloadButton()" style="width:18px;height:18px;cursor:${ok ? 'pointer' : 'not-allowed'};"></div>
            <span style="font-weight:600;font-size:0.875rem;">${escapeHtml(course.code)}</span>
            <span style="font-size:0.875rem;">${escapeHtml(course.name)}</span>
            <span style="text-align:center;font-size:0.875rem;font-weight:600;">${course.credits || 0}</span>
        </div>${!ok && course.message ? `<div style="padding:4px 15px 8px;font-size:0.75rem;color:#e11d48;background:#fef2f2;border-bottom:1px solid #f1f5f9;">⚠️ ${escapeHtml(course.message)}</div>` : ''}`;
    });
    html += `</div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.875rem;color:#64748b;">تم اختيار: <span id="selectedCoursesCount">0</span> مادة</span>
        </div>
        <div style="margin-top:15px;display:flex;gap:10px;">
            <button class="btn-action btn-save" id="downloadMaterialsBtn" onclick="downloadMaterialsForStudent()" style="background-color:#0f766e;color:white;padding:10px 24px;border:none;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-weight:700;opacity:0.5;pointer-events:none;">
                <span class="material-symbols-outlined">download</span> تنزيل المواد المختارة
            </button>
        </div></div>`;
    container.innerHTML = html;
    updateDownloadButton();
}

function toggleAllCourses(cb) {
    document.querySelectorAll('.course-checkbox:not([disabled])').forEach(c => c.checked = cb.checked);
    updateDownloadButton();
}

function updateDownloadButton() {
    const checked = document.querySelectorAll('.course-checkbox:checked');
    const count = document.getElementById('selectedCoursesCount');
    if (count) count.textContent = checked.length;
    const btn = document.getElementById('downloadMaterialsBtn');
    if (btn) { btn.style.opacity = checked.length > 0 ? '1' : '0.5'; btn.style.pointerEvents = checked.length > 0 ? 'auto' : 'none'; }
}

// ============================================================
// تنزيل المواد للطالب المحدد
// ============================================================

function downloadMaterialsForStudent(e) {
    if (e && e.preventDefault) e.preventDefault();
    const isDownloadOpen = (typeof window.IS_DOWNLOAD_JOB_OPEN !== 'undefined') ? Boolean(window.IS_DOWNLOAD_JOB_OPEN) : false;
    if (!isDownloadOpen) { showNotification('error', window.DOWNLOAD_JOB_MESSAGE || '⚠️ خدمة تنزيل المواد موقوفة حالياً.'); return; }
    if (!selectedStudentId) { showNotification('warning', '⚠️ الرجاء اختيار طالب أولاً'); return; }
    const checkboxes = document.querySelectorAll('.course-checkbox:checked');
    if (checkboxes.length === 0) { showNotification('warning', '⚠️ الرجاء اختيار مادة واحدة على الأقل'); return; }
    const courseIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.courseId));
    if (!confirm(`هل أنت متأكد من رغبتك في تنزيل ${courseIds.length} مادة للطالب ${selectedStudentData?.name}؟`)) return;
    const btn = document.getElementById('downloadMaterialsBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined">refresh</span> جاري التنزيل...'; }
    const year = document.getElementById('yearInput')?.value || '2026';
    const seasonType = document.getElementById('seasonSelect')?.value || '';
    fetch('/renewal/api/download-special-materials/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ student_id: selectedStudentId, student_ids: [selectedStudentId], course_ids: courseIds, academic_year: year, year: parseInt(year), semester: seasonType, season_type: seasonType, special_case: selectedStudentData?.special_case_type || 'delayed' })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success' || data.success) {
                showNotification('success', data.message || `✅ تم تنزيل ${courseIds.length} مادة بنجاح للطالب ${selectedStudentData?.name || ''}`);
                setTimeout(() => location.reload(), 1500);
            } else {
                showNotification('error', data.error || data.message || '⛔ فشل تنزيل المواد');
            }
        })
        .catch(err => {
            console.error(err);
            showNotification('error', '❌ حدث خطأ في الاتصال بالسيرفر أثناء تنزيل المواد');
        })
        .finally(() => { if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined">download</span> تنزيل المواد المختارة'; } });
}

// ============================================================
// تحميل الطلاب في الجدول
// ============================================================

function loadStudents() {
    const specialCase = document.getElementById('specialCaseSelect')?.value || '';
    const departmentId = document.getElementById('majorSelect')?.value || '';
    const levelId = document.getElementById('level-select')?.value || document.getElementById('levelSelect')?.value || '';
    const year = document.getElementById('yearInput')?.value || '';
    const seasonType = document.getElementById('seasonSelect')?.value || '';

    const tbody = document.getElementById('studentsTableBody');
    const wrapper = document.getElementById('studentTableWrapper');
    const selSec = document.getElementById('studentSelectionSection');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell" style="text-align:center;padding:30px;color:#94a3b8;">⏳ جاري جلب البيانات...</td></tr>';
    wrapper.style.display = 'block';

    let url = '/renewal/api/get-students-for-download/?';
    if (specialCase) url += `special_case=${encodeURIComponent(specialCase)}&`;
    if (departmentId) url += `department_id=${encodeURIComponent(departmentId)}&`;
    if (levelId) url += `level_id=${encodeURIComponent(levelId)}&`;
    if (seasonType) url += `season_type=${encodeURIComponent(seasonType)}&`;
    if (year) url += `year=${encodeURIComponent(year)}&`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            tbody.innerHTML = '';
            if (data.success && data.students && data.students.length > 0) {
                if (data.semester_id) window.currentSemesterId = data.semester_id;
                if (data.semester_name) window.currentSemesterName = data.semester_name;

                const availableStudents = data.students.filter(s => !s.has_registration);
                const registeredStudents = data.students.filter(s => s.has_registration);

                if (availableStudents.length > 0) {
                    tbody.innerHTML = availableStudents.map(student => `
                        <tr class="student-row border-b hover:bg-gray-50" data-student-id="${student.id}">
                            <td class="text-center" style="padding:10px;">
                                <input type="checkbox" class="student-checkbox student-select-checkbox" data-id="${student.id}" data-student-id="${student.id}" data-name="${escapeHtml(student.name)}" data-code="${escapeHtml(student.student_id)}" data-level="${student.level_number || student.level || ''}" onchange="window.updateSelectionSection()" style="width:18px;height:18px;cursor:pointer;">
                            </td>
                            <td class="text-center font-bold" style="padding:10px; font-size:0.8rem;">${escapeHtml(student.student_id)}</td>
                            <td style="text-align:right; padding:10px; font-size:0.8rem;">${escapeHtml(student.name)} ${escapeHtml(student.father_name || '')}</td>
                            <td class="text-center" style="padding:10px; font-size:0.78rem; font-weight:600; color:#0f766e;">${student.level_number ? 'المستوى ' + student.level_number : '-'}</td>
                            <td class="text-center" style="padding:10px;">
                                <button class="btn-download-action btn-download"
                                    data-student-id="${student.id}"
                                    data-student-name="${escapeHtml(student.name)}"
                                    data-student-code="${escapeHtml(student.student_id)}"
                                    onclick="window.toggleSubRow(this)"
                                    style="padding:4px 12px; border:none; border-radius:5px; font-weight:700; font-size:0.72rem; cursor:pointer; transition:all 0.3s ease; display:inline-flex; align-items:center; gap:4px; background-color:#307e92; color:white;">
                                    <span class="material-symbols-outlined" style="font-size:14px;">download</span>
                                    📥 المواد المراد تنزيلها
                                </button>
                            </td>
                        </tr>`).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell" style="text-align:center;padding:30px;color:#0f766e;font-weight:600;">✅ جميع الطلاب المعروضين تم تنزيل موادهم لهذا الفصل.</td></tr>';
                }

                const regTbody = document.getElementById('registeredStudentsTableBody');
                const regBar = document.getElementById('registeredStudentsToggleBar');
                const regBadge = document.getElementById('registeredStudentsBadge');
                if (regTbody && registeredStudents.length > 0) {
                    regTbody.innerHTML = registeredStudents.map(student => `
                        <tr class="student-row" style="border-bottom:1px solid #99f6e4; background:white;" data-student-id="${student.id}">
                            <td style="padding:5px 8px; text-align:center; font-weight:700; font-size:0.78rem;">${escapeHtml(student.student_id)}</td>
                            <td style="padding:5px 8px; text-align:right; font-size:0.78rem;">${escapeHtml(student.name)}</td>
                            <td style="padding:5px 8px; text-align:center;">
                                <button
                                    data-student-id="${student.id}"
                                    data-student-name="${escapeHtml(student.name)}"
                                    data-student-code="${escapeHtml(student.student_id)}"
                                    onclick="window.downloadedStudents=window.downloadedStudents||{}; window.downloadedStudents[${student.id}]=true; window.toggleSubRow(this)"
                                    style="padding:3px 10px; border:none; border-radius:4px; background:#059669; color:white; font-weight:700; font-size:0.7rem; cursor:pointer; display:inline-flex; align-items:center; gap:3px;">
                                    <span class="material-symbols-outlined" style="font-size:13px;">assignment_turned_in</span>
                                    عرض المواد المسجلة
                                </button>
                            </td>
                        </tr>
                    `).join('');
                    if (regBar) regBar.style.display = 'block';
                    if (regBadge) regBadge.textContent = registeredStudents.length;
                } else if (regBar) {
                    regBar.style.display = 'none';
                }

                wrapper.style.display = 'block';
                if (selSec) selSec.style.display = 'block';
                setupTableEventDelegation();
            } else {
                tbody.innerHTML = `<tr><td colspan="5" class="empty-cell" style="text-align:center;padding:40px;color:#94a3b8;">${data.success ? 'لا يوجد طلاب موقوفين مجددين مؤهلين للتنزيل' : (data.error || 'حدث خطأ')}</td></tr>`;
                if (selSec) selSec.style.display = 'none';
            }
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="5" class="empty-cell text-red-500" style="text-align:center;padding:20px;">❌ حدث خطأ في التحميل</td></tr>';
            if (selSec) selSec.style.display = 'none';
        });
}

// ============================================================
// تفويض الأحداث على مستوى الجداول (Event Delegation)
// ============================================================

function setupTableEventDelegation() {
    const tableContainers = [
        document.getElementById('studentsTableBody'),
        document.getElementById('registeredStudentsTableBody'),
        document.getElementById('studentTableWrapper')
    ];

    tableContainers.forEach(container => {
        if (!container || container.dataset.delegated === 'true') return;
        container.dataset.delegated = 'true';

        container.addEventListener('click', function (e) {
            const btn = e.target.closest('.btn-download-action, .btn-download, button[data-student-id]');
            if (!btn) return;

            e.preventDefault();

            const sId = btn.getAttribute('data-student-id') || btn.dataset?.studentId;
            const onclickAttr = btn.getAttribute('onclick') || '';
            if (sId && onclickAttr.includes('downloadedStudents')) {
                window.downloadedStudents = window.downloadedStudents || {};
                window.downloadedStudents[sId] = true;
            }

            if (!onclickAttr.includes('toggleSubRow')) {
                toggleSubRow(btn);
            }
        });
    });
}

// ============================================================
// دوال عرض الجدول الفرعي وتنزيل المواد للمستندات الاستثنائية
// ============================================================

function toggleSubRow(button) {
    if (!button) return;

    const btn = button.closest('button') || button;
    const row = btn.closest('tr.student-row') || btn.closest('tr');

    const studentId = btn.getAttribute('data-student-id') || btn.dataset?.studentId || (row ? row.getAttribute('data-student-id') : null);
    const studentName = btn.getAttribute('data-student-name') || btn.dataset?.studentName || (row ? row.querySelector('td:nth-child(3)')?.innerText?.trim() : '');
    const studentCode = btn.getAttribute('data-student-code') || btn.dataset?.studentCode || (row ? row.querySelector('td:nth-child(2)')?.innerText?.trim() : '');

    if (!studentId || !row) {
        console.warn('⚠️ toggleSubRow: Unable to identify student ID or target row', { button, row });
        return;
    }

    // فحص وحذف أي صف فرعي سابق لنفس الطالب فوراً (Toggle)
    const existingSubRows = document.querySelectorAll(`#sub-row-${studentId}`);
    if (existingSubRows.length > 0) {
        existingSubRows.forEach(el => el.remove());
        const isDownloaded = window.downloadedStudents && window.downloadedStudents[studentId];
        if (isDownloaded) {
            btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span> ✅ المواد التي تم تنزيلها`;
        } else {
            btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">download</span> 📥 المواد المراد تنزيلها`;
        }
        btn.disabled = false;
        btn.style.opacity = '1';
        delete btn.dataset.isLoading;
        return;
    }

    // منع الاستدعاءات المتعددة أثناء جلب البيانات
    if (btn.dataset.isLoading === 'true') return;
    btn.dataset.isLoading = 'true';

    const isDownloaded = window.downloadedStudents && window.downloadedStudents[studentId];
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px; animation: spin 1s linear infinite;">refresh</span> جاري التحميل...`;
    btn.disabled = true;
    btn.style.opacity = '0.7';

    const semesterId = window.currentSemesterId;
    let url = isDownloaded
        ? `/renewal/api/student-courses/${studentId}/${semesterId}/`
        : `/renewal/api/preview-materials/?student_ids=${studentId}`;

    const levelVal = document.getElementById('level-select')?.value || document.getElementById('levelSelect')?.value;
    if (!isDownloaded && levelVal) {
        url += `&level_id=${encodeURIComponent(levelVal)}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            btn.disabled = false;
            btn.style.opacity = '1';
            delete btn.dataset.isLoading;

            // تأكيد حذف أي صف فرعي سابق لنفس الطالب لمنع التكرار نهائياً
            document.querySelectorAll(`#sub-row-${studentId}`).forEach(el => el.remove());

            let courses = [];
            if (isDownloaded) {
                if (data.success && data.courses) courses = data.courses;
            } else {
                if (data.success && data.preview_data && data.preview_data.length > 0) {
                    const studentData = data.preview_data[0];
                    if (studentData.already_registered) {
                        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span> ✅ مسجّل مسبقاً`;
                        btn.style.backgroundColor = '#10b981';
                        window.downloadedStudents = window.downloadedStudents || {};
                        window.downloadedStudents[studentId] = true;
                        return;
                    }
                    courses = studentData.courses || [];
                }
            }

            const subRow = document.createElement('tr');
            subRow.id = `sub-row-${studentId}`;
            subRow.className = 'sub-row';
            subRow.style.backgroundColor = '#f8fafc';

            let coursesHtml = '';
            if (courses && courses.length > 0) {
                coursesHtml = courses.map((c) => {
                    const levelNum = c.level_number || c.level_id || c.level || 1;
                    const realLevelName = c.level_name || (levelNum ? `المستوى ${levelNum}` : 'المستوى 1');
                    const prereqVal = c.prerequisite || c.prerequisite_name || '-';
                    const prereqHtml = (prereqVal && prereqVal !== '-')
                        ? `<span style="color: #b45309; font-weight: 700; font-size: 11px;">${escapeHtml(prereqVal)}</span>`
                        : `<span style="color: #94a3b8; font-size: 11px;">-</span>`;

                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                            <td style="padding: 4px 8px; text-align: center; font-weight: 700; font-family: monospace; font-size: 11px; color: #0f766e;">${escapeHtml(c.code || c.course_code || '-')}</td>
                            <td style="padding: 4px 8px; text-align: right; font-size: 11px; font-weight: 600; color: #1e293b;">${escapeHtml(c.raw_name || c.name || c.course_name || '-')}</td>
                            <td style="padding: 4px 8px; text-align: center; font-size: 11px; font-weight: 700;">${escapeHtml(String(c.credits || '-'))}</td>
                            <td style="padding: 4px 8px; text-align: center; font-size: 11px;">${prereqHtml}</td>
                            <td style="padding: 4px 8px; text-align: center; font-size: 10px; color: #475569; font-weight: 600;">${escapeHtml(realLevelName)}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                coursesHtml = `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #64748b; font-size: 11px; font-weight: bold;">⚠️ لا توجد مواد دراسية متوفرة للتنزيل لهذا الطالب حالياً.</td></tr>`;
            }

            subRow.innerHTML = `
                <td colspan="5" style="padding: 0; border: none;">
                    <div style="background: linear-gradient(135deg, #f0fdfa, #f8fafc); border: 1px solid #99f6e4; border-radius: 8px; margin: 3px 10px 4px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,118,110,0.08);">
                        <div style="padding: 6px 12px; background: #0f766e; color: white; font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: space-between;">
                            <span>📚 المواد المقرر تنزيلها للطالب: ${escapeHtml(studentName)} (${escapeHtml(studentCode)})</span>
                            <span style="background: rgba(255,255,255,0.2); padding: 1px 8px; border-radius: 4px; font-size: 10px;">${courses.length} مادة</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #e6fffa; border-bottom: 1.5px solid #0f766e;">
                                    <th style="padding: 4px 8px; text-align: center; font-weight: 700; color: #0f766e; font-size: 10px; width: 80px;">رمز المادة</th>
                                    <th style="padding: 4px 8px; text-align: right; font-weight: 700; color: #0f766e; font-size: 10px;">اسم المادة</th>
                                    <th style="padding: 4px 8px; text-align: center; font-weight: 700; color: #0f766e; font-size: 10px; width: 60px;">الوحدات</th>
                                    <th style="padding: 4px 8px; text-align: center; font-weight: 700; color: #0f766e; font-size: 10px; width: 110px;">المتطلب السابق</th>
                                    <th style="padding: 4px 8px; text-align: center; font-weight: 700; color: #0f766e; font-size: 10px; width: 100px;">الفصل الدراسي</th>
                                </tr>
                            </thead>
                            <tbody>${coursesHtml}</tbody>
                        </table>
                    </div>
                </td>
            `;

            row.insertAdjacentElement('afterend', subRow);
            btn.innerHTML = isDownloaded ? `✅ المواد المسجلة` : `📥 إخفاء المواد`;
        })
        .catch(err => {
            console.error(err);
            btn.disabled = false;
            btn.style.opacity = '1';
            delete btn.dataset.isLoading;
        });
}

function viewSemesterPlan() {
    const departmentId = document.getElementById('majorSelect')?.value;
    const levelSelect = document.getElementById('level-select') || document.getElementById('levelSelect');
    const levelId = levelSelect?.value;
    const levelName = levelId && levelSelect ? (levelSelect.options[levelSelect.selectedIndex]?.text || `مستوى ${levelId}`) : '';
    const deptSelect = document.getElementById('majorSelect');
    const deptName = deptSelect ? (deptSelect.options[deptSelect.selectedIndex]?.text || '') : '';

    if (!departmentId) {
        showNotification('warning', 'الرجاء اختيار التخصص أولاً لعرض مواد الفصل');
        return;
    }
    if (!levelId) {
        showNotification('warning', 'الرجاء اختيار المستوى الدراسي أولاً لعرض مواد الفصل');
        return;
    }

    const title = document.getElementById('semesterCoursesTitle');
    const tbody = document.getElementById('semesterCoursesTableBody');
    const countEl = document.getElementById('semesterCoursesCount');
    const modal = document.getElementById('semesterCoursesSection');

    if (title) title.textContent = `مواد ${escapeHtml(deptName)} — ${escapeHtml(levelName)}`;
    if (tbody) tbody.innerHTML = '';
    if (countEl) countEl.textContent = '0';
    if (modal) modal.style.display = 'block';

    const timestamp = new Date().getTime();
    fetch(`/renewal/api/department-courses/${encodeURIComponent(departmentId)}/?level_id=${encodeURIComponent(levelId)}&_=${timestamp}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.courses) {
                const selectedLevel = Number(levelId);
                window.currentLevelCourses = data.courses.filter(course => {
                    const cLevel = Number(course.level_id || course.level_number || course.level);
                    return cLevel === selectedLevel;
                });

                if (tbody) {
                    if (window.currentLevelCourses.length > 0) {
                        tbody.innerHTML = window.currentLevelCourses.map(course => `
                            <tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                                <td style="padding: 6px 10px; text-align: center; font-weight: 700; font-family: monospace; color: #0f766e;">${escapeHtml(course.code || '-')}</td>
                                <td style="padding: 6px 10px; text-align: right; font-weight: 600; color: #1e293b;">${escapeHtml(course.name || '-')}</td>
                                <td style="padding: 6px 10px; text-align: center; font-weight: 700;">${course.credits || '-'}</td>
                                <td style="padding: 6px 10px; text-align: center; color: #475569;">${escapeHtml(course.prerequisite || '-')}</td>
                            </tr>
                        `).join('');
                    } else {
                        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">لا توجد مواد مضافة لهذا المستوى والتخصص</td></tr>';
                    }
                }
                if (countEl) countEl.textContent = window.currentLevelCourses.length;
            }
        })
        .catch(err => {
            console.error(err);
            showNotification('error', '❌ تعذر جلب مواد الفصل الدراسي');
        });
}

function closeSemesterView() {
    const modal = document.getElementById('semesterCoursesSection');
    if (modal) modal.style.display = 'none';
}

function printSemesterPlan() {
    window.print();
}

async function downloadMaterials() {
    const checkboxes = document.querySelectorAll('.student-checkbox:checked, .student-select-checkbox:checked');
    if (!checkboxes || checkboxes.length === 0) {
        const warningMsg = '⚠️ الرجاء اختيار طالب واحد على الأقل لتنزيل المواد';
        console.warn(warningMsg);
        showNotification('warning', warningMsg);
        return;
    }

    const studentIds = [];
    const invalidStudents = [];
    const levelSelect = document.getElementById('level-select') || document.getElementById('levelSelect') || document.getElementById('specialCaseSelect');
    const selectedLevelVal = (levelSelect && levelSelect.value) ? parseInt(levelSelect.value) : null;

    checkboxes.forEach(cb => {
        const id = cb.getAttribute('data-id') || cb.getAttribute('data-student-id');
        const name = cb.getAttribute('data-name') || 'الطالب';
        const levelAttr = cb.getAttribute('data-level') || cb.dataset?.level;
        const studentLevel = levelAttr ? parseInt(levelAttr) : null;

        if (id) {
            studentIds.push(id);
        }

        // فحص الشرط الأكاديمي (Academic Level Compatibility Validation)
        if (selectedLevelVal && studentLevel) {
            // القيد الأكاديمي: إذا كان مستوى الطالب N >= 3، يحظر تنزيل مواد من المستوى N-2 أو أقل
            if (studentLevel >= 3 && selectedLevelVal <= studentLevel - 2) {
                const reason = `لا يمكن تنزيل مواد من المستوى ${selectedLevelVal} للطالب "${name}" الموجود في المستوى ${studentLevel}`;
                invalidStudents.push(reason);
            }
        }
    });

    if (studentIds.length === 0) {
        const warningMsg = '⚠️ لم يتم العثور على طلاب محددين';
        console.warn(warningMsg);
        showNotification('warning', warningMsg);
        return;
    }

    // إظهار إشعار عائم في حالة مخالفة الشروط الأكاديمية بدلاً من alert
    if (invalidStudents.length > 0) {
        const fullErrorMsg = invalidStudents.join('\n');
        console.error('❌ تعذر التنزيل بسبب شرط التحقق الأكاديمي (Academic Validation Error):\n' + fullErrorMsg);
        const toastMsg = invalidStudents.length === 1
            ? `⛔ ${invalidStudents[0]}`
            : `⛔ تعذر التنزيل: ${invalidStudents[0]} (+${invalidStudents.length - 1} مخالفات أخرى)`;
        showNotification('error', toastMsg);
        return;
    }

    // جلب معرف الفصل الدراسي وحقوله من الواجهة بشكل موثوق
    let semesterId = window.currentSemesterId || document.getElementById('currentSemesterId')?.value || document.getElementById('semester_id')?.value;
    const seasonType = document.getElementById('seasonSelect')?.value || '';
    const yearVal = document.getElementById('yearInput')?.value || '';

    if (!semesterId || isNaN(parseInt(semesterId))) {
        try {
            const semRes = await fetch('/renewal/api/semesters/');
            const semData = await semRes.json();
            if (semData.semesters && semData.semesters.length > 0) {
                const activeSem = semData.semesters.find(s => s.is_active) || semData.semesters[0];
                if (activeSem) {
                    semesterId = activeSem.id;
                    window.currentSemesterId = activeSem.id;
                }
            }
        } catch (err) {
            console.error('❌ تعذر جلب الفصل الدراسي من الخادم:', err);
        }
    }

    const btn = document.getElementById('btnDownloadMaterials') || document.getElementById('btnSaveSpecialDownload');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined">refresh</span> جاري التنزيل...';
    }

    const parsedSemesterId = (semesterId && !isNaN(parseInt(semesterId))) ? parseInt(semesterId) : null;

    fetch('/renewal/api/download-materials/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            student_ids: studentIds,
            semester_id: parsedSemesterId,
            season_type: seasonType,
            semester: seasonType,
            semester_type: seasonType,
            year: yearVal,
            academic_year: yearVal,
            level_id: selectedLevelVal
        })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                const successMsg = data.message || `✅ تم تنزيل المواد لعدد ${studentIds.length} طالب بنجاح (تم إضافة ${data.downloaded_count || 0} مادة)`;
                showNotification('success', successMsg);
                loadStudents();
            } else {
                const errorMsg = data.error || data.message || 'فشل تنزيل المواد بسبب شروط أكاديمية';
                console.error('❌ خطأ في تنزيل المواد من الخادم (Academic Validation Failed):', errorMsg, data);
                showNotification('error', `⛔ ${errorMsg}`);
            }
        })
        .catch(err => {
            console.error('❌ حدث خطأ في الاتصال أثناء تنزيل المواد:', err);
            showNotification('error', '❌ حدث خطأ في الاتصال بالسيرفر أثناء تنزيل المواد');
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-symbols-outlined">library_add</span> تنزيل المواد للمحددين';
            }
        });
}

function toggleRegisteredStudentsTable() {
    const section = document.getElementById('registeredStudentsSection');
    const label = document.getElementById('registeredToggleLabel');
    if (!section) return;
    const isVisible = section.style.display !== 'none';
    section.style.display = isVisible ? 'none' : 'block';
    if (label) {
        label.textContent = isVisible
            ? 'عرض الطلاب الذين تم تنزيل موادهم لهذا الفصل'
            : 'إخفاء الطلاب المسجلين';
    }
}

function updateSelectionSection() {
    const checked = document.querySelectorAll('.student-select-checkbox:checked, .student-checkbox:checked');
    const section = document.getElementById('studentSelectionSection');
    if (section) section.style.display = checked.length > 0 ? 'block' : 'none';
}

function toggleAll(masterCheckbox) {
    document.querySelectorAll('.student-select-checkbox, .student-checkbox').forEach(cb => cb.checked = masterCheckbox.checked);
    updateSelectionSection();
}

window.toggleSubRow = toggleSubRow;
window.viewSemesterPlan = viewSemesterPlan;
window.closeSemesterView = closeSemesterView;
window.printSemesterPlan = printSemesterPlan;
window.downloadMaterials = downloadMaterials;
window.toggleRegisteredStudentsTable = toggleRegisteredStudentsTable;
window.updateSelectionSection = updateSelectionSection;
window.updateSelectedCount = updateSelectionSection;
window.toggleAll = toggleAll;

// ============================================================
// 🖨️ طباعة التقرير - يطبع الطلاب الموجودين في الجدول فقط
// ============================================================

function ensurePrintContainerInBody() {
    const container = document.getElementById('printReportContainer');
    if (container && container.parentNode !== document.body) document.body.appendChild(container);
    return container;
}

function printPage() {
    ensurePrintContainerInBody();

    // ── الفلاتر ──────────────────────────────────────────────
    const majorSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('level-select');

    const deptName = (majorSelect && majorSelect.selectedIndex > 0)
        ? majorSelect.options[majorSelect.selectedIndex].text
        : 'جميع التخصصات';
    const levelName = (levelSelect && levelSelect.selectedIndex > 0)
        ? levelSelect.options[levelSelect.selectedIndex].text
        : 'الكل';

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // ── تعبئة حقول رأس التقرير ───────────────────────────────
    const el = id => document.getElementById(id);
    if (el('rpt_dept')) el('rpt_dept').textContent = deptName;
    if (el('rpt_level')) el('rpt_level').textContent = levelName;
    if (el('rpt_date')) el('rpt_date').textContent = dateStr;

    // ── بناء صفوف الجدول من صفوف الجدول الرئيسي ─────────────
    const tbody = document.getElementById('rpt_tbody');
    const srcRows = Array.from(document.querySelectorAll('#studentsTableBody tr[data-student-id]'));
    const count = srcRows.length;

    if (el('rpt_count')) el('rpt_count').textContent = count;

    if (tbody) {
        if (count > 0) {
            tbody.innerHTML = srcRows.map((row, index) => {
                const cells = row.querySelectorAll('td');
                const regNo = cells[1]?.innerText?.trim() || '-';
                const name = cells[2]?.innerText?.trim() || '-';
                const level = cells[3]?.innerText?.trim() || '-';
                const remaining = cells[4]?.innerText?.trim() || '0';
                return `
                    <tr>
                        <td style="text-align:center;border:1px solid #000;padding:7px 5px;font-weight:600;">${index + 1}</td>
                        <td style="text-align:center;border:1px solid #000;padding:7px 5px;font-weight:bold;">${escapeHtml(regNo)}</td>
                        <td style="text-align:right;border:1px solid #000;padding:7px 10px;font-weight:600;">${escapeHtml(name)}</td>
                        <td style="text-align:center;border:1px solid #000;padding:7px 5px;">${escapeHtml(level)}</td>
                        <td style="text-align:center;border:1px solid #000;padding:7px 5px;">${escapeHtml(remaining)}</td>
                    </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data-cell">لا توجد بيانات في الجدول حالياً</td></tr>';
        }
    }

    // ── جلب اسم المسجل العام آلياً ───────────────────────────
    const doPrint = () => window.print();
    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') res.then(doPrint).catch(doPrint);
            else setTimeout(doPrint, 300);
        } catch (e) { console.warn('OfficialsHelper error:', e); doPrint(); }
    } else { doPrint(); }
}

// ============================================================
// نوافذ منبثقة
// ============================================================

function openModal(id) { const m = document.getElementById(id); if (m) { m.classList.remove('hidden'); m.style.display = 'flex'; } }
function closeModal(id) { const m = document.getElementById(id); if (m) { m.classList.add('hidden'); m.style.display = 'none'; } }

function previewMaterialsToDownload() {
    const checkboxes = document.querySelectorAll('.student-select-checkbox:checked');
    let studentIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.studentId));
    if (studentIds.length === 0 && selectedStudentId) studentIds = [selectedStudentId];
    if (studentIds.length === 0) { showNotification('warning', '⚠️ يرجى تحديد طالب أولاً'); return; }

    openModal('previewToDownloadModal');
    const body = document.getElementById('previewToDownloadModalBody');
    if (!body) return;
    body.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;">⏳ جاري تحميل بيانات المعاينة...</div>';

    const year = document.getElementById('yearInput')?.value || '2026';
    const seasonType = document.getElementById('seasonSelect')?.value || '';
    const levelId = document.getElementById('specialCaseSelect')?.value || '';

    fetch(`/renewal/api/preview-materials/?student_ids=${studentIds.join(',')}&year=${encodeURIComponent(year)}&season_type=${encodeURIComponent(seasonType)}&level_id=${encodeURIComponent(levelId)}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.preview_data && data.preview_data.length > 0) {
                body.innerHTML = data.preview_data.map(student => `
                    <div style="margin-bottom:15px;border:1px solid #cbd5e1;border-radius:10px;padding:15px;background:#fff;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                            <div><strong style="font-size:1.05rem;color:#307e92;">${escapeHtml(student.student_name)}</strong>
                            <span style="font-size:0.8rem;color:#64748b;margin-right:12px;">رقم القيد: ${escapeHtml(student.student_code)}</span></div>
                            <span style="font-size:0.8rem;background:#e2e8f0;padding:2px 10px;border-radius:12px;font-weight:700;">المستوى ${escapeHtml(student.level_number)}</span>
                        </div>
                        <div style="font-size:0.85rem;font-weight:700;color:#475569;margin-bottom:8px;">📚 المواد المقترحة (${student.courses ? student.courses.length : 0}):</div>
                        ${student.courses && student.courses.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">
                            ${student.courses.map(c => `<div style="background:${c.is_remaining ? '#fef3c7' : '#f0fdf4'};border:1px solid ${c.is_remaining ? '#fde68a' : '#bbf7d0'};color:${c.is_remaining ? '#92400e' : '#166534'};padding:6px 10px;border-radius:8px;font-size:0.8rem;font-weight:600;">
                                <div>${escapeHtml(c.code)} - ${escapeHtml(c.name)}</div>
                                <div style="font-size:0.7rem;opacity:0.8;">${c.credits || 0} ساعات ${c.is_remaining ? ' ⚠️' : ''}</div>
                            </div>`).join('')}
                        </div>` : '<div style="color:#e11d48;font-size:0.8rem;padding:5px;">⚠️ لا توجد مواد متاحة</div>'}
                    </div>`).join('');
            } else {
                body.innerHTML = `<div style="text-align:center;padding:30px;color:#e11d48;">❌ ${data.error || data.message || 'لا توجد بيانات للمعاينة'}</div>`;
            }
        })
        .catch(() => { body.innerHTML = '<div style="text-align:center;padding:30px;color:#e11d48;">❌ حدث خطأ في الاتصال</div>'; });
}

function closePreviewToDownloadModal() { closeModal('previewToDownloadModal'); }

// ============================================================
// حفظ وتنزيل المواد للطلاب المختارين من الجدول
// ============================================================

function saveData(e) {
    if (e && e.preventDefault) e.preventDefault();
    const checkboxes = document.querySelectorAll('.student-select-checkbox:checked');
    let studentIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.studentId));
    if (studentIds.length === 0 && selectedStudentId) studentIds = [selectedStudentId];
    if (studentIds.length === 0) { showNotification('warning', '⚠️ الرجاء اختيار طالب واحد على الأقل'); return; }
    if (!confirm(`هل أنت متأكد من رغبتك في تنزيل المواد لـ ${studentIds.length} طالب؟`)) return;

    const btn = document.querySelector('.btn-save[onclick*="saveData"]') || (e?.target);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-outlined">refresh</span> جاري التنزيل...'; }

    fetch('/renewal/api/download-special-materials/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify({ student_ids: studentIds, academic_year: document.getElementById('yearInput')?.value || new Date().getFullYear(), semester: document.getElementById('seasonSelect')?.value || '', special_case: document.getElementById('specialCaseSelect')?.value || 'normal' })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success' || data.success) {
                showNotification('success', data.message || `✅ تم تنزيل المواد بنجاح لـ ${studentIds.length} طالب`);
                setTimeout(() => location.reload(), 2000);
            } else {
                showNotification('error', data.message || data.error || '⛔ فشل تنزيل المواد');
            }
        })
        .catch(() => showNotification('error', '❌ حدث خطأ في الاتصال بالسيرفر'))
        .finally(() => { if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined">library_add</span> تنزيل المواد'; } });
}

// ============================================================
// مسح الحقول
// ============================================================

function clearSearch() {
    const fields = ['searchStudentInput', 'specialCaseSelect', 'majorSelect', 'seasonSelect', 'yearInput'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = el.tagName === 'INPUT' ? '2026' : ''; });
    document.getElementById('searchResults')?.classList.add('hidden');
    document.getElementById('studentInfoCard')?.classList.add('hidden');
    const dp = document.getElementById('downloadPanel'); if (dp) dp.style.display = 'none';
    const bp = document.getElementById('blockedPanel'); if (bp) bp.style.display = 'none';
    const ww = document.getElementById('studentTableWrapper'); if (ww) ww.style.display = 'none';
    const ss = document.getElementById('studentSelectionSection'); if (ss) ss.style.display = 'none';
    const tb = document.getElementById('studentsTableBody'); if (tb) tb.innerHTML = '';
    closeModal('semesterCoursesModal');
    closeModal('previewToDownloadModal');
    selectedStudentId = null; selectedStudentData = null; availableCourses = [];
    showNotification('info', '🧹 تم إعادة تعيين الشاشة بالكامل');
}

function goBack() { window.history.back(); }

// ============================================================
// صلاحية تنزيل المواد
// ============================================================

function applySpecialDownloadPermissionUI(isOpen, message) {
    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');
    const targets = ['btnSearchStudent', 'btnResetSearch', 'btnLoadStudents', 'btn-show-semester-courses', 'downloadMaterialsBtn'].map(id => document.getElementById(id));

    if (banner) { if (!isOpen) { if (bannerText && message) bannerText.textContent = message; banner.style.display = 'flex'; } else { banner.style.display = 'none'; } }
    targets.forEach(btn => {
        if (!btn) return;
        if (!isOpen) {
            btn.disabled = true; btn.setAttribute('disabled', 'disabled');
            btn.style.setProperty('opacity', '0.5', 'important');
            btn.style.setProperty('cursor', 'not-allowed', 'important');
            btn.style.setProperty('pointer-events', 'none', 'important');
            if (message) btn.title = message;
        } else {
            btn.disabled = false; btn.removeAttribute('disabled');
            btn.style.setProperty('opacity', '1', 'important');
            btn.style.setProperty('cursor', 'pointer', 'important');
            btn.style.setProperty('pointer-events', 'auto', 'important');
            btn.title = '';
        }
    });
}

function updateJobPermissionState() {
    const isOpen = (typeof window.IS_DOWNLOAD_JOB_OPEN !== 'undefined') ? Boolean(window.IS_DOWNLOAD_JOB_OPEN) : true;
    const message = window.DOWNLOAD_JOB_MESSAGE || '';
    applySpecialDownloadPermissionUI(isOpen, message);
    fetch('/renewal/api/jobs/check-permission/', { method: 'GET', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(r => r.json())
        .then(data => {
            if (data && data.success) {
                window.IS_DOWNLOAD_JOB_OPEN = Boolean(data.is_download_job_open);
                window.DOWNLOAD_JOB_MESSAGE = data.download_job_message || '';
                applySpecialDownloadPermissionUI(window.IS_DOWNLOAD_JOB_OPEN, window.DOWNLOAD_JOB_MESSAGE);
            }
        })
        .catch(err => console.warn('⚠️ Permission check error:', err));
}
window.updateJobPermissionState = updateJobPermissionState;

// ============================================================
// تهيئة الصفحة
// ============================================================

function init() {
    console.log('🚀 Initializing special download page v1.0.23...');
    updateJobPermissionState();
    setupTableEventDelegation();

    document.getElementById('searchStudentInput')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') { e.preventDefault(); searchStudentForDownload(); }
    });

    const btnShowCourses = document.getElementById('btn-show-semester-courses');
    if (btnShowCourses) {
        btnShowCourses.addEventListener('click', e => {
            e.preventDefault();
            const dept = document.getElementById('majorSelect')?.value;
            if (!dept) { showNotification('warning', '⚠️ يرجى اختيار التخصص أولاً'); return; }
            fetchSemesterCourses(dept, document.getElementById('seasonSelect')?.value, document.getElementById('yearInput')?.value);
        });
    }

    ['specialCaseSelect', 'majorSelect', 'level-select', 'seasonSelect', 'yearInput'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', loadStudents);
    });

    setTimeout(loadStudents, 500);
}

// ============================================================
// إزالة طالب من قائمة التحديد والجدول
// ============================================================

function removeStudentFromList(studentId) {
    if (!studentId) return;

    // إزالة صف الطالب من الجدول إذا كان موجهاً بعنصر المعرف
    const row = document.querySelector(`tr[data-student-id="${studentId}"], tr#student-row-${studentId}`);
    if (row) {
        row.remove();
    }

    // إلغاء تحديد صندوق التحديد الخاص به
    const checkbox = document.querySelector(`.student-select-checkbox[data-student-id="${studentId}"], .student-checkbox[data-id="${studentId}"]`);
    if (checkbox) {
        checkbox.checked = false;
    }

    // إزالة الصف الفرعي للمواد إن وجد
    const subRow = document.getElementById(`sub-row-${studentId}`);
    if (subRow) {
        subRow.remove();
    }

    // تحديث شريط وقائمة الطلاب المحددين
    if (typeof updateSelectionSection === 'function') {
        updateSelectionSection();
    }
}

// ============================================================
// تصدير الدوال
// ============================================================

window.showNotification = showNotification;
window.toastSuccess = window.toastSuccess;
window.toastError = window.toastError;
window.toastWarning = window.toastWarning;
window.toastInfo = window.toastInfo;
window.showToastMessage = window.showToastMessage;
window.searchStudentForDownload = searchStudentForDownload;
window.selectStudentForDownload = selectStudentForDownload;
window.loadAvailableCourses = loadAvailableCourses;
window.downloadMaterialsForStudent = downloadMaterialsForStudent;
window.loadStudents = loadStudents;
window.toggleAll = toggleAll;
window.toggleAllCourses = toggleAllCourses;
window.updateDownloadButton = updateDownloadButton;
window.removeStudentFromList = removeStudentFromList;
window.updateSelectionSection = updateSelectionSection;
window.previewMaterialsToDownload = previewMaterialsToDownload;
window.closePreviewToDownloadModal = closePreviewToDownloadModal;
window.saveData = saveData;
window.clearSearch = clearSearch;
window.goBack = goBack;
window.printPage = printPage;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

console.log('✅ special_download.js v1.0.23 ready');