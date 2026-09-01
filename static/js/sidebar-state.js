// ========================================
// اللوحة الجانبية - إدارة الحالة ومنع القفز والارتداد البصري نهائياً
// ========================================

// حقن كود CSS المبدئي لتفادي رمش أو وميض القوائم المنسدلة عند التحميل
(function() {
    let styleText = "";
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("menu_")) {
            const menuId = key.substring(5);
            const isOpen = localStorage.getItem(key) === "true";
            if (isOpen) {
                styleText += `#${menuId} { display: block !important; max-height: none !important; opacity: 1 !important; visibility: visible !important; }\n`;
                styleText += `button[onclick*="toggleMenu('${menuId}')"] .rotate-icon { transform: rotate(180deg) !important; }\n`;
            }
        }
    }
    if (styleText) {
        const style = document.createElement('style');
        style.id = "sidebar-inline-state-style";
        style.innerHTML = styleText;
        document.head.appendChild(style);
    }
})();

const SIDEBAR_MENU_SELECTOR = '.submenu[id]';

function getSidebarScrollContainers() {
    return Array.from(document.querySelectorAll('.sidebar-nav, .app-sidebar, aside, .desktop-sidebar, .sidebar'))
        .filter(Boolean);
}

function getSidebar() {
    // الأولوية للحاوية الفعلية ذات التمرير .sidebar-nav
    return document.querySelector('.sidebar-nav') || document.querySelector('aside, .sidebar, .app-sidebar, .desktop-sidebar');
}

function getSidebarMenuIds() {
    return Array.from(document.querySelectorAll(SIDEBAR_MENU_SELECTOR))
        .map(menu => menu.id)
        .filter(Boolean);
}

function getMenuButton(id) {
    return document.querySelector(`button[onclick*="toggleMenu('${id}'"]`);
}

function syncMenuIcon(id, isOpen) {
    const btn = getMenuButton(id);
    const icon = btn?.querySelector('.rotate-icon');
    if (icon) {
        icon.classList.toggle('open', isOpen);
    }
}

function saveSidebarScrollPosition() {
    const containers = getSidebarScrollContainers();
    let captured = 0;
    
    for (const c of containers) {
        if (c.scrollTop > 0) {
            captured = c.scrollTop;
            break;
        }
    }
    
    if (captured === 0) {
        const primary = getSidebar();
        if (primary && primary.scrollTop > 0) {
            captured = primary.scrollTop;
        }
    }

    if (captured > 0 || (captured === 0 && (localStorage.getItem('sidebarScrollPos') === null || localStorage.getItem('sidebarScrollPos') === '0'))) {
        localStorage.setItem('sidebarScrollPos', String(Math.round(captured)));
        sessionStorage.setItem('sidebarScrollPos', String(Math.round(captured)));
    }
}

// تعديل جوهري: الاسترجاع الفوري الصارم مع تكرار المحاذاة لمنع التصفير نهائياً
function restoreSidebarScrollPosition() {
    const savedPos = localStorage.getItem('sidebarScrollPos') || sessionStorage.getItem('sidebarScrollPos');

    if (savedPos !== null) {
        const targetPos = parseInt(savedPos, 10);
        if (!isNaN(targetPos) && targetPos >= 0) {
            const containers = getSidebarScrollContainers();
            const applyScroll = () => {
                containers.forEach(c => {
                    c.scrollTop = targetPos;
                });
            };

            applyScroll();
            requestAnimationFrame(applyScroll);
            setTimeout(applyScroll, 10);
            setTimeout(applyScroll, 30);
            setTimeout(applyScroll, 60);
            setTimeout(applyScroll, 120);
            setTimeout(applyScroll, 200);
            setTimeout(applyScroll, 350);
            setTimeout(applyScroll, 500);
            setTimeout(applyScroll, 700);
        }
    }
}

function setMenuState(id, isOpen) {
    const menu = document.getElementById(id);
    if (!menu) return;

    if (isOpen) {
        menu.classList.add('open');
    } else {
        menu.classList.remove('open');
    }
    syncMenuIcon(id, isOpen);
    localStorage.setItem(`menu_${id}`, String(isOpen));
}

// حفظ حالة القوائم المنسدلة
function saveAllMenuStates() {
    getSidebarMenuIds().forEach(id => {
        const menu = document.getElementById(id);
        if (menu) {
            localStorage.setItem(`menu_${id}`, String(menu.classList.contains('open')));
        }
    });
}

