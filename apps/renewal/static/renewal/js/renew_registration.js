// ============================================
// تجديد القيد - renew_registration.js v1.0.28
// ============================================

console.log('✅ renew_registration.js v1.0.28 loaded successfully');

// ============================================================
// دوال مساعدة
// ============================================================

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

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
    if (parts.length >= 3) return parts.join(' ');
    if (student.full_name && student.full_name.trim().length > 0) return student.full_name.trim();
    return parts.join(' ') || student.name || '-';
}

function showToastMessage(message, isError = false) {
    if (typeof showNotification === 'function') {
        showNotification(isError ? 'error' : 'success', message);
    } else {
        console.log(message);
    }
}

function showLoading(show) {
    const tbody = document.getElementById('studentsTableBody');
    const section = document.getElementById('studentSelectionSection');
    if (section && show) section.style.display = 'block';
    if (tbody && show) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">⏳ جاري تحميل البيانات...</td></tr>';
    }
}

// ============================================================
// تحميل الفلاتر (التخصصات)
// ============================================================

function loadFilters() {
    console.log('📋 Loading filters...');
    fetch('/renewal/api/departments/')
        .then(r => r.json())
        .then(data => {
            const majorSelect = document.getElementById('majorSelect');
            if (majorSelect && data.departments) {
                majorSelect.innerHTML = '<option value="">-- اختر التخصص --</option>' +
                    data.departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
            }
        })
        .catch(err => console.error('❌ Error loading departments:', err));
}

// ============================================================
// تحميل مستويات القسم ديناميكياً
// ============================================================

function loadDepartmentLevels(deptId) {
    const levelSelect = document.getElementById('levelSelect');
    if (!levelSelect) return;

    levelSelect.disabled = false;
    levelSelect.removeAttribute('disabled');

    const targetUrl = deptId ? `/renewal/api/get-department-levels/${deptId}/` : `/renewal/api/get-department-levels/0/`;

    fetch(targetUrl)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.levels && data.levels.length > 0) {
                levelSelect.innerHTML = '<option value="">-- الكل --</option>' +
                    data.levels.map(lvl => `<option value="${lvl.id}">${escapeHtml(lvl.name)}</option>`).join('');
            } else {
                levelSelect.innerHTML = '<option value="">-- الكل --</option>';
            }
            levelSelect.disabled = false;
            levelSelect.removeAttribute('disabled');
            if (typeof levelSelect.rebuildCustomOptions === 'function') levelSelect.rebuildCustomOptions();
            else if (typeof initializeCustomSelects === 'function') initializeCustomSelects();
        })
        .catch(err => {
            console.error('❌ Error loading department levels:', err);
            levelSelect.disabled = false;
        });
}

// ============================================================
// تحميل الطلاب
// ============================================================

