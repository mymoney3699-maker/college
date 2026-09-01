// ============================================
// تجديد قيد (حالة خاصة) - Special Renew (مطور) v1.0.31
// مع منطق الترقية الخماسي
// ============================================

console.log('✅ special_renew.js v1.0.31 loaded successfully');

let selectedStudentId = null;
let selectedStudentData = null;
let currentSemesterData = null;

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
    if (!text) return '-';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
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
// البحث عن طالب للحالات الخاصة
// ============================================================

function searchStudentForSpecialRenew() {
    const isRenewOpen = (typeof window.IS_RENEW_JOB_OPEN !== 'undefined') ? Boolean(window.IS_RENEW_JOB_OPEN) : false;
    if (!isRenewOpen) {
        showNotification('error', window.RENEW_JOB_MESSAGE || '⚠️ عذراً، خدمة تجديد القيد موقوفة حالياً حسب جدول إدارة الوظائف.');
        return;
    }

    const regNum = document.getElementById('searchRegNum')?.value.trim() || '';
    const name = document.getElementById('searchStudentInput')?.value.trim() || '';
    const query = name || regNum;

    if (!query) {
        showNotification('warning', '⚠️ الرجاء إدخال رقم القيد أو اسم الطالب للبحث');
        return;
    }

    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
        resultsContainer.innerHTML = '<div style="padding: 12px; color: #64748b; font-weight: 700; text-align: center;">⏳ جاري البحث...</div>';
        resultsContainer.classList.remove('hidden');
    }

    fetch(`/renewal/api/search-student-special-renew/?search=${encodeURIComponent(query)}&reg_num=${encodeURIComponent(regNum)}&name=${encodeURIComponent(name)}`)
        .then(r => r.json())
        .then(data => {
            if (!resultsContainer) return;

            if (data.success && data.students && data.students.length > 0) {
                let html = '<div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white;" class="search-results-wrapper">';
                data.students.forEach(student => {
                    const isAllowed = student.is_allowed !== false;
                    const statusText = student.student_status || 'غير محدد';
                    let badgeClass = 'special-status-badge';
                    let badgeStyle = '';

                    if (!isAllowed) {
                        badgeStyle = 'background-color: #fee2e2; color: #dc2626; border: 1px solid #ef4444; font-weight: 700;';
                    } else if (statusText.includes('موقوف') || statusText.includes('وقف')) {
                        badgeClass = 'special-status-badge suspended';
                    } else if (statusText.includes('مستمر') || statusText.includes('منتظم') || statusText.includes('جديد') || statusText.includes('نشط') || statusText.includes('مجدد')) {
                        badgeStyle = 'background-color: #dcfce7; color: #166534; border: 1px solid #86efac; font-weight: 700;';
                    } else {
                        badgeStyle = 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; font-weight: 700;';
                    }

                    const iconPrefix = !isAllowed ? '🛑 ' : (statusText.includes('موقوف') ? '⛔ ' : '✅ ');

                    html += `
                        <div class="search-result-item" 
                             data-student-id="${student.id}"
                             onclick="window.selectStudentForSpecialRenew(${student.id})">
                            <div>
                                <div class="result-student-name">${escapeHtml(student.name)} ${escapeHtml(student.father_name || '')}</div>
                                <div class="result-student-meta">رقم القيد: <strong class="result-student-id">${escapeHtml(student.student_id)}</strong> | القسم: ${escapeHtml(student.department_name)} | المستوى: ${student.level_number || 1}</div>
                            </div>
                            <div>
                                <span class="${badgeClass}" style="${badgeStyle}">${iconPrefix}${escapeHtml(statusText)}</span>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                resultsContainer.innerHTML = html;
                resultsContainer.classList.remove('hidden');
                showNotification('info', `تم العثور على ${data.students.length} نتيجة بحث`);
            } else {
                resultsContainer.innerHTML = `<div style="padding: 12px; color: #e11d48; font-weight: 700; text-align: center;">❌ ${data.error || 'لا توجد نتائج مطابقة'}</div>`;
                resultsContainer.classList.remove('hidden');
                if (typeof toastWarning === 'function') toastWarning('لا توجد نتائج مطابقة');
            }
        })
        .catch(err => {
            console.error('❌ Error searching special renew student:', err);
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div style="padding: 12px; color: #e11d48; font-weight: 700; text-align: center;">❌ حدث خطأ في البحث</div>';
                resultsContainer.classList.remove('hidden');
            }
        });
}

// ============================================================
// اختيار طالب للحالات الخاصة
// ============================================================

function selectStudentForSpecialRenew(studentId) {
    const numericId = Number(studentId);
    fetch(`/renewal/api/search-student-special-renew/?search=${encodeURIComponent(studentId)}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.students && data.students.length > 0) {
                const student = data.students.find(s => Number(s.id) === numericId || s.id === studentId || s.student_id === studentId) || data.students[0];
                if (student) {
                    displayStudentInfo(student);
                    selectedStudentId = student.id;
                    selectedStudentData = student;

                    const resultsContainer = document.getElementById('searchResults');
                    if (resultsContainer) {
                        resultsContainer.innerHTML = '';
                        resultsContainer.classList.add('hidden');
                    }

                    const nameInput = document.getElementById('searchStudentInput');
                    const regInput = document.getElementById('searchRegNum');
                    if (nameInput) nameInput.value = student.name || '';
                    if (regInput) regInput.value = student.student_id || '';

                    setRenewButtonMode('renew');

                    // التمرير السلس إلى أعلى حقول البحث وبطاقة الطالب
                    const targetBox = document.getElementById('studentInfoCard') || document.querySelector('.inquiry-group-box');
                    if (targetBox) {
                        targetBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        })
        .catch(err => console.error('❌ Error selecting student for special renew:', err));
}

// ============================================================
// عرض معلومات الطالب مع مستوى الترقية المقترح
// ============================================================

function displayStudentInfo(student) {
    const nameDisplay = document.getElementById('studentNameDisplay');
    const idDisplay = document.getElementById('studentIdDisplay');
    const deptDisplay = document.getElementById('studentDeptDisplay');
    const semesterDisplay = document.getElementById('currentSemesterDisplay');

    if (nameDisplay) nameDisplay.textContent = student.name || '-';
    if (idDisplay) idDisplay.textContent = student.student_id || '-';
    if (deptDisplay) deptDisplay.textContent = student.department_name || '-';
    if (semesterDisplay) semesterDisplay.textContent = student.current_semester || '-';

    const isAllowed = student.is_allowed !== false;
    const saveBtn = document.querySelector('#renewActionArea .btn-save');
    const statusText = student.student_status || 'غير محدد';

    const specialTypeSpan = document.getElementById('specialTypeDisplay');
    if (specialTypeSpan) {
        if (!isAllowed) {
            specialTypeSpan.textContent = `🛑 ${statusText}`;
            specialTypeSpan.className = 'px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700 border border-red-300';
        } else if (statusText.includes('موقوف')) {
            specialTypeSpan.textContent = `⛔ ${statusText}`;
            specialTypeSpan.className = 'px-3 py-1 rounded-full text-sm font-bold badge-suspended';
        } else {
            specialTypeSpan.textContent = `✅ ${statusText}`;
            specialTypeSpan.className = 'px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-700 border border-green-300';
        }
    }

    const levelDisplay = document.getElementById('studentLevelDisplay');
    const levelStatus = document.getElementById('levelPromotionStatus');

    if (levelDisplay) {
        levelDisplay.textContent = student.level_number ? `المستوى ${student.level_number}` : 'المستوى الأول';
    }

    if (levelStatus) {
        if (!isAllowed) {
            levelStatus.innerHTML = `
                <span class="special-status-badge" style="display: inline-block; margin-right: 8px; background: #fee2e2; color: #dc2626; border: 1.5px solid #ef4444; font-weight: 800;">
                    ${escapeHtml(student.error_message || '🛑 الطالب غير مؤهل لإجراء التجديد')}
                </span>
            `;
        } else if (statusText.includes('موقوف')) {
            levelStatus.innerHTML = `
                <span class="special-status-badge suspended" style="display: inline-block; margin-right: 8px;">
                    ⛔ ${escapeHtml(statusText)} - بانتظار التفعيل وتجديد القيد
                </span>
            `;
        } else {
            levelStatus.innerHTML = `
                <span class="special-status-badge" style="display: inline-block; margin-right: 8px; background: #dcfce7; color: #166534; border: 1.5px solid #86efac; font-weight: 800;">
                    ✅ ${escapeHtml(statusText)}
                </span>
            `;
        }
    }

    const studentStatusSpan = document.getElementById('studentStatusDisplay');
    if (studentStatusSpan) {
        studentStatusSpan.textContent = statusText;
        if (!isAllowed) {
            studentStatusSpan.className = 'px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700 border border-red-300';
        } else if (statusText.includes('موقوف')) {
            studentStatusSpan.className = 'px-3 py-1 rounded-full text-sm font-bold status-badge-suspended';
        } else {
            studentStatusSpan.className = 'px-3 py-1 rounded-full text-sm font-bold status-badge-active';
        }
        studentStatusSpan.style.backgroundColor = '';
        studentStatusSpan.style.color = '';
    }

    // تعطيل أو تمكين زر التجديد بناءً على الأهلية الأكاديمية
    if (saveBtn) {
        if (!isAllowed) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.style.pointerEvents = 'none';
            saveBtn.title = student.error_message || 'الطالب محظور من التجديد';
        } else {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '';
            saveBtn.style.cursor = '';
            saveBtn.style.pointerEvents = '';
            saveBtn.removeAttribute('title');
        }
    }

    const reasonTextarea = document.getElementById('renewReason');
    if (reasonTextarea && student.notes) {
        reasonTextarea.value = student.notes;
    }

    const infoCard = document.getElementById('studentInfoCard');
    const actionArea = document.getElementById('renewActionArea');
    if (infoCard) infoCard.classList.remove('hidden');
    if (actionArea) actionArea.classList.remove('hidden');
}

// ============================================================
// نافذة التأكيد التفاعلية (Custom Confirmation Modal)
// ============================================================

function openSpecialRenewConfirmModal({ title, messageHtml, icon = 'autorenew', confirmText = 'تأكيد التجديد' }) {
    return new Promise((resolve) => {
        const modal = document.getElementById('specialRenewConfirmModal');
        const iconEl = document.getElementById('specialRenewModalIcon');
        const titleEl = document.getElementById('specialRenewModalTitle');
        const msgEl = document.getElementById('specialRenewModalMessage');
        const btnConfirm = document.getElementById('specialRenewModalBtnConfirm');
        const btnCancel = document.getElementById('specialRenewModalBtnCancel');
        const confirmTextEl = document.getElementById('specialRenewModalConfirmText');
        const confirmIconEl = document.getElementById('specialRenewModalConfirmIcon');

        if (!modal) {
            resolve(false);
            return;
        }

        if (iconEl) iconEl.textContent = icon;
        if (confirmIconEl) confirmIconEl.textContent = icon;
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.innerHTML = messageHtml;
        if (confirmTextEl) confirmTextEl.textContent = confirmText;

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

function setRenewButtonMode(mode) {
    const btn = document.getElementById('btnSpecialRenewAction') || document.querySelector('#renewActionArea .btn-save') || document.querySelector('#renewActionArea .btn-action');
    if (!btn) return;

    if (mode === 'print') {
        btn.style.backgroundColor = '#b59b66';
        btn.onclick = window.printRenewForm;
        btn.innerHTML = '<span class="material-symbols-outlined">print</span> طباعة';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
        btn.title = 'انقر لطباعة نموذج تجديد القيد';
    } else {
        btn.style.backgroundColor = '#0f766e';
        btn.onclick = window.confirmSpecialRenew;
        btn.innerHTML = '<span class="material-symbols-outlined">autorenew</span> تجديد وقيد الطالب';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
        btn.title = '';
    }
}
window.setRenewButtonMode = setRenewButtonMode;

// ============================================================
// تأكيد تجديد القيد
// ============================================================

async function confirmSpecialRenew() {
    const isRenewOpen = (typeof window.IS_RENEW_JOB_OPEN !== 'undefined') ? Boolean(window.IS_RENEW_JOB_OPEN) : false;
    if (!isRenewOpen) {
        showNotification('error', window.RENEW_JOB_MESSAGE || '⚠️ عذراً، خدمة تجديد القيد موقوفة حالياً حسب جدول إدارة الوظائف.');
        return;
    }

    if (!selectedStudentId) {
        showNotification('warning', '⚠️ الرجاء اختيار طالب أولاً');
        return;
    }

    const reason = document.getElementById('renewReason').value.trim();
    if (!reason) {
        showNotification('warning', '⚠️ الرجاء كتابة سبب التأخير أو الملاحظات');
        document.getElementById('renewReason').focus();
        return;
    }

    const student = selectedStudentData;
    const studentName = student?.name || '-';
    const studentRegNum = student?.student_id || selectedStudentId;

    const messageHtml = `هل أنت متأكد من رغبتك في تجديد وتفعيل قيد الطالب الموقوف <strong class="text-teal-600 dark:text-teal-400 font-bold">${escapeHtml(studentName)}</strong> (رقم القيد: <strong class="text-sky-600 dark:text-sky-400 font-bold">${escapeHtml(studentRegNum)}</strong>) وتحويل حالته إلى منتظم؟`;

    const confirmed = await openSpecialRenewConfirmModal({
        title: 'تأكيد تجديد وتفعيل القيد',
        messageHtml: messageHtml,
        icon: 'autorenew',
        confirmText: 'تأكيد التجديد'
    });

    if (!confirmed) return;

    const btn = document.getElementById('btnSpecialRenewAction') || document.querySelector('#renewActionArea .btn-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">refresh</span> جاري المعالجة...';

    const semesterType = document.getElementById('semesterTypeSelect')?.value || 'fall';
    const year = document.getElementById('yearInput')?.value || new Date().getFullYear();

    fetch('/renewal/api/semesters/')
        .then(r => r.json())
        .then(semestersData => {
            let semester = semestersData.semesters?.find(s => s.is_active);
            if (!semester) {
                return fetch('/renewal/api/semesters/create/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                    body: JSON.stringify({ year: parseInt(year), type: semesterType, is_active: true })
                }).then(r => r.json()).then(data => {
                    if (data.success) return data.semester;
                    throw new Error('فشل إنشاء الفصل الدراسي');
                });
            }
            return semester;
        })
        .then(semester => {
            return fetch('/renewal/api/special-renew-student/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    student_id: selectedStudentId,
                    semester_id: semester.id,
                    reason: reason,
                    special_type: selectedStudentData?.special_type || ''
                })
            });
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                let successMessage = data.message || `✅ تم تجديد وتفعيل قيد الطالب ${escapeHtml(studentName)} بنجاح`;
                if (data.new_level) {
                    successMessage += ` — المستوى: ${data.new_level}`;
                    successMessage += data.was_promoted ? ` (تمت الترقية)` : ` (تثبيت في المستوى)`;
                }
                showNotification('success', successMessage);
                loadSpecialCaseStudents();
                
                // تحويل الزر مباشرة إلى زر طباعة النموذج
                setRenewButtonMode('print');
            } else {
                showNotification('error', data.error || '❌ فشل تجديد القيد');
                setRenewButtonMode('renew');
            }
        })
        .catch(err => {
            console.error(err);
            showNotification('error', '❌ حدث خطأ في الاتصال بالخادم أثناء معالجة الطلب');
            setRenewButtonMode('renew');
        });
}

// ============================================================
// تحميل الطلاب في الحالات الخاصة
// ============================================================

function loadSpecialCaseStudents() {
    const specialCase = document.getElementById('specialCaseSelect')?.value || 'all';
    const departmentId = document.getElementById('majorSelect')?.value || '';
    const tbody = document.getElementById('specialStudentsTable');
    const countSpan = document.getElementById('specialCount');

    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">⏳ جاري التحميل...</td></tr>';

    let url = `/renewal/api/get-special-case-students/?special_case=${encodeURIComponent(specialCase)}`;
    if (departmentId) url += `&department_id=${encodeURIComponent(departmentId)}`;

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                if (data.students && data.students.length > 0) {
                    let html = '';
                    data.students.forEach((student, index) => {
                        const isMajorChange = student.special_type === 'major_change' || (student.interruption_reason && student.interruption_reason.includes('مسار'));
                        const statusClass = isMajorChange ? 'major-change' : 'suspended';
                        const statusText = isMajorChange ? '🔄 تغيير مسار' : '⛔ موقوف قيده';
                        const badgeStyle = isMajorChange ? 'background: #e0f2fe; color: #0369a1; border: 1.5px solid #7dd3fc;' : '';
                        const levelDisplay = student.level_number ? `المستوى ${student.level_number}` : '-';

                        html += `
                            <tr class="clickable-row" onclick="selectStudentForSpecialRenew('${escapeHtml(student.student_id || student.id)}')" title="انقر لاختيار الطالب وجلب بياناته">
                                <td style="text-align: center; padding: 16px 14px; font-weight: 800;" class="col-index">${index + 1}</td>
                                <td style="text-align: center; padding: 16px 14px; font-weight: 800;" class="col-student-id">${escapeHtml(student.student_id)}</td>
                                <td style="text-align: right; padding: 16px 14px; font-weight: 700;" class="col-student-name">${escapeHtml(student.name)} ${escapeHtml(student.father_name || '')}</td>
                                <td style="text-align: right; padding: 16px 14px;" class="col-dept">${escapeHtml(student.department_name)}</td>
                                <td style="text-align: center; padding: 16px 14px; font-weight: 800;" class="col-level">${levelDisplay}</td>
                                <td style="text-align: center; padding: 16px 14px;">
                                    <span class="special-status-badge ${statusClass}" style="${badgeStyle}">${statusText}</span>
                                </td>
                            </tr>
                        `;
                    });
                    tbody.innerHTML = html;
                    if (countSpan) countSpan.textContent = `عدد الحالات: ${data.count !== undefined ? data.count : data.students.length}`;
                } else {
                    tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="empty-cell">لا توجد حالات تطابق معايير الفلترة المختارة</td></tr>';
                    if (countSpan) countSpan.textContent = 'عدد الحالات: 0';
                }
            } else {
                tbody.innerHTML = `<tr class="empty-row"><td colspan="6" class="empty-cell">❌ ${data.error || 'حدث خطأ'}</td></tr>`;
            }
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="empty-cell">❌ حدث خطأ في التحميل</td></tr>';
        });
}

