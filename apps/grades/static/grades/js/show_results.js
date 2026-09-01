/**
 * ============================================================
 * show_results.js v3.3.0
 * عرض واستعلام عن النتائج الدراسية - كلية طرابلس للعلوم والتقنية
 * جلب الاسم الرباعي وإلغاء عمود المستوى من الجدول
 * ============================================================
 */

console.log('✅ show_results.js v3.3.0 loaded');

let allCoursesList = [];
let lastFetchedResults = [];
let currentStudentData = null;

// ============================================================
// ===        دوال مساعدة
// ============================================================
function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// جلب النص المختار من القائمة
function getSelectedText(selectId, fallback = 'الكل') {
    const el = document.getElementById(selectId);
    if (!el || el.selectedIndex < 0) return fallback;
    const text = el.options[el.selectedIndex].text;
    if (!text || text.includes('كل ') || text.includes('--')) return fallback;
    return text;
}

// دالة جلب الاسم الرباعي الكامل بكافة حقول الـ API المحتملة
function getQuadStudentName(row, studentData = null) {
    const extractNameFromObj = (obj) => {
        if (!obj) return null;

        // 1. استخدام الحقول المجهزة مسبقاً إذا كانت تحتوي على اسم مكتمل
        if (obj.quad_name && obj.quad_name.trim().length > 0) return obj.quad_name.trim();
        if (obj.full_name && obj.full_name.trim().length > 0) return obj.full_name.trim();
        if (obj.student_full_name && obj.student_full_name.trim().length > 0) return obj.student_full_name.trim();
        if (obj.name_quad && obj.name_quad.trim().length > 0) return obj.name_quad.trim();

        // 2. إذا كانت هناك أجزاء اسم منفصلة
        const parts = [
            obj.first_name || obj.name || '',
            obj.father_name || '',
            obj.grandfather_name || '',
            obj.last_name || obj.family_name || ''
        ].map(p => (p || '').trim()).filter(p => p.length > 0);

        if (parts.length >= 3) return parts.join(' ');
        if (parts.length > 0) return parts.join(' ');
        if (obj.student_name && obj.student_name.trim().length > 0) return obj.student_name.trim();
        return null;
    };

    if (row) {
        const fromRow = extractNameFromObj(row);
        if (fromRow) return fromRow;

        if (row.student) {
            const fromStudent = extractNameFromObj(row.student);
            if (fromStudent) return fromStudent;
        }
    }

    if (studentData) {
        const fromData = extractNameFromObj(studentData);
        if (fromData) return fromData;
    }

    return '-';
}

// ============================================================
// ===        تحميل الفلاتر وترتيب المستويات تصاعدياً (1، 2، 3...)
// ============================================================
function loadFilters() {
    console.log('🔄 Loading filters...');
    
    fetch('/grades/api/get-results-filters/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 1. تعبئة التخصصات
                const majorSelect = document.getElementById('majorSelect');
                if (majorSelect && majorSelect.options.length <= 1) {
                    majorSelect.innerHTML = '<option value="">كل التخصصات</option>';
                    (data.departments || []).forEach(d => {
                        majorSelect.innerHTML += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
                    });
                }
                
                // 2. تعبئة المواسم الدراسية
                const seasonSelect = document.getElementById('seasonSelect');
                if (seasonSelect && seasonSelect.options.length <= 1) {
                    seasonSelect.innerHTML = '<option value="">كل المواسم</option>';
                    (data.semesters || []).forEach(s => {
                        const typeMap = {
                            'fall': 'خريف',
                            'spring': 'ربيع',
                            'summer': 'صيف'
                        };
                        const semLabel = `${s.year || ''} - ${typeMap[s.type] || s.type || s.name || ''}`.trim();
                        seasonSelect.innerHTML += `<option value="${s.id}">${escapeHtml(semLabel)}</option>`;
                    });
                }

                // 3. تعبئة المستويات الدراسية - ترتيب تصاعدي صارم حسب رقم المستوى
                const levelSelect = document.getElementById('levelSelect');
                if (levelSelect && levelSelect.options.length <= 1) {
                    levelSelect.innerHTML = '<option value="">كل المستويات</option>';
                    const levelsList = (data.levels || []).slice().sort((a, b) => {
                        const numA = parseInt(String(a.number || a.name || a.id || 0).replace(/\D/g, '')) || 0;
                        const numB = parseInt(String(b.number || b.name || b.id || 0).replace(/\D/g, '')) || 0;
                        return numA - numB;
                    });
                    
                    levelsList.forEach(l => {
                        const lvlName = l.name || `المستوى ${l.number || l.id}`;
                        levelSelect.innerHTML += `<option value="${l.id}">${escapeHtml(lvlName)}</option>`;
                    });
                }

                // 4. تخزين وتعبئة المواد الدراسية
                allCoursesList = data.courses || [];
                if (document.getElementById('subjectSelect')?.options.length <= 1) {
                    updateSubjectsDropdown();
                }
                
                console.log('✅ Filters loaded & levels sorted ascendingly');
            } else {
                console.error('❌ Error loading filters:', data.message);
            }
        })
        .catch(err => {
            console.error('❌ Error loading filters:', err);
        });
}

