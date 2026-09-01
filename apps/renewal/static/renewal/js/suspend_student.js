// ============================================
// إدارة إيقاف القيد الفصلي - suspend_student.js v1.0.5
// ============================================

console.log('✅ suspend_student.js v1.0.5 loaded successfully');

let selectedStudentId = null;
let selectedStudentData = null;

// ============================================================
// دوال مساعدة
// ============================================================

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
    if (!text && text !== 0) return '-';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// دالة التركيب والاستخراج التلقائي للاسم الرباعي الكامل
function constructQuadName(student) {
    if (!student) return '-';
    
    if (student.quad_name && student.quad_name.trim().length > 0) {
        return student.quad_name.trim();
    }
    
    const parts = [
        student.first_name || student.name || '',
        student.father_name || '',
        student.grandfather_name || '',
        student.last_name || student.family_name || ''
    ].map(p => (p || '').trim()).filter(p => p.length > 0);

    if (parts.length >= 3) {
        return parts.join(' ');
    }

    if (student.full_name && student.full_name.trim().length > 0) {
        return student.full_name.trim();
    }

    return parts.join(' ') || student.name || '-';
}

function showToastMessage(message, isError = false) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
            width: 100%;
        `;
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${isError ? '#e11d48' : '#0f766e'};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.9rem;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.4s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        direction: rtl;
        min-width: 200px;
    `;
    toast.innerHTML = `
        <span class="material-symbols-outlined">${isError ? 'error' : 'check_circle'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, 4000);
}

// ============================================================
// البحث عن طالب
// ============================================================

function searchStudentForSuspend() {
    const input = document.getElementById('searchStudentInput');
    const query = input?.value.trim();
    
    if (!query) {
        showToastMessage('⚠️ الرجاء إدخال رقم قيد أو اسم الطالب', true);
        return;
    }
    
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '<div class="autocomplete-item" style="color: #94a3b8; cursor: default; padding: 10px;">⏳ جاري البحث...</div>';
    resultsContainer.classList.remove('hidden');
    
    fetch(`/renewal/api/search-student-suspend/?search=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.students && data.students.length > 0) {
                let html = '';
                data.students.forEach(student => {
                    const quadName = constructQuadName(student);
                    html += `
                        <div class="autocomplete-item" onclick="selectStudentForSuspend(${student.id})" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                            <strong>${escapeHtml(quadName)}</strong>
                            <span style="font-size: 0.75rem; color: #64748b; margin-right: 10px;">رقم القيد: ${escapeHtml(student.student_id)}</span>
                            <span style="font-size: 0.7rem; color: #94a3b8;">${escapeHtml(student.department_name)} - المستوى ${student.level_number}</span>
                        </div>
                    `;
                });
                resultsContainer.innerHTML = html;
                resultsContainer.classList.remove('hidden');
            } else {
                resultsContainer.innerHTML = `<div class="autocomplete-item" style="color: #e11d48; cursor: default; padding: 10px;">❌ ${data.error || 'لا توجد نتائج'}</div>`;
                resultsContainer.classList.remove('hidden');
            }
        })
        .catch(err => {
            console.error(err);
            resultsContainer.innerHTML = '<div class="autocomplete-item" style="color: #e11d48; cursor: default; padding: 10px;">❌ حدث خطأ في البحث</div>';
            resultsContainer.classList.remove('hidden');
        });
}

// ============================================================
// اختيار طالب
// ============================================================

