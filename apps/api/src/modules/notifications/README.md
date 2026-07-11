# Notifications Module

Owns in-app notification records and provider delivery attempts.

Endpoint:

- `GET /v1/notifications`

Provider boundary:

- `NotificationProviderPort` hides push/SMS/email delivery.
- `DevNotificationProvider` logs delivery and records a development delivery row.

The current module is intentionally neutral and operational. Reminder scheduling, push token registration and full notification-center workflows are later slices.
