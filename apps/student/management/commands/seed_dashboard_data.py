"""
seed_dashboard_data.py
======================
أمر مخصص لتعبئة قاعدة البيانات ببيانات وهمية واقعية مطابقة لنظام كلية طرابلس،
مبنية لملء لوحة تحكم القبول والتسجيل والإحصائيات بدقة وتناسق تام.

طريقة الاستخدام من التيرمنال:
    python manage.py seed_dashboard_data
    python manage.py seed_dashboard_data --students 150
    python manage.py seed_dashboard_data --students 200 --clear
"""

import random
import time
import secrets
from datetime import date, timedelta, datetime
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, connection


# ============================================================
# قوائم الأسماء الليبية والعربية الواقعية
# ============================================================
MALE_NAMES = [
    "محمد", "أحمد", "علي", "عمر", "خالد", "يوسف", "إبراهيم", "عبدالله",
    "عبدالرحمن", "مصطفى", "حسن", "حسين", "طارق", "سامي", "وليد", "هشام",
    "أنس", "بلال", "فيصل", "ناصر", "رائد", "زياد", "تامر", "ماجد",
    "سلطان", "نواف", "فهد", "سعود", "تركي", "ربيع", "صالح", "جمال",
    "كريم", "عادل", "رشيد", "منصور", "ياسر", "شادي", "باسم", "لؤي",
    "معتز", "مراد", "أيمن", "حمزة", "مازن", "عاصم", "نزار", "رامي",
    "الفائز", "المبروك", "الطيب", "الصديق", "الهادي", "صبري", "عصام",
    "حاتم", "غالب", "رشاد", "كامل", "نبيل", "وائل", "شوقي", "جابر",
    "فرج", "فتحي", "جمعة", "المهدي", "عبدالسلام", "رمضان", "مختار",
]

FEMALE_NAMES = [
    "فاطمة", "عائشة", "زينب", "مريم", "نور", "سارة", "هدى", "رنا",
    "ليلى", "أميرة", "سلمى", "ريم", "دينا", "هناء", "إيمان", "وفاء",
    "منى", "سمية", "أسماء", "خديجة", "رقية", "حفصة", "لمياء", "وجدان",
    "هبة", "رهف", "شروق", "غادة", "ميسون", "صفاء", "رشا", "ولاء",
    "نهال", "إلهام", "نسرين", "حنان", "سعاد", "أروى", "بشرى", "رانيا",
    "ديمة", "لانا", "نادية", "سناء", "زهرة", "عبير", "شيماء", "منال",
    "ملاك", "سحر", "نجوى", "إيناس", "ثريا", "نجاة", "زهور", "فوزية",
    "عزيزة", "صليحة", "بيان", "نجاح", "صباح", "سهام", "أمل", "نجلاء",
    "مبروكة", "جميلة", "انتصار", "فائزة", "عواطف", "خيرية",
]

FAMILY_NAMES = [
    "الفلاني", "الكوني", "الشريف", "العجيلي", "الزروق", "البرغثي", "الورفلي",
    "الزنتاني", "الترهوني", "الغرياني", "المصراتي", "البنغازي", "الدرسي",
    "السنوسي", "العبيدي", "المقريف", "الزوي", "السايح", "الشلماني", "الفيتوري",
    "بالقاسم", "الهوني", "الطرابلسي", "بن علي", "بن سعيد", "بن عمر", "بن خليل",
    "بن محمد", "أبو بكر", "أبو القاسم", "الصيد", "الجهاني", "الطاهر", "البوسيفي",
    "الأصفر", "الشلوف", "الكيخيا", "الزليطني", "الأمين", "الجلال", "الزبيدي",
    "المريمي", "الزبير", "الأشهب", "الأسود", "الهروش", "الزنقل", "الغنوش",
    "الزايدي", "الأجيل", "الأبيض", "بوعيشة", "بوشنيبة", "بن غالب", "اللافي",
    "القماطي", "الحضيري", "البشتي", "عون", "صالح", "محمود", "إدريس", "كعبار",
    "الشارف", "الرقيق", "الدغاري", "قرقوم", "الأوجلي", "المزوغي", "المحجوب",
]