function loadStudents() {
    console.log('👨‍🎓 loadStudents called');

    const isRenewOpen = (typeof window.IS_RENEW_JOB_OPEN !== 'undefined') ? Boolean(window.IS_RENEW_JOB_OPEN) : false;
    if (!isRenewOpen) {
        showToastMessage(window.RENEW_JOB_MESSAGE || '⚠️ عذراً، خدمة تجديد القيد موقوفة حالياً حسب جدول إدارة الوظائف.', true);
        return;
    }

    const departmentId = document.getElementById('majorSelect')?.value;
    const seasonSelect = document.getElementById('seasonSelect');
    const yearInput = document.getElementById('yearInput');
    const levelId = document.getElementById('levelSelect')?.value || '';
    const seasonType = seasonSelect ? seasonSelect.value : '';
    const year = yearInput ? yearInput.value : '';

    if (!departmentId) {
        if (typeof toastWarning === 'function') toastWarning('الرجاء اختيار التخصص');
        const section = document.getElementById('studentSelectionSection');
        const tbody = document.getElementById('studentsTableBody');
        if (section) section.style.display = 'block';
        if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">لا توجد نتائج (الرجاء اختيار التخصص)</td></tr>';
        return;
    }

    if (!seasonType || !year) {
        if (typeof toastWarning === 'function') toastWarning('الرجاء اختيار نوع الفصل والسنة الدراسية');
        const section = document.getElementById('studentSelectionSection');
        const tbody = document.getElementById('studentsTableBody');
        if (section) section.style.display = 'block';
        if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">لا توجد نتائج (الرجاء اختيار التخصص والفصل)</td></tr>';
        return;
    }

    showLoading(true);

    let url = `/renewal/api/get-students-by-level/?major_id=${encodeURIComponent(departmentId)}&semester_type=${encodeURIComponent(seasonType)}&year=${encodeURIComponent(year)}`;
    if (levelId) url += `&level_id=${encodeURIComponent(levelId)}`;

    fetch(url, {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': getCookie('csrftoken') }
    })
        .then(r => {
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            return r.json();
        })
        .then(data => {
            showLoading(false);
            const section = document.getElementById('studentSelectionSection');

            if (data.success) {
                window.currentSemesterId = data.semester_id;
                window.currentSemesterName = data.semester_name;
                window.loadedStudentsMap = {};

                if (data.students && data.students.length > 0) {
                    if (section) section.style.display = 'block';
                    data.students.forEach(student => {
                        window.loadedStudentsMap[student.id] = student;
                    });
                    renderDualTables();
                    if (typeof toastSuccess === 'function') toastSuccess(`تم تحميل ${data.students.length} طالب بنجاح`);
                } else {
                    if (section) section.style.display = 'block';
                    renderDualTables();
                    if (typeof toastWarning === 'function') toastWarning('لا توجد نتائج للطلاب في هذا التخصص/المستوى');
                }
            } else {
                window.currentSemesterId = null;
                window.currentSemesterName = null;
                window.loadedStudentsMap = {};
                if (section) section.style.display = 'block';
                const tbody = document.getElementById('studentsTableBody');
                if (tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="6" class="text-center py-4 text-red-500">${escapeHtml(data.error || 'حدث خطأ')}</td></tr>`;
                if (typeof toastError === 'function') toastError(data.error || 'حدث خطأ في تحميل الطلاب');
            }
        })
        .catch(err => {
            console.error('❌ Error loading students:', err);
            if (typeof toastError === 'function') toastError('حدث خطأ في تحميل الطلاب');
            const tbody = document.getElementById('studentsTableBody');
            const section = document.getElementById('studentSelectionSection');
            if (section) section.style.display = 'block';
            if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="text-center py-4 text-gray-500">لا توجد نتائج</td></tr>';
        });
}

// ============================================================
// 📊 عرض وتوزيع الطلاب على الجدولين (بانتظار التجديد / المجددين)
// ============================================================

function renderDualTables() {
    const unrenewedTbody = document.getElementById('studentsTableBody');
    const renewedTbody = document.getElementById('renewedStudentsTableBody');
    const unrenewedBadge = document.getElementById('unrenewedCountBadge');
    const renewedBadge = document.getElementById('renewedCountBadge');
    const selectAll = document.getElementById('selectAll');

    const allStudents = Object.values(window.loadedStudentsMap || {});
    const unrenewedStudents = allStudents.filter(s => !s.is_renewed);
    const renewedStudents = allStudents.filter(s => s.is_renewed);

    if (unrenewedBadge) unrenewedBadge.innerText = unrenewedStudents.length;
    if (renewedBadge) renewedBadge.innerText = renewedStudents.length;

    // 1. جدول الطلاب بانتظار تجديد القيد (العلوي)
    if (unrenewedTbody) {
        if (unrenewedStudents.length > 0) {
            unrenewedTbody.innerHTML = unrenewedStudents.map(student => {
                const quadName = student.full_name || constructQuadName(student);
                const currentLvl = student.current_level_name || 'المستوى الأول';
                const targetLvl = student.target_level_name || 'المستوى التالي';

                return `
                <tr class="border-b hover:bg-gray-50 dark:hover:bg-slate-700" data-student-id="${student.id}" data-current-level="${escapeHtml(currentLvl)}" data-target-level="${escapeHtml(targetLvl)}">
                    <td class="px-3 py-2 text-center" style="text-align: center;">
                        <input type="checkbox" class="student-checkbox" data-id="${student.id}" checked>
                    </td>
                    <td class="px-3 py-2 text-center font-bold" style="text-align: center; font-family: monospace; font-size: 13px;">${escapeHtml(student.student_id)}</td>
                    <td class="px-3 py-2 text-right" style="text-align: right; font-weight: 700;">${escapeHtml(quadName)}</td>
                    <td class="px-3 py-2 text-center" style="text-align: center; font-weight: 700; color: #64748b;">${escapeHtml(currentLvl)}</td>
                    <td class="px-3 py-2 text-center" style="text-align: center; font-weight: 900; color: #0284c7;">${escapeHtml(targetLvl)}</td>
                </tr>`;
            }).join('');
            if (selectAll) selectAll.checked = true;
        } else {
            unrenewedTbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5" class="empty-cell" style="padding: 16px; text-align: center; color: #10b981; font-weight: 700;">
                        <span class="material-symbols-outlined" style="font-size: 20px; vertical-align: middle; margin-left: 4px;">task_alt</span>
                        جميع طلاب هذا التخصص والمستوى تم تجديد قيدهم بالفعل لهذا الفصل
                    </td>
                </tr>`;
            if (selectAll) selectAll.checked = false;
        }
    }

    // 2. جدول الطلاب المجدد قيدهم بالفعل (السفلي)
    if (renewedTbody) {
        if (renewedStudents.length > 0) {
            renewedTbody.innerHTML = renewedStudents.map((student, idx) => {
                const quadName = student.full_name || constructQuadName(student);
                const currentLvl = student.current_level_name || 'المستوى الأول';
                const targetLvl = student.target_level_name || 'المستوى التالي';

                return `
                <tr class="border-b hover:bg-gray-50 dark:hover:bg-slate-700" data-student-id="${student.id}" data-current-level="${escapeHtml(currentLvl)}" data-target-level="${escapeHtml(targetLvl)}">
                    <td class="px-3 py-2 text-center" style="text-align: center; font-weight: 800; color: #64748b;">${idx + 1}</td>
                    <td class="px-3 py-2 text-center font-bold" style="text-align: center; font-family: monospace; font-size: 13px;">${escapeHtml(student.student_id)}</td>
                    <td class="px-3 py-2 text-right" style="text-align: right; font-weight: 700;">${escapeHtml(quadName)}</td>
                    <td class="px-3 py-2 text-center" style="text-align: center; font-weight: 700; color: #64748b;">${escapeHtml(currentLvl)}</td>
                    <td class="px-3 py-2 text-center" style="text-align: center; font-weight: 900; color: #10b981;">${escapeHtml(targetLvl)}</td>
                    <td class="px-3 py-2 text-center" style="text-align: center;">
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                            <button type="button" class="btn-single-print" onclick="window.printSingleStudentRenew(${student.id})" title="طباعة نموذج تجديد القيد لهذا الطالب" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; border: none; padding: 4px 9px; border-radius: 6px; font-size: 11.5px; font-weight: 800; display: inline-flex; align-items: center; gap: 3px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                                <span class="material-symbols-outlined" style="font-size: 14px;">print</span> طباعة
                            </button>
                            <span style="color: #10b981; font-weight: 800; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 2px;">
                                <span class="material-symbols-outlined" style="font-size: 15px;">check_circle</span> تم التجديد
                            </span>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        } else {
            renewedTbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="6" class="empty-cell" style="padding: 16px; text-align: center; color: #94a3b8;">
                        لا يوجد طلاب مجدد قيدهم بعد في هذا الفصل
                    </td>
                </tr>`;
        }
    }
}

// ============================================================
// تحديد الكل / تجديد القيد / حذف صف
// ============================================================

function toggleAll(checkbox) {
    document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = checkbox.checked);
}

function renewRegistration() {
    const isRenewOpen = (typeof window.IS_RENEW_JOB_OPEN !== 'undefined') ? Boolean(window.IS_RENEW_JOB_OPEN) : false;
    if (!isRenewOpen) {
        showToastMessage(window.RENEW_JOB_MESSAGE || '⚠️ عذراً، خدمة تجديد القيد موقوفة حالياً.', true);
        return;
    }
    saveData();
}

function saveData() {
    const selected = document.querySelectorAll('.student-checkbox:checked');
    const studentIds = Array.from(selected).map(cb => cb.getAttribute('data-id'));

    if (studentIds.length === 0) {
        if (typeof toastWarning === 'function') toastWarning('الرجاء تحديد الطلاب للحفظ');
        return;
    }

    const semesterId = window.currentSemesterId;
    const seasonType = document.getElementById('seasonSelect')?.value || '';
    const year = document.getElementById('yearInput')?.value || '';

    if (!semesterId && (!seasonType || !year)) {
        if (typeof toastWarning === 'function') toastWarning('الرجاء تحميل قائمة الطلاب أولاً لتحديد الفصل الدراسي');
        return;
    }

    if (typeof toastInfo === 'function') toastInfo('جاري حفظ البيانات...');

    fetch('/renewal/api/renew-students/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            student_ids: studentIds,
            semester_id: semesterId,
            semester_type: seasonType,
            year: year
        })
    })
        .then(r => {
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            return r.json();
        })
        .then(data => {
            if (data.success) {
                const renewedCount = data.renewed_count || 0;
                const alreadyCount = data.updated_count || 0;
                const errorsList = data.errors || [];

                if (renewedCount > 0 || alreadyCount > 0) {
                    const totalDone = renewedCount + alreadyCount;
                    showNotification('success', `تم تجديد قيد ${totalDone} طالب بنجاح! تم نقلهم إلى جدول المجددين وجاهزون للطباعة.`);

                    // تحديث حالة الطلاب في الـ loadedStudentsMap وإعادة بناء الجدولين تلقائياً
                    studentIds.forEach(id => {
                        if (window.loadedStudentsMap && window.loadedStudentsMap[id]) {
                            window.loadedStudentsMap[id].is_renewed = true;
                        }
                    });

                    renderDualTables();

                    const successMsg = document.getElementById('renewSuccessMessage');
                    if (successMsg) {
                        successMsg.classList.remove('hidden');
                        successMsg.style.display = 'flex';
                    }

                    const section = document.getElementById('studentSelectionSection');
                    if (section) section.style.display = 'block';

                    if (errorsList && errorsList.length > 0) {
                        errorsList.forEach(err => { if (typeof toastError === 'function') toastError(err); });
                    }
                } else if (errorsList && errorsList.length > 0) {
                    showNotification('error', errorsList.join(' | '));
                } else {
                    showNotification('info', data.message || 'لا توجد تغييرات جديدة');
                }
            } else {
                showNotification('error', data.error || (data.errors ? data.errors.join(' | ') : 'حدث خطأ في الحفظ'));
            }
        })
        .catch(err => {
            console.error('❌ Error saving data:', err);
            showNotification('error', 'حدث خطأ أثناء الاتصال بالخادم');
        });
}

