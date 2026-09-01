// ============================================
// تنزيل المواد - Download Materials v1.0.26
// ============================================

console.log('✅ download_materials.js v1.0.26 loaded successfully');

window.registeredStudentsList = [];

// دالة الهروب الآمن للحروف الخاصة بالـ HTML
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return text
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

// الحصول على CSRF token
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

// عرض رسالة باستخدام Toast
function showToastMessage(message, isError = false, type = 'info') {
    if (typeof toastSuccess === 'function') {
        if (isError) {
            if (typeof toastError === 'function') toastError(message);
            else if (typeof toastInfo === 'function') toastInfo(message);
        } else {
            if (typeof toastSuccess === 'function') toastSuccess(message);
            else if (typeof toastInfo === 'function') toastInfo(message);
        }
    } else {
        console.log(message);
    }
}

// عرض رسالة تحميل
function showLoading(show) {
    const section = document.getElementById('studentSelectionSection');
    const tableWrapper = document.getElementById('studentTableWrapper');
    if (show) {
        if (section) section.style.display = 'block';
        if (tableWrapper) tableWrapper.style.display = 'block';
        const tbody = document.getElementById('studentsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">⏳ جاري تحميل البيانات...</td></tr>';
        }
    }
}

// تحميل البيانات للقوائم المنسدلة
function loadSelectsData() {
    console.log('📋 Loading selects data...');
    
    fetch('/renewal/api/departments/')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log('✅ Departments loaded:', data);
            const majorSelect = document.getElementById('majorSelect');
            if (majorSelect && data.departments) {
                majorSelect.innerHTML = '<option value="">اختر التخصص</option>' + 
                    data.departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
            }
        })
        .catch(error => console.error('❌ Error loading departments:', error));
}