// ============================================================
// تجديد سريع من الجدول
// ============================================================

function quickRenewStudent(studentId, studentName) {
    const reason = prompt(`الرجاء كتابة سبب التأخير أو الملاحظات للطالب ${studentName}:`);
    if (reason === null) return;
    if (!reason.trim()) { showNotification('warning', '⚠️ الرجاء كتابة سبب التأخير'); return; }

    const semesterType = document.getElementById('semesterTypeSelect')?.value || 'fall';
    const year = document.getElementById('yearInput')?.value || new Date().getFullYear();

    fetch('/renewal/api/semesters/')
        .then(r => r.json())
        .then(semestersData => {
            let semester = semestersData.semesters?.find(s => s.is_active);
            if (!semester) {
                return fetch('/renewal/api/semesters/create/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                    body: JSON.stringify({ year: parseInt(year), type: semesterType, is_active: true })
                }).then(r => r.json()).then(data => {
                    if (data.success) return data.semester;
                    throw new Error('فشل إنشاء الفصل الدراسي');
                });
            }
            return semester;
        })
        .then(semester => fetch('/renewal/api/special-renew-student/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
            body: JSON.stringify({ student_id: studentId, semester_id: semester.id, reason: reason.trim() })
        }))
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                let msg = data.message || '✅ تم تجديد القيد بنجاح';
                if (data.was_promoted) msg += ' 📈 تمت الترقية';
                showNotification('success', msg);
                loadSpecialCaseStudents();
            } else {
                showNotification('error', data.error || '❌ فشل تجديد القيد');
            }
        })
        .catch(err => { console.error(err); showNotification('error', '❌ حدث خطأ في الاتصال بالخادم'); });
}

