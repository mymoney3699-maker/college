# apps/grades/email_bridge.py
"""
جسر معالجة وفحص ردود كشوف درجات الأساتذة عبر البريد الإلكتروني
Email-to-Notification Bridge for Incoming Professor Grade Replies
"""

import os
import io
import re
import imaplib
import email
from datetime import timedelta
from email.header import decode_header
from django.conf import settings
from django.utils import timezone
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from apps.student.models import Notification
from apps.faculty.models import Professor, CourseAssignment
from apps.renewal.models import Course, Semester, Department

def clean_header_text(header_val):
    """فك ترميز وتنظيف نصوص عناوين البريد الإلكتروني"""
    if not header_val:
        return ""
    try:
        decoded_fragments = decode_header(header_val)
        text_parts = []
        for fragment, encoding in decoded_fragments:
            if isinstance(fragment, bytes):
                try:
                    text_parts.append(fragment.decode(encoding or 'utf-8', errors='ignore'))
                except Exception:
                    text_parts.append(fragment.decode('latin-1', errors='ignore'))
            else:
                text_parts.append(str(fragment))
        return "".join(text_parts).strip()
    except Exception:
        return str(header_val).strip()
    
def parse_excel_grade_sheet_bytes(file_bytes, filename=""):
    """
    تحليل محتوى ملف إكسل الدرجات واستخراج بيانات المادة وعدد الطلاب المسجلين
    """
    students_count = 0
    detected_course_code = None
    detected_course_name = None
    detected_semester_name = None
    detected_course_id = None

    # استخراج رقم المادة من اسم الملف مثل grades_48.xlsx أو grades_1.xlsx
    if filename:
        fn_match = re.search(r'grades_([A-Za-z0-9_]+)\.xlsx?', filename, re.IGNORECASE)
        if fn_match:
            val = fn_match.group(1).strip()
            if val.isdigit():
                detected_course_id = int(val)
            else:
                detected_course_code = val.upper()

    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active

        # فحص الترويسات والخلايا الأولى للبحث عن رمز المادة أو الفصل
        for row in sheet.iter_rows(min_row=1, max_row=12, values_only=True):
            for cell in row:
                if not cell:
                    continue
                cell_str = str(cell).strip()
                
                # استخراج رمز المادة
                if not detected_course_code and not detected_course_id:
                    code_match = re.search(r'\b[A-Za-z]{2,5}[-_]?\d{1,4}\b', cell_str)
                    if code_match:
                        detected_course_code = code_match.group(0).replace('-', '').replace('_', '').upper()

                # استخراج اسم المادة
                if ('مادة' in cell_str or 'المادة' in cell_str or 'Course' in cell_str) and not detected_course_name:
                    parts = re.split(r'[:：\-]\s*', cell_str)
                    if len(parts) > 1 and parts[1].strip():
                        detected_course_name = parts[1].strip()

                # استخراج الفصل الدراسي
                if ('فصل' in cell_str or 'الفصل' in cell_str or 'Semester' in cell_str) and not detected_semester_name:
                    parts = re.split(r'[:：\-]\s*', cell_str)
                    if len(parts) > 1 and parts[1].strip():
                        detected_semester_name = parts[1].strip()

        # حساب عدد صفوف الطلاب (الصفوف بعد الصف 4)
        for row in sheet.iter_rows(min_row=4, values_only=True):
            non_empty = [c for c in row if c is not None and str(c).strip() != '']
            if len(non_empty) >= 2:
                students_count += 1

    except Exception as e:
        print(f"[WARN] [Excel Parse] Error reading sheet structure: {e}")

    return {
        'students_count': max(students_count, 0),
        'course_id': detected_course_id,
        'course_code': detected_course_code,
        'course_name': detected_course_name,
        'semester_name': detected_semester_name,
    }