// جلب الطلاب حسب التخصص والفصل
function loadStudentsData(silent = false) {
    console.log('👨‍🎓 loadStudentsData called, silent:', silent);

    const isDownloadOpen = (typeof window.IS_DOWNLOAD_JOB_OPEN !== 'undefined') ? Boolean(window.IS_DOWNLOAD_JOB_OPEN) : false;
    if (!isDownloadOpen) {
        showToastMessage(window.DOWNLOAD_JOB_MESSAGE || '⚠️ عذراً، خدمة تنزيل المواد موقوفة حالياً حسب جدول إدارة الوظائف.', true);
        return;
    }

    const previewSec = document.getElementById('previewMaterialsSection');
    if (previewSec) previewSec.style.display = 'none';
    
    const departmentId = document.getElementById('majorSelect')?.value;
    const levelId = document.getElementById('levelSelect')?.value;
    const seasonType = document.getElementById('seasonSelectValue')?.value || document.getElementById('seasonSelect')?.value;
    const year = document.getElementById('yearInput')?.value;
    
    if (!departmentId) {
        showWarning('الرجاء اختيار التخصص');
        const section = document.getElementById('studentSelectionSection');
        const tableWrapper = document.getElementById('studentTableWrapper');
        const tbody = document.getElementById('studentsTableBody');
        if (section) section.style.display = 'block';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (tbody) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">لا توجد نتائج (الرجاء اختيار التخصص)</td></tr>';
        }
        return;
    }
    
    if (!seasonType || !year) {
        showWarning('الرجاء اختيار نوع الفصل الدراسي وكتابة السنة يدوياً');
        const section = document.getElementById('studentSelectionSection');
        const tableWrapper = document.getElementById('studentTableWrapper');
        const tbody = document.getElementById('studentsTableBody');
        if (section) section.style.display = 'block';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (tbody) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">لا توجد نتائج (الرجاء اختيار نوع الفصل والسنة)</td></tr>';
        }
        return;
    }
    
    showLoading(true);
    
    let url = `/renewal/api/get-students-for-materials/?department_id=${encodeURIComponent(departmentId)}&season_type=${encodeURIComponent(seasonType)}&year=${encodeURIComponent(year)}`;
    if (levelId) {
        url += `&level_id=${encodeURIComponent(levelId)}`;
    }
    
    console.log('📡 Fetching:', url);
    
    fetch(url, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log('📊 Students data received:', data);
        
        const tbody = document.getElementById('studentsTableBody');
        const section = document.getElementById('studentSelectionSection');
        const tableWrapper = document.getElementById('studentTableWrapper');
        
        if (section) section.style.display = 'block';
        if (tableWrapper) tableWrapper.style.display = 'block';
        
        if (data.success) {
            window.currentSemesterId = data.semester_id;
            window.currentSemesterName = data.semester_name;
            
            if (data.students && data.students.length > 0) {
                if (tbody) {
                    window.downloadedStudents = window.downloadedStudents || {};

                    // فصل الطلاب إلى مجموعتين: غير مسجلين (متاح) ومسجلين مسبقاً
                    const availableStudents = data.students.filter(s => !s.has_registration);
                    const registeredStudents = data.students.filter(s => s.has_registration);

                    // تخزين قائمة المسجلين مسبقاً للطباعة
                    window.registeredStudentsList = registeredStudents;

                    // تحديث downloadedStudents للمسجلين
                    registeredStudents.forEach(s => { window.downloadedStudents[s.id] = true; });

                    // --- الجدول الرئيسي: الطلاب غير المسجلين فقط ---
                    if (availableStudents.length > 0) {
                        tbody.innerHTML = availableStudents.map((student) => {
                            const levelLabel = student.level_number ? `مستوى ${student.level_number}` : '-';
                            return `
                                <tr class="student-row border-b hover:bg-gray-50" data-student-id="${student.id}">
                                    <td class="px-4 py-2 text-center">
                                        <input type="checkbox" class="student-checkbox" data-id="${student.id}" data-name="${escapeHtml(student.name)}" data-code="${student.student_id}" onchange="window.updateSelectedCount()">
                                    </td>
                                    <td class="px-4 py-2 text-center font-bold" style="font-size: 0.8rem;">${escapeHtml(student.student_id)}</td>
                                    <td class="px-4 py-2 text-right" style="font-size: 0.8rem;">${escapeHtml(student.name)}</td>
                                    <td class="px-4 py-2 text-center" style="font-size: 0.78rem; font-weight: 600; color: #0f766e;">${escapeHtml(levelLabel)}</td>
                                    <td class="px-4 py-2 text-center">
                                        <button class="btn-download-action btn-download"
                                            data-student-id="${student.id}"
                                            data-student-name="${escapeHtml(student.name)}"
                                            data-student-code="${escapeHtml(student.student_id)}"
                                            onclick="window.toggleSubRow(this)"
                                            style="padding: 3px 10px; border: none; border-radius: 4px; font-weight: 700; font-size: 0.7rem; cursor: pointer; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 3px; background-color: #307e92; color: white;">
                                            <span class="material-symbols-outlined" style="font-size: 14px;">download</span>
                                            📥 المواد المراد تنزيلها
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    } else {
                        tbody.innerHTML = `<tr class="empty-row"><td colspan="5" class="text-center py-4" style="color:#0f766e; font-weight:600; font-size:0.8rem;">✅ جميع طلاب هذا الفصل تم تنزيل موادهم بالفعل.</td></tr>`;
                    }

                    // --- جدول الطلاب المسجلين مسبقاً (بدون عمود المستوى) ---
                    const regTbody = document.getElementById('registeredStudentsTableBody');
                    const regBar = document.getElementById('registeredStudentsToggleBar');
                    const regBadge = document.getElementById('registeredStudentsBadge');
                    if (regTbody && registeredStudents.length > 0) {
                        regTbody.innerHTML = registeredStudents.map((student) => {
                            return `
                                <tr class="student-row" style="border-bottom:1px solid #99f6e4; background:white;" data-student-id="${student.id}">
                                    <td style="padding:5px 8px; text-align:center; font-weight:700; font-size:0.78rem;">${escapeHtml(student.student_id)}</td>
                                    <td style="padding:5px 8px; text-align:right; font-size:0.78rem;">${escapeHtml(student.name)}</td>
                                    <td style="padding:5px 8px; text-align:center;">
                                        <div style="display:inline-flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap;">
                                            <button
                                                data-student-id="${student.id}"
                                                data-student-name="${escapeHtml(student.name)}"
                                                data-student-code="${escapeHtml(student.student_id)}"
                                                onclick="window.downloadedStudents[${student.id}]=true; window.toggleSubRow(this)"
                                                style="padding:3px 10px; border:none; border-radius:4px; background:#059669; color:white; font-weight:700; font-size:0.7rem; cursor:pointer; display:inline-flex; align-items:center; gap:3px;">
                                                <span class="material-symbols-outlined" style="font-size:13px;">assignment_turned_in</span>
                                                عرض المواد المسجلة
                                            </button>
                                            <button
                                                data-student-id="${student.id}"
                                                data-student-name="${escapeHtml(student.name)}"
                                                data-student-code="${escapeHtml(student.student_id)}"
                                                onclick="window.printStudentMaterials(${student.id}, '${escapeHtml(student.name)}', '${escapeHtml(student.student_id)}')"
                                                style="padding:3px 10px; border:none; border-radius:4px; background:#b59b66; color:white; font-weight:700; font-size:0.7rem; cursor:pointer; display:inline-flex; align-items:center; gap:3px;"
                                                title="طباعة استمارة تنزيل المواد للطالب">
                                                <span class="material-symbols-outlined" style="font-size:13px;">print</span>
                                                طباعة المواد
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                        if (regBar) { regBar.style.display = 'block'; }
                        if (regBadge) { regBadge.textContent = registeredStudents.length; }
                    } else if (regBar) {
                        regBar.style.display = 'none';
                    }
                }
                
                if (!silent && typeof toastSuccess === 'function') {
                    const availCount = data.students.filter(s => !s.has_registration).length;
                    toastSuccess(`تم تحميل ${availCount} طالب متاح للتنزيل - الفصل: ${data.semester_name}`);
                }
                
                updateSelectedCount();
                if (typeof loadDepartmentCoursesData === 'function') {
                    loadDepartmentCoursesData(departmentId, document.getElementById('levelSelect')?.value || null);
                }
                
            } else {
                window.registeredStudentsList = [];
                if (tbody) {
                    tbody.innerHTML = '<tr class="empty-row"><td colspan="5" class="text-center py-4 text-gray-500">لا توجد نتائج (لم يتم تجديد قيد أي طالب في هذا الفصل)</td></tr>';
                }
                if (!silent && typeof toastWarning === 'function') {
                    toastWarning(`لا توجد تجديدات قيد في فصل: ${data.semester_name}`);
                }
                
                const sectionCourses = document.getElementById('departmentCoursesSection');
                if (sectionCourses) sectionCourses.style.display = 'none';
            }
        } else {
            window.registeredStudentsList = [];
            window.currentSemesterId = null;
            window.currentSemesterName = null;
            if (tbody) {
                tbody.innerHTML = `<tr class="empty-row"><td colspan="5" class="text-center py-4 text-red-500">${escapeHtml(data.error || 'حدث خطأ')}</td></tr>`;
            }
            if (typeof toastError === 'function') {
                toastError(data.error || 'حدث خطأ في جلب البيانات');
            }
            
            const sectionCourses = document.getElementById('departmentCoursesSection');
            if (sectionCourses) sectionCourses.style.display = 'none';
        }
    })
    .catch(error => {
        console.error('❌ Error loading students:', error);
        window.registeredStudentsList = [];
        if (typeof toastError === 'function') {
            toastError('حدث خطأ في جلب البيانات');
        }
        const section = document.getElementById('studentSelectionSection');
        const tableWrapper = document.getElementById('studentTableWrapper');
        const tbody = document.getElementById('studentsTableBody');
        if (section) section.style.display = 'block';
        if (tableWrapper) tableWrapper.style.display = 'block';
        if (tbody) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="4" class="text-center py-4 text-gray-500">لا توجد نتائج</td></tr>';
        }
    });
}

