// ============================================
// بيانات المواد الدراسية - Subject Data (Connected to Backend)
// ============================================

console.log('✅ subject_data.js loaded successfully');

// جلب مستويات قاعدة البيانات الممررة من القالب
const levelsDataEl = document.getElementById('levels-data');
if (levelsDataEl) {
    window.databaseLevels = JSON.parse(levelsDataEl.textContent);
}

let mockSubjects = [];
let currentSelectedCourseId = null;

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

// دالة لتأمين النص من XSS
function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// عرض رسالة باستخدام Toast
function showToastMessage(message, isError = false) {
    if (isError) {
        if (typeof toastError === 'function') toastError(message);
        else console.error('❌', message);
    } else {
        if (typeof toastSuccess === 'function') toastSuccess(message);
        else console.log('✅', message);
    }
}

// متغير لتخزين رقم الخطة الحالية
let currentPlan = 1;

// ============================================================
// إدارة القائمة المنسدلة المتعددة للتخصصات (Multi-Select)
// ============================================================
window.toggleDepartmentDropdown = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('majorSelectDropdownMenu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
};

window.selectAllDepartments = function(selectAll, e) {
    if (e) e.stopPropagation();
    const checkboxes = document.querySelectorAll('input[name="department_checkbox"]');
    checkboxes.forEach(cb => cb.checked = selectAll);
    window.updateDepartmentSelection();
};

window.updateDepartmentSelection = function() {
    const checkboxes = document.querySelectorAll('input[name="department_checkbox"]:checked');
    const labelEl = document.getElementById('majorSelectLabel');
    const majorSelect = document.getElementById('majorSelect');
    
    const selectedNames = [];
    const selectedIds = [];
    
    checkboxes.forEach(cb => {
        selectedNames.push(cb.getAttribute('data-name') || cb.value);
        selectedIds.push(cb.value);
    });
    
    if (majorSelect) {
        Array.from(majorSelect.options).forEach(opt => {
            opt.selected = selectedIds.includes(opt.value);
        });
    }
    
    if (labelEl) {
        if (selectedNames.length === 0) {
            labelEl.textContent = '-- اختر التخصصات --';
            labelEl.style.color = '#64748b';
            labelEl.style.fontWeight = 'normal';
        } else if (selectedNames.length <= 2) {
            labelEl.textContent = selectedNames.join(' ، ');
            labelEl.style.color = '#0f172a';
            labelEl.style.fontWeight = '600';
        } else {
            labelEl.textContent = `${selectedNames.length} تخصصات محددة (${selectedNames.slice(0, 2).join('، ')}...)`;
            labelEl.style.color = '#307e92';
            labelEl.style.fontWeight = '700';
        }
    }
};

window.getSelectedDepartmentIds = function() {
    const checkboxes = document.querySelectorAll('input[name="department_checkbox"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value)).filter(v => !isNaN(v));
};

window.setSelectedDepartmentIds = function(deptIds) {
    if (!deptIds) deptIds = [];
    if (!Array.isArray(deptIds)) deptIds = [deptIds];
    const stringIds = deptIds.map(String);
    const checkboxes = document.querySelectorAll('input[name="department_checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = stringIds.includes(String(cb.value));
    });
    window.updateDepartmentSelection();
};

