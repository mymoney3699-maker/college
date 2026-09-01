# apps/student/signals.py
import logging
from django.db.models.signals import post_save, pre_save, post_delete, pre_delete
from django.core.exceptions import PermissionDenied
from django.dispatch import receiver
from apps.grades.models import Grade
from apps.student.models import SemesterRecord, AcademicRecord, Student, Notification

logger = logging.getLogger(__name__)


# ============================================================
# 0. منع حذف سجل الطالب نهائياً من قاعدة البيانات (حظر أكاديمي)
# ============================================================
@receiver(pre_delete, sender=Student)
def prevent_student_hard_delete(sender, instance, **kwargs):
    """منع الحذف النهائي لسجل الطالب أكاديمياً"""
    raise PermissionDenied("❌ لا يمكن حذف سجل الطالب من النظام نهائياً لأن الحذف ممنوع أكاديمياً. يرجى تعديل حالة الطالب بدلاً من الحذف.")


# ============================================================
# 1. إشعارات إضافة طالب جديد وتحديث السجلات
# ============================================================
@receiver(post_save, sender=Student)
def handle_new_student_notification(sender, instance, created, **kwargs):
    """توليد إشعار للمسجل العام عند إضافة طالب جديد"""
    if created:
        try:
            dept_name = instance.department.name if instance.department else "العام"
            Notification.create_notification(
                student=instance,
                title=f"إضافة طالب جديد: {instance.name}",
                message=f"تم تسجيل وإضافة الطالب الجديد ({instance.name} - رقم القيد: {instance.student_id}) في قسم ({dept_name}).",
                notification_type='new_student',
                icon='person_add',
                link=f"/renewal/student-data/?search={instance.student_id}",
                target_role='registrar'
            )
        except Exception as e:
            logger.error(f"Error creating new student notification: {e}")


# ============================================================
# 2. تحديث السجلات الأكاديمية للطالب عند رصد/تعديل الدرجات
# ============================================================
@receiver(post_save, sender=Grade)
def handle_grade_save_and_notifications(sender, instance, created, **kwargs):
    """تحديث السجل الفصلي والتراكمي للطالب فورياً عند رصد أو تعديل الدرجة"""
    try:
        if instance.student and instance.semester:
            semester_record, _ = SemesterRecord.objects.get_or_create(
                student=instance.student,
                semester=instance.semester
            )
            semester_record.calculate_semester_record()
            semester_record.save()
            
        if instance.student:
            academic_record, _ = AcademicRecord.objects.get_or_create(
                student=instance.student
            )
            academic_record.calculate_cumulative_record()
            academic_record.save()
            
            # 🎓 أتمتة فحص تصفية مواد التخرج وجاهزية إخلاء الطرف وإشعار قسم الخريجين
            if instance.is_passed or getattr(instance, 'total_grade', 0) >= 50:
                try:
                    from apps.renewal.services import GraduationEligibilityService
                    GraduationEligibilityService.check_student_eligibility(instance.student)
                except Exception as ge:
                    logger.error(f"Error checking graduation eligibility in signal: {ge}")
    except Exception as e:
        logger.error(f"Error updating academic records on grade save: {e}")

    # تم إيقاف توليد إشعارات التعديل والرصد الفردي للدرجات بناءً على متطلبات النظام
    # وتقتصر الإشعارات حصراً على اعتماد ونشر النتيجة العامة من شاشة نشر النتائج.


@receiver(post_delete, sender=Grade)
def update_academic_records_on_grade_delete(sender, instance, **kwargs):
    """تحديث السجل الفصلي والتراكمي عند حذف درجة"""
    try:
        if instance.student and instance.semester:
            semester_record = SemesterRecord.objects.get(
                student=instance.student,
                semester=instance.semester
            )
            semester_record.save()
    except Exception:
        pass
    
    try:
        if instance.student:
            academic_record = AcademicRecord.objects.get(
                student=instance.student
            )
            academic_record.save()
    except Exception:
        pass