// ============================================================
// === تحديث المنسدلة الخاصة بالمواد حسب التخصص والمستوى
// ============================================================
function updateSubjectsDropdown() {
    const subjectSelect = document.getElementById('subjectSelect');
    if (!subjectSelect) return;

    const selectedDeptId  = document.getElementById('majorSelect')?.value;
    const selectedLevelId = document.getElementById('levelSelect')?.value;

    let filteredCourses = allCoursesList;

    if (selectedDeptId) {
        filteredCourses = filteredCourses.filter(c => !c.department_id || String(c.department_id) === String(selectedDeptId));
    }

    if (selectedLevelId) {
        filteredCourses = filteredCourses.filter(c => !c.level_id || String(c.level_id) === String(selectedLevelId));
    }

    subjectSelect.innerHTML = '<option value="">كل المواد الدراسية</option>';
    filteredCourses.forEach(c => {
        subjectSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
}

// ============================================================
// ===        جلب نتائج الطلاب وتعبئة جدول الشاشة والتقرير
// ============================================================
function fetchResults() {
    const studentId    = document.getElementById('searchInput')?.value.trim() || '';
    const departmentId = document.getElementById('majorSelect')?.value || '';
    const semesterId   = document.getElementById('seasonSelect')?.value || '';
    const levelId      = document.getElementById('levelSelect')?.value || '';
    const subjectId    = document.getElementById('subjectSelect')?.value || '';
    
    const tableBox    = document.getElementById('resultsTableBox');
    const tbody       = document.getElementById('resultsTableBody');
    const studentInfo = document.getElementById('studentInfo');
    
    if (tableBox) tableBox.classList.remove('hidden');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">⏳ جاري البحث وتطبيق التصفية...</td></tr>';
    }
    if (studentInfo) {
        studentInfo.innerHTML = '';
    }
    
    let url = `/grades/api/get-student-results/?search=${encodeURIComponent(studentId)}`;
    if (departmentId) url += `&department_id=${encodeURIComponent(departmentId)}`;
    if (semesterId)   url += `&semester_id=${encodeURIComponent(semesterId)}`;
    if (levelId)      url += `&level_id=${encodeURIComponent(levelId)}`;
    if (subjectId)    url += `&subject_id=${encodeURIComponent(subjectId)}`;
    
    console.log('📤 Fetching results:', url);
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                let resultsArr = data.results || [];
                currentStudentData = data.student || null;

                // فرز النتائج أوتوماتيكياً حسب رقم المستوى تصاعدياً
                resultsArr.sort((a, b) => {
                    const lvlA = parseInt(String(a.course_level || a.level || 0).replace(/\D/g, '')) || 0;
                    const lvlB = parseInt(String(b.course_level || b.level || 0).replace(/\D/g, '')) || 0;
                    return lvlA - lvlB;
                });

                lastFetchedResults = resultsArr;

                // 1. كرت معلومات الطالب في الواجهة بالاسم الرباعي
                if (studentInfo && data.student) {
                    const stQuadName = getQuadStudentName(null, data.student);
                    studentInfo.innerHTML = `
                        <div class="student-info-card" style="background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #cbd5e1;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.5rem; font-size: 0.95rem;">
                                <div><strong>رقم القيد:</strong> ${escapeHtml(data.student.student_id)}</div>
                                <div><strong>اسم الطالب الرباعي:</strong> <span style="font-weight:800; color:#0f172a;">${escapeHtml(stQuadName)}</span></div>
                                <div><strong>التخصص:</strong> ${escapeHtml(data.student.department || '-')}</div>
                                <div><strong>المستوى الحالي:</strong> ${escapeHtml(data.student.level || '-')}</div>
                                <div><strong>المعدل التراكمي:</strong> <span style="color: #10b981; font-weight: 800;">${data.gpa || '0.00'}</span></div>
                                <div><strong>المواد الناجحة:</strong> <span style="color: #10b981; font-weight:700;">${data.passed_count || 0}</span> | <strong>الراسبة:</strong> <span style="color: #ef4444; font-weight:700;">${data.failed_count || 0}</span></div>
                            </div>
                        </div>
                    `;
                }

                // 2. عرض جدول النتائج على الشاشة بالاسم الرباعي (بدون عمود مستوى المادة)
                if (resultsArr && resultsArr.length > 0) {
                    tbody.innerHTML = resultsArr.map(row => {
                        const isBlocked     = row.is_blocked;
                        const isPublished   = row.is_published !== false;
                        const isFinalEntered= row.is_final_entered;
                        const quadName      = getQuadStudentName(row, currentStudentData);

                        let midtermStr = '--';
                        let finalStr   = '--';
                        let totalStr   = '--';
                        let statusHtml = '--';

                        if (isBlocked) {
                            statusHtml = '<span style="color:#dc2626; background:#fee2e2; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">⚠️ محجوب</span>';
                        } else if (!isPublished) {
                            statusHtml = '<span style="color:#d97706; background:#fef3c7; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">🔒 غير منشور</span>';
                        } else {
                            if (row.midterm_grade !== null && row.midterm_grade !== undefined) {
                                midtermStr = String(row.midterm_grade);
                            }

                            if (isFinalEntered) {
                                if (row.final_grade !== null && row.final_grade !== undefined) finalStr = String(row.final_grade);
                                if (row.total_grade !== null && row.total_grade !== undefined) totalStr = String(row.total_grade);

                                const letter = row.grade_letter || (row.is_passed ? 'ناجح' : 'راسب');
                                if (row.is_passed) {
                                    statusHtml = `<span style="color:#059669; background:#d1fae5; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">${escapeHtml(letter)}</span>`;
                                } else {
                                    statusHtml = `<span style="color:#dc2626; background:#fee2e2; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">${escapeHtml(letter)}</span>`;
                                }
                            } else {
                                statusHtml = '<span style="color:#2563eb; background:#dbeafe; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">⏳ رصد نصفي</span>';
                            }
                        }

                        if (isBlocked) {
                            return `
                                <tr>
                                    <td class="text-center font-bold">${escapeHtml(row.student_id)}</td>
                                    <td class="font-bold text-slate-900">${escapeHtml(quadName)}</td>
                                    <td class="font-semibold">${escapeHtml(row.course_name)} (${escapeHtml(row.course_code)})</td>
                                    <td class="text-center">${escapeHtml(row.year_semester || `${row.year || ''} ${row.semester_display || ''}`)}</td>
                                    <td class="text-center font-bold text-gray-400">--</td>
                                    <td class="text-center font-bold text-gray-400">--</td>
                                    <td class="text-center font-bold text-gray-400">--</td>
                                    <td class="text-center font-bold">${statusHtml}</td>
                                </tr>
                                <tr style="background:#fee2e2;">
                                    <td colspan="8" style="padding:6px; text-align:center; font-weight:bold; color:#dc2626; font-size:0.85rem;">
                                        ⚠️ تم حجب نتيجة هذه المادة (${escapeHtml(row.block_reason || 'تجاوز غياب')}) - يرجى مراجعة قسم الدراسة والامتحانات.
                                    </td>
                                </tr>`;
                        } else {
                            return `
                                <tr>
                                    <td class="text-center font-bold">${escapeHtml(row.student_id)}</td>
                                    <td class="font-bold text-slate-900">${escapeHtml(quadName)}</td>
                                    <td class="font-medium">${escapeHtml(row.course_name)} (${escapeHtml(row.course_code)})</td>
                                    <td class="text-center">${escapeHtml(row.year_semester || `${row.year || ''} ${row.semester_display || ''}`)}</td>
                                    <td class="text-center font-bold">${escapeHtml(midtermStr)}</td>
                                    <td class="text-center font-bold">${escapeHtml(finalStr)}</td>
                                    <td class="text-center font-bold ${row.is_passed ? 'text-green-600' : (isFinalEntered ? 'text-red-600' : 'text-slate-500')}">${escapeHtml(totalStr)}</td>
                                    <td class="text-center">${statusHtml}</td>
                                </tr>`;
                        }
                    }).join('');
                } else {
                    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">لا توجد نتائج مسجلة مطابقة لمعايير البحث</td></tr>`;
                }

                // 3. تحديث جدول التقرير العمودي بالاسم الرباعي
                updatePrintReportTemplate(resultsArr, data.student);

            } else {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-600">❌ ${escapeHtml(data.message || 'حدث خطأ')}</td></tr>`;
            }
        })
        .catch(err => {
            console.error('❌ Error fetching results:', err);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-red-600">❌ حدث خطأ في الاتصال بالخادم</td></tr>';
            }
        });
}

