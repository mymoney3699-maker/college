/**
 * ============================================================
 * groups.js v1.0.3
 * إدارة وتوزيع المجموعات مع كشف طباعة رسمي مرتب أبجدياً (أ - ي)
 * ============================================================
 */

console.log('✅ groups.js v1.0.3 loaded successfully');

// المصفوفات العامة وحالة التطبيق
let groupsData = [];
let studentsDB = [];
let currentGroupData = null;
let currentDistribution = [];
let isEditMode = false;
let selectedGroupId = null;

// ============================================================
// 1. نظام الإشعارات المنبثقة (Toast Notifications)
// ============================================================
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check_circle';
    if (type === 'error') iconName = 'error';
    if (type === 'warning') iconName = 'warning';

    toast.innerHTML = `
        <span class="material-symbols-outlined">${iconName}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, 3500);
}

function showToastMessage(message, isError = false) {
    showToast(message, isError ? 'error' : 'success');
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function escapeHtml(text) {
    if (!text) return '-';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// 2. تحميل وتفلترة المواد المعتمدة
// ============================================================
function handleCourseFilter() {
    const deptVal = document.getElementById('departmentSelect')?.value || '';
    const levelVal = document.getElementById('levelSelect')?.value || '';
    const courseSelect = document.getElementById('courseSelect');

    if (!courseSelect) return;

    if (!deptVal || !levelVal) {
        courseSelect.disabled = true;
        courseSelect.innerHTML = '<option value="">-- اختر التخصص والمستوى أولاً --</option>';
        return;
    }

    courseSelect.disabled = false;
    courseSelect.innerHTML = '<option value="">⏳ جاري جلب المواد...</option>';

    const url = `/renewal/api/get-courses/?department_id=${encodeURIComponent(deptVal)}&level_id=${encodeURIComponent(levelVal)}`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            courseSelect.disabled = false;
            if (data.success && data.courses && data.courses.length > 0) {
                let html = '<option value="">-- اختر المادة --</option>';
                data.courses.forEach(course => {
                    const codePrefix = course.code ? `${course.code} - ` : '';
                    html += `<option value="${course.id}">${escapeHtml(codePrefix + course.name)}</option>`;
                });
                courseSelect.innerHTML = html;
            } else {
                courseSelect.innerHTML = '<option value="">-- لا توجد مواد لهذا المستوى --</option>';
            }
        })
        .catch(err => {
            console.error('Error loading courses:', err);
            courseSelect.disabled = false;
            courseSelect.innerHTML = '<option value="">-- لا توجد مواد لهذا المستوى --</option>';
        });
}

const loadCourses = handleCourseFilter;

// ============================================================
// 3. التوزيع الذكي ودوال الحساب
// ============================================================

function addDistributionField(groupName = '', countVal = 0) {
    const container = document.getElementById('distributionFieldsContainer');
    if (!container) return;

    const existingCount = container.querySelectorAll('.dist-field-card').length;
    const name = groupName || `مجموعة ${existingCount + 1}`;

    const card = document.createElement('div');
    card.className = 'dist-field-card';
    card.innerHTML = `
        <span class="dist-field-label">${escapeHtml(name)}</span>
        <input type="number" class="form-input dist-field-input" min="0" value="${countVal}" oninput="calculateDistribution()" data-group-name="${escapeHtml(name)}">
        <button class="dist-btn-remove" onclick="removeDistributionField(this)" title="إزالة المجموعة">
            <span class="material-symbols-outlined">delete</span>
        </button>
    `;
    container.appendChild(card);
    calculateDistribution();
}

function removeDistributionField(buttonEl) {
    const card = buttonEl.closest('.dist-field-card');
    if (card) {
        card.remove();
        calculateDistribution();
    }
}

function autoDistribute() {
    if (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined' && !window.IS_CREATE_GROUPS_JOB_OPEN) {
        showToast(window.CREATE_GROUPS_JOB_MESSAGE || "⚠️ خدمة 'إنشاء المجموعات' غير مفعلة حالياً", 'error');
        return;
    }

    const totalInput = document.getElementById('totalStudentsInput');
    const countInput = document.getElementById('groupCountInput');
    const container = document.getElementById('distributionFieldsContainer');

    const total = parseInt(totalInput?.value) || 0;
    const count = parseInt(countInput?.value) || 1;

    if (total <= 0) {
        showToast('⚠️ الرجاء إدخال العدد الكلي للطلاب أولاً', 'warning');
        return;
    }
    if (count <= 0 || count > 20) {
        showToast('⚠️ عدد المجموعات يجب أن يكون بين 1 و 20', 'warning');
        return;
    }

    container.innerHTML = '';

    const baseCount = Math.floor(total / count);
    const remainder = total % count;

    for (let i = 1; i <= count; i++) {
        const countVal = baseCount + (i === 1 ? remainder : 0);
        addDistributionField(`مجموعة ${i}`, countVal);
    }

    calculateDistribution();
    showToast(`✅ تم التوزيع التلقائي على ${count} مجموعات بنجاح`, 'success');
}

function calculateDistribution() {
    const totalTarget = parseInt(document.getElementById('totalStudentsInput')?.value) || 0;
    const fieldInputs = document.querySelectorAll('.dist-field-input');

    let distributedSum = 0;
    fieldInputs.forEach(input => {
        distributedSum += parseInt(input.value) || 0;
    });

    const remaining = totalTarget - distributedSum;

    document.getElementById('distributedSum').textContent = distributedSum;
    document.getElementById('totalTargetCount').textContent = totalTarget;
    document.getElementById('remainingStudentsCount').textContent = remaining;

    const badge = document.getElementById('resultStatusBadge');
    if (!badge) return;

    badge.className = 'result-status-badge ';
    if (distributedSum === totalTarget && totalTarget > 0) {
        badge.classList.add('status-completed');
        badge.textContent = 'حالة التوزيع: مكتمل ومتطابق ✅';
    } else if (distributedSum > totalTarget) {
        badge.classList.add('status-overflow');
        badge.textContent = `حالة التوزيع: تجاوز العدد الكلي بـ (${Math.abs(remaining)}) طالب ⚠️`;
    } else {
        badge.classList.add('status-pending');
        badge.textContent = `حالة التوزيع: باقي (${remaining}) طلاب غير موزعين ⏳`;
    }
}

function getSelectedAcademicYear() {
    const sel = document.getElementById('semesterYearSelect');
    if (sel && sel.value) return sel.value.trim();
    const inp = document.getElementById('semesterYearInput');
    if (inp && inp.value) return inp.value.trim();
    return window.ACTIVE_ACADEMIC_YEAR || '2026';
}

// ============================================================
// 4. التنقل التفاعلي وتبديل الأقسام
// ============================================================

function showCreateSection() {
    if (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined' && !window.IS_CREATE_GROUPS_JOB_OPEN) {
        showToast(window.CREATE_GROUPS_JOB_MESSAGE || "⚠️ خدمة 'إنشاء المجموعات' غير مفعلة حالياً", 'error');
        return;
    }

    document.getElementById('groupsSection')?.classList.add('hidden');
    document.getElementById('studentsPageView')?.classList.add('hidden');

    const department = document.getElementById('departmentSelect')?.value || '';
    const level = document.getElementById('levelSelect')?.value || '';
    const semesterType = document.getElementById('semesterTypeSelect')?.value || '';
    const semesterYear = getSelectedAcademicYear();
    const course = document.getElementById('courseSelect')?.value || '';

    const createSec = document.getElementById('createSection');
    if (createSec) {
        createSec.classList.remove('hidden');
        createSec.scrollIntoView({ behavior: 'smooth' });
    }

    if (department || level || course) {
        let fetchUrl = `/renewal/api/group-students/?department=${encodeURIComponent(department)}&level=${encodeURIComponent(level)}&course=${encodeURIComponent(course)}`;
        if (semesterType) fetchUrl += `&semester_type=${encodeURIComponent(semesterType)}`;
        if (semesterYear) fetchUrl += `&semester_year=${encodeURIComponent(semesterYear)}`;

        fetch(fetchUrl)
            .then(r => r.json())
            .then(data => {
                if (data.success && Array.isArray(data.students)) {
                    const count = data.students.length;
                    const totalInput = document.getElementById('totalStudentsInput');
                    if (totalInput) totalInput.value = count;
                    autoDistribute();
                }
            })
            .catch(err => console.error('Error auto-fetching students:', err));
    } else {
        const total = parseInt(document.getElementById('totalStudentsInput')?.value) || 0;
        if (total > 0 && document.querySelectorAll('.dist-field-card').length === 0) {
            autoDistribute();
        }
    }
}

function hideCreateSection() {
    document.getElementById('createSection')?.classList.add('hidden');
}

function showGroupsSection() {
    hideCreateSection();
    document.getElementById('studentsPageView')?.classList.add('hidden');

    const groupsSec = document.getElementById('groupsSection');
    if (groupsSec) {
        groupsSec.classList.remove('hidden');
        fetchFilteredGroups();
        groupsSec.scrollIntoView({ behavior: 'smooth' });
    }
}

function toggleExistingGroups() {
    const container = document.getElementById('groupsSection');
    const btn = document.getElementById('toggleExistingGroupsBtn');
    if (!container || !btn) return;

    if (container.classList.contains('hidden')) {
        showGroupsSection();
        btn.innerHTML = '<span class="material-symbols-outlined">visibility_off</span> إخفاء المجموعات الموجودة';
    } else {
        container.classList.add('hidden');
        btn.innerHTML = '<span class="material-symbols-outlined">visibility</span> عرض المجموعات الموجودة';
    }
}

// ============================================================
// 5. شاشة عرض الطلاب المنفصلة (مرتبة أبجدياً)
// ============================================================

function showStudentsPage(groupId) {
    selectedGroupId = groupId;

    document.getElementById('filterSection')?.classList.add('hidden');
    document.getElementById('createSection')?.classList.add('hidden');
    document.getElementById('groupsSection')?.classList.add('hidden');

    const studentsView = document.getElementById('studentsPageView');
    if (studentsView) studentsView.classList.remove('hidden');

    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center empty-cell">⏳ جاري تحميل بيانات الطلاب مرتبة أبجديًا (أ - ي)...</td></tr>';
    }

    fetch(`/renewal/api/group-details/${groupId}/`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.group) {
                renderStudentsPageContent(data.group);
            } else {
                showToast(data.error || 'حدث خطأ في جلب بيانات المجموعة', 'error');
            }
        })
        .catch(err => {
            console.error('Error fetching group details:', err);
            showToast('حدث خطأ في الاتصال بالسيرفر', 'error');
        });
}

function hideStudentsPage() {
    document.getElementById('studentsPageView')?.classList.add('hidden');
    document.getElementById('filterSection')?.classList.remove('hidden');
    document.getElementById('groupsSection')?.classList.remove('hidden');
}

function renderStudentsPageContent(group) {
    currentGroupData = group;

    const cleanCourse = (group.course_name || 'غير محددة').split(' / ')[0].trim();

    document.getElementById('studentsPageGroupTitle').textContent = `كشف طلاب - ${group.name}`;
    document.getElementById('metaDeptTag').textContent = `التخصص: ${group.department_name || '-'}`;
    document.getElementById('metaLevelTag').textContent = `المستوى: ${group.level_number || '-'}`;
    document.getElementById('metaCourseTag').textContent = `المادة: ${cleanCourse}`;
    document.getElementById('metaCountTag').textContent = `العدد: ${group.student_count || 0}`;

    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    let students = group.students || [];

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center empty-cell">لا يوجد طلاب مسجلون في هذه المجموعة</td></tr>';
        return;
    }

    // 🔥 ترتيب الطلاب حتمياً وأبجدياً بحسب الاسم من (أ - ي)
    students.sort((a, b) => {
        const nameA = `${a.name || ''} ${a.father_name || ''} ${a.grandfather_name || ''} ${a.last_name || ''}`.trim();
        const nameB = `${b.name || ''} ${b.father_name || ''} ${b.grandfather_name || ''} ${b.last_name || ''}`.trim();
        return nameA.localeCompare(nameB, 'ar');
    });

    const isJobOpen = (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined') ? Boolean(window.IS_CREATE_GROUPS_JOB_OPEN) : true;
    const disabledAttr = !isJobOpen ? 'disabled style="opacity: 0.5 !important; cursor: not-allowed !important; pointer-events: none !important; filter: grayscale(80%) !important;"' : '';
    const btnClass = !isJobOpen ? 'opacity-50 pointer-events-none cursor-not-allowed' : '';

    let html = '';
    students.forEach((s, i) => {
        const fullName = `${s.name || ''} ${s.father_name || ''} ${s.grandfather_name || ''} ${s.last_name || ''}`.trim().replace(/\s+/g, ' ');
        html += `
            <tr id="student-row-${s.id}">
                <td class="text-center font-bold">${i + 1}</td>
                <td class="text-center font-bold" style="font-family: monospace;">${escapeHtml(s.student_id || '-')}</td>
                <td class="font-bold">${escapeHtml(fullName)}</td>
                <td>${escapeHtml(group.department_name || '-')}</td>
                <td class="text-center">${escapeHtml(group.level_number || '-')}</td>
                <td class="text-center"><span class="meta-tag" style="background:#e0f2fe; color:#0369a1;">${escapeHtml(group.name)}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline btn-swap-action ${btnClass}" ${disabledAttr} onclick="requestSwap(${s.id})" title="${!isJobOpen ? (window.CREATE_GROUPS_JOB_MESSAGE || 'خدمة إنشاء وتعديل المجموعات غير مفعلة حالياً') : 'طلب تبديل مجموعة الطالب'}">
                        <span class="material-symbols-outlined" style="font-size:16px;">swap_horiz</span> طلب تبديل
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    applyCreateGroupsPermissionUI(isJobOpen);
}

