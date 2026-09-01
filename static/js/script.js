// =========================================================
// script.js — دوال عامة للنظام (QR, Logout)
// ملاحظة: toggleMenu و toggleProfileMenu و toggleUserMenu
//         محددة في sidebar-state.js الذي يُحمَّل قبل هذا الملف
// =========================================================

if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                colors: {
                    primary: "#307e92",
                    accent: "#b59b66",
                    "bg-light": "#f1f5f9",
                    "bg-dark": "#1e293b"
                }
            },
        },
    };
}

// ─────────────────────────────────────────────────────────
// QR Code (عام — يُستخدم في صفحة بيانات الطالب وغيرها)
// ─────────────────────────────────────────────────────────
function generateQRData() {
    return document.getElementById('studentId')?.value || '';
}

function updateQRCode() {

    const qrContainer = document.getElementById('qrcode');
    if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: generateQRData(),
            width: 120,
            height: 120,
            colorDark: '#307e92',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

// ─────────────────────────────────────────────────────────
// تسجيل الخروج (رابط مباشر)
// ─────────────────────────────────────────────────────────
function logout() {
    window.location.href = '/users/logout/';
}

// ─────────────────────────────────────────────────────────
// نظام الرسائل الموحد - Unified Toast System
// ─────────────────────────────────────────────────────────
function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.top = '96px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.zIndex = '99999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.gap = '10px';
        container.style.pointerEvents = 'none';
        container.style.width = '90%';
        container.style.maxWidth = '480px';
        document.body.appendChild(container);
    }
    return container;
}