def find_matching_professor_and_course(sender_email, sender_name="", course_code="", course_name="", course_id=None, subject_text=""):
    """
    مطابقة الأستاذ والمادة مع قاعدة البيانات بدقة ومرونة عالية
    """
    professor = None
    course = None

    # 1. مطابقة الأستاذ بالبريد الإلكتروني
    if sender_email:
        clean_email = sender_email.strip().lower()
        professor = Professor.objects.filter(email__iexact=clean_email).first()
        if not professor:
            professor = Professor.objects.filter(email__icontains=clean_email).first()

    # 2. مطابقة بالاسم إذا لم يطابق البريد
    if not professor and sender_name:
        for p in Professor.objects.filter(is_active=True):
            if p.full_name and (p.full_name in sender_name or sender_name in p.full_name or 'فيصل' in p.full_name):
                professor = p
                break

    # 3. مطابقة المادة بالمعرف (ID) أولاً
    if course_id:
        course = Course.objects.filter(id=course_id).first()

    # 4. مطابقة المادة بالرمز أو الكود
    if not course and course_code:
        course = Course.objects.filter(code__iexact=course_code).first()
        if not course:
            course = Course.objects.filter(code__icontains=course_code).first()

    # 5. مطابقة المادة بالاسم أو موضوع الرسالة
    search_names = [course_name, subject_text]
    for s_name in search_names:
        if not course and s_name:
            # البحث عن كلمات مثل (انكلش, برمجة, محاسبة, ...)
            for c in Course.objects.filter(is_active=True):
                if c.name and (c.name in s_name or s_name in c.name or c.code in s_name):
                    course = c
                    break

    # 6. إذا عرفنا الأستاذ ولم نحدد المادة، نأخذ التكليف التدريسي النشط له
    if professor and not course:
        assignment = CourseAssignment.objects.filter(professor=professor, is_active=True).first()
        if assignment:
            course = assignment.course

    return professor, course


def create_professor_grade_reply_notification(
    professor=None,
    course=None,
    semester=None,
    attachment_name="grades.xlsx",
    students_count=0,
    reply_body="",
    saved_file_url="",
    sender_display=""
):
    """
    إنشاء سجل إشعار فوري رسمي في مركز الإشعارات بالمنظومة مع منع التكرار اللحظي
    """
    prof_name = professor.full_name if professor else (sender_display or "أستاذ المادة")
    
    if course:
        course_display = f"{course.code} - {course.name}"
        course_id = course.id
    else:
        course_display = "المادة الدراسية"
        course_id = ""

    if semester:
        sem_name = f"{semester.year} ({semester.get_type_display()})" if hasattr(semester, 'get_type_display') else str(semester)
        sem_id = semester.id
    else:
        active_sem = Semester.objects.filter(is_active=True).first()
        sem_name = f"{active_sem.year} ({active_sem.get_type_display()})" if active_sem and hasattr(active_sem, 'get_type_display') else "الفصل الحالي"
        sem_id = active_sem.id if active_sem else ""

    students_str = f" متضمناً ({students_count}) طالب/ة" if students_count > 0 else ""
    attach_str = f"مرفق ({attachment_name})" if attachment_name else "كشف الدرجات"

    title = f"رد واستلام كشف درجات: {prof_name}"
    message = (
        f"قام الأستاذ ({prof_name}) بالرد على بريد الكلية وإرسال {attach_str} "
        f"لمادة ({course_display}) للفصل الدراسي ({sem_name}){students_str}. "
        f"تم استقبال الكشف وتجهيزه للاعتماد في الكنترول."
    )

    link = f"/grades/grade-entry/?course_id={course_id}&semester_id={sem_id}" if (course_id and sem_id) else "/grades/grade-entry/"

    # فحص التكرار خلال 24 ساعة لنفس الأستاذ والمرفق/المادة
    recent_threshold = timezone.now() - timedelta(hours=24)
    existing_notif = Notification.objects.filter(
        title=title,
        message__icontains=attachment_name if attachment_name else course_display,
        notification_type='professor_grade_reply',
        created_at__gte=recent_threshold
    ).first()

    if existing_notif:
        print(f"[INFO] Notification already exists: #{existing_notif.id} - {title}")
        return existing_notif

    notif = Notification.objects.create(
        title=title,
        message=message,
        notification_type='professor_grade_reply',
        icon='mark_email_read',
        target_role='exams',
        link=link,
        is_read=False
    )

    print(f"[OK] [Notification Bridge] Created notification: #{notif.id} - {title}")
    return notif