// ============================================================
// 6. عرض وتحديث كروت المجموعات
// ============================================================

function fetchFilteredGroups() {
    const department = document.getElementById('departmentSelect')?.value || '';
    const level = document.getElementById('levelSelect')?.value || '';
    const semesterType = document.getElementById('semesterTypeSelect')?.value || '';
    const semesterYear = getSelectedAcademicYear();
    const course = document.getElementById('courseSelect')?.value || '';

    let url = '/renewal/api/filtered-groups/?';
    const params = [];
    if (department) params.push(`department_id=${department}`);
    if (level) params.push(`level_id=${level}`);
    if (semesterType) {
        params.push(`semester_type=${semesterType}`);
        params.push(`semester=${semesterType}`);
    }
    if (semesterYear) {
        params.push(`semester_year=${semesterYear}`);
        params.push(`academic_year=${semesterYear}`);
    }
    if (course) params.push(`course_id=${course}`);
    url += params.join('&');

    const container = document.getElementById('existingGroups');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined icon-large">sync</span>
                <p>⏳ جاري تحميل الكروت...</p>
            </div>
        `;
    }

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                groupsData = data.groups || [];
                renderGroupCards(groupsData);
            } else {
                showToast(data.error || 'حدث خطأ في جلب المجموعات', 'error');
                renderGroupCards([]);
            }
        })
        .catch(err => {
            console.error('Error fetching groups:', err);
            showToast('حدث خطأ في الاتصال بالخادم', 'error');
            renderGroupCards([]);
        });
}

function renderGroupCards(groups) {
    const container = document.getElementById('existingGroups');
    if (!container) return;

    const isJobOpen = (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined') ? Boolean(window.IS_CREATE_GROUPS_JOB_OPEN) : true;
    const disabledAttr = !isJobOpen ? 'disabled style="opacity: 0.5 !important; cursor: not-allowed !important; pointer-events: none !important; filter: grayscale(80%) !important;"' : '';
    const btnClass = !isJobOpen ? 'opacity-50 pointer-events-none cursor-not-allowed' : '';

    if (!groups || groups.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined icon-large">sentiment_dissatisfied</span>
                <p>لا توجد مجموعات مطابقة للمعايير المختارة</p>
            </div>
        `;
        return;
    }

    let html = '';
    groups.forEach(group => {
        const cleanCourse = group.course_name ? group.course_name.split(' / ')[0].trim() : 'غير محددة';
        const cleanCode = group.course_code ? group.course_code.split(' / ')[0].trim() : '';
        const courseDisplay = cleanCourse !== 'غير محددة'
            ? (cleanCode && cleanCode !== '-' ? `${cleanCode} - ${cleanCourse}` : cleanCourse)
            : 'غير محددة';

        const semesterDisplay = group.semester === 'spring' ? 'ربيع' : (group.semester === 'fall' ? 'خريف' : group.semester);

        html += `
            <div class="group-card" id="card-${group.id}">
                <div>
                    <div class="card-header-top">
                        <h3 class="card-group-name"><span class="material-symbols-outlined text-teal-600 dark:text-[#38bdf8]" style="font-size:22px;">group</span> <span>${escapeHtml(group.name)}</span></h3>
                        <span class="card-level-badge">المستوى ${escapeHtml(group.level_number || '-')}</span>
                    </div>

                    <div class="card-course-box">
                        <span class="course-box-label">
                            <span class="material-symbols-outlined" style="font-size:14px;">menu_book</span> المادة الدراسية:
                        </span>
                        <div class="course-box-name">${escapeHtml(courseDisplay)}</div>
                    </div>

                    <div class="card-details-list">
                        <div><strong>التخصص:</strong> ${escapeHtml(group.department_name || '-')}</div>
                        <div><strong>الفصل / السنة:</strong> ${escapeHtml(group.academic_year || '2026')} - ${escapeHtml(semesterDisplay)}</div>
                        <div><strong>عدد الطلاب:</strong> ${group.student_count} طالب</div>
                    </div>
                </div>

                <div class="card-actions-bar">
                    <button class="btn btn-primary btn-sm btn-full" onclick="showStudentsPage(${group.id})">
                        <span class="material-symbols-outlined" style="font-size:16px;">visibility</span> عرض الطلاب
                    </button>
                    <button class="btn btn-secondary btn-sm btn-edit-action ${btnClass}" ${disabledAttr} onclick="toggleEditCard(${group.id})" title="${!isJobOpen ? (window.CREATE_GROUPS_JOB_MESSAGE || 'خدمة إنشاء وتعديل المجموعات غير مفعلة حالياً') : ''}">
                        <span class="material-symbols-outlined" style="font-size:16px;">edit</span> تعديل
                    </button>
                </div>

                <div class="card-edit-box hidden" id="card-edit-${group.id}">
                    <label class="form-label" style="font-size:0.8rem;">اسم المجموعة الجديد</label>
                    <input type="text" class="form-input" id="edit-name-${group.id}" value="${escapeHtml(group.name)}">
                    <div style="display:flex; gap:6px; margin-top:6px;">
                        <button class="btn btn-success btn-sm btn-full btn-edit-action ${btnClass}" ${disabledAttr} onclick="saveCardEdit(${group.id})">حفظ</button>
                        <button class="btn btn-ghost btn-sm" onclick="toggleEditCard(${group.id})">إلغاء</button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    applyCreateGroupsPermissionUI(isJobOpen);
}

function toggleEditCard(groupId) {
    if (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined' && !window.IS_CREATE_GROUPS_JOB_OPEN) {
        showToast(window.CREATE_GROUPS_JOB_MESSAGE || "⚠️ خدمة 'إنشاء المجموعات وتعديلها' غير مفعلة حالياً", 'error');
        return;
    }

    const editBox = document.getElementById(`card-edit-${groupId}`);
    if (editBox) {
        editBox.classList.toggle('hidden');
    }
}

function saveCardEdit(groupId) {
    if (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined' && !window.IS_CREATE_GROUPS_JOB_OPEN) {
        showToast(window.CREATE_GROUPS_JOB_MESSAGE || "⚠️ خدمة 'إنشاء المجموعات وتعديلها' غير مفعلة حالياً", 'error');
        return;
    }

    const newName = document.getElementById(`edit-name-${groupId}`)?.value.trim();
    if (!newName) {
        showToast('⚠️ الرجاء كتابة اسم المجموعة', 'warning');
        return;
    }

    const payload = {
        name: newName,
        student_ids: []
    };

    fetch(`/renewal/api/update-group/${groupId}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast('✅ تم تعديل بيانات المجموعة بنجاح', 'success');
                toggleEditCard(groupId);
                fetchFilteredGroups();
            } else {
                showToast(data.error || 'فشل تعديل المجموعة', 'error');
            }
        })
        .catch(err => {
            console.error('Error saving group edit:', err);
            showToast('خطأ في الاتصال أثناء حفظ التعديلات', 'error');
        });
}