document.addEventListener('click', function(e) {
    const container = document.querySelector('.custom-multiselect-container');
    const menu = document.getElementById('majorSelectDropdownMenu');
    if (menu && container && !container.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

// ============================================================
// تحميل التخصصات من الـ API
// ============================================================
function loadDepartments() {
    console.log('📋 Loading departments from backend...');
    const majorSelect = document.getElementById('majorSelect');
    const checkboxesList = document.getElementById('majorCheckboxesList');
    
    fetch('/renewal/api/departments/')
    .then(response => response.json())
    .then(data => {
        if (data.success && data.departments) {
            if (majorSelect) {
                majorSelect.innerHTML = data.departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
            }
            if (checkboxesList) {
                checkboxesList.innerHTML = data.departments.map(d => `
                    <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: #334155; transition: background 0.15s; margin-bottom: 2px;" class="dept-checkbox-label hover:bg-slate-100">
                        <input type="checkbox" name="department_checkbox" value="${d.id}" data-name="${escapeHtml(d.name)}" onchange="updateDepartmentSelection()" style="width: 16px; height: 16px; accent-color: #307e92; cursor: pointer;">
                        <span>${escapeHtml(d.name)}</span>
                    </label>
                `).join('');
            }
        }
    })
    .catch(error => {
        console.warn('⚠️ Server failed to load departments.', error);
    });
}

// ============================================================
// جلب المواد الدراسية من الـ API
// ============================================================
function loadSubjects() {
    console.log('🔄 Loading subjects from backend...');
    fetch('/renewal/api/courses/')
    .then(response => response.json())
    .then(data => {
        if (data.success && Array.isArray(data.courses)) {
            mockSubjects = data.courses.map(c => ({
                id: c.id,
                name: c.name,
                code: c.code,
                credits: c.credits,
                department_id: c.department_id,
                department_ids: c.department_ids || (c.department_id ? [c.department_id] : []),
                department_name: c.department_name || '',
                level_id: c.level_id || 1,
                level_number: c.level_number || 1,
                is_active: c.is_active,
                is_mandatory: c.is_mandatory,
                prerequisite: c.prerequisites && c.prerequisites.length > 0 ? c.prerequisites.map(p => p.code).join(', ') : null,
                prerequisites: c.prerequisites || [],
                prerequisite_ids: c.prerequisite_ids || (c.prerequisites ? c.prerequisites.map(p => p.id) : []),
                plans: c.plans || (c.study_plan_id ? [c.study_plan_id] : [1, 2])
            }));
            console.log(`✅ Loaded ${mockSubjects.length} subjects from API:`, mockSubjects);
            
            // تحديث عرض الخطة النشطة
            loadPlanData(currentPlan);
        } else {
            console.warn('⚠️ API returned failure or empty courses:', data);
        }
    })
    .catch(error => {
        console.error('❌ Error loading subjects:', error);
    });
}

// ============================================================
// 🚫 تعطيل الأسبقية للمستوى الأول وفلترة المستويات العليا ديناميكياً
// ============================================================
function handleLevelPrerequisiteState() {
    const levelSelect = document.getElementById('subjectLevelSelect');
    const prereqInput = document.getElementById('prerequisite');
    const resultsContainer = document.getElementById('prerequisiteResults');
    if (!levelSelect || !prereqInput) return;

    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
        resultsContainer.innerHTML = '';
    }

    // 🔍 تفعيل حقل المتطلب السديد لكافة المستويات مع مرونة البحث
    prereqInput.disabled = false;
    prereqInput.style.backgroundColor = '#ffffff';
    prereqInput.style.cursor = 'text';
    prereqInput.placeholder = 'ابحث عن مادة (المتطلب السابق)...';
}

// ============================================================
// البحث الذكي للمتطلبات السابقة (Autocomplete)
// ============================================================
function initPrerequisiteAutocomplete() {
    const input = document.getElementById('prerequisite');
    const resultsContainer = document.getElementById('prerequisiteResults');
    
    if (!input || !resultsContainer) return;
    
    input.addEventListener('input', function() {
        if (this.disabled) return;

        const query = this.value.trim().toLowerCase();
        const departmentId = document.getElementById('majorSelect')?.value;
        const levelSelect = document.getElementById('subjectLevelSelect');
        const selectedOptionText = levelSelect?.selectedOptions[0]?.text || '';
        const levelId = levelSelect?.value;
        
        let currentLevelNumber = 99;
        const match = selectedOptionText.match(/\d+/);
        if (match) {
            currentLevelNumber = parseInt(match[0]);
        } else if (levelId && window.databaseLevels) {
            const found = window.databaseLevels.find(l => l.id == levelId);
            if (found) currentLevelNumber = found.number;
        }

        if (!query || query.length < 1) {
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
            return;
        }
        
        // 🔍 الفلترة المرنة للمتطلبات السابقة:
        // 1. تطابق الاستعلام مع اسم المادة أو كودها
        // 2. استثناء المادة الحالية نفسها فقط لمنع أن تكون متطلباً لنفسها (c.id != currentSelectedCourseId)
        // 3. المستوى أصغر من أو يساوي المستوى الحالي (level_number <= currentLevelNumber) أو المواد العامة
        let matches = mockSubjects.filter(c => {
            const matchesQuery = c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query);
            const isNotSelf = (!currentSelectedCourseId || c.id != currentSelectedCourseId);
            const isEligibleLevel = (!c.level_number || c.level_number <= currentLevelNumber || currentLevelNumber === 0);
            return matchesQuery && isNotSelf && isEligibleLevel;
        });

        // 4. مرونة التخصص والخطة: لا يتم استبعاد المواد العامة أو المشتركة بين التخصصات
        if (departmentId) {
            const deptMatches = matches.filter(c => 
                !c.department_id || 
                c.department_id == departmentId || 
                c.is_general || 
                (c.department_name && (c.department_name.includes('عام') || c.department_name.includes('المتطلبات العامة')))
            );
            if (deptMatches.length > 0) {
                matches = deptMatches;
            }
        }
        
        if (matches.length === 0) {
            resultsContainer.innerHTML = '<div class="autocomplete-item" style="color: #94a3b8; cursor: default; padding: 10px;">لا توجد مواد سابقة مطابقة للبحث</div>';
            resultsContainer.classList.remove('hidden');
            return;
        }
        
        resultsContainer.innerHTML = matches.map(c => `
            <div class="autocomplete-item" onclick="selectPrerequisite(${c.id}, '${escapeHtml(c.code)}', '${escapeHtml(c.name)}')" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                <strong>${escapeHtml(c.code)}</strong> - ${escapeHtml(c.name)}
                <span style="font-size: 0.75rem; font-weight: bold; color: #2563eb; margin-right: 10px;">(المستوى ${c.level_number || 1})</span>
            </div>
        `).join('');
        
        resultsContainer.classList.remove('hidden');
    });
    
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.add('hidden');
        }
    });
}