// ============================================================
// ===        تحديث قالب التقرير المطبوع العمودي (A4 Portrait)
// ============================================================
function updatePrintReportTemplate(results, student) {
    const printSeason = document.getElementById('rptPrintSeason');
    const printMajor  = document.getElementById('rptPrintDept');
    const printLevel  = document.getElementById('rptPrintLevel');
    const printBody   = document.getElementById('rptPrintTableBody');
    const printCard   = document.getElementById('rptPrintStudentCard');

    if (printSeason) printSeason.textContent = getSelectedText('seasonSelect', 'كل المواسم');
    if (printMajor)  printMajor.textContent  = getSelectedText('majorSelect',  'كل التخصصات');
    if (printLevel)  printLevel.textContent  = getSelectedText('levelSelect',  'كل المستويات');

    // كرت ملخص الطالب في الطباعة بالاسم الرباعي
    if (student && printCard) {
        printCard.style.display = 'block';
        const quadName = getQuadStudentName(null, student);
        document.getElementById('printStId').textContent   = student.student_id || '-';
        document.getElementById('printStName').textContent = quadName;
        document.getElementById('printStDept').textContent = student.department || '-';
        document.getElementById('printStLevel').textContent= student.level || '-';
        document.getElementById('printStGpa').textContent  = student.gpa || '0.00';
        document.getElementById('printStCounts').textContent = `ناجح: ${student.passed_count || 0} | راسب: ${student.failed_count || 0}`;
    } else if (printCard) {
        printCard.style.display = 'none';
    }

    if (!printBody) return;

    if (!results || results.length === 0) {
        printBody.innerHTML = `
            <tr>
                <td colspan="9" style="padding:20px;text-align:center;font-weight:bold;border:1px solid #000;">
                    لا توجد بيانات مطابقة لمعايير البحث.
                </td>
            </tr>`;
        return;
    }

    printBody.innerHTML = results.map((row, idx) => {
        const isBlocked     = row.is_blocked;
        const isPublished   = row.is_published !== false;
        const isFinalEntered= row.is_final_entered;
        const quadName      = getQuadStudentName(row, currentStudentData);

        let midtermStr = '--';
        let finalStr   = '--';
        let totalStr   = '--';
        let statusText = '--';

        if (isBlocked) {
            statusText = 'محجوب (غياب)';
        } else if (!isPublished) {
            statusText = 'غير منشور';
        } else {
            if (row.midterm_grade !== null && row.midterm_grade !== undefined) midtermStr = String(row.midterm_grade);

            if (isFinalEntered) {
                if (row.final_grade !== null && row.final_grade !== undefined) finalStr = String(row.final_grade);
                if (row.total_grade !== null && row.total_grade !== undefined) totalStr = String(row.total_grade);

                statusText = row.grade_letter || (row.is_passed ? 'ناجح' : 'راسب');
            } else {
                statusText = 'رصد نصفي';
            }
        }

        return `
            <tr>
                <td style="padding:4px 3px;border:1px solid #000;text-align:center;">${idx + 1}</td>
                <td style="padding:4px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(row.student_id)}</td>
                <td style="padding:4px 4px;border:1px solid #000;text-align:right;font-weight:bold;">${escapeHtml(quadName)}</td>
                <td style="padding:4px 4px;border:1px solid #000;text-align:right;">${escapeHtml(row.course_name)} (${escapeHtml(row.course_code)})</td>
                <td style="padding:4px 3px;border:1px solid #000;text-align:center;">${escapeHtml(row.year_semester || `${row.year || ''} ${row.semester_display || ''}`)}</td>
                <td style="padding:4px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(midtermStr)}</td>
                <td style="padding:4px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(finalStr)}</td>
                <td style="padding:4px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(totalStr)}</td>
                <td style="padding:4px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(statusText)}</td>
            </tr>
        `;
    }).join('');
}

