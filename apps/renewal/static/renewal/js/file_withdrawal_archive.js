/**
 * ============================================================
 * file_withdrawal_archive.js  v3.2.0
 * أرشيف سحب الملفات - كلية طرابلس للعلوم والتقنية
 * متوافق تماماً مع القالب الموحد (BASE_REPORT_TEMPLATE)
 * ============================================================
 */

console.log('✅ file_withdrawal_archive.js v3.2.0 loaded');

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // ① عناصر الشاشة
    // ============================================================
    const searchInput     = document.getElementById('archiveSearch');
    const semesterFilter  = document.getElementById('semesterFilter');
    const deptFilter      = document.getElementById('deptFilter');
    const searchBtn       = document.getElementById('searchBtn');
    const printReportBtn  = document.getElementById('printReportBtn');
    const tableBody       = document.getElementById('archiveTableBody');
    const statTotalCount  = document.getElementById('statTotalCount');
    const toastMsg        = document.getElementById('toastMsg');
    const toastText       = document.getElementById('toastText');

    // ============================================================
    // ② عناصر التقرير المطبوع الموحد
    // ============================================================
    const rptPrintSemester  = document.getElementById('rptPrintSemester');
    const rptPrintDept      = document.getElementById('rptPrintDept');
    const rptPrintTableBody = document.getElementById('rptPrintTableBody');

    let archiveData = [];
    let toastTimer  = null;

    // ============================================================
    // ③ إشعارات Toast
    // ============================================================
    function showToast(msg) {
        if (!toastMsg || !toastText) return;
        toastText.textContent = msg;
        toastMsg.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastMsg.classList.remove('show'), 3000);
    }

    // ============================================================
    // ④ تنظيف نص سبب السحب (إلغاء كلمة أخرى: والاكتفاء بالسبب الفعلي)
    // ============================================================
    function formatReason(reason) {
        if (!reason) return '-';
        let str = String(reason).trim();
        if (str.startsWith('أخرى:')) {
            str = str.substring(5).trim();
        } else if (str.startsWith('أخرى :')) {
            str = str.substring(6).trim();
        } else if (str.startsWith('أخرى -')) {
            str = str.substring(6).trim();
        } else if (/^أخرى\s*[:\-]?\s*/.test(str)) {
            let cleaned = str.replace(/^أخرى\s*[:\-]?\s*/, '').trim();
            if (cleaned) str = cleaned;
        }
        return str || '-';
    }

    function getSelectedText(selectEl, fallback = '—') {
        if (!selectEl) return fallback;
        const idx = selectEl.selectedIndex;
        if (idx < 0) return fallback;
        return selectEl.options[idx].text || fallback;
    }

    // ============================================================
    // ⑤ تحديث معلومات رأس التقرير المطبوع (الفصل والقسم)
    // ============================================================
    function updatePrintMeta() {
        const semText  = getSelectedText(semesterFilter, 'جميع الفصول الدراسية');
        const deptText = getSelectedText(deptFilter,     'كافة الأقسام');

        if (rptPrintSemester) rptPrintSemester.textContent = semText;
        if (rptPrintDept)     rptPrintDept.textContent     = deptText;
    }

    // ============================================================
    // ⑥ تعبئة جدول الشاشة
    // ============================================================
    function renderTable(items) {
        if (!tableBody) return;

        if (!items || items.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align:center;padding:2rem;color:#64748b;font-weight:bold;">
                        لا توجد سجلات مطابقة لسحب الملفات حسب الفلاتر المحددة.
                    </td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = items.map((item, index) => `
            <tr>
                <td style="font-weight:bold;">${index + 1}</td>
                <td style="font-weight:bold;color:#ef4444;">${item.student_id || '-'}</td>
                <td style="font-weight:800;color:#0f172a;">${item.full_name || '-'}</td>
                <td>${item.national_id || '-'}</td>
                <td>
                    <div style="font-weight:700;">${item.department || '-'}</div>
                </td>
                <td style="font-size:0.85rem;font-weight:700;">${item.level || '-'}</td>
                <td style="font-weight:800;color:#334155;">${item.withdrawal_date || '-'}</td>
                <td style="font-size:0.88rem;color:#991b1b;font-weight:700;">${formatReason(item.withdrawal_reason)}</td>
                <td>
                    <span class="badge-withdrawal">
                        <span class="material-symbols-outlined" style="font-size:14px;">folder_off</span>
                        ${item.status || 'مسحوب'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // ============================================================
    // ⑦ تعبئة جدول التقرير المطبوع الموحد
    // ============================================================
    function renderPrintTable(items) {
        if (!rptPrintTableBody) return;

        if (!items || items.length === 0) {
            rptPrintTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding:20px;text-align:center;font-weight:bold;border:1px solid #000;">
                        لا توجد سجلات مطابقة لمعايير البحث.
                    </td>
                </tr>`;
            return;
        }

        rptPrintTableBody.innerHTML = items.map((item, idx) => `
            <tr>
                <td style="padding:7px 5px;border:1px solid #000;text-align:center;">${idx + 1}</td>
                <td style="padding:7px 5px;border:1px solid #000;text-align:center;font-weight:bold;">${item.student_id || '-'}</td>
                <td style="padding:7px 8px;border:1px solid #000;text-align:right;font-weight:600;">${item.full_name || '-'}</td>
                <td style="padding:7px 5px;border:1px solid #000;text-align:center;">${item.national_id || '-'}</td>
                <td style="padding:7px 5px;border:1px solid #000;text-align:center;">${item.department || '-'}</td>
                <td style="padding:7px 5px;border:1px solid #000;text-align:center;">${item.withdrawal_date || '-'}</td>
                <td style="padding:7px 5px;border:1px solid #000;text-align:center;">${formatReason(item.withdrawal_reason)}</td>
            </tr>
        `).join('');
    }

    // ============================================================
    // ⑧ جلب البيانات من الـ API
    // ============================================================
    async function loadArchiveData() {
        if (!tableBody) return;

        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center;padding:2rem;color:#64748b;font-weight:bold;">
                    ⏳ جاري استرجاع أرشيف سحب الملفات...
                </td>
            </tr>`;

        const query    = searchInput    ? searchInput.value.trim()    : '';
        const semester = semesterFilter ? semesterFilter.value         : '';
        const dept     = deptFilter     ? deptFilter.value             : '';

        const url = `/renewal/api/get-file-withdrawal-archive-data/?search=${encodeURIComponent(query)}&semester=${encodeURIComponent(semester)}&department=${encodeURIComponent(dept)}`;

        try {
            const res  = await fetch(url);
            const data = await res.json();

            if (data.success && Array.isArray(data.students)) {
                archiveData = data.students.map(item => ({
                    ...item,
                    withdrawal_reason: formatReason(item.withdrawal_reason)
                }));
                if (statTotalCount) statTotalCount.textContent = data.total_count || archiveData.length;
                renderTable(archiveData);
                updatePrintMeta();
                renderPrintTable(archiveData);
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align:center;padding:2rem;color:#ef4444;font-weight:bold;">
                            ❌ ${data.message || 'فشل استرجاع البيانات'}
                        </td>
                    </tr>`;
            }
        } catch (err) {
            console.error('loadArchiveData error:', err);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align:center;padding:2rem;color:#ef4444;font-weight:bold;">
                        ❌ حدث خطأ في الاتصال بالخادم أثناء استرجاع الأرشيف
                    </td>
                </tr>`;
        }
    }

    // ============================================================
    // ⑨ ضمان نقل حاوية الطباعة إلى <body> مباشرةً
    // ============================================================
    function ensurePrintContainerInBody() {
        const container = document.getElementById('reportPrintContainer');
        if (container && container.parentNode !== document.body) {
            document.body.appendChild(container);
        }
    }

    // ============================================================
    // ⑩ زر الطباعة
    // ============================================================
    if (printReportBtn) {
        printReportBtn.addEventListener('click', () => {
            if (archiveData.length === 0) {
                showToast('⚠️ لا توجد سجلات مطابقة للطباعة');
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
        });
    }

    // ============================================================
    // ⑪ ربط أحداث الفلاتر والبحث
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
    if (searchBtn)      searchBtn.addEventListener('click',       loadArchiveData);

    // ============================================================
    // ⑫ حدث ما قبل الطباعة (Ctrl+P أو أمر المتصفح)
    // ============================================================
    window.addEventListener('beforeprint', () => {
        ensurePrintContainerInBody();
        updatePrintMeta();
        renderPrintTable(archiveData);
        if (window.OfficialsHelper) window.OfficialsHelper.autoFill();
    });

    // ============================================================
    // ⑬ التهيئة عند تحميل الصفحة
    // ============================================================
    ensurePrintContainerInBody();
    if (window.OfficialsHelper) window.OfficialsHelper.autoFill();
    loadArchiveData();
});