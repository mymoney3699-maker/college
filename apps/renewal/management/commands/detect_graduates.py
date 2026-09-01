# apps/renewal/management/commands/detect_graduates.py
from django.core.management.base import BaseCommand
from apps.renewal.services import GraduationEligibilityService


class Command(BaseCommand):
    help = "فحص وأتمتة رصد الطلاب الجاهزين لإخلاء الطرف بعد تصفية جميع المواد وإشعار قسم الخريجين"

    def handle(self, *args, **options):
        self.stdout.write("Scanning candidates for graduation clearance eligibility...")
        count = GraduationEligibilityService.batch_scan_and_process()
        self.stdout.write(self.style.SUCCESS(f"Finished: {count} eligible students processed successfully."))
