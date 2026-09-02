// ============================================================
// استعلام عن مواد الفصل الدراسية - Subject Inquiry JS v2.0.0
// كلية طرابلس للعلوم والتقنية
// ============================================================

let currentCoursesData = [];
let cachedRegistrarName = '';

function showToast(message, isError = false) {
    if (typeof toastSuccess === 'function' && !isError) {
        toastSuccess(message);
    } else if (typeof toastError === 'function' && isError) {
        toastError(message);
    } else if (typeof toastInfo === 'function') {
        toastInfo(message);
    } else {
        console.log(message);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// 🏛️ جلب بيانات المسؤولين ومنسق الدراسة والامتحانات
// ─────────────────────────────────────────────────────────────
let cachedCoordinatorName = '';
let cachedCoordinatorTitle = 'منسقة دراسة والامتحانات';

async function fetchActiveOfficials() {
    if (cachedCoordinatorName) return cachedCoordinatorName;
    try {
        if (window.OfficialsHelper) {
            const off = await window.OfficialsHelper.getOfficialAsync('exams_coordinator');
            if (off) {
                cachedCoordinatorName = window.OfficialsHelper.buildName(off);
                if (off.position) cachedCoordinatorTitle = off.position;
                return cachedCoordinatorName;
            }
        }
    } catch (e) {
        console.warn('Could not fetch officials from API:', e);
    }
    cachedCoordinatorName = 'أ. أبرار';
    return cachedCoordinatorName;
}

function fillRegistrarName() {
    return cachedCoordinatorName || 'أ. أبرار';
}

// ─────────────────────────────────────────────────────────────
// 🔍 جلب وعرض نتائج البحث
// ─────────────────────────────────────────────────────────────
function showSearchResults() {
    const majorSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('levelSelect');
    const semesterTypeSelect = document.getElementById('semesterTypeSelect');
    const semesterYearInput = document.getElementById('semesterYearInput');
    const resultsTableContainer = document.getElementById('searchTableContainer');
    const resultsBody = document.getElementById('resultsBody');
    const resultsCountBadge = document.getElementById('resultsCountBadge');

    const departmentId = majorSelect ? majorSelect.value.trim() : '';
    const levelId = levelSelect ? levelSelect.value.trim() : '';
    const semesterType = semesterTypeSelect ? semesterTypeSelect.value.trim() : '';
    const semesterYear = semesterYearInput ? semesterYearInput.value.trim() : '';

    if (resultsBody) {
        resultsBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: var(--primary, #307e92); font-weight: 700;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        <span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span>
                        جاري جلب المواد الدراسية...
                    </div>
                </td>
            </tr>
        `;
    }

    if (resultsTableContainer) {
        resultsTableContainer.classList.remove('hidden');
        resultsTableContainer.style.display = 'block';
    }

    const params = new URLSearchParams();
    if (departmentId) params.append('department_id', departmentId);
    if (levelId) params.append('level_id', levelId);
    if (semesterType) params.append('semester_type', semesterType);
    if (semesterYear) params.append('semester_year', semesterYear);

    fetch(`/renewal/subject-data-api/?${params.toString()}`, {
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success && data.courses && data.courses.length > 0) {
                currentCoursesData = data.courses;
                let html = '';
                data.courses.forEach((c) => {
                    const instructorsList = (c.instructors && c.instructors.length > 0) ? c.instructors : (c.instructor && c.instructor !== 'غير محدد' ? [c.instructor] : []);
                    let instructorsHtml = '<span style="color: #94a3b8; font-size: 0.8rem;">غير محدد</span>';
                    if (instructorsList.length > 0) {
                        instructorsHtml = '<div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: center;">' +
                            instructorsList.map(inst => `
                            <span style="display: inline-flex; align-items: center; gap: 0.25rem; background: rgba(241, 245, 249, 0.9); border: 1px solid #cbd5e1; color: #334155; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; max-width: 100%;">
                                <span class="material-symbols-outlined" style="font-size: 14px; color: var(--primary, #307e92);">person</span>
                                ${escapeHtml(inst)}
                            </span>
                        `).join('') + '</div>';
                    }

                    const groupsList = (c.groups && c.groups.length > 0) ? c.groups : (c.group ? [c.group] : ['الشعبة العامة']);
                    let groupsHtml = '<div style="display: flex; flex-direction: column; gap: 0.25rem; align-items: center;">' +
                        groupsList.map(grp => `
                        <span style="display: inline-flex; align-items: center; gap: 0.25rem; background: rgba(48, 126, 146, 0.08); border: 1px solid rgba(48, 126, 146, 0.25); color: var(--primary, #307e92); padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">
                            <span class="material-symbols-outlined" style="font-size: 14px;">group</span>
                            ${escapeHtml(grp)}
                        </span>
                    `).join('') + '</div>';

                    html += `
                    <tr class="subject-row" style="border-bottom: 1px solid rgba(203, 213, 225, 0.4); transition: background 0.15s ease;">
                        <td style="padding: 0.85rem 0.6rem; text-align: center; width: 130px;">
                            <span style="display: inline-block; word-break: break-all; overflow-wrap: break-word; white-space: normal; background: rgba(2, 132, 199, 0.1); color: #0284c7; padding: 0.35rem 0.55rem; border-radius: 6px; border: 1px solid rgba(2, 132, 199, 0.25); font-family: monospace; font-weight: 800; font-size: 0.82rem; line-height: 1.3; max-width: 100%;">
                                ${escapeHtml(c.code || '-')}
                            </span>
                        </td>
                        <td style="padding: 0.85rem 1rem;">
                            <strong style="font-size: 0.95rem; display: block; color: inherit;">${escapeHtml(c.name)}</strong>
                        </td>
                        <td style="padding: 0.85rem 0.75rem; text-align: center; width: 130px;">
                            <span style="display: inline-block; background: rgba(48, 126, 146, 0.1); color: var(--primary, #307e92); padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid rgba(48, 126, 146, 0.25); font-size: 0.82rem; font-weight: 700; white-space: nowrap;">
                                ${escapeHtml(c.level || '-')}
                            </span>
                        </td>
                        <td style="padding: 0.85rem 0.75rem; text-align: center; font-weight: 700; width: 90px;">
                            <span style="background: rgba(16, 185, 129, 0.1); color: #059669; padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.8rem; border: 1px solid rgba(16, 185, 129, 0.2); white-space: nowrap;">
                                ${escapeHtml(c.credits)} ساعات
                            </span>
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: #475569;">
                            ${escapeHtml(c.department || 'عام')}
                        </td>
                        <td style="padding: 0.85rem 0.75rem; text-align: center;">
                            ${instructorsHtml}
                        </td>
                        <td style="padding: 0.85rem 0.75rem; text-align: center;">
                            ${groupsHtml}
                        </td>
                    </tr>
                `;
                });

                if (resultsBody) resultsBody.innerHTML = html;
                if (resultsCountBadge) resultsCountBadge.textContent = `${data.courses.length} مادة مطروحة`;
                showToast(`تم جلب ${data.courses.length} مادة بنجاح`);
            } else {
                currentCoursesData = [];
                if (resultsBody) {
                    resultsBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b; font-weight: 700;">
                            ℹ️ لا توجد مواد مطروحة تطابق معايير البحث المحددة.
                        </td>
                    </tr>
                `;
                }
                if (resultsCountBadge) resultsCountBadge.textContent = `0 مادة`;
                showToast('لا توجد مواد مطروحة لهذه المعايير');
            }
        })
        .catch(err => {
            console.error('Error fetching subject inquiry data:', err);
            currentCoursesData = [];
            if (resultsBody) {
                resultsBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444; font-weight: 700;">
                        ❌ حدث خطأ أثناء جلب البيانات. يرجى المحاولة لاحقاً.
                    </td>
                </tr>
            `;
            }
            showToast('تعذر جلب بيانات المواد', true);
        });
}

// ─────────────────────────────────────────────────────────────
// 🖨️ نظام الطباعة الرسمي المعتمد A4 عبر Hidden iframe
// ─────────────────────────────────────────────────────────────
async function printPage() {
    await fetchActiveOfficials();
    const registrarName = fillRegistrarName();

    const majorSelect = document.getElementById('majorSelect');
    const levelSelect = document.getElementById('levelSelect');
    const semesterTypeSelect = document.getElementById('semesterTypeSelect');
    const semesterYearInput = document.getElementById('semesterYearInput');

    let deptName = 'جميع الأقسام';
    if (majorSelect && majorSelect.selectedIndex > 0) {
        deptName = majorSelect.options[majorSelect.selectedIndex].text.replace(/^--\s*|\s*--$/g, '').trim();
    }

    let levelName = 'جميع المستويات';
    if (levelSelect && levelSelect.selectedIndex > 0) {
        levelName = levelSelect.options[levelSelect.selectedIndex].text.replace(/^--\s*|\s*--$/g, '').trim();
    }

    let seasonName = 'ربيع';
    if (semesterTypeSelect && semesterTypeSelect.value) {
        seasonName = (semesterTypeSelect.value === 'fall' || semesterTypeSelect.value.includes('خريف')) ? 'خريف' : 'ربيع';
    }
    const yearVal = semesterYearInput ? (semesterYearInput.value.trim() || '2026') : '2026';
    const semesterFormatted = `${seasonName} ${yearVal}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    // بناء صفوف المواد
    let rowsHtml = '';
    if (currentCoursesData && currentCoursesData.length > 0) {
        currentCoursesData.forEach((c, idx) => {
            const inst = (c.instructors && c.instructors.length > 0) ? c.instructors.join('، ') : (c.instructor && c.instructor !== 'غير محدد' ? c.instructor : '—');
            const grp = (c.groups && c.groups.length > 0) ? c.groups.join('، ') : (c.group || 'الشعبة العامة');

            rowsHtml += `
                <tr>
                    <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: 800;">${idx + 1}</td>
                    <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-family: monospace; font-weight: 900; font-size: 12px;">${escapeHtml(c.code || '-')}</td>
                    <td style="padding: 6px 8px; border: 1px solid #000; text-align: right; font-weight: 800; font-size: 12.5px;">${escapeHtml(c.name)}</td>
                    <td style="padding: 6px 6px; border: 1px solid #000; text-align: center; font-weight: 700; font-size: 12px;">${escapeHtml(c.level || '-')}</td>
                    <td style="padding: 6px 4px; border: 1px solid #000; text-align: center; font-weight: 700;">${escapeHtml(c.credits)} ساعات</td>
                    <td style="padding: 6px 6px; border: 1px solid #000; text-align: center; font-weight: 800;">${escapeHtml(c.department || 'عام')}</td>
                    <td style="padding: 6px 6px; border: 1px solid #000; text-align: center; font-size: 11.5px; font-weight: 700;">${escapeHtml(inst)}</td>
                    <td style="padding: 6px 6px; border: 1px solid #000; text-align: center; font-size: 11.5px; font-weight: 700;">${escapeHtml(grp)}</td>
                </tr>
            `;
        });
    } else {
        rowsHtml = `
            <tr>
                <td colspan="8" style="padding: 24px; text-align: center; font-weight: 800; font-size: 13px; border: 1px solid #000;">
                    لا توجد مواد مطروحة تطابق معايير البحث المحددة.
                </td>
            </tr>
        `;
    }

    const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>كشف المواد والمقررات الدراسية المطروحة</title>
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
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin: 8px 0 12px 0 !important;
        padding: 6px 10px !important;
        border: 1.5px solid #000000 !important;
        background: #f8fafc !important;
        font-size: 11.5px !important;
        box-sizing: border-box !important;
        width: 100% !important;
    }
    .meta-item {
        display: inline-flex !important;
        align-items: center !important;
        white-space: nowrap !important;
        gap: 4px !important;
    }
    .meta-lbl {
        font-weight: 700 !important;
        color: #000 !important;
    }
    .meta-val {
        font-weight: 900 !important;
        color: #000 !important;
    }
    .courses-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
    }
    .courses-table th {
        background-color: #f1f5f9;
        color: #000000;
        border: 1px solid #000000;
        padding: 6px 4px;
        font-size: 12px;
        font-weight: 900;
        text-align: center;
    }
    .courses-table td {
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
            <div class="bf-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">جدول المواد والمقررات الدراسية المطروحة</div>

            <!-- شبكة بيانات الفلترة والتقرير في صف أفقي واحد متناسق -->
            <div class="report-meta-grid">
                <div class="meta-item">
                    <span class="meta-lbl">القسم:</span>
                    <span class="meta-val">${escapeHtml(deptName)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">المستوى الدراسي:</span>
                    <span class="meta-val">${escapeHtml(levelName)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">الفصل:</span>
                    <span class="meta-val">${escapeHtml(seasonName)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">السنة:</span>
                    <span class="meta-val">${escapeHtml(yearVal)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-lbl">تاريخ التقرير:</span>
                    <span class="meta-val">${dateStr}</span>
                </div>
            </div>

            <!-- جدول المقررات -->
            <table class="courses-table">
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th style="width: 85px;">رمز المادة</th>
                        <th>اسم المادة</th>
                        <th style="width: 90px;">المستوى الدراسي</th>
                        <th style="width: 65px;">الساعات</th>
                        <th style="width: 110px;">القسم</th>
                        <th style="width: 130px;">الأستاذ المدرس</th>
                        <th style="width: 90px;">الشعبة</th>
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
                <div class="off-pos">منسق الدراسة والامتحانات</div>
                <div class="off-sig">التوقيع والختم: ....................................</div>
            </div>
        </div>
    </div>
</body>
</html>`;

    // ─────────────────────────────────────────────────────────────
    // إنشاء iframe خفي والطباعة من خلاله لمنع تأثير الـ Dark Mode
    // ─────────────────────────────────────────────────────────────
    let printIframe = document.getElementById('appPrintIframe');
    if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'appPrintIframe';
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

function goBack() {
    if (document.referrer) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
}

// ─────────────────────────────────────────────────────────────
// تشغيل عند تحميل الصفحة
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    fetchActiveOfficials();

    const searchInputs = ['majorSelect', 'levelSelect', 'semesterTypeSelect', 'semesterYearInput'];
    searchInputs.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    showSearchResults();
                }
            });
            if (elem.tagName === 'SELECT') {
                elem.addEventListener('change', function () {
                    showSearchResults();
                });
            }
        }
    });

    // استعلام فوري عند الدخول
    showSearchResults();
});