// استرجاع حالة القوائم المنسدلة بناءً على التخزين
function restoreAllMenuStates() {
    getSidebarMenuIds().forEach(id => {
        const savedState = localStorage.getItem(`menu_${id}`);
        if (savedState === 'true') {
            setMenuState(id, true);
        } else {
            setMenuState(id, false);
        }
    });
}

// دالة تبديل القائمة من العنوان الرئيسي فقط
window.toggleMenu = function(id, btn, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const menu = document.getElementById(id);
    if (!menu) return;

    const sidebar = getSidebar();
    const currentPos = sidebar ? sidebar.scrollTop : 0;
    const isOpen = !menu.classList.contains('open');

    setMenuState(id, isOpen);

    if (sidebar) {
        sidebar.scrollTop = currentPos;
        saveSidebarScrollPosition();
    }
};

function keepSidebarSubmenusOpenOnInnerInteraction() {
    document.querySelectorAll(SIDEBAR_MENU_SELECTOR).forEach(menu => {
        menu.addEventListener('click', function(e) {
            e.stopPropagation();
            saveSidebarScrollPosition();
        });
    });
}

// استرجاع الرابط النشط
function restoreActiveNav() {
    const currentPath = window.location.pathname;
    let bestMatchBtn = null;
    let maxMatchLength = -1;

    // إزالة النشاط من جميع الأزرار أولاً
    document.querySelectorAll('.side-btn, .sub-btn').forEach(btn => {
        btn.classList.remove('active');
        
        const href = btn.getAttribute('href');
        if (href && href !== '#' && href !== '') {
            if (currentPath === href) {
                // المطابقة التامة لها أعلى أولوية
                bestMatchBtn = btn;
                maxMatchLength = href.length + 1000; // أولوية قصوى
            } else if (currentPath.startsWith(href) && href !== '/') {
                // مطابقة البادئة (Prefix match)
                if (href.length > maxMatchLength) {
                    bestMatchBtn = btn;
                    maxMatchLength = href.length;
                }
            }
        }
    });

    if (bestMatchBtn) {
        bestMatchBtn.classList.add('active');
        
        // إذا كان الرابط داخل قائمة فرعية، نقوم بفتح القائمة الفرعية تلقائياً
        const submenu = bestMatchBtn.closest('.submenu');
        if (submenu) {
            submenu.classList.add('open');
            const parentBtn = document.querySelector(`button[onclick*="toggleMenu('${submenu.id}')"]`);
            const icon = parentBtn?.querySelector('.rotate-icon');
            if (icon) icon.classList.add('open');
        }
    } else {
        // كخيار احتياطي إذا لم يتم العثور على مطابقة تلقائية
        const savedActive = localStorage.getItem('activeNav');
        if (savedActive) {
            const activeBtn = document.getElementById(savedActive);
            if (activeBtn) activeBtn.classList.add('active');
        }
    }
}

window.setActiveNav = function(activeId) {
    document.querySelectorAll('.side-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.classList.add('active');
    localStorage.setItem('activeNav', activeId);
};
// التقاط الموضع فور النقر على الروابط وقبل الانتقال الفعلي
document.addEventListener('click', function(e) {
    const sidebarElement = e.target.closest('aside, .sidebar, .sidebar-nav, .app-sidebar, .desktop-sidebar');
    if (!sidebarElement) return;

    saveSidebarScrollPosition();
    saveAllMenuStates();
}, true);

// حفظ الموضع عند التمرير
function bindSidebarScrollState() {
    const containers = getSidebarScrollContainers();
    containers.forEach(container => {
        let scrollTimer;
        container.addEventListener('scroll', function() {
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(saveSidebarScrollPosition, 15);
        }, { passive: true });
    });
}

// حفظ الموضع الحرج قبل إغلاق أو تحديث الصفحة مباشرة
window.addEventListener('beforeunload', function() {
    saveSidebarScrollPosition();
    saveAllMenuStates();
});

// التنفيذ الفوري المتزامن بمجرد أن يصبح الـ DOM جاهزاً وقبل عملية الـ Rendering
document.addEventListener('DOMContentLoaded', function() {
    restoreAllMenuStates();
    restoreActiveNav();
    keepSidebarSubmenusOpenOnInnerInteraction();
    bindSidebarScrollState();
    
    // إزالة وسم الاستايل المبدئي لكي يتاح للـ JS التحكم المرن بالفتح والغلق بدون تعارض !important
    const inlineStyle = document.getElementById('sidebar-inline-state-style');
    if (inlineStyle) {
        inlineStyle.remove();
    }
    
    // الاستدعاء الفوري هنا يمنع الارتداد تماماً لأن التوقيت متزامن
    restoreSidebarScrollPosition();
});

// استدعاء أمان إضافي سريع جداً (بدون الـ 50ms الطويلة) لضمان الثبات التام في المتصفحات البطيفة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSidebarScrollPosition);
} else {
    restoreSidebarScrollPosition();
}