# ============================================================
# 3. إشعارات تجديد القيد وتنزيل المواد
# ============================================================
try:
    from apps.renewal.models import EnrollmentRenewal, CourseRegistration

    @receiver(post_save, sender=EnrollmentRenewal)
    def handle_renewal_notification(sender, instance, created, **kwargs):
        """توليد إشعار عند اعتماد تجديد القيد للطالب والمسجل العام"""
        try:
            if instance.student and instance.status in ['RENEWED', 'active', 'مجدد']:
                sem_display = str(instance.semester) if instance.semester else 'الفصل الحالي'
                
                # إشعار الطالب
                Notification.create_notification(
                    student=instance.student,
                    title="اعتماد تجديد القيد",
                    message=f"تم اعتماد وتأكيد تجديد قيدك الأكاديمي بنجاح للفصل الدراسي ({sem_display}).",
                    notification_type='renewal',
                    icon='how_to_reg',
                    link='/student/dashboard/',
                    target_role='student'
                )

                # إشعار المسجل العام
                Notification.create_notification(
                    student=instance.student,
                    title=f"تأكيد تجديد قيد: {instance.student.name}",
                    message=f"تم إتمام وتأكيد تجديد القيد للطالب ({instance.student.name} - قيد: {instance.student.student_id}) للفصل الدراسي ({sem_display}).",
                    notification_type='renewal',
                    icon='how_to_reg',
                    link='/renewal/renewed-students/',
                    target_role='registrar'
                )
        except Exception as e:
            logger.error(f"Error creating renewal notification: {e}")

    @receiver(post_save, sender=CourseRegistration)
    def handle_registration_notification(sender, instance, created, **kwargs):
        """توليد إشعار عند تنزيل مقرر دراسي للطالب والمسجل العام"""
        try:
            if created and instance.student and (instance.course or getattr(instance, 'subject', None)):
                c_name = instance.course.name if instance.course else instance.subject.name
                
                # إشعار الطالب
                Notification.create_notification(
                    student=instance.student,
                    title="تنزيل مادة دراسية جديدة",
                    message=f"تم تسجيل وتنزيل مادة ({c_name}) في جدولك الدراسي بنجاح.",
                    notification_type='registration',
                    icon='menu_book',
                    link='/student/my-courses/',
                    target_role='student'
                )

                # إشعار المسجل العام
                Notification.create_notification(
                    student=instance.student,
                    title=f"تنزيل مواد دراسية: {instance.student.name}",
                    message=f"تم تسجيل وتنزيل مادة ({c_name}) للطالب ({instance.student.name} - قيد: {instance.student.student_id}).",
                    notification_type='registration',
                    icon='menu_book',
                    link='/renewal/download-materials/',
                    target_role='registrar'
                )

                # إشعار مدير الدراسة والامتحانات
                Notification.create_notification(
                    student=instance.student,
                    title=f"تنزيل مادة دراسية: {instance.student.name}",
                    message=f"تم تسجيل وتنزيل مادة ({c_name}) للطالب ({instance.student.name} - قيد: {instance.student.student_id}).",
                    notification_type='registration',
                    icon='menu_book',
                    link='/renewal/download-materials/',
                    target_role='exam_director'
                )
        except Exception as e:
            logger.error(f"Error creating registration notification: {e}")
except ImportError:
    pass


# ============================================================
# 3.1 إشعارات رصد واعتماد الدرجات (تم تعطيل التنبيه الفردي والإبقاء على نشر النتائج العامة)
# ============================================================
# تم إيقاف handle_grade_recording_notification لضمان عدم إرسال إشعارات عند التعديل والرصد الفردي.


# ============================================================
# 3.2 إشعارات تعيين وإسناد المواد للأساتذة (Course Assignment)
# ============================================================
try:
    from apps.faculty.models import CourseAssignment

    @receiver(post_save, sender=CourseAssignment)
    def handle_course_assignment_notification(sender, instance, created, **kwargs):
        """توليد إشعار فوري لمدير الدراسة والامتحانات عند تعيين أو تحديث إسناد مادة لأستاذ"""
        try:
            if instance.professor and instance.course:
                p_name = instance.professor.full_name
                c_title = f"{instance.course.code} - {instance.course.name}"
                dept_name = instance.department.name if instance.department else (instance.course.department.name if instance.course and instance.course.department else "القسم الأكاديمي")
                grp_name = f" - شعبة ({instance.student_group.name})" if instance.student_group else ""
                act_text = "تعيين وإسناد مادة جديدة" if created else "تحديث تكليف تدريسي"
                
                Notification.create_notification(
                    title=f"{act_text}: {p_name}",
                    message=f"تم {act_text} للأستاذ ({p_name}) لمادة ({c_title}){grp_name} بقسم ({dept_name}).",
                    notification_type='course_assignment',
                    icon='assignment_ind',
                    link="/faculty/sections/",
                    target_role='exam_director'
                )
        except Exception as e:
            logger.error(f"Error creating course assignment notification: {e}")
except ImportError:
    pass


