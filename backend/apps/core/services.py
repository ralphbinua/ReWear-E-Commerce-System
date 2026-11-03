from django.db import transaction

from apps.core.models import AuditLog, Notification


def notify(user, kind, title, body="", url=""):
    if user is None:
        return None
    return Notification.objects.create(user=user, kind=kind, title=title, body=body, url=url)


def audit(actor, action, target_type, target_id, metadata=None):
    with transaction.atomic():
        return AuditLog.objects.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            metadata=metadata or {},
        )