function deleteRow(btn) {
    const row = btn.closest('tr');
    if (row) {
        row.remove();
        const selectAll = document.getElementById('selectAll');
        if (selectAll) selectAll.checked = false;
        const remaining = document.querySelectorAll('#studentsTableBody tr:not(.empty-row)');
        if (remaining.length === 0) {
            const tbody = document.getElementById('studentsTableBody');
            if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">لا توجد بيانات</td></tr>';
        }
        if (typeof toastSuccess === 'function') toastSuccess('تم حذف الطالب');
    }
}

function deleteSelected() {
    const selected = document.querySelectorAll('.student-checkbox:checked');
    if (selected.length === 0) {
        if (typeof toastWarning === 'function') toastWarning('الرجاء تحديد الطلاب للحذف');
        return;
    }
    selected.forEach(cb => { const row = cb.closest('tr'); if (row) row.remove(); });
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = false;
    const remaining = document.querySelectorAll('#studentsTableBody tr:not(.empty-row)');
    if (remaining.length === 0) {
        const tbody = document.getElementById('studentsTableBody');
        if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">لا توجد بيانات</td></tr>';
    }
    if (typeof toastSuccess === 'function') toastSuccess(`تم حذف ${selected.length} طالب بنجاح`);
}

// ============================================================
// 📦 إدارة حاوية الطباعة في الـ DOM
// ============================================================

