/**
 * ============================================================
 * تسجيل درجات الطلاب - Grade Entry
 * grade_entry.js  v1.1.0
 * ============================================================
 */

console.log('✅ grade_entry.js loaded');

// ============================================================
// ===           دالة جلب CSRF Token                ===
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
const csrftoken = getCookie('csrftoken');

// ============================================================
// ============================================================
// ===           نظام الإشعارات الموحد (showNotification)   ===
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

function showToast(message, isError = false) {
    if (isError === true) {
        showNotification('error', message);
    } else if (isError === 'warning') {
        showNotification('warning', message);
    } else if (isError === 'info') {
        showNotification('info', message);
    } else {
        showNotification('success', message);
    }
}
window.showToast = showToast;

// ============================================================
// ===           المتغيرات العامة                   ===
// ============================================================
let loadedStudentsGlobal = [];

// ============================================================
// ===          تحميل الفلاتر عند الفتح            ===
// ============================================================
document.addEventListener("DOMContentLoaded", function() {
    console.log("✅ DOM loaded - fetching filters...");
    
    fetch('/grades/api/filters/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fillSelect('specialty-select', data.departments, 'اختر التخصص...');
                
                const semSelect = document.getElementById('semester-select');
                semSelect.innerHTML = '<option value="">اختر الفصل...</option>';
                data.semesters.forEach(s => {
                    semSelect.innerHTML += `<option value="${s.id}">${s.year} - ${s.type_display}</option>`;
                });
                
                fillSelect('course-select', data.courses, 'اختر المادة...', true);
                fillSelect('group-select', data.groups, 'اختر المجموعة...');
                
                // تحميل الأساتذة مع حفظ البريد الإلكتروني في خيار الاختيار
                const profSelect = document.getElementById('professor-select');
                if (profSelect) {
                    profSelect.innerHTML = '<option value="">اختر الأستاذ...</option>';
                    if (data.professors) {
                        data.professors.forEach(p => {
                            const opt = document.createElement('option');
                            opt.value = p.id;
                            opt.textContent = p.name;
                            opt.dataset.email = p.email;
                            profSelect.appendChild(opt);
                        });
                    }
                }
                
                // 🔥 إضافة المستويات
                const levelSelect = document.getElementById('level-select');
                if (levelSelect) {
                    levelSelect.innerHTML = '<option value="">كل المستويات...</option>';
                    if (data.levels) {
                        data.levels.forEach(level => {
                            levelSelect.innerHTML += `<option value="${level.id}">المستوى ${level.number}</option>`;
                        });
                    }
                }

                handleProfessorChange();
                console.log("✅ Filters loaded successfully");
            } else {
                showToast("خطأ في تحميل بيانات الفلاتر: " + (data.message || ''), true);
            }
        })
        .catch(err => {
            console.error("Error loading filters:", err);
            showToast("خطأ في الاتصال بالخادم وتحميل الفلاتر", true);
        });
});

function fillSelect(elementId, list, defaultText, isCourse = false) {
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = `<option value="">${defaultText}</option>`;
    if (list && list.length > 0) {
        list.forEach(item => {
            if (isCourse) {
                select.innerHTML += `<option value="${item.id}">${item.code} - ${item.name}</option>`;
            } else {
                select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
            }
        });
    }
}

// grades/static/grades/js/grade_entry.js - تعديل دوال جلب المجموعات

// ============================================================
// ===      معالجة تغير الفلاتر المترابطة (Cascading Filters)   ===
// ============================================================
function handleFilterChange() {
    const depId = document.getElementById('specialty-select')?.value || '';
    const lvlId = document.getElementById('level-select')?.value || '';
    const semId = document.getElementById('semester-select')?.value || '';
    const crsId = document.getElementById('course-select')?.value || '';
    
    console.log(`🔄 handleFilterChange: department_id=${depId}, level_id=${lvlId}, semester_id=${semId}, course_id=${crsId}`);
    
    // 1. جلب المواد المفلترة حسب التخصص والمستوى
    let coursesUrl = `/grades/api/get-courses-by-level/?`;
    if (depId && depId !== '') coursesUrl += `department_id=${encodeURIComponent(depId)}&`;
    if (lvlId && lvlId !== '') coursesUrl += `level_id=${encodeURIComponent(lvlId)}&`;
    
    fetch(coursesUrl)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.courses) {
                const currentCourse = document.getElementById('course-select')?.value;
                fillSelect('course-select', data.courses, 'اختر المادة...', true);
                const courseSelect = document.getElementById('course-select');
                if (courseSelect && currentCourse && Array.from(courseSelect.options).some(opt => opt.value === currentCourse)) {
                    courseSelect.value = currentCourse;
                }
                // 🔥 بعد تحديث المواد، نقوم بتحديث المجموعات تلقائياً
                reloadGroupsDropdown();
            }
        })
        .catch(err => console.error('❌ Error fetching filtered courses:', err));

    // 2. جلب المجموعات المفلترة حسب المعايير المحددة
    reloadGroupsDropdown();
}

// ============================================================
// ===        إعادة تحميل قائمة المجموعات           ===
// ============================================================
function reloadGroupsDropdown() {
    const semId = document.getElementById('semester-select')?.value || '';
    const crsId = document.getElementById('course-select')?.value || '';
    const lvlId = document.getElementById('level-select')?.value || '';
    const depId = document.getElementById('specialty-select')?.value || '';
    
    const groupSelect = document.getElementById('group-select');
    if (!groupSelect) return;
    
    // 1. التحقق من وجود المعايير الأساسية (الفصل والمادة)
    if (!semId || !crsId) {
        groupSelect.innerHTML = '<option value="">-- اختر الفصل والمادة أولاً --</option>';
        // إجبار Select2 على التحديث إن وجد
        if (window.jQuery && window.jQuery(groupSelect).data('select2')) {
            window.jQuery(groupSelect).trigger('change');
        }
        return;
    }
    
    // 2. بناء URL مع المعايير
    let url = '/grades/api/get-groups-by-filter/?';
    url += `semester_id=${encodeURIComponent(semId)}&`;
    url += `course_id=${encodeURIComponent(crsId)}&`;
    if (depId && depId !== '') url += `department_id=${encodeURIComponent(depId)}&`;
    if (lvlId && lvlId !== '') url += `level_id=${encodeURIComponent(lvlId)}&`;
    
    // 3. إظهار حالة التحميل
    groupSelect.innerHTML = '<option value="">⏳ جاري التحميل...</option>';
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.groups && data.groups.length > 0) {
                let html = '<option value="">-- اختر المجموعة --</option>';
                data.groups.forEach(group => {
                    html += `<option value="${group.id}">${escapeHtml(group.name)}</option>`;
                });
                groupSelect.innerHTML = html;
            } else {
                // 4. في حال عدم وجود مجموعات، نعرض رسالة مناسبة
                groupSelect.innerHTML = '<option value="">-- لا توجد مجموعات --</option>';
            }
            // 5. إجبار Select2 على التحديث فوراً بعد تغيير المحتوى
            if (window.jQuery && window.jQuery(groupSelect).data('select2')) {
                window.jQuery(groupSelect).trigger('change');
            }
        })
        .catch(err => {
            console.error('❌ Error loading groups:', err);
            groupSelect.innerHTML = '<option value="">-- حدث خطأ في التحميل --</option>';
            if (window.jQuery && window.jQuery(groupSelect).data('select2')) {
                window.jQuery(groupSelect).trigger('change');
            }
        });
}