// ============================================================
// 7. المعاينة والطباعة الرسمية المعتمدة (Print Official Sheet)
// ============================================================

let previewDistributionData = null;

function previewCreatedGroups() {
    const department = document.getElementById('departmentSelect')?.value;
    const level = document.getElementById('levelSelect')?.value;
    const semesterType = document.getElementById('semesterTypeSelect')?.value;
    const semesterYear = document.getElementById('semesterYearInput')?.value.trim();
    const course = document.getElementById('courseSelect')?.value;

    if (!department || !level || !semesterType || !semesterYear || !course) {
        showToast('⚠️ الرجاء اختيار كافة معايير الفلترة (التخصص، المستوى، المادة) قبل المعاينة', 'warning');
        return;
    }

    const fieldInputs = document.querySelectorAll('.dist-field-input');
    if (fieldInputs.length === 0) {
        showToast('⚠️ الرجاء تحديد عدد المجموعات والتوزيع أولاً', 'warning');
        return;
    }

    const groupsConfig = [];
    let totalRequested = 0;
    fieldInputs.forEach((input, idx) => {
        const name = input.getAttribute('data-group-name') || `مجموعة ${idx + 1}`;
        const targetCount = parseInt(input.value) || 0;
        groupsConfig.push({
            name: name,
            targetCount: targetCount,
            students: []
        });
        totalRequested += targetCount;
    });

    showToast('⏳ جاري جلب بيانات الطلاب ومعاينة المجموعات...', 'info');

    let url = `/renewal/api/group-students/?department=${encodeURIComponent(department)}&level=${encodeURIComponent(level)}&course=${encodeURIComponent(course)}`;
    if (semesterType) url += `&semester_type=${encodeURIComponent(semesterType)}`;
    if (semesterYear) url += `&semester_year=${encodeURIComponent(semesterYear)}`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            let allStudents = (data && data.success && Array.isArray(data.students)) ? data.students : [];

            if (allStudents.length > 0) {
                allStudents.sort((a, b) => {
                    const nameA = `${a.name || ''} ${a.father_name || ''} ${a.grandfather_name || ''} ${a.last_name || ''}`.trim();
                    const nameB = `${b.name || ''} ${b.father_name || ''} ${b.grandfather_name || ''} ${b.last_name || ''}`.trim();
                    return nameA.localeCompare(nameB, 'ar');
                });
            }

            let studentIndex = 0;
            groupsConfig.forEach(group => {
                const slice = allStudents.slice(studentIndex, studentIndex + group.targetCount);
                group.students = slice;
                studentIndex += group.targetCount;
            });

            previewDistributionData = groupsConfig;
            renderPreviewContent(totalRequested, allStudents.length);
        })
        .catch(err => {
            console.error('Error fetching real students for preview:', err);
            previewDistributionData = groupsConfig;
            renderPreviewContent(totalRequested, 0);
        });
}