// دوال عامة للمنظومة
function goBack() {
    window.location.href = '/';
}

function printPage() {
    window.print();
}

// ========================================
// إظهار وإخفاء القوائم المنسدلة للهيدر
// ========================================
window.toggleProfileMenu = function(event) {
    if (event) {
        event.stopPropagation();
    }
    const profileMenu = document.getElementById('profileMenu');
    if (profileMenu) {
        profileMenu.classList.toggle('hidden');
    }
    // إخفاء القائمة الأخرى لمنع التداخل
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.classList.add('hidden');
    }
};

window.toggleUserMenu = function(event) {
    if (event) {
        event.stopPropagation();
    }
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.classList.toggle('hidden');
    }
    // إخفاء القائمة الأخرى لمنع التداخل
    const profileMenu = document.getElementById('profileMenu');
    if (profileMenu) {
        profileMenu.classList.add('hidden');
    }
};

// إغلاق القوائم عند النقر في أي مكان خارجها
document.addEventListener('click', function(event) {
    const profileMenu = document.getElementById('profileMenu');
    if (profileMenu && !profileMenu.classList.contains('hidden')) {
        if (!event.target.closest('.header-profile-btn') && !event.target.closest('#profileMenu')) {
            profileMenu.classList.add('hidden');
        }
    }
    
    const userMenu = document.getElementById('userMenu');
    if (userMenu && !userMenu.classList.contains('hidden')) {
        const settingsBtn = event.target.closest('button[onclick*="toggleUserMenu"]');
        if (!settingsBtn && !event.target.closest('#userMenu')) {
            userMenu.classList.add('hidden');
        }
    }
});

// ========================================
// بوابة الطالب - تنشيط الرابط النشط وقائمة الإعدادات
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    // تنشيط العنصر النشط في نافذة الطالب وتنظيف اسم المستخدم
    var currentPath = window.location.pathname;
    document.querySelectorAll('.bottom-nav-item, .nav-link').forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('href') === currentPath) {
            item.classList.add('active');
        }
    });

    // تنظيف اسم الطالب من الفصل الدراسي في الهيدر
    var userNameEl = document.querySelector('.user-name');
    if (userNameEl) {
        var text = userNameEl.textContent;
        if (text.includes('|')) {
            userNameEl.textContent = text.split('|')[0].trim();
        }
    }

    // تشغيل وإخفاء قائمة المستخدم المنسدلة عند النقر على اسم المستخدم مباشرة
    var profileDropdownBtn = document.getElementById('userProfileDropdownBtn');
    var profileDropdownMenu = document.getElementById('userProfileDropdownMenu');
    if (profileDropdownBtn && profileDropdownMenu) {
        var arrowIcon = profileDropdownBtn.querySelector('.dropdown-arrow');
        
        profileDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var isHidden = profileDropdownMenu.classList.contains('hidden');
            if (isHidden) {
                profileDropdownMenu.classList.remove('hidden');
                if (arrowIcon) arrowIcon.style.transform = 'rotate(180deg)';
            } else {
                profileDropdownMenu.classList.add('hidden');
                if (arrowIcon) arrowIcon.style.transform = 'rotate(0deg)';
            }
        });

        document.addEventListener('click', function(e) {
            if (!profileDropdownMenu.contains(e.target) && !profileDropdownBtn.contains(e.target)) {
                profileDropdownMenu.classList.add('hidden');
                if (arrowIcon) arrowIcon.style.transform = 'rotate(0deg)';
            }
        });
    }
});