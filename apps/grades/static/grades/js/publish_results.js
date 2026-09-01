// ============================================================
// === publish_results.js - اعتماد ونشر نتائج المواد في الكنترول ===
// ============================================================

let currentCoursesList = [];
let pendingPublishAction = null; // تخزين البيانات المعلقة للاعتماد في المودال

function applyApprovalPermissionUI(isOpen, message) {
    const isJobOpen = (typeof isOpen !== 'undefined') ? Boolean(isOpen) : (typeof window.IS_GRADE_APPROVAL_JOB_OPEN !== 'undefined' ? Boolean(window.IS_GRADE_APPROVAL_JOB_OPEN) : true);
    const displayMsg = message || window.GRADE_APPROVAL_JOB_MESSAGE || '⚠️ خدمة "اعتماد الدرجات" غير مفعلة حالياً في إدارة الوظائف.';

    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');

    console.log(`🔐 Grade Approval Job Permission State - Is Open: ${isJobOpen}`);

    if (banner) {
        if (!isJobOpen) {
            if (bannerText) bannerText.textContent = displayMsg;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    const targetButtons = [
        document.getElementById('btn-fetch-courses'),
        document.getElementById('btn-modal-confirm')
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

    const filterElements = [
        document.getElementById('semester-select'),
        document.getElementById('department-select'),
        document.getElementById('period-select'),
        document.getElementById('search-input')
    ];

    filterElements.forEach(elem => {
        if (elem) {
            if (!isJobOpen) {
                elem.disabled = true;
                elem.classList.add('opacity-60', 'cursor-not-allowed');
                elem.style.setProperty('opacity', '0.6', 'important');
                elem.style.setProperty('cursor', 'not-allowed', 'important');
                elem.title = displayMsg;
            } else {
                elem.disabled = false;
                elem.classList.remove('opacity-60', 'cursor-not-allowed');
                elem.style.setProperty('opacity', '1', 'important');
                elem.style.setProperty('cursor', 'auto', 'important');
                elem.title = '';
            }
        }
    });

    const rowButtons = document.querySelectorAll('.btn-act, .btn-act-publish, .btn-act-unpublish');
    rowButtons.forEach(btn => {
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
    const isOpen = (typeof window.IS_GRADE_APPROVAL_JOB_OPEN !== 'undefined') ? Boolean(window.IS_GRADE_APPROVAL_JOB_OPEN) : true;
    const message = window.GRADE_APPROVAL_JOB_MESSAGE || '';

    applyApprovalPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_GRADE_APPROVAL_JOB_OPEN = Boolean(data.is_grade_approval_job_open);
            window.GRADE_APPROVAL_JOB_MESSAGE = data.grade_approval_job_message || '';
            applyApprovalPermissionUI(window.IS_GRADE_APPROVAL_JOB_OPEN, window.GRADE_APPROVAL_JOB_MESSAGE);
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic grade approval job permission check error:', err);
    });
}
window.updateJobPermissionState = updateJobPermissionState;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Publish Results Module...');
    
    // ربط العناصر والأحداث
    const btnFetch = document.getElementById('btn-fetch-courses');
    const btnReset = document.getElementById('btn-reset-filters');
    const searchInput = document.getElementById('search-input');
    const periodSelect = document.getElementById('period-select');

    const modal = document.getElementById('publish-modal');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');

    if (btnFetch) btnFetch.addEventListener('click', fetchCoursesPublishStatus);
    if (btnReset) btnReset.addEventListener('click', resetFilters);
    if (periodSelect) periodSelect.addEventListener('change', fetchCoursesPublishStatus);
    
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                filterCoursesLocally();
            }, 300);
        });
    }

    if (btnModalCancel) btnModalCancel.addEventListener('click', closeModal);
    if (btnModalConfirm) btnModalConfirm.addEventListener('click', confirmExecutePublish);

    // إغلاق المودال عند الضغط خارجه
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    updateJobPermissionState();

    // تحميل البيانات المبدئية
    fetchCoursesPublishStatus();
});

