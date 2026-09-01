// ============================================================
// === control_holds.js - التحكم وحجب نتائج الطلاب في الكنترول ===
// ============================================================

let currentStudentsList = [];

function applyHoldsPermissionUI(isOpen, message) {
    const isJobOpen = (typeof isOpen !== 'undefined') ? Boolean(isOpen) : (typeof window.IS_GRADE_HOLDS_JOB_OPEN !== 'undefined' ? Boolean(window.IS_GRADE_HOLDS_JOB_OPEN) : true);
    const displayMsg = message || window.GRADE_HOLDS_JOB_MESSAGE || '⚠️ خدمة "حجب الدرجات" غير مفعلة حالياً في إدارة الوظائف.';

    console.log(`🔐 Control Holds Job Permission State - Is Open: ${isJobOpen}`);

    if (!isJobOpen && typeof showToast === 'function') {
        showToast(displayMsg, true);
    }

    const targetButtons = [
        document.getElementById('btn-fetch-data'),
        document.getElementById('btn-bulk-block'),
        document.getElementById('btn-bulk-unblock')
    ];

    targetButtons.forEach(btn => {
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

    const tableSwitches = document.querySelectorAll('.holds-switch, .input-block-reason');
    tableSwitches.forEach(elem => {
        if (elem) {
            if (!isJobOpen) {
                elem.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                elem.style.setProperty('opacity', '0.5', 'important');
                elem.style.setProperty('pointer-events', 'none', 'important');
                elem.style.setProperty('cursor', 'not-allowed', 'important');
                if (elem.tagName === 'INPUT') elem.disabled = true;
            } else {
                elem.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                elem.style.setProperty('opacity', '1', 'important');
                elem.style.setProperty('pointer-events', 'auto', 'important');
                elem.style.setProperty('cursor', 'pointer', 'important');
                if (elem.tagName === 'INPUT') elem.disabled = false;
            }
        }
    });
}

function updateJobPermissionState() {
    const isOpen = (typeof window.IS_GRADE_HOLDS_JOB_OPEN !== 'undefined') ? Boolean(window.IS_GRADE_HOLDS_JOB_OPEN) : true;
    const message = window.GRADE_HOLDS_JOB_MESSAGE || '';

    applyHoldsPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_GRADE_HOLDS_JOB_OPEN = Boolean(data.is_grade_holds_job_open);
            window.GRADE_HOLDS_JOB_MESSAGE = data.grade_holds_job_message || '';
            applyHoldsPermissionUI(window.IS_GRADE_HOLDS_JOB_OPEN, window.GRADE_HOLDS_JOB_MESSAGE);
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic grade holds job permission check error:', err);
    });
}
window.updateJobPermissionState = updateJobPermissionState;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Control Holds Module...');
    
    // ربط العناصر والأحداث
    const btnFetch = document.getElementById('btn-fetch-data');
    const btnReset = document.getElementById('btn-reset-filters');
    const searchInput = document.getElementById('search-input');
    const btnBulkBlock = document.getElementById('btn-bulk-block');
    const btnBulkUnblock = document.getElementById('btn-bulk-unblock');

    if (btnFetch) btnFetch.addEventListener('click', fetchControlStudents);
    if (btnReset) btnReset.addEventListener('click', resetFilters);
    
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                filterTableLocally();
            }, 300);
        });
    }

    if (btnBulkBlock) btnBulkBlock.addEventListener('click', () => handleBulkBlock(true));
    if (btnBulkUnblock) btnBulkUnblock.addEventListener('click', () => handleBulkBlock(false));

    updateJobPermissionState();

    // تحميل البيانات لأول مرة
    fetchControlStudents();
});