// تحديد الكل
function toggleAllStudents(checkbox) {
    console.log('☑️ toggleAllStudents called, checked:', checkbox.checked);
    const checkboxes = document.querySelectorAll('#studentsTableBody .student-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    updateSelectedCount();
}

// عرض رسائل التحذير
function showWarning(msg) {
    const warningDiv = document.getElementById('downloadWarningMessage');
    const warningText = document.getElementById('downloadWarningText');
    if (warningDiv && warningText) {
        warningText.textContent = msg;
        warningDiv.classList.remove('hidden');
        warningDiv.style.display = 'flex';
        setTimeout(() => {
            warningDiv.classList.add('hidden');
            warningDiv.style.display = 'none';
        }, 6000);
    }
}

// دالة عرض الإشعارات العائمة
function showNotification(type, message) {
    const toast = document.getElementById('toastNotification');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    if (!toast || !icon || !msg) {
        console.warn('⚠️ Toast Notification elements not found');
        return;
    }
    
    msg.innerText = message;
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    
    if (isDark) {
        toast.style.background = '#1e293b';
        toast.style.backgroundColor = '#1e293b';
        msg.style.color = '#f8fafc';
    } else {
        toast.style.background = '#ffffff';
        toast.style.backgroundColor = '#ffffff';
        msg.style.color = '#1e293b';
    }

    if (type === 'success') {
        toast.style.borderRightColor = '#10b981';
        icon.innerText = "check_circle";
        icon.style.color = '#10b981';
    } else if (type === 'warning') {
        toast.style.borderRightColor = '#f59e0b';
        icon.innerText = "warning";
        icon.style.color = '#f59e0b';
    } else if (type === 'info') {
        toast.style.borderRightColor = '#3b82f6';
        icon.innerText = "info";
        icon.style.color = '#3b82f6';
    } else {
        toast.style.borderRightColor = '#e11d48';
        icon.innerText = "error";
        icon.style.color = '#e11d48';
    }
    
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
    
    clearTimeout(window.notificationTimeout);
    window.notificationTimeout = setTimeout(() => {
        toast.style.transform = 'translateY(80px)';
        toast.style.opacity = '0';
    }, 4000);
}

// تحديث عدد الطلاب المحددين
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.student-checkbox:checked');
    const countSpan = document.getElementById('selectedCount');
    if (countSpan) {
        countSpan.textContent = `(${checkboxes.length} طالب محدد)`;
    }
    
    const selectAll = document.getElementById('selectAll');
    const allCheckboxes = document.querySelectorAll('.student-checkbox');
    if (selectAll && allCheckboxes.length > 0) {
        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
        selectAll.checked = allChecked;
    }
}

// ============================================
// دوال عرض الجدول الفرعي وتنزيل المواد
// ============================================