// ============================================================
// === جلب بيانات المواد وحالة النشر من الـ API
// ============================================================
function fetchCoursesPublishStatus() {
    const semesterId = document.getElementById('semester-select')?.value || '';
    const departmentId = document.getElementById('department-select')?.value || '';
    const period = document.getElementById('period-select')?.value || 'midterm';
    const search = document.getElementById('search-input')?.value.trim() || '';

    const tbody = document.getElementById('publish-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="table-empty-state">
                    <span class="material-symbols-outlined empty-icon spin">sync</span>
                    <p>جاري فحص وتحديث حالات النشر للمواد الدراسية...</p>
                </td>
            </tr>
        `;
    }

    let url = `/grades/api/get-courses-publish-status/?semester_id=${encodeURIComponent(semesterId)}&department_id=${encodeURIComponent(departmentId)}&period=${encodeURIComponent(period)}&search=${encodeURIComponent(search)}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.courses) {
                currentCoursesList = data.courses;
                renderCoursesTable(currentCoursesList);
                updateStats(currentCoursesList);
            } else {
                showToast(data.message || 'حدث خطأ أثناء جلب المواد', true);
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="10" class="table-empty-state text-red">❌ ${escapeHtml(data.message || 'فشل جلب المواد')}</td></tr>`;
                }
            }
        })
        .catch(err => {
            console.error('❌ Error fetching courses status:', err);
            showToast('حدث خطأ في الاتصال بالخادم', true);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="10" class="table-empty-state text-red">❌ حدث خطأ في الاتصال بالخادم</td></tr>`;
            }
        });
}

// ============================================================
// === رندر جدول المواد
// ============================================================
function renderCoursesTable(courses) {
    const tbody = document.getElementById('publish-table-body');
    const tableCountBadge = document.getElementById('table-count-badge');
    const isJobOpen = (typeof window.IS_GRADE_APPROVAL_JOB_OPEN !== 'undefined') ? Boolean(window.IS_GRADE_APPROVAL_JOB_OPEN) : true;
    
    if (tableCountBadge) {
        tableCountBadge.textContent = `${courses.length} مادة`;
    }

    if (!tbody) return;

    if (!courses || courses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="table-empty-state">
                    <span class="material-symbols-outlined empty-icon">sentiment_dissatisfied</span>
                    <p>لا توجد مواد مطابقة لخيارات التصفية التحريرية</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = courses.map((c, idx) => {
        const isPublished = c.is_published;
        const total = c.total_students || 0;
        const graded = c.graded_count || 0;
        const blocked = c.blocked_count || 0;
        const disabledAttr = !isJobOpen ? 'disabled style="opacity: 0.5 !important; cursor: not-allowed !important; filter: grayscale(80%) !important;"' : '';
        const btnClass = !isJobOpen ? 'opacity-50 pointer-events-none cursor-not-allowed' : '';

        return `
            <tr id="row-course-${c.course_id}">
                <td class="text-center font-bold">${idx + 1}</td>
                <td class="font-bold text-primary">${escapeHtml(c.course_code)}</td>
                <td class="font-semibold">${escapeHtml(c.course_name)}</td>
                <td>${escapeHtml(c.department_name)}</td>
                <td class="text-center font-medium">${escapeHtml(c.level_number)}</td>
                <td class="text-center font-bold">${total}</td>
                <td class="text-center font-bold text-green">${graded}</td>
                <td class="text-center font-bold ${blocked > 0 ? 'text-red' : 'text-slate-400'}">${blocked}</td>
                <td class="text-center">
                    <span class="badge-pub ${isPublished ? 'badge-published' : 'badge-pending'}">
                        ${isPublished ? '🟢 معتمد ومنشور' : '🟡 قيد المراجعة والتدقيق'}
                    </span>
                </td>
                <td class="text-center">
                    ${(typeof window.CAN_PUBLISH_GRADES !== 'undefined' && window.CAN_PUBLISH_GRADES === false) ? `
                        <span class="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-bold">
                            <span class="material-symbols-outlined text-sm">visibility</span>
                            عرض فقط
                        </span>
                    ` : (isPublished ? `
                        <button type="button" class="btn-act btn-act-unpublish ${btnClass}" ${disabledAttr} onclick="openPublishModal(${c.course_id}, '${escapeJsString(c.course_code)} - ${escapeJsString(c.course_name)}', ${total}, false)">
                            <span class="material-symbols-outlined" style="font-size:16px;">lock_open</span>
                            إرجاع للمراجعة
                        </button>
                    ` : `
                        <button type="button" class="btn-act btn-act-publish ${btnClass}" ${disabledAttr} onclick="openPublishModal(${c.course_id}, '${escapeJsString(c.course_code)} - ${escapeJsString(c.course_name)}', ${total}, true)">
                            <span class="material-symbols-outlined" style="font-size:16px;">verified</span>
                            اعتماد ونشر النتيجة
                        </button>
                    `)}
                </td>
            </tr>
        `;
    }).join('');

    applyApprovalPermissionUI(isJobOpen);
}

// ============================================================
// === فتح نافذة التأكيد (Confirmation Modal)
// ============================================================
function openPublishModal(courseId, courseFullName, totalStudents, targetPublishStatus) {
    if (typeof window.IS_GRADE_APPROVAL_JOB_OPEN !== 'undefined' && !window.IS_GRADE_APPROVAL_JOB_OPEN) {
        showToast(window.GRADE_APPROVAL_JOB_MESSAGE || "⚠️ خدمة 'اعتماد الدرجات' غير مفعلة حالياً", true);
        return;
    }

    const semesterId = document.getElementById('semester-select')?.value || '';
    const period = document.getElementById('period-select')?.value || 'midterm';
    const periodDisplay = period === 'midterm' ? 'درجات الامتحان النصفي (Midterm)' : 'الدرجات النهائية الشاملة (Final)';

    if (!semesterId) {
        showToast('يرجى تحديد الفصل الدراسي أولاً من خيارات التصفية', true);
        return;
    }

    pendingPublishAction = {
        courseId: courseId,
        semesterId: semesterId,
        period: period,
        isPublished: targetPublishStatus
    };

    const modal = document.getElementById('publish-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-description');
    const modalCourseName = document.getElementById('modal-course-name');
    const modalPeriodName = document.getElementById('modal-period-name');
    const modalStudentsCount = document.getElementById('modal-students-count');
    const btnConfirm = document.getElementById('btn-modal-confirm');

    if (modalCourseName) modalCourseName.textContent = courseFullName;
    if (modalPeriodName) modalPeriodName.textContent = periodDisplay;
    if (modalStudentsCount) modalStudentsCount.textContent = `${totalStudents} طالب`;

    if (targetPublishStatus) {
        if (modalTitle) modalTitle.textContent = 'تأكيد اعتماد ونشر نتيجة المادة';
        if (modalDesc) modalDesc.textContent = 'عند الاعتماد والنشر، ستظهر درجات هذه المادة فورياً لجميع الطلاب المسجلين عبر بوابة النتائج.';
        if (btnConfirm) {
            btnConfirm.textContent = 'تأكيد الاعتماد والنشر 🚀';
            btnConfirm.className = 'btn-modal-confirm';
        }
    } else {
        if (modalTitle) modalTitle.textContent = 'تأكيد إرجاع النتيجة قيد المراجعة';
        if (modalDesc) modalDesc.textContent = 'سيتم إخفاء نتائج هذه المادة من بوابة الطلاب وتغيير حالتها إلى قيد التدقيق والمراجعة.';
        if (btnConfirm) {
            btnConfirm.textContent = 'تأكيد إيقاف النشر 🟡';
            btnConfirm.className = 'btn-act btn-act-unpublish';
            btnConfirm.style.padding = '0.6rem 1.4rem';
        }
    }

    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('publish-modal');
    if (modal) modal.classList.add('hidden');
    pendingPublishAction = null;
}

// ============================================================
// === تنفيذ عملية الاعتماد والنشر من الـ API
// ============================================================
function confirmExecutePublish() {
    if (typeof window.IS_GRADE_APPROVAL_JOB_OPEN !== 'undefined' && !window.IS_GRADE_APPROVAL_JOB_OPEN) {
        showToast(window.GRADE_APPROVAL_JOB_MESSAGE || "⚠️ خدمة 'اعتماد الدرجات' غير مفعلة حالياً", true);
        return;
    }

    if (!pendingPublishAction) return;

    const payload = {
        semester_id: pendingPublishAction.semesterId,
        course_id: pendingPublishAction.courseId,
        period: pendingPublishAction.period,
        is_published: pendingPublishAction.isPublished
    };

    fetch('/grades/api/publish-grades/', {
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
            showToast(data.message || 'تمت العملية بنجاح', false);
            closeModal();
            fetchCoursesPublishStatus();
        } else {
            showToast(data.message || 'فشلت عملية اعتماد النشر', true);
        }
    })
    .catch(err => {
        console.error('❌ Error publishing grades:', err);
        showToast('حدث خطأ في الشبكة أثناء تنفيذ طلب النشر', true);
    });
}

// ============================================================
// === تحديث الكروت الإحصائية
// ============================================================
function updateStats(courses) {
    const totalEl = document.getElementById('stat-total-courses');
    const publishedEl = document.getElementById('stat-published-courses');
    const pendingEl = document.getElementById('stat-pending-courses');

    const total = courses ? courses.length : 0;
    const published = courses ? courses.filter(c => c.is_published).length : 0;
    const pending = total - published;

    if (totalEl) totalEl.textContent = total;
    if (publishedEl) publishedEl.textContent = published;
    if (pendingEl) pendingEl.textContent = pending;
}

// ============================================================
// === الفلترة المحلية للشريط السريع
// ============================================================
function filterCoursesLocally() {
    const searchVal = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (!searchVal) {
        renderCoursesTable(currentCoursesList);
        return;
    }

    const filtered = currentCoursesList.filter(c => 
        (c.course_code && c.course_code.toLowerCase().includes(searchVal)) ||
        (c.course_name && c.course_name.toLowerCase().includes(searchVal))
    );

    renderCoursesTable(filtered);
}

// ============================================================
// === إعادة ضبط الفلاتر
// ============================================================
function resetFilters() {
    document.getElementById('semester-select').selectedIndex = 0;
    document.getElementById('department-select').value = '';
    document.getElementById('period-select').value = 'midterm';
    document.getElementById('search-input').value = '';

    fetchCoursesPublishStatus();
}

// ============================================================
// === دالة التوست للإشعارات
// ============================================================
function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `publish-toast ${isError ? 'publish-toast-error' : 'publish-toast-success'}`;
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

function escapeJsString(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
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

// ============================================================
// === تحديث الكروت الإحصائية
// ============================================================
function updateStats(courses) {
    const totalEl = document.getElementById('stat-total-courses');
    const pubEl = document.getElementById('stat-published-courses');
    const pendEl = document.getElementById('stat-pending-courses');

    const total = courses ? courses.length : 0;
    const published = courses ? courses.filter(c => c.is_published).length : 0;
    const pending = total - published;

    if (totalEl) totalEl.textContent = total;
    if (pubEl) pubEl.textContent = published;
    if (pendEl) pendEl.textContent = pending;
}

// ============================================================
// === الفلترة المحلية بالشريط السريع
// ============================================================
function filterCoursesLocally() {
    const searchVal = document.getElementById('search-input')?.value.trim().toLowerCase() || '';
    if (!searchVal) {
        renderCoursesTable(currentCoursesList);
        return;
    }

    const filtered = currentCoursesList.filter(c => 
        (c.course_code && c.course_code.toLowerCase().includes(searchVal)) ||
        (c.course_name && c.course_name.toLowerCase().includes(searchVal))
    );

    renderCoursesTable(filtered);
}

// ============================================================
// === إعادة ضبط الفلاتر
// ============================================================
function resetFilters() {
    document.getElementById('semester-select').selectedIndex = 0;
    document.getElementById('department-select').value = '';
    document.getElementById('period-select').value = 'midterm';
    document.getElementById('search-input').value = '';

    fetchCoursesPublishStatus();
}

// ============================================================
// === دالة التوست للإشعارات
// ============================================================
function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `pub-toast ${isError ? 'pub-toast-error' : 'pub-toast-success'}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined">${isError ? 'error' : 'verified'}</span>
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

function escapeJsString(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
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