// ============================================================
// اختيار متطلب سابق من القائمة
// ============================================================
function selectPrerequisite(id, code, name) {
    const input = document.getElementById('prerequisite');
    const resultsContainer = document.getElementById('prerequisiteResults');
    
    if (input) {
        input.value = `${code} - ${name}`;
        input.dataset.prereqId = id;
        input.dataset.prereqCode = code;
    }
    resultsContainer.classList.add('hidden');
    resultsContainer.innerHTML = '';
}

// ============================================================
// إظهار منطقة التوصيف (المعدلة)
// ============================================================
function showDescription() {
    console.log('📝 showDescription called');
    
    const subjectName = document.getElementById('subjectName')?.value?.trim() || '';
    const deptIds = window.getSelectedDepartmentIds ? window.getSelectedDepartmentIds() : [];
    const level = document.getElementById('subjectLevelSelect')?.value || '';
    
    if (!subjectName) {
        showToastMessage('⚠️ الرجاء إدخال اسم المادة', true);
        document.getElementById('subjectName')?.focus();
        return;
    }
    
    if (deptIds.length === 0) {
        showToastMessage('⚠️ الرجاء اختيار تخصص واحد على الأقل', true);
        document.getElementById('majorSelectDropdownBtn')?.focus();
        return;
    }
    
    if (!level) {
        showToastMessage('⚠️ الرجاء اختيار المستوى الدراسي', true);
        document.getElementById('subjectLevelSelect')?.focus();
        return;
    }
    
    const descArea = document.getElementById('descArea');
    if (descArea) {
        descArea.classList.remove('hidden');
        showToastMessage('📝 يمكنك الآن إدخال تفاصيل المادة', false);
        descArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================================
// عرض بطاقة تفاصيل المادة المختارة
// ============================================================
function showSelectedSubjectCard(subject) {
    const container = document.getElementById('selectedSubjectCardContainer');
    const cardBody = document.getElementById('selectedSubjectCard');
    
    if (!container || !cardBody) return;
    
    let prereqName = 'لا يوجد';
    if (subject.prerequisite) {
        const found = mockSubjects.find(sub => sub.code === subject.prerequisite);
        prereqName = found ? `${found.name} (${subject.prerequisite})` : subject.prerequisite;
    }
    
    const opensCourses = mockSubjects.filter(sub => sub.prerequisite === subject.code);
    const opensText = opensCourses.length > 0 
        ? opensCourses.map(sub => `${sub.name} (${sub.code})`).join('، ')
        : 'لا يوجد';
    
    // استخراج وعرض كافة التخصصات المرتبطة بالمادة
    let deptNames = [];
    if (subject.departments && Array.isArray(subject.departments) && subject.departments.length > 0) {
        deptNames = subject.departments.map(d => d.name || d);
    } else if (subject.department_name && subject.department_name.trim() !== '') {
        deptNames = [subject.department_name];
    } else if (subject.department_ids && Array.isArray(subject.department_ids) && subject.department_ids.length > 0) {
        const majorSelect = document.getElementById('majorSelect');
        if (majorSelect) {
            const stringIds = subject.department_ids.map(String);
            deptNames = Array.from(majorSelect.options)
                .filter(opt => stringIds.includes(String(opt.value)) && opt.value !== "")
                .map(opt => opt.text);
        }
    } else if (subject.department_id) {
        const majorSelect = document.getElementById('majorSelect');
        if (majorSelect) {
            const selectedOption = Array.from(majorSelect.options).find(opt => opt.value == subject.department_id);
            if (selectedOption && selectedOption.value !== "") {
                deptNames = [selectedOption.text];
            }
        }
    }
    
    const deptDisplayText = deptNames.length > 0 ? deptNames.join(' ، ') : 'تخصص عام';
    
    cardBody.innerHTML = `
        <div class="subject-detail-header">
            <span class="subject-detail-title">${escapeHtml(subject.name)}</span>
            <span class="subject-detail-code-badge">${escapeHtml(subject.code)}</span>
        </div>
        <hr style="border: none; border-top: 1.5px solid #e7f1f9; margin: 0.2rem 0;">
        <div class="subject-detail-grid">
            <div class="subject-detail-item">
                <strong>التخصصات:</strong>
                <span style="font-weight: 700; color: #0284c7;">${escapeHtml(deptDisplayText)}</span>
            </div>
            <div class="subject-detail-item">
                <strong>المستوى:</strong>
                <span>${subject.level_number ? `المستوى ${subject.level_number}` : 'غير محدد'}</span>
            </div>
            <div class="subject-detail-item">
                <strong>عدد الساعات:</strong>
                <span>${subject.credits} ساعات</span>
            </div>
            <div class="subject-detail-item" style="color: #00796b;">
                <strong>المتطلب السابق:</strong>
                <span>${escapeHtml(prereqName)}</span>
            </div>
            <div class="subject-detail-item" style="color: #b59b66;">
                <strong>المواد التي تفتحها:</strong>
                <span>${escapeHtml(opensText)}</span>
            </div>
        </div>
        <div class="subject-detail-badges">
            <span class="badge-detail badge-detail-mandatory">
                ${subject.is_mandatory ? 'إجبارية' : 'اختيارية'}
            </span>
            <span class="badge-detail ${subject.is_active ? 'badge-detail-active' : 'badge-detail-inactive'}">
                ${subject.is_active ? 'فعالة' : 'متوقفة'}
            </span>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button id="btnEditSubjectCard" onclick="window.selectSubjectToEdit('${escapeHtml(subject.code)}')" class="btn-card-edit" style="width: 100%;">
                <span class="material-symbols-outlined">edit_note</span> تعديل المادة
            </button>
        </div>
    `;
    
    if (container.style.display !== 'block') {
        container.style.display = 'block';
        container.offsetHeight;
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }
}

// ============================================================
// إخفاء بطاقة تفاصيل المادة
// ============================================================
function hideSelectedSubjectCard() {
    const container = document.getElementById('selectedSubjectCardContainer');
    if (!container) return;
    
    if (container.style.display === 'block') {
        container.style.opacity = '0';
        container.style.transform = 'translateY(15px)';
        
        const transitionHandler = function() {
            container.style.display = 'none';
            container.removeEventListener('transitionend', transitionHandler);
        };
        container.addEventListener('transitionend', transitionHandler);
    }
}

// ============================================================
// البحث السريع (Autocomplete) للمواد
// ============================================================
function initAutocomplete() {
    const searchInput = document.getElementById('searchSubject');
    const resultsContainer = document.getElementById('autocompleteResults');
    
    if (!searchInput || !resultsContainer) return;
    
    searchInput.addEventListener('input', function() {
        const query = this.value.trim().toLowerCase();
        
        // ⚡ تصفية جدول المواد والخطط فورياً أثناء الكتابة
        loadPlanData(currentPlan, query);

        if (!query) {
            resultsContainer.classList.add('hidden');
            resultsContainer.innerHTML = '';
            return;
        }
        
        const matches = mockSubjects.filter(c => 
            (c.name && c.name.toLowerCase().includes(query)) || 
            (c.code && c.code.toLowerCase().includes(query)) ||
            (c.department_name && c.department_name.toLowerCase().includes(query))
        );
        
        if (matches.length === 0) {
            resultsContainer.innerHTML = '<div class="autocomplete-item" style="color: #94a3b8; cursor: default; padding: 10px;">لا توجد مواد مطابقة</div>';
            resultsContainer.classList.remove('hidden');
            return;
        }
        
        resultsContainer.innerHTML = matches.map(c => `
            <div class="autocomplete-item" onclick="window.selectSubjectToEdit('${escapeHtml(c.code)}', ${c.id})" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                <strong>${escapeHtml(c.name)}</strong> <span style="font-size: 0.75rem; color: #64748b; margin-right: 5px;">(${escapeHtml(c.code)})</span>
                <span style="font-size: 0.7rem; color: #2563eb; margin-right: 10px;">${escapeHtml(c.department_name || 'عام')}</span>
                <span style="font-size: 0.7rem; color: #94a3b8; margin-right: 10px;">المستوى ${c.level_number}</span>
            </div>
        `).join('');
        
        resultsContainer.classList.remove('hidden');
    });
    
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.add('hidden');
        }
    });
}