// ============================================================
// === جلب بيانات الطلاب وحالة الحجب من الـ API
// ============================================================
function fetchControlStudents() {
    const semesterId = document.getElementById('semester-select')?.value || '';
    const departmentId = document.getElementById('department-select')?.value || '';
    const courseId = document.getElementById('course-select')?.value || '';
    const groupId = document.getElementById('group-select')?.value || '';
    const search = document.getElementById('search-input')?.value.trim() || '';

    const tbody = document.getElementById('holds-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="table-empty-state">
                    <span class="material-symbols-outlined empty-icon spin">sync</span>
                    <p>جاري تحميل كشف الكنترول والتحقق من حالة الحجب...</p>
                </td>
            </tr>
        `;
    }

    let url = `/grades/api/control-holds/students/?semester_id=${encodeURIComponent(semesterId)}&department_id=${encodeURIComponent(departmentId)}&course_id=${encodeURIComponent(courseId)}&group_id=${encodeURIComponent(groupId)}&search=${encodeURIComponent(search)}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.students) {
                currentStudentsList = data.students;
                renderTable(currentStudentsList);
                updateStats(currentStudentsList);
            } else {
                showToast(data.message || 'حدث خطأ أثناء جلب البيانات', true);
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="9" class="table-empty-state text-red">❌ ${escapeHtml(data.message || 'فشل جلب البيانات')}</td></tr>`;
                }
            }
        })
        .catch(err => {
            console.error('❌ Error fetching control students:', err);
            showToast('حدث خطأ في الاتصال بالخادم', true);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="9" class="table-empty-state text-red">❌ حدث خطأ في الاتصال بالخادم</td></tr>`;
            }
        });
}