// دالة مساعدة لعرض النص بشكل آمن
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// grades/static/grades/js/grade_entry.js - تعديل دالة reloadProfessorsDropdown

// ============================================================
// ===        إعادة تحميل قائمة الأساتذة             ===
// ============================================================
function reloadProfessorsDropdown() {
    const semId = document.getElementById('semester-select')?.value || '';
    const crsId = document.getElementById('course-select')?.value || '';
    const lvlId = document.getElementById('level-select')?.value || '';
    const depId = document.getElementById('specialty-select')?.value || '';
    const grpId = document.getElementById('group-select')?.value || '';
    
    const profSelect = document.getElementById('professor-select');
    if (!profSelect) return;
    
    // 1. التحقق من وجود المعايير الأساسية (الفصل والمادة)
    if (!semId || !crsId) {
        profSelect.innerHTML = '<option value="">-- اختر الفصل والمادة أولاً --</option>';
        // إفراغ حقل البريد الإلكتروني
        const emailDisplay = document.getElementById('professor-email-display');
        if (emailDisplay) emailDisplay.value = '';
        return;
    }
    
    // 2. بناء URL مع المعايير (مع التأكد من إرسال course_id)
    let url = '/grades/api/filters/';
    const params = [];
    if (semId) params.push(`semester_id=${semId}`);
    if (crsId) params.push(`course_id=${crsId}`);  // ✅ هذا هو المفتاح لجلب الأساتذة المكلفين
    if (lvlId) params.push(`level_id=${lvlId}`);
    if (depId) params.push(`department_id=${depId}`);
    if (grpId) params.push(`group_id=${grpId}`);
    
    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    
    // 3. إظهار حالة التحميل
    profSelect.innerHTML = '<option value="">⏳ جاري التحميل...</option>';
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const prevVal = profSelect.value;
                profSelect.innerHTML = '<option value="">اختر الأستاذ...</option>';
                
                // ✅ عرض الأساتذة المكلفين فقط
                if (data.professors && data.professors.length > 0) {
                    data.professors.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = p.name;
                        opt.dataset.email = p.email || '';
                        profSelect.appendChild(opt);
                    });
                    
                    // استعادة القيمة السابقة إذا كانت موجودة
                    if (prevVal && Array.from(profSelect.options).some(opt => opt.value === prevVal)) {
                        profSelect.value = prevVal;
                    }
                    
                    // إذا كان هناك أستاذ واحد فقط، نختاره تلقائياً
                    if (data.professors.length === 1) {
                        profSelect.selectedIndex = 1;
                    }
                    
                    console.log(`✅ تم تحميل ${data.professors.length} أستاذ مكلف للمادة ${crsId}`);
                } else {
                    profSelect.innerHTML = '<option value="">-- لا يوجد أساتذة مكلفين بهذه المادة --</option>';
                    console.log(`ℹ️ لا يوجد أساتذة مكلفين للمادة ${crsId}`);
                }
                
                // تحديث حقل البريد الإلكتروني
                handleProfessorChange();
            } else {
                profSelect.innerHTML = '<option value="">-- حدث خطأ في التحميل --</option>';
                console.error('❌ API returned error:', data.message);
            }
        })
        .catch(err => {
            console.error('❌ Error reloading professors:', err);
            profSelect.innerHTML = '<option value="">-- حدث خطأ في التحميل --</option>';
        });
}

// ============================================================
// ===      معالجة تغير الفلاتر المترابطة (Cascading Filters)   ===
// ============================================================
function handleFilterChange() {
    const depId = document.getElementById('specialty-select')?.value || '';
    const lvlId = document.getElementById('level-select')?.value || '';
    const semId = document.getElementById('semester-select')?.value || '';
    const crsId = document.getElementById('course-select')?.value || '';
    
    console.log(`🔄 handleFilterChange: department_id=${depId}, level_id=${lvlId}, semester_id=${semId}, course_id=${crsId}`);
    
    // 1. جلب المواد المفلترة حسب التخصص والمستوى
    let coursesUrl = `/grades/api/get-courses-by-level/?`;
    if (depId && depId !== '') coursesUrl += `department_id=${encodeURIComponent(depId)}&`;
    if (lvlId && lvlId !== '') coursesUrl += `level_id=${encodeURIComponent(lvlId)}&`;
    
    fetch(coursesUrl)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.courses) {
                const currentCourse = document.getElementById('course-select')?.value;
                fillSelect('course-select', data.courses, 'اختر المادة...', true);
                const courseSelect = document.getElementById('course-select');
                if (courseSelect && currentCourse && Array.from(courseSelect.options).some(opt => opt.value === currentCourse)) {
                    courseSelect.value = currentCourse;
                }
                // 🔥 بعد تحديث المواد، نقوم بتحديث الأساتذة والمجموعات تلقائياً
                reloadProfessorsDropdown();
                reloadGroupsDropdown();
            }
        })
        .catch(err => console.error('❌ Error fetching filtered courses:', err));

    // 2. تحديث المجموعات والأساتذة
    reloadGroupsDropdown();
    reloadProfessorsDropdown();
}

function handleProfessorChange() {
    const profSelect = document.getElementById('professor-select');
    const emailDisplay = document.getElementById('professor-email-display');
    if (profSelect && emailDisplay) {
        const selectedOpt = profSelect.options[profSelect.selectedIndex];
        emailDisplay.value = selectedOpt ? (selectedOpt.dataset.email || '') : '';
    }
}

// grades/static/grades/js/grade_entry.js - التحقق من دالة loadStudentsFromDatabase

// grades/static/grades/js/grade_entry.js - تعديل دالة loadStudentsFromDatabase