// ============================================================
// اختيار مادة وتعبئة بياناتها في النموذج
// ============================================================
function selectSubjectToEdit(code, id = null) {
    console.log(`✏️ Loading subject into form: ${code} (ID: ${id})`);
    
    let subject = null;
    if (id) {
        subject = mockSubjects.find(c => c.id == id);
    }
    if (!subject) {
        subject = mockSubjects.find(c => c.code === code);
    }
    if (!subject) return;
    
    currentSelectedCourseId = subject.id;
    
    const nameInput = document.getElementById('subjectName');
    const majorSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('subjectLevelSelect');
    
    if (nameInput) nameInput.value = subject.name;
    const targetDeptIds = subject.department_ids && subject.department_ids.length > 0 
        ? subject.department_ids 
        : (subject.department_id ? [subject.department_id] : []);
    if (window.setSelectedDepartmentIds) {
        window.setSelectedDepartmentIds(targetDeptIds);
    } else if (majorSelect) {
        majorSelect.value = subject.department_id;
    }
    if (levelSelect) levelSelect.value = subject.level_id;
    
    const prereqInput = document.getElementById('prerequisite');
    const creditHoursSelect = document.getElementById('creditHours');
    const statusSelect = document.getElementById('subjectStatus');
    const typeSelect = document.getElementById('subjectType');
    const codeInput = document.getElementById('subjectCode');
    const plan1Cb = document.getElementById('plan1Checkbox');
    const plan2Cb = document.getElementById('plan2Checkbox');
    
    if (prereqInput) {
        if (subject.prerequisite) {
            const found = mockSubjects.find(c => c.code === subject.prerequisite);
            prereqInput.value = found ? `${found.code} - ${found.name}` : subject.prerequisite;
            prereqInput.dataset.prereqId = subject.prerequisite_id || '';
            prereqInput.dataset.prereqCode = subject.prerequisite || '';
        } else {
            prereqInput.value = '';
            prereqInput.dataset.prereqId = '';
            prereqInput.dataset.prereqCode = '';
        }
    }
    
    if (creditHoursSelect) creditHoursSelect.value = subject.credits || '';
    if (statusSelect) statusSelect.value = subject.is_active ? 'active' : 'inactive';
    if (typeSelect) typeSelect.value = subject.is_mandatory ? 'mandatory' : 'elective';
    if (codeInput) codeInput.value = subject.code;
    
    // تعبئة مربعات اختيار الخطة الدراسية
    const planCheckboxes = document.querySelectorAll('input[name="study_plan_checkbox"]');
    const coursePlans = subject.plans || (subject.study_plan_id ? [subject.study_plan_id] : [1]);
    planCheckboxes.forEach(cb => {
        cb.checked = coursePlans.includes(parseInt(cb.value));
    });
    
    const descArea = document.getElementById('descArea');
    if (descArea) descArea.classList.remove('hidden');
    
    const resultsContainer = document.getElementById('autocompleteResults');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    
    const searchInput = document.getElementById('searchSubject');
    if (searchInput) searchInput.value = '';
    
    showSelectedSubjectCard(subject);
    showToastMessage(`✅ تم تحميل مادة: ${subject.name}`, false);
    
    document.getElementById('subjectName')?.focus();
}

