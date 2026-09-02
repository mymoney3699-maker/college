/**
 * ============================================================
 * my_materials_report.js v2.4.0
 * طباعة ورقة تنزيل المواد المعتمدة (جدول محكم بدون حدود - 2 أعمدة متوازنة)
 * كلية طرابلس للعلوم والتقنية
 * ============================================================
 */

console.log('✅ my_materials_report.js v2.4.0 loaded successfully');

let isPrinting = false;

async function printMyMaterialsReport() {
    if (isPrinting) return;
    isPrinting = true;

    // 1. استخراج بيانات الطالبة من الشاشة بدقة
    const infoCards = document.querySelectorAll('.info-card');

    let studentName = '.........................';
    let studentId = '.........................';
    let department = '.........................';
    let level = '.........................';
    let semester = document.getElementById('activeSemesterDisplay')?.textContent.trim() || '.........................';

    const elName = document.getElementById('printStudentName');
    const elId = document.getElementById('printStudentId');
    const elDept = document.getElementById('printStudentDept');
    const elLevel = document.getElementById('printStudentLevel');

    if (elName && elName.textContent.trim()) studentName = elName.textContent.trim();
    else if (infoCards.length >= 1) studentName = infoCards[0].querySelectorAll('div')[1]?.textContent.trim() || studentName;

    if (elId && elId.textContent.trim()) studentId = elId.textContent.trim();
    else if (infoCards.length >= 2) studentId = infoCards[1].querySelectorAll('div')[1]?.textContent.trim() || studentId;

    if (elDept && elDept.textContent.trim()) department = elDept.textContent.trim();
    else if (infoCards.length >= 4) department = infoCards[3].querySelectorAll('div')[1]?.textContent.trim() || department;

    if (elLevel && elLevel.textContent.trim()) level = elLevel.textContent.trim();
    else if (infoCards.length >= 5) level = infoCards[4].querySelectorAll('div')[1]?.textContent.trim() || level;

    if (!semester || semester.includes('..') || semester === 'الفصل الدراسي الفعّال') {
        if (infoCards.length >= 6) {
            semester = infoCards[5].querySelectorAll('div')[1]?.textContent.trim() || semester;
        }
    }

    if (!semester || semester.includes('..') || semester === 'الفصل الدراسي الفعّال') {
        semester = 'ربيع 2026';
    }

    // جلب اسم ومنصب منسق الدراسة والامتحانات النشط بدقة تامة
    let coordinatorName = '';
    let coordinatorTitle = 'منسقة الدراسة والامتحانات';

    if (window.OfficialsHelper) {
        const off = await window.OfficialsHelper.getOfficialAsync('exams_coordinator', department);
        if (off) {
            coordinatorName = window.OfficialsHelper.buildName(off);
            if (off.position) coordinatorTitle = off.position;
        }
    }
    if (!coordinatorName) {
        coordinatorName = 'أ. أبرار';
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // مسار الشعار المعتمد
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    // 2. بناء صفوف المواد المسجلة
    const tableRows = document.querySelectorAll('.report-table-row');
    let coursesHtml = '';

    if (tableRows && tableRows.length > 0) {
        tableRows.forEach((row, index) => {
            const cols = row.querySelectorAll('td');
            if (cols.length >= 6) {
                const code = cols[1].textContent.trim();
                const name = cols[2].textContent.trim();
                const units = cols[3].textContent.trim();
                const attempt = cols[4].textContent.trim();
                const regDate = cols[5].textContent.trim();

                coursesHtml += `
                    <tr>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: 800;">${index + 1}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: 800; font-family: monospace; font-size: 12px;">${escapeHtml(code)}</td>
                        <td style="padding: 6px 8px; border: 1px solid #000; text-align: right; font-weight: 800; font-size: 12.5px;">${escapeHtml(name)}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: 800;">${escapeHtml(units)}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: 700;">${escapeHtml(attempt)}</td>
                        <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-size: 11.5px; font-weight: 700;">${escapeHtml(regDate)}</td>
                    </tr>
                `;
            }
        });
    } else {
        coursesHtml = `
            <tr>
                <td colspan="6" style="padding: 20px; text-align: center; font-weight: 800; font-size: 13.5px; border: 1px solid #000;">
                    لا توجد مواد دراسية مسجلة لهذه الطالبة في الفصل الدراسي الحالي.
                </td>
            </tr>
        `;
    }

    // 3. مستند الطباعة المنسق بجدول محكم بدون حدود لمنع أي تداخل بصري
    const printDocumentHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>ورقة تنزيل مواد - ${escapeHtml(studentName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/css/fonts.css">
<style>
    @page {
        size: A4 portrait;
        margin: 6mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: 'Cairo', 'Tajawal', 'Amiri', 'Segoe UI', Tahoma, sans-serif !important;
        background: transparent !important;
        background-color: transparent !important;
        color: #000000 !important;
        text-shadow: none !important;
        box-shadow: none !important;
    }
    html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        font-family: 'Cairo', 'Tajawal', 'Amiri', 'Segoe UI', Tahoma, sans-serif !important;
        direction: rtl;
        font-size: 12.5px;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    /* الإطار الخارجي المعتمد */
    .print-page-frame {
        width: 100%;
        min-height: 272mm;
        margin: 0 auto;
        padding: 18px 24px;
        border: 2px solid #000000 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    /* الترويسة الموحدة الرسمية */
    .print-header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        direction: rtl;
    }
    .print-header-ar {
        flex: 1;
        text-align: center;
        font-size: 11.5px;
        line-height: 1.45;
        color: #000;
    }
    .print-header-logo-box {
        flex: 0 0 95px;
        text-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0 10px;
    }
    .print-header-logo-box img {
        max-height: 75px;
        max-width: 75px;
        width: auto;
        object-fit: contain;
        display: block;
        margin: 0 auto;
    }
    .print-header-en {
        flex: 1;
        text-align: center;
        font-size: 10px;
        line-height: 1.35;
        color: #000;
        direction: ltr;
        font-family: Arial, Tahoma, sans-serif;
    }

    .print-header-line {
        width: 100%;
        margin: 6px 0 10px;
        border-top: 1.5px solid #000000 !important;
        display: block;
    }

    .doc-title {
        font-size: 18px;
        font-weight: 900;
        color: #000;
        text-align: center;
        margin: 6px 0 12px;
        text-decoration: underline;
        text-underline-offset: 5px;
        letter-spacing: 0.5px;
    }

    /* ─── جدول بيانات الطالبة الأكاديمية المحكم بدون حدود (Border-less Table) ─── */
    .student-info-table {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        margin: 10px 0 16px 0;
        border: none !important;
    }
    .student-info-table td {
        border: none !important;
        line-height: 1.7;
        vertical-align: middle;
        padding: 4px 6px;
        font-size: 12.5px;
    }
    .info-lbl {
        font-weight: 800;
        color: #000;
        margin-left: 4px;
        display: inline-block;
    }
    .info-val {
        font-weight: 900;
        color: #000;
    }
    .info-val-mono {
        font-family: monospace, Tahoma, Arial;
        font-size: 13.5px;
        letter-spacing: 0.5px;
    }

    /* جدول المواد المسجلة */
    .courses-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 15px;
        border: 1px solid #000000 !important;
    }
    .courses-table th {
        background-color: #f1f5f9 !important;
        color: #000;
        border: 1px solid #000000 !important;
        padding: 7px 4px;
        font-size: 12px;
        font-weight: 900;
    }
    .courses-table td {
        border: 1px solid #000000 !important;
        font-size: 12px;
    }

    /* التوقيع والاعتماد في اليسار */
    .bf-signatures-container {
        display: flex;
        justify-content: flex-end;
        margin-top: 18px;
        padding-left: 10px;
        page-break-inside: avoid;
    }
    .bf-sig-col {
        text-align: center;
        width: 250px;
    }
    .bf-sig-name {
        font-size: 13.5px;
        font-weight: 900;
        margin-bottom: 3px;
        min-height: 18px;
    }
    .bf-sig-title {
        font-size: 12.5px;
        font-weight: 800;
        color: #111;
        margin-bottom: 18px;
    }
    .bf-sig-dots {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.5px;
    }

    @media print {
        @page { size: A4 portrait; margin: 5mm; }
        html, body { width: 100%; height: 100%; }
        .print-page-frame { min-height: 270mm; border: 2px solid #000000 !important; }
    }
</style>
</head>
<body>
    <div class="print-page-frame">
        <div>
            <!-- 1. الترويسة الرسمية ثنائية اللغة -->
            <div class="print-header-section">
                <!-- اليمين: العربية -->
                <div class="print-header-ar">
                    <div style="font-size: 13.5px; font-weight: 900; margin-bottom: 2px;">دولة ليبيــــا</div>
                    <div style="font-size: 11px; font-weight: 800; margin-bottom: 1px;">حكومة الوحدة الوطنية</div>
                    <div style="font-size: 11px; font-weight: 800; margin-bottom: 1px;">وزارة التعليم التقني والفني</div>
                    <div style="font-size: 12px; font-weight: 900; margin-top: 2px;">كلية طرابلس للعلوم والتقنية</div>
                </div>

                <!-- الوسط: الشعار الدائري -->
                <div class="print-header-logo-box">
                    <img src="${logoUrl}" alt="شعار الكلية" onerror="this.onerror=null; this.style.display='none';">
                </div>

                <!-- اليسار: الإنجليزية -->
                <div class="print-header-en">
                    <div style="font-size: 11.5px; font-weight: bold; margin-bottom: 1px;">State of Libya</div>
                    <div style="font-weight: 600; margin-bottom: 1px;">Government of National Unity</div>
                    <div style="font-weight: 600; margin-bottom: 1px;">Ministry of Technical and Vocational Education</div>
                    <div style="font-size: 10px; font-weight: bold; margin-top: 2px; letter-spacing: 0.4px;">TRIPOLI COLLEGE OF SCIENCE & TECHNOLOGY</div>
                </div>
            </div>

            <div class="print-header-line"></div>
            <div class="doc-title">ورقة تنزيل المواد</div>

            <!-- 2. جدول بيانات الطالبة الأكاديمية المحكم بدون حدود (2 أعمدة متوازنة بدون تداخل) -->
            <table class="student-info-table">
                <tbody>
                    <tr>
                        <td style="width: 58%; text-align: right;">
                            <span class="info-lbl">اسم الطالبة الكامل /</span>
                            <span class="info-val">${escapeHtml(studentName)}</span>
                        </td>
                        <td style="width: 42%; text-align: right;">
                            <span class="info-lbl">رقم القيد /</span>
                            <span class="info-val info-val-mono">${escapeHtml(studentId)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 58%; text-align: right;">
                            <span class="info-lbl">القسم / التخصص /</span>
                            <span class="info-val">${escapeHtml(department)}</span>
                        </td>
                        <td style="width: 42%; text-align: right;">
                            <span class="info-lbl">المستوى الدراسي /</span>
                            <span class="info-val">${escapeHtml(level)}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 58%; text-align: right;">
                            <span class="info-lbl">الفصل الدراسي /</span>
                            <span class="info-val">${escapeHtml(semester)}</span>
                        </td>
                        <td style="width: 42%; text-align: right;">
                            <span class="info-lbl">التاريخ /</span>
                            <span class="info-val">${dateStr} م</span>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- 3. جدول المواد المسجلة -->
            <table class="courses-table">
                <thead>
                    <tr>
                        <th style="width: 35px;">#</th>
                        <th style="width: 110px;">رمز المادة</th>
                        <th>اسم المادة الدراسية</th>
                        <th style="width: 65px;">الوحدات</th>
                        <th style="width: 75px;">المحاولة</th>
                        <th style="width: 100px;">تاريخ التنزيل</th>
                    </tr>
                </thead>
                <tbody>
                    ${coursesHtml}
                </tbody>
            </table>

            <!-- 4. اعتماد التوقيع والختم باليسار أسفل الجدول -->
            <div class="bf-signatures-container">
                <div class="bf-sig-col">
                    <div class="bf-sig-name">${escapeHtml(coordinatorName)}</div>
                    <div class="bf-sig-title">${escapeHtml(coordinatorTitle)}</div>
                    <div class="bf-sig-dots">التوقيع والختم: ....................................</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

    // 4. تنفيذ الطباعة الفورية بـ iframe معزول
    let iframe = document.getElementById('materialsReportPrintIframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'materialsReportPrintIframe';
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;';
        document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(printDocumentHtml);
    doc.close();

    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (e) {
            console.error('Print launch error:', e);
        }
        isPrinting = false;
    }, 60);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// 🔍 البحث الفوري التفاعلي والقائمة المنسدلة للطلبة
// ============================================================

function initMaterialsSearchAutocomplete() {
    const searchInput = document.getElementById('materialsSearchInput');
    const resultsContainer = document.getElementById('materialsSearchResults');
    const searchForm = document.getElementById('materialsSearchForm');
    const resetBtn = document.getElementById('btnResetSearch');

    if (!searchInput || !resultsContainer) return;

    let debounceTimer = null;

    // إظهار/إخفاء زر إعادة الضبط ديناميكياً
    const updateResetButtonVisibility = () => {
        if (resetBtn) {
            const hasValue = searchInput.value.trim().length > 0;
            const urlHasQ = window.location.search.includes('q=');
            resetBtn.style.display = (hasValue || urlHasQ) ? 'inline-flex' : 'none';
        }
    };

    // معالجة زر إعادة الضبط
    if (resetBtn) {
        resetBtn.addEventListener('click', function (e) {
            e.preventDefault();
            searchInput.value = '';
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            window.location.href = window.location.pathname;
        });
    }

    searchInput.addEventListener('input', function () {
        updateResetButtonVisibility();
        clearTimeout(debounceTimer);
        const query = this.value.trim();

        if (query.length < 1) {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        resultsContainer.innerHTML = '<div class="autocomplete-item" style="color:#94a3b8;cursor:default;padding:10px;text-align:center;">⏳ جاري البحث...</div>';
        resultsContainer.style.display = 'block';

        debounceTimer = setTimeout(() => {
            fetch(`/renewal/api/search-student-simple/?search=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.students && data.students.length > 0) {
                        resultsContainer.innerHTML = data.students.map(st => `
                            <div class="autocomplete-item" data-student-id="${escapeHtml(st.student_id)}" style="padding:10px 14px;cursor:pointer;">
                                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                                    <strong style="font-size:0.9rem;">${escapeHtml(st.name)}</strong>
                                    <span class="st-meta" style="font-family:monospace;font-weight:800;font-size:0.82rem;">${escapeHtml(st.student_id)}</span>
                                </div>
                                <div class="st-meta" style="font-size:0.75rem;display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                                    <span>${escapeHtml(st.department_name || '-')}</span>
                                    <span>${st.level_number ? 'المستوى ' + st.level_number : ''}</span>
                                </div>
                            </div>
                        `).join('');
                        resultsContainer.style.display = 'block';

                        // تفعيل النقر لاختيار الطالب وتحميل تقريره فوراً
                        resultsContainer.querySelectorAll('.autocomplete-item[data-student-id]').forEach(item => {
                            item.addEventListener('click', function () {
                                const id = this.getAttribute('data-student-id');
                                searchInput.value = id;
                                resultsContainer.style.display = 'none';
                                updateResetButtonVisibility();
                                window.location.href = `?student_id=${encodeURIComponent(id)}&q=${encodeURIComponent(id)}`;
                            });
                        });
                    } else {
                        resultsContainer.innerHTML = '<div class="autocomplete-item" style="color:#94a3b8;cursor:default;padding:10px;text-align:center;">لا توجد نتائج مطابقة</div>';
                        resultsContainer.style.display = 'block';
                    }
                })
                .catch(err => {
                    console.error('Search error:', err);
                    resultsContainer.innerHTML = '<div class="autocomplete-item" style="color:#e11d48;cursor:default;padding:10px;text-align:center;">❌ حدث خطأ أثناء البحث</div>';
                    resultsContainer.style.display = 'block';
                });
        }, 250);
    });

    // إغلاق القائمة عند النقر في أي مكان خارجها
    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.style.display = 'none';
        }
    });

    // إغلاق القائمة عند الضغط على مفتاح Escape
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            resultsContainer.style.display = 'none';
        }
    });

    updateResetButtonVisibility();
}

document.addEventListener('DOMContentLoaded', () => {
    // ربط أزرار الطباعة في الصفحة
    const printBtns = document.querySelectorAll('button[onclick*="print"]');
    printBtns.forEach(btn => {
        btn.onclick = function (e) {
            e.preventDefault();
            printMyMaterialsReport();
        };
    });

    // تهيئة البحث التفاعلي الفوري والقائمة المنسدلة
    initMaterialsSearchAutocomplete();
});

window.printMyMaterialsReport = printMyMaterialsReport;
window.initMaterialsSearchAutocomplete = initMaterialsSearchAutocomplete;