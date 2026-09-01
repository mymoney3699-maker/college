document.addEventListener('DOMContentLoaded', function() {

    // ---- عناصر DOM ----
    const form = document.getElementById('clearanceForm');
    const studentName = document.getElementById('studentName');
    const registrationNumber = document.getElementById('registrationNumber');
    const semester = document.getElementById('semester');
    const clearanceDate = document.getElementById('clearanceDate');
    const clearanceReason = document.getElementById('clearanceReason');
    const checkEligibilityBtn = document.getElementById('checkEligibilityBtn');
    const submitClearanceBtn = document.getElementById('submitClearanceBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const printFormBtn = document.getElementById('printFormBtn');
    const toggleListBtn = document.getElementById('toggleListBtn');
    const toggleListText = toggleListBtn ? toggleListBtn.querySelector('[data-toggle-list-text]') : null;
    const listCard = document.getElementById('clearanceListCard');
    const smartSearch = document.getElementById('smartSearch');
    const tableBody = document.getElementById('clearanceTableBody');
    const totalClearances = document.getElementById('totalClearances');
    const alertBox = document.getElementById('clearanceAlert');
    const eligibilityPanel = document.getElementById('eligibilityPanel');
    const eligibilityHeader = document.getElementById('eligibilityHeader');
    const eligibilityList = document.getElementById('eligibilityList');

    let currentStudentId = null;
    let currentStudentName = '';
    let currentStudentData = null;
    let currentProjectGrade = '';
    let isClearanceApproved = false;
    let isEligible = false;
    const clearances = [];

    // مصفوفة أسماء المسؤولين من قاعدة البيانات
    let activeOfficials = {
        dean: '',
        registrar: ''
    };

    function fetchActiveOfficials() {
        const officialsApiUrl = window.GET_OFFICIALS_API_URL || '/users/api/officials/';
        fetch(officialsApiUrl, {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.success && data.officials) {
                data.officials.forEach(off => {
                    if (off.status === 'active') {
                        const titlePrefix = off.title ? `${off.title} ` : '';
                        const fullName = `${titlePrefix}${off.name}`;
                        if (off.position_key === 'dean' || off.position === 'dean' || (off.title && off.title.includes('عميد'))) {
                            activeOfficials.dean = fullName;
                        } else if (off.position_key === 'registrar' || off.position === 'registrar' || (off.title && off.title.includes('مسجل'))) {
                            activeOfficials.registrar = fullName;
                        }
                    }
                });
            }
        })
        .catch(err => console.warn('⚠️ Officials fetch warning:', err));
    }

    if (printFormBtn) {
        printFormBtn.disabled = true;
        printFormBtn.style.opacity = '0.5';
        printFormBtn.style.cursor = 'not-allowed';
        printFormBtn.title = 'الطباعة متاحة فقط بعد اعتماد إخلاء الطرف';
    }

    function formatTodayDate() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    if (clearanceDate) {
        if (!clearanceDate.value) clearanceDate.value = formatTodayDate();
        clearanceDate.readOnly = true;
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
    const csrftoken = getCookie('csrftoken');

    // ---- التحكم في صلاحية وظيفة إخلاء الطرف ----
    function applyClearancePermissionUI(isOpen, message) {
        const isJobOpen = (typeof isOpen !== 'undefined') ? Boolean(isOpen) : (typeof window.IS_CLEARANCE_JOB_OPEN !== 'undefined' ? Boolean(window.IS_CLEARANCE_JOB_OPEN) : true);
        const displayMsg = message || window.CLEARANCE_JOB_MESSAGE || '⚠️ خدمة "إخلاء الطرف" غير مفعلة حالياً في إدارة الوظائف.';

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

        if (submitClearanceBtn) {
            if (!isJobOpen) {
                submitClearanceBtn.disabled = true;
                submitClearanceBtn.setAttribute('disabled', 'disabled');
                submitClearanceBtn.style.setProperty('opacity', '0.5', 'important');
                submitClearanceBtn.style.setProperty('cursor', 'not-allowed', 'important');
                submitClearanceBtn.style.setProperty('pointer-events', 'none', 'important');
                submitClearanceBtn.title = displayMsg;
            } else if (!isEligible) {
                submitClearanceBtn.disabled = true;
                submitClearanceBtn.removeAttribute('disabled');
                submitClearanceBtn.style.setProperty('opacity', '0.6', 'important');
                submitClearanceBtn.style.setProperty('cursor', 'not-allowed', 'important');
                submitClearanceBtn.style.setProperty('pointer-events', 'auto', 'important');
            } else {
                submitClearanceBtn.disabled = false;
                submitClearanceBtn.removeAttribute('disabled');
                submitClearanceBtn.style.setProperty('opacity', '1', 'important');
                submitClearanceBtn.style.setProperty('cursor', 'pointer', 'important');
                submitClearanceBtn.style.setProperty('pointer-events', 'auto', 'important');
            }
        }

        if (printFormBtn) {
            if (!isJobOpen) {
                printFormBtn.disabled = true;
                printFormBtn.style.setProperty('opacity', '0.5', 'important');
                printFormBtn.style.setProperty('cursor', 'not-allowed', 'important');
                printFormBtn.title = displayMsg;
            } else if (!isClearanceApproved) {
                printFormBtn.disabled = true;
                printFormBtn.style.setProperty('opacity', '0.5', 'important');
                printFormBtn.style.setProperty('cursor', 'not-allowed', 'important');
                printFormBtn.title = 'الطباعة متاحة فقط بعد اعتماد إخلاء الطرف';
            } else {
                printFormBtn.disabled = false;
                printFormBtn.style.setProperty('opacity', '1', 'important');
                printFormBtn.style.setProperty('cursor', 'pointer', 'important');
                printFormBtn.title = 'طباعة نموذج إخلاء الطرف';
            }
        }
    }

    function updateJobPermissionState() {
        const isOpen = (typeof window.IS_CLEARANCE_JOB_OPEN !== 'undefined') ? Boolean(window.IS_CLEARANCE_JOB_OPEN) : true;
        const message = window.CLEARANCE_JOB_MESSAGE || '';
        applyClearancePermissionUI(isOpen, message);

        fetch('/renewal/api/jobs/check-permission/', {
            method: 'GET',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.success) {
                window.IS_CLEARANCE_JOB_OPEN = Boolean(data.is_clearance_job_open);
                window.CLEARANCE_JOB_MESSAGE = data.clearance_job_message || '';
                applyClearancePermissionUI(window.IS_CLEARANCE_JOB_OPEN, window.CLEARANCE_JOB_MESSAGE);
            }
        })
        .catch(err => console.warn('⚠️ Permission check error:', err));
    }
    window.updateJobPermissionState = updateJobPermissionState;

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

    const showAlert = function(message, type = 'success') {
        if (alertBox) {
            alertBox.textContent = message;
            alertBox.className = 'clearance-alert clearance-alert--' + type + ' show';
            clearTimeout(alertBox.hideTimer);
            alertBox.hideTimer = setTimeout(function() {
                alertBox.classList.remove('show');
            }, 4000);
        }
        // إطلاق إشعار عائم Toast مطابق للمعيار المعتمد
        const notifType = type === 'danger' ? 'error' : (type === 'info' ? 'info' : (type === 'warning' ? 'warning' : 'success'));
        showNotification(notifType, message);
    };

    function enablePrintButton() {
        const isJobOpen = (typeof window.IS_CLEARANCE_JOB_OPEN !== 'undefined') ? Boolean(window.IS_CLEARANCE_JOB_OPEN) : true;
        if (printFormBtn) {
            if (!isJobOpen) {
                printFormBtn.disabled = true;
                printFormBtn.style.opacity = '0.5';
                printFormBtn.style.cursor = 'not-allowed';
                printFormBtn.title = window.CLEARANCE_JOB_MESSAGE || 'خدمة إخلاء الطرف غير مفعلة حالياً';
            } else {
                printFormBtn.disabled = false;
                printFormBtn.style.opacity = '1';
                printFormBtn.style.cursor = 'pointer';
                printFormBtn.title = 'طباعة نموذج إخلاء الطرف';
            }
        }
    }

    function disablePrintButton(message) {
        if (printFormBtn) {
            printFormBtn.disabled = true;
            printFormBtn.style.opacity = '0.5';
            printFormBtn.style.cursor = 'not-allowed';
            printFormBtn.title = message || 'الطباعة متاحة فقط بعد اعتماد إخلاء الطرف';
        }
    }

    async function checkStudentEligibility() {
        const query = registrationNumber.value.trim();
        if (!query) {
            showAlert('⚠️ الرجاء إدخال رقم القيد أو اسم الطالبة للفحص', 'danger');
            return;
        }

        showAlert('⏳ جاري البحث والفحص الآلي لاستحقاق إخلاء الطرف...', 'info');
        submitClearanceBtn.disabled = true;
        submitClearanceBtn.style.opacity = '0.6';
        submitClearanceBtn.style.cursor = 'not-allowed';
        
        disablePrintButton('جاري فحص استحقاق الطالبة...');

        try {
            const searchRes = await fetch(`/renewal/search-student-api/?reg_num=${encodeURIComponent(query)}&name=${encodeURIComponent(query)}`);
            const contentType = searchRes.headers.get('content-type') || '';
            if (!searchRes.ok || !contentType.includes('application/json')) {
                showAlert('❌ حدث خطأ في النظام أثناء فحص بيانات الطالبة', 'danger');
                if (eligibilityPanel) eligibilityPanel.style.display = 'none';
                return;
            }

            const searchData = await searchRes.json();
            const student = searchData.student || (searchData.students && searchData.students[0]);
            if (!searchData.success || !student) {
                showAlert('❌ الطالبة غير موجودة أو لا توجد نتائج مطابقة', 'danger');
                if (eligibilityPanel) eligibilityPanel.style.display = 'none';
                return;
            }

            currentStudentId = student.id;
            currentStudentName = student.name ? `${student.name} ${student.father_name || ''} ${student.last_name || ''}`.trim() : (student.get_full_name || '-');
            currentStudentData = student;
            
            if (studentName) studentName.value = currentStudentName;

            let levelVal = student.level_number || student.level || '-';
            if (String(levelVal).includes('8') || String(levelVal).includes('الثامن')) {
                levelVal = 'الثامن';
            } else {
                levelVal = `المستوى ${levelVal}`;
            }
            if (semester) semester.value = levelVal;

            const checkRes = await fetch(`/renewal/api/clearance-check/${student.id}/`);
            const checkContentType = checkRes.headers.get('content-type') || '';
            if (!checkRes.ok || !checkContentType.includes('application/json')) {
                showAlert('❌ حدث خطأ في النظام أثناء فحص بيانات الطالبة', 'danger');
                return;
            }

            const checkData = await checkRes.json();
            if (checkData.project_grade) {
                currentProjectGrade = checkData.project_grade;
            }

            if (checkData.success === false && checkData.error) {
                showAlert('❌ حدث خطأ في النظام أثناء فحص بيانات الطالبة', 'danger');
                return;
            }

            if (eligibilityPanel) eligibilityPanel.style.display = 'block';

            if (checkData.already_cleared) {
                eligibilityHeader.innerHTML = '⚠️ <span style="color: #0284c7;">الطالبة مخلى طرفها ومتخرجة بالفعل</span>';
                eligibilityList.innerHTML = `<li>تاريخ إخلاء الطرف الموثق: ${checkData.clearance_date}</li><li>درجة مشروع التخرج: ${checkData.project_grade}</li>`;
                showAlert('ℹ️ الطالبة مخلى طرفها ومتخرجة بالفعل مسبقاً', 'info');
                isEligible = false;
                isClearanceApproved = true;
                enablePrintButton();
                return;
            }

            const isJobOpen = (typeof window.IS_CLEARANCE_JOB_OPEN !== 'undefined') ? Boolean(window.IS_CLEARANCE_JOB_OPEN) : true;

            if (checkData.eligible) {
                isEligible = true;
                isClearanceApproved = false;
                
                eligibilityHeader.innerHTML = '✅ <span style="color: #16a34a;">الطالبة مستحقة لإخلاء الطرف والتخرج</span>';
                eligibilityList.innerHTML = `
                    <li style="color: #16a34a;">✅ تم استيفاء شرط الوصول للمستوى الثامن.</li>
                    <li style="color: #16a34a;">✅ تم تصفية والنجاح في كافة مواد الخطة الدراسية.</li>
                    <li style="color: #16a34a;">✅ تم مناقشة ورصد مشروع التخرج بنجاح (الدرجة: ${checkData.project_grade}).</li>
                `;

                if (isJobOpen) {
                    submitClearanceBtn.disabled = false;
                    submitClearanceBtn.style.opacity = '1';
                    submitClearanceBtn.style.cursor = 'pointer';
                    submitClearanceBtn.style.pointerEvents = 'auto';
                }
                
                disablePrintButton('يجب اعتماد إخلاء الطرف أولاً');
                showAlert('✅ الطالبة مستحقة لإخلاء الطرف، يمكنك الضغط على زر الاعتماد الآن', 'success');
            } else {
                isEligible = false;
                isClearanceApproved = false;
                
                eligibilityHeader.innerHTML = '❌ <span style="color: #dc2626;">الطالبة غير مستحقة لإخلاء الطرف حالياً</span>';
                const reasonsList = (checkData && (checkData.reasons || checkData.conditions)) || [];
                let reasonsHtml = '';
                if (reasonsList.length > 0) {
                    reasonsHtml = reasonsList.map(r => `<li style="color: #dc2626;">❌ ${r}</li>`).join('');
                } else {
                    reasonsHtml = `<li style="color: #dc2626;">❌ الطالبة غير مستحقة لإخلاء الطرف بسبب وجود متطلبات أكاديمية أو مالية غير مكتملة</li>`;
                }
                eligibilityList.innerHTML = reasonsHtml;
                
                disablePrintButton('الطالبة غير مستحقة لإخلاء الطرف');
                showAlert('⚠️ تعذر إجراء إخلاء الطرف لعدم استيفاء الشروط الأكاديمية', 'danger');
            }
        } catch (err) {
            console.error(err);
            showAlert('❌ حدث خطأ في النظام أثناء فحص بيانات الطالبة', 'danger');
        } finally {
            applyClearancePermissionUI();
        }
    }

    if (checkEligibilityBtn) {
        checkEligibilityBtn.addEventListener('click', checkStudentEligibility);
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        if (typeof window.IS_CLEARANCE_JOB_OPEN !== 'undefined' && !window.IS_CLEARANCE_JOB_OPEN) {
            showAlert(window.CLEARANCE_JOB_MESSAGE || "⚠️ خدمة 'إخلاء الطرف' غير مفعلة حالياً في إدارة الوظائف", 'danger');
            return;
        }

        if (!currentStudentId) {
            showAlert('⚠️ الرجاء فحص واختيار الطالبة أولاً', 'danger');
            return;
        }

        if (submitClearanceBtn.disabled) {
            showAlert('❌ لا يمكن اعتماد إخلاء الطرف لعدم استيفاء الشروط', 'danger');
            return;
        }

        const notesVal = clearanceReason ? clearanceReason.value.trim() : '';

        try {
            showAlert('⏳ جاري اعتماد إخلاء الطرف وتجميد حساب الطالبة إدارياً...', 'info');

            const res = await fetch('/renewal/api/process-clearance/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    student_id: currentStudentId,
                    notes: notesVal
                })
            });

            const data = await res.json();

            if (data.success) {
                isClearanceApproved = true;
                showAlert('✅ تم تنفيذ إخلاء الطرف وتخرج الطالبة بنجاح وتجميد كافة العمليات الإدارية على ملفها.', 'success');
                submitClearanceBtn.disabled = true;
                submitClearanceBtn.style.opacity = '0.6';
                submitClearanceBtn.style.cursor = 'not-allowed';
                
                enablePrintButton();
                showAlert('✅ يمكنك الآن طباعة نموذج إخلاء الطرف', 'success');
                
                if (eligibilityHeader) {
                    eligibilityHeader.innerHTML = '🎓 <span style="color: #16a34a;">تمت عملية إخلاء الطرف والتخرج بنجاح</span>';
                }
            } else {
                showAlert(`❌ فشل الاعتماد: ${data.error || 'حدث خطأ غير متوقع'}`, 'danger');
                disablePrintButton('فشل اعتماد إخلاء الطرف');
            }
        } catch (err) {
            console.error(err);
            showAlert('❌ حدث خطأ أثناء الاتصال بالخادم وتنفيذ العملية', 'danger');
            disablePrintButton('حدث خطأ أثناء الاعتماد');
        }
    });

    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', function() {
            form.reset();
            currentStudentId = null;
            currentStudentName = '';
            currentStudentData = null;
            currentProjectGrade = '';
            isClearanceApproved = false;
            isEligible = false;
            
            if (clearanceDate) {
                clearanceDate.value = formatTodayDate();
                clearanceDate.readOnly = true;
            }
            if (eligibilityPanel) eligibilityPanel.style.display = 'none';
            
            submitClearanceBtn.disabled = true;
            submitClearanceBtn.style.opacity = '0.6';
            submitClearanceBtn.style.cursor = 'not-allowed';
            
            disablePrintButton('الطباعة متاحة فقط بعد اعتماد إخلاء الطرف');
            
            showAlert('🔄 تم إعادة تعيين النموذج', 'info');
        });
    }

    function updateCounter(count) {
        if (totalClearances) {
            totalClearances.textContent = typeof count === 'number' ? count : clearances.length;
        }
    }

    function renderTable() {
        if (!tableBody) return;

        const query = smartSearch ? smartSearch.value.trim().toLowerCase() : '';
        const filtered = clearances.filter(item => {
            if (!query) return true;
            const name = (item.name || '').toLowerCase();
            const reg = (item.reg_num || item.id || '').toLowerCase();
            const dept = (item.dept || '').toLowerCase();
            const notes = (item.notes || '').toLowerCase();
            return name.includes(query) || reg.includes(query) || dept.includes(query) || notes.includes(query);
        });

        updateCounter(filtered.length);

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td class="clearance-empty-cell" colspan="7">لا توجد بيانات مسجلة.</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filtered.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.reg_num || item.id || '—'}</td>
                <td>${item.name || '—'}</td>
                <td>${item.dept || '—'}</td>
                <td>${item.semester || '—'}</td>
                <td>${item.date || '—'}</td>
                <td>${item.notes || '—'}</td>
            </tr>
        `).join('');
    }

    function setListVisibility(show) {
        if (!listCard) return;
        if (show) {
            listCard.classList.remove('is-hidden');
            if (toggleListText) toggleListText.textContent = 'إخفاء القائمة';
            if (toggleListBtn) toggleListBtn.setAttribute('aria-expanded', 'true');
        } else {
            listCard.classList.add('is-hidden');
            if (toggleListText) toggleListText.textContent = 'عرض القائمة';
            if (toggleListBtn) toggleListBtn.setAttribute('aria-expanded', 'false');
        }
    }

    // ---- دالة تحديث التقرير وتجهيز نموذج إخلاء الطرف ----
    function updatePrintTemplate() {
        const today = new Date();
        const dateStr = today.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' }) || today.toISOString().split('T')[0];

        const printName = document.querySelector('[data-print="name"]');
        const printReg = document.querySelector('[data-print="registration"]');
        const printDept = document.querySelector('[data-print="department"]');
        const printDate = document.querySelector('[data-print="date"]');
        const printDateBox = document.querySelector('[data-print="date_box"]');
        const printProjectGrade = document.querySelector('[data-print="project_grade"]');

        if (printName) printName.textContent = currentStudentName || '................................................';
        if (printReg) printReg.textContent = registrationNumber ? registrationNumber.value.trim() || '................................................' : '................................................';
        if (printDept) printDept.textContent = currentStudentData ? (currentStudentData.department_name || currentStudentData.department || '................................................') : '................................................';
        if (printDate) printDate.textContent = dateStr;
        if (printDateBox) printDateBox.textContent = dateStr;

        if (printProjectGrade && currentProjectGrade) {
            printProjectGrade.textContent = currentProjectGrade;
        }

        if (window.OfficialsHelper) {
            window.OfficialsHelper.autoFill();
        }
    }

    if (printFormBtn) {
        printFormBtn.addEventListener('click', function() {
            if (typeof window.IS_CLEARANCE_JOB_OPEN !== 'undefined' && !window.IS_CLEARANCE_JOB_OPEN) {
                showAlert(window.CLEARANCE_JOB_MESSAGE || "⚠️ خدمة 'إخلاء الطرف' غير مفعلة حالياً في إدارة الوظائف", 'danger');
                return;
            }

            if (!isClearanceApproved) {
                showAlert('⚠️ لا يمكن الطباعة حتى يتم اعتماد إخلاء الطرف بنجاح', 'danger');
                return;
            }
            
            if (!currentStudentId) {
                showAlert('⚠️ لا توجد بيانات طالبة للطباعة', 'danger');
                return;
            }
            
            updatePrintTemplate();

            const template = document.getElementById('printClearanceTemplate');
            if (template && template.parentNode !== document.body) {
                document.body.appendChild(template);
            }
            
            if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
                window.OfficialsHelper.autoFill().finally(() => {
                    window.print();
                });
            } else {
                window.print();
            }
        });
    }

    if (toggleListBtn) {
        toggleListBtn.addEventListener('click', function() {
            var isHidden = listCard ? listCard.classList.contains('is-hidden') : true;
            setListVisibility(isHidden);
        });
    }

    if (smartSearch) {
        smartSearch.addEventListener('input', renderTable);
    }

    fetchActiveOfficials();
    updateCounter();
    renderTable();
    updateJobPermissionState();

    console.log('✅ Clearance print template and logic updated');
});