// ============================================================
// حفظ بيانات المادة (النسخة المعدلة)
// ============================================================
function saveSubjectData() {
    console.log('💾 saveSubjectData called');
    
    const name = document.getElementById('subjectName')?.value.trim() || '';
    const code = document.getElementById('subjectCode')?.value.trim() || '';
    const credits = document.getElementById('creditHours')?.value || '';
    const deptIds = window.getSelectedDepartmentIds ? window.getSelectedDepartmentIds() : [];
    const departmentId = deptIds.length > 0 ? deptIds[0] : (document.getElementById('majorSelect')?.value || '');
    const levelId = document.getElementById('subjectLevelSelect')?.value || '';
    const status = document.getElementById('subjectStatus')?.value || '';
    const type = document.getElementById('subjectType')?.value || '';
    const prerequisiteInput = document.getElementById('prerequisite');
    const prerequisiteId = prerequisiteInput?.dataset?.prereqId || null;
    
    const selectedPlans = Array.from(document.querySelectorAll('input[name="study_plan_checkbox"]:checked')).map(cb => parseInt(cb.value));
    
    // 🔥 التحقق من الحقول المطلوبة
    if (!name) {
        showToastMessage('⚠️ الرجاء إدخال اسم المادة', true);
        document.getElementById('subjectName')?.focus();
        return;
    }
    
    if (!code) {
        showToastMessage('⚠️ الرجاء إدخال رمز المادة', true);
        document.getElementById('subjectCode')?.focus();
        return;
    }
    
    if (deptIds.length === 0 && !departmentId) {
        showToastMessage('⚠️ الرجاء اختيار تخصص واحد على الأقل', true);
        document.getElementById('majorSelectDropdownBtn')?.focus();
        return;
    }
    
    if (!credits) {
        showToastMessage('⚠️ الرجاء اختيار عدد الساعات', true);
        document.getElementById('creditHours')?.focus();
        return;
    }
    
    if (!levelId) {
        showToastMessage('⚠️ الرجاء اختيار المستوى الدراسي', true);
        document.getElementById('subjectLevelSelect')?.focus();
        return;
    }
    
    let prerequisite_ids = [];
    if (prerequisiteId) {
        prerequisite_ids.push(parseInt(prerequisiteId));
    }
    
    const study_plan_id = selectedPlans.length > 0 ? selectedPlans[0] : 1;
    
    // 🔥 تجهيز البيانات
    const subjectData = {
        name: name,
        code: code.toUpperCase(),
        credits: parseInt(credits),
        theoretical_hours: parseInt(credits) || 3,
        practical_hours: 0,
        department_id: parseInt(departmentId),
        department_ids: deptIds,
        study_plan_id: study_plan_id,
        plans: selectedPlans,
        level_id: parseInt(levelId),
        is_active: status === 'active',
        is_mandatory: type === 'mandatory',
        prerequisite_ids: prerequisite_ids
    };
    
    // 🔥 التحقق من وجود المادة للتحديث أو إنشائها لقسم آخر
    let existingSubject = null;
    if (currentSelectedCourseId) {
        existingSubject = mockSubjects.find(c => c.id === currentSelectedCourseId);
    } else {
        // فحص وجود مادة بنفس الرمز ونفس القسم المحدد فقط
        existingSubject = mockSubjects.find(c => c.code.toUpperCase() === subjectData.code && c.department_id === subjectData.department_id);
    }

    let url;
    if (existingSubject) {
        url = `/renewal/api/courses/update/${existingSubject.id}/`;
        console.log('📤 Updating existing subject:', existingSubject.id);
    } else {
        url = '/renewal/api/courses/create/';
        console.log('📤 Creating new subject for department:', subjectData.department_id);
    }
    
    // 🔥🔥🔥 طباعة البيانات للتأكد
    console.log('📤 Sending course data:', JSON.stringify(subjectData, null, 2));
    console.log('📤 To URL:', url);
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(subjectData)
    })
    .then(response => {
        console.log('📥 Response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('📥 Server response:', data);
        if (data.success) {
            showToastMessage(data.message || '✅ تم حفظ المادة بنجاح', false);
            loadSubjects(); // إعادة تحميل المواد
            
            const displayData = (data.course && data.course.name) ? data.course : {
                id: existingSubject ? existingSubject.id : null,
                name: name,
                code: code.toUpperCase(),
                credits: parseInt(credits),
                department_id: parseInt(departmentId),
                department_ids: deptIds,
                department_name: window.getSelectedDepartmentIds ? 
                    Array.from(document.querySelectorAll('input[name="department_checkbox"]:checked')).map(cb => cb.getAttribute('data-name') || cb.value).join(' ، ') : '',
                level_id: parseInt(levelId),
                level_number: parseInt(levelId),
                is_active: status === 'active',
                is_mandatory: type === 'mandatory',
                prerequisite: prerequisiteInput?.value || null,
                plans: selectedPlans
            };
            showSelectedSubjectCard(displayData);
        } else {
            showToastMessage(data.error || '❌ حدث خطأ أثناء الحفظ', true);
        }
    })
    .catch(err => {
        console.error('❌ Fetch error:', err);
        showToastMessage('❌ حدث خطأ في الاتصال بالخادم', true);
    });
}