function ensurePrintContainerInBody(containerId = 'printReportContainer') {
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style.display = 'none';
        document.body.appendChild(container);
    } else if (container.parentElement !== document.body) {
        document.body.appendChild(container);
    }
    return container;
}
window.ensurePrintContainerInBody = ensurePrintContainerInBody;

// ============================================================
// 🏛️ جلب بيانات المسؤولين والمسجل العام
// ============================================================

let cachedRegistrarName = '';

async function fetchActiveOfficials() {
    if (cachedRegistrarName) return cachedRegistrarName;
    try {
        if (window.OfficialsHelper && typeof window.OfficialsHelper.getOfficial === 'function') {
            const off = window.OfficialsHelper.getOfficial('general_registrar');
            if (off && off.name) {
                cachedRegistrarName = ((off.title ? off.title + ' ' : '') + off.name).trim();
                return cachedRegistrarName;
            }
        }
        const res = await fetch('/users/api/officials/');
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.officials)) {
                const reg = data.officials.find(o => o.status === 'active' && (
                    (o.position && (o.position.includes('مسجل') || o.position.includes('المسجل العام'))) ||
                    o.role === 'general_registrar'
                ));
                if (reg) {
                    cachedRegistrarName = `${(reg.title || 'أ.').trim()} ${(reg.name || '').trim()}`.trim();
                    return cachedRegistrarName;
                }
            }
        }
    } catch (e) {
        console.warn('Could not fetch officials from API:', e);
    }
    cachedRegistrarName = 'أ. أحمد محمد علي محمود';
    return cachedRegistrarName;
}

function fillRegistrarName() {
    return cachedRegistrarName || 'أ. أحمد محمد علي محمود';
}

// ============================================================
// 🖨️ دالة الطباعة - تقرير رسمي معتمد بتنسيق A4 عبر Hidden iframe
// ============================================================