function renderPreviewContent(totalRequested, availableTotal) {
    const previewSec = document.getElementById('previewGroupsSection');
    const container = document.getElementById('previewGroupsContainer');
    if (!previewSec || !container) return;

    const deptSelect = document.getElementById('departmentSelect');
    const levelSelect = document.getElementById('levelSelect');
    const courseSelect = document.getElementById('courseSelect');

    const deptText = deptSelect && deptSelect.selectedIndex >= 0 ? deptSelect.options[deptSelect.selectedIndex]?.text : '-';
    const levelText = levelSelect && levelSelect.selectedIndex >= 0 ? levelSelect.options[levelSelect.selectedIndex]?.text : '-';
    const courseText = courseSelect && courseSelect.selectedIndex >= 0 ? courseSelect.options[courseSelect.selectedIndex]?.text : '-';

    document.getElementById('previewDeptName').textContent = deptText;
    document.getElementById('previewLevelNum').textContent = levelText;
    document.getElementById('previewCourseName').textContent = courseText;

    const summaryText = `${availableTotal} طالب في القاعدة (المطلوب توزيعه: ${totalRequested} طالب)`;
    document.getElementById('previewTotalCount').textContent = summaryText;

    let html = '';
    if (!previewDistributionData || previewDistributionData.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>لا توجد مجموعات لعرضها</p></div>';
        return;
    }

    previewDistributionData.forEach((grp) => {
        html += `
            <div class="preview-group-card">
                <div class="preview-group-header">
                    <h3 class="preview-group-title">
                        <span class="material-symbols-outlined">groups</span>
                        ${escapeHtml(grp.name)}
                    </h3>
                    <span class="meta-tag meta-badge-count">الطلاب المضافون: ${grp.students.length} طالب من أصل ${grp.targetCount}</span>
                </div>
                <div class="table-responsive">
                    <table class="students-table preview-table">
                        <thead>
                            <tr>
                                <th class="text-center" style="width:50px;">#</th>
                                <th class="text-center" style="width:130px;">رقم القيد</th>
                                <th>اسم الطالب (أبجدياً)</th>
                                <th>التخصص</th>
                                <th class="text-center" style="width:100px;">المستوى</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (grp.students.length === 0) {
            html += `
                <tr>
                    <td colspan="5" class="text-center empty-cell">
                        <span class="material-symbols-outlined" style="vertical-align:middle; margin-left:6px; color:var(--slate);">info</span>
                        لا يوجد طلاب مسجلون حالياً لهذه المجموعة في المنظومة
                    </td>
                </tr>
            `;
        } else {
            grp.students.forEach((st, sIndex) => {
                const fullName = `${st.name || ''} ${st.father_name || ''} ${st.grandfather_name || ''} ${st.last_name || ''}`.trim().replace(/\s+/g, ' ');
                html += `
                    <tr>
                        <td class="text-center font-bold">${sIndex + 1}</td>
                        <td class="text-center font-bold" style="color:var(--primary); font-family: monospace;">${escapeHtml(st.student_id || '-')}</td>
                        <td class="font-bold">${escapeHtml(fullName)}</td>
                        <td>${escapeHtml(st.department_name || deptText)}</td>
                        <td class="text-center">${escapeHtml(String(st.level_number || levelText))}</td>
                    </tr>
                `;
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    previewSec.classList.remove('hidden');
    previewSec.scrollIntoView({ behavior: 'smooth' });
}

function hidePreviewSection() {
    const previewSec = document.getElementById('previewGroupsSection');
    if (previewSec) previewSec.classList.add('hidden');
}

function confirmAndSaveGroups() {
    if (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined' && !window.IS_CREATE_GROUPS_JOB_OPEN) {
        showToast(window.CREATE_GROUPS_JOB_MESSAGE || "⚠️ خدمة 'إنشاء المجموعات' غير مفعلة حالياً", 'error');
        return;
    }

    if (!previewDistributionData || previewDistributionData.length === 0) {
        showToast('⚠️ لا توجد بيانات معاينة مؤكدة للحفظ', 'warning');
        return;
    }

    const department = document.getElementById('departmentSelect')?.value;
    const level = document.getElementById('levelSelect')?.value;
    const semesterType = document.getElementById('semesterTypeSelect')?.value;
    const semesterYear = getSelectedAcademicYear();
    const course = document.getElementById('courseSelect')?.value;

    if (!department || !level || !semesterType || !semesterYear || !course) {
        showToast('⚠️ الرجاء اختيار كافة معايير الفلترة قبل الحفظ', 'warning');
        return;
    }

    const groupsPayload = previewDistributionData.map(grp => ({
        name: grp.name,
        students: grp.students.map(s => s.id)
    }));

    const payload = {
        department_id: parseInt(department),
        level_id: parseInt(level),
        semester_type: semesterType,
        semester: semesterType,
        semester_year: semesterYear,
        academic_year: semesterYear,
        course_id: parseInt(course),
        groups: groupsPayload
    };

    showToast('⏳ جاري تأكيد وإنشاء المجموعات في النظام...', 'info');

    fetch('/renewal/api/save-groups/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast(data.message || '✅ تم تأكيد وإنشاء المجموعات وتوزيع الطلاب بنجاح في المنظومة', 'success');
                previewDistributionData = null;
                hidePreviewSection();
                hideCreateSection();
                showGroupsSection();
            } else {
                showToast('❌ فشل التأكيد: ' + (data.error || 'حدث خطأ'), 'error');
            }
        })
        .catch(err => {
            console.error('Error confirming groups:', err);
            showToast('❌ خطأ في الاتصال بالخادم أثناء التأكيد والحفظ', 'error');
        });
}

function saveCreatedGroups() {
    if (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined' && !window.IS_CREATE_GROUPS_JOB_OPEN) {
        showToast(window.CREATE_GROUPS_JOB_MESSAGE || "⚠️ خدمة 'إنشاء المجموعات' غير مفعلة حالياً", 'error');
        return;
    }

    if (previewDistributionData && previewDistributionData.length > 0) {
        confirmAndSaveGroups();
        return;
    }

    const department = document.getElementById('departmentSelect')?.value;
    const level = document.getElementById('levelSelect')?.value;
    const semesterType = document.getElementById('semesterTypeSelect')?.value;
    const semesterYear = getSelectedAcademicYear();
    const course = document.getElementById('courseSelect')?.value;

    if (!department || !level || !semesterType || !semesterYear || !course) {
        showToast('⚠️ الرجاء اختيار كافة معايير الفلترة قبل الحفظ', 'warning');
        return;
    }

    const fieldInputs = document.querySelectorAll('.dist-field-input');
    if (fieldInputs.length === 0) {
        showToast('⚠️ لا توجد مجموعات منشأة للحفظ', 'warning');
        return;
    }

    const groupsPayload = [];
    fieldInputs.forEach(input => {
        const name = input.getAttribute('data-group-name') || 'مجموعة';
        groupsPayload.push({
            name: name,
            students: []
        });
    });

    const payload = {
        department_id: parseInt(department),
        level_id: parseInt(level),
        semester_type: semesterType,
        semester: semesterType,
        semester_year: semesterYear,
        academic_year: semesterYear,
        course_id: parseInt(course),
        groups: groupsPayload
    };

    fetch('/renewal/api/save-groups/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast(data.message || '✅ تم حفظ التوزيع بنجاح في النظام', 'success');
                hideCreateSection();
                showGroupsSection();
            } else {
                showToast('❌ فشل الحفظ: ' + (data.error || 'حدث خطأ'), 'error');
            }
        })
        .catch(err => {
            console.error('Error saving groups:', err);
            showToast('❌ خطأ في الاتصال بالخادم أثناء الحفظ', 'error');
        });
}

// ============================================================
// 🖨️ طباعة كشف الطلاب بالمواصفات الرسمية المطلوبة بالضبط
// - الفلاتر والبيانات فوق الجدول (التخصص، المستوى، المادة، العدد الكلي، التاريخ)
// - الترتيب الأبجدي الحتمي من (أ) إلى (ي)
// - الأعمدة (# ، رقم القيد ، اسم الطالب ، التوقيع/الملاحظات)
// - إطار أسود كامل وشعار الكلية والتوقيع الرسمي للمسجل العام
// ============================================================
async function printCurrentGroupView() {
    if (!currentGroupData) {
        showToast('⚠️ لا توجد بيانات مجموعة للطباعة', 'warning');
        return;
    }

    const group = currentGroupData;
    const dateStr = new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    // 🔥 1. ترتيب قائمة الطلاب حتمياً وأبجدياً من (أ) إلى (ي)
    let students = group.students || [];
    students.sort((a, b) => {
        const nameA = `${a.name || ''} ${a.father_name || ''} ${a.grandfather_name || ''} ${a.last_name || ''}`.trim();
        const nameB = `${b.name || ''} ${b.father_name || ''} ${b.grandfather_name || ''} ${b.last_name || ''}`.trim();
        return nameA.localeCompare(nameB, 'ar');
    });

    // جلب اسم ومنصب منسق الدراسة والامتحانات (أو منسق القسم) بدقة تامة وبدون تداخل
    let coordinatorName = '';
    let coordinatorTitle = 'منسقة دراسة والامتحانات';
    const deptName = group.department_name || group.department || '';

    if (window.OfficialsHelper) {
        const off = await window.OfficialsHelper.getOfficialAsync('exams_coordinator', deptName);
        if (off) {
            coordinatorName = window.OfficialsHelper.buildName(off);
            if (off.position) coordinatorTitle = off.position;
        }
    }
    if (!coordinatorName) coordinatorName = 'أ. أبرار';

    // بناء صفوف الجدول الأبجدي
    let rowsHtml = '';
    if (students.length === 0) {
        rowsHtml = `
            <tr>
                <td colspan="4" style="padding: 20px; text-align: center; font-weight: 800; border: 1px solid #000;">
                    لا يوجد طلاب مسجلون في هذه المجموعة.
                </td>
            </tr>
        `;
    } else {
        students.forEach((s, i) => {
            const fullName = `${s.name || ''} ${s.father_name || ''} ${s.grandfather_name || ''} ${s.last_name || ''}`.trim().replace(/\s+/g, ' ');
            rowsHtml += `
                <tr>
                    <td style="padding: 7px 5px; border: 1px solid #000; text-align: center; font-weight: 800; font-size: 12px;">${i + 1}</td>
                    <td style="padding: 7px 5px; border: 1px solid #000; text-align: center; font-weight: 900; font-family: monospace; font-size: 13px;">${escapeHtml(s.student_id || '-')}</td>
                    <td style="padding: 7px 10px; border: 1px solid #000; text-align: right; font-weight: 800; font-size: 13px;">${escapeHtml(fullName)}</td>
                    <td style="padding: 7px 5px; border: 1px solid #000; text-align: center; font-size: 12px;"></td>
                </tr>
            `;
        });
    }

    // 📄 مستند الطباعة الرسمي المعتمد A4
    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>كشف طلاب - ${escapeHtml(group.name)}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    
    @page {
        size: A4 portrait;
        margin: 6mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }
    html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000;
        font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
        direction: rtl;
        font-size: 12.5px;
    }

    /* الإطار الأسود الخارجي المعتمد A4 */
    .print-page-frame {
        width: 100%;
        min-height: 275mm;
        margin: 0 auto;
        padding: 18px 22px;
        border: 2px solid #000000;
        background: #ffffff;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    /* الترويسة والشعار فوق دولة ليبيا */
    .bf-header {
        text-align: center;
        margin-bottom: 8px;
    }
    .bf-logo {
        width: 75px;
        height: 75px;
        object-fit: contain;
        margin: 0 auto 4px auto;
        display: block;
    }
    .bf-gov {
        font-size: 13px;
        font-weight: 700;
        color: #000;
        line-height: 1.3;
    }
    .bf-college {
        font-size: 16px;
        font-weight: 900;
        color: #000;
        margin-top: 2px;
    }
    .bf-line {
        border-bottom: 1.5px solid #000000;
        margin: 6px 0;
        width: 100%;
        display: block;
    }
    .bf-title {
        font-size: 18.5px;
        font-weight: 900;
        margin: 6px 0;
        text-align: center;
    }

    /* شريط الفلاتر والمعلومات المفصلة فوق الجدول */
    .info-filters-grid {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        border: 1.5px solid #000000;
        background: #f8fafc;
        border-radius: 6px;
        padding: 8px 14px;
        margin: 10px 0 14px 0;
        font-size: 13px;
        font-weight: 800;
    }
    .info-item {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .info-lbl {
        font-weight: 800;
        color: #000;
    }
    .info-val {
        font-weight: 900;
        color: #000;
    }

    /* جدول كشف الطلاب الأبجدي */
    .students-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }
    .students-table th {
        background-color: #f1f5f9;
        color: #000;
        border: 1px solid #000;
        padding: 7px 5px;
        font-size: 12.5px;
        font-weight: 900;
    }
    .students-table td {
        border: 1px solid #000;
        font-size: 12.5px;
    }

    /* اعتماد التوقيع والختم باليسار أسفل الجدول */
    .bf-signatures-container {
        display: flex;
        justify-content: flex-end;
        margin-top: 25px;
        padding-left: 10px;
    }
    .bf-sig-col {
        text-align: center;
        width: 250px;
    }
    .bf-sig-name {
        font-size: 13.5px;
        font-weight: 900;
        margin-bottom: 3px;
        min-height: 18px;
    }
    .bf-sig-title {
        font-size: 12.5px;
        font-weight: 800;
        color: #111;
        margin-bottom: 20px;
    }
    .bf-sig-dots {
        font-size: 12.5px;
        font-weight: 800;
    }

    @media print {
        @page { size: A4 portrait; margin: 5mm; }
        html, body { width: 100%; height: 100%; }
        .print-page-frame { min-height: 275mm; border: 2px solid #000000; }
    }
</style>
</head>
<body>
    <div class="print-page-frame">
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
                    <img class="bf-logo" src="${logoUrl}" alt="شعار الكلية" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.onerror=null; this.style.display='none';">
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
            <div class="bf-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">كشف طلاب - ${escapeHtml(group.name)}</div>

            <!-- الفلاتر والمعايير المسجلة فوق الجدول -->
            <div class="info-filters-grid">
                <div class="info-item">
                    <span class="info-lbl">التخصص / القسم:</span>
                    <span class="info-val">${escapeHtml(group.department_name || '-')}</span>
                </div>
                <div class="info-item">
                    <span class="info-lbl">المستوى الدراسي:</span>
                    <span class="info-val">المستوى ${escapeHtml(group.level_number || '-')}</span>
                </div>
                <div class="info-item">
                    <span class="info-lbl">المادة الدراسية:</span>
                    <span class="info-val">${escapeHtml((group.course_name || 'عام').split(' / ')[0].trim())}</span>
                </div>
                <div class="info-item">
                    <span class="info-lbl">العدد الكلي:</span>
                    <span class="info-val">${group.student_count || students.length} طالب</span>
                </div>
                <div class="info-item">
                    <span class="info-lbl">التاريخ:</span>
                    <span class="info-val">${dateStr}</span>
                </div>
            </div>

            <!-- جدول الطلاب الأبجدي -->
            <table class="students-table">
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">#</th>
                        <th style="width: 120px; text-align: center;">رقم القيد</th>
                        <th style="text-align: right; padding-right: 12px;">اسم الطالب </th>
                        <th style="width: 150px; text-align: center;">التوقيع / ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>

        <!-- التوقيع والختم في الأسفل باليسار -->
        <div class="bf-signatures-container">
            <div class="bf-sig-col">
                <div class="bf-sig-name">${escapeHtml(coordinatorName)}</div>
                <div class="bf-sig-title">${escapeHtml(coordinatorTitle)}</div>
                <div class="bf-sig-dots">التوقيع والختم: ....................................</div>
            </div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 200);
        };
    <\/script>
</body>
</html>`;

    // 4. تنفيذ الطباعة بـ iframe
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    }, 3000);
}

