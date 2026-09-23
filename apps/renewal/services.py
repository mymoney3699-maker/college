# apps/renewal/services.py
import logging
from django.utils import timezone
from django.db import transaction
from django.db.models import Q

logger = logging.getLogger(__name__)


class GraduationEligibilityService:
    """
    خدمة رصد وتحديد الطلاب المؤهلين للتخرج والجاهزين لإخلاء الطرف تلقائياً
    عند تصفية واجتياز جميع مواد الخطة الدراسية (بما فيها مواد المستوى الثامن).
    """

    @classmethod
    def check_student_eligibility(cls, student) -> bool:
        """
        فحص حالة الطالب: هل قام باجتياز وتصفية كافة مواد الخطة الدراسية بنجاح؟
        شروط الاستيفاء الحقيقي:
        1. أن يكون الطالب في المستوى النهائي (المستوى 8 فما فوق).
        2. اجتياز وتصفية جميع مواد الخطة الدراسية الإجبارية للقسم والتخصص بنجاح.
        3. مناقشة ورصد واجتياز مشروع التخرج بنجاح.
        """
        if not student:
            return False

        try:
            from apps.grades.models import Grade
            from apps.renewal.models import Course, GraduationClearance

            # 1. إذا كان الطالب قد أجرى إخلاء طرف مسبقاً، فهو منتهٍ
            if GraduationClearance.objects.filter(student=student).exists():
                return True

            # 2. شرط المستوى: يجب أن يكون الطالب في المستوى 8 فما فوق
            level_num = student.level.number if student.level else 0
            if level_num < 8:
                if getattr(student, 'is_ready_for_clearance', False):
                    student.is_ready_for_clearance = False
                    student.save(update_fields=['is_ready_for_clearance'])
                return False

            # 3. جلب الخطة الدراسية والقسم للطالب
            study_plan = student.study_plan
            if not study_plan:
                return False

            # 4. جلب جميع المواد المقررة والنشطة في خطة الطالب وقسمه
            required_courses_qs = Course.objects.filter(
                study_plan=study_plan,
                is_active=True
            )

            # إذا كانت المواد مرتبطة بأقسام محددة
            if student.department:
                dept_courses = required_courses_qs.filter(
                    Q(department=student.department) | Q(department__isnull=True)
                ).distinct()
                if dept_courses.exists():
                    required_courses_qs = dept_courses

            required_course_ids = set(required_courses_qs.values_list('id', flat=True))
            if not required_course_ids:
                return False

            # 5. جلب المواد التي اجتازها الطالب بنجاح (is_passed=True أو درجة >= 50)
            passed_course_ids = set(
                Grade.objects.filter(
                    student=student
                ).filter(
                    Q(is_passed=True) | Q(total_grade__gte=50.0)
                ).values_list('course_id', flat=True)
            )

            # 6. التحقق من أن جميع المواد المقررة قد تم اجتيازها بالكامل
            is_all_passed = required_course_ids.issubset(passed_course_ids)

            # 7. التحقق من مشروع التخرج
            project_passed = Grade.objects.filter(
                student=student
            ).filter(
                Q(is_passed=True) | Q(total_grade__gte=50.0)
            ).filter(
                Q(course__name__icontains='مشروع') | Q(course__code__icontains='PROJ') | Q(course__name__icontains='project')
            ).exists()

            if is_all_passed and project_passed:
                cls.mark_student_ready_and_notify(student)
                return True

            # إذا لم يكن مستوفياً، تصحيح الحالة إذا كانت مسجلة بالخطأ
            if getattr(student, 'is_ready_for_clearance', False):
                student.is_ready_for_clearance = False
                student.save(update_fields=['is_ready_for_clearance'])

            return False

        except Exception as e:
            logger.error(f"Error checking graduation eligibility for student {student.id}: {e}")
            return False

    @classmethod
    @transaction.atomic
    def mark_student_ready_and_notify(cls, student):
        """
        تحديث حالة الطالب إلى 'جاهز لإخلاء الطرف' وإرسال إشعار فوري لقسم الخريجين
        """
        try:
            from apps.student.models import Notification

            # 1. تحديث حقول الطالب
            student.is_ready_for_clearance = True
            student.clearance_ready_date = timezone.now()
            student.save(update_fields=['is_ready_for_clearance', 'clearance_ready_date'])

            # 2. إنشاء الإشعار لقسم الخريجين (مع منع التكرار)
            notif_title = f"🎓 طالب جديد جاهز لإخلاء الطرف: {student.name}"
            dept_name = student.department.name if student.department else "الكلية"
            notif_message = (
                f"أتم الطالب ({student.name}) ذو رقم القيد ({student.student_id}) "
                f"تصفية واجتياز جميع مواد الخطة الدراسية بقسم ({dept_name}) بنجاح، "
                f"وهو جاهز الآن لإجراءات إخلاء الطرف واستخراج إفادة التخرج."
            )
            target_link = f"/renewal/clearance/?student_id={student.student_id}"

            Notification.objects.get_or_create(
                student=student,
                notification_type='graduation',
                target_role='graduates',
                defaults={
                    'title': notif_title,
                    'message': notif_message,
                    'icon': 'school',
                    'link': target_link,
                    'is_read': False
                }
            )

            # توثيق النشاط في سجل النظام
            try:
                from apps.users.utils import log_activity
                log_activity(
                    user=None,
                    action='graduation_ready',
                    model_name='Student',
                    object_name=f"{student.student_id} - {student.name}",
                    details=f"تم رصد استيفاء الطالب لمتطلبات التخرج وتجهيزه لإخلاء الطرف آلياً"
                )
            except Exception:
                pass

            logger.info(f"✅ Student {student.student_id} marked ready for clearance and notification sent to graduates dept.")

        except Exception as e:
            logger.error(f"Error marking student {student.id} ready for clearance: {e}")

    @classmethod
    def batch_scan_and_process(cls):
        """
        فحص شامل لجميع طلاب المستويات النهائية لرصد الجاهزين للتخرج دفعة واحدة
        """
        from apps.student.models import Student
        candidates = Student.objects.filter(
            is_ready_for_clearance=False,
            graduation_clearance__isnull=True
        ).select_related('department', 'study_plan', 'level')

        ready_count = 0
        for st in candidates:
            if cls.check_student_eligibility(st):
                ready_count += 1

        return ready_count