LIBYAN_CITIES = [
    "طرابلس", "بنغازي", "مصراتة", "الزاوية", "سبها", "البيضاء", "درنة",
    "غريان", "ترهونة", "الزنتان", "يفرن", "ورفلة", "صبراتة", "صرمان",
    "العجيلات", "الخمس", "زليتن", "بني وليد", "سرت", "المرج", "طبرق",
    "أجدابيا", "هون", "سوكنة", "شحات", "القبة", "سوسة",
]


class Command(BaseCommand):
    help = "تعبئة قاعدة البيانات ببيانات وهمية واقعية لملء لوحة تحكم القبول والتسجيل والإحصائيات"

    def add_arguments(self, parser):
        parser.add_argument(
            '--students',
            type=int,
            default=140,
            help='عدد الطلاب المراد إضافتهم (الافتراضي: 140 طالب)'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='حذف وتصفية كافة السجلات والبيانات السابقة التي تم توليدها بهذا الأمر'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("=" * 70))
        self.stdout.write(self.style.SUCCESS("[START] بدء توليد وتعبئة بيانات لوحة تحكم القبول والتسجيل"))
        self.stdout.write(self.style.SUCCESS("=" * 70))

        self._import_models()

        total_to_create = options['students']
        should_clear = options['clear']

        if should_clear:
            self._clean_seeded_data()

        with transaction.atomic():
            self.stdout.write("\n[1/4] فحص وتجهيز البنية التحتية والمفاتيح الخارجية...")
            admin_user = self._get_or_create_admin()
            departments = self._prepare_departments()
            levels = self._prepare_levels()
            study_plans = self._prepare_study_plans()
            semester = self._get_active_semester()
            past_semesters = self._get_past_semesters()
            lookups = self._prepare_lookups()

            self.stdout.write(f"\n[2/4] إنشاء وتوزيع {total_to_create} طالب بشكل واقعي...")
            created_students = self._generate_students(
                total=total_to_create,
                admin_user=admin_user,
                departments=departments,
                levels=levels,
                study_plans=study_plans,
                semester=semester,
                lookups=lookups,
            )

            self.stdout.write("\n[3/4] إنشاء عمليات تجديد القيد للفصل النشط والفصول السابقة...")
            self._seed_enrollment_renewals(created_students, semester, past_semesters, admin_user)

            self.stdout.write("\n[4/4] إنشاء سجلات سحب الملفات وإخلاء الطرف للخريجين...")
            self._seed_withdrawals_and_clearances(created_students, semester, admin_user)

        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(self.style.SUCCESS(f"[DONE] تم بنجاح إنشاء {len(created_students)} طالب وتعبئة جميع كروت ورسوم الداشبورد!"))
        self.stdout.write(self.style.SUCCESS("=" * 70))
        self.stdout.write(self.style.NOTICE(
            "\n[INFO] يمكنك تشغيل الأمر لاحقاً بالأشكال التالية:\n"
            "   python manage.py seed_dashboard_data\n"
            "   python manage.py seed_dashboard_data --students 200\n"
            "   python manage.py seed_dashboard_data --students 150 --clear\n"
        ))

    # ══════════════════════════════════════════════════════════════
    # استيراد النماذج
    # ══════════════════════════════════════════════════════════════
    def _import_models(self):
        from apps.student.models import (
            Student, StudentStatus, Gender, Nationality,
            PlaceOfBirth, Address, MaritalStatus, Qualification, Guardian
        )
        from apps.renewal.models import (
            Department, Level, StudyPlan, Group, Semester,
            EnrollmentRenewal, GraduationClearance, StudentWithdrawal
        )
        from apps.users.models import User

        self.Student = Student
        self.StudentStatus = StudentStatus
        self.Gender = Gender
        self.Nationality = Nationality
        self.PlaceOfBirth = PlaceOfBirth
        self.Address = Address
        self.MaritalStatus = MaritalStatus
        self.Qualification = Qualification
        self.Guardian = Guardian
        self.Department = Department
        self.Level = Level
        self.StudyPlan = StudyPlan
        self.Group = Group
        self.Semester = Semester
        self.EnrollmentRenewal = EnrollmentRenewal
        self.GraduationClearance = GraduationClearance
        self.StudentWithdrawal = StudentWithdrawal
        self.User = User

    # ══════════════════════════════════════════════════════════════
    # تنظيف البيانات السابقة المولدة بالـ Seed
    # ══════════════════════════════════════════════════════════════
    def _clean_seeded_data(self):
        self.stdout.write("[CLEAN] جاري تنظيف بيانات التوليد التجريبية السابقة...")
        with connection.cursor() as cur:
            # 1. إيجاد معرفات الطلاب المولّدين سابقاً
            cur.execute("SELECT id FROM student_student WHERE notes LIKE '%[SEED]%'")
            seeded_ids = [row[0] for row in cur.fetchall()]

            if seeded_ids:
                placeholders = ','.join(['%s'] * len(seeded_ids))
                # حذف السجلات المرتبطة
                cur.execute(f"DELETE FROM renewal_graduationclearance WHERE student_id IN ({placeholders})", seeded_ids)
                cur.execute(f"DELETE FROM renewal_studentwithdrawal WHERE student_id IN ({placeholders})", seeded_ids)
                cur.execute(f"DELETE FROM renewal_enrollmentrenewal WHERE student_id IN ({placeholders})", seeded_ids)
                cur.execute(f"DELETE FROM student_student WHERE id IN ({placeholders})", seeded_ids)
                self.stdout.write(self.style.WARNING(f"   [-] تم حذف {len(seeded_ids)} طالب مولد سابقاً وجميع سجلاتهم التابعة."))
            else:
                self.stdout.write("   [-] لم يتم العثور على سجلات تجريبية سابقة.")

    # ══════════════════════════════════════════════════════════════
    # تجهيز مستخدم الإدارة للتسجيل
    # ══════════════════════════════════════════════════════════════
    def _get_or_create_admin(self):
        user = self.User.objects.filter(is_superuser=True).first()
        if not user:
            user, _ = self.User.objects.get_or_create(
                username='registrar_admin',
                defaults={
                    'first_name': 'المسجل',
                    'last_name': 'العام',
                    'role': 'general_registrar',
                    'is_staff': True,
                }
            )
        return user

    # ══════════════════════════════════════════════════════════════
    # تجهيز الأقسام والتخصصات
    # ══════════════════════════════════════════════════════════════
    def _prepare_departments(self):
        # البحث عن الأقسام الموجودة في النظام أولاً لدعم تخصصات الكلية الحالية
        existing = list(self.Department.objects.filter(is_active=True))
        
        # التأكد من توفر الأقسام الأساسية المطلوبة من المستخدم
        desired = [
            ("برمجة وتحليل نظم", "prog"),
            ("إدارة اعمال", "erad"),
            ("بصريات", "bes"),
            ("تقنية معلومات", "it"),
            ("هندسة معدات طبية", "bme"),
        ]
        for name, code in desired:
            d, created = self.Department.objects.get_or_create(
                code=code,
                defaults={'name': name, 'is_active': True}
            )
            if d not in existing:
                existing.append(d)

        self.stdout.write(f"   [OK] تم تجهيز {len(existing)} أقسام وتخصصات دراسية.")
        return existing

    # ══════════════════════════════════════════════════════════════
    # تجهيز المستويات الدراسية (1 إلى 8)
    # ══════════════════════════════════════════════════════════════
    def _prepare_levels(self):
        names = {
            1: "المستوى الأول", 2: "المستوى الثاني", 3: "المستوى الثالث",
            4: "المستوى الرابع", 5: "المستوى الخامس", 6: "المستوى السادس",
            7: "المستوى السابع", 8: "المستوى الثامن"
        }
        levels = []
        for n in range(1, 9):
            lv, _ = self.Level.objects.get_or_create(
                number=n,
                defaults={'name': names[n]}
            )
            levels.append(lv)
        self.stdout.write(f"   [OK] تم اعتماد المستويات الدراسية (1 إلى 8).")
        return levels

    # ══════════════════════════════════════════════════════════════
    # تجهيز الخطط الدراسية
    # ══════════════════════════════════════════════════════════════
    def _prepare_study_plans(self):
        existing = list(self.StudyPlan.objects.filter(is_active=True))
        if not existing:
            plan, _ = self.StudyPlan.objects.get_or_create(
                code="PLAN2026",
                defaults={'name': "الخطة الدراسية العامة المعتمدة", 'is_active': True}
            )
            existing.append(plan)
        return existing

    # ══════════════════════════════════════════════════════════════
    # تجهيز الفصل الدراسي النشط والفصول السابقة
    # ══════════════════════════════════════════════════════════════
    def _get_active_semester(self):
        sem = self.Semester.objects.filter(is_active=True).first()
        if not sem:
            sem, _ = self.Semester.objects.get_or_create(
                year=2026,
                type='spring',
                defaults={'is_active': True}
            )
            if not sem.is_active:
                self.Semester.objects.filter(is_active=True).update(is_active=False)
                sem.is_active = True
                sem.save()
        self.stdout.write(f"   [OK] الفصل الدراسي الحالي المعتمد: {sem}")
        return sem

    def _get_past_semesters(self):
        past_defs = [
            (2025, 'fall'), (2025, 'spring'),
            (2024, 'fall'), (2024, 'spring')
        ]
        past = []
        for y, t in past_defs:
            s, _ = self.Semester.objects.get_or_create(
                year=y, type=t, defaults={'is_active': False}
            )
            past.append(s)
        return past

    # ══════════════════════════════════════════════════════════════
    # جداول وحالات القيد المعتمدة بالداشبورد
    # ══════════════════════════════════════════════════════════════
    def _prepare_lookups(self):
        # 🎯 الحالات الخمس المعتمدة برمجياً في الداشبورد:
        # منتظم، موقوف قيده، مسحوبة ملف، إخلاء طرف، إخلاء طرف / خريج معتمد
        statuses = {}
        target_statuses = [
            'منتظم',
            'موقوف قيده',
            'مسحوبة ملف',
            'إخلاء طرف',
            'إخلاء طرف / خريج معتمد'
        ]
        for name in target_statuses:
            st, _ = self.StudentStatus.objects.get_or_create(name=name)
            statuses[name] = st

        male_g, _ = self.Gender.objects.get_or_create(name='ذكر')
        female_g, _ = self.Gender.objects.get_or_create(name='أنثى')

        nat_ly, _ = self.Nationality.objects.get_or_create(
            name='ليبي/ليبية',
            defaults={'is_active': True}
        )

        single_m, _ = self.MaritalStatus.objects.get_or_create(name='أعزب/ـة')
        married_m, _ = self.MaritalStatus.objects.get_or_create(name='متزوج/ـة')

        qual_names = ["ثانوية عامة (علمي)", "ثانوية تخصصية (فنية)", "دبلوم فني متوسط"]
        qualifications = []
        for qn in qual_names:
            q, _ = self.Qualification.objects.get_or_create(
                name=qn, defaults={'is_active': True}
            )
            qualifications.append(q)

        return {
            'statuses': statuses,
            'male_gender': male_g,
            'female_gender': female_g,
            'nationality': nat_ly,
            'marital_single': single_m,
            'marital_married': married_m,
            'qualifications': qualifications,
        }

    # ══════════════════════════════════════════════════════════════
    # توليد بيانات الطلاب
    # ══════════════════════════════════════════════════════════════
    def _generate_students(self, total, admin_user, departments, levels, study_plans, semester, lookups):
        """
        توزيع واقعي للطلاب على الحالات والمستويات:
        - 55% منتظم (موزعون بين المستويات 1 إلى 7)
        - 12% موقوف قيده
        - 10% مسحوبة ملف
        - 8%  إخلاء طرف
        - 15% إخلاء طرف / خريج معتمد (المستوى 8)
        """
        status_weights = [
            ('منتظم', 0.55),
            ('موقوف قيده', 0.12),
            ('مسحوبة ملف', 0.10),
            ('إخلاء طرف', 0.08),
            ('إخلاء طرف / خريج معتمد', 0.15),
        ]
        status_names = [s[0] for s in status_weights]
        status_probs = [s[1] for s in status_weights]

        # توزيع المستويات: هرمي (الأول والثاني والثالث أكثر، الثامن للخريجين)
        regular_level_weights = [0.28, 0.24, 0.18, 0.14, 0.09, 0.05, 0.02]

        used_national_ids = set(
            self.Student.objects.values_list('national_id', flat=True)
            .exclude(national_id__isnull=True).exclude(national_id='')
        )
        used_phones = set(self.Student.objects.values_list('phone', flat=True))

        created_students = []
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        student_table = self.Student._meta.db_table

        # رقم القيد التسلسلي
        last_s = self.Student.objects.order_by('-id').first()
        base_serial = (last_s.id + 1) if last_s else 100

        for i in range(total):
            is_male = (random.random() < 0.52)
            gender_obj = lookups['male_gender'] if is_male else lookups['female_gender']

            first_name = random.choice(MALE_NAMES if is_male else FEMALE_NAMES)
            father_name = random.choice(MALE_NAMES)
            grand_name = random.choice(MALE_NAMES)
            last_name = random.choice(FAMILY_NAMES)

            dept = random.choice(departments)
            study_plan = study_plans[0]

            chosen_status_name = random.choices(status_names, weights=status_probs)[0]
            status_obj = lookups['statuses'][chosen_status_name]

            # تحديد المستوى حسب الحالة
            if chosen_status_name in ['إخلاء طرف', 'إخلاء طرف / خريج معتمد']:
                level = levels[7]  # المستوى الثامن
            else:
                level = random.choices(levels[:7], weights=regular_level_weights)[0]

            # الرقم الوطني والهاتف
            national_id = self._generate_unique_nid(used_national_ids)
            used_national_ids.add(national_id)

            phone = self._generate_unique_phone(used_phones)
            used_phones.add(phone)

            # تواريخ الميلاد والالتحاق
            age = random.randint(18, 28)
            birth_dt = date.today() - timedelta(days=age * 365 + random.randint(0, 360))

            enroll_yr = max(2018, date.today().year - (level.number - 1))
            enroll_mo = random.choice([2, 9])
            enroll_dt = date(enroll_yr, enroll_mo, random.randint(1, 28))
            enroll_sem = f"{enroll_yr} {'ربيع' if enroll_mo == 2 else 'خريف'}"

            # مكان الميلاد والعنوان
            city = random.choice(LIBYAN_CITIES)
            birth_place = self.PlaceOfBirth.objects.filter(city=city).first()
            if not birth_place:
                birth_place = self.PlaceOfBirth.objects.create(city=city, country='ليبيا', is_active=True)

            address = self.Address.objects.filter(city=city).first()
            if not address:
                address = self.Address.objects.create(city=city, street=f'حي {random.choice(LIBYAN_CITIES)}', country='ليبيا')

            # ولي الأمر
            guardian_name = f"{father_name} {grand_name} {last_name}"
            guardian_phone = self._generate_unique_phone(used_phones)
            used_phones.add(guardian_phone)
            guardian = self.Guardian.objects.filter(name=guardian_name).first()
            if not guardian:
                guardian = self.Guardian.objects.create(name=guardian_name, phone=guardian_phone)

            qualification = random.choice(lookups['qualifications'])
            marital = random.choices(
                [lookups['marital_single'], lookups['marital_married']],
                weights=[0.8, 0.2]
            )[0]

            # بيانات التخرج الخاصة بالخريجين
            grad_yr = None
            grad_sem = None
            grad_mark = None
            is_ready_clearance = False

            if chosen_status_name == 'إخلاء طرف / خريج معتمد':
                grad_yr = random.choice([2024, 2025])
                grad_sem = random.choice(['ربيع', 'خريف'])
                grad_mark = round(random.uniform(68.0, 96.0), 2)
                is_ready_clearance = True
            elif chosen_status_name == 'إخلاء طرف':
                is_ready_clearance = True

            # رقم القيد
            year_code = enroll_yr % 100
            sem_code = '2' if enroll_mo == 9 else '1'
            student_id_str = f"{year_code}{sem_code}{(base_serial + i):04d}"

            qr_key = secrets.token_hex(16)
            notes = f"[SEED] طالب تجريبي - {chosen_status_name}"

            # إدخال مباشر عبر SQL لتجاوز قيود PermissionDenied و clean() الداخلية
            with connection.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {student_table}
                    (student_id, name, father_name, grandfather_name, last_name,
                     national_id, phone, email,
                     birth_date, birth_place_id, gender_id, blood_type,
                     nationality_id, current_address_id,
                     enrollment_date, enrollment_semester,
                     department_id, study_plan_id, student_status_id,
                     marital_status_id, level_id, qualification_id,
                     qualification_major, qualification_percentage, qualification_grade,
                     qualification_place, qualification_date,
                     graduation_year, graduation_semester, graduation_mark,
                     is_ready_for_clearance, has_changed_major, major_change_count,
                     guardian_id, created_by_id, notes, current_semester,
                     qr_key, qr_code, qr_code_data, created_at, updated_at)
                    VALUES
                    (%s,%s,%s,%s,%s,
                     %s,%s,%s,
                     %s,%s,%s,%s,
                     %s,%s,
                     %s,%s,
                     %s,%s,%s,
                     %s,%s,%s,
                     %s,%s,%s,
                     %s,%s,
                     %s,%s,%s,
                     %s,%s,%s,
                     %s,%s,%s,%s,
                     %s,%s,%s,%s,%s)
                """, [
                    student_id_str, first_name, father_name, grand_name, last_name,
                    national_id, phone, f"std_{student_id_str}@college.ly",
                    birth_dt.isoformat(), birth_place.id, gender_obj.id, random.choice(['A+', 'B+', 'O+', 'AB+']),
                    lookups['nationality'].id, address.id,
                    enroll_dt.isoformat(), enroll_sem,
                    dept.id, study_plan.id, status_obj.id,
                    marital.id, level.id, qualification.id,
                    "علمي", round(random.uniform(65.0, 95.0), 2), "جيد جداً",
                    city, date(enroll_yr - 1, 6, 15).isoformat(),
                    grad_yr, grad_sem, grad_mark,
                    is_ready_clearance, False, 0,
                    guardian.id, admin_user.id, notes, f"{semester.year} - {semester.get_type_display()}",
                    qr_key, '', '', now_str, now_str
                ])

            student_obj = self.Student.objects.get(student_id=student_id_str)
            created_students.append(student_obj)

            if (i + 1) % 30 == 0 or (i + 1) == total:
                self.stdout.write(f"   ... تم تجهيز {i + 1} من أصل {total} طالب")

        return created_students

    # ══════════════════════════════════════════════════════════════
    # إنشاء تجديدات القيد (للفصل الحالي والماضي)
    # ══════════════════════════════════════════════════════════════
    def _seed_enrollment_renewals(self, students, current_semester, past_semesters, admin_user):
        renewal_table = self.EnrollmentRenewal._meta.db_table
        today = date.today().isoformat()
        current_renewed_count = 0
        past_renewed_count = 0

        # 1. تجديدات الفصل النشط للطلبة المنتظمين
        with connection.cursor() as cur:
            for s in students:
                if s.student_status.name == 'منتظم':
                    cur.execute(f"""
                        INSERT INTO {renewal_table}
                        (student_id, semester_id, level_id, status, special_type,
                         renewed_by_id, renewal_date, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, [
                        s.id, current_semester.id, s.level_id,
                        'active', 'REGULAR', admin_user.id, today,
                        '[SEED] تجديد قيد فصلي معتمد'
                    ])
                    current_renewed_count += 1

                elif s.student_status.name == 'موقوف قيده':
                    # تسجيل إيقاف القيد في الفصل الحالي
                    cur.execute(f"""
                        INSERT INTO {renewal_table}
                        (student_id, semester_id, level_id, status, special_type,
                         renewed_by_id, renewal_date, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, [
                        s.id, current_semester.id, s.level_id,
                        'suspended', 'STOPPED', admin_user.id, today,
                        '[SEED] إيقاف قيد فصلي معتمد'
                    ])

            # 2. تجديدات فصول ماضية لبناء تاريخ أكاديمي بالرسوم البيانية
            for s in students:
                num_past = min(s.level.number, len(past_semesters))
                for p_sem in past_semesters[:num_past]:
                    p_date = date(p_sem.year, 9 if p_sem.type == 'fall' else 2, 10).isoformat()
                    cur.execute(f"""
                        INSERT INTO {renewal_table}
                        (student_id, semester_id, level_id, status, special_type,
                         renewed_by_id, renewal_date, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, [
                        s.id, p_sem.id, s.level_id,
                        'active', 'REGULAR', admin_user.id, p_date,
                        '[SEED] سجل تجديد تاريخي سابق'
                    ])
                    past_renewed_count += 1

        self.stdout.write(self.style.SUCCESS(f"   [OK] تم تسجيل {current_renewed_count} تجديد قيد للفصل الحالي و {past_renewed_count} سجلاً تاريخياً."))

    # ══════════════════════════════════════════════════════════════
    # إنشاء سجلات سحب الملفات وإخلاء الطرف للخريجين
    # ══════════════════════════════════════════════════════════════
    def _seed_withdrawals_and_clearances(self, students, current_semester, admin_user):
        withdrawal_table = self.StudentWithdrawal._meta.db_table
        clearance_table = self.GraduationClearance._meta.db_table
        today = date.today().isoformat()

        withdrawal_count = 0
        clearance_count = 0
        graduate_count = 0

        with connection.cursor() as cur:
            for s in students:
                # 1. مسحوبو الملفات
                if s.student_status.name == 'مسحوبة ملف':
                    cur.execute(f"""
                        INSERT INTO {withdrawal_table}
                        (student_id, academic_term_id, withdrawal_date, reason,
                         notes, processed_by_id, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, [
                        s.id, current_semester.id, today,
                        "ظروف خاصة والانتقال إلى مؤسسة تعليمية أخرى",
                        "[SEED] سحب ملف معتمد ورسمي", admin_user.id,
                        datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    ])
                    withdrawal_count += 1

                # 2. إخلاء طرف (قيد الإجراء)
                elif s.student_status.name == 'إخلاء طرف':
                    cert_no = f"CLR-{s.id:05d}"
                    cur.execute(f"""
                        INSERT INTO {clearance_table}
                        (student_id, clearance_date, processed_by_id, semester_id,
                         graduation_project_grade, certificate_number,
                         is_certificate_issued, notes, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, [
                        s.id, today, admin_user.id, current_semester.id,
                        80.0, cert_no, False,
                        "[SEED] إخلاء طرف قيد المراجعة وإصدار الإفادة",
                        datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    ])
                    clearance_count += 1

                # 3. إخلاء طرف / خريج معتمد
                elif s.student_status.name == 'إخلاء طرف / خريج معتمد':
                    grad_year = s.graduation_year or 2025
                    cert_no = f"GRAD-{grad_year}-{s.id:04d}"
                    proj_grade = s.graduation_mark or round(random.uniform(75.0, 95.0), 2)
                    cur.execute(f"""
                        INSERT INTO {clearance_table}
                        (student_id, clearance_date, processed_by_id, semester_id,
                         graduation_project_grade, certificate_number,
                         is_certificate_issued, notes, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, [
                        s.id, today, admin_user.id, current_semester.id,
                        proj_grade, cert_no, True,
                        "[SEED] خريج معتمد ومستوفي لكافة متطلبات التخرج والإفادة",
                        datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    ])
                    graduate_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"   [OK] تم إنشاء {withdrawal_count} سجل سحب ملف، و {clearance_count} إخلاء طرف، و {graduate_count} إخلاء طرف لخريج معتمد."
        ))

    # ══════════════════════════════════════════════════════════════
    # دوال مساعدة لإنشاء أرقام فريدة
    # ══════════════════════════════════════════════════════════════
    def _generate_unique_nid(self, used_ids):
        for _ in range(300):
            nid = ''.join(str(random.randint(0, 9)) for _ in range(12))
            if nid not in used_ids and not self.Student.objects.filter(national_id=nid).exists():
                return nid
        ts = str(int(time.time() * 1000000))
        return (ts + "000000000000")[:12]

    def _generate_unique_phone(self, used_phones):
        prefixes = ['0912', '0913', '0922', '0923', '0941', '0942']
        for _ in range(300):
            pre = random.choice(prefixes)
            suffix = ''.join(str(random.randint(0, 9)) for _ in range(6))
            ph = pre + suffix
            if ph not in used_phones:
                return ph
        return '0912' + str(int(time.time() * 1000))[-6:]
