// ============================================================
// عرض الخطط الدراسية - Study Plans Display JS v2.0.0
// كلية طرابلس للعلوم والتقنية
// ============================================================

console.log('✅ plans_display.js v2.1.1 loaded successfully');

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
// 🏛️ جلب بيانات المسؤولين: المسجل العام بالكلية
// ─────────────────────────────────────────────────────────────
let cachedRegistrarName = '';
let cachedRegistrarTitle = 'المسجل العام بالكلية';

async function fetchActiveOfficials() {
    if (cachedRegistrarName) return cachedRegistrarName;
    try {
        if (window.OfficialsHelper) {
            const off = await window.OfficialsHelper.getOfficialAsync('general_registrar');
            if (off) {
                cachedRegistrarName = window.OfficialsHelper.buildName(off);
                if (off.position) cachedRegistrarTitle = off.position;
                return cachedRegistrarName;
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

// ─────────────────────────────────────────────────────────────
// 🖨️ طباعة الخطة الدراسية الرسمية المعتمدة A4 عبر Hidden iframe
// ─────────────────────────────────────────────────────────────
async function printStudyPlanReport() {
    await fetchActiveOfficials();
    const registrarName = fillRegistrarName();

    const majorSelect = document.getElementById('majorSelect');
    const planNumberSelect = document.getElementById('planNumberSelect');

    let deptName = 'الخطة العامة / جميع التخصصات';
    if (majorSelect && majorSelect.selectedIndex > 0) {
        deptName = majorSelect.options[majorSelect.selectedIndex].text.replace(/^--\s*|\s*--$/g, '').trim();
    }

    let planName = document.querySelector('h2.text-2xl')?.textContent?.trim() || '';
    if (!planName && planNumberSelect && planNumberSelect.selectedIndex > 0) {
        planName = planNumberSelect.options[planNumberSelect.selectedIndex].text.replace(/^--\s*|\s*--$/g, '').trim();
    }
    if (!planName) {
        planName = 'الخطة الدراسية المعتمدة';
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    // جمع بيانات المستويات والمواد من الصفحة
    const levelCards = document.querySelectorAll('.modern-level-card');
    let levelsContentHtml = '';

    if (levelCards && levelCards.length > 0) {
        levelCards.forEach((lvlCard) => {
            const lvlTitle = lvlCard.querySelector('.level-title-text')?.textContent?.trim() || 'المستوى الدراسي';
            let countText = lvlCard.querySelector('.level-course-count-pill')?.textContent?.trim() || '';
            countText = countText.replace(/menu_book/g, '').trim();
            const rows = lvlCard.querySelectorAll('tbody tr');

            let rowsHtml = '';
            rows.forEach((row, idx) => {
                const code = row.querySelector('.td-code')?.textContent?.trim() || '—';
                const name = row.querySelector('.td-name')?.textContent?.trim() || '—';
                const credits = row.querySelector('.td-credits')?.textContent?.trim() || '—';
                const hours = row.querySelector('.td-hours')?.textContent?.trim() || '—';
                const type = row.querySelector('.td-type')?.textContent?.trim() || 'إجباري';
                const prereq = row.querySelector('.td-prereq')?.textContent?.trim() || 'لا يوجد';

                rowsHtml += `
                    <tr>
                        <td style="padding: 5px 4px; border: 1px solid #000; text-align: center; font-weight: 800;">${idx + 1}</td>
                        <td style="padding: 5px 4px; border: 1px solid #000; text-align: center; font-family: monospace; font-weight: 900; font-size: 11.5px;">${escapeHtml(code)}</td>
                        <td style="padding: 5px 8px; border: 1px solid #000; text-align: right; font-weight: 800; font-size: 12px;">${escapeHtml(name)}</td>
                        <td style="padding: 5px 4px; border: 1px solid #000; text-align: center; font-weight: 800;">${escapeHtml(credits)}</td>
                        <td style="padding: 5px 4px; border: 1px solid #000; text-align: center; font-size: 11px; font-weight: 700;">${escapeHtml(hours)}</td>
                        <td style="padding: 5px 4px; border: 1px solid #000; text-align: center; font-size: 11px; font-weight: 700;">${escapeHtml(type)}</td>
                        <td style="padding: 5px 6px; border: 1px solid #000; text-align: center; font-size: 11px; font-weight: 700;">${escapeHtml(prereq)}</td>
                    </tr>
                `;
            });

            levelsContentHtml += `
                <div style="margin-bottom: 14px; page-break-inside: avoid;">
                    <div style="background: #f1f5f9; border: 1.5px solid #000; border-bottom: none; padding: 5px 10px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 13px; font-weight: 900; color: #000;">${escapeHtml(lvlTitle)}</span>
                        <span style="font-size: 11.5px; font-weight: 700; color: #333;">${escapeHtml(countText)}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;">
                        <thead>
                            <tr style="background-color: #e2e8f0; color: #000;">
                                <th style="padding: 5px 4px; border: 1px solid #000; width: 32px; font-size: 11.5px; font-weight: 900; text-align: center;">#</th>
                                <th style="padding: 5px 4px; border: 1px solid #000; width: 100px; font-size: 11.5px; font-weight: 900; text-align: center;">رمز المادة</th>
                                <th style="padding: 5px 8px; border: 1px solid #000; font-size: 11.5px; font-weight: 900; text-align: right;">اسم المقرر الدراسي</th>
                                <th style="padding: 5px 4px; border: 1px solid #000; width: 65px; font-size: 11.5px; font-weight: 900; text-align: center;">الوحدات</th>
                                <th style="padding: 5px 4px; border: 1px solid #000; width: 85px; font-size: 11.5px; font-weight: 900; text-align: center;">الساعات</th>
                                <th style="padding: 5px 4px; border: 1px solid #000; width: 75px; font-size: 11.5px; font-weight: 900; text-align: center;">النوع</th>
                                <th style="padding: 5px 6px; border: 1px solid #000; width: 110px; font-size: 11.5px; font-weight: 900; text-align: center;">المتطلب السابق</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        });
    } else {
        levelsContentHtml = `
            <div style="padding: 30px; text-align: center; font-weight: 800; font-size: 13.5px; border: 1px solid #000; margin: 15px 0;">
                لا توجد مواد مضافة في هذه الخطة الدراسية بعد.
            </div>
        `;
    }

    const printDocumentHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>الخطة الدراسية المعتمدة - ${escapeHtml(planName)}</title>
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
        height: auto;
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
        min-height: auto;
        margin: 0 auto;
        padding: 22px 28px;
        border: 2px solid #000000;
        background: #ffffff;
        box-sizing: border-box;
        display: block;
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
    .plan-meta-grid {
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
    .bf-signatures-container {
        display: flex !important;
        justify-content: flex-end !important;
        margin-top: 35px !important;
        padding-left: 10px !important;
        width: 100% !important;
        box-sizing: border-box !important;
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
        html, body { width: 100%; height: auto; }
        .print-page-frame { min-height: auto; border: 2px solid #000000; }
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
        <div class="bf-title" style="font-size:16.5px;font-weight:900;color:#000;text-align:center;margin:4px 0 10px;">الخطة الدراسية الأكاديمية المعتمدة</div>

        <!-- شبكة بيانات الخطة والتخصص -->
        <div class="plan-meta-grid">
            <div class="meta-item">
                <span class="meta-lbl">الخطة الدراسية:</span>
                <span class="meta-val">${escapeHtml(planName)}</span>
            </div>
            <div class="meta-item">
                <span class="meta-lbl">القسم / التخصص:</span>
                <span class="meta-val">${escapeHtml(deptName)}</span>
            </div>
            <div class="meta-item">
                <span class="meta-lbl">تاريخ الطباعة:</span>
                <span class="meta-val">${dateStr}</span>
            </div>
        </div>

        <!-- جداول المستويات والمواد الدراسية -->
        <div>
            ${levelsContentHtml}
        </div>

        <!-- اعتماد التوقيع والختم في أقصى اليسار: المسجل العام بالكلية -->
        <div class="bf-signatures-container">
            <div class="bf-sig-col">
                <div class="off-name">${escapeHtml(registrarName)}</div>
                <div class="off-pos">${escapeHtml(cachedRegistrarTitle || 'المسجل العام بالكلية')}</div>
                <div class="off-sig">التوقيع والختم: ....................................</div>
            </div>
        </div>
    </div>
</body>
</html>`;

    // ─────────────────────────────────────────────────────────────
    // إنشاء iframe خفي والطباعة من خلاله لمنع تداخل الوضع الداكن
    // ─────────────────────────────────────────────────────────────
    let printIframe = document.getElementById('planPrintIframe');
    if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'planPrintIframe';
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
    doc.write(printDocumentHtml);
    doc.close();

    setTimeout(() => {
        try {
            printIframe.contentWindow.focus();
            printIframe.contentWindow.print();
        } catch (e) {
            console.error('Print frame error:', e);
            const w = window.open('', '_blank');
            w.document.write(printDocumentHtml);
            w.document.close();
            w.focus();
            w.print();
        }
    }, 400);
}

// إتاحة الدالة في نطاق window
window.printStudyPlanReport = printStudyPlanReport;

document.addEventListener('DOMContentLoaded', function () {
    fetchActiveOfficials();
});