class FailureWarningService:
    """
    خدمة رصد وتوليد ومزامنة إنذارات الرسوب والتعثر الأكاديمي (رسوب 3 مرات فما فوق) تلقائياً
    للمسجل العام وإدارة الكلية وقسم الدراسة والامتحانات والطلاب.
    """

    @classmethod
    def scan_student(cls, student):
        """
        فحص الطالب ورصد أي مقررات رسب فيها 3 مرات فما فوق أو تعثر تراكمي
        وتوليد إشعارات تحذيرية رسمية فوراً مع منع التكرار.
        """
        if not student:
            return 0

        try:
            from apps.grades.models import Grade
            from apps.renewal.models import CourseRegistration
            from apps.student.models import Notification
            from django.db import models

            all_grades = list(student.grade_set.all().select_related('course', 'semester'))
            if not all_grades:
                return 0

            # 1. المواد التي تم اجتيازها بنجاح
            passed_course_ids = {
                g.course_id for g in all_grades
                if g.is_passed or (g.is_final_entered and g.total_grade >= 50.0)
            }

            # 2. تجميع الدرجات لكل مادة
            course_grades_map = {}
            for g in all_grades:
                if g.course:
                    course_grades_map.setdefault(g.course, []).append(g)

            created_count = 0
            failed_courses = []

            for course, c_grades in course_grades_map.items():
                # إذا اجتاز الطالب المادة في محاولة لاحقة، نزيل أي إشعار رسوب قديم لها
                if course.id in passed_course_ids:
                    Notification.objects.filter(
                        student=student,
                        notification_type='failed_three_times',
                        title__icontains=course.code
                    ).delete()
                    continue

                historical_fails = sum(
                    1 for g in c_grades
                    if not g.is_passed or (g.is_final_entered and g.total_grade < 50.0)
                )
                max_grade_attempt = max([g.attempt_number or 1 for g in c_grades], default=1)
                reg_qs = CourseRegistration.objects.filter(student=student, course=course)
                reg_count = reg_qs.count()
                max_reg_attempt = reg_qs.aggregate(models.Max('attempt_number'))['attempt_number__max'] or 1

                exact_failure_count = max(historical_fails, max_grade_attempt, max_reg_attempt, reg_count, 1)
                failed_courses.append((course, exact_failure_count))

                # رصد الرسوب 3 مرات فما فوق للمقرر الواحد (معاود 3 مرات أو أكثر)
                if exact_failure_count >= 3:
                    rep_text = Grade.format_repetition_text(exact_failure_count)
                    title = f"🚨 إنذار رسوب ({rep_text}): {student.name} ({course.code})"

                    # التحقق من عدم وجود إشعار سابق لنفس الطالب ونفس المقرر
                    existing = Notification.objects.filter(
                        student=student,
                        notification_type='failed_three_times',
                        title__icontains=course.code
                    ).first()

                    if not existing:
                        dept_name = student.department.name if student.department else "العام"
                        msg = (
                            f"تنبيه أكاديمي عاجل: رسب الطالب ({student.name} - رقم القيد: {student.student_id}) "
                            f"في مقرر ({course.name} - رمز: {course.code}) للمرة الثالثة ({rep_text}). "
                            f"القسم الأكاديمي: {dept_name}. "
                            f"الحالة الأكاديمية: إيقاف قيد وفصل مؤقت للعرض على لجنة الكلية."
                        )
                        link = f"/grades/failed-students-report/?search={student.student_id}"

                        Notification.objects.create(
                            student=student,
                            notification_type='failed_three_times',
                            title=title,
                            message=msg,
                            link=link,
                            target_role='registrar',
                            icon='warning',
                            is_read=False
                        )
                        created_count += 1

            # 3. رصد التعثر الأكاديمي الشامل (3 مقررات رسوب غير مجتازة فأكثر)
            if len(failed_courses) >= 3:
                multi_title = f"🚨 إنذار تعثر أكاديمي ({len(failed_courses)} مقررات رسوب): {student.name}"
                existing_multi = Notification.objects.filter(
                    student=student,
                    notification_type='failed_three_times',
                    title__icontains="تعثر أكاديمي"
                ).first()

                if not existing_multi:
                    dept_name = student.department.name if student.department else "العام"
                    msg = (
                        f"تنبيه أكاديمي: رُصد لدى الطالب ({student.name} - رقم القيد: {student.student_id}) "
                        f"عدد ({len(failed_courses)}) مقررات رسوب غير مجتازة بقسم ({dept_name}). "
                        f"يتطلب استدعاء الطالب ومراجعة ملفه الأكاديمي لاتخاذ الإجراء المناسب."
                    )
                    link = f"/grades/failed-students-report/?search={student.student_id}"

                    Notification.objects.create(
                        student=student,
                        notification_type='failed_three_times',
                        title=multi_title,
                        message=msg,
                        link=link,
                        target_role='registrar',
                        icon='warning',
                        is_read=False
                    )
                    created_count += 1

            return created_count

        except Exception as e:
            logger.error(f"Error scanning student {student.id} for failure warnings: {e}")
            return 0

    @classmethod
    def sync_failure_warnings(cls):
        """
        فحص ومزامنة جماعية لجميع الطلاب الذين لديهم رسوب أو تسجيلات متكررة
        لتوليد إنذارات الرسوب 3 مرات تلقائياً
        """
        try:
            from apps.student.models import Student
            from django.db.models import Q

            candidates = Student.objects.filter(
                Q(grade__is_passed=False) | Q(courseregistration__attempt_number__gte=3)
            ).distinct()

            total_created = 0
            for student in candidates:
                total_created += cls.scan_student(student)

            return total_created
        except Exception as e:
            logger.error(f"Error in sync_failure_warnings: {e}")
            return 0