async function printPage() {
    console.log('🖨️ printPage called via hidden iframe');

    await fetchActiveOfficials();
    const registrarName = fillRegistrarName();

    // ── جمع بيانات الفلاتر ──────────────────────────────────
    const departmentSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('levelSelect');
    const seasonSelect = document.getElementById('seasonSelect');
    const yearInput = document.getElementById('yearInput');

    const departmentName = (departmentSelect && departmentSelect.selectedIndex > 0)
        ? departmentSelect.options[departmentSelect.selectedIndex].text.replace(/^--\s*|\s*--$/g, '').trim()
        : 'جميع التخصصات / غير محدد';

    const levelName = (levelSelect && levelSelect.selectedIndex > 0)
        ? levelSelect.options[levelSelect.selectedIndex].text.replace(/^--\s*|\s*--$/g, '').trim()
        : 'الكل';

    let seasonName = 'ربيع';
    if (seasonSelect && seasonSelect.value) {
        seasonName = (seasonSelect.value === 'fall' || seasonSelect.value.includes('خريف')) ? 'خريف' : 'ربيع';
    }
    const yearVal = yearInput ? (yearInput.value.trim() || '2026') : '2026';
    const semesterFormatted = `${seasonName} ${yearVal}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    // ── جمع صفوف الطلاب المجددين من جدول المجددين ──────────────
    const renewedTbody = document.getElementById('renewedStudentsTableBody');
    let targetRows = [];

    if (renewedTbody) {
        targetRows = Array.from(renewedTbody.querySelectorAll('tr:not(.empty-row)'));
    }

    const studentCount = targetRows.length;
    let rowsHtml = '';

    if (studentCount > 0) {
        rowsHtml = targetRows.map((row, index) => {
            const cells = row.querySelectorAll('td');
            const studentId = cells[1]?.innerText?.trim() || '-';
            const name = cells[2]?.innerText?.trim() || '-';
            const currentLvl = row.getAttribute('data-current-level') || cells[3]?.innerText?.trim() || 'المستوى الأول';
            const targetLvl = row.getAttribute('data-target-level') || cells[4]?.innerText?.trim() || 'المستوى التالي';
            return `
                <tr>
                    <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: 800;">${index + 1}</td>
                    <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-family: monospace; font-weight: 900; font-size: 12px;">${escapeHtml(studentId)}</td>
                    <td style="padding: 6px 10px; border: 1px solid #000; text-align: right; font-weight: 800; font-size: 12.5px;">${escapeHtml(name)}</td>
                    <td style="padding: 6px 6px; border: 1px solid #000; text-align: center; font-weight: 700;">${escapeHtml(currentLvl)}</td>
                    <td style="padding: 6px 6px; border: 1px solid #000; text-align: center; font-weight: 800;">${escapeHtml(targetLvl)}</td>
                    <td style="padding: 6px 6px; border: 1px solid #000; text-align: center; font-weight: 700;">${escapeHtml(departmentName)}</td>
                </tr>`;
        }).join('');
    } else {
        rowsHtml = `<tr><td colspan="6" style="padding: 24px; text-align: center; font-weight: 800; font-size: 13px; border: 1px solid #000;">لا يوجد طلاب مجدد قيدهم في هذا الفصل للطباعة</td></tr>`;
    }

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير تجديد القيد</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

    @page {
        size: A4 portrait;
        margin: 5mm;
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
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
        direction: rtl;
        font-size: 12px;
    }
    .print-page-frame {
        width: 100%;
        min-height: 275mm;
        margin: 0 auto;
        padding: 22px 28px;
        border: 2px solid #000000;
        background: #ffffff;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .bf-header {
        text-align: center;
        margin-bottom: 6px;
    }
    .bf-logo {
        width: 65px;
        height: 65px;
        object-fit: contain;
        margin: 0 auto 3px auto;
        display: block;
    }
    .bf-gov {
        font-size: 12px;
        font-weight: 700;
        color: #000;
        line-height: 1.25;
    }
    .bf-college {
        font-size: 15px;
        font-weight: 900;
        color: #000;
        margin-top: 2px;
    }
    .bf-line {
        border-top: 1.5px solid #000000;
        margin: 6px 0;
        width: 100%;
        display: block;
    }
    .bf-title {
        font-size: 20px;
        font-weight: 900;
        margin: 6px 0;
        text-align: center;
        color: #000000;
    }
    .report-meta-grid {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 10px 0 14px 0;
        font-size: 12.5px;
        font-weight: 700;
        background: #ffffff;
    }
    .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .meta-lbl {
        font-weight: 700;
        color: #000;
    }
    .meta-val {
        font-weight: 900;
        color: #000;
    }
    .students-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
    }
    .students-table th {
        background-color: #f1f5f9;
        color: #000000;
        border: 1px solid #000000;
        padding: 6px 4px;
        font-size: 11.5px;
        font-weight: 900;
        text-align: center;
    }
    .students-table td {
        border: 1px solid #000000;
        padding: 5px 6px;
        font-size: 11.5px;
        color: #000000;
    }
    .bf-signatures-container {
        display: flex !important;
        justify-content: flex-end !important;
        margin-top: 25px !important;
        padding-left: 10px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-column-break-inside: avoid !important;
    }
    .bf-sig-col {
        text-align: center !important;
        width: 260px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-column-break-inside: avoid !important;
        display: block !important;
    }
    .off-name {
        font-size: 13.5px !important;
        font-weight: 900 !important;
        margin-bottom: 3px !important;
        min-height: 18px !important;
        color: #000 !important;
    }
    .off-pos {
        font-size: 12.5px !important;
        font-weight: 800 !important;
        color: #111 !important;
        margin-bottom: 16px !important;
    }
    .off-sig {
        font-size: 12px !important;
        font-weight: 700 !important;
        color: #000 !important;
        white-space: nowrap !important;
    }
    @media print {
        @page { size: A4 portrait; margin: 4mm; }
        html, body { width: 100%; height: 100%; }
        .print-page-frame { min-height: 275mm; border: 2px solid #000000; }
        .bf-signatures-container,
        .bf-sig-col {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
        }
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
            <div class="bf-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">تقرير تجديد القيد</div>

            <!-- شبكة بيانات التقرير والتخصص -->
            <div class="report-meta-grid">
                <div class="meta-item">
                    <span class="meta-lbl">القسم / التخصص:</span>
                    <span class="meta-val">${escapeHtml(departmentName)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">المستوى:</span>
                    <span class="meta-val">${escapeHtml(levelName)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">الفصل الدراسي:</span>
                    <span class="meta-val">${escapeHtml(semesterFormatted)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">عدد الطلاب:</span>
                    <span class="meta-val">${studentCount}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">التاريخ:</span>
                    <span class="meta-val">${dateStr}</span>
                </div>
            </div>

            <!-- جدول الطلاب -->
            <table class="students-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">م</th>
                        <th style="width: 17%;">رقم القيد</th>
                        <th style="width: 27%;">اسم الطالب</th>
                        <th style="width: 18%;">المستوى الحالي</th>
                        <th style="width: 18%;">المستوى المنتقل إليه</th>
                        <th style="width: 15%;">التخصص</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>

        <!-- اعتماد التوقيع والختم في أقصى اليسار -->
        <div class="bf-signatures-container">
            <div class="bf-sig-col">
                <div class="off-name">${escapeHtml(registrarName)}</div>
                <div class="off-pos">المسجل العام بالكلية</div>
                <div class="off-sig">التوقيع والختم: ....................................</div>
            </div>
        </div>
    </div>
</body>
</html>`;

    // ─────────────────────────────────────────────────────────────
    // إنشاء iframe خفي والطباعة من خلاله
    // ─────────────────────────────────────────────────────────────
    let printIframe = document.getElementById('renewPrintIframe');
    if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'renewPrintIframe';
        printIframe.style.position = 'fixed';
        printIframe.style.top = '-9999px';
        printIframe.style.left = '-9999px';
        printIframe.style.width = '0px';
        printIframe.style.height = '0px';
        printIframe.style.border = 'none';
        document.body.appendChild(printIframe);
    }

    const doc = printIframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
        try {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
        } catch (e) {
            console.error('Print frame error:', e);
            const w = window.open('', '_blank');
            w.document.write(printHtml);
            w.document.close();
            w.focus();
            w.print();
        }
    }, 400);
}

