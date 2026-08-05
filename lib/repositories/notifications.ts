import { FALLBACK_ERROR_CODE } from "@/constants/errors";
import { ApiError, apiGet, apiPut } from "@/lib/api-client";
import type { NotificationDto, NotificationListDto } from "@/types/notification";

const NOTIFICATIONS_PATH = "/api/notifications";

/** 최근 알림과 읽지 않은 개수를 조회한다. */
export async function fetchNotifications(signal?: AbortSignal): Promise<NotificationListDto> {
  const data = await apiGet<NotificationListDto | null>(NOTIFICATIONS_PATH, { signal });
  if (!data || !Array.isArray(data.items) || typeof data.unreadCount !== "number") {
    throw new ApiError(FALLBACK_ERROR_CODE, `invalid notifications payload for ${NOTIFICATIONS_PATH}`, 200);
  }
  return data;
}

/** 알림 하나를 읽음 처리하고 확정된 항목을 반환한다. */
export function markNotificationRead(id: number): Promise<NotificationDto> {
  return apiPut<NotificationDto>(`${NOTIFICATIONS_PATH}/${id}/read`);
}
