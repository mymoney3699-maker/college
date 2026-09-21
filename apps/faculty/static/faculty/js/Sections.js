/**
 * ============================================================
 * إدارة الأقسام - Sections Management
 * sections.js  v2.1.0 - مع نظام الإشعارات العائمة الفورية (showNotification) وتحديث AJAX
 * ============================================================
 */

console.log('✅ sections.js loaded');

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
    
    // Explicitly enforce dark or light card background & text color
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
    }, 3800);
}

window.showNotification = showNotification;

function departmentManager() {
    return {
        courses: [],
        levels: [],
        groups: [],
        departments: [],
        departmentsData: {},
        selectedDept: '',
        addType: 'professor',
        editId: null,
        isLoading: false,
        editProfessorAssignments: [], // 🔥 قائمة تكليفات الأستاذ في وضع التعديل
        showDeleteConfirmModal: false,
        deletePendingAssignmentId: null,
        deletePendingIndex: null,
        deleteConfirmMessage: '',
        
        newProfessor: { 
            name: '', 
            email: '', 
            subjects: [{ department_id: '', level_id: '', course_id: '', group_id: '' }] 
        },
        newStaff: { name: '', email: '', role: '' },
        coordinatorSelectedProfId: '', // 🛡️ معرف الأستاذ المختار للمنسق

        init() {
            console.log('🚀 Sections Management initialized');
            
            // جلب البيانات من الـ HTML
            const coursesEl = document.getElementById('courses-data');
            const levelsEl = document.getElementById('levels-data');
            const groupsEl = document.getElementById('groups-data');
            const departmentsEl = document.getElementById('departments-data');
            
            // تحميل المواد
            if (coursesEl && coursesEl.textContent) {
                try {
                    this.courses = JSON.parse(coursesEl.textContent);
                    console.log('✅ Courses loaded:', this.courses.length);
                } catch(e) {
                    console.error('❌ Error parsing courses:', e);
                    this.courses = [];
                }
            } else {
                console.warn('⚠️ No courses-data element found');
                this.courses = [];
            }
            
            // تحميل المستويات
            if (levelsEl && levelsEl.textContent) {
                try {
                    this.levels = JSON.parse(levelsEl.textContent);
                    console.log('✅ Levels loaded:', this.levels.length);
                } catch(e) {
                    console.error('❌ Error parsing levels:', e);
                    this.levels = [];
                }
            } else {
                console.warn('⚠️ No levels-data element found');
                this.levels = [];
            }
            
            // تحميل المجموعات
            if (groupsEl && groupsEl.textContent) {
                try {
                    this.groups = JSON.parse(groupsEl.textContent);
                    console.log('✅ Groups loaded:', this.groups.length);
                } catch(e) {
                    console.error('❌ Error parsing groups:', e);
                    this.groups = [];
                }
            } else {
                console.warn('⚠️ No groups-data element found');
                this.groups = [];
            }
            
            // تحميل الأقسام
            if (departmentsEl && departmentsEl.textContent) {
                try {
                    this.departments = JSON.parse(departmentsEl.textContent);
                    console.log('✅ Departments loaded:', this.departments.length);
                    
                    if (this.departments.length > 0) {
                        // بناء كائن الأقسام
                        this.departmentsData = {};
                        this.departments.forEach(dept => {
                            this.departmentsData[dept.id] = {
                                id: dept.id,
                                name: dept.name,
                                code: dept.code,
                                professors: [],
                                staff: []
                            };
                        });
                        
                        // عدم اختيار قسم تلقائياً والبدء بـ "-- كل الأقسام --"
                        this.selectedDept = '';
                        console.log('✅ Default state: All departments');
                    } else {
                        console.warn('⚠️ No departments found in database');
                    }
                } catch(e) {
                    console.error('❌ Error parsing departments:', e);
                    this.departments = [];
                    this.departmentsData = {};
                }
            } else {
                console.warn('⚠️ No departments-data element found');
                this.departments = [];
                this.departmentsData = {};
            }

            // 🔥 فحص وتطبيق حالة صلاحيات الوظائف للأستاذ والموظف
            this.updateJobPermissionState();
        },

        // ============================================================
        // 🔔 دمج دالة الإشعارات الفورية
        // ============================================================
        showNotification(type, message) {
            window.showNotification(type, message);
        },

        showToast(msg, isError = false) {
            this.showNotification(isError ? 'error' : 'success', msg);
        },

        async loadDepartmentData(deptId) {
            if (!deptId) return;
            
            this.isLoading = true;
            try {
                const url = `/faculty/api/department/${deptId}/`;
                console.log('🔄 Loading department data from:', url);
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.success) {
                    this.departmentsData[deptId] = {
                        ...this.departmentsData[deptId],
                        professors: data.department.professors || [],
                        staff: data.department.staff || []
                    };
                    console.log(`✅ Department data loaded for: ${deptId} (${this.departmentsData[deptId].professors.length} professors, ${this.departmentsData[deptId].staff.length} staff)`);
                } else {
                    console.error('❌ API returned error:', data.message);
                }
            } catch (error) {
                console.error('❌ Error loading department data:', error);
            }
            this.isLoading = false;
        },

        onDeptChange() {
            console.log('🔄 Department changed to:', this.selectedDept);
            if (this.selectedDept) {
                this.loadDepartmentData(this.selectedDept);
                if (this.newProfessor && this.newProfessor.subjects && this.newProfessor.subjects[0]) {
                    this.newProfessor.subjects[0].department_id = this.selectedDept;
                }
            }
            // إعادة تعيين المنسق
            this.coordinatorSelectedProfId = '';
            this.cancelEditInForm();
        },

        // 🛡️ عند اختيار أستاذ من قائمة المنسق - تحميل بياناته مباشرة
        async onCoordinatorProfSelect() {
            const profId = this.coordinatorSelectedProfId;
            if (!profId) {
                this.cancelEditInForm();
                return;
            }
            await this.startEditInForm('professor', profId);
        },

        getInitials(name) {
            if (!name) return '';
            return name.split(' ').map(w => w[0]).slice(0, 2).join('');
        },

        getActiveProfessors() {
            if (!this.selectedDept || !this.departmentsData[this.selectedDept]) return [];
            return this.departmentsData[this.selectedDept].professors?.filter(p => !p.disabled) || [];
        },

        getActiveStaff() {
            if (!this.selectedDept || !this.departmentsData[this.selectedDept]) return [];
            return this.departmentsData[this.selectedDept].staff?.filter(s => !s.disabled) || [];
        },

        switchTab(tabName) {
            if (this.editId !== null) {
                this.cancelEditInForm();
            }
            this.addType = tabName;
        },

        formatSubjects(subjects) {
            if (!subjects || subjects.length === 0) return 'لا يوجد مواد مسندة';
            
            return subjects.map(s => {
                const course = this.courses.find(c => c.id === s.course_id);
                const level = this.levels.find(l => l.id === s.level_id);
                const group = this.groups.find(g => g.id === s.group_id);
                
                const courseName = s.course_name || (course ? course.name : 'غير محدد');
                const levelName = s.level_name || (level ? `مستوى ${level.number}` : '');
                const groupName = s.group_name || (group ? group.name : '');
                
                return `${courseName} (${levelName} - ${groupName})`;
            }).join(' | ');
        },

        getFilteredCourses(subject) {
            if (!this.courses || this.courses.length === 0) return [];
            const deptId = subject && subject.department_id ? Number(subject.department_id) : (this.selectedDept ? Number(this.selectedDept) : null);
            const levelId = subject && subject.level_id ? Number(subject.level_id) : null;

            return this.courses.filter(course => {
                // فحص التخصص
                if (deptId) {
                    const hasDept = (course.department_ids && course.department_ids.includes(deptId)) ||
                                    (course.department_id && Number(course.department_id) === deptId);
                    if (!hasDept) return false;
                }
                // فحص المستوى
                if (levelId) {
                    const matchLevel = (course.level_id && Number(course.level_id) === levelId) ||
                                       (course.level_number && Number(course.level_number) === levelId);
                    if (!matchLevel) return false;
                }
                return true;
            });
        },

        getFilteredGroups(subject) {
            if (!this.groups || this.groups.length === 0) return [];
            const deptId = subject && subject.department_id ? Number(subject.department_id) : (this.selectedDept ? Number(this.selectedDept) : null);
            const levelId = subject && subject.level_id ? Number(subject.level_id) : null;
            const activeYear = String(window.ACTIVE_ACADEMIC_YEAR || '').trim();
            const activeSemType = String(window.ACTIVE_SEMESTER_TYPE || '').trim();

            let filtered = this.groups;

            // فلترة حسب القسم
            if (deptId) {
                filtered = filtered.filter(g => g.department_id && Number(g.department_id) === deptId);
            }

            // فلترة حسب المستوى
            if (levelId) {
                filtered = filtered.filter(g => g.level_id && Number(g.level_id) === levelId);
            }

            // 🔥 قصر المجموعات حصرياً على السنة الدراسية المفعلة في النظام
            if (activeYear) {
                const yearMatched = filtered.filter(g => String(g.academic_year || '').trim() === activeYear);
                if (yearMatched.length > 0) {
                    if (activeSemType) {
                        const semMatched = yearMatched.filter(g => String(g.semester || '').trim() === activeSemType);
                        if (semMatched.length > 0) return semMatched;
                    }
                    return yearMatched;
                }
            }

            return filtered;
        },

        onSubjectDeptChange(index) {
            const subj = this.newProfessor.subjects[index];
            if (!subj) return;
            const validCourses = this.getFilteredCourses(subj);
            if (subj.course_id && !validCourses.some(c => String(c.id) === String(subj.course_id))) {
                subj.course_id = '';
            }
            const validGroups = this.getFilteredGroups(subj);
            if (subj.group_id && !validGroups.some(g => String(g.id) === String(subj.group_id))) {
                subj.group_id = '';
            }
        },

        onSubjectLevelChange(index) {
            const subj = this.newProfessor.subjects[index];
            if (!subj) return;
            const validCourses = this.getFilteredCourses(subj);
            if (subj.course_id && !validCourses.some(c => String(c.id) === String(subj.course_id))) {
                subj.course_id = '';
            }
            const validGroups = this.getFilteredGroups(subj);
            if (subj.group_id && !validGroups.some(g => String(g.id) === String(subj.group_id))) {
                subj.group_id = '';
            }
        },

        onCourseSelect(index) {
            const subj = this.newProfessor.subjects[index];
            if (!subj || !subj.course_id) return;

            const course = this.courses.find(c => String(c.id) === String(subj.course_id));
            if (course) {
                if (!subj.level_id && course.level_id) {
                    subj.level_id = course.level_id;
                }
                if (!subj.department_id && course.department_ids && course.department_ids.length > 0) {
                    subj.department_id = course.department_ids.includes(Number(this.selectedDept))
                        ? this.selectedDept
                        : course.department_ids[0];
                }
            }

            const validGroups = this.getFilteredGroups(subj);
            if (validGroups.length > 0 && !subj.group_id) {
                subj.group_id = validGroups[0].id;
            }
        },

        addSubject() {
            const isInstructorOpen = (typeof window.IS_ADD_INSTRUCTOR_OPEN !== 'undefined') ? Boolean(window.IS_ADD_INSTRUCTOR_OPEN) : false;
            if (!isInstructorOpen && this.editId === null) {
                this.showNotification('warning', window.ADD_INSTRUCTOR_MESSAGE || '⚠️ عذراً، خدمة إسناد وإضافة المواد موقوفة حالياً في جدول الوظائف.');
                return;
            }
            this.newProfessor.subjects.push({
                department_id: this.selectedDept || '',
                level_id: '',
                course_id: '',
                group_id: ''
            });
        },

        removeSubject(index) {
            this.newProfessor.subjects.splice(index, 1);
            if (this.newProfessor.subjects.length === 0) {
                this.newProfessor.subjects.push({
                    department_id: this.selectedDept || '',
                    level_id: '',
                    course_id: '',
                    group_id: ''
                });
            }
        },

        // ============================================================
        // ➕ إضافة أستاذ جديد عبر AJAX مع التنبيهات الفورية
        // ============================================================
        async addProfessor() {
            // 🛡️ حجب للمنسق - لا يحق له إنشاء أستاذ جديد
            if (window.IS_COORDINATOR) {
                this.showNotification('error', '⛔ صلاحية إنشاء أستاذ جديد غير متاحة للمنسق. اختر أستاذًا موجودًا من القائمة.');
                return;
            }
            if (!this.selectedDept) {
                this.showNotification('warning', 'الرجاء اختيار القسم أولاً');
                return;
            }

            const isInstructorOpen = (typeof window.IS_ADD_INSTRUCTOR_OPEN !== 'undefined') ? Boolean(window.IS_ADD_INSTRUCTOR_OPEN) : false;
            if (!isInstructorOpen && this.editId === null) {
                this.showNotification('warning', window.ADD_INSTRUCTOR_MESSAGE || '⚠️ عذراً، خدمة إضافة أستاذ جديد غير مفعلة حالياً في جدول الوظائف.');
                return;
            }

            const name = this.newProfessor.name.trim();
            if (!name) {
                this.showNotification('error', 'الرجاء إدخال اسم الأستاذ');
                return;
            }

            const validSubjects = [];
            for (const subj of this.newProfessor.subjects) {
                if (subj.course_id) {
                    let levelId = subj.level_id;
                    let groupId = subj.group_id;

                    if (!levelId) {
                        const course = this.courses.find(c => String(c.id) === String(subj.course_id));
                        if (course && course.level_id) levelId = course.level_id;
                        else if (this.levels.length > 0) levelId = this.levels[0].id;
                    }
                    if (!groupId) {
                        const filteredG = this.getFilteredGroups(subj);
                        if (filteredG.length > 0) groupId = filteredG[0].id;
                        else if (this.groups.length > 0) groupId = this.groups[0].id;
                    }

                    if (levelId && groupId) {
                        validSubjects.push({
                            course_id: subj.course_id,
                            level_id: levelId,
                            group_id: groupId,
                            department_id: subj.department_id || this.selectedDept
                        });
                    }
                }
            }

            try {
                const response = await fetch('/faculty/api/professor/save/', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCsrfToken()
                    },
                    body: JSON.stringify({
                        name: name,
                        email: this.newProfessor.email.trim(),
                        department_id: this.selectedDept,
                        subjects: validSubjects
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    let successMsg = `✅ تم إضافة الأستاذ (${name}) بنجاح`;
                    if (validSubjects.length > 0) {
                        successMsg += ` مع إسناد ${validSubjects.length} مادة دراسية.`;
                    }
                    this.showNotification('success', data.message || successMsg);
                    this.newProfessor = { name: '', email: '', subjects: [{ course_id: '', level_id: '', group_id: '' }] };
                    await this.loadDepartmentData(this.selectedDept);
                } else {
                    this.showNotification('error', data.message || 'حدث خطأ أثناء إضافة الأستاذ');
                }
            } catch (error) {
                this.showNotification('error', '❌ فشل الاتصال بالخادم أثناء إضافة الأستاذ');
                console.error(error);
            }
        },

        // ============================================================
        // ➕ إضافة موظف جديد عبر AJAX مع التنبيهات الفورية
        // ============================================================
        async addStaff() {
            // 🛡️ حجب للمنسق - لا يحق له إضافة موظف جديد
            if (window.IS_COORDINATOR) {
                this.showNotification('error', '⛔ صلاحية إضافة موظف جديد غير متاحة للمنسق.');
                return;
            }
            if (!this.selectedDept) {
                this.showNotification('warning', 'الرجاء اختيار القسم أولاً');
                return;
            }

            const isStaffOpen = (typeof window.IS_ADD_STAFF_OPEN !== 'undefined') ? Boolean(window.IS_ADD_STAFF_OPEN) : false;
            if (!isStaffOpen && this.editId === null) {
                this.showNotification('warning', window.ADD_STAFF_MESSAGE || '⚠️ عذراً، خدمة إضافة موظف جديد غير مفعلة حالياً في جدول الوظائف.');
                return;
            }

            const name = this.newStaff.name.trim();
            const role = this.newStaff.role.trim();

            if (!name || !role) {
                this.showNotification('error', 'الرجاء إدخال اسم الموظف والمسمى الوظيفي');
                return;
            }

            try {
                const response = await fetch('/faculty/api/staff/save/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCsrfToken()
                    },
                    body: JSON.stringify({
                        name: name,
                        email: this.newStaff.email.trim(),
                        role: role,
                        department_id: this.selectedDept
                    })
                });

                const data = await response.json();
                if (data.success) {
                    this.showNotification('success', data.message || `✅ تم إضافة الموظف (${name}) بنجاح`);
                    this.newStaff = { name: '', email: '', role: '' };
                    await this.loadDepartmentData(this.selectedDept);
                } else {
                    this.showNotification('error', data.message || 'حدث خطأ أثناء إضافة الموظف');
                }
            } catch (error) {
                console.error('❌ Error adding staff:', error);
                this.showNotification('error', '❌ فشل الاتصال بالخادم أثناء إضافة الموظف');
            }
        },

        // ============================================================
        // 🔄 تفعيل / تعطيل عضو هيئة تدريس أو موظف
        // ============================================================
        async togglePerson(type, id) {
            if (!this.selectedDept) return;
            
            if (type === 'professor') {
                try {
                    const response = await fetch(`/faculty/api/professor/${id}/toggle/`, {
                        method: 'POST',
                        headers: { 
                            'X-CSRFToken': this.getCsrfToken(),
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    });
                    
                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        this.showNotification('error', errData.message || `❌ حدث خطأ (${response.status}) أثناء تغيير حالة الأستاذ`);
                        return;
                    }

                    const data = await response.json();
                    if (data.success || data.status === 'success') {
                        const list = this.departmentsData[this.selectedDept]?.professors || [];
                        const item = list.find(p => String(p.id) === String(id));
                        if (item) {
                            item.disabled = !item.disabled;
                        }
                        this.showNotification('success', data.message || 'تم تحديث حالة الأستاذ بنجاح');
                    } else {
                        this.showNotification('error', data.message || 'حدث خطأ في تغيير الحالة');
                    }
                } catch (error) {
                    this.showNotification('error', '❌ حدث خطأ في الاتصال أثناء تغيير حالة الأستاذ');
                    console.error('Error toggling professor:', error);
                }
            } else {
                try {
                    const response = await fetch(`/faculty/api/staff/${id}/toggle/`, {
                        method: 'POST',
                        headers: { 
                            'X-CSRFToken': this.getCsrfToken(),
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        this.showNotification('error', errData.message || `❌ حدث خطأ (${response.status}) أثناء تغيير حالة الموظف`);
                        return;
                    }

                    const data = await response.json();
                    if (data.success || data.status === 'success') {
                        const list = this.departmentsData[this.selectedDept]?.staff || [];
                        const item = list.find(s => String(s.id) === String(id));
                        if (item) {
                            item.disabled = !item.disabled;
                        }
                        this.showNotification('success', data.message || 'تم تحديث حالة الموظف بنجاح');
                    } else {
                        this.showNotification('error', data.message || 'حدث خطأ في تغيير الحالة');
                    }
                } catch (error) {
                    this.showNotification('error', '❌ حدث خطأ في الاتصال أثناء تغيير حالة الموظف');
                    console.error('Error toggling staff:', error);
                }
            }
        },

        // ============================================================
        // 🔥 دوال إدارة تكليفات الأستاذ وتعديل الموظفين
        // ============================================================
        async startEditInForm(type, id) {
            if (!this.selectedDept) return;
            
            if (type === 'professor') {
                try {
                    this.isLoading = true;
                    const response = await fetch(`/faculty/api/professor/${id}/details/`);
                    const data = await response.json();
                    
                    if (data.success) {
                        const prof = data.professor;
                        
                        this.newProfessor = {
                            name: prof.name,
                            email: prof.email || '',
                            subjects: [{ department_id: this.selectedDept || '', level_id: '', course_id: '', group_id: '' }]
                        };
                        
                        this.editProfessorAssignments = prof.assigned_courses || [];
                        this.editId = id;
                        this.addType = 'professor';
                        
                        console.log(`✅ تم تحميل بيانات الأستاذ ${prof.name} مع ${this.editProfessorAssignments.length} تكليف`);
                        this.showNotification('info', `جاري تعديل بيانات الأستاذ (${prof.name})`);
                    } else {
                        this.showNotification('error', data.message || 'حدث خطأ في جلب بيانات الأستاذ');
                    }
                } catch (error) {
                    console.error('❌ Error loading professor details:', error);
                    this.showNotification('error', '❌ حدث خطأ في جلب بيانات الأستاذ');
                } finally {
                    this.isLoading = false;
                }
            } else {
                const list = this.departmentsData[this.selectedDept]?.staff || [];
                const item = list.find(i => i.id === id);
                if (!item) return;

                this.addType = 'staff';
                this.editId = id;
                this.newStaff = {
                    name: item.name,
                    email: item.email || '',
                    role: item.role || ''
                };
                this.showNotification('info', `جاري تعديل بيانات الموظف (${item.name})`);
            }

            const formBox = document.querySelector('.sections-page .group-box');
            if (formBox) {
                setTimeout(() => {
                    formBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 200);
            }
        },

        // ============================================================
        // 🗑️ حذف مادة مسندة / تكليف مع نافذة تأكيد JS مخصصة وإشعار فوري
        // ============================================================
        openDeleteConfirmModal(assignmentId, index, courseName = '') {
            this.deletePendingAssignmentId = assignmentId;
            this.deletePendingIndex = index;
            this.deleteConfirmMessage = courseName 
                ? `هل أنت متأكد من حذف تكليف مادة (${courseName}) نهائياً من سجل الأستاذ؟`
                : 'هل أنت متأكد من حذف هذا التكليف الدراسي نهائياً؟';
            this.showDeleteConfirmModal = true;
        },

        cancelDeleteAssignment() {
            this.showDeleteConfirmModal = false;
            this.deletePendingAssignmentId = null;
            this.deletePendingIndex = null;
            this.deleteConfirmMessage = '';
        },

        async confirmDeleteAssignment() {
            if (!this.deletePendingAssignmentId) return;
            const assignmentId = this.deletePendingAssignmentId;
            const index = this.deletePendingIndex;
            this.showDeleteConfirmModal = false;
            
            try {
                const response = await fetch('/faculty/api/assignment/delete/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCsrfToken()
                    },
                    body: JSON.stringify({ assignment_id: assignmentId })
                });
                
                const data = await response.json();
                if (data.success) {
                    if (index !== null && index !== undefined && this.editProfessorAssignments[index]) {
                        this.editProfessorAssignments.splice(index, 1);
                    } else {
                        this.editProfessorAssignments = this.editProfessorAssignments.filter(a => a.assignment_id !== assignmentId);
                    }
                    this.showNotification('success', data.message || '🗑️ تم حذف تكليف المادة بنجاح');
                    await this.loadDepartmentData(this.selectedDept);
                } else {
                    this.showNotification('error', data.message || 'حدث خطأ أثناء حذف التكليف');
                }
            } catch (error) {
                console.error('❌ Error deleting assignment:', error);
                this.showNotification('error', '❌ حدث خطأ في الاتصال أثناء حذف التكليف');
            } finally {
                this.deletePendingAssignmentId = null;
                this.deletePendingIndex = null;
            }
        },

        deleteAssignment(assignmentId, index) {
            const item = this.editProfessorAssignments[index];
            const courseName = item ? (item.course_name || item.course_code || '') : '';
            this.openDeleteConfirmModal(assignmentId, index, courseName);
        },

        // ============================================================
        // ➕ إسناد مادة مفردة عبر AJAX
        // ============================================================
        async addSingleAssignment(professorId, courseId, levelId, groupId, departmentId = null) {
            try {
                if (!levelId) {
                    const c = this.courses.find(course => course.id == courseId);
                    if (c && c.level_id) levelId = c.level_id;
                    else if (this.levels.length > 0) levelId = this.levels[0].id;
                }
                if (!groupId && this.groups.length > 0) {
                    const filteredG = this.getFilteredGroups({ department_id: departmentId || this.selectedDept, level_id: levelId });
                    groupId = filteredG.length > 0 ? filteredG[0].id : this.groups[0].id;
                }

                const response = await fetch('/faculty/api/assignment/add/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCsrfToken()
                    },
                    body: JSON.stringify({
                        professor_id: professorId,
                        instructor_id: professorId,
                        course_id: courseId,
                        department_id: departmentId || this.selectedDept,
                        level_id: levelId,
                        group_id: groupId
                    })
                });
                
                const data = await response.json();
                if (data.status === 'success' || data.success) {
                    if (data.assignment) {
                        this.editProfessorAssignments.push(data.assignment);
                    }
                    return true;
                } else {
                    this.showNotification('warning', data.message || 'حدث خطأ في إسناد المادة');
                    return false;
                }
            } catch (error) {
                console.error('❌ Error adding assignment:', error);
                this.showNotification('error', '❌ حدث خطأ في إضافة التكليف');
                return false;
            }
        },

        // ============================================================
        // 💾 حفظ التعديلات (Update) للأستاذ أو الموظف مع الإشعارات الفورية
        // ============================================================
        async saveEditInForm() {
            if (!this.selectedDept || !this.editId) return;
            
            if (this.addType === 'professor') {
                const name = this.newProfessor.name.trim();
                
                if (!name) {
                    this.showNotification('error', 'الرجاء إدخال اسم الأستاذ');
                    return;
                }

                try {
                    const newSubjects = this.newProfessor.subjects.filter(
                        s => s.course_id
                    );
                    
                    let addedCount = 0;
                    for (const subject of newSubjects) {
                        let levelId = subject.level_id;
                        let groupId = subject.group_id;
                        if (!levelId) {
                            const c = this.courses.find(course => course.id == subject.course_id);
                            if (c && c.level_id) levelId = c.level_id;
                            else if (this.levels.length > 0) levelId = this.levels[0].id;
                        }
                        if (!groupId) {
                            const filteredG = this.getFilteredGroups(subject);
                            if (filteredG.length > 0) groupId = filteredG[0].id;
                            else if (this.groups.length > 0) groupId = this.groups[0].id;
                        }

                        const success = await this.addSingleAssignment(
                            this.editId,
                            subject.course_id,
                            levelId,
                            groupId,
                            subject.department_id || this.selectedDept
                        );
                        if (success) addedCount++;
                    }
                    
                    const updateResponse = await fetch('/faculty/api/professor/save/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.getCsrfToken()
                        },
                        body: JSON.stringify({
                            id: this.editId,
                            name: name,
                            email: this.newProfessor.email.trim(),
                            department_id: this.selectedDept,
                            subjects: []
                        })
                    });
                    
                    const updateData = await updateResponse.json();
                    if (updateData.success) {
                        let message = `✅ تم تحديث بيانات الأستاذ (${name}) بنجاح`;
                        if (addedCount > 0) {
                            message += ` وتم إسناد ${addedCount} مادة جديدة`;
                        }
                        this.showNotification('success', message);
                        this.cancelEditInForm();
                        await this.loadDepartmentData(this.selectedDept);
                    } else {
                        this.showNotification('error', updateData.message || 'حدث خطأ في تحديث البيانات');
                    }
                } catch (error) {
                    console.error('❌ Error saving professor edits:', error);
                    this.showNotification('error', '❌ فشل الاتصال أثناء تعديل بيانات الأستاذ');
                }
            } else {
                const name = this.newStaff.name.trim();
                const role = this.newStaff.role.trim();

                if (!name || !role) {
                    this.showNotification('error', 'الرجاء إدخال اسم الموظف والمسمى الوظيفي');
                    return;
                }

                try {
                    const response = await fetch('/faculty/api/staff/save/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.getCsrfToken()
                        },
                        body: JSON.stringify({
                            id: this.editId,
                            name: name,
                            email: this.newStaff.email.trim(),
                            role: role,
                            department_id: this.selectedDept
                        })
                    });

                    const data = await response.json();
                    if (data.success) {
                        this.showNotification('success', data.message || `✅ تم حفظ وتعديل بيانات الموظف (${name}) بنجاح`);
                        this.cancelEditInForm();
                        await this.loadDepartmentData(this.selectedDept);
                    } else {
                        this.showNotification('error', data.message || 'حدث خطأ أثناء تعديل بيانات الموظف');
                    }
                } catch (error) {
                    console.error('❌ Error updating staff:', error);
                    this.showNotification('error', '❌ فشل الاتصال أثناء تعديل بيانات الموظف');
                }
            }
        },

        cancelEditInForm() {
            this.editId = null;
            this.editProfessorAssignments = [];
            this.coordinatorSelectedProfId = ''; // 🛡️ إعادة تعيين اختيار المنسق
            this.newProfessor = { 
                name: '', 
                email: '', 
                subjects: [{ department_id: this.selectedDept || '', level_id: '', course_id: '', group_id: '' }] 
            };
            this.newStaff = { name: '', email: '', role: '' };
            this.updateJobPermissionState();
        },

        // ============================================================
        // 🔥 التحكم الديناميكي في حالة صلاحيات أزرار إضافة الأستاذ والموظف
        // ============================================================
        updateJobPermissionState() {
            const isInstructorOpen = (typeof window.IS_ADD_INSTRUCTOR_OPEN !== 'undefined') ? Boolean(window.IS_ADD_INSTRUCTOR_OPEN) : false;
            const instructorMsg = window.ADD_INSTRUCTOR_MESSAGE || '';
            const isStaffOpen = (typeof window.IS_ADD_STAFF_OPEN !== 'undefined') ? Boolean(window.IS_ADD_STAFF_OPEN) : false;
            const staffMsg = window.ADD_STAFF_MESSAGE || '';

            this.applyJobPermissionUI(isInstructorOpen, instructorMsg, isStaffOpen, staffMsg);

            // تحديث حي ولحظي من API الوظائف
            fetch('/renewal/api/jobs/check-permission/', {
                method: 'GET',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success) {
                    window.IS_ADD_INSTRUCTOR_OPEN = Boolean(data.is_add_instructor_open);
                    window.ADD_INSTRUCTOR_MESSAGE = data.add_instructor_message || '';
                    window.IS_ADD_STAFF_OPEN = Boolean(data.is_add_staff_open);
                    window.ADD_STAFF_MESSAGE = data.add_staff_message || '';

                    this.applyJobPermissionUI(
                        window.IS_ADD_INSTRUCTOR_OPEN, window.ADD_INSTRUCTOR_MESSAGE,
                        window.IS_ADD_STAFF_OPEN, window.ADD_STAFF_MESSAGE
                    );
                }
            })
            .catch(err => {
                console.warn('⚠️ Dynamic job permission check warning:', err);
            });
        },

        applyJobPermissionUI(isInstructorOpen, instructorMsg, isStaffOpen, staffMsg) {
            const btnProf = document.getElementById('btnAddProfessor');
            const btnStaff = document.getElementById('btnAddStaff');
            const btnSubj = document.getElementById('btnAddSubject');
            const boxSubj = document.getElementById('courseAssignmentBox');

            const banner = document.getElementById('jobInactiveBanner');
            const bannerText = document.getElementById('jobInactiveBannerText');

            if (banner) {
                if (!isInstructorOpen || !isStaffOpen) {
                    let msg = '';
                    if (!isInstructorOpen && instructorMsg) msg += instructorMsg + ' ';
                    if (!isStaffOpen && staffMsg) msg += staffMsg;
                    if (bannerText) bannerText.textContent = msg.trim() || '⚠️ بعض خدمات إضافة الأساتذة أو الموظفين موقوفة حالياً في جدول الوظائف.';
                    banner.style.display = 'flex';
                } else {
                    banner.style.display = 'none';
                }
            }

            if (btnProf) {
                if (!isInstructorOpen && this.editId === null) {
                    btnProf.disabled = true;
                    btnProf.setAttribute('disabled', 'disabled');
                    btnProf.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                    btnProf.style.setProperty('opacity', '0.5', 'important');
                    btnProf.style.setProperty('cursor', 'not-allowed', 'important');
                    btnProf.style.setProperty('pointer-events', 'none', 'important');
                    btnProf.style.setProperty('filter', 'grayscale(80%)', 'important');
                    if (instructorMsg) btnProf.title = instructorMsg;
                } else {
                    btnProf.disabled = false;
                    btnProf.removeAttribute('disabled');
                    btnProf.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                    btnProf.style.setProperty('opacity', '1', 'important');
                    btnProf.style.setProperty('cursor', 'pointer', 'important');
                    btnProf.style.setProperty('pointer-events', 'auto', 'important');
                    btnProf.style.setProperty('filter', 'none', 'important');
                    btnProf.title = '';
                }
            }

            if (btnStaff) {
                if (!isStaffOpen && this.editId === null) {
                    btnStaff.disabled = true;
                    btnStaff.setAttribute('disabled', 'disabled');
                    btnStaff.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                    btnStaff.style.setProperty('opacity', '0.5', 'important');
                    btnStaff.style.setProperty('cursor', 'not-allowed', 'important');
                    btnStaff.style.setProperty('pointer-events', 'none', 'important');
                    btnStaff.style.setProperty('filter', 'grayscale(80%)', 'important');
                    if (staffMsg) btnStaff.title = staffMsg;
                } else {
                    btnStaff.disabled = false;
                    btnStaff.removeAttribute('disabled');
                    btnStaff.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                    btnStaff.style.setProperty('opacity', '1', 'important');
                    btnStaff.style.setProperty('cursor', 'pointer', 'important');
                    btnStaff.style.setProperty('pointer-events', 'auto', 'important');
                    btnStaff.style.setProperty('filter', 'none', 'important');
                    btnStaff.title = '';
                }
            }

            // 🔥 التحكم المستقل في زر إسناد ودوال إضافة المادة (Add Course Button & Container)
            if (btnSubj) {
                if (!isInstructorOpen && this.editId === null) {
                    btnSubj.disabled = true;
                    btnSubj.setAttribute('disabled', 'disabled');
                    btnSubj.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                    btnSubj.style.setProperty('opacity', '0.5', 'important');
                    btnSubj.style.setProperty('cursor', 'not-allowed', 'important');
                    btnSubj.style.setProperty('pointer-events', 'none', 'important');
                    btnSubj.style.setProperty('filter', 'grayscale(80%)', 'important');
                    if (instructorMsg) btnSubj.title = instructorMsg;
                } else {
                    btnSubj.disabled = false;
                    btnSubj.removeAttribute('disabled');
                    btnSubj.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                    btnSubj.style.setProperty('opacity', '1', 'important');
                    btnSubj.style.setProperty('cursor', 'pointer', 'important');
                    btnSubj.style.setProperty('pointer-events', 'auto', 'important');
                    btnSubj.style.setProperty('filter', 'none', 'important');
                    btnSubj.title = '';
                }
            }

            if (boxSubj) {
                if (!isInstructorOpen && this.editId === null) {
                    boxSubj.classList.add('opacity-50', 'pointer-events-none');
                    boxSubj.style.setProperty('opacity', '0.55', 'important');
                    boxSubj.style.setProperty('pointer-events', 'none', 'important');
                    boxSubj.querySelectorAll('select, button').forEach(el => {
                        el.disabled = true;
                        el.setAttribute('disabled', 'disabled');
                    });
                } else {
                    boxSubj.classList.remove('opacity-50', 'pointer-events-none');
                    boxSubj.style.setProperty('opacity', '1', 'important');
                    boxSubj.style.setProperty('pointer-events', 'auto', 'important');
                    boxSubj.querySelectorAll('select, button').forEach(el => {
                        el.disabled = false;
                        el.removeAttribute('disabled');
                    });
                }
            }
        },

        getCsrfToken() {
            const cookieValue = document.cookie
                .split('; ')
                .find(row => row.startsWith('csrftoken='))
                ?.split('=')[1];
            return cookieValue || '';
        }
    };
}