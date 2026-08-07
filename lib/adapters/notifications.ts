import { getReportTypeLabel } from "@/lib/report-type";
import type { NotificationDto } from "@/types/notification";

/**
 * 알림 화면 모델 — 드롭다운·독립 /notifications 화면이 공유한다.
 * 서버 DTO 에 표시용 시각(createdAtMs·timeLabel)만 얹는다. 제목·본문은 항상 서버 값 그대로 쓴다
 * (§7 — 알 수 없는 type 이라도 가짜 한국어 타입명을 만들지 않는다).
 */
export type NotificationVM = NotificationDto & {
  createdAtMs: number | null;
  /** "오후 3:20" 형태. 파싱 실패 시 빈 문자열(임의 값 생성 금지). */
  timeLabel: string;
};

const TIME_FORMAT = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });

export function toNotificationVM(dto: NotificationDto): NotificationVM {
  const ts = Date.parse(dto.createdAt);
  const valid = !Number.isNaN(ts);
  return {
    ...dto,
    createdAtMs: valid ? ts : null,
    timeLabel: valid ? TIME_FORMAT.format(ts) : "",
  };
}

/**
 * REPORT_READY 알림의 생성 트리거 라벨. 매핑 실체는 `lib/report-type.ts`(단일 소스)이고
 * 여기서는 알림 문맥의 이름으로만 다시 노출한다 — 같은 표를 두 곳에 두지 않는다.
 * null·미확인 값은 추측하지 않고 null 이며, 호출부가 일반 라벨로 대체하거나 생략한다.
 */
export const reportTypeLabel = getReportTypeLabel;

export type NotificationGroup = {
  key: string;
  label: string;
  items: NotificationVM[];
};

/** 사용자 로컬 기준 연·월·일 키(그룹 동일성 판단) — lib/adapters/report-archive.ts 와 동일 규율. */
function localDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 그룹 라벨 — 오늘/어제는 접두사만, 그 외는 항상 연도를 병기한다("YYYY년 M월 D일"). */
function notificationDateLabel(ts: number, now: Date): string {
  const key = localDateKey(ts);
  if (key === localDateKey(now.getTime())) return "오늘";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === localDateKey(yesterday.getTime())) return "어제";
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * createdAt 로컬 날짜 기준 그룹핑(오늘/어제/YYYY년 M월 D일). 입력 순서(서버 최신순)를 유지하며
 * 등장 순서대로 그룹을 만든다. 파싱 실패 항목은 raw 값을 노출하지 않고 별도 "날짜 정보 없음"
 * 그룹으로 모아 화면을 깨뜨리지 않는다.
 */
export function groupNotificationsByDate(items: NotificationVM[], now: Date): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const byKey = new Map<string, NotificationGroup>();
  const invalid: NotificationVM[] = [];

  for (const item of items) {
    if (item.createdAtMs === null) {
      invalid.push(item);
      continue;
    }
    const key = localDateKey(item.createdAtMs);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: notificationDateLabel(item.createdAtMs, now), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  if (invalid.length > 0) {
    groups.push({ key: "unknown-date", label: "날짜 정보 없음", items: invalid });
  }
  return groups;
}