function requestSwap(studentId) {
    if (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined' && !window.IS_CREATE_GROUPS_JOB_OPEN) {
        showToast(window.CREATE_GROUPS_JOB_MESSAGE || "⚠️ خدمة 'إنشاء المجموعات وتعديلها' غير مفعلة حالياً", 'error');
        return;
    }

    if (!studentId) {
        showToast('⚠️ لم يتم تحديد الطالب', 'warning');
        return;
    }
    window.location.href = `/renewal/group-swap/?student_id=${studentId}`;
}

function clearAll() {
    if (document.getElementById('departmentSelect')) {
        document.getElementById('departmentSelect').value = '';
        if (document.getElementById('departmentSelect').rebuildCustomOptions) document.getElementById('departmentSelect').rebuildCustomOptions();
    }
    if (document.getElementById('levelSelect')) {
        document.getElementById('levelSelect').value = '';
        if (document.getElementById('levelSelect').rebuildCustomOptions) document.getElementById('levelSelect').rebuildCustomOptions();
    }
    if (document.getElementById('semesterTypeSelect')) {
        document.getElementById('semesterTypeSelect').value = '';
        if (document.getElementById('semesterTypeSelect').rebuildCustomOptions) document.getElementById('semesterTypeSelect').rebuildCustomOptions();
    }
    if (document.getElementById('semesterYearSelect')) {
        document.getElementById('semesterYearSelect').value = window.ACTIVE_ACADEMIC_YEAR || '2026';
        if (document.getElementById('semesterYearSelect').rebuildCustomOptions) document.getElementById('semesterYearSelect').rebuildCustomOptions();
    }
    if (document.getElementById('semesterYearInput')) {
        document.getElementById('semesterYearInput').value = window.ACTIVE_ACADEMIC_YEAR || '2026';
    }

    const courseSelect = document.getElementById('courseSelect');
    if (courseSelect) {
        courseSelect.disabled = true;
        courseSelect.innerHTML = '<option value="">-- اختر التخصص والمستوى أولاً --</option>';
        if (courseSelect.rebuildCustomOptions) courseSelect.rebuildCustomOptions();
    }

    hideCreateSection();
    hidePreviewSection();
    hideStudentsPage();
    document.getElementById('groupsSection')?.classList.add('hidden');

    showToast('🧹 تم مسح جميع فلاتر البحث والمحتوى', 'info');
}