// ============================================================
// مسح البحث
// ============================================================

function clearSearch() {
    const searchInput = document.getElementById('searchStudentInput');
    const searchRegNum = document.getElementById('searchRegNum');
    const resultsContainer = document.getElementById('searchResults');
    const infoCard = document.getElementById('studentInfoCard');
    const actionArea = document.getElementById('renewActionArea');
    const reasonArea = document.getElementById('renewReason');

    if (searchInput) searchInput.value = '';
    if (searchRegNum) searchRegNum.value = '';
    if (reasonArea) reasonArea.value = '';
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
    }
    if (infoCard) infoCard.classList.add('hidden');
    if (actionArea) actionArea.classList.add('hidden');
    
    setRenewButtonMode('renew');

    selectedStudentId = null;
    selectedStudentData = null;
    showNotification('info', '🧹 تم تفريغ حقول البحث');
}

// ============================================================
// طباعة تقرير تجديد القيد (حالة خاصة)
// ============================================================

function ensurePrintContainerInBody() {
    const container = document.getElementById('printReportContainer');
    if (container && container.parentNode !== document.body) {
        document.body.appendChild(container);
    }
}

function printPage() {
    ensurePrintContainerInBody();

    const caseSelect  = document.getElementById('specialCaseSelect');
    const majorSelect = document.getElementById('majorSelect');

    const caseName = (caseSelect && caseSelect.selectedIndex > 0)
        ? caseSelect.options[caseSelect.selectedIndex]?.text
        : 'الكل';
    const deptName = (majorSelect && majorSelect.selectedIndex > 0)
        ? majorSelect.options[majorSelect.selectedIndex]?.text
        : 'جميع الأقسام / غير محدد';

    // ① تاريخ سحب التقرير فقط (بدون وقت أو نص إضافي)
    const now = new Date();
    const printDate = now.toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });

    // ② تعبئة معلومات رأس التقرير
    const printDeptName = document.getElementById('printDeptName');
    const printCaseName = document.getElementById('printCaseName');
    const printDateVal  = document.getElementById('printDateVal');
    const printCountVal = document.getElementById('printCountVal');
    const printTotalCount = document.getElementById('printTotalCount');
    const printTableBody  = document.getElementById('printTableBody');

    if (printDeptName) printDeptName.textContent = deptName;
    if (printCaseName) printCaseName.textContent  = caseName;
    if (printDateVal)  printDateVal.textContent   = printDate;

    // ③ بناء صفوف الجدول من الجدول الظاهر على الشاشة مع الاستبعاد التام لصفوف الرسائل الفارغة
    const tableBody = document.getElementById('specialStudentsTable');
    const rows = tableBody
        ? Array.from(tableBody.querySelectorAll('tr')).filter(tr => !tr.classList.contains('empty-row') && !tr.querySelector('.empty-cell'))
        : [];

    const studentCount = rows.length;
    if (printCountVal)   printCountVal.textContent   = studentCount;
    if (printTotalCount) printTotalCount.textContent = studentCount;

    if (printTableBody) {
        if (studentCount > 0) {
            printTableBody.innerHTML = rows.map((rowEl, index) => {
                const cells = rowEl.querySelectorAll('td');
                const studentId   = cells[1]?.innerText?.trim() || '-';
                const studentName = cells[2]?.innerText?.trim() || '-';
                const department  = cells[3]?.innerText?.trim() || deptName || '-';
                const level       = cells[4]?.innerText?.trim() || '-';

                return `
                <tr>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;font-weight:600;">${index + 1}</td>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(studentId)}</td>
                    <td style="padding:5px 6px;border:1px solid #000;text-align:right;font-weight:600;">${escapeHtml(studentName)}</td>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;">${escapeHtml(department)}</td>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;">${escapeHtml(level)}</td>
                </tr>`;
            }).join('');
        } else {
            printTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-print-cell" style="padding:15px;text-align:center;border:1px solid #000;">
                    لا توجد بيانات طلاب مسجلة في هذا التقرير حالياً
                </td>
            </tr>`;
        }
    }

    // ④ دالة الطباعة الفعلية
    const doPrint = () => window.print();

    // ⑤ جلب اسم المسؤول عبر OfficialsHelper مع دعم async/Promise
    //    يجب انتظار اكتمال autoFill() قبل استدعاء window.print()
    if (typeof OfficialsHelper !== 'undefined' && OfficialsHelper.autoFill) {
        try {
            const result = OfficialsHelper.autoFill();
            if (result && typeof result.then === 'function') {
                // autoFill() يُعيد Promise → ننتظره
                result.then(doPrint).catch(doPrint);
            } else {
                // sync أو لا يُعيد شيئاً → تأخير 400ms كضمان
                setTimeout(doPrint, 400);
            }
        } catch (e) {
            console.warn('[special_renew.js] OfficialsHelper.autoFill() error:', e);
            doPrint();
        }
    } else {
        doPrint();
    }
}

function printRenewForm() {
    printPage();
}

// ============================================================
// تهيئة الصفحة
// ============================================================

function init() {
    console.log('🚀 Initializing special renew page...');

    fetch('/renewal/api/semesters/')
        .then(r => r.json())
        .then(data => {
            if (data.success && data.semesters) {
                const active = data.semesters.find(s => s.is_active);
                if (active) {
                    currentSemesterData = active;
                    const semesterSelect = document.getElementById('semesterTypeSelect');
                    const yearInput = document.getElementById('yearInput');
                    if (semesterSelect && active.type) semesterSelect.value = active.type;
                    if (yearInput && active.year) yearInput.value = active.year;
                }
            }
        })
        .catch(err => console.error('Error loading semesters:', err));

    fetch('/renewal/api/departments/')
        .then(r => r.json())
        .then(data => {
            const select = document.getElementById('majorSelect');
            if (select && data.success && data.departments) {
                data.departments.forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.name;
                    select.appendChild(option);
                });
            }
        })
        .catch(err => console.error('Error loading departments:', err));

    document.getElementById('searchStudentInput')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); searchStudentForSpecialRenew(); }
    });

    setTimeout(loadSpecialCaseStudents, 500);
}

// ============================================================
// ربط الدوال للنطاق العام
// ============================================================

window.showNotification            = showNotification;
window.toastSuccess                 = toastSuccess;
window.toastError                   = toastError;
window.toastWarning                 = toastWarning;
window.toastInfo                    = toastInfo;
window.showToastMessage             = showToastMessage;
window.searchStudentForSpecialRenew = searchStudentForSpecialRenew;
window.selectStudentForSpecialRenew = selectStudentForSpecialRenew;
window.confirmSpecialRenew          = confirmSpecialRenew;
window.quickRenewStudent            = quickRenewStudent;
window.loadSpecialCaseStudents      = loadSpecialCaseStudents;
window.clearSearch                  = clearSearch;
window.printPage                    = printPage;
window.printRenewForm               = printRenewForm;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('✅ special_renew.js — all functions registered');

// ============================================================
// 🔥 التحكم في حالة الأزرار بناءً على صلاحية تجديد القيد (Special Renew Registration Permission)
// ============================================================

function applySpecialRenewPermissionUI(isOpen, message) {
    const btnSearch = document.getElementById('btnSearchStudent');
    const btnReset = document.getElementById('btnResetSearch');
    const btnPrint = document.getElementById('btnPrintReportCard');
    const btnRenew = document.getElementById('renewRegistrationBtn');

    const targetButtons = [btnSearch, btnReset, btnPrint, btnRenew];

    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');

    console.log(`🔐 Special Renew Job Permission State - Is Open: ${isOpen}`);

    if (banner) {
        if (!isOpen) {
            if (bannerText && message) bannerText.textContent = message;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    targetButtons.forEach(btn => {
        if (btn) {
            if (!isOpen) {
                btn.disabled = true;
                btn.setAttribute('disabled', 'disabled');
                btn.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btn.style.setProperty('opacity', '0.5', 'important');
                btn.style.setProperty('cursor', 'not-allowed', 'important');
                btn.style.setProperty('pointer-events', 'none', 'important');
                btn.style.setProperty('filter', 'grayscale(80%)', 'important');
                if (message) btn.title = message;
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
    const isOpen = (typeof window.IS_RENEW_JOB_OPEN !== 'undefined') ? Boolean(window.IS_RENEW_JOB_OPEN) : false;
    const message = window.RENEW_JOB_MESSAGE || '';

    applySpecialRenewPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_RENEW_JOB_OPEN = Boolean(data.is_renew_job_open);
            window.RENEW_JOB_MESSAGE = data.renew_job_message || '';
            applySpecialRenewPermissionUI(window.IS_RENEW_JOB_OPEN, window.RENEW_JOB_MESSAGE);
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic special renew job permission check error:', err);
    });
}
function updatePrintDate() {
    const el = document.getElementById('printReportDate') || document.getElementById('printDate');
    if (el) {
        const now = new Date();
        el.textContent = now.toLocaleDateString('ar-LY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}
window.updatePrintDate = updatePrintDate;

window.updateJobPermissionState = updateJobPermissionState;
window.loadSpecialCaseStudents = loadSpecialCaseStudents;
window.searchStudentForSpecialRenew = searchStudentForSpecialRenew;
window.selectStudentForSpecialRenew = selectStudentForSpecialRenew;
window.confirmSpecialRenew = confirmSpecialRenew;
window.quickRenewStudent = quickRenewStudent;
window.clearSearch = clearSearch;

// تهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Special Renew Permissions...');
    updateJobPermissionState();
    if (typeof loadSpecialCaseStudents === 'function') {
        loadSpecialCaseStudents();
    }
    if (typeof updatePrintDate === 'function') {
        updatePrintDate();
    }

    // ربط إدخال البحث التلقائي (Autocomplete / Live Search)
    const nameInput = document.getElementById('searchStudentInput');
    const regInput = document.getElementById('searchRegNum');

    let debounceTimeout = null;
    const handleLiveSearch = () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const query = (nameInput?.value || '') + (regInput?.value || '');
            if (query.trim().length >= 1) {
                searchStudentForSpecialRenew();
            } else {
                const resultsContainer = document.getElementById('searchResults');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '';
                    resultsContainer.classList.add('hidden');
                }
            }
        }, 300);
    };

    if (nameInput) nameInput.addEventListener('input', handleLiveSearch);
    if (regInput) regInput.addEventListener('input', handleLiveSearch);
});

// تطبيق أولي مباشر
updateJobPermissionState();

console.log('✅ All special renew functions registered successfully');

