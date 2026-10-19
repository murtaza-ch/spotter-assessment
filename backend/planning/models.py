import uuid

from django.db import models


class TripPlan(models.Model):
    """Short-lived analysis snapshots so map forecasts work across server processes."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    result = models.JSONField()
    forecast = models.JSONField(null=True, blank=True)

    def __str__(self) -> str:
        return str(self.id)