// ============================================================
// ===        البحث الفوري والاقتراحات والأحداث
// ============================================================
function initGradesShowResults() {
    console.log('🚀 Initializing Show Results page v3.3.0...');
    
    loadFilters();
    
    const searchInput    = document.getElementById('searchInput');
    const majorSelect    = document.getElementById('majorSelect');
    const seasonSelect   = document.getElementById('seasonSelect');
    const levelSelect    = document.getElementById('levelSelect');
    const subjectSelect  = document.getElementById('subjectSelect');
    const suggestionsDiv = document.getElementById('studentSuggestions');
    
    const showSuggestions = (query) => {
        if (!suggestionsDiv) return;
        if (!query || query.length < 1) {
            suggestionsDiv.classList.add('hidden');
            return;
        }
        
        fetch(`/grades/api/search-students/?q=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(data => {
                const students = (data.success && data.students) ? data.students : [];
                if (students.length > 0) {
                    suggestionsDiv.innerHTML = '';
                    students.forEach(s => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = "p-2 border-b hover:bg-gray-100 cursor-pointer flex justify-between items-center";
                        itemDiv.style.fontSize = "0.85rem";
                        
                        const textDiv = document.createElement('div');
                        const nameSpan = document.createElement('span');
                        nameSpan.className = "font-bold text-slate-800";
                        nameSpan.textContent = s.full_name || s.quad_name || s.name || 'غير معروف';
                        
                        const idSpan = document.createElement('span');
                        idSpan.className = "text-xs text-gray-500 block";
                        idSpan.textContent = `رقم القيد: ${s.student_id || '-'}`;
                        
                        textDiv.appendChild(nameSpan);
                        textDiv.appendChild(idSpan);
                        
                        const actionSpan = document.createElement('span');
                        actionSpan.className = "text-xs font-bold style-primary";
                        actionSpan.textContent = "اختيار ←";
                        
                        itemDiv.appendChild(textDiv);
                        itemDiv.appendChild(actionSpan);
                        
                        itemDiv.addEventListener('click', () => {
                            if (searchInput) {
                                searchInput.value = s.student_id || s.name || '';
                            }
                            suggestionsDiv.classList.add('hidden');
                            fetchResults();
                        });
                        
                        suggestionsDiv.appendChild(itemDiv);
                    });
                    suggestionsDiv.classList.remove('hidden');
                } else {
                    suggestionsDiv.innerHTML = '<div class="p-2 text-center text-gray-500" style="font-size: 0.85rem;">لا توجد نتائج</div>';
                    suggestionsDiv.classList.remove('hidden');
                }
            })
            .catch(() => {
                suggestionsDiv.classList.add('hidden');
            });
    };
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            const query = searchInput.value.trim();
            showSuggestions(query);
            debounceTimeout = setTimeout(fetchResults, 350);
        });
        searchInput.addEventListener('focus', () => {
            showSuggestions(searchInput.value.trim());
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                suggestionsDiv?.classList.add('hidden');
                fetchResults();
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        if (searchInput && !searchInput.contains(e.target) && suggestionsDiv && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.classList.add('hidden');
        }
    });
    
    if (majorSelect) {
        majorSelect.addEventListener('change', () => {
            updateSubjectsDropdown();
            fetchResults();
        });
    }
    if (seasonSelect) {
        seasonSelect.addEventListener('change', fetchResults);
    }
    if (levelSelect) {
        levelSelect.addEventListener('change', () => {
            updateSubjectsDropdown();
            fetchResults();
        });
    }
    if (subjectSelect) {
        subjectSelect.addEventListener('change', fetchResults);
    }
    
    // 🚀 جلب فوري تلقائي للنتائج عند فتح الصفحة
    fetchResults();
    console.log('✅ Show Results page v3.3.0 initialized');
}

// ============================================================
// ===        دواعي الطباعة المباشرة العمودية (Portrait)
// ============================================================
function ensurePrintContainerInBody() {
    const container = document.getElementById('reportPrintContainer');
    if (container && container.parentNode !== document.body) {
        document.body.appendChild(container);
    }
}

function printPage() {
    if (!lastFetchedResults || lastFetchedResults.length === 0) {
        alert('لا توجد نتائج لطباعتها. يرجى إجراء بحث أولاً.');
        return;
    }

    ensurePrintContainerInBody();
    updatePrintReportTemplate(lastFetchedResults, currentStudentData);

    if (window.OfficialsHelper) {
        window.OfficialsHelper.autoFill().finally(() => {
            window.print();
        });
    } else {
        window.print();
    }
}

function searchResults() {
    fetchResults();
}

function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

window.printPage     = printPage;
window.searchResults = searchResults;
window.goBack        = goBack;
window.fetchResults  = fetchResults;

window.addEventListener('beforeprint', () => {
    ensurePrintContainerInBody();
    updatePrintReportTemplate(lastFetchedResults, currentStudentData);
    if (window.OfficialsHelper) window.OfficialsHelper.autoFill();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initGradesShowResults();
} else {
    document.addEventListener('DOMContentLoaded', initGradesShowResults);
}