function toggleSubRow(button) {
    console.log('📋 toggleSubRow called');
    
    const studentId = button.getAttribute('data-student-id');
    const studentName = button.getAttribute('data-student-name');
    const studentCode = button.getAttribute('data-student-code');
    
    const row = button.closest('tr.student-row');
    if (!row) return;
    
    const existingSubRow = document.getElementById(`sub-row-${studentId}`);
    if (existingSubRow) {
        existingSubRow.remove();
        const isDownloaded = window.downloadedStudents && window.downloadedStudents[studentId];
        if (isDownloaded) {
            button.innerHTML = `
                <span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span>
                ✅ المواد التي تم تنزيلها
            `;
        } else {
            button.innerHTML = `
                <span class="material-symbols-outlined" style="font-size: 14px;">download</span>
                📥 المواد المراد تنزيلها
            `;
        }
        return;
    }
    
    const isDownloaded = window.downloadedStudents && window.downloadedStudents[studentId];
    const title = isDownloaded ? 'المواد التي تم تنزيلها' : 'المواد المراد تنزيلها';
    const icon = isDownloaded ? 'assignment_turned_in' : 'playlist_add';
    
    button.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 14px; animation: spin 1s linear infinite;">refresh</span>
        جاري التحميل...
    `;
    button.disabled = true;
    button.style.opacity = '0.7';
    button.style.cursor = 'wait';
    
    const semesterId = window.currentSemesterId;
    let url = '';
    if (isDownloaded) {
        url = `/renewal/api/student-courses/${studentId}/${semesterId}/`;
    } else {
        url = `/renewal/api/preview-materials/?student_ids=${studentId}`;
        if (document.getElementById('levelSelect')?.value) {
            url += `&level_id=${encodeURIComponent(document.getElementById('levelSelect').value)}`;
        }
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
            
            let courses = [];
            let levelNumber = '';
            
            if (isDownloaded) {
                if (data.success && data.courses) {
                    courses = data.courses;
                    levelNumber = data.level_number || '';
                }
            } else {
                if (data.success && data.preview_data && data.preview_data.length > 0) {
                    const studentData = data.preview_data[0];
                    
                    if (studentData.already_registered) {
                        button.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span> ✅ مسجّل مسبقاً`;
                        button.style.backgroundColor = '#10b981';
                        window.downloadedStudents = window.downloadedStudents || {};
                        window.downloadedStudents[studentId] = true;
                        if (typeof toastWarning === 'function') toastWarning(studentData.error || 'الطالب سجّل مواده بالفعل لهذا الفصل.');
                        const subRowAlready = document.createElement('tr');
                        subRowAlready.id = `sub-row-${studentId}`;
                        subRowAlready.className = 'sub-row';
                        subRowAlready.innerHTML = `<td colspan="4" style="padding: 10px 16px; background: #ecfdf5; border-bottom: 2px solid #10b981; color: #065f46; font-size: 12px; font-weight: 600; text-align: center;">
                            ✅ ${escapeHtml(studentData.error || 'تم تسجيل مواد هذا الطالب بالفعل لهذا الفصل. لا يمكن إعادة التنزيل.')}<br>
                            <button onclick="window.downloadedStudents['${studentId}']=true; window.toggleSubRow(this)" data-student-id="${studentId}" data-student-name="${escapeHtml(button.getAttribute('data-student-name'))}" data-student-code="${escapeHtml(button.getAttribute('data-student-code'))}" style="margin-top:6px; padding:3px 12px; background:#059669; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer; font-weight:700;">عرض المواد المسجلة</button>
                        </td>`;
                        row.insertAdjacentElement('afterend', subRowAlready);
                        return;
                    }
                    
                    courses = studentData.courses || [];
                    levelNumber = studentData.level_number || '';
                }
            }
            
            const subRow = document.createElement('tr');
            subRow.id = `sub-row-${studentId}`;
            subRow.className = 'sub-row';
            subRow.style.backgroundColor = '#f8fafc';
            
            let coursesHtml = '';
            if (courses && courses.length > 0) {
                coursesHtml = courses.map((c) => {
                    const isRetake = c.is_retake || c.is_repeated || c.is_backlog || false;
                    const isPrereqFallback = c.is_prereq_fallback || false;
                    const levelNum = c.level_number || c.level_id || c.level || 1;
                    const realLevelName = c.level_name || (levelNum ? `المستوى ${levelNum}` : 'المستوى 1');
                    
                    let badgeHtml = '';
                    if (isRetake) {
                        badgeHtml += `<span style="background:#fef3c7; color:#d97706; border:1px solid #fde68a; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-right:6px;">[مادة معادة]</span>`;
                    }
                    if (isPrereqFallback) {
                        badgeHtml += `<span style="background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-right:6px;">(متطلب سابق غير مجتاز)</span>`;
                    }
                    
                    const prereqVal = c.prerequisite || c.prerequisite_name || '-';
                    let statusHtml = (prereqVal && prereqVal !== '-')
                        ? `<span style="color: #b45309; font-weight: 700; font-size: 11px;">${escapeHtml(prereqVal)}</span>`
                        : `<span style="color: #94a3b8; font-size: 11px;">-</span>`;
                    
                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                            <td style="padding: 4px 8px; text-align: center; font-weight: 700; font-family: monospace; font-size: 11px; color: #0f766e;">${escapeHtml(c.code || c.course_code || '-')}</td>
                            <td style="padding: 4px 8px; text-align: right; font-size: 11px;">
                                <span style="font-weight: 600; color: #1e293b;">${escapeHtml(c.raw_name || c.name || c.course_name || '-')}</span>
                                ${badgeHtml}
                            </td>
                            <td style="padding: 4px 8px; text-align: center; font-size: 11px; font-weight: 700;">${escapeHtml(String(c.credits || '-'))}</td>
                            <td style="padding: 4px 8px; text-align: center; font-size: 11px;">${statusHtml}</td>
                            <td style="padding: 4px 8px; text-align: center; font-size: 10px; color: #475569; font-weight: 600;">${escapeHtml(realLevelName)}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                coursesHtml = `
                    <tr>
                        <td colspan="5" style="padding: 15px; text-align: center; color: #64748b; font-size: 11px; font-weight: bold;">
                            ⚠️ لا توجد مواد دراسية متوفرة للتنزيل أو منزلة مسبقاً لهذا الطالب حالياً.
                        </td>
                    </tr>
                `;
            }
            
            subRow.innerHTML = `
                <td colspan="4" style="padding: 0; border: none;">
                    <div style="
                        background: linear-gradient(135deg, #f0fdfa, #f8fafc);
                        border: 1px solid #99f6e4;
                        border-radius: 8px;
                        margin: 3px 10px 4px;
                        overflow: hidden;
                        box-shadow: 0 2px 8px rgba(15,118,110,0.08);
                        direction: rtl;
                    ">
                        <div style="
                            background: linear-gradient(90deg, ${isDownloaded ? '#0f766e' : '#0d9488'}, ${isDownloaded ? '#0d6b63' : '#0f766e'});
                            color: white;
                            padding: 4px 12px;
                            font-size: 11px;
                            font-weight: 800;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        ">
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span class="material-symbols-outlined" style="font-size: 14px;">${icon}</span>
                                ${title} للطالب: ${escapeHtml(studentName)} | رقم القيد: ${escapeHtml(studentCode)}
                                ${levelNumber ? `| المستوى: ${levelNumber}` : ''}
                            </div>
                            <span style="font-size: 10px; opacity: 0.8;">${courses ? courses.length : 0} مادة</span>
                        </div>
                        <div style="padding: 4px 8px; overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px; direction: rtl;">
                                <thead>
                                    <tr style="background-color: #ccfbf1; color: #0f766e; font-size: 10px; font-weight: 800;">
                                        <th style="padding: 3px 6px; text-align: center; width: 18%; border-bottom: 2px solid #99f6e4;">رمز المادة</th>
                                        <th style="padding: 3px 10px; text-align: right; width: 42%; border-bottom: 2px solid #99f6e4;">اسم المادة</th>
                                        <th style="padding: 3px 6px; text-align: center; width: 10%; border-bottom: 2px solid #99f6e4;">الوحدات</th>
                                        <th style="padding: 3px 6px; text-align: center; width: 15%; border-bottom: 2px solid #99f6e4;">المادة المسبقة</th>
                                        <th style="padding: 3px 6px; text-align: center; width: 15%; border-bottom: 2px solid #99f6e4;">الفصل الدراسي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${coursesHtml}
                                </tbody>
                            </table>
                        </div>
                        <div style="display: flex; justify-content: flex-end; padding: 4px 10px; gap: 6px;">
                            <button onclick="window.toggleSubRow(document.querySelector('button[data-student-id=&quot;${studentId}&quot;]'))" style="
                                background: #64748b; color: white; border: none; border-radius: 4px;
                                padding: 3px 12px; font-size: 10.5px; font-weight: 700; cursor: pointer;
                                display: inline-flex; align-items: center; gap: 3px;
                            ">
                                <span class="material-symbols-outlined" style="font-size: 13px;">close</span> إغلاق
                            </button>
                        </div>
                    </div>
                </td>
            `;
            
            row.insertAdjacentElement('afterend', subRow);
            
            if (isDownloaded) {
                button.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span>
                    ✅ المواد التي تم تنزيلها
                `;
            } else {
                button.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 14px;">download</span>
                    📥 المواد المراد تنزيلها
                `;
            }
        })
        .catch(error => {
            console.error('❌ Error fetching data:', error);
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
            button.innerHTML = isDownloaded ? `
                <span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span>
                ✅ المواد التي تم تنزيلها
            ` : `
                <span class="material-symbols-outlined" style="font-size: 14px;">download</span>
                📥 المواد المراد تنزيلها
            `;
            showNotification('error', 'حدث خطأ في تحميل البيانات');
        });
}