# ============================================================
# 4. إشعارات تغيير المسار، إيقاف القيد، التخرج، وإخلاء الطرف
# ============================================================
@receiver(pre_save, sender=Student)
def track_student_changes_pre_save(sender, instance, **kwargs):
    """مقارنة حالة وبيانات الطالب قبل الحفظ لاكتشاف الأحداث الهامة وإشعار المسجل والطالب"""
    if not instance.pk:
        return
    try:
        old = Student.objects.filter(pk=instance.pk).select_related('department', 'student_status').first()
        if not old:
            return
        
        # 1. تغيير المسار / القسم العلمي
        if instance.department_id and old.department_id != instance.department_id:
            dept_name = instance.department.name if instance.department else "الجديد"
            old_dept_name = old.department.name if old.department else "السابق"
            
            # إشعار الطالب
            Notification.create_notification(
                student=instance,
                title="تغيير المسار الأكاديمي",
                message=f"تم تحديث واعتماد تخصصك الأكاديمي رسمياً إلى: {dept_name}.",
                notification_type='department_change',
                icon='alt_route',
                link='/student/my-profile/',
                target_role='student'
            )

            # إشعار المسجل العام
            Notification.create_notification(
                student=instance,
                title=f"تغيير مسار أكاديمي: {instance.name}",
                message=f"تم تغيير المسار الأكاديمي للطالب ({instance.name} - قيد: {instance.student_id}) من قسم ({old_dept_name}) إلى ({dept_name}).",
                notification_type='department_change',
                icon='alt_route',
                link='/renewal/department-transfers/',
                target_role='registrar'
            )

        # 2. تغيير الحالة الأكاديمية (إيقاف قيد / تخرج / إخلاء طرف)
        if instance.student_status_id and old.student_status_id != instance.student_status_id:
            status_name = instance.student_status.name if instance.student_status else ""
            
            # تخرج
            if "خريج" in status_name or "تخرج" in status_name:
                Notification.create_notification(
                    student=instance,
                    title="مبارك التخرج! 🎓",
                    message="تهانينا! لقد تم إتمام متطلبات الخطة الدراسية وتحديث حالتك الأكاديمية إلى [خريج].",
                    notification_type='graduation',
                    icon='school',
                    link='/student/my-grades/',
                    target_role='student'
                )

                Notification.create_notification(
                    student=instance,
                    title=f"تحديث حالة إلى خريج: {instance.name}",
                    message=f"تم تحديث السجل الأكاديمي للطالب ({instance.name} - قيد: {instance.student_id}) بنجاح إلى حالة [خريج].",
                    notification_type='graduation',
                    icon='school',
                    link='/renewal/return-graduate/',
                    target_role='registrar'
                )

            # إيقاف قيد
            elif "موقوف" in status_name or "إيقاف" in status_name:
                Notification.create_notification(
                    student=instance,
                    title="إشعار إيقاف القيد",
                    message="تم صدور قرار إيقاف القيد الأكاديمي الخاص بك. يرجى مراجعة إدارة التسجيل وشؤون الطلاب.",
                    notification_type='hold',
                    icon='pause_circle',
                    link='/student/my-profile/',
                    target_role='student'
                )

                Notification.create_notification(
                    student=instance,
                    title=f"إيقاف قيد أكاديمي: {instance.name}",
                    message=f"تم تسجيل قرار إيقاف القيد الأكاديمي للطالب ({instance.name} - قيد: {instance.student_id}) في قسم ({instance.department.name if instance.department else 'العام'}).",
                    notification_type='hold',
                    icon='pause_circle',
                    link='/renewal/suspended-students/',
                    target_role='registrar'
                )

            # إخلاء طرف / سحب ملف
            elif "منسحب" in status_name or "إخلاء" in status_name or "سحب" in status_name:
                Notification.create_notification(
                    student=instance,
                    title="إتمام إجراءات إخلاء الطرف وسحب الملف",
                    message="تم إتمام واعتماد إجراءات إخلاء الطرف وسحب الملف بنجاح.",
                    notification_type='clearance',
                    icon='folder_shared',
                    link='/student/my-profile/',
                    target_role='student'
                )

                Notification.create_notification(
                    student=instance,
                    title=f"إتمام إخلاء طرف وسحب ملف: {instance.name}",
                    message=f"تم تسجيل واعتماد إخلاء الطرف وسحب الملف للطالب ({instance.name} - قيد: {instance.student_id}).",
                    notification_type='clearance',
                    icon='folder_shared',
                    link='/renewal/withdrawn-students/',
                    target_role='registrar'
                )
    except Exception as e:
        logger.error(f"Error tracking student changes in signal: {e}")


# ============================================================
# 5. إشعار سحب الملفات (StudentWithdrawal) للمسجل العام والطالب فقط
# ============================================================
try:
    from apps.renewal.models import StudentWithdrawal
    @receiver(post_save, sender=StudentWithdrawal)
    def handle_withdrawal_notification(sender, instance, created, **kwargs):
        try:
            if instance.student:
                # 1. إشعار الطالب بسحب ملفه
                Notification.create_notification(
                    student=instance.student,
                    title="إتمام إجراءات سحب الملف",
                    message="تم إتمام واعتماد إجراءات سحب ملفك من المنظومة بنجاح.",
                    notification_type='file_withdrawal',
                    icon='folder_off',
                    link='/student/my-profile/',
                    target_role='student'
                )

                # 2. إشعار المسجل العام (ولا يرسل إطلاقاً لقسم الخريجين)
                Notification.create_notification(
                    student=instance.student,
                    title=f"سحب ملف مسجل: {instance.student.name}",
                    message=f"تم إدراج واعتماد طلب سحب الملف للطالب ({instance.student.name} - قيد: {instance.student.student_id}).",
                    notification_type='file_withdrawal',
                    icon='folder_off',
                    link='/renewal/withdrawn-students/',
                    target_role='registrar'
                )
        except Exception as e:
            logger.error(f"Error creating withdrawal notification: {e}")
except ImportError:
    pass