// ============================================================
// ===      زر موافق: تحميل الطلاب من الـ DB       ===
// ============================================================
function loadStudentsFromDatabase() {
    // 1. جلب جميع المعايير المحددة
    const semId = document.getElementById('semester-select')?.value || '';
    const crsId = document.getElementById('course-select')?.value || '';
    const depId = document.getElementById('specialty-select')?.value || '';
    const grpId = document.getElementById('group-select')?.value || '';
    const lvlId = document.getElementById('level-select')?.value || '';
    const profId = document.getElementById('professor-select')?.value || '';
    const period = document.getElementById('period-select')?.value || 'midterm';

    // 2. التحقق من وجود المعايير الأساسية (الفصل والمادة)
    if (!semId || !crsId) {
        showToast("⚠️ الرجاء اختيار الفصل الدراسي والمادة أولاً!", true);
        return;
    }

    // 3. بناء URL مع جميع المعايير
    let url = `/grades/api/students/?semester_id=${encodeURIComponent(semId)}&course_id=${encodeURIComponent(crsId)}&period=${encodeURIComponent(period)}`;
    
    // إضافة المعايير الإضافية إذا كانت محددة
    if (depId && depId !== '') {
        url += `&department_id=${encodeURIComponent(depId)}`;
    }
    if (lvlId && lvlId !== '') {
        url += `&level_id=${encodeURIComponent(lvlId)}`;
    }
    if (grpId && grpId !== '') {
        url += `&group_id=${encodeURIComponent(grpId)}`;
    }
    if (profId && profId !== '') {
        url += `&professor_id=${encodeURIComponent(profId)}`;
    }

    console.log("📤 Sending request to:", url);

    // 4. إظهار مؤشر التحميل داخل الجدول فقط بدون إشعارات منبثقة
    const tbody = document.getElementById('table-body');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:2rem;font-size:0.875rem;opacity:0.6;font-weight:600;color:#1e6475;">⏳ جاري التحميل...</td></tr>`;
    }
    document.getElementById('table-container')?.classList.remove('hidden');

    // 5. إرسال الطلب
    fetch(url)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('Full Response Data:', data);
            
            let studentsList = [];
            if (Array.isArray(data)) {
                studentsList = data;
            } else if (data && typeof data === 'object') {
                if (Array.isArray(data.students)) {
                    studentsList = data.students;
                } else if (Array.isArray(data.data)) {
                    studentsList = data.data;
                } else if (Array.isArray(data.students_list)) {
                    studentsList = data.students_list;
                } else if (Array.isArray(data.results)) {
                    studentsList = data.results;
                } else if (Array.isArray(data.rows)) {
                    studentsList = data.rows;
                } else {
                    for (let key in data) {
                        if (Array.isArray(data[key]) && data[key].length > 0) {
                            studentsList = data[key];
                            break;
                        }
                    }
                }
            }

            console.log("📋 Extracted studentsList:", studentsList.length, studentsList);
            loadedStudentsGlobal = studentsList;
            renderTable(period);

            if (studentsList.length === 0) {
                showToast((data && data.message) ? data.message : "ℹ️ لا يوجد طلاب مسجلين في هذه المادة بهذه المعايير", 'info');
            }
        })
        .catch(err => {
            console.error("❌ Error fetching students:", err);
            loadedStudentsGlobal = [];
            renderTable(period);
            showToast("❌ حدث خطأ أثناء الاتصال بالخادم", true);
        });
}

// ============================================================
// ===   عرض جدول الدرجات (نص فقط - يمنع الإدخال اليدوي)    ===
// ============================================================
function renderTable(period) {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    console.log("🎨 renderTable triggered for period:", period, "with count:", loadedStudentsGlobal.length);

    if (!loadedStudentsGlobal || loadedStudentsGlobal.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:2rem;font-size:0.875rem;opacity:0.6;font-weight:600;color:#1e6475;">لا يوجد طلاب مسجلين في هذه المادة لهذا الفصل...</td></tr>`;
        document.getElementById('table-container')?.classList.remove('hidden');
        updateButtonStates(period);
        return;
    }

    const courseSelect = document.getElementById('course-select');
    const courseName = courseSelect?.options[courseSelect.selectedIndex]?.text || 'المادة';

    loadedStudentsGlobal.forEach((student, index) => {
        let studentCode = student.student_id || student.enrollment_no || student.code || student.student_code || (student.id ? `STU${student.id}` : '-');
        let studentName = student.name || student.student_name || student.full_name || student.arabic_name || '-';

        let midScore = parseFloat(student.midterm_score) || 0;
        let finScore = parseFloat(student.final_score) || 0;
        let isMidLocked = student.is_midterm_locked || false;
        let isFinLocked = student.is_final_locked || false;
        let isFinalEntered = student.is_final_entered || finScore > 0;

        let isLocked = false;
        if (period === 'midterm' && isMidLocked) {
            isLocked = true;
        } else if (period === 'final' && isFinLocked) {
            isLocked = true;
        }

        // 1) خلية النصفي (قفل الإدخال اليدوي - للعرض فقط)
        let midDisplay = '';
        if (isMidLocked) {
            midDisplay = `
                <div class="lock-wrapper">
                    <input type="number" value="${midScore}" readonly disabled class="grade-input grade-locked" style="background-color:#f1f5f9; cursor:not-allowed; border:1px solid #cbd5e1; text-align:center; font-weight:bold;"/>
                    <span class="material-symbols-outlined lock-icon">lock</span>
                </div>`;
        } else if (period === 'midterm') {
            midDisplay = `
                <input type="number" value="${midScore > 0 ? midScore : '0'}" 
                       class="grade-input grade-readonly" 
                       data-student-id="${student.id}"
                       data-field="midterm"
                       readonly disabled
                       style="background-color:#f1f5f9; cursor:not-allowed; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#1e293b;"/>
            `;
        } else {
            midDisplay = `<span class="grade-text-val" style="font-weight:bold;">${midScore}</span>`;
        }

        // 2) خلية النهائي (قفل الإدخال اليدوي - للعرض فقط)
        let finDisplay = '';
        if (period === 'midterm') {
            finDisplay = `<span style="font-size:0.75rem;opacity:0.4;font-weight:500;">-- غير متاح --</span>`;
        } else if (isFinLocked) {
            finDisplay = `
                <div class="lock-wrapper">
                    <input type="number" value="${finScore}" readonly disabled class="grade-input grade-locked" style="background-color:#f1f5f9; cursor:not-allowed; border:1px solid #cbd5e1; text-align:center; font-weight:bold;"/>
                    <span class="material-symbols-outlined lock-icon">lock</span>
                </div>`;
        } else {
            finDisplay = `
                <input type="number" value="${finScore > 0 ? finScore : '0'}" 
                       class="grade-input grade-readonly" 
                       data-student-id="${student.id}"
                       data-field="final"
                       readonly disabled
                       style="background-color:#f1f5f9; cursor:not-allowed; border:1px solid #cbd5e1; text-align:center; font-weight:bold; color:#1e293b;"/>
            `;
        }

        // 3) المجموع والتقدير والحالة
        let totalDisplay = '';
        let gradeDisplay = '';
        let statusBadge = '';

        let totalVal = parseFloat(student.total_score) || (midScore + finScore);
        let isPassed = student.is_passed || totalVal >= 50;
        let gradeText = getGradeText(totalVal);
        let gradeClass = getGradeClass(totalVal);

        let hasFinalScoreEntered = isFinLocked || (finScore > 0) || (student.is_final_entered && finScore > 0);

        if (hasFinalScoreEntered) {
            if (isLocked) {
                totalDisplay = `
                    <div class="lock-wrapper">
                        <span style="font-weight:700;color:#2a8396;font-size:0.875rem;">${totalVal}</span>
                        <span class="material-symbols-outlined lock-icon">lock</span>
                    </div>`;
            } else {
                totalDisplay = `<span style="font-weight:700;color:#2a8396;font-size:0.875rem;">${totalVal}</span>`;
            }
            gradeDisplay = `<span class="grade-letter ${gradeClass}">${gradeText}</span>`;
            statusBadge = isPassed ? `<span class="status-passed">✅ ناجح</span>` : `<span class="status-failed">❌ راسب</span>`;
        } else {
            totalDisplay = `<span class="grade-text-empty">--</span>`;
            gradeDisplay = `<span class="grade-text-empty">--</span>`;
            if (midScore > 0) {
                statusBadge = isMidLocked ? 
                    `<span class="lock-badge lock-badge-midterm"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">lock</span> نصفي معتمد</span>` : 
                    `<span class="status-pending">⏳ رصد نصفي</span>`;
            } else {
                statusBadge = `<span class="status-pending">⏳ لم يتم الرصد</span>`;
            }
        }

        tbody.innerHTML += `
            <tr id="row-${escapeHtml(String(studentCode))}" style="border-bottom:1px solid rgba(203,213,225,0.4);">
                <td class="cell-index">${index + 1}</td>
                <td class="cell-id">${escapeHtml(String(studentCode))}</td>
                <td class="cell-name">${escapeHtml(String(studentName))}</td>
                <td class="cell-course">${escapeHtml(String(courseName))}</td>
                <td class="cell-midterm">${midDisplay}</td>
                <td class="cell-final">${finDisplay}</td>
                <td class="cell-total">${totalDisplay}</td>
                <td class="cell-grade">${gradeDisplay}</td>
                <td class="cell-status">${statusBadge}</td>
            </tr>
        `;
    });

    updateButtonStates(period);
    const tableContainer = document.getElementById('table-container');
    if (tableContainer) {
        tableContainer.classList.remove('hidden');
    }
}