function applyCreateGroupsPermissionUI(isOpen, message) {
    const isJobOpen = (typeof isOpen !== 'undefined') ? Boolean(isOpen) : (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined' ? Boolean(window.IS_CREATE_GROUPS_JOB_OPEN) : true);
    const displayMsg = message || window.CREATE_GROUPS_JOB_MESSAGE || '⚠️ خدمة "إنشاء المجموعات" غير مفعلة حالياً في إدارة الوظائف.';

    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');

    if (banner) {
        if (!isJobOpen) {
            if (bannerText) bannerText.textContent = displayMsg;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    const createAndEditButtons = [
        document.getElementById('btn-show-create-section'),
        document.getElementById('btn-auto-distribute'),
        document.getElementById('btn-add-field'),
        document.getElementById('btn-preview-groups'),
        document.getElementById('btn-save-groups'),
        document.getElementById('btn-confirm-save-groups'),
        document.getElementById('editStudentsBtn'),
        ...document.querySelectorAll('.btn-create-action')
    ];

    createAndEditButtons.forEach(btn => {
        if (btn) {
            if (!isJobOpen) {
                btn.disabled = true;
                btn.setAttribute('disabled', 'disabled');
                btn.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btn.style.setProperty('opacity', '0.5', 'important');
                btn.style.setProperty('cursor', 'not-allowed', 'important');
                btn.style.setProperty('pointer-events', 'none', 'important');
                btn.style.setProperty('filter', 'grayscale(80%)', 'important');
                btn.title = displayMsg;
            } else {
                btn.disabled = false;
                btn.removeAttribute('disabled');
                btn.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btn.style.setProperty('opacity', '1', 'important');
                btn.style.setProperty('cursor', 'pointer', 'important');
                btn.style.setProperty('pointer-events', 'auto', 'important');
                btn.style.setProperty('filter', 'none', 'important');
                btn.title = '';
            }
        }
    });
}

function updateJobPermissionState() {
    const isOpen = (typeof window.IS_CREATE_GROUPS_JOB_OPEN !== 'undefined') ? Boolean(window.IS_CREATE_GROUPS_JOB_OPEN) : true;
    const message = window.CREATE_GROUPS_JOB_MESSAGE || '';

    applyCreateGroupsPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.success) {
                window.IS_CREATE_GROUPS_JOB_OPEN = Boolean(data.is_create_groups_job_open);
                window.CREATE_GROUPS_JOB_MESSAGE = data.create_groups_job_message || '';
                applyCreateGroupsPermissionUI(window.IS_CREATE_GROUPS_JOB_OPEN, window.CREATE_GROUPS_JOB_MESSAGE);
            }
        })
        .catch(err => {
            console.warn('⚠️ Dynamic create groups job permission check error:', err);
        });
}
window.updateJobPermissionState = updateJobPermissionState;