// ============================================================
// مسح النموذج بالكامل
// ============================================================
function clearSubjectForm() {
    console.log('🧹 clearSubjectForm called');
    
    const fields = ['subjectName', 'majorSelect', 'subjectLevelSelect', 'prerequisite', 
                    'creditHours', 'subjectStatus', 'subjectType', 'subjectCode'];
    
    fields.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            if (element.dataset) {
                element.dataset.prereqId = '';
                element.dataset.prereqCode = '';
            }
        }
    });
    
    if (window.setSelectedDepartmentIds) {
        window.setSelectedDepartmentIds([]);
    }
    
    const planCheckboxes = document.querySelectorAll('input[name="study_plan_checkbox"]');
    planCheckboxes.forEach(cb => cb.checked = false);
    
    const descArea = document.getElementById('descArea');
    if (descArea) descArea.classList.add('hidden');
    
    const searchInput = document.getElementById('searchSubject');
    if (searchInput) searchInput.value = '';
    
    currentSelectedCourseId = null;
    hideSelectedSubjectCard();
    showToastMessage('🧹 تم مسح النموذج', false);
}

// ============================================================
// تعديل البيانات
// ============================================================
function editSubjectData() {
    console.log('✏️ editSubjectData called');
    
    const code = document.getElementById('subjectCode')?.value || '';
    if (!code) {
        const searchInput = document.getElementById('searchSubject');
        if (searchInput) {
            searchInput.focus();
            showToastMessage('🔍 ابحث عن المادة في حقل البحث للتعديل', false);
        }
        return;
    }
    
    showToastMessage('✏️ يمكنك الآن تعديل بيانات المادة', false);
    document.getElementById('subjectName')?.focus();
}