// ============================================================
// ===           دوال التقدير اللفظي               ===
// ============================================================
function getGradeText(score) {
    if (score >= 90) return 'ممتاز';
    else if (score >= 80) return 'جيد جداً';
    else if (score >= 70) return 'جيد';
    else if (score >= 60) return 'مقبول';
    else if (score >= 50) return 'ضعيف';
    else return 'راسب';
}

function getGradeClass(score) {
    if (score >= 90) return 'grade-excellent';
    else if (score >= 80) return 'grade-very-good';
    else if (score >= 70) return 'grade-good';
    else if (score >= 60) return 'grade-acceptable';
    else if (score >= 50) return 'grade-poor';
    else return 'grade-poor';
}

// ============================================================
// ===          تحديث حالة الأزرار وشريط الحالة      ===
// ============================================================
function updateButtonStates(period) {
    const publishBtn = document.getElementById('btn-publish-student');
    const lockBtn = document.getElementById('btn-approve-lock');
    const lockTextSpan = document.getElementById('btn-lock-text');
    const statusBadge = document.getElementById('status-badge');

    if (!publishBtn || !lockBtn) return;

    const hasStudents = loadedStudentsGlobal.length > 0;
    const allMidtermLocked = hasStudents && loadedStudentsGlobal.every(s => s.is_midterm_locked);
    const allFinalLocked = hasStudents && loadedStudentsGlobal.every(s => s.is_final_locked);

    if (period === 'midterm') {
        if (lockTextSpan) lockTextSpan.innerText = 'اعتماد وقفل امتحان النصفي 🔒';
        
        if (allMidtermLocked) {
            lockBtn.className = "btn btn-lock disabled";
            lockBtn.disabled = true;
            lockBtn.innerHTML = `<span class="material-symbols-outlined">lock</span> تم القفل ✅`;
            if (statusBadge) {
                statusBadge.innerHTML = `<span class="material-symbols-outlined status-bar-icon" style="color:#10b981;">lock</span><span style="color:#10b981;font-weight:600;">🔒 درجات النصفي معتمدة ومقفلة - يمكنك الانتقال لرصد النهائي أو ترحيل الكشف عند اكتماله</span>`;
            }
        } else {
            lockBtn.className = "btn btn-lock";
            lockBtn.disabled = !hasStudents;
            lockBtn.innerHTML = `<span class="material-symbols-outlined btn-icon-animate">lock</span> اعتماد وقفل النصفي 🔒`;
            if (statusBadge) {
                statusBadge.innerHTML = `<span class="material-symbols-outlined status-bar-icon">info</span><span>يمكنك تعديل درجات النصفي - بعد الانتهاء اضغط "اعتماد وقفل النصفي 🔒"</span>`;
            }
        }
    } else if (period === 'final') {
        if (lockTextSpan) lockTextSpan.innerText = 'اعتماد وقفل امتحان النهائي 🔒';

        if (allFinalLocked) {
            lockBtn.className = "btn btn-lock disabled";
            lockBtn.disabled = true;
            lockBtn.innerHTML = `<span class="material-symbols-outlined">lock</span> تم القفل ✅`;
            if (statusBadge) {
                statusBadge.innerHTML = `<span class="material-symbols-outlined status-bar-icon" style="color:#10b981;">lock</span><span style="color:#10b981;font-weight:600;">🔒 درجات النهائي معتمدة ومقفلة - الكشف جاهز للترحيل لصفحة عرض النتائج</span>`;
            }
        } else {
            lockBtn.className = "btn btn-lock";
            lockBtn.disabled = !hasStudents;
            lockBtn.innerHTML = `<span class="material-symbols-outlined btn-icon-animate">lock</span> اعتماد وقفل النهائي 🔒`;
            if (statusBadge) {
                statusBadge.innerHTML = `<span class="material-symbols-outlined status-bar-icon">info</span><span>يمكنك تعديل درجات النهائي، ثم اضغط "اعتماد وقفل النهائي 🔒"</span>`;
            }
        }
    }

    // زر ترحيل ونشر الكشف لصفحة عرض النتائج
    if (allMidtermLocked && allFinalLocked) {
        publishBtn.className = "btn btn-publish";
        publishBtn.disabled = false;
    } else {
        publishBtn.className = "btn btn-publish disabled";
        publishBtn.disabled = true;
    }
}

// ============================================================
// ===    زر استيراد وتعبئة: قراءة وتعبئة تلقائية (DOM Auto-fill) ===
// ============================================================
function uploadExcelGrades() {
    const fileInput = document.getElementById('excel-file-input');
    const file = fileInput ? fileInput.files[0] : null;
    const period = document.getElementById('period-select')?.value || 'midterm';
    const semId = document.getElementById('semester-select')?.value;
    const crsId = document.getElementById('course-select')?.value;
    const profId = document.getElementById('professor-select') ? document.getElementById('professor-select').value : '';
    const lvlId = document.getElementById('level-select') ? document.getElementById('level-select').value : '';
    const depId = document.getElementById('specialty-select') ? document.getElementById('specialty-select').value : '';
    const grpId = document.getElementById('group-select') ? document.getElementById('group-select').value : '';

    if (!file) {
        showToast("⚠️ الرجاء اختيار ملف (CSV أو Excel) أولاً!", true);
        return;
    }
    if (!semId || !crsId) {
        showToast("⚠️ الرجاء اختيار الفصل والمادة أولاً!", true);
        return;
    }

    // فحص القفل وفقاً لسير العمل
    const hasStudents = loadedStudentsGlobal.length > 0;
    const allMidtermLocked = hasStudents && loadedStudentsGlobal.every(s => s.is_midterm_locked);
    const allFinalLocked = hasStudents && loadedStudentsGlobal.every(s => s.is_final_locked);

    if (period === 'midterm' && allMidtermLocked) {
        showToast("⚠️ لا يمكن الاستيراد! درجات الامتحان النصفي معتمدة ومقفلة 🔒", true);
        return;
    }

    if (period === 'final' && allFinalLocked) {
        showToast("⚠️ لا يمكن الاستيراد! درجات الامتحان النهائي معتمدة ومقفلة 🔒", true);
        return;
    }

    showToast("⏳ جاري رفع واستيراد ملف الدرجات وتحديث بيانات الطلاب في المنظومة...");

    const formData = new FormData();
    formData.append('excel_file', file);
    formData.append('semester_id', semId);
    formData.append('course_id', crsId);
    formData.append('period', period);
    if (profId) formData.append('professor_id', profId);
    if (lvlId) formData.append('level_id', lvlId);
    if (depId) formData.append('department_id', depId);
    if (grpId) formData.append('group_id', grpId);

    fetch('/grades/api/grades/import-excel/', {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showNotification('success', 'تم التعبئة');
            if (data.students && data.students.length > 0) {
                loadedStudentsGlobal = data.students;
            }
            renderTable(period);
            if (fileInput) fileInput.value = '';
            const nameDisplay = document.getElementById('file-name-display');
            if (nameDisplay) nameDisplay.innerText = 'اختر ملف الكشف (CSV / Excel)...';
        } else {
            handleExcelUploadError(data);
        }
    })
    .catch(err => {
        console.error("❌ Error uploading CSV/Excel grades:", err);
        handleExcelUploadError({ message: "حدث خطأ أثناء الاتصال بالخادم ورفع الملف: " + err.message });
    });
}