// ============================================================
// 🖨️ دالة طباعة نموذج تجديد القيد الفردي لطالب محدد
// ============================================================

async function printSingleStudentRenew(studentId) {
    console.log('🖨️ printSingleStudentRenew called for studentId:', studentId);

    await fetchActiveOfficials();
    const registrarName = fillRegistrarName();

    let student = (window.loadedStudentsMap && window.loadedStudentsMap[studentId]) ? window.loadedStudentsMap[studentId] : null;

    const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
    if (!student && row) {
        const cells = row.querySelectorAll('td');
        student = {
            id: studentId,
            student_id: cells[1]?.innerText?.trim() || '-',
            name: cells[2]?.innerText?.trim() || '-',
            full_name: cells[2]?.innerText?.trim() || '-',
            current_level_name: row.getAttribute('data-current-level') || cells[3]?.innerText?.trim() || 'المستوى الأول',
            target_level_name: row.getAttribute('data-target-level') || cells[4]?.innerText?.trim() || 'المستوى التالي',
            department_name: document.getElementById('majorSelect')?.selectedOptions[0]?.text?.replace(/^--\s*|\s*--$/g, '') || 'عام',
            national_id: '—'
        };
    }

    if (!student) {
        showToastMessage('⚠️ تعذر العثور على بيانات الطالب المحدد للطباعة', true);
        return;
    }

    const seasonSelect = document.getElementById('seasonSelect');
    const yearInput = document.getElementById('yearInput');
    let seasonName = 'ربيع';
    if (seasonSelect && seasonSelect.value) {
        seasonName = (seasonSelect.value === 'fall' || seasonSelect.value.includes('خريف')) ? 'خريف' : 'ربيع';
    }
    const yearVal = yearInput ? (yearInput.value.trim() || '2026') : '2026';
    const semesterFormatted = `${seasonName} ${yearVal}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    const currentLvlName = student.current_level_name || 'المستوى الأول';
    const targetLvlName = student.target_level_name || 'المستوى التالي';
    const deptName = student.department_name || document.getElementById('majorSelect')?.selectedOptions[0]?.text?.replace(/^--\s*|\s*--$/g, '') || 'عام';

    const singlePrintHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>نموذج تجديد القيد - ${escapeHtml(student.full_name || student.name)}</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

    @page {
        size: A4 portrait;
        margin: 5mm;
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
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
        direction: rtl;
        font-size: 13px;
    }
    .print-page-frame {
        width: 100%;
        min-height: 275mm;
        margin: 0 auto;
        padding: 24px 30px;
        border: 2px solid #000000;
        background: #ffffff;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .bf-header {
        text-align: center;
        margin-bottom: 6px;
    }
    .bf-logo {
        width: 65px;
        height: 65px;
        object-fit: contain;
        margin: 0 auto 3px auto;
        display: block;
    }
    .bf-gov {
        font-size: 12px;
        font-weight: 700;
        color: #000;
        line-height: 1.25;
    }
    .bf-college {
        font-size: 15px;
        font-weight: 900;
        color: #000;
        margin-top: 2px;
    }
    .bf-line {
        border-top: 1.5px solid #000000;
        margin: 6px 0;
        width: 100%;
        display: block;
    }
    .bf-title {
        font-size: 20px;
        font-weight: 900;
        margin: 6px 0;
        text-align: center;
        color: #000000;
        letter-spacing: 0.5px;
    }
    .single-info-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0 16px 0;
    }
    .single-info-table td {
        padding: 10px 14px;
        border: 1.5px solid #000000;
        font-size: 13.5px;
    }
    .lbl-cell {
        background-color: #f1f5f9;
        font-weight: 800;
        width: 24%;
        color: #000000;
    }
    .val-cell {
        font-weight: 700;
        width: 26%;
        color: #000000;
    }
    .val-cell.highlight {
        font-weight: 900;
        font-size: 14.5px;
    }
    .official-notice-box {
        margin: 20px 0;
        padding: 16px 20px;
        border: 2px solid #000000;
        background: #ffffff;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.9;
        text-align: justify;
    }
    .bf-signatures-container {
        display: flex !important;
        justify-content: flex-end !important;
        margin-top: 25px !important;
        padding-left: 10px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-column-break-inside: avoid !important;
    }
    .bf-sig-col {
        text-align: center !important;
        width: 260px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-column-break-inside: avoid !important;
        display: block !important;
    }
    .off-name {
        font-size: 13.5px !important;
        font-weight: 900 !important;
        margin-bottom: 3px !important;
        min-height: 18px !important;
        color: #000 !important;
    }
    .off-pos {
        font-size: 12.5px !important;
        font-weight: 800 !important;
        color: #111 !important;
        margin-bottom: 16px !important;
    }
    .off-sig {
        font-size: 12px !important;
        font-weight: 700 !important;
        color: #000 !important;
        white-space: nowrap !important;
    }
    @media print {
        @page { size: A4 portrait; margin: 4mm; }
        html, body { width: 100%; height: 100%; }
        .print-page-frame { min-height: 275mm; border: 2px solid #000000; }
        .bf-signatures-container,
        .bf-sig-col {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-column-break-inside: avoid !important;
        }
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
            <div class="bf-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">نموذج تجديد القيد الدراسي</div>

            <!-- جدول البيانات الأكاديمية للطالب -->
            <table class="single-info-table">
                <tr>
                    <td class="lbl-cell">اسم الطالب الرباعي:</td>
                    <td class="val-cell highlight" colspan="3" style="font-size: 15px;">${escapeHtml(student.full_name || student.name)}</td>
                </tr>
                <tr>
                    <td class="lbl-cell">رقم القيد:</td>
                    <td class="val-cell highlight" style="font-family: monospace; font-size: 15px;">${escapeHtml(student.student_id)}</td>
                    <td class="lbl-cell">الرقم الوطني:</td>
                    <td class="val-cell" style="font-family: monospace;">${escapeHtml(student.national_id || '—')}</td>
                </tr>
                <tr>
                    <td class="lbl-cell">القسم / التخصص:</td>
                    <td class="val-cell highlight">${escapeHtml(deptName)}</td>
                    <td class="lbl-cell">الفصل الدراسي:</td>
                    <td class="val-cell highlight">${escapeHtml(semesterFormatted)}</td>
                </tr>
                <tr>
                    <td class="lbl-cell">المستوى الحالي (السابق):</td>
                    <td class="val-cell">${escapeHtml(currentLvlName)}</td>
                    <td class="lbl-cell">المستوى المنتقل إليه:</td>
                    <td class="val-cell highlight" style="color: #000000; font-size: 15px;">${escapeHtml(targetLvlName)}</td>
                </tr>
                <tr>
                    <td class="lbl-cell">حالة القيد الأكاديمي:</td>
                    <td class="val-cell"><span style="font-weight: 800;">مجدد القيد (منتظم)</span></td>
                    <td class="lbl-cell">تاريخ الطباعة:</td>
                    <td class="val-cell">${dateStr}</td>
                </tr>
            </table>

            <!-- نص الإفادة والتوثيق الرسمي -->
            <div class="official-notice-box">
                يُفيد قسم التسجيل والقبول بكلية طرابلس للعلوم والتقنية بأن الطالب المذكور أعلاه قد استوفى كافة متطلبات وإجراءات تجديد القيد الأكاديمي للفصل الدراسي (<strong>${escapeHtml(semesterFormatted)}</strong>)، وتم توثيق تجديد قيده رسمياً وترقيته للانتقال إلى (<strong>${escapeHtml(targetLvlName)}</strong>).
            </div>
        </div>

        <!-- اعتماد التوقيع والختم في أقصى اليسار -->
        <div class="bf-signatures-container">
            <div class="bf-sig-col">
                <div class="off-name">${escapeHtml(registrarName)}</div>
                <div class="off-pos">المسجل العام بالكلية</div>
                <div class="off-sig">التوقيع والختم: ....................................</div>
            </div>
        </div>
    </div>
</body>
</html>`;

    // إنشاء iframe خفي وطباعة التقرير الفردي للطالب
    let singlePrintIframe = document.getElementById('renewSinglePrintIframe');
    if (!singlePrintIframe) {
        singlePrintIframe = document.createElement('iframe');
        singlePrintIframe.id = 'renewSinglePrintIframe';
        singlePrintIframe.style.position = 'fixed';
        singlePrintIframe.style.top = '-9999px';
        singlePrintIframe.style.left = '-9999px';
        singlePrintIframe.style.width = '0px';
        singlePrintIframe.style.height = '0px';
        singlePrintIframe.style.border = 'none';
        document.body.appendChild(singlePrintIframe);
    }

    const sDoc = singlePrintIframe.contentWindow.document;
    sDoc.open();
    sDoc.write(singlePrintHtml);
    sDoc.close();

    setTimeout(() => {
        try {
            singlePrintIframe.contentWindow.focus();
            singlePrintIframe.contentWindow.print();
        } catch (e) {
            console.error('Print frame error:', e);
            const w = window.open('', '_blank');
            w.document.write(singlePrintHtml);
            w.document.close();
            w.focus();
            w.print();
        }
    }, 400);
}

