/**
 * ============================================================
 * graduation_archive.js v2.2.0
 * إدارة واستعراض وطباعة تقارير أرشيف إفادات التخرج
 * كلية طرابلس للعلوم والتقنية
 * ============================================================
 */

console.log('✅ graduation_archive.js v2.2.0 loaded');

// ============================================================
// دالة مساعدة escapeHtml لمنع أخطاء التضمين والـ XSS
// ============================================================
function escapeHtml(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// دالة تنظيف التخصص (إلغاء الخطة الدراسية وإرجاع التخصص فقط)
// ============================================================
function getCleanMajor(major) {
    if (!major) return '';
    const str = String(major).trim();
    if (/الخطة|خطة|plan/i.test(str)) {
        return '';
    }
    return str;
}

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // ① عناصر الشاشة
    // ============================================================
    const searchInput    = document.getElementById('archiveSearch');
    const semesterFilter = document.getElementById('semesterFilter');
    const deptFilter     = document.getElementById('deptFilter');
    const statusFilter   = document.getElementById('statusFilter');
    const refreshBtn     = document.getElementById('refreshBtn');
    const printReportBtn = document.getElementById('printReportBtn');
    const tableBody      = document.getElementById('archiveTableBody');

    const statTotalCount   = document.getElementById('statTotalCount');
    const statIssuedCount  = document.getElementById('statIssuedCount');
    const statPendingCount = document.getElementById('statPendingCount');

    const toastMsg  = document.getElementById('toastMsg');
    const toastText = document.getElementById('toastText');

    let archiveData = [];
    let toastTimer  = null;

    // ============================================================
    // ② إشعارات Toast
    // ============================================================
    function showToast(msg) {
        if (!toastMsg || !toastText) return;
        toastText.textContent = msg;
        toastMsg.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastMsg.classList.remove('show'), 3500);
    }

    // ============================================================
    // ③ قراءة النص المختار من الفلاتر
    // ============================================================
    function getSelectedText(selectEl, fallback = 'الكل') {
        if (!selectEl) return fallback;
        const idx = selectEl.selectedIndex;
        if (idx < 0) return fallback;
        const text = selectEl.options[idx].text;
        if (!text || text.includes('جميع ') || text.includes('--')) return fallback;
        return text;
    }

    // ============================================================
    // ④ جلب بيانات الأرشيف من API
    // ============================================================
    async function loadArchiveData() {
        if (!tableBody) return;
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b; font-weight: bold;">
                    ⏳ جاري تحميل بيانات أرشيف الخريجين وإفادات التخرج...
                </td>
            </tr>
        `;

        const query    = searchInput    ? searchInput.value.trim()    : '';
        const semester = semesterFilter ? semesterFilter.value        : '';
        const dept     = deptFilter     ? deptFilter.value            : '';
        const status   = statusFilter   ? statusFilter.value          : '';

        const url = `/renewal/api/get-graduation-archive-data/?search=${encodeURIComponent(query)}&semester=${encodeURIComponent(semester)}&department=${encodeURIComponent(dept)}&status=${encodeURIComponent(status)}`;

        try {
            const res  = await fetch(url);
            const data = await res.json();

            if (data.success && Array.isArray(data.archive)) {
                archiveData = data.archive.map(item => {
                    let cleanM = item.major || item.specialty || '';
                    if (/الخطة|خطة|plan/i.test(String(cleanM))) {
                        cleanM = (item.specialty && !/الخطة|خطة|plan/i.test(String(item.specialty))) ? item.specialty : '';
                    }
                    return {
                        ...item,
                        major: cleanM
                    };
                });

                if (statTotalCount)   statTotalCount.textContent   = data.total_count   || archiveData.length;
                if (statIssuedCount)  statIssuedCount.textContent  = data.issued_count  || 0;
                if (statPendingCount) statPendingCount.textContent = data.pending_count || 0;

                renderTable(archiveData);
                updatePrintMeta();
                renderPrintTable(archiveData);

            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444; font-weight: bold;">
                            ❌ ${data.message || 'فشل استرجاع أرشيف الخريجين'}
                        </td>
                    </tr>
                `;
            }
        } catch (err) {
            console.error('loadArchiveData error:', err);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444; font-weight: bold;">
                        ❌ حدث خطأ في الاتصال بالخادم أثناء استرجاع الأرشيف
                    </td>
                </tr>
            `;
        }
    }

    // ============================================================
    // ⑤ عرض جدول الشاشة
    // ============================================================
    function renderTable(items) {
        if (!tableBody) return;

        if (items.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b; font-weight: bold;">
                        لا توجد سجلات مطابقة في أرشيف الخريجين.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = items.map((item, index) => {
            const statusBadge = item.is_certificate_issued ?
                `<span class="badge-cert-status issued"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> مصدورة ومؤرشفة</span>` :
                `<span class="badge-cert-status pending"><span class="material-symbols-outlined" style="font-size:14px;">pending</span> غير مصدورة</span>`;

            const certTag = item.is_certificate_issued ?
                `<span class="cert-serial-tag">${escapeHtml(item.certificate_number)}</span>` :
                `<span style="color: #94a3b8;">—</span>`;

            const cleanM = getCleanMajor(item.major || item.specialty);
            const majorHtml = cleanM ? `<div style="font-size: 0.8rem; color: #64748b;">${escapeHtml(cleanM)}</div>` : '';

            return `
                <tr>
                    <td style="font-weight: bold;">${index + 1}</td>
                    <td style="font-weight: bold; color: #307e92;">${escapeHtml(item.id)}</td>
                    <td style="font-weight: 800; color: #0f172a;">${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.national || '-')}</td>
                    <td>
                        <div style="font-weight: 700;">${escapeHtml(item.dept || '-')}</div>
                        ${majorHtml}
                    </td>
                    <td>
                        <div style="font-weight: 800; color: #307e92;">${item.gpa || '-'}</div>
                        <div style="font-size: 0.8rem; color: #b89535; font-weight: 800;">${escapeHtml(item.grade || '-')}</div>
                    </td>
                    <td>${certTag}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');

        const footerCount = document.getElementById('footerCount');
        if (footerCount) footerCount.textContent = items.length;
    }

    // ============================================================
    // ⑥ تحديث معلومات التقرير المطبوع الموحد (الفصل، القسم، الحالة)
    // ============================================================
    function updatePrintMeta() {
        const rptSemester = document.getElementById('rptPrintSemester');
        const rptDept     = document.getElementById('rptPrintDept');
        const rptStatus   = document.getElementById('rptPrintStatus');

        if (rptSemester) rptSemester.textContent = getSelectedText(semesterFilter, 'جميع الفصول الدراسية');
        if (rptDept)     rptDept.textContent     = getSelectedText(deptFilter,     'كافة الأقسام');
        if (rptStatus)   rptStatus.textContent   = getSelectedText(statusFilter,   'جميع الحالات');
    }

    // ============================================================
    // ⑦ تعبئة جدول التقرير المطبوع بالبيانات المفلترة الحالية
    // ============================================================
    function renderPrintTable(items) {
        const printBody = document.getElementById('rptPrintTableBody');
        if (!printBody) return;

        if (!items || items.length === 0) {
            printBody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding:20px;text-align:center;font-weight:bold;border:1px solid #000;">
                        لا توجد سجلات مطابقة لمعايير البحث الحالية.
                    </td>
                </tr>`;
            return;
        }

        printBody.innerHTML = items.map((item, idx) => {
            const cleanM = getCleanMajor(item.major || item.specialty);
            const deptText = escapeHtml(item.dept || '-');
            const fullDeptText = cleanM ? `${deptText} - ${escapeHtml(cleanM)}` : deptText;

            return `
                <tr>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;">${idx + 1}</td>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(item.id || '-')}</td>
                    <td style="padding:5px 5px;border:1px solid #000;text-align:right;font-weight:bold;">${escapeHtml(item.name || '-')}</td>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;">${escapeHtml(item.national || '-')}</td>
                    <td style="padding:5px 4px;border:1px solid #000;text-align:center;">${fullDeptText}</td>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${item.gpa || '-'} (${escapeHtml(item.grade || '-')})</td>
                    <td style="padding:5px 3px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(item.certificate_number || '-')}</td>
                </tr>
            `;
        }).join('');
    }

    // ============================================================
    // ⑧ نقل حاوية الطباعة لـ <body> وزر الطباعة المباشرة
    // ============================================================
    function ensurePrintContainerInBody() {
        const container = document.getElementById('reportPrintContainer');
        if (container && container.parentNode !== document.body) {
            document.body.appendChild(container);
        }
    }

    function printOfficialReport() {
        if (!archiveData || archiveData.length === 0) {
            showToast('⚠️ لا توجد سجلات مطابقة لطباعتها في النتائج الحالية');
            return;
        }

        ensurePrintContainerInBody();
        updatePrintMeta();
        renderPrintTable(archiveData);

        if (window.OfficialsHelper) {
            window.OfficialsHelper.autoFill().finally(() => {
                window.print();
            });
        } else {
            window.print();
        }
    }

    // 🖨️ طباعة كشف خريجي الفصل الجماعي (Batch Semester Print Report - الخريجون المصدورة إفاداتهم فقط)
    function printBatchSemesterGraduates() {
        if (!archiveData || archiveData.length === 0) {
            showToast('⚠️ لا توجد سجلات خريجين معروضة للطباعة');
            return;
        }

        // 🌟 استبعاد الطلاب الذين لم تُصدر لهم إفادة تخرج بعد (في انتظار الإصدار) من الكشف الرسمي المطبوع
        const issuedGraduates = archiveData.filter(item => item.is_certificate_issued && item.certificate_number);

        if (issuedGraduates.length === 0) {
            showToast('⚠️ لا يوجد خريجون صُدرت لهم إفادات تخرج معتمدة وموثقة في هذا الكشف للطباعة');
            return;
        }

        const selectedSemText = semesterFilter && semesterFilter.options[semesterFilter.selectedIndex] ? semesterFilter.options[semesterFilter.selectedIndex].text : 'جميع الفصول الدراسية';
        const selectedDeptText = deptFilter && deptFilter.options[deptFilter.selectedIndex] ? deptFilter.options[deptFilter.selectedIndex].text : 'جميع الأقسام الأكاديمية';

        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        let rowsHtml = issuedGraduates.map((item, index) => {
            const cleanM = getCleanMajor(item.major || item.specialty);
            const deptText = item.dept || '—';
            const majorSubText = cleanM ? `<br><small style="color:#64748b;">${cleanM}</small>` : '';

            return `
                <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 8px; text-align: center; font-weight: bold;">${index + 1}</td>
                    <td style="padding: 8px; text-align: center; font-weight: bold; font-family: monospace;">${item.id}</td>
                    <td style="padding: 8px; font-weight: 800;">${item.name}</td>
                    <td style="padding: 8px; text-align: center;">${item.national || '—'}</td>
                    <td style="padding: 8px;">${deptText}${majorSubText}</td>
                    <td style="padding: 8px; text-align: center; font-weight: 800; color: #307e92;">${item.gpa}</td>
                    <td style="padding: 8px; text-align: center; font-weight: bold;">${item.grade}</td>
                    <td style="padding: 8px; text-align: center; font-size: 0.85rem;"><strong style="color:#065f46;">${item.certificate_number}</strong></td>
                </tr>
            `;
        }).join('');

        const printCertInner = document.getElementById('printCertInner');
        const printPreview = document.getElementById('printPreview');

        if (printCertInner) {
            printCertInner.innerHTML = `
            <div class="official-batch-report" style="padding: 1.5rem; background: #fff; color: #0f172a; direction: rtl; text-align: right; font-family: 'Cairo', Arial, sans-serif;">
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
                        <img src="/static/images/شعار الكلية.jpeg" alt="شعار الكلية" class="print-college-logo" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.style.display='none'">
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
                <div style="text-align: center; margin-bottom: 12px;">
                    <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: #000;">كشف الخريجين المعتمد (الإفادات الصادرة)</h2>
                    <div style="font-size: 0.9rem; font-weight: 700; color: #475569; margin-top: 4px;">(${selectedSemText})</div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #000; font-weight: 700; margin-bottom: 12px;">
                    <div>القسم الفعلي: <strong>${selectedDeptText}</strong></div>
                    <div>تاريخ التقرير: <strong>${formattedDate}</strong></div>
                    <div>إجمالي الإفادات الصادرة: <strong>${issuedGraduates.length}</strong></div>
                </div>

                <!-- جدول الطلاب الخريجين المعتمدين -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 35px; font-size: 0.9rem;">
                    <thead>
                        <tr style="background: #f1f5f9; border-bottom: 2px solid #307e92; color: #307e92;">
                            <th style="padding: 10px; text-align: center; width: 40px;">#</th>
                            <th style="padding: 10px; text-align: center; width: 110px;">رقم القيد</th>
                            <th style="padding: 10px; text-align: right;">اسم الطالب الخريج</th>
                            <th style="padding: 10px; text-align: center; width: 120px;">الرقم الوطني</th>
                            <th style="padding: 10px; text-align: right;">القسم والتخصص</th>
                            <th style="padding: 10px; text-align: center; width: 90px;">المعدل</th>
                            <th style="padding: 10px; text-align: center; width: 90px;">التقدير</th>
                            <th style="padding: 10px; text-align: center; width: 140px;">رقم الإفادة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <!-- التوقيعات الرسمية -->
                <div style="display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px;">
                    <div style="text-align: center; width: 40%;">
                        <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 35px;">المسجل العام بالكلية</div>
                        <div style="font-size: 0.85rem; color: #64748b;">التوقيع والختم: ................................</div>
                    </div>
                    <div style="text-align: center; width: 40%;">
                        <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 35px;">عميد الكلية</div>
                        <div style="font-size: 0.85rem; color: #64748b;">التوقيع والختم: ................................</div>
                    </div>
                </div>
            </div>
            `;
        }

        if (printPreview) printPreview.classList.add('open');
        setTimeout(() => {
            window.print();
        }, 150);
    }
    window.printBatchSemesterGraduates = printBatchSemesterGraduates;


    // ============================================================
    // ⑨ ربط أحداث الفلاتر والأزرار
    // ============================================================
    let searchTimer;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(loadArchiveData, 300);
        });
    }

    if (semesterFilter) semesterFilter.addEventListener('change', loadArchiveData);
    if (deptFilter)     deptFilter.addEventListener('change',     loadArchiveData);
    if (statusFilter)   statusFilter.addEventListener('change',   loadArchiveData);
    if (refreshBtn)     refreshBtn.addEventListener('click',       loadArchiveData);
    if (printReportBtn) printReportBtn.addEventListener('click',  printOfficialReport);


    // ============================================================
    // ⑩ حدث ما قبل الطباعة
    // ============================================================
    window.addEventListener('beforeprint', () => {
        ensurePrintContainerInBody();
        updatePrintMeta();
        renderPrintTable(archiveData);
        if (window.OfficialsHelper) window.OfficialsHelper.autoFill();
    });

    // ============================================================
    // ⑪ تهيئة التقرير عند التحميل
    // ============================================================
    ensurePrintContainerInBody();
    if (window.OfficialsHelper) window.OfficialsHelper.autoFill();

    const printBatchSemesterBtn = document.getElementById('printBatchSemesterBtn');
    if (printBatchSemesterBtn) {
        printBatchSemesterBtn.addEventListener('click', printBatchSemesterGraduates);
    }

    loadArchiveData();
});