function handleExcelUploadError(data) {
    const rawMsg = (data && data.message) ? data.message : '';
    const errorsArr = (data && data.errors && Array.isArray(data.errors)) ? data.errors : [];
    const fullText = (rawMsg + ' ' + errorsArr.join(' ')).toLowerCase();

    let alertTitle = "تنبيه: تعذر استيراد ملف Excel";

    // 1. فحص الخطأ المتعلق بدرجات المادة (خارج المدى أو رصد خاطئ)
    if (fullText.includes("درجة") || fullText.includes("40") || fullText.includes("60") || fullText.includes("بين 0") || fullText.includes("سالبة") || fullText.includes("أكبر من") || fullText.includes("رصد")) {
        alertTitle = "تنبيه: يوجد خطأ في رصد الدرجات (تأكد أن الدرجات بين 0 و 40)";
    }
    // 2. فحص الخطأ المتعلق بأسماء وأرقام القيد والمجموعة
    else if (fullText.includes("مطابقة") || fullText.includes("غير مسجلين") || fullText.includes("الأسماء") || fullText.includes("أرقام") || fullText.includes("غير متطابقة") || fullText.includes("قيد") || fullText.includes("طالب") || fullText.includes("مجموعة") || fullText.includes("كشف")) {
        alertTitle = "تنبيه: بيانات الطلبة في ملف Excel غير متطابقة مع قائمة المجموعة الحالية";
    }

    const detailText = rawMsg || (errorsArr.length ? errorsArr.join(' - ') : "فشل استيراد الملف لعدم استيفاء الشروط المفروضة.");

    showToast(`${alertTitle}: ${detailText}`, 'warning');
}

// ============================================================
// ===   زر رصد وحفظ الدرجات: فتح مودال التأكيد    ===
// ============================================================
function openLockConfirmModal() {
    const period = document.getElementById('period-select').value;
    const modalTitle = document.getElementById('lock-modal-title');
    const modalText = document.getElementById('lock-modal-text');

    if (period === 'midterm') {
        if (modalTitle) modalTitle.innerText = 'تأكيد رصد وحفظ درجات النصفي';
        if (modalText) {
            modalText.innerHTML = `هل أنت متأكد من حفظ ورصد درجات الامتحان النصفي؟<br/><span class="modal-warning">⚠️ بعد الرصد لن تتمكن من تعديل أو استيراد درجات النصفي مرة أخرى.</span>`;
        }
    } else {
        if (modalTitle) modalTitle.innerText = 'تأكيد رصد وحفظ درجات النهائي والنتائج';
        if (modalText) {
            modalText.innerHTML = `هل أنت متأكد من حفظ ورصد درجات النهائي وحساب النتائج؟<br/><span class="modal-warning">⚠️ بعد الرصد لن تتمكن من تعديل الكشف، وسيكون جاهزاً للترحيل لصفحة عرض النتائج.</span>`;
        }
    }

    const modal = document.getElementById('lockConfirmModal');
    if (modal) modal.style.display = 'flex';
}

function closeLockConfirmModal() {
    const modal = document.getElementById('lockConfirmModal');
    if (modal) modal.style.display = 'none';
}

function openLockSuccessModal() {
    const modal = document.getElementById('lockSuccessModal');
    if (modal) modal.style.display = 'flex';
}

function closeLockSuccessModal() {
    const modal = document.getElementById('lockSuccessModal');
    if (modal) modal.style.display = 'none';
    loadStudentsFromDatabase();
}

function submitLockToBackend() {
    closeLockConfirmModal();
    return lockGrades();
}

// 🔥 دالة القفل المنفصلة
function lockGrades() {
    const semId = document.getElementById('semester-select').value;
    const crsId = document.getElementById('course-select').value;
    const depId = document.getElementById('specialty-select').value;
    const grpId = document.getElementById('group-select').value;
    const lvlId = document.getElementById('level-select') ? document.getElementById('level-select').value : '';
    const period = document.getElementById('period-select').value;
    const profId = document.getElementById('professor-select').value;

    showToast("جاري اعتماد وقفل الكشف نهائياً...");

    const requestData = {
        semester_id: parseInt(semId),
        course_id: parseInt(crsId),
        period: period,
        professor_id: profId || null
    };

    if (depId && depId !== '') requestData.department_id = depId;
    if (grpId && grpId !== '') requestData.group_id = grpId;
    if (lvlId && lvlId !== '') requestData.level_id = lvlId;

    console.log("📤 Sending lock request:", requestData);

    return fetch('/grades/api/approve-and-lock/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(requestData)
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'حدث خطأ في الخادم');
        return data;
    })
    .then(data => {
        if (data.success) {
            openLockSuccessModal();
            // 🔥 تحديث حالة القفل في البيانات المحلية
            loadedStudentsGlobal = loadedStudentsGlobal.map(s => ({
                ...s,
                is_midterm_locked: period === 'midterm' ? true : s.is_midterm_locked,
                is_final_locked: period === 'final' ? true : s.is_final_locked
            }));
            
            renderTable(period);
            showNotification('success', 'تم القفل');
        } else {
            showToast(data.message || "حدث خطأ أثناء الاعتماد والقفل", true);
        }
    })
    .catch(err => {
        console.error("❌ Error locking grades:", err);
        showToast(err.message || "حدث خطأ في الاتصال بالخادم", true);
    });
}

// ============================================================
// ===    زر تصدير وإرسال الكشف للأستاذ            ===
// ============================================================
function openExportModal() {
    if (typeof window.IS_SEND_SHEETS_JOB_OPEN !== 'undefined' && !window.IS_SEND_SHEETS_JOB_OPEN) {
        showToast(window.SEND_SHEETS_JOB_MESSAGE || "⚠️ خدمة 'إرسال الكشوفات للأستاذ' غير مفعلة حالياً", true);
        return;
    }

    const emailDisplay = document.getElementById('professor-email-display');
    const emailVal = emailDisplay ? emailDisplay.value.trim() : '';
    
    if (!emailVal) {
        showToast("⚠️ الرجاء اختيار أستاذ المادة أولاً لجلب بريده الإلكتروني!", true);
        return;
    }
    
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'flex';
        const emailInput = document.getElementById('professor-email-input');
        if (emailInput) {
            emailInput.value = emailVal;
            emailInput.readOnly = true;
        }
    }
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.style.display = 'none';
}