function createSystemToast(message, type = 'info', duration = 4000) {
    const container = getToastContainer();
    const toast = document.createElement('div');

    let colorClass = '';
    let icon = '';

    if (type === 'success') {
        colorClass = 'bg-green-100 text-green-700 border border-green-300';
        icon = '✅';
    } else if (type === 'error') {
        colorClass = 'bg-red-100 text-red-700 border border-red-300';
        icon = '❌';
    } else if (type === 'info') {
        colorClass = 'bg-blue-100 text-blue-700 border border-blue-300';
        icon = 'ℹ️';
    } else {
        colorClass = 'bg-yellow-100 text-yellow-700 border border-yellow-300';
        icon = '⚠️';
    }

    toast.className = `toast-message rounded-lg text-center font-bold ${colorClass}`;
    toast.style.padding = '12px 24px';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'center';
    toast.style.gap = '10px';
    toast.style.minWidth = '300px';
    toast.style.pointerEvents = 'auto';
    toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';

    const textMsg = (message !== undefined && message !== null) ? String(message) : '';

    toast.innerHTML = `
        <span style="font-size: 1.25rem; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;">${icon}</span>
        <div style="flex-grow: 1; text-align: center; font-size: 0.9rem; line-height: 1.4;">${textMsg}</div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    const hideAndRemove = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px) scale(0.95)';
        setTimeout(() => toast.remove(), 300);
    };

    const timer = setTimeout(hideAndRemove, duration);

    toast.addEventListener('click', () => {
        clearTimeout(timer);
        hideAndRemove();
    });

    return toast;
}

function showToast(message, type = 'info', duration = 4000) { return createSystemToast(message, type, duration); }
function toastSuccess(message, duration = 3000) { return createSystemToast(message, 'success', duration); }
function toastError(message, duration = 4000) { return createSystemToast(message, 'error', duration); }
function toastWarning(message, duration = 3000) { return createSystemToast(message, 'warning', duration); }
function toastInfo(message, duration = 3000) { return createSystemToast(message, 'info', duration); }

window.createSystemToast = createSystemToast;
window.showToast = showToast;
window.toastSuccess = toastSuccess;
window.toastError = toastError;
window.toastWarning = toastWarning;
window.toastInfo = toastInfo;

// دالة مساعدة لتشغيل الكود بأمان عند جاهزية الدوم وتجنب المشاكل في حال تم تحميل الملف متأخراً
function runWhenReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

// ─────────────────────────────────────────────────────────
// معالجة رسائل Django تلقائياً عند تحميل الصفحة
// ─────────────────────────────────────────────────────────
runWhenReady(() => {
    window.isDjangoMessage = true;
    const messageElements = document.querySelectorAll('#django-messages .django-message');
    messageElements.forEach(el => {
        const text = el.textContent || el.innerText;
        const tags = el.getAttribute('data-tags') || '';
        if (tags.includes('success')) {
            window.toastSuccess(text);
        } else if (tags.includes('error')) {
            window.toastError(text);
        } else if (tags.includes('warning')) {
            window.toastWarning(text);
        } else {
            window.toastInfo(text);
        }
    });
    window.isDjangoMessage = false;
});

// دالة فتح وإغلاق السايدبار للموبايل
window.toggleMobileSidebar = function () {
    const sidebar = document.querySelector('aside, .app-sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
    if (backdrop) {
        backdrop.classList.toggle('visible');
    }
};

// إنشاء الخلفية المظلمة للموبايل ديناميكياً عند تحميل الصفحة
runWhenReady(() => {
    let backdrop = document.getElementById('sidebarBackdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', () => {
            window.toggleMobileSidebar();
        });
    }
});

// إيقاف جميع التنبيهات والرسائل ونوافذ التأكيد في هذا التطبيق (للفرونت إند) - تم إزالة الحظر لتفعيل رسائل الخطأ والنجاح والـ Toasts
/*
if (window.location.pathname.indexOf('/users/') === -1) {
    window.alert = function(msg) { console.log('Alert blocked:', msg); };
    window.confirm = function(msg) { console.log('Confirm blocked (returned true):', msg); return true; };
    window.showToast = function() { return { remove: function() {} }; };
    window.toastSuccess = window.toastError = window.toastWarning = window.toastInfo = window.showToastMessage = function() {};
}
*/

// ─────────────────────────────────────────────────────────
// القوائم المنسدلة المخصصة المتوسعة داخلياً (Custom Inline Selects)
// ─────────────────────────────────────────────────────────
(function () {
    const originalValueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (originalValueSetter) {
        Object.defineProperty(HTMLSelectElement.prototype, 'value', {
            set: function (val) {
                originalValueSetter.call(this, val);
                this.dispatchEvent(new CustomEvent('valueupdated'));
            }
        });
    }
})();

function syncInquiryPadding(optionsContainer, isOpen) {
    const gb = optionsContainer.closest('.inquiry-group-box') || optionsContainer.closest('.system-card-box') || optionsContainer.closest('.group-box');
    if (!gb) return;
    if (isOpen) {
        const scrollHeight = optionsContainer.scrollHeight;
        const height = Math.min(260, scrollHeight || 180);
        gb.style.setProperty('padding-bottom', `calc(2rem + ${height}px)`, 'important');
    } else {
        gb.style.removeProperty('padding-bottom');
    }
}
window.syncInquiryPadding = syncInquiryPadding;

function initializeCustomSelects() {
    const selects = document.querySelectorAll('.group-box select:not([multiple]):not(.hidden):not(.no-custom-select), .system-card-box select:not([multiple]):not(.hidden):not(.no-custom-select), .modern-form-container select:not([multiple]):not(.hidden):not(.no-custom-select)');
    selects.forEach(select => {
        if (select.classList.contains('custom-select-converted')) {
            if (select.rebuildCustomOptions) {
                const wrapper = select.nextSibling;
                if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
                    const optionsContainer = wrapper.querySelector('.custom-select-options');
                    if (optionsContainer) {
                        const customOptions = optionsContainer.querySelectorAll('.custom-select-option');
                        if (select.options.length !== customOptions.length) {
                            select.rebuildCustomOptions();
                        }
                    }
                }
            }
            return;
        }
        if (select.classList.contains('no-custom-select') || select.id === 'userSelect' || select.style.display === 'none') {
            return;
        }

        select.classList.add('custom-select-converted');
        select.style.display = 'none';

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-select-trigger';

        const triggerText = document.createElement('span');
        const selectedOption = select.options[select.selectedIndex];
        triggerText.textContent = selectedOption ? selectedOption.textContent : '-- اختر --';

        const arrow = document.createElement('span');
        arrow.className = 'material-symbols-outlined dropdown-arrow';
        arrow.textContent = 'expand_more';

        trigger.appendChild(triggerText);
        trigger.appendChild(arrow);
        wrapper.appendChild(trigger);

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'custom-select-options';

        const renderOptions = () => {
            optionsContainer.innerHTML = '';
            Array.from(select.options).forEach((opt) => {
                const optDiv = document.createElement('div');
                optDiv.className = 'custom-select-option';

                const checkIcon = document.createElement('span');
                checkIcon.className = 'material-symbols-outlined option-check';
                checkIcon.textContent = 'check';
                if (!opt.selected) {
                    checkIcon.style.opacity = '0';
                }

                const textSpan = document.createElement('span');
                textSpan.textContent = opt.textContent;

                optDiv.appendChild(textSpan);
                optDiv.appendChild(checkIcon);

                optDiv.setAttribute('data-value', opt.value);

                if (opt.selected) {
                    optDiv.classList.add('selected');
                    triggerText.textContent = opt.textContent;
                }

                if (opt.disabled) {
                    optDiv.classList.add('disabled');
                }

                optDiv.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (opt.disabled) return;

                    select.value = opt.value;
                    optionsContainer.querySelectorAll('.custom-select-option').forEach(el => {
                        el.classList.remove('selected');
                        const check = el.querySelector('.option-check');
                        if (check) check.style.opacity = '0';
                    });

                    optDiv.classList.add('selected');
                    if (checkIcon) checkIcon.style.opacity = '1';
                    triggerText.textContent = opt.textContent;

                    optionsContainer.classList.remove('open');
                    trigger.classList.remove('active');

                    if (window.syncInquiryPadding) window.syncInquiryPadding(optionsContainer, false);

                    select.dispatchEvent(new Event('change'));
                });

                optionsContainer.appendChild(optDiv);
            });
        };

        renderOptions();
        select.rebuildCustomOptions = () => {
            renderOptions();
            syncUI();
        };
        wrapper.appendChild(optionsContainer);
        select.parentNode.insertBefore(wrapper, select.nextSibling);

        const syncUI = () => {
            const currentSelected = select.options[select.selectedIndex];
            if (currentSelected) {
                triggerText.textContent = currentSelected.textContent;
            }
            optionsContainer.querySelectorAll('.custom-select-option').forEach(el => {
                const check = el.querySelector('.option-check');
                if (el.getAttribute('data-value') === select.value) {
                    el.classList.add('selected');
                    if (check) check.style.opacity = '1';
                } else {
                    el.classList.remove('selected');
                    if (check) check.style.opacity = '0';
                }
            });
        };

        select.addEventListener('change', syncUI);
        select.addEventListener('valueupdated', syncUI);

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            document.querySelectorAll('.custom-select-options.open').forEach(openContainer => {
                if (openContainer !== optionsContainer) {
                    openContainer.classList.remove('open');
                    openContainer.previousElementSibling.classList.remove('active');
                    if (window.syncInquiryPadding) window.syncInquiryPadding(openContainer, false);
                }
            });

            const isOpen = optionsContainer.classList.toggle('open');
            trigger.classList.toggle('active', isOpen);

            if (window.syncInquiryPadding) window.syncInquiryPadding(optionsContainer, isOpen);
        });
    });
}

runWhenReady(() => {
    initializeCustomSelects();
    const observer = new MutationObserver(() => {
        initializeCustomSelects();
    });
    observer.observe(document.body, { childList: true, subtree: true });
});

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-options.open').forEach(openContainer => {
        openContainer.classList.remove('open');
        openContainer.previousElementSibling.classList.remove('active');
        if (window.syncInquiryPadding) window.syncInquiryPadding(openContainer, false);
    });
});

// ─────────────────────────────────────────────────────────
// شعاع أزرق خفيف على خلايا contenteditable عند التركيز
// ─────────────────────────────────────────────────────────
document.addEventListener('focusin', function (e) {
    if (e.target.contentEditable === 'true') {
        e.target.style.setProperty('outline', 'none', 'important');
        e.target.style.setProperty('border', '1px solid #93c5fd', 'important');
        e.target.style.setProperty('border-radius', '6px', 'important');
        e.target.style.setProperty('box-shadow', '0 0 0 3px rgba(147, 197, 253, 0.3)', 'important');
    }
});

document.addEventListener('focusout', function (e) {
    if (e.target.contentEditable === 'true') {
        e.target.style.setProperty('outline', 'none', 'important');
        e.target.style.setProperty('border', 'none', 'important');
        e.target.style.setProperty('box-shadow', 'none', 'important');
    }
});

document.addEventListener('focusout', function (e) {
    if (e.target.contentEditable === 'true') {
        e.target.style.setProperty('outline', 'none', 'important');
        e.target.style.setProperty('border', 'none', 'important');
        e.target.style.setProperty('box-shadow', 'none', 'important');
    }
});