// ============================================================
// === رندر جدول الطلاب
// ============================================================
function renderTable(students) {
    const tbody = document.getElementById('holds-table-body');
    const tableCountBadge = document.getElementById('table-count-badge');
    const isJobOpen = (typeof window.IS_GRADE_HOLDS_JOB_OPEN !== 'undefined') ? Boolean(window.IS_GRADE_HOLDS_JOB_OPEN) : true;
    
    if (tableCountBadge) {
        tableCountBadge.textContent = `${students.length} طالب`;
    }

    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="table-empty-state">
                    <span class="material-symbols-outlined empty-icon">person_search</span>
                    <p>لا يوجد طلاب مطبق عليهم هذا الفلتر</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = students.map((s, idx) => {
        const isBlocked = s.is_blocked;
        const blockReason = escapeHtml(s.block_reason || 'تجاوز نسبة الغياب الورقي');
        const rowClass = isBlocked ? 'row-blocked' : '';
        const midtermDisplay = s.midterm_score ? s.midterm_score : '--';
        const canEdit = (typeof window.CAN_EDIT_HOLDS === 'undefined' || window.CAN_EDIT_HOLDS === true);
        const disabledAttr = (!isJobOpen || !canEdit) ? 'disabled style="opacity: 0.5 !important; cursor: not-allowed !important;"' : '';
        const switchClass = (!isJobOpen || !canEdit) ? 'holds-switch opacity-50 pointer-events-none cursor-not-allowed' : 'holds-switch';

        return `
            <tr id="row-student-${s.student_db_id}-${s.course_id}" class="${rowClass}">
                <td class="text-center font-bold">${idx + 1}</td>
                <td class="font-bold text-primary">${escapeHtml(s.student_id)}</td>
                <td class="font-semibold">${escapeHtml(s.student_name)}</td>
                <td>${escapeHtml(s.department_name)}</td>
                <td><span class="badge-group">${escapeHtml(s.group_name)}</span></td>
                <td><span class="font-medium">${escapeHtml(s.course_code)}</span> - ${escapeHtml(s.course_name)}</td>
                <td class="text-center font-bold text-slate-700">${midtermDisplay}</td>
                <td class="text-center">
                    <div class="flex items-center justify-center gap-2">
                        <label class="${switchClass}">
                            <input type="checkbox" 
                                   id="toggle-${s.student_db_id}-${s.course_id}" 
                                   ${isBlocked ? 'checked' : ''} 
                                   ${disabledAttr}
                                   onchange="handleToggleChange(${s.grade_id}, ${s.student_db_id}, ${s.course_id}, ${s.semester_id}, this)">
                            <span class="holds-slider"></span>
                        </label>
                    </div>
                </td>
                <td>
                    <div class="flex items-center gap-2">
                        <input type="text" 
                               id="reason-${s.student_db_id}-${s.course_id}" 
                               class="input-block-reason ${(!isJobOpen || !canEdit) ? 'opacity-50 cursor-not-allowed' : ''}" 
                               value="${blockReason}" 
                               placeholder="سبب الحجب..."
                               ${disabledAttr}
                               onchange="handleReasonChange(${s.grade_id}, ${s.student_db_id}, ${s.course_id}, ${s.semester_id})">
                        <span id="badge-status-${s.student_db_id}-${s.course_id}" class="badge-status ${isBlocked ? 'badge-blocked' : 'badge-active'}">
                            ${isBlocked ? '🔒 محجوب' : '✅ نشط'}
                        </span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    applyHoldsPermissionUI(isJobOpen);
}

// ============================================================
// === معالجة تغيير زر التبديل (Toggle Switch)
// ============================================================
function handleToggleChange(gradeId, studentDbId, courseId, semesterId, checkbox) {
    if (typeof window.IS_GRADE_HOLDS_JOB_OPEN !== 'undefined' && !window.IS_GRADE_HOLDS_JOB_OPEN) {
        showToast(window.GRADE_HOLDS_JOB_MESSAGE || "⚠️ خدمة 'حجب الدرجات' غير مفعلة حالياً", true);
        if (checkbox) checkbox.checked = !checkbox.checked;
        return;
    }

    const isBlocked = checkbox.checked;
    const reasonInput = document.getElementById(`reason-${studentDbId}-${courseId}`);
    const blockReason = reasonInput ? reasonInput.value.trim() : 'تجاوز نسبة الغياب الورقي';

    executeToggleBlock(gradeId, studentDbId, courseId, semesterId, isBlocked, blockReason, checkbox);
}

// ============================================================
// === معالجة تعديل سبب الحجب
// ============================================================
function handleReasonChange(gradeId, studentDbId, courseId, semesterId) {
    if (typeof window.IS_GRADE_HOLDS_JOB_OPEN !== 'undefined' && !window.IS_GRADE_HOLDS_JOB_OPEN) {
        showToast(window.GRADE_HOLDS_JOB_MESSAGE || "⚠️ خدمة 'حجب الدرجات' غير مفعلة حالياً", true);
        return;
    }

    const checkbox = document.getElementById(`toggle-${studentDbId}-${courseId}`);
    if (!checkbox || !checkbox.checked) return; // إذا لم يكن محجوباً، لا حاجة للتحديث الفوري

    const reasonInput = document.getElementById(`reason-${studentDbId}-${courseId}`);
    const blockReason = reasonInput ? reasonInput.value.trim() : 'تجاوز نسبة الغياب الورقي';

    executeToggleBlock(gradeId, studentDbId, courseId, semesterId, true, blockReason, checkbox);
}

// ============================================================
// === إرسال طلب التبديل إلى الـ API
// ============================================================
function executeToggleBlock(gradeId, studentDbId, courseId, semesterId, isBlocked, blockReason, checkbox) {
    if (typeof window.IS_GRADE_HOLDS_JOB_OPEN !== 'undefined' && !window.IS_GRADE_HOLDS_JOB_OPEN) {
        showToast(window.GRADE_HOLDS_JOB_MESSAGE || "⚠️ خدمة 'حجب الدرجات' غير مفعلة حالياً", true);
        if (checkbox) checkbox.checked = !isBlocked;
        return;
    }

    const payload = {
        grade_id: gradeId,
        student_db_id: studentDbId,
        course_id: courseId,
        semester_id: semesterId,
        is_blocked: isBlocked,
        block_reason: blockReason || 'تجاوز نسبة الغياب الورقي'
    };

    fetch('/grades/api/toggle-block/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') || ''
        },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message, false);
            
            // تحديث العنصر في القائمة المحلية
            const studentObj = currentStudentsList.find(s => s.student_db_id === studentDbId && s.course_id === courseId);
            if (studentObj) {
                studentObj.is_blocked = data.is_blocked;
                studentObj.block_reason = data.block_reason;
                if (data.grade_id) studentObj.grade_id = data.grade_id;
            }

            // تحديث واجهة الصف الملاحَظ
            const row = document.getElementById(`row-student-${studentDbId}-${courseId}`);
            const badge = document.getElementById(`badge-status-${studentDbId}-${courseId}`);
            
            if (row) {
                if (data.is_blocked) {
                    row.classList.add('row-blocked');
                } else {
                    row.classList.remove('row-blocked');
                }
            }

            if (badge) {
                badge.className = `badge-status ${data.is_blocked ? 'badge-blocked' : 'badge-active'}`;
                badge.textContent = data.is_blocked ? '🔒 محجوب' : '✅ نشط';
            }

            updateStats(currentStudentsList);
        } else {
            showToast(data.message || 'فشلت عملية التعديل', true);
            if (checkbox) checkbox.checked = !isBlocked;
        }
    })
    .catch(err => {
        console.error('❌ Error toggling block status:', err);
        showToast('حدث خطأ في الشبكة أثناء التعديل', true);
        if (checkbox) checkbox.checked = !isBlocked;
    });
}

// ============================================================
// === نافذة التأكيد المخصصة (Custom Confirmation Modal)
// ============================================================
function showCustomConfirm(title, message, iconName = 'help') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const titleEl = document.getElementById('modal-confirm-title');
        const msgEl = document.getElementById('modal-confirm-message');
        const iconEl = document.getElementById('modal-confirm-icon');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');

        if (!modal) {
            resolve(confirm(message));
            return;
        }

        if (titleEl) titleEl.textContent = title || 'تأكيد الإجراء';
        if (msgEl) msgEl.textContent = message || '';
        if (iconEl) iconEl.textContent = iconName || 'help';

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        function cleanup(result) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
            btnConfirm.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
            resolve(result);
        }

        function onConfirm() { cleanup(true); }
        function onCancel() { cleanup(false); }

        btnConfirm.addEventListener('click', onConfirm, { once: true });
        btnCancel.addEventListener('click', onCancel, { once: true });
    });
}

// ============================================================
// === الحجب / فك الحجب الجماعي للكشف الحالي
// ============================================================
async function handleBulkBlock(targetBlockedStatus) {
    if (typeof window.IS_GRADE_HOLDS_JOB_OPEN !== 'undefined' && !window.IS_GRADE_HOLDS_JOB_OPEN) {
        showToast(window.GRADE_HOLDS_JOB_MESSAGE || "⚠️ خدمة 'حجب الدرجات' غير مفعلة حالياً", true);
        return;
    }

    if (!currentStudentsList || currentStudentsList.length === 0) {
        showToast('لا يوجد طلاب في الكشف لتنفيذ العملية عليهم', true);
        return;
    }

    const actionName = targetBlockedStatus ? 'حجب' : 'فك حجب';
    const confirmed = await showCustomConfirm(
        `تأكيد ${actionName} النتائج`,
        `هل أنت تأكد من رغبتك في ${actionName} جميع الطلاب الظاهرين حالياً بالجدول (${currentStudentsList.length} طالب)؟`
    );

    if (!confirmed) {
        return;
    }

    let completed = 0;
    showToast(`جاري ${actionName} النتائج...`, false);

    currentStudentsList.forEach(s => {
        const payload = {
            grade_id: s.grade_id,
            student_db_id: s.student_db_id,
            course_id: s.course_id,
            semester_id: s.semester_id,
            is_blocked: targetBlockedStatus,
            block_reason: s.block_reason || 'تجاوز نسبة الغياب الورقي'
        };

        fetch('/grades/api/toggle-block/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken') || ''
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                s.is_blocked = targetBlockedStatus;
                if (data.grade_id) s.grade_id = data.grade_id;
            }
            completed++;
            if (completed === currentStudentsList.length) {
                renderTable(currentStudentsList);
                updateStats(currentStudentsList);
                showToast(`تم ${actionName} نتائج جميع طلاب الكشف المعروض بنجاح 🎉`, false);
            }
        })
        .catch(err => {
            completed++;
            if (completed === currentStudentsList.length) {
                renderTable(currentStudentsList);
                updateStats(currentStudentsList);
            }
        });
    });
}

// ============================================================
// === تحديث الكروت الإحصائية
// ============================================================
function updateStats(students) {
    const totalEl = document.getElementById('stat-total-students');
    const activeEl = document.getElementById('stat-active-students');
    const blockedEl = document.getElementById('stat-blocked-students');

    const total = students ? students.length : 0;
    const blocked = students ? students.filter(s => s.is_blocked).length : 0;
    const active = total - blocked;

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (blockedEl) blockedEl.textContent = blocked;
}

// ============================================================
// === الفلترة المحلية بالشريط السريع
// ============================================================
function filterTableLocally() {
    const searchVal = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (!searchVal) {
        renderTable(currentStudentsList);
        return;
    }

    const filtered = currentStudentsList.filter(s => 
        (s.student_id && s.student_id.toLowerCase().includes(searchVal)) ||
        (s.student_name && s.student_name.toLowerCase().includes(searchVal))
    );

    renderTable(filtered);
}

// ============================================================
// === إعادة ضبط الفلاتر
// ============================================================
function resetFilters() {
    document.getElementById('semester-select').selectedIndex = 0;
    document.getElementById('department-select').value = '';
    document.getElementById('course-select').value = '';
    document.getElementById('group-select').value = '';
    document.getElementById('search-input').value = '';

    fetchControlStudents();
}

// ============================================================
// === دالة التوست للإشعارات
// ============================================================
function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `holds-toast ${isError ? 'holds-toast-error' : 'holds-toast-success'}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined">${isError ? 'error' : 'check_circle'}</span>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ============================================================
// === دوال مساعدة
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
