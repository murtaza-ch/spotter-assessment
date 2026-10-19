from django.core.management.base import BaseCommand
from django.utils import timezone

from planning.models import TripPlan


class Command(BaseCommand):
    help = "Remove expired temporary trip analyses."

    def handle(self, *args, **options) -> None:
        count, _ = TripPlan.objects.filter(expires_at__lt=timezone.now()).delete()
        self.stdout.write(f"Removed {count} expired plans.")