function selectStudentForSuspend(studentId) {
    fetch(`/renewal/api/search-student-suspend/?search=${studentId}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.students && data.students.length > 0) {
                const student = data.students.find(s => s.id === studentId) || data.students[0];
                if (student) {
                    displayStudentInfo(student);
                    selectedStudentId = student.id;
                    selectedStudentData = student;
                    
                    const quadName = constructQuadName(student);
                    if (document.getElementById('searchResults')) document.getElementById('searchResults').classList.add('hidden');
                    if (document.getElementById('searchStudentInput')) document.getElementById('searchStudentInput').value = `${quadName} (${student.student_id})`;

                    const printBtn = document.getElementById('btnPrintSuspendForm');
                    if (printBtn) {
                        printBtn.style.setProperty('display', 'none', 'important');
                        printBtn.classList.add('hidden');
                    }

                    const targetBox = document.getElementById('studentInfoCard') || document.querySelector('.group-box');
                    if (targetBox) {
                        targetBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        })
        .catch(err => console.error(err));
}

// ============================================================
// التحكم في صلاحية وظيفة إيقاف القيد
// ============================================================

function applySuspendPermissionUI(isOpen, message) {
    const isJobOpen = (typeof isOpen !== 'undefined') ? Boolean(isOpen) : (typeof window.IS_SUSPEND_JOB_OPEN !== 'undefined' ? Boolean(window.IS_SUSPEND_JOB_OPEN) : true);
    const displayMsg = message || window.SUSPEND_JOB_MESSAGE || '⚠️ خدمة "إيقاف القيد" غير مفعلة حالياً في إدارة الوظائف.';

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

    const suspendBtn = document.querySelector('#suspendActionArea .btn-save');
    if (suspendBtn) {
        if (!isJobOpen) {
            suspendBtn.disabled = true;
            suspendBtn.setAttribute('disabled', 'disabled');
            suspendBtn.style.setProperty('opacity', '0.5', 'important');
            suspendBtn.style.setProperty('cursor', 'not-allowed', 'important');
            suspendBtn.style.setProperty('pointer-events', 'none', 'important');
            suspendBtn.title = displayMsg;
        } else {
            suspendBtn.disabled = false;
            suspendBtn.removeAttribute('disabled');
            suspendBtn.style.setProperty('opacity', '1', 'important');
            suspendBtn.style.setProperty('cursor', 'pointer', 'important');
            suspendBtn.style.setProperty('pointer-events', 'auto', 'important');
            suspendBtn.title = '';
        }
    }
}

function updateJobPermissionState() {
    const isOpen = (typeof window.IS_SUSPEND_JOB_OPEN !== 'undefined') ? Boolean(window.IS_SUSPEND_JOB_OPEN) : true;
    const message = window.SUSPEND_JOB_MESSAGE || '';

    applySuspendPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_SUSPEND_JOB_OPEN = Boolean(data.is_suspend_job_open);
            window.SUSPEND_JOB_MESSAGE = data.suspend_job_message || '';
            applySuspendPermissionUI(window.IS_SUSPEND_JOB_OPEN, window.SUSPEND_JOB_MESSAGE);
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic suspend student job permission check error:', err);
    });
}
window.updateJobPermissionState = updateJobPermissionState;

function displayStudentInfo(student) {
    const quadName = constructQuadName(student);
    document.getElementById('studentNameDisplay').textContent = quadName;
    document.getElementById('studentIdDisplay').textContent = student.student_id || '-';
    document.getElementById('studentDeptDisplay').textContent = student.department_name || '-';
    document.getElementById('studentLevelDisplay').textContent = student.level_number || '-';
    document.getElementById('studentSemesterDisplay').textContent = student.current_semester || '-';
    
    const statusSpan = document.getElementById('studentStatusDisplay');
    statusSpan.textContent = student.student_status || 'غير محدد';
    if (student.student_status === 'موقوف قيده') {
        statusSpan.className = 'px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold';
    } else {
        statusSpan.className = 'px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold';
    }
    
    const enrollmentStatus = document.getElementById('enrollmentStatusDisplay');
    if (student.current_enrollment_status === 'suspended') {
        enrollmentStatus.textContent = '⚠️ موقوف';
        enrollmentStatus.className = 'px-4 py-2 bg-red-100 text-red-700 rounded-lg font-bold text-center';
    } else if (student.current_enrollment_status === 'active') {
        enrollmentStatus.textContent = '✅ نشط';
        enrollmentStatus.className = 'px-4 py-2 bg-green-100 text-green-700 rounded-lg font-bold text-center';
    } else {
        enrollmentStatus.textContent = '❌ لا يوجد قيد';
        enrollmentStatus.className = 'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-center';
    }
    
    document.getElementById('studentInfoCard').classList.remove('hidden');
    document.getElementById('suspendActionArea').classList.remove('hidden');
    
    // 🔒 إخفاء زر الطباعة دائماً عند تحميل أي طالب — لا يظهر إطلاقاً
    // إلا بعد الضغط على "تأكيد إيقاف القيد" في هذه الجلسة مباشرةً
    const printBtn = document.getElementById('btnPrintSuspendForm');
    if (printBtn) {
        printBtn.style.setProperty('display', 'none', 'important');
        printBtn.classList.add('hidden');
    }
    
    const isJobOpen = (typeof window.IS_SUSPEND_JOB_OPEN !== 'undefined') ? Boolean(window.IS_SUSPEND_JOB_OPEN) : true;
    const suspendBtn = document.querySelector('#suspendActionArea .btn-save');
    if (suspendBtn) {
        if (!isJobOpen) {
            suspendBtn.disabled = true;
            suspendBtn.style.opacity = '0.5';
            suspendBtn.style.cursor = 'not-allowed';
            suspendBtn.style.pointerEvents = 'none';
            suspendBtn.title = window.SUSPEND_JOB_MESSAGE || 'خدمة إيقاف القيد غير مفعلة حالياً';
        } else if (student.current_enrollment_status === 'suspended') {
            suspendBtn.disabled = true;
            suspendBtn.style.opacity = '0.5';
            suspendBtn.style.cursor = 'not-allowed';
            suspendBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> الطالب موقوف قيده';
            showToastMessage('ℹ️ هذا الطالب موقوف قيده بالفعل', false);
        } else if (student.current_enrollment_status !== 'active') {
            suspendBtn.disabled = true;
            suspendBtn.style.opacity = '0.5';
            suspendBtn.style.cursor = 'not-allowed';
            suspendBtn.innerHTML = '<span class="material-symbols-outlined">block</span> تأكيد إيقاف القيد';
            showToastMessage('⚠️ هذا الطالب ليس لديه قيد نشط', true);
        } else {
            suspendBtn.disabled = false;
            suspendBtn.style.opacity = '1';
            suspendBtn.style.cursor = 'pointer';
            suspendBtn.style.pointerEvents = 'auto';
            suspendBtn.innerHTML = '<span class="material-symbols-outlined">block</span> تأكيد إيقاف القيد';
            suspendBtn.title = '';
        }
    }
}

// ============================================================
// نافذة التأكيد التفاعلية (Custom Confirmation Modal)
// ============================================================

function openSuspendConfirmModal({ title, messageHtml, icon = 'block', confirmText = 'تأكيد إيقاف القيد', isDanger = true }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('suspendConfirmModal');
        const iconEl = document.getElementById('suspendModalIcon');
        const iconBox = document.getElementById('suspendModalIconBox');
        const titleEl = document.getElementById('suspendModalTitle');
        const msgEl = document.getElementById('suspendModalMessage');
        const btnConfirm = document.getElementById('suspendModalBtnConfirm');
        const btnCancel = document.getElementById('suspendModalBtnCancel');
        const confirmTextEl = document.getElementById('suspendModalConfirmText');
        const confirmIconEl = document.getElementById('suspendModalConfirmIcon');

        if (!modal) {
            resolve(false);
            return;
        }

        if (iconEl) iconEl.textContent = icon;
        if (confirmIconEl) confirmIconEl.textContent = icon;
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.innerHTML = messageHtml;
        if (confirmTextEl) confirmTextEl.textContent = confirmText;

        if (isDanger) {
            if (iconBox) iconBox.className = 'w-12 h-12 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5';
            if (btnConfirm) btnConfirm.style.backgroundColor = '#e11d48';
        } else {
            if (iconBox) iconBox.className = 'w-12 h-12 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5';
            if (btnConfirm) btnConfirm.style.backgroundColor = '#0f766e';
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const cleanup = (result) => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            btnConfirm.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            resolve(result);
        };

        const onConfirm = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onBackdrop = (e) => {
            if (e.target === modal) cleanup(false);
        };

        btnConfirm.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
    });
}

// ============================================================
// تأكيد إيقاف القيد
// ============================================================

function setSuspendButtonMode(mode) {
    const btn = document.getElementById('btnSuspendAction') || document.querySelector('#suspendActionArea .btn-save') || document.querySelector('#suspendActionArea .btn-action');
    if (!btn) return;

    if (mode === 'print') {
        btn.style.backgroundColor = '#b59b66';
        btn.onclick = window.printSuspensionForm;
        btn.innerHTML = '<span class="material-symbols-outlined">print</span> طباعة';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
        btn.title = 'انقر لطباعة نموذج إيقاف القيد';
    } else {
        btn.style.backgroundColor = '#e11d48';
        btn.onclick = window.confirmSuspend;
        btn.innerHTML = '<span class="material-symbols-outlined">block</span> تأكيد إيقاف القيد';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
        btn.title = '';
    }
}
window.setSuspendButtonMode = setSuspendButtonMode;

async function confirmSuspend() {
    if (typeof window.IS_SUSPEND_JOB_OPEN !== 'undefined' && !window.IS_SUSPEND_JOB_OPEN) {
        showToastMessage(window.SUSPEND_JOB_MESSAGE || "⚠️ خدمة 'إيقاف القيد' غير مفعلة حالياً", true);
        return;
    }

    if (!selectedStudentId) {
        showToastMessage('⚠️ الرجاء اختيار طالب أولاً', true);
        return;
    }
    
    const reason = document.getElementById('suspendReason').value.trim();
    if (!reason) {
        showToastMessage('⚠️ الرجاء كتابة سبب الإيقاف', true);
        document.getElementById('suspendReason').focus();
        return;
    }
    
    const quadName = constructQuadName(selectedStudentData);
    const studentRegNum = selectedStudentData?.student_id || selectedStudentId;

    const messageHtml = `هل أنت متأكد من رغبتك في إيقاف قيد الطالب <strong class="text-rose-600 dark:text-rose-400 font-bold">${escapeHtml(quadName)}</strong> (رقم القيد: <strong class="text-teal-600 dark:text-teal-400 font-bold">${escapeHtml(studentRegNum)}</strong>)؟`;

    const confirmed = await openSuspendConfirmModal({
        title: 'تأكيد إيقاف القيد الفصلي',
        messageHtml: messageHtml,
        icon: 'block',
        confirmText: 'تأكيد إيقاف القيد',
        isDanger: true
    });

    if (!confirmed) return;
    
    const btn = document.getElementById('btnSuspendAction') || document.querySelector('#suspendActionArea .btn-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span> جاري المعالجة...';
    
    fetch('/renewal/api/suspend-student/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            student_id: selectedStudentId,
            reason: reason
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showToastMessage(data.message, false);
            loadSuspendedStudents();
            
            // 🔄 تحديث حالة الطالب في الواجهة لتصبح موقوف
            if (selectedStudentData) {
                selectedStudentData.student_status = 'موقوف قيده';
                selectedStudentData.current_enrollment_status = 'suspended';
            }
            const statusSpan = document.getElementById('studentStatusDisplay');
            if (statusSpan) {
                statusSpan.textContent = 'موقوف قيده';
                statusSpan.className = 'px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold';
            }
            const enrollmentStatus = document.getElementById('enrollmentStatusDisplay');
            if (enrollmentStatus) {
                enrollmentStatus.textContent = '⚠️ موقوف';
                enrollmentStatus.className = 'px-4 py-2 bg-red-100 text-red-700 rounded-lg font-bold text-center';
            }

            // 🖨️ إظهار زر طباعة نموذج الإيقاف فقط وحصرياً بعد نجاح العملية وحفظها
            const printBtn = document.getElementById('btnPrintSuspendForm');
            if (printBtn) {
                printBtn.style.setProperty('display', 'inline-flex', 'important');
                printBtn.classList.remove('hidden');
            }
        } else {
            showToastMessage(data.error || '❌ فشل إيقاف القيد', true);
        }
    })
    .catch(err => {
        console.error(err);
        showToastMessage('❌ حدث خطأ في الاتصال بالخادم', true);
    })
    .finally(() => {
        if (selectedStudentData && selectedStudentData.current_enrollment_status === 'suspended') {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> تم إيقاف القيد بنجاح';
        } else {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined">block</span> تأكيد إيقاف القيد';
        }
    });
}

// ============================================================
// تنشيط طالب موقوف
// ============================================================

async function activateSuspendedStudent(studentId, studentName) {
    if (typeof window.IS_SUSPEND_JOB_OPEN !== 'undefined' && !window.IS_SUSPEND_JOB_OPEN) {
        showToastMessage(window.SUSPEND_JOB_MESSAGE || "⚠️ خدمة 'إيقاف القيد' غير مفعلة حالياً", true);
        return;
    }

    const messageHtml = `هل أنت متأكد من رغبتك في تنشيط وإلغاء إيقاف قيد الطالب <strong class="text-teal-600 dark:text-teal-400 font-bold">${escapeHtml(studentName)}</strong>؟`;

    const confirmed = await openSuspendConfirmModal({
        title: 'تأكيد تنشيط قيد الطالب',
        messageHtml: messageHtml,
        icon: 'play_arrow',
        confirmText: 'تأكيد التنشيط',
        isDanger: false
    });

    if (!confirmed) return;
    
    fetch('/renewal/api/activate-suspended-student/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            student_id: studentId
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showToastMessage(data.message, false);
            loadSuspendedStudents();
        } else {
            showToastMessage(data.error || '❌ فشل التنشيط', true);
        }
    })
    .catch(err => {
        console.error(err);
        showToastMessage('❌ حدث خطأ في الاتصال', true);
    });
}

// ============================================================
// جلب الطلاب الموقوفين
// ============================================================

function loadSuspendedStudents() {
    const departmentId = document.getElementById('filterDepartment')?.value || '';
    const levelId = document.getElementById('filterLevel')?.value || '';
    const tbody = document.getElementById('suspendedStudentsTable');
    const countSpan = document.getElementById('suspendedCount');
    const isJobOpen = (typeof window.IS_SUSPEND_JOB_OPEN !== 'undefined') ? Boolean(window.IS_SUSPEND_JOB_OPEN) : true;
    
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">⏳ جاري التحميل...</td></tr>';
    
    let url = `/renewal/api/suspended-students-filtered/?`;
    if (departmentId) url += `department_id=${departmentId}&`;
    if (levelId) url += `level_id=${levelId}&`;
    
    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                if (data.students && data.students.length > 0) {
                    let html = '';
                    const disabledAttr = !isJobOpen ? 'disabled style="opacity: 0.5 !important; cursor: not-allowed !important;"' : '';
                    const btnClass = !isJobOpen ? 'opacity-50 pointer-events-none cursor-not-allowed' : '';

                    data.students.forEach((student, index) => {
                        const quadName = constructQuadName(student);
                        html += `
                            <tr class="border-b hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer" onclick="selectStudentForSuspend(${student.id})" title="انقر لعرض بيانات الطالب في البطاقة العلوية">
                                <td class="text-center">${index + 1}</td>
                                <td class="text-center font-bold">${escapeHtml(student.student_id)}</td>
                                <td class="font-bold text-slate-900 dark:text-slate-100">${escapeHtml(quadName)}</td>
                                <td>${escapeHtml(student.department_name)}</td>
                                <td class="text-center">${escapeHtml(student.level_number)}</td>
                                <td class="text-center">${escapeHtml(student.suspended_date)}</td>
                                <td class="text-center">
                                    <button class="btn-action btn-save ${btnClass}" ${disabledAttr} onclick="event.stopPropagation(); activateSuspendedStudent(${student.id}, '${escapeHtml(quadName)}');" style="background-color: #0f766e; color: white; padding: 4px 12px; font-size: 0.75rem;">
                                        <span class="material-symbols-outlined" style="font-size: 14px;">play_arrow</span> تنشيط
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                    if (tbody) tbody.innerHTML = html;
                    if (countSpan) countSpan.textContent = `عدد الموقوفين: ${data.count}`;
                } else {
                    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">لا يوجد طلاب موقوفين في الفصل الحالي</td></tr>';
                    if (countSpan) countSpan.textContent = 'عدد الموقوفين: 0';
                }
            } else {
                if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty-cell text-red-500">❌ ${data.error || 'حدث خطأ'}</td></tr>`;
            }
        })
        .catch(err => {
            console.error(err);
            if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-cell text-red-500">❌ حدث خطأ في التحميل</td></tr>';
        })
        .finally(() => {
            applySuspendPermissionUI(isJobOpen);
        });
}