document.addEventListener('DOMContentLoaded', () => {
    const deptSelect = document.getElementById('departmentSelect');
    const lvlSelect = document.getElementById('levelSelect');

    if (deptSelect) deptSelect.addEventListener('change', loadCourses);
    if (lvlSelect) lvlSelect.addEventListener('change', loadCourses);

    loadCourses();
    updateJobPermissionState();
});

// تصدير الدوال للنطاق العام
window.handleCourseFilter = handleCourseFilter;
window.loadCourses = loadCourses;
window.addDistributionField = addDistributionField;
window.removeDistributionField = removeDistributionField;
window.autoDistribute = autoDistribute;
window.calculateDistribution = calculateDistribution;
window.showCreateSection = showCreateSection;
window.hideCreateSection = hideCreateSection;
window.showGroupsSection = showGroupsSection;
window.toggleExistingGroups = toggleExistingGroups;
window.showStudentsPage = showStudentsPage;
window.hideStudentsPage = hideStudentsPage;
window.renderStudentsPageContent = renderStudentsPageContent;
window.fetchFilteredGroups = fetchFilteredGroups;
window.renderGroupCards = renderGroupCards;
window.toggleEditCard = toggleEditCard;
window.saveCardEdit = saveCardEdit;
window.previewCreatedGroups = previewCreatedGroups;
window.renderPreviewContent = renderPreviewContent;
window.hidePreviewSection = hidePreviewSection;
window.confirmAndSaveGroups = confirmAndSaveGroups;
window.saveCreatedGroups = saveCreatedGroups;
window.printCurrentGroupView = printCurrentGroupView;
window.requestSwap = requestSwap;
window.clearAll = clearAll;
if (typeof window.showToast !== 'function') { window.showToast = showToast; }
window.showToastMessage = showToastMessage;
window.escapeHtml = escapeHtml;