// تنزيل المواد للطلاب المحددين (دفعة واحدة)
function downloadMaterials() {
    console.log('💾 downloadMaterials called');

    const isDownloadOpen = (typeof window.IS_DOWNLOAD_JOB_OPEN !== 'undefined') ? Boolean(window.IS_DOWNLOAD_JOB_OPEN) : false;
    if (!isDownloadOpen) {
        showToastMessage(window.DOWNLOAD_JOB_MESSAGE || '⚠️ عذراً، خدمة تنزيل المواد موقوفة حالياً حسب جدول إدارة الوظائف.', true);
        return;
    }

    const selectedStudents = document.querySelectorAll('.student-checkbox:checked');
    const semesterId = window.currentSemesterId;
    const levelId = document.getElementById('levelSelect')?.value;
    const seasonType = document.getElementById('seasonSelectValue')?.value || document.getElementById('seasonSelect')?.value;
    const year = document.getElementById('yearInput')?.value;
    
    if (selectedStudents.length === 0) {
        showWarning('الرجاء تحديد الطلاب أولاً');
        return;
    }
    
    if (!semesterId && (!seasonType || !year)) {
        showWarning('الرجاء تحميل قائمة الطلاب أولاً لتحديد الفصل الدراسي');
        return;
    }
    
    const studentIds = [];
    const studentNames = [];
    selectedStudents.forEach(cb => {
        const id = cb.getAttribute('data-id');
        if (id && !studentIds.includes(id)) {
            studentIds.push(id);
            studentNames.push(cb.getAttribute('data-name'));
        }
    });
    
    if (typeof toastInfo === 'function') toastInfo(`⏳ جاري تنزيل المواد لـ ${studentIds.length} طالب...`);
    
    fetch('/renewal/api/download-materials/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            student_ids: studentIds,
            semester_id: semesterId,
            season_type: seasonType,
            year: year,
            level_id: levelId
        })
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.success) {
            window.downloadedStudents = window.downloadedStudents || {};
            studentIds.forEach(id => {
                window.downloadedStudents[id] = true;
            });
            
            const successMsg = data.message || `✅ تم تنزيل المواد لـ ${studentIds.length} طالب بنجاح (تم إضافة ${data.downloaded_count || 0} مادة)`;
            showNotification('success', successMsg);
            if (typeof toastSuccess === 'function') {
                toastSuccess(successMsg);
            }
            updateSelectedCount();
            loadStudentsData(false);
        } else {
            showNotification('error', data.error || '❌ فشل تنزيل المواد');
        }
    })
    .catch(error => {
        console.error('❌ Error saving:', error);
        showNotification('error', '❌ حدث خطأ في الاتصال');
    });
}

