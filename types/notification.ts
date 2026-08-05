/** 리포트 발행 완료 알림 Inbox API 타입. */
export type NotificationDto = {
  id: number;
  type: string;
  title: string;
  body: string;
  targetPath: string;
  read: boolean;
  createdAt: string;
};

export type NotificationListDto = {
  unreadCount: number;
  items: NotificationDto[];
};