// ============================================================
// باقي الدوال
// ============================================================

function goBack() {
    if (document.referrer) window.history.back();
    else window.location.href = '/';
}

function resetForm() {
    const majorSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('levelSelect');
    const seasonSelect = document.getElementById('seasonSelect');
    const yearInput = document.getElementById('yearInput');
    const section = document.getElementById('studentSelectionSection');
    const tbody = document.getElementById('studentsTableBody');
    const selectAll = document.getElementById('selectAll');

    if (majorSelect) majorSelect.value = '';
    if (levelSelect) levelSelect.value = '';
    if (seasonSelect) seasonSelect.value = '';
    if (yearInput) yearInput.value = '2026';
    if (section) section.style.display = 'none';
    if (selectAll) selectAll.checked = false;
    if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">لا توجد بيانات</td></tr>';
    if (typeof toastInfo === 'function') toastInfo('تم إعادة تعيين النموذج');
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
window.showToastMessage = (message, isError = false) => showNotification(isError ? 'error' : 'success', message);

// ============================================================
// صلاحية تجديد القيد (Job Permission)
// ============================================================

function applyRenewPermissionUI(isOpen, message) {
    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');
    const btnLoad = document.getElementById('btnLoadStudents');
    const btnRenew = document.getElementById('btnRenewRegistration');
    const targets = [btnLoad, btnRenew];

    if (banner) {
        if (!isOpen) {
            if (bannerText && message) bannerText.textContent = message;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    targets.forEach(btn => {
        if (!btn) return;
        if (!isOpen) {
            btn.disabled = true;
            btn.setAttribute('disabled', 'disabled');
            btn.style.setProperty('opacity', '0.5', 'important');
            btn.style.setProperty('cursor', 'not-allowed', 'important');
            btn.style.setProperty('pointer-events', 'none', 'important');
            btn.style.setProperty('filter', 'grayscale(80%)', 'important');
            if (message) btn.title = message;
        } else {
            btn.disabled = false;
            btn.removeAttribute('disabled');
            btn.style.setProperty('opacity', '1', 'important');
            btn.style.setProperty('cursor', 'pointer', 'important');
            btn.style.setProperty('pointer-events', 'auto', 'important');
            btn.style.setProperty('filter', 'none', 'important');
            btn.title = '';
        }
    });
}

function updateJobPermissionState() {
    const isOpen = (typeof window.IS_RENEW_JOB_OPEN !== 'undefined') ? Boolean(window.IS_RENEW_JOB_OPEN) : true;
    const message = window.RENEW_JOB_MESSAGE || '';
    applyRenewPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
        .then(r => r.json())
        .then(data => {
            if (data && data.success) {
                window.IS_RENEW_JOB_OPEN = Boolean(data.is_renew_job_open);
                window.RENEW_JOB_MESSAGE = data.renew_job_message || '';
                applyRenewPermissionUI(window.IS_RENEW_JOB_OPEN, window.RENEW_JOB_MESSAGE);
            }
        })
        .catch(err => console.warn('⚠️ Dynamic renew job permission check error:', err));
}
window.updateJobPermissionState = updateJobPermissionState;

// ============================================================
// تهيئة الصفحة
// ============================================================

function init() {
    console.log('🚀 Initializing renew registration page v1.0.28');
    loadFilters();
    ensurePrintContainerInBody();
    updateJobPermissionState();

    // ربط تغيير التخصص لتحميل المستويات ديناميكياً
    const majorSelect = document.getElementById('majorSelect');
    if (majorSelect) {
        majorSelect.addEventListener('change', function () {
            const deptId = this.value;
            if (deptId) {
                loadDepartmentLevels(deptId);
            } else {
                const levelSelect = document.getElementById('levelSelect');
                if (levelSelect) {
                    levelSelect.innerHTML = '<option value="">-- الكل --</option>';
                    if (levelSelect.rebuildCustomOptions) levelSelect.rebuildCustomOptions();
                }
            }
        });
    }
}

// ============================================================
// تصدير الدوال
// ============================================================

window.loadFilters = loadFilters;
window.loadStudents = loadStudents;
window.loadDepartmentLevels = loadDepartmentLevels;
window.toggleAll = toggleAll;
window.renewRegistration = renewRegistration;
window.saveData = saveData;
window.printPage = printPage;
window.printSingleStudentRenew = printSingleStudentRenew;
window.ensurePrintContainerInBody = ensurePrintContainerInBody;
window.deleteSelected = deleteSelected;
window.deleteRow = deleteRow;
window.resetForm = resetForm;
window.goBack = goBack;
window.showNotification = showNotification;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('✅ All renew_registration functions registered');