function sendExcelToProfessorEmail() {
    if (typeof window.IS_SEND_SHEETS_JOB_OPEN !== 'undefined' && !window.IS_SEND_SHEETS_JOB_OPEN) {
        showToast(window.SEND_SHEETS_JOB_MESSAGE || "⚠️ خدمة 'إرسال الكشوفات للأستاذ' غير مفعلة حالياً", true);
        return;
    }

    const email = document.getElementById('professor-email-input').value.trim();
    if (!email || !email.includes('@')) {
        showToast("الرجاء إدخال بريد إلكتروني صحيح!", true);
        return;
    }

    const semId = document.getElementById('semester-select').value;
    const crsId = document.getElementById('course-select').value;
    const depId = document.getElementById('specialty-select').value;
    const grpId = document.getElementById('group-select').value;
    const lvlId = document.getElementById('level-select') ? document.getElementById('level-select').value : ''; // 🔥 إضافة المستوى
    const period = document.getElementById('period-select').value;
    const profId = document.getElementById('professor-select').value;

    if (!semId || !crsId) {
        showToast("الرجاء اختيار الفصل والمادة أولاً!", true);
        return;
    }

    closeExportModal();
    showToast("جاري إعداد وإرسال الكشف بالبريد الإلكتروني...");

    const requestData = {
        semester_id: parseInt(semId),
        course_id: parseInt(crsId),
        period: period,
        email: email,
        professor_id: profId || null
    };

    if (depId && depId !== '') requestData.department_id = depId;
    if (grpId && grpId !== '') requestData.group_id = grpId;
    if (lvlId && lvlId !== '') requestData.level_id = lvlId; // 🔥 إضافة المستوى

    console.log("📤 Sending export request:", requestData);
    fetch('/grades/api/export-excel/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify(requestData)
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'حدث خطأ في الخادم');
        return data;
    })
    .then(data => {
        if (data.success) {
            showNotification('success', 'تم الإرسال');
            document.getElementById('professor-email-input').value = '';
        } else {
            showToast(data.message || "حدث خطأ أثناء الإرسال", true);
        }
    })
    .catch(err => {
        console.error("❌ Error exporting:", err);
        showToast(err.message || "حدث خطأ في الاتصال بالخادم أثناء الإرسال", true);
    });
}

function closeUnderConstructionModal() {
    document.getElementById('underConstructionModal').style.display = 'none';
}

// ============================================================
// ===    زر الترحيل: نشر النتائج لواجهة الطالب   ===
// ============================================================
function publishToStudentInterface() {
    const semId = document.getElementById('semester-select').value;
    const crsId = document.getElementById('course-select').value;
    const depId = document.getElementById('specialty-select').value;
    const grpId = document.getElementById('group-select').value;
    const lvlId = document.getElementById('level-select') ? document.getElementById('level-select').value : ''; // 🔥 إضافة المستوى
    const period = document.getElementById('period-select').value;

    if (!semId || !crsId) {
        showToast("الرجاء اختيار الفصل والمادة أولاً!", true);
        return;
    }

    const hasStudents = loadedStudentsGlobal.length > 0;
    const allMidtermLocked = hasStudents && loadedStudentsGlobal.every(s => s.is_midterm_locked);
    const allFinalLocked = hasStudents && loadedStudentsGlobal.every(s => s.is_final_locked);
    const isLocked = (period === 'midterm' && allMidtermLocked) || (period === 'final' && allFinalLocked);

    if (!isLocked) {
        showToast("⚠️ يجب اعتماد وقفل الكشف أولاً قبل الترحيل!", true);
        return;
    }

    if (loadedStudentsGlobal.length === 0) {
        showToast("⚠️ لا يوجد طلاب لنشر نتائجهم!", true);
        return;
    }

    showToast("جاري ترحيل النتائج إلى صفحة عرض النتائج...");

    const requestData = {
        semester_id: parseInt(semId),
        course_id: parseInt(crsId),
        period: period
    };

    if (depId && depId !== '') requestData.department_id = depId;
    if (grpId && grpId !== '') requestData.group_id = grpId;
    if (lvlId && lvlId !== '') requestData.level_id = lvlId; // 🔥 إضافة المستوى

    console.log("📤 Sending publish request:", requestData);

    fetch('/grades/api/publish-grades/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({
            semester_id: parseInt(semId),
            course_id: parseInt(crsId),
            period: period
        })
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'حدث خطأ في الخادم');
        return data;
    })
    .then(data => {
        if (data.success) {
            showToast("🚀 " + (data.message || 'تم ترحيل النتائج بنجاح!'));
            const publishBtn = document.getElementById('btn-publish-student');
            if (publishBtn) {
                publishBtn.className = "btn btn-publish published";
                publishBtn.disabled = true;
                publishBtn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> تم الترحيل والنشر`;
            }
        } else {
            showToast(data.message || "حدث خطأ أثناء الترحيل", true);
        }
    })
    .catch(err => {
        console.error("❌ Error publishing:", err);
        showToast(err.message || "حدث خطأ في الاتصال بالخادم", true);
    });
}



function reloadGroupsDropdown() {
    const sem = document.getElementById('semester-select').value;
    const crs = document.getElementById('course-select').value;
    const lvl = document.getElementById('level-select') ? document.getElementById('level-select').value : '';
    const specialty = document.getElementById('specialty-select').value;
    
    let url = '/grades/api/filters/';
    const params = [];
    if (sem) params.push(`semester_id=${sem}`);
    if (crs) params.push(`course_id=${crs}`);
    if (lvl) params.push(`level_id=${lvl}`);
    if (specialty) params.push(`department_id=${specialty}`);
    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const groupSelect = document.getElementById('group-select');
                if (groupSelect) {
                    const prevVal = groupSelect.value;
                    fillSelect('group-select', data.groups, 'اختر المجموعة...');
                    if (prevVal) {
                        groupSelect.value = prevVal;
                    }
                }
            }
        })
        .catch(err => console.error("Error reloading groups:", err));
}

function reloadProfessorsDropdown() {
    const sem = document.getElementById('semester-select').value;
    const crs = document.getElementById('course-select').value;
    const lvl = document.getElementById('level-select') ? document.getElementById('level-select').value : '';
    const specialty = document.getElementById('specialty-select').value;
    const grp = document.getElementById('group-select').value;
    
    let url = '/grades/api/filters/';
    const params = [];
    if (sem) params.push(`semester_id=${sem}`);
    if (crs) params.push(`course_id=${crs}`);
    if (lvl) params.push(`level_id=${lvl}`);
    if (specialty) params.push(`department_id=${specialty}`);
    if (grp) params.push(`group_id=${grp}`);
    
    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const profSelect = document.getElementById('professor-select');
                if (profSelect) {
                    const prevVal = profSelect.value;
                    profSelect.innerHTML = '<option value="">اختر الأستاذ...</option>';
                    data.professors.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = p.name;
                        opt.dataset.email = p.email;
                        profSelect.appendChild(opt);
                    });
                    if (prevVal) {
                        profSelect.value = prevVal;
                    }
                    if (data.professors.length === 1) {
                        profSelect.selectedIndex = 1;
                    }
                }
                handleProfessorChange();
            }
        })
        .catch(err => console.error("Error reloading professors:", err));
}

function handleProfessorChange() {
    const profSelect = document.getElementById('professor-select');
    const emailDisplay = document.getElementById('professor-email-display');
    if (!profSelect || !emailDisplay) return;
    
    const selectedOption = profSelect.options[profSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset && selectedOption.dataset.email) {
        emailDisplay.value = selectedOption.dataset.email;
    } else {
        emailDisplay.value = '';
    }
}

// ============================================================
// ===      دالة الـ Toast الناتجة والتنبيهات المتقدمة       ===
// ============================================================
function showToast(message, typeOrIsError = false) {
    let type = 'success';
    if (typeof typeOrIsError === 'boolean') {
        type = typeOrIsError ? 'error' : 'success';
    } else if (typeof typeOrIsError === 'string') {
        type = typeOrIsError;
    }

    // 1. إذا كانت مكتبة SweetAlert2 متاحة، استخدام Toast السفلية بمرونة
    if (typeof Swal !== 'undefined') {
        const Toast = Swal.mixin({
            toast: true,
            position: 'bottom-end',
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            showCloseButton: true,
            backdrop: false,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });

        Toast.fire({
            icon: type === 'warning' ? 'warning' : (type === 'error' ? 'error' : 'success'),
            title: message
        });
        return;
    }

    // 2. نظام Toast عصري مخصص أسفل اليمين (Bottom-Right Toast Notification)
    let toastContainer = document.getElementById('custom-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'custom-toast-container';
        toastContainer.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 999999; display: flex; flex-direction: column; gap: 10px; max-width: 400px; width: calc(100% - 48px); pointer-events: none;';
        document.body.appendChild(toastContainer);
    }

    const toastEl = document.createElement('div');
    const bgColor = type === 'error' ? '#dc2626' : (type === 'warning' ? '#d97706' : '#059669');
    const iconSymbol = type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : '✅');

    toastEl.style.cssText = `
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 12px;
        background: ${bgColor};
        color: #ffffff;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 0.92rem;
        font-weight: 500;
        line-height: 1.4;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
        transform: translateY(20px) scale(0.95);
        direction: rtl;
    `;

    toastEl.innerHTML = `
        <span style="font-size: 1.15rem; flex-shrink: 0; margin-top: 1px;">${iconSymbol}</span>
        <div style="flex: 1; word-break: break-word;">${message}</div>
        <button type="button" style="background: transparent; border: none; color: #ffffff; opacity: 0.8; cursor: pointer; font-size: 1.1rem; padding: 0 0 0 4px; line-height: 1; flex-shrink: 0;" onclick="this.parentElement.remove()">✕</button>
        <div class="toast-progress-bar" style="position: absolute; bottom: 0; right: 0; height: 4px; background: rgba(255,255,255,0.45); width: 100%; transition: width 3.5s linear;"></div>
    `;

    toastContainer.appendChild(toastEl);

    requestAnimationFrame(() => {
        toastEl.style.opacity = '1';
        toastEl.style.transform = 'translateY(0) scale(1)';
        const progressBar = toastEl.querySelector('.toast-progress-bar');
        if (progressBar) progressBar.style.width = '0%';
    });

    setTimeout(() => {
        toastEl.style.opacity = '0';
        toastEl.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => toastEl.remove(), 300);
    }, 3500);
}

// ============================================================
// ===        إغلاق المودالات بالضغط خارجها        ===
// ============================================================
window.addEventListener('click', function(e) {
    const lockModal = document.getElementById('lockConfirmModal');
    const exportModal = document.getElementById('exportModal');
    const successModal = document.getElementById('lockSuccessModal');
    
    if (e.target === lockModal) closeLockConfirmModal();
    if (e.target === exportModal) closeExportModal();
    if (e.target === successModal) closeLockSuccessModal();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeLockConfirmModal();
        closeExportModal();
    }
});
// ============================================================
// ===        تحديث الدرجة عند التعديل المباشر      ===
// ============================================================
function onGradeChange(input, studentId, field) {
    const value = parseFloat(input.value) || 0;
    const student = loadedStudentsGlobal.find(s => s.id == studentId);
    if (!student) return;
    
    // التحقق من الحدود
    if (field === 'midterm' && value > 40) {
        showToast('⚠️ درجة النصفي لا تتجاوز 40', true);
        input.value = student.midterm_score || 0;
        return;
    }
    if (field === 'final' && value > 60) {
        showToast('⚠️ درجة النهائي لا تتجاوز 60', true);
        input.value = student.final_score || 0;
        return;
    }
    
    // تحديث القيمة محلياً
    if (field === 'midterm') {
        student.midterm_score = value;
    } else if (field === 'final') {
        student.final_score = value;
    }
    
    // إعادة حساب المجموع والتقدير
    const row = input.closest('tr');
    const totalCell = row ? row.querySelector('.cell-total') : null;
    const gradeCell = row ? row.querySelector('.cell-grade') : null;
    const statusCell = row ? row.querySelector('.cell-status') : null;
    
    const midScore = parseFloat(student.midterm_score) || 0;
    const finScore = parseFloat(student.final_score) || 0;

    // فحص حاسم: هل درجة النهائي مدخلة وموجودة فعلياً؟
    const finalInput = row ? (row.querySelector('input[data-field="final"]') || row.querySelector('input.grade-editable[data-field="final"]')) : null;
    const hasFinalInputVal = finalInput && finalInput.value.trim() !== '' && !isNaN(parseFloat(finalInput.value)) && parseFloat(finalInput.value) > 0;
    const hasFinalEntered = (finScore > 0) || hasFinalInputVal || (student.is_final_entered && student.final_score > 0) || student.is_final_locked;

    if (!hasFinalEntered) {
        // يُمنع حساب المجموع والتقدير والحالة إطلاقاً إلا إذا كانت درجة النهائي مدخلة وموجودة فعلياً
        if (totalCell) totalCell.innerHTML = `<span class="grade-text-empty">--</span>`;
        if (gradeCell) gradeCell.innerHTML = `<span class="grade-text-empty">--</span>`;
        if (statusCell) {
            if (midScore > 0) {
                const isMidLocked = student.is_midterm_locked || false;
                statusCell.innerHTML = isMidLocked ? 
                    `<span class="lock-badge lock-badge-midterm"><span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;">lock</span> نصفي معتمد</span>` : 
                    `<span class="status-pending">⏳ رصد نصفي</span>`;
            } else {
                statusCell.innerHTML = `<span class="status-pending">⏳ لم يتم الرصد</span>`;
            }
        }
    } else {
        const totalVal = midScore + finScore;
        const isPassed = totalVal >= 50;
        const gradeText = getGradeText(totalVal);
        const gradeClass = getGradeClass(totalVal);
        
        if (totalCell) totalCell.innerHTML = `<span style="font-weight:700;color:#2a8396;font-size:0.875rem;">${totalVal}</span>`;
        if (gradeCell) gradeCell.innerHTML = `<span class="grade-letter ${gradeClass}">${gradeText}</span>`;
        if (statusCell) {
            statusCell.innerHTML = isPassed ? `<span class="status-passed">✅ ناجح</span>` : `<span class="status-failed">❌ راسب</span>`;
        }
    }
    
    // تغيير لون الصف للإشارة إلى التعديل
    row.style.backgroundColor = '#fefce8';
    setTimeout(() => {
        row.style.backgroundColor = '';
    }, 2000);
    
    // 🔥 حفظ تلقائي بعد 2 ثانية من التوقف عن الكتابة
    clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => {
        autoSaveGrades();
    }, 2000);
}