// عرض مواد الفصل (الخطة الدراسية)
function viewSemesterPlan() {
    console.log('📖 viewSemesterPlan called');
    
    const departmentId = document.getElementById('majorSelect')?.value;
    const levelSelect = document.getElementById('levelSelect');
    const levelId = levelSelect?.value;
    const levelName = levelId && levelSelect
        ? (levelSelect.options[levelSelect.selectedIndex]?.text || `مستوى ${levelId}`)
        : '';
    const deptSelect = document.getElementById('majorSelect');
    const deptName = deptSelect ? (deptSelect.options[deptSelect.selectedIndex]?.text || '') : '';
    
    if (!departmentId) {
        showWarning('الرجاء اختيار التخصص أولاً لعرض مواد الفصل');
        return;
    }
    if (!levelId) {
        showWarning('الرجاء اختيار المستوى الدراسي أولاً لعرض مواد الفصل');
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
    fetch(`/renewal/api/department-courses/${encodeURIComponent(departmentId)}/?level_id=${encodeURIComponent(levelId)}&_=${timestamp}`, {
        headers: { 'Cache-Control': 'no-cache' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.courses) {
                const selectedLevel = Number(document.getElementById('levelSelect').value);
                window.currentLevelCourses = data.courses.filter(course => {
                    const cLevel = Number(course.level_id || course.level_number || course.level);
                    return cLevel === selectedLevel;
                });

                if (tbody) tbody.innerHTML = '';
                if (countEl) countEl.textContent = window.currentLevelCourses.length;

                if (window.currentLevelCourses.length > 0) {
                    const rowsHtml = window.currentLevelCourses.map((c, idx) => {
                        const prereqVal = c.prerequisite_name || c.prerequisite || c.prerequisite_code || '';
                        const hasPrereq = prereqVal && prereqVal !== '-';
                        const prereqHtml = hasPrereq
                            ? `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:0.7rem;font-weight:700;">${escapeHtml(prereqVal)}</span>`
                            : `<span style="color:#94a3b8;font-size:0.72rem;">—</span>`;
                        const rowBg = idx % 2 === 0 ? 'white' : '#f8fafc';
                        return `
                            <tr style="border-bottom:1px solid #e2e8f0;background:${rowBg};">
                                <td style="padding:7px 10px;text-align:center;font-weight:700;font-family:monospace;color:#0f766e;font-size:0.78rem;">${escapeHtml(c.code)}</td>
                                <td style="padding:7px 10px;text-align:right;font-size:0.78rem;">${escapeHtml(c.name)}</td>
                                <td style="padding:7px 10px;text-align:center;font-weight:700;color:#1e293b;font-size:0.78rem;">${escapeHtml(String(c.credits))}</td>
                                <td style="padding:7px 10px;text-align:center;">${prereqHtml}</td>
                            </tr>`;
                    }).join('');
                    if (tbody) tbody.innerHTML = rowsHtml;
                } else {
                    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:#94a3b8;font-size:0.8rem;">لا توجد مواد مقررة لـ (${escapeHtml(levelName)}) في هذا التخصص</td></tr>`;
                }
            } else {
                window.currentLevelCourses = [];
                if (countEl) countEl.textContent = '0';
                if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:#94a3b8;font-size:0.8rem;">${escapeHtml(data.error || `لا توجد مواد مقررة لـ (${levelName})`)}</td></tr>`;
            }
        })
        .catch(error => {
            window.currentLevelCourses = [];
            console.error('❌ Error fetching semester plan:', error);
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:#e11d48;font-size:0.8rem;">❌ حدث خطأ في تحميل الخطة المقررة</td></tr>';
        });
}

// إغلاق نافذة مواد الفصل
function closeSemesterView() {
    const modal = document.getElementById('semesterCoursesSection');
    if (modal) modal.style.display = 'none';
}

// طباعة مواد الفصل
function printSemesterPlan() {
    const title = document.getElementById('semesterCoursesTitle')?.textContent || 'مواد الفصل';
    const wrapper = document.getElementById('semesterCoursesTableWrapper');
    if (!wrapper) return;
    const printWin = window.open('', '_blank', 'width=800,height=600');
    printWin.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title>
        <style>body{font-family:Arial,sans-serif;direction:rtl;padding:20px;}table{width:100%;border-collapse:collapse;font-size:13px;}th,td{border:1px solid #ccc;padding:7px 10px;}th{background:#f1f5f9;font-weight:700;}h2{color:#0f766e;margin-bottom:12px;}</style></head>
        <body><h2>${title}</h2>${wrapper.innerHTML}</body></html>`);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 400);
}

// رجوع
function goBack() {
    console.log('🔙 goBack called');
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

// ============================================
// 🖨️ طباعة تقرير بالطلاب الذين تم تنزيل موادهم فقط (بدون عمود المستوى والتخصص)
// ============================================

function ensurePrintContainerInBody() {
    const container = document.getElementById('printReportContainer');
    if (container && container.parentNode !== document.body) {
        document.body.appendChild(container);
    }
    return container;
}

function printPage() {
    console.log('🖨️ printPage called for registered students report');

    ensurePrintContainerInBody();

    const container = document.getElementById('printReportContainer');
    if (!container) return;

    const majorSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('levelSelect');

    const departmentName = (majorSelect && majorSelect.selectedIndex > 0)
        ? majorSelect.options[majorSelect.selectedIndex]?.text
        : 'جميع التخصصات';

    const levelName = (levelSelect && levelSelect.selectedIndex > 0)
        ? levelSelect.options[levelSelect.selectedIndex]?.text
        : 'الكل';

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // الطلاب الذين تم تنزيل موادهم فقط (registeredStudentsList)
    const registeredList = window.registeredStudentsList || [];
    const count = registeredList.length;

    let tableRowsHtml = '';
    if (count > 0) {
        tableRowsHtml = registeredList.map((student, index) => {
            return `
                <tr>
                    <td style="padding:7px 5px;border:1px solid #000;text-align:center;font-weight:600;">${index + 1}</td>
                    <td style="padding:7px 5px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(student.student_id)}</td>
                    <td style="padding:7px 10px;border:1px solid #000;text-align:right;font-weight:600;">${escapeHtml(student.name)}</td>
                </tr>
            `;
        }).join('');
    } else {
        tableRowsHtml = `<tr><td colspan="3" class="empty-print-cell" style="padding:18px;text-align:center;color:#000;font-size:13.5px;font-weight:bold;border:1px solid #000;">لا يوجد طلاب تم تنزيل موادهم لهذا الفصل حالياً</td></tr>`;
    }

    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/شعار%20الكلية.jpeg';

    container.innerHTML = `
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
                        <img src="${logoUrl}" alt="شعار الكلية" class="print-college-logo" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.style.display='none'">
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

                <div class="print-header-line" style="width:100%;margin:6px 0 10px;border-top:1.5px solid #000;"></div>
                <div class="print-main-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">تقرير الطلاب المسجلين (تنزيل المواد)</div>

                <!-- 2. معلومات التقرير الشبكية -->
                <div class="print-info-grid" style="display:flex;justify-content:space-between;align-items:flex-start;margin:10px 0 10px;font-size:13px;direction:rtl;">
                    <div class="print-info-right" style="text-align:right;line-height:1.9;">
                        <div><span class="info-lbl" style="font-weight:bold;">التخصص:</span> <span class="info-val" style="font-weight:bold;">${escapeHtml(departmentName)}</span></div>
                        <div><span class="info-lbl" style="font-weight:bold;">المستوى الدراسي:</span> <span class="info-val" style="font-weight:bold;">${escapeHtml(levelName)}</span></div>
                    </div>
                    <div class="print-info-left" style="text-align:left;line-height:1.9;direction:rtl;">
                        <div><span class="info-lbl" style="font-weight:bold;">التاريخ:</span> <span class="info-val" style="font-weight:bold;">${dateStr}</span></div>
                        <div><span class="info-lbl" style="font-weight:bold;">عدد الطلاب المسجلين:</span> <span class="info-val" style="font-weight:bold;">${count}</span></div>
                    </div>
                </div>

                <!-- 3. جدول التقرير الرسمي (بدون عمودي التخصص والمستوى) -->
                <div class="print-table-container" style="margin-bottom:20px;">
                    <table class="print-table" style="width:100%;border-collapse:collapse;font-size:13px;direction:rtl;">
                        <thead>
                            <tr>
                                <th style="width:10%;border:1.5px solid #000;padding:8px 6px;font-weight:bold;text-align:center;background:#fff;color:#000;">م</th>
                                <th style="width:30%;border:1.5px solid #000;padding:8px 6px;font-weight:bold;text-align:center;background:#fff;color:#000;">رقم القيد</th>
                                <th style="width:60%;border:1.5px solid #000;padding:8px 6px;font-weight:bold;text-align:center;background:#fff;color:#000;">اسم الطالب</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 4. صندوق التوقيع الرسمي - منسق الدراسة والامتحانات -->
            <div class="print-signature-box" style="margin-top:35px;text-align:left;margin-left:20px;" data-official="exams_coordinator">
                <div class="off-name" style="font-size:13.5px;font-weight:bold;min-height:1.3em;margin-bottom:2px;"></div>
                <div class="off-pos" style="font-size:12.5px;font-weight:600;margin-bottom:6px;">منسق الدراسة والامتحانات</div>
                <div class="signature-line" style="font-size:12.5px;letter-spacing:1px;margin-top:12px;">التوقيع والختم: ....................................</div>
            </div>
        </div>
    `;

    const doPrint = () => window.print();

    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') {
                res.then(doPrint).catch(doPrint);
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
}

// ============================================
// 🖨️ طباعة استمارة تنزيل المواد لطالب منفرد
// ============================================
function printStudentMaterials(studentId, studentName, studentCode) {
    console.log(`🖨️ printStudentMaterials called for student ID: ${studentId}, Name: ${studentName}`);

    ensurePrintContainerInBody();
    const container = document.getElementById('printReportContainer');
    if (!container) return;

    const semesterId = window.currentSemesterId;
    const majorSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('levelSelect');

    const defaultDept = (majorSelect && majorSelect.selectedIndex > 0)
        ? majorSelect.options[majorSelect.selectedIndex]?.text
        : '—';
    const defaultLevel = (levelSelect && levelSelect.selectedIndex > 0)
        ? levelSelect.options[levelSelect.selectedIndex]?.text
        : '—';

    if (typeof showNotification === 'function') {
        showNotification('info', `⏳ جاري تجهيز استمارة الطالب: ${studentName}...`);
    }

    let url = `/renewal/api/student-courses/${studentId}/${semesterId || 0}/`;
    if (!semesterId) {
        url = `/renewal/api/preview-materials/?student_ids=${studentId}`;
        if (levelSelect?.value) {
            url += `&level_id=${encodeURIComponent(levelSelect.value)}`;
        }
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            let courses = [];
            let deptName = defaultDept;
            let lvlName = defaultLevel;
            let semName = window.currentSemesterName || '';
            let stName = studentName;
            let stCode = studentCode;

            if (data.success) {
                if (data.courses) {
                    courses = data.courses;
                    deptName = data.department_name || deptName;
                    lvlName = data.level_name || lvlName;
                    semName = data.semester_name || semName;
                    stName = data.student_name || stName;
                    stCode = data.student_id || stCode;
                } else if (data.preview_data && data.preview_data.length > 0) {
                    const sData = data.preview_data[0];
                    courses = sData.courses || [];
                    lvlName = sData.level_number ? `المستوى ${sData.level_number}` : lvlName;
                }
            }

            const now = new Date();
            const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
            const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/شعار%20الكلية.jpeg';

            let totalCredits = 0;
            let tableRowsHtml = '';

            if (courses && courses.length > 0) {
                tableRowsHtml = courses.map((c, idx) => {
                    const cCode = c.code || c.course_code || '-';
                    const cName = c.raw_name || c.name || c.course_name || '-';
                    const credits = Number(c.credits) || 0;
                    totalCredits += credits;

                    const levelNum = c.level_number || c.level_id || c.level || '-';
                    const cLevel = (levelNum && levelNum !== '-') ? `المستوى ${levelNum}` : (c.semester_name || '-');
                    const prereqVal = c.prerequisite || c.prerequisite_name || '-';
                    const isRetake = c.is_repeated || c.is_retake || c.is_backlog || false;
                    const statusText = isRetake ? 'معادة (باقية)' : 'جديدة (عادية)';

                    return `
                        <tr>
                            <td style="padding:6px 4px;border:1px solid #000;text-align:center;font-weight:600;">${idx + 1}</td>
                            <td style="padding:6px 4px;border:1px solid #000;text-align:center;font-weight:bold;font-family:monospace;font-size:12px;">${escapeHtml(cCode)}</td>
                            <td style="padding:6px 8px;border:1px solid #000;text-align:right;font-weight:bold;">${escapeHtml(cName)}</td>
                            <td style="padding:6px 4px;border:1px solid #000;text-align:center;font-weight:bold;">${credits}</td>
                            <td style="padding:6px 4px;border:1px solid #000;text-align:center;font-size:12px;">${escapeHtml(cLevel)}</td>
                            <td style="padding:6px 4px;border:1px solid #000;text-align:center;font-size:11.5px;">${escapeHtml(prereqVal)}</td>
                            <td style="padding:6px 4px;border:1px solid #000;text-align:center;font-size:11.5px;font-weight:600;">${escapeHtml(statusText)}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                tableRowsHtml = `
                    <tr>
                        <td colspan="7" style="padding:20px;text-align:center;border:1px solid #000;font-weight:bold;color:#000;">
                            لا توجد مواد دراسية مسجلة لهذا الطالب حالياً
                        </td>
                    </tr>
                `;
            }

            container.innerHTML = `
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
                                <img src="${logoUrl}" alt="شعار الكلية" class="print-college-logo" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.style.display='none'">
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

                        <div class="print-header-line" style="width:100%;margin:6px 0 10px;border-top:1.5px solid #000;"></div>
                        <div class="print-main-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">استمارة تنزيل المواد الدراسية</div>

                        <!-- 2. شبكة بيانات الطالب الرسمية -->
                        <div class="print-info-grid" style="display:flex;justify-content:space-between;align-items:flex-start;margin:10px 0 12px;font-size:12.5px;direction:rtl;border:1px solid #000;padding:8px 12px;border-radius:4px;">
                            <div class="print-info-right" style="text-align:right;line-height:1.9;">
                                <div><span class="info-lbl" style="font-weight:bold;">اسم الطالب:</span> <span class="info-val" style="font-weight:bold;">${escapeHtml(stName)}</span></div>
                                <div><span class="info-lbl" style="font-weight:bold;">رقم القيد:</span> <span class="info-val" style="font-weight:bold;">${escapeHtml(stCode)}</span></div>
                                <div><span class="info-lbl" style="font-weight:bold;">القسم / التخصص:</span> <span class="info-val" style="font-weight:bold;">${escapeHtml(deptName || '—')}</span></div>
                            </div>
                            <div class="print-info-left" style="text-align:left;line-height:1.9;direction:rtl;">
                                <div><span class="info-lbl" style="font-weight:bold;">المستوى الدراسي:</span> <span class="info-val" style="font-weight:bold;">${escapeHtml(lvlName || '—')}</span></div>
                                <div><span class="info-lbl" style="font-weight:bold;">الفصل الدراسي:</span> <span class="info-val" style="font-weight:bold;">${escapeHtml(semName || '—')}</span></div>
                                <div><span class="info-lbl" style="font-weight:bold;">تاريخ الطباعة:</span> <span class="info-val" style="font-weight:bold;">${dateStr}</span></div>
                            </div>
                        </div>

                        <!-- 3. جدول المواد المنزلة -->
                        <div class="print-table-container" style="margin-bottom:12px;">
                            <table class="print-table" style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl;">
                                <thead>
                                    <tr style="background:#f1f5f9;">
                                        <th style="width:5%;border:1.5px solid #000;padding:6px 4px;font-weight:bold;text-align:center;">م</th>
                                        <th style="width:16%;border:1.5px solid #000;padding:6px 4px;font-weight:bold;text-align:center;">رمز المادة</th>
                                        <th style="width:34%;border:1.5px solid #000;padding:6px 8px;font-weight:bold;text-align:right;">اسم المادة الدراسية</th>
                                        <th style="width:9%;border:1.5px solid #000;padding:6px 4px;font-weight:bold;text-align:center;">الوحدات</th>
                                        <th style="width:13%;border:1.5px solid #000;padding:6px 4px;font-weight:bold;text-align:center;">المستوى</th>
                                        <th style="width:13%;border:1.5px solid #000;padding:6px 4px;font-weight:bold;text-align:center;">المتطلب السابق</th>
                                        <th style="width:10%;border:1.5px solid #000;padding:6px 4px;font-weight:bold;text-align:center;">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRowsHtml}
                                </tbody>
                                <tfoot>
                                    <tr style="background:#f8fafc;font-weight:bold;">
                                        <td colspan="3" style="border:1.5px solid #000;padding:6px 8px;text-align:right;">
                                            إجمالي المواد: <strong>${courses.length}</strong> مادة
                                        </td>
                                        <td style="border:1.5px solid #000;padding:6px 4px;text-align:center;font-weight:bold;">
                                            ${totalCredits}
                                        </td>
                                        <td colspan="3" style="border:1.5px solid #000;padding:6px 8px;text-align:left;">
                                            إجمالي الوحدات: <strong>${totalCredits}</strong> وحدة
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- 4. توقيعات الاعتماد الرسمية -->
                    <div style="margin-top:25px;display:flex;justify-content:space-between;align-items:flex-start;padding:0 10px;page-break-inside:avoid;">
                        <div style="text-align:center;width:30%;">
                            <div style="font-size:12px;font-weight:bold;margin-bottom:6px;">توقيع الطالب</div>
                            <div style="font-size:11.5px;margin-top:20px;">....................................</div>
                        </div>
                        <div style="text-align:center;width:35%;" data-official="study_exams_head">
                            <div class="off-name" style="font-size:12.5px;font-weight:bold;min-height:1.3em;"></div>
                            <div class="off-pos" style="font-size:11.5px;font-weight:bold;margin-bottom:6px;">رئيس قسم الدراسة والامتحانات</div>
                            <div style="font-size:11.5px;letter-spacing:1px;margin-top:10px;">التوقيع والختم: ......................</div>
                        </div>
                        <div class="print-signature-box" style="text-align:center;width:30%;margin:0;" data-official="general_registrar">
                            <div class="off-name" style="font-size:12.5px;font-weight:bold;min-height:1.3em;"></div>
                            <div class="off-pos" style="font-size:11.5px;font-weight:bold;margin-bottom:6px;">المسجل العام بالكلية</div>
                            <div class="signature-line" style="font-size:11.5px;letter-spacing:1px;margin-top:10px;">التوقيع والختم: ......................</div>
                        </div>
                    </div>
                </div>
            `;

            const doPrint = () => window.print();

            if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
                try {
                    const res = window.OfficialsHelper.autoFill();
                    if (res && typeof res.then === 'function') {
                        res.then(doPrint).catch(doPrint);
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
        })
        .catch(err => {
            console.error('❌ Error printing student materials:', err);
            if (typeof showNotification === 'function') {
                showNotification('error', 'حدث خطأ في جلب بيانات مواد الطالب للطباعة');
            }
        });
}

// دالة تحميل المستويات بناءً على التخصص المختار
function loadDepartmentLevels(deptId) {
    const levelSelect = document.getElementById('levelSelect');
    if (!levelSelect) return;

    fetch(`/renewal/api/get-department-levels/${deptId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.levels) {
                levelSelect.innerHTML = '<option value="">-- الكل --</option>' +
                    data.levels.map(lvl => `<option value="${lvl.id}">${escapeHtml(lvl.name)}</option>`).join('');
            } else {
                levelSelect.innerHTML = '<option value="">-- الكل --</option>';
            }
        })
        .catch(err => console.error('❌ Error loading department levels:', err));
}

function init() {
    console.log('🚀 Initializing download materials page');
    loadSelectsData();
    
    const majorSelect = document.getElementById('majorSelect');
    if (majorSelect) {
        majorSelect.addEventListener('change', function() {
            const departmentId = this.value;
            if (departmentId) {
                loadDepartmentLevels(departmentId);
            } else {
                const levelSelect = document.getElementById('levelSelect');
                if (levelSelect) levelSelect.innerHTML = '<option value="">-- الكل --</option>';
            }
        });
    }
}

// إظهار/إخفاء جدول الطلاب المسجلين مسبقاً
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
window.toggleRegisteredStudentsTable = toggleRegisteredStudentsTable;

// ===== ربط الدوال العالمية =====
window.loadSelectsData = loadSelectsData;
window.loadStudentsData = loadStudentsData;
window.toggleAllStudents = toggleAllStudents;
window.viewSemesterPlan = viewSemesterPlan;
window.closeSemesterView = closeSemesterView;
window.printSemesterPlan = printSemesterPlan;
window.downloadMaterials = downloadMaterials;
window.goBack = goBack;
window.showNotification = showNotification;
window.showWarning = showWarning;
window.updateSelectedCount = updateSelectedCount;
window.toggleSubRow = toggleSubRow;
window.printPage = printPage;
window.printStudentMaterials = printStudentMaterials;
window.loadDepartmentLevels = loadDepartmentLevels;

function loadDepartmentCoursesData(deptId, levelId) {
    if (!deptId) return;
    let url = `/renewal/api/department-courses/${encodeURIComponent(deptId)}/`;
    if (levelId) url += `?level_id=${encodeURIComponent(levelId)}`;
    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.courses) {
                window.currentLevelCourses = data.courses;
            }
        })
        .catch(err => console.warn('⚠️ loadDepartmentCoursesData warning:', err));
}
window.loadDepartmentCoursesData = loadDepartmentCoursesData;

// 🔥 التحكم في حالة الأزرار بناءً على صلاحية تنزيل المواد
function applyDownloadPermissionUI(isOpen, message) {
    const btnFetch = document.getElementById('btnFetchStudents');
    const btnShow = document.getElementById('btnShowSemesterCourses');
    const btnDownload = document.getElementById('btnDownloadMaterials');
    const targetButtons = [btnFetch, btnShow, btnDownload];

    const banner = document.getElementById('jobInactiveBanner');
    const bannerText = document.getElementById('jobInactiveBannerText');

    console.log(`🔐 Download Materials Job Permission State - Is Open: ${isOpen}`);

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
        }
    });
}

function updateJobPermissionState() {
    const isOpen = (typeof window.IS_DOWNLOAD_JOB_OPEN !== 'undefined') ? Boolean(window.IS_DOWNLOAD_JOB_OPEN) : false;
    const message = window.DOWNLOAD_JOB_MESSAGE || '';

    applyDownloadPermissionUI(isOpen, message);

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_DOWNLOAD_JOB_OPEN = Boolean(data.is_download_job_open);
            window.DOWNLOAD_JOB_MESSAGE = data.download_job_message || '';
            applyDownloadPermissionUI(window.IS_DOWNLOAD_JOB_OPEN, window.DOWNLOAD_JOB_MESSAGE);
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic download job permission check error:', err);
    });
}
window.updateJobPermissionState = updateJobPermissionState;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Download Materials Permissions...');
    init();
    updateJobPermissionState();
});

updateJobPermissionState();
console.log('✅ All download_materials.js functions registered');