// ============================================================
// مسح البحث
// ============================================================

function clearSearch() {
    if (document.getElementById('searchStudentInput')) document.getElementById('searchStudentInput').value = '';
    if (document.getElementById('searchResults')) document.getElementById('searchResults').classList.add('hidden');
    if (document.getElementById('studentInfoCard')) document.getElementById('studentInfoCard').classList.add('hidden');
    if (document.getElementById('suspendActionArea')) document.getElementById('suspendActionArea').classList.add('hidden');
    if (document.getElementById('suspendReason')) document.getElementById('suspendReason').value = '';
    
    const printBtn = document.getElementById('btnPrintSuspendForm');
    if (printBtn) {
        printBtn.style.setProperty('display', 'none', 'important');
        printBtn.classList.add('hidden');
    }

    selectedStudentId = null;
    selectedStudentData = null;
}

// ============================================================
// 🖨️ طباعة نموذج إيقاف القيد (محمي أمنياً بالكامل عبر الخادم)
// ============================================================

async function printSuspensionForm() {
    if (!selectedStudentId || !selectedStudentData) {
        showToastMessage('⚠️ الرجاء البحث عن طالب أولاً', true);
        return;
    }

    const printBtn = document.getElementById('btnPrintSuspendForm');
    if (printBtn) {
        printBtn.disabled = true;
        printBtn.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span> جاري التحقق الأمني...';
    }

    try {
        // 🔒 التحقق الأمني الحصري من الخادم (Backend) لمنع أي تلاعب
        const res = await fetch(`/renewal/api/verify-suspension-print/${selectedStudentId}/`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        const checkData = await res.json();

        if (!res.ok || !checkData.success || !checkData.allowed) {
            showToastMessage(checkData.error || '⛔ رفض أمني (403): لا يمكن استخراج نموذج الإيقاف لطالب حالته نشطة!', true);
            if (printBtn) {
                printBtn.style.setProperty('display', 'none', 'important');
                printBtn.classList.add('hidden');
            }
            return;
        }

        const s = selectedStudentData;
        const quadName = constructQuadName(s);
        const studentId = s.student_id || document.getElementById('studentIdDisplay')?.textContent || '-';
        const nationalId = s.national_id || s.national_num || 'غير مسجل';
        const studentDept = s.department_name || document.getElementById('studentDeptDisplay')?.textContent || '-';
        const studentLevel = s.level_number || document.getElementById('studentLevelDisplay')?.textContent || '-';
        const studentSemester = checkData.student?.semester || s.current_semester || document.getElementById('studentSemesterDisplay')?.textContent || '-';
        const suspendReason = checkData.student?.reason || document.getElementById('suspendReason')?.value.trim() || 'إيقاف قيد فصلي بناءً على الطلب المقدم';

        const now = new Date();
        const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });

        const printForm = document.getElementById('suspensionPrintSection');
        if (printForm && printForm.parentNode !== document.body) {
            document.body.appendChild(printForm);
        }

        if (document.getElementById('printDateVal')) document.getElementById('printDateVal').textContent = dateStr;
        if (document.getElementById('printStudentIdVal')) document.getElementById('printStudentIdVal').textContent = studentId;
        if (document.getElementById('printStudentNameVal')) document.getElementById('printStudentNameVal').textContent = quadName;
        if (document.getElementById('printNationalIdVal')) document.getElementById('printNationalIdVal').textContent = nationalId;
        if (document.getElementById('printDeptVal')) document.getElementById('printDeptVal').textContent = studentDept;
        if (document.getElementById('printLevelSemesterVal')) document.getElementById('printLevelSemesterVal').textContent = `المستوى ${studentLevel} / ${studentSemester}`;
        if (document.getElementById('printReasonVal')) document.getElementById('printReasonVal').textContent = suspendReason;

        const doPrint = () => window.print();

        if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
            try {
                const autoRes = window.OfficialsHelper.autoFill();
                if (autoRes && typeof autoRes.then === 'function') {
                    autoRes.then(doPrint).catch(doPrint);
                } else {
                    setTimeout(doPrint, 300);
                }
            } catch (e) {
                console.warn('OfficialsHelper autoFill error:', e);
                doPrint();
            }
        } else {
            doPrint();
        }
    } catch (e) {
        console.error('Security verification error:', e);
        showToastMessage('❌ حدث خطأ أثناء التحقق الأمني من الخادم', true);
    } finally {
        if (printBtn) {
            printBtn.disabled = false;
            printBtn.innerHTML = '<span class="material-symbols-outlined">print</span> طباعة نموذج الإيقاف';
        }
    }
}

// ============================================================
// تهيئة الصفحة
// ============================================================

function init() {
    console.log('🚀 Initializing suspend student page v1.0.5...');
    loadSuspendedStudents();
    
    document.getElementById('searchStudentInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchStudentForSuspend();
        }
    });
}

window.searchStudentForSuspend = searchStudentForSuspend;
window.selectStudentForSuspend = selectStudentForSuspend;
window.confirmSuspend = confirmSuspend;
window.activateSuspendedStudent = activateSuspendedStudent;
window.loadSuspendedStudents = loadSuspendedStudents;
window.clearSearch = clearSearch;
window.printSuspensionForm = printSuspensionForm;
window.showToastMessage = showToastMessage;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}