def save_grade_reply_attachment(file_bytes, filename, prof_name=""):
    """حفظ نسخة من كشف الدرجات المستلم في مجلد المرفقات بالمنظومة"""
    try:
        clean_fn = re.sub(r'[^\w\.-]', '_', filename)
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        save_path = f"grade_replies/{timestamp}_{clean_fn}"
        saved_path = default_storage.save(save_path, ContentFile(file_bytes))
        return default_storage.url(saved_path)
    except Exception as e:
        print(f"[WARN] [Attachment Save] Error saving attachment file: {e}")
        return ""


def check_imap_inbox_for_grade_replies(max_emails=10):
    """
    الاتصال بصندوق البريد الإلكتروني الرسمي عبر IMAP وفحص الرسائل الواردة من الأساتذة
    """
    imap_server = getattr(settings, 'EMAIL_IMAP_HOST', 'imap.gmail.com')
    imap_port = getattr(settings, 'EMAIL_IMAP_PORT', 993)
    user_email = getattr(settings, 'EMAIL_HOST_USER', 'mymoney3699@gmail.com')
    user_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', '')

    if not user_email or not user_pass:
        return {
            'success': False,
            'message': 'بيانات اعتماد البريد الإلكتروني (EMAIL_HOST_USER / EMAIL_HOST_PASSWORD) غير مكتملة.',
            'processed_count': 0,
            'notifications': []
        }

    processed_notifications = []

    try:
        mail = imaplib.IMAP4_SSL(imap_server, imap_port, timeout=8)
        mail.login(user_email, user_pass)
        mail.select('INBOX')

        # جلب معرفات أحدث الرسائل
        status, search_data = mail.search(None, 'ALL')
        if status != 'OK' or not search_data or not search_data[0]:
            mail.logout()
            return {'success': True, 'message': 'صندوق الوارد فارغ.', 'processed_count': 0, 'notifications': []}

        all_ids = search_data[0].split()
        target_ids = all_ids[-max_emails:] if len(all_ids) > max_emails else all_ids

        print(f"[INFO] [IMAP] Checking {len(target_ids)} recent messages...")

        for msg_id in reversed(target_ids):
            try:
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                if status != 'OK' or not msg_data or not msg_data[0]:
                    continue

                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)

                subject = clean_header_text(msg.get('Subject', ''))
                from_raw = clean_header_text(msg.get('From', ''))

                # استخراج اسم وبريد المرسل
                sender_name = from_raw
                sender_email = from_raw
                email_match = re.search(r'<([^>]+)>', from_raw)
                if email_match:
                    sender_email = email_match.group(1).strip()
                    sender_name = from_raw.replace(f"<{sender_email}>", "").strip(' "\'')

                # تجاهل الرسائل المرسلة من نفس بريد المنظومة لنفسها
                if sender_email.lower() == user_email.lower() and 'نظام كلية طرابلس' in sender_name:
                    continue

                has_excel_attachment = False
                excel_attachments = []
                body_text = ""

                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        content_disposition = str(part.get("Content-Disposition", ""))
                        filename = clean_header_text(part.get_filename() or "")

                        if "attachment" in content_disposition or filename.endswith(('.xlsx', '.xls')):
                            file_data = part.get_payload(decode=True)
                            if file_data and filename.endswith(('.xlsx', '.xls')):
                                has_excel_attachment = True
                                excel_attachments.append((filename, file_data))
                        elif content_type == "text/plain" and "attachment" not in content_disposition:
                            body_data = part.get_payload(decode=True)
                            if body_data:
                                body_text = body_data.decode('utf-8', errors='ignore')
                else:
                    body_data = msg.get_payload(decode=True)
                    if body_data:
                        body_text = body_data.decode('utf-8', errors='ignore')

                is_grade_related = (
                    has_excel_attachment or
                    'درجات' in subject or 'كشف' in subject or 'grade' in subject.lower() or
                    'درجات' in body_text or 'كشف' in body_text or 'grades_' in subject
                )

                if is_grade_related:
                    active_semester = Semester.objects.filter(is_active=True).first()

                    if excel_attachments:
                        for fn, fdata in excel_attachments:
                            parse_result = parse_excel_grade_sheet_bytes(fdata, fn)
                            prof, course = find_matching_professor_and_course(
                                sender_email=sender_email,
                                sender_name=sender_name,
                                course_code=parse_result.get('course_code'),
                                course_name=parse_result.get('course_name'),
                                course_id=parse_result.get('course_id'),
                                subject_text=subject
                            )

                            saved_url = save_grade_reply_attachment(fdata, fn, prof.full_name if prof else sender_name)

                            notif = create_professor_grade_reply_notification(
                                professor=prof,
                                course=course,
                                semester=active_semester,
                                attachment_name=fn,
                                students_count=parse_result.get('students_count', 0),
                                reply_body=body_text,
                                saved_file_url=saved_url,
                                sender_display=sender_name or sender_email
                            )
                            processed_notifications.append({
                                'id': notif.id,
                                'title': notif.title,
                                'professor': prof.full_name if prof else sender_name,
                                'course': course.name if course else 'مادة الكشف',
                                'attachment': fn,
                                'students_count': parse_result.get('students_count', 0)
                            })
                    else:
                        # رد بريد بدون ملف مرفق لكن يتعلق بالدرجات
                        prof, course = find_matching_professor_and_course(
                            sender_email=sender_email,
                            sender_name=sender_name,
                            subject_text=subject
                        )
                        notif = create_professor_grade_reply_notification(
                            professor=prof,
                            course=course,
                            semester=active_semester,
                            attachment_name="رد بالبريد الإلكتروني",
                            students_count=0,
                            reply_body=body_text,
                            sender_display=sender_name or sender_email
                        )
                        processed_notifications.append({
                            'id': notif.id,
                            'title': notif.title,
                            'professor': prof.full_name if prof else sender_name,
                            'course': course.name if course else 'مادة الكشف',
                            'attachment': 'رد بريد',
                            'students_count': 0
                        })
            except Exception as single_msg_err:
                print(f"[WARN] Error parsing message #{msg_id}: {single_msg_err}")

        try:
            mail.close()
            mail.logout()
        except Exception:
            pass

        return {
            'success': True,
            'message': f'تم فحص البريد بنجاح ومعالجة {len(processed_notifications)} رد/كشف.',
            'processed_count': len(processed_notifications),
            'notifications': processed_notifications
        }

    except Exception as e:
        print(f"[ERROR] [IMAP] Error checking inbox: {e}")
        return {
            'success': False,
            'message': f'تعذر الاتصال بصندوق البريد: {str(e)}',
            'processed_count': len(processed_notifications),
            'notifications': processed_notifications
        }


def simulate_incoming_grade_reply(
    professor_id=None,
    course_id=None,
    semester_id=None,
    students_count=24,
    attachment_name="grades_48.xlsx",
    custom_prof_name=None,
    custom_course_name=None,
    notes=""
):
    """
    محاكاة استقبال رد أستاذ عبر البريد الإلكتروني في بيئة التطوير
    """
    professor = None
    if professor_id:
        professor = Professor.objects.filter(id=professor_id).first()
    if not professor and not custom_prof_name:
        professor = Professor.objects.filter(email='najihajer340@gmail.com').first() or Professor.objects.filter(is_active=True).first()

    course = None
    if course_id:
        course = Course.objects.filter(id=course_id).first()
    if not course and not custom_course_name:
        if professor:
            assignment = CourseAssignment.objects.filter(professor=professor, is_active=True).first()
            if assignment:
                course = assignment.course
        if not course:
            course = Course.objects.filter(is_active=True).first()

    semester = None
    if semester_id:
        semester = Semester.objects.filter(id=semester_id).first()
    if not semester:
        semester = Semester.objects.filter(is_active=True).first()

    prof_display = custom_prof_name or (professor.full_name if professor else "فيصل شهوب")
    course_display = custom_course_name or (f"{course.code} - {course.name}" if course else "انكلش 1")

    notif = create_professor_grade_reply_notification(
        professor=professor,
        course=course,
        semester=semester,
        attachment_name=attachment_name,
        students_count=students_count,
        reply_body=notes or "السلام عليكم، مرفق كشف الدرجات المكتمل للطلبة المسجلين بالمادة.",
        sender_display=prof_display
    )

    return {
        'success': True,
        'notification_id': notif.id,
        'title': notif.title,
        'message': notif.message,
        'professor': prof_display,
        'course': course_display,
        'attachment': attachment_name,
        'students_count': students_count
    }