// ============================================================
// ===        حفظ جميع الدرجات في الخادم           ===
// ============================================================
function autoSaveGrades() {
    const semId = document.getElementById('semester-select').value;
    const crsId = document.getElementById('course-select').value;
    
    if (!semId || !crsId) return;
    
    const hasStudents = loadedStudentsGlobal.length > 0;
    const allMidtermLocked = hasStudents && loadedStudentsGlobal.every(s => s.is_midterm_locked);
    const allFinalLocked = hasStudents && loadedStudentsGlobal.every(s => s.is_final_locked);
    const period = document.getElementById('period-select').value;
    const isLocked = (period === 'midterm' && allMidtermLocked) || (period === 'final' && allFinalLocked);

    if (isLocked) {
        console.log('🔒 الكشف مقفل، لا يمكن الحفظ');
        return;
    }
    
    const studentsData = loadedStudentsGlobal.map(s => ({
        id: s.id,
        midterm_grade: s.midterm_score || 0,
        final_grade: s.final_score || 0,
        grade_id: s.grade_id || null
    }));
    
    fetch('/grades/api/save-grades/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrftoken
        },
        body: JSON.stringify({
            semester_id: parseInt(semId),
            course_id: parseInt(crsId),
            students: studentsData
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log(`✅ تم حفظ ${data.saved_count || 0} درجة`);
            // تحديث grade_id في البيانات المحلية
            if (data.students) {
                data.students.forEach(updated => {
                    const local = loadedStudentsGlobal.find(s => s.id === updated.id);
                    if (local) {
                        local.grade_id = updated.grade_id;
                    }
                });
            }
        }
    })
    .catch(err => {
        console.error('❌ Error saving grades:', err);
    });
}

// تصدير الدوال لنطاق window لإتاحتها لأحداث onchange/onclick في HTML
window.handleFilterChange = handleFilterChange;
window.handleProfessorChange = handleProfessorChange;
window.loadStudentsFromDatabase = loadStudentsFromDatabase;

// ============================================================
// 🔥 التحكم في صلاحيات وظيفتي الرصد وإرسال الكشوفات للأستاذ (Dual Independent Jobs)
// ============================================================

function applyGradeEntryPermissionsUI() {
    const isSendSheetsOpen = (typeof window.IS_SEND_SHEETS_JOB_OPEN !== 'undefined') ? Boolean(window.IS_SEND_SHEETS_JOB_OPEN) : true;
    const sendSheetsMsg = window.SEND_SHEETS_JOB_MESSAGE || '⚠️ خدمة "إرسال الكشوفات للأستاذ" غير مفعلة حالياً في إدارة الوظائف.';

    const isGradeEntryOpen = (typeof window.IS_GRADE_ENTRY_JOB_OPEN !== 'undefined') ? Boolean(window.IS_GRADE_ENTRY_JOB_OPEN) : true;
    const gradeEntryMsg = window.GRADE_ENTRY_JOB_MESSAGE || '⚠️ خدمة "رصد الدرجات" غير مفعلة حالياً في إدارة الوظائف.';

    console.log(`🔐 Send Sheets Job Open: ${isSendSheetsOpen} | Grade Entry Job Open: ${isGradeEntryOpen}`);

    // 1. Job 1: إرسال الكشوفات للأستاذ (send_grade_sheets)
    const sendSheetsBanner = document.getElementById('sendSheetsJobInactiveBanner');
    const sendSheetsBannerText = document.getElementById('sendSheetsJobInactiveBannerText');
    if (sendSheetsBanner) {
        if (!isSendSheetsOpen) {
            if (sendSheetsBannerText) sendSheetsBannerText.textContent = sendSheetsMsg;
            sendSheetsBanner.style.display = 'flex';
        } else {
            sendSheetsBanner.style.display = 'none';
        }
    }

    const btnExportList = document.querySelectorAll('.btn-export, #btnExportSendSheet, #btnSendEmailConfirm');
    btnExportList.forEach(btn => {
        if (btn) {
            if (!isSendSheetsOpen) {
                btn.disabled = true;
                btn.setAttribute('disabled', 'disabled');
                btn.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                btn.style.setProperty('opacity', '0.5', 'important');
                btn.style.setProperty('cursor', 'not-allowed', 'important');
                btn.style.setProperty('pointer-events', 'none', 'important');
                btn.style.setProperty('filter', 'grayscale(80%)', 'important');
                btn.title = sendSheetsMsg;
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

    // 2. Job 2: رصد الدرجات (grade_entry_monitoring)
    const gradeEntryBanner = document.getElementById('gradeEntryJobInactiveBanner');
    const gradeEntryBannerText = document.getElementById('gradeEntryJobInactiveBannerText');
    if (gradeEntryBanner) {
        if (!isGradeEntryOpen) {
            if (gradeEntryBannerText) gradeEntryBannerText.textContent = gradeEntryMsg;
            gradeEntryBanner.style.display = 'flex';
        } else {
            gradeEntryBanner.style.display = 'none';
        }
    }

    const fileInput = document.getElementById('excel-file-input');
    const fileLabel = document.querySelector('.custom-file-upload');
    const btnImport = document.getElementById('btnUploadImportGrades') || document.querySelector('.btn-import');
    const btnLock = document.getElementById('btn-approve-lock');
    const btnPublish = document.getElementById('btn-publish-student');

    const gradeEntryControls = [fileInput, fileLabel, btnImport, btnLock, btnPublish];

    gradeEntryControls.forEach(ctrl => {
        if (ctrl) {
            if (!isGradeEntryOpen) {
                ctrl.disabled = true;
                ctrl.setAttribute('disabled', 'disabled');
                ctrl.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                ctrl.style.setProperty('opacity', '0.5', 'important');
                ctrl.style.setProperty('cursor', 'not-allowed', 'important');
                ctrl.style.setProperty('pointer-events', 'none', 'important');
                ctrl.style.setProperty('filter', 'grayscale(80%)', 'important');
                ctrl.title = gradeEntryMsg;
            } else {
                if (ctrl !== btnPublish || !ctrl.classList.contains('disabled')) {
                    ctrl.disabled = false;
                    ctrl.removeAttribute('disabled');
                }
                ctrl.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                ctrl.style.setProperty('opacity', '1', 'important');
                ctrl.style.setProperty('cursor', 'pointer', 'important');
                ctrl.style.setProperty('pointer-events', 'auto', 'important');
                ctrl.style.setProperty('filter', 'none', 'important');
                ctrl.title = '';
            }
        }
    });
}

function updateGradeJobPermissionsState() {
    applyGradeEntryPermissionsUI();

    fetch('/renewal/api/jobs/check-permission/', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            window.IS_SEND_SHEETS_JOB_OPEN = Boolean(data.is_send_sheets_job_open);
            window.SEND_SHEETS_JOB_MESSAGE = data.send_sheets_job_message || '';
            window.IS_GRADE_ENTRY_JOB_OPEN = Boolean(data.is_grade_entry_job_open);
            window.GRADE_ENTRY_JOB_MESSAGE = data.grade_entry_job_message || '';
            applyGradeEntryPermissionsUI();
        }
    })
    .catch(err => {
        console.warn('⚠️ Dynamic grade entry jobs permission check error:', err);
    });
}
window.updateGradeJobPermissionsState = updateGradeJobPermissionsState;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Grade Entry Dual Permissions...');
    updateGradeJobPermissionsState();
});

updateGradeJobPermissionsState();

console.log('✅ Grade Entry page loaded successfully');
console.log('📌 CSRF Token:', csrftoken);