// ============================================================
// حذف مادة دراسية
// ============================================================
function deleteSubject(id) {
    if (!id || id === 'null') {
        showToastMessage('⚠️ الرجاء حفظ المادة أولاً لتتمكن من حذفها', true);
        return;
    }
    if (!confirm('⚠️ هل أنت متأكد من رغبتك في حذف هذه المادة نهائياً؟')) return;

    fetch(`/renewal/api/courses/delete/${id}/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToastMessage(data.message || '✅ تم حذف المادة بنجاح', false);
            loadSubjects();
            clearSubjectForm();
        } else {
            showToastMessage(data.error || '❌ فشل حذف المادة', true);
        }
    })
    .catch(err => {
        console.error(err);
        showToastMessage('❌ حدث خطأ في الاتصال بالخادم', true);
    });
}

// ============================================================
// فتح الخطة الدراسية والتنقل التفاعلي
// ============================================================
function openPlan(plan) {
    console.log(`📖 openPlan called with plan: ${plan}`);
    
    currentPlan = parseInt(plan) || 1;
    
    const plan1Btns = document.querySelectorAll('.plan-btn-1');
    const plan2Btns = document.querySelectorAll('.plan-btn-2');
    
    if (currentPlan === 1) {
        plan1Btns.forEach(btn => btn.classList.add('active'));
        plan2Btns.forEach(btn => btn.classList.remove('active'));
    } else {
        plan2Btns.forEach(btn => btn.classList.add('active'));
        plan1Btns.forEach(btn => btn.classList.remove('active'));
    }
    
    const planTitle = document.getElementById('planTitle');
    if (planTitle) {
        planTitle.innerHTML = `جدول المواد الدراسية حسب المستويات — <span style="color: #307e92; font-weight: 800;">خطة دراسية (${currentPlan})</span>`;
    }
    
    loadPlanData(currentPlan);
    
    // التمرير السلس إلى جدول المواد
    const planPage = document.getElementById('planPage');
    if (planPage) {
        planPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================================
// إغلاق الخطة الدراسية
// ============================================================
function closePlan() {
    console.log('🔙 closePlan called');
    const mainInterface = document.getElementById('mainInterface');
    if (mainInterface) {
        mainInterface.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================================
// تحميل بيانات الخطة الدراسية
// ============================================================
function loadPlanData(plan, searchQuery = '') {
    console.log(`📚 Loading plan ${plan} data (search: "${searchQuery}")...`);
    
    const grid = document.getElementById('planGrid');
    if (!grid) return;
    
    const query = (searchQuery || '').trim().toLowerCase();
    const planNum = parseInt(plan) || 1;
    
    const levels = [];
    for (let l = 1; l <= 8; l++) {
        let levelCourses = mockSubjects.filter(c => {
            const matchesLevel = parseInt(c.level_number) === l;
            const matchesPlan = !c.plans || c.plans.length === 0 || c.plans.includes(planNum) || c.study_plan_id === planNum || c.study_plan_id == null;
            return matchesLevel && matchesPlan;
        });
        
        if (query) {
            levelCourses = levelCourses.filter(c => 
                (c.name && c.name.toLowerCase().includes(query)) || 
                (c.code && c.code.toLowerCase().includes(query)) ||
                (c.department_name && c.department_name.toLowerCase().includes(query))
            );
        }
        levels.push({
            level: l,
            courses: levelCourses
        });
    }
    
    grid.innerHTML = levels.map(level => `
        <div class="semester-card">
            <div class="semester-card-header">المستوى ${level.level} (${level.courses.length} مادة)</div>
            <div class="semester-card-body">
                <table class="semester-table">
                    <thead>
                        <tr>
                            <th style="width: 30%;">الرمز</th>
                            <th style="width: 45%;">المادة</th>
                            <th style="width: 25%;">التخصص</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${level.courses.map(course => `
                            <tr style="cursor: pointer;" onclick="window.selectSubjectToEdit('${escapeHtml(course.code)}', ${course.id})">
                                <td style="font-weight: 700;">${escapeHtml(course.code)}</td>
                                <td>${escapeHtml(course.name)}</td>
                                <td><span style="font-size: 0.75rem; color: #2563eb; font-weight: 600;">${escapeHtml(course.department_name || 'عام')}</span></td>
                            </tr>
                        `).join('')}
                        ${level.courses.length === 0 ? `
                            <tr>
                                <td colspan="3" style="color: #94a3b8; font-size: 0.75rem; padding: 1.5rem 0;">لا توجد مواد مطابقة</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');
}

// ============================================================
// اختيار مادة من الخطة
// ============================================================
function selectCourse(courseName, courseCode) {
    console.log(`📖 selectCourse: ${courseName} (${courseCode})`);
    window.selectSubjectToEdit(courseCode);
}

// ============================================================
// رجوع للصفحة السابقة
// ============================================================
function goBack() {
    console.log('🔙 goBack called');
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

// ============================================================
// تهيئة الصفحة - معدلة ومحمية
// ============================================================
function init() {
    console.log('🚀 Initializing subject data page...');
    
    try {
        loadDepartments();
        loadSubjects();
        initAutocomplete();
        initPrerequisiteAutocomplete();
    } catch (error) {
        console.error('❌ Error in initialization:', error);
    }
    
    // حدث Enter على حقل اسم المادة
    const subjectName = document.getElementById('subjectName');
    if (subjectName) {
        subjectName.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                showDescription();
            }
        });
    }
    
    // تحديث قائمة المتطلبات السابقة عند تغيير التخصص أو المستوى
    const majorSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('subjectLevelSelect');
    
    if (majorSelect) {
        majorSelect.addEventListener('change', function() {
            const prereq = document.getElementById('prerequisite');
            if (prereq) {
                prereq.value = '';
                prereq.dataset.prereqId = '';
                prereq.dataset.prereqCode = '';
            }
        });
    }
    
    if (levelSelect) {
        levelSelect.addEventListener('change', function() {
            handleLevelPrerequisiteState();
        });
        // فحص الحالة المبدئية عند التحميل
        handleLevelPrerequisiteState();
    }
}

// ============================================================
// ربط الدوال بالـ Window (مرة واحدة فقط)
// ============================================================
window.loadDepartments = loadDepartments;
window.showDescription = showDescription;
window.saveSubjectData = saveSubjectData;
window.clearSubjectForm = clearSubjectForm;
window.editSubjectData = editSubjectData;
window.deleteSubject = deleteSubject;
window.openPlan = openPlan;
window.closePlan = closePlan;
window.selectCourse = selectCourse;
window.selectSubjectToEdit = selectSubjectToEdit;
window.selectPrerequisite = selectPrerequisite;
window.goBack = goBack;
window.showToastMessage = showToastMessage;

// تهيئة عند اكتمال تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('✅ All functions registered in window scope');