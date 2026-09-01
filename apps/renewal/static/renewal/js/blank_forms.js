// ============================================================
// blank_forms.js v1.0.5 - طباعة النماذج والاستمارات الإدارية الفارغة
// ============================================================

console.log('✅ blank_forms.js v1.0.5 loaded successfully');

// تصفية بطاقات النماذج حسب البحث
function filterFormCards() {
    const query = document.getElementById('searchFormsInput')?.value.trim().toLowerCase() || '';
    document.querySelectorAll('.form-card').forEach(card => {
        const title = card.getAttribute('data-title')?.toLowerCase() || '';
        const text  = card.textContent.toLowerCase();
        card.style.display = (!query || title.includes(query) || text.includes(query)) ? 'flex' : 'none';
    });
}
window.filterFormCards = filterFormCards;

// ============================================================
// 🖨️ طباعة النماذج الفارغة بالتنسيق الرسمي الموحد
// ============================================================

function printBlankForm(formType) {
    const container = document.getElementById('printBlankFormsContainer');
    if (!container) return;

    if (container.parentNode !== document.body) {
        document.body.appendChild(container);
    }

    const now     = new Date();
    const dateStr = now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const fullYear = now.getFullYear();
    const autoRefNumber = `ك.ط.ع.ت / ${fullYear} / ${Math.floor(1000 + Math.random() * 9000)}`;
    const logoUrl = window.COLLEGE_LOGO_URL || '/static/images/%D8%B4%D8%B9%D8%A7%D8%B1%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9.jpeg';

    // الترويسة الموحدة الرسمية لجميع النماذج متوافقة مع الهوية الليبية
    const standardHeader = (titleText, subtitleText = '') => `
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
                <img src="${logoUrl}" alt="شعار الكلية" class="print-college-logo" style="max-height:75px;max-width:75px;width:auto;object-fit:contain;display:block;margin:0 auto;" onerror="this.style.display='none'">
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
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 6px 0 12px 0; font-size: 12.5px; font-weight: 800;">
            <div><span>التاريخ:</span> <span style="font-family: monospace; font-size: 13px; font-weight: 800;">${dateStr}</span></div>
            <div><span>الرقم الإشاري:</span> <span style="font-family: monospace; font-size: 13px; font-weight: 800;">${autoRefNumber}</span></div>
        </div>

        <div class="bf-title" style="font-size: 19.5px; font-weight: 900; margin: 6px 0 2px 0; text-align: center; color: #000;">${titleText}</div>
        ${subtitleText ? `<div style="font-size: 13px; font-weight: 800; text-align: center; margin-top: -2px; margin-bottom: 12px;">${subtitleText}</div>` : ''}
    `;

    let formHtml = '';

    switch (formType) {

        // ============================================================
        // 1️⃣ نموذج طلب تجديد قيد فصلي
        // ============================================================
        case 'renew_registration':
            formHtml = `
            <div class="print-page-frame">
                ${standardHeader('استمارة طلب تجديد قيد فصلي')}

                <div style="font-size: 13.5px; font-weight: 900; text-align: left; margin-bottom: 20px;">التاريخ: ${dateStr}</div>

                <div class="bf-fields-list">
                    <div class="bf-field-row"><span class="bf-lbl">الاسم الرباعي الكامل:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">رقم القيد:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">التخصص العلمي:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">المستوى الدراسي الحالي:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">الفصل الدراسي المراد تجديده:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">السنة الدراسية:</span> <span class="bf-dots">2026م</span></div>
                </div>

                <div style="text-align: center; margin: 25px 10px 25px 10px;">
                    <div style="font-size: 14.5px; font-weight: 900; margin-bottom: 8px;">إقرار الطالبة:</div>
                    <div style="font-size: 14px; font-weight: 900; line-height: 1.9; max-width: 90%; margin: 0 auto 20px auto;">
                        أُقـر أنا الطالبة المذكورة بياناتي أعلاه برغبتي في تجديد قيدي الدراسي للفصل المحدد، وأتعهد بالالتزام باللوائح والتعليمات الأكاديمية الصادرة عن إدارة الكلية.
                    </div>

                    <div style="font-size: 13.5px; font-weight: 900; margin-bottom: 35px;">
                        توقيع الطالبة: ................................................
                    </div>
                </div>

                <div class="bf-signatures-row">
                    <div class="bf-sig-col" data-official="registration_officer">
                        <div class="off-name bf-off-name"></div>
                        <div class="bf-sig-title">قسم التسجيل و القبول </div>
                        <div class="bf-sig-dots">التوقيع: ....................................</div>
                    </div>

                    <div class="bf-sig-col" data-official="general_registrar">
                        <div class="off-name bf-off-name"></div>
                        <div class="bf-sig-title">المسجل العام </div>
                        <div class="bf-sig-dots">التوقيع والختم: ....................................</div>
                    </div>
                </div>
            </div>`;
            break;

        // ============================================================
        // 2️⃣ نموذج إيقاف قيد (تعهد رقم 2)
        // ============================================================
        case 'suspend_student':
            formHtml = `
            <div class="print-page-frame">
                ${standardHeader('نموذج إيقاف قيد', 'تعهد رقم (2)')}

                <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 900; margin-bottom: 20px;">
                    <div>اليوم: ....................................</div>
                    <div>التاريخ: ${dateStr}</div>
                </div>

                <div class="bf-fields-list">
                    <div class="bf-field-row"><span class="bf-lbl">أنا مقدمة الطلب /</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">المسجلة برقم القيد /</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">التخصص /</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">الفصل الدراسي /</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">سبب إيقاف القيد /</span> <span class="bf-dots"></span></div>
                </div>

                <div style="text-align: center; font-size: 14px; font-weight: 900; line-height: 2; margin: 25px 10px 15px 10px;">
                    أتقدم إليكم بطلبي هذا بخصوص إيقاف قيدي للفصل الدراسي المذكور أعلاه،<br>
                    وأتعهد بالالتزام باللوائح الأكاديمية والعودة للدراسة وتجديد القيد فور انتهاء فترة الإيقاف.
                </div>

                <div style="text-align: center; font-size: 14.5px; font-weight: 900; margin-bottom: 30px;">
                    والسلام عليكم ورحمة الله وبركاته
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 35px; padding: 0 40px; font-size: 13.5px; font-weight: 900;">
                    <div style="text-align: center;">
                        <div>توقيع الطالبة</div>
                        <div style="margin-top: 20px;">................................................</div>
                    </div>
                    <div style="text-align: center;">
                        <div>توقيع ولي الأمر</div>
                        <div style="margin-top: 20px;">................................................</div>
                    </div>
                </div>

                <div class="bf-signatures-row">
                    <div class="bf-sig-col" data-official="registration_officer">
                        <div class="off-name bf-off-name"></div>
                        <div class="bf-sig-title">قسم التسجيل والقبول</div>
                        <div class="bf-sig-dots">التوقيع: ....................................</div>
                    </div>

                    <div class="bf-sig-col" data-official="general_registrar">
                        <div class="off-name bf-off-name"></div>
                        <div class="bf-sig-title">المسجل العام </div>
                        <div class="bf-sig-dots">التوقيع والختم: ....................................</div>
                    </div>
                </div>
            </div>`;
            break;

        // ============================================================
        // 3️⃣ نموذج طلب سحب ملف ومستندات
        // ============================================================
        case 'student_withdrawal':
            formHtml = `
            <div class="print-page-frame">
                ${standardHeader('استمارة طلب وتعهد سحب ملف نهائي')}

                <div style="font-size: 13.5px; font-weight: 900; text-align: left; margin-bottom: 20px;">التاريخ: ${dateStr}</div>

                <div class="bf-fields-list">
                    <div class="bf-field-row"><span class="bf-lbl">الاسم الرباعي الكامل:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">رقم القيد:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">التخصص العلمي:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">المستوى الدراسي الحالي:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">سبب سحب الملف:</span> <span class="bf-dots"></span></div>
                </div>

                <div style="text-align: center; margin: 30px 10px 40px 10px;">
                    <div style="font-size: 14.5px; font-weight: 900; margin-bottom: 10px;">تعهد واستلام المستندات الأصلية:</div>
                    <div style="font-size: 14px; font-weight: 900; line-height: 1.9; max-width: 92%; margin: 0 auto 30px auto; text-align: center;">
                        أُقـرّ أنا الطالبة المذكورة بياناتي أعلاه بأنني استلمت ملفي ومستنداتي الأصلية المودعة لدى مكتب المسجل العام بالكلية لسحب قيدي نهائياً، ولا يحق لي المطالبة بإرجاعها أو استئناف الدراسة إلا وفق إجراءات قبول جديدة.
                    </div>

                    <div style="font-size: 14px; font-weight: 900; margin-bottom: 40px; text-align: center;">
                        توقيع واستلام الطالبة: ................................................................
                    </div>
                </div>

                <div class="bf-signatures-row" style="justify-content: center;">
                    <div class="bf-sig-col" data-official="general_registrar" style="width: 70%; text-align: center;">
                        <div class="off-name bf-off-name"></div>
                        <div class="bf-sig-title">المسجل العام </div>
                        <div class="bf-sig-dots" style="margin-top: 14px;">التوقيع والختم: ....................................</div>
                    </div>
                </div>
            </div>`;
            break;

        // ============================================================
        // 4️⃣ نموذج إخلاء طرف — مطابق تماماً للصورة
        // ============================================================
        case 'clearance':
            formHtml = `
            <div class="print-page-frame" style="direction: rtl; font-family: 'Cairo', 'Tahoma', Arial, sans-serif;">
                ${standardHeader('نـمـوذج إخـلاء طـرف')}

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 900; border-bottom: 1px solid #000; padding: 0 18px 5px 18px; margin-bottom: 12px;">
                    <div>الإشاري: <span style="display: inline-block; width: 155px; border-bottom: 1px dotted #000; margin-right: 5px;"></span></div>
                    <div>التاريخ: <span style="display: inline-block; width: 75px; text-align: center; border-bottom: 1px dotted #000; margin-right: 5px;">${dateStr}</span></div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 22px; row-gap: 8px; margin: 0 18px 26px 18px; font-size: 12.5px; font-weight: 900;">
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <span style="min-width: 48px; white-space: nowrap;">الاسـم:</span>
                        <div style="flex: 1; height: 25px; border: 1px solid #000; border-radius: 2px; display: flex; align-items: center; justify-content: center; padding: 0 8px; font-weight: 900;">................................................</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <span style="min-width: 48px; white-space: nowrap;">القسـم:</span>
                        <div style="flex: 1; height: 25px; border: 1px solid #000; border-radius: 2px; display: flex; align-items: center; justify-content: center; padding: 0 8px; font-weight: 900;">................................................</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <span style="min-width: 48px; white-space: nowrap;">رقم القيد:</span>
                        <div style="flex: 1; height: 25px; border: 1px solid #000; border-radius: 2px; display: flex; align-items: center; justify-content: center; padding: 0 8px; font-weight: 900;">................................................</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <span style="min-width: 48px; white-space: nowrap;">التاريخ:</span>
                        <div style="flex: 1; height: 25px; border: 1px solid #000; border-radius: 2px; display: flex; align-items: center; justify-content: center; padding: 0 8px; font-weight: 900;">${dateStr}</div>
                    </div>
                </div>

                <table class="bf-table" style="width: calc(100% - 36px); margin: 0 18px 22px 18px; border-collapse: collapse; table-layout: fixed; border: 1.5px solid #000; direction: rtl;">
                    <thead>
                        <tr>
                            <th style="width: 27%; height: 30px; border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 13px; font-weight: 900; padding: 3px;">القسـم</th>
                            <th style="width: 46%; height: 30px; border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 13px; font-weight: 900; padding: 3px;">التوقـيع</th>
                            <th style="width: 27%; height: 30px; border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 13px; font-weight: 900; padding: 3px;">الخـتـم</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="height: 55px; border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 15px; font-weight: 900; padding: 5px;">المكـتـبـة</td>
                            <td style="height: 55px; border: 1px solid #000;"></td>
                            <td style="height: 55px; border: 1px solid #000;"></td>
                        </tr>
                        <tr>
                            <td style="height: 55px; border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 15px; font-weight: 900; line-height: 1.5; padding: 5px;">القسم<br>المختص</td>
                            <td style="height: 55px; border: 1px solid #000;"></td>
                            <td style="height: 55px; border: 1px solid #000;"></td>
                        </tr>

                        <!-- =========================================================
                             الصف الأخير — عبارات الاعتماد ملصقة في الضلع العلوي ومكان الختم والتوقيع أسفلها
                        ========================================================== -->
                        <tr>
                            <td colspan="3" style="height: 110px; padding: 0; border: 1px solid #000; vertical-align: top;">
                                <div style="width: 100%; height: 110px; display: flex; align-items: stretch; justify-content: space-between; direction: rtl; box-sizing: border-box; padding: 4px 8px;">

                                    <!-- 1️⃣ أقصى اليمين: درجة التدريب الميداني والدرجة تحته -->
                                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 11.5px; font-weight: 900; line-height: 1.4; width: 22%;">
                                        <div>درجة التدريب الميداني</div>
                                        <div style="display: flex; align-items: center; gap: 4px; margin-top: 6px;">
                                            <div style="width: 50px; height: 28px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; background: #fff;"></div>
                                            <span style="font-size: 11px;">%</span>
                                        </div>
                                    </div>

                                    <!-- 2️⃣ بجانبه: اعتماد قسم التدريب الميداني (الجملة ملصقة فوق والنقاط تحتها للختم) -->
                                    <div style="display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; font-size: 11px; font-weight: 900; width: 25%; padding-top: 2px; padding-bottom: 6px;">
                                        <div style="font-weight: 900; width: 100%;">اعتماد قسم<br>التدريب الميداني</div>
                                        <div style="font-size: 11px; font-weight: 900; color: #000; margin-bottom: 2px; width: 100%;">........................................</div>
                                    </div>

                                    <!-- 3️⃣ درجة مشروع التخرج والدرجة تحته -->
                                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 11.5px; font-weight: 900; line-height: 1.4; width: 22%;">
                                        <div>درجة مشروع التخرج</div>
                                        <div style="display: flex; align-items: center; gap: 4px; margin-top: 6px;">
                                            <div style="width: 50px; height: 28px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; background: #fff;"></div>
                                            <span style="font-size: 11px;">%</span>
                                        </div>
                                    </div>

                                    <!-- 4️⃣ أقصى اليسار: اعتماد رئيس القسم المختص (الجملة ملصقة فوق والنقاط تحتها للختم) -->
                                    <div style="display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; font-size: 11px; font-weight: 900; width: 25%; padding-top: 2px; padding-bottom: 6px;">
                                        <div style="font-weight: 900; width: 100%;">اعتماد رئيس<br>القسم المختص</div>
                                        <div style="font-size: 11px; font-weight: 900; color: #000; margin-bottom: 2px; width: 100%;">........................................</div>
                                    </div>

                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- اعتماد المسجل العام في أقصى اليسار وتحته النقاط مباشرة -->
                <div style="margin-top: 15px; margin-left: 18px; margin-right: auto; display: flex; flex-direction: column; align-items: flex-start; width: 280px;" data-official="general_registrar">
                    <div class="off-name" style="font-size: 13.5px; font-weight: 900; min-height: 18px; margin-bottom: 2px;"></div>
                    <div class="off-pos" style="font-size: 14px; font-weight: 900; margin-bottom: 8px;">اعتماد المسجل العام </div>
                    <div style="display: flex; gap: 14px; align-items: center; font-size: 12.5px; font-weight: 900;">
                        <div>التوقيع: <span style="display: inline-block; width: 95px; border-bottom: 1.5px dotted #000; vertical-align: bottom;"></span></div>
                        <div>الختم: <span style="display: inline-block; width: 75px; border-bottom: 1.5px dotted #000; vertical-align: bottom;"></span></div>
                    </div>
                </div>
            </div>`;
            break;

        // ============================================================
        // 5️⃣ نموذج طعن في نتائج الامتحانات
        // ============================================================
        case 'grade_appeal':
            formHtml = `
            <div class="print-page-frame">
                ${standardHeader('نموذج طعن في نتائج الامتحانات')}

                <div style="font-size: 13.5px; font-weight: 900; text-align: left; margin-bottom: 14px;">التاريخ: ${dateStr}</div>

                <div class="bf-fields-list">
                    <div class="bf-field-row"><span class="bf-lbl">الاسم الرباعي الكامل:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">رقم القيد:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">التخصص:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">المستوى الدراسي:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">الفصل الدراسي:</span> <span class="bf-dots"></span></div>
                </div>

                <div style="font-size: 13.5px; margin-bottom: 12px; font-weight: 900;">
                    أتقدم أنا الطالبة المذكورة بياناتي أعلاه بطعن في نتيجة الامتحان للمادة/المواد التالية (بما لا يتجاوز مادتين كحد أقصى):
                </div>

                <table class="bf-table">
                    <thead>
                        <tr>
                            <th style="width: 6%;">م</th>
                            <th style="width: 24%;">اسم المادة</th>
                            <th style="width: 20%;">أستاذ المادة</th>
                            <th style="width: 14%;">درجة النهائي<br>قبل الطعن</th>
                            <th style="width: 14%;">درجة النهائي<br>بعد الطعن *</th>
                            <th style="width: 14%;">السبب / القرار</th>
                            <th style="width: 8%;">توقيع<br>الأستاذ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>1</td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell" style="background:#f9f9f9;"></td><td class="empty-cell"></td><td class="empty-cell"></td></tr>
                        <tr><td>2</td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell" style="background:#f9f9f9;"></td><td class="empty-cell"></td><td class="empty-cell"></td></tr>
                    </tbody>
                </table>
                <div style="font-size: 11px; margin-bottom: 14px; font-weight: 900;">* تُملأ خانة "الدرجة بعد الطعن" من قِبَل الأستاذ يوم المراجعة الحضورية بحضور الطالبة (وفي حال عدم التغيير يكتب الأستاذ: "تبقى كما هي").</div>

                <div style="text-align: center; margin: 20px 10px 25px 10px;">
                    <div style="font-size: 14px; font-weight: 900; margin-bottom: 6px;">إقرار الطالبة وتأكيد السداد المالي:</div>
                    <div style="font-size: 13.5px; font-weight: 900; margin-bottom: 14px;">أُقرّ أنا الطالبة بصحة البيانات المدوّنة أعلاه وسداد رسوم الطعن بالخزينة المالية بالكلية.</div>
                    <div style="display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 900;">
                        <div>توقيع الطالبة بصحة البيانات: ................................................</div>
                        <div>رقم الإيصال والتوقيع والختم (الخزينة): ................................................</div>
                    </div>
                </div>

                <div style="margin-top: 30px; text-align: center;" data-official="general_registrar">
                    <div class="off-name" style="font-size: 14px; font-weight: 900; min-height: 1.4em; margin-bottom: 6px;"></div>
                    <div style="font-size: 14px; font-weight: 900; margin-bottom: 14px;">اعتماد لجنة الطعون والمسجل العام </div>
                    <div style="font-size: 13px; font-weight: 900;">التوقيع والختم الرسمي: ....................................</div>
                </div>
            </div>`;
            break;

        // ============================================================
        // 6️⃣ نموذج طلب معادلة مواد دراسية
        // ============================================================
        case 'equivalent_courses':
            formHtml = `
            <div class="print-page-frame">
                ${standardHeader('استمارة طلب معادلة مواد دراسية')}

                <div style="font-size: 13.5px; font-weight: 900; text-align: left; margin-bottom: 16px;">التاريخ: ${dateStr}</div>

                <div class="bf-fields-list">
                    <div class="bf-field-row"><span class="bf-lbl">الاسم الرباعي الكامل:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">رقم القيد:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">الكلية/المعهد المُنقَل منه:</span> <span class="bf-dots"></span></div>
                    <div class="bf-field-row"><span class="bf-lbl">التخصص بالكلية:</span> <span class="bf-dots"></span></div>
                </div>

                <div style="font-size: 13.5px; margin-bottom: 10px; font-weight: 900;">المواد المطلوب معادلتها وحساب ساعاتها المقررة:</div>

                <table class="bf-table">
                    <thead>
                        <tr>
                            <th style="width: 6%;">م</th>
                            <th style="width: 30%;">اسم المادة بالكلية السابقة</th>
                            <th style="width: 12%;">الدرجة</th>
                            <th style="width: 30%;">المادة المكافئة بـ كلية طرابلس</th>
                            <th style="width: 12%;">قرار اللجنة</th>
                            <th style="width: 10%;">التوقيع</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>1</td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td></tr>
                        <tr><td>2</td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td></tr>
                        <tr><td>3</td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td></tr>
                        <tr><td>4</td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td><td class="empty-cell"></td></tr>
                    </tbody>
                </table>

                <div style="text-align: center; margin: 20px 10px 20px 10px;">
                    <div style="font-size: 14.5px; font-weight: 900; margin-bottom: 6px;">إقرار الطالبة وتوقيعها:</div>
                    <div style="font-size: 14px; font-weight: 900; margin-bottom: 12px;">أُقر أنا الطالبة بأنني قدمت كافة كشوفات الدرجات الأصلية والمفردات المعتمدة للمواد المطلوب معادلتها.</div>
                    <div style="font-size: 13.5px; font-weight: 900;">توقيع الطالبة: ................................................</div>
                </div>

                <div class="bf-signatures-row">
                    <div class="bf-sig-col" data-official="equivalence_committee_head">
                        <div class="off-name bf-off-name"></div>
                        <div class="bf-sig-title">اعتماد رئيس لجنة المعادلات</div>
                        <div class="bf-sig-dots">التوقيع: ....................................</div>
                    </div>

                    <div class="bf-sig-col" data-official="general_registrar">
                        <div class="off-name bf-off-name"></div>
                        <div class="bf-sig-title">المسجل العام </div>
                        <div class="bf-sig-dots">التوقيع والختم: ....................................</div>
                    </div>
                </div>
            </div>`;
            break;

        default:
            alert('⚠️ النموذج المطلوب غير معروف');
            return;
    }

    container.innerHTML = formHtml;

    const doPrint = () => window.print();

    if (window.OfficialsHelper && typeof window.OfficialsHelper.autoFill === 'function') {
        try {
            const res = window.OfficialsHelper.autoFill();
            if (res && typeof res.then === 'function') {
                res.then(doPrint).catch(doPrint);
            } else {
                setTimeout(doPrint, 300);
            }
        } catch (e) {
            console.warn('OfficialsHelper warning:', e);
            doPrint();
        }
    } else {
        doPrint();
    }
}

window.printBlankForm = printBlankForm;