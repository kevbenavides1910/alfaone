export type {
  NotificationEventPayload,
  NotificationListItem,
  NotificationHistoryItem,
  NotificationPreferenceItem,
} from "@/modules/notifications/business/types";
export { INBOX_RETENTION_DAYS, MODULE_LABELS } from "@/modules/notifications/business/types";
export { NOTIFICATION_EVENT_CATALOG } from "@/modules/notifications/business/event-catalog";

export {
  dispatchNotificationEvent,
  onNotificationCreated,
  emitNotificationRealtime,
} from "@/modules/notifications/services/notification-dispatch";

export {
  listInboxNotifications,
  countUnreadInbox,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  deleteNotification,
  bulkUpdateNotifications,
  restoreFromHistory,
  listNotificationHistory,
} from "@/modules/notifications/services/notification-inbox";

export { archiveStaleInboxNotifications } from "@/modules/notifications/services/notification-archive-cron";

export {
  seedNotificationCatalog,
  listUserPreferences,
  updateUserPreferences,
} from "@/modules/notifications/services/notification-preferences";

export {
  notificationEventSchema,
  bulkActionSchema,
  preferencesUpdateSchema,
  historyQuerySchema,
} from "@/modules/notifications/validations/schemas";
