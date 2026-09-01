// ============================================================
// officials_helper.js - النسخة الذكية الكاملة والدقيقة جداً
// تفرقة تامة بين منسق/ة الدراسة والامتحانات ورئيس القسم والمسجل العام
// ============================================================

window.OfficialsHelper = (function () {

    let _cache = null;
    let _fetchPromise = null;

    function fetchOfficials() {
        if (_cache) return Promise.resolve(_cache);
        if (_fetchPromise) return _fetchPromise;

        _fetchPromise = fetch('/users/api/officials/')
            .then(r => r.json())
            .then(data => {
                if (data.success && Array.isArray(data.officials)) {
                    _cache = data.officials.filter(o => o.status === 'active');
                    return _cache;
                }
                return [];
            })
            .catch(() => [])
            .finally(() => {
                _fetchPromise = null;
            });

        return _fetchPromise;
    }

    // تشغيل الجلب المسبق فور تحميل الملف
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fetchOfficials);
    } else {
        fetchOfficials();
    }

    function buildName(official) {
        if (!official) return '';
        const title = (official.title || '').trim();
        const name = (official.name || '').trim();
        return title ? `${title} ${name}` : name;
    }

    // ─────────────────────────────────────────────────────
    // 🔥 المطابقة الدقيقة لمنع تداخل الأدوار والمناصب
    // ─────────────────────────────────────────────────────
    function findMatch(list, positionText, departmentName) {
        if (!Array.isArray(list) || list.length === 0) return null;
        const txt = (positionText || '').trim();
        const txtLower = txt.toLowerCase();
        const dept = (departmentName || '').trim();

        // 1. إذا تم تمرير قسم، نبحث أولاً عن منسق/موظف ذلك القسم المحدد
        if (dept) {
            const deptStaffMatch = list.find(o => {
                if (!o.department_name) return false;
                const matchDept = o.department_name.trim() === dept ||
                                  dept.includes(o.department_name.trim()) ||
                                  o.department_name.trim().includes(dept);
                if (!matchDept) return false;
                if (txt) {
                    if (txtLower.includes('منسق') || txtLower.includes('منسقة') || txtLower.includes('coordinator')) {
                        return (o.role_name && (o.role_name.includes('منسق') || o.role_name.includes('منسقة'))) ||
                               (o.position && (o.position.includes('منسق') || o.position.includes('منسقة')));
                    }
                    if (txtLower.includes('رئيس') || txtLower.includes('head')) {
                        return (o.role_name && o.role_name.includes('رئيس')) ||
                               (o.position && o.position.includes('رئيس'));
                    }
                }
                return true;
            });
            if (deptStaffMatch) return deptStaffMatch;
        }

        // 2. فحص مخصص ودقيق لمنسق/ة الدراسة والامتحانات (تفرقة صارمة عن رئيس القسم)
        const isCoordinatorQuery = ['منسق', 'منسقة', 'coordinator', 'exams_coordinator'].some(k => txtLower.includes(k));
        if (isCoordinatorQuery) {
            // أولاً: البحث عن مفتاح exams_coordinator أو منصب يحتوي كلمة منسق/منسقة
            const coord = list.find(o => {
                if (o.position_key === 'exams_coordinator') return true;
                const pos = (o.position || '').toLowerCase();
                return (pos.includes('منسق') || pos.includes('منسقة')) && (pos.includes('دراس') || pos.includes('امتحان') || pos.includes('exams'));
            }) || list.find(o => {
                const pos = (o.position || '').toLowerCase();
                return pos.includes('منسق') || pos.includes('منسقة');
            });

            if (coord) return coord;
        }

        // 3. فحص مخصص لرئيس قسم الدراسة والامتحانات / قسم الدراسة والامتحانات
        const isExamsHeadQuery = !isCoordinatorQuery && (
            txtLower === 'exams' || txtLower === 'exams_head' ||
            ((txtLower.includes('رئيس') || txtLower.includes('قسم') || txtLower.includes('مدير')) && (txtLower.includes('دراس') || txtLower.includes('امتحان')))
        );
        if (isExamsHeadQuery) {
            const head = list.find(o => {
                if (o.position_key === 'exams_head' || o.position_key === 'exams') return true;
                const pos = (o.position || '').toLowerCase();
                const isHead = (pos.includes('رئيس') || pos.includes('قسم') || pos.includes('مدير')) && (pos.includes('دراس') || pos.includes('امتحان'));
                const notCoord = !pos.includes('منسق') && !pos.includes('منسقة');
                return isHead && notCoord;
            });
            if (head) return head;
        }

        // 4. المسجل العام وشؤون القبول والتسجيل
        if (txtLower.includes('مسجل') || txtLower.includes('registrar')) {
            const reg = list.find(o => o.position_key === 'registrar' || (o.position && o.position.includes('مسجل') && !o.position.includes('رئيس قسم')));
            if (reg) return reg;
        }

        if (txtLower.includes('تسجيل') || txtLower.includes('قبول') || txtLower.includes('admission')) {
            const adm = list.find(o => o.position_key === 'admission' || (o.position && (o.position.includes('تسجيل') || o.position.includes('قبول'))));
            if (adm) return adm;
        }

        // 5. عميد الكلية
        if (txtLower.includes('عميد') || txtLower.includes('dean')) {
            const dean = list.find(o => o.position_key === 'dean' || (o.position && o.position.includes('عميد')));
            if (dean) return dean;
        }

        // 6. الخريجين
        if (txtLower.includes('خريج') || txtLower.includes('graduate')) {
            const grad = list.find(o => o.position_key === 'graduates' || (o.position && o.position.includes('خريج')));
            if (grad) return grad;
        }

        // 7. وكيل الشؤون العلمية
        if (txtLower.includes('وكيل') || txtLower.includes('vice_dean')) {
            const vd = list.find(o => o.position_key === 'vice_dean' || (o.position && o.position.includes('وكيل')));
            if (vd) return vd;
        }

        // 8. الشؤون الإدارية
        if (txtLower.includes('إداري') || txtLower.includes('اداري') || txtLower.includes('admin_affairs')) {
            const admin = list.find(o => o.position_key === 'admin_affairs' || (o.position && (o.position.includes('إداري') || o.position.includes('اداري'))));
            if (admin) return admin;
        }

        // 9. مطابقة عامة بالنص
        return list.find(o => {
            if (!o.position) return false;
            const pos = o.position.trim().toLowerCase();
            return pos === txtLower || pos.includes(txtLower) || txtLower.includes(pos);
        }) || null;
    }

    // ─────────────────────────────────────────────────────
    // 🔥 جلب كائن المسؤول برمجياً (مباشر أو غير متزامن)
    // ─────────────────────────────────────────────────────
    function getOfficial(roleOrPos, departmentName) {
        if (!_cache) return null;
        return findMatch(_cache, roleOrPos, departmentName);
    }

    async function getOfficialAsync(roleOrPos, departmentName) {
        const list = await fetchOfficials();
        return findMatch(list, roleOrPos, departmentName);
    }

    // ─────────────────────────────────────────────────────
    // 🔥 الدالة الرئيسية: تملأ كل عناصر [data-official]
    // ─────────────────────────────────────────────────────
    function autoFill(contextDept) {
        const blocks = document.querySelectorAll('[data-official]');
        if (blocks.length === 0) return Promise.resolve();

        return fetchOfficials().then(list => {
            blocks.forEach(block => {
                const nameEl = block.querySelector('.off-name');
                const posEl  = block.querySelector('.off-pos');

                if (!nameEl) return;

                const attrVal = (block.getAttribute('data-official') || '').trim();
                const posText = posEl ? posEl.textContent.trim() : '';
                const queryText = attrVal || posText;
                const dept = block.getAttribute('data-department') || contextDept || '';

                const official = findMatch(list, queryText, dept);
                if (official) {
                    nameEl.textContent = buildName(official);
                    if (posEl && (!posEl.textContent.trim() || posEl.textContent.trim() === 'منسق الدراسة والامتحانات' || posEl.textContent.trim() === 'منسقة دراسة والامتحانات')) {
                        posEl.textContent = official.position || posEl.textContent;
                    }
                }
            });
        });
    }

    function clearCache() { _cache = null; }

    return { autoFill, clearCache, fetchOfficials, getOfficial, getOfficialAsync, findMatch, buildName };

})();

console.log('✅ officials_helper.js loaded (strict role mapping & non-overlapping hierarchy)');