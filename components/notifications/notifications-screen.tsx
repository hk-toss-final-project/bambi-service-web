"use client";

import { useState } from "react";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { NotificationRow } from "@/components/notifications/notification-row";
import { NotificationsRail } from "@/components/notifications/notifications-rail";
import { PageState } from "@/components/ui/page-state";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { useNotificationOpen } from "@/hooks/use-notification-navigation";
import { useNotifications } from "@/hooks/use-notifications";
import { groupNotificationsByDate, toNotificationVM } from "@/lib/adapters/notifications";
import type { NotificationDto } from "@/types/notification";

/**
 * 독립 알림 화면 — /notifications. 로그인 사용자 전용(§15 인증 4분기 패턴 재사용:
 * loading→스켈레톤 / error→복원오류 / guest→접근제한 / authenticated→본문).
 *
 * 헤더 드롭다운과 동일한 view model·행 컴포넌트·target resolve를 재사용해 시각·읽음 처리 규칙이
 * 어긋나지 않게 한다. 이 화면에서는 HomeNav의 bell이 드롭다운을 열지 않고 현재 화면 링크로만
 * 렌더되므로(components/home/notification-menu.tsx), 여기 본문의 useNotifications 인스턴스
 * 하나만 30초 polling한다(드롭다운과 중복 없음).
 *
 * 목업(docs/design-handoff/product/notifications.html) 구조를 지원 범위 안에서 따르되, 정보
 * 구조는 더 단순하게 정리했다 — 좌측 네비·중앙 리스트·우측 rail 3단 구성, 상단 제목/보조문구는
 * 유지하지만 "전체/조건 달성" 탭 바는 조건 달성 알림 자체가 없어 렌더할 내용이 없으므로 아예
 * 없앴다(빈 탭을 억지로 보여주지 않는다). 모두 읽음(bulk API 없음)·알림 설정 토글(API 없음)도
 * 만들지 않는다. 우측 rail은 실제 설정 API가 없어 읽기 전용 요약(components/notifications/notifications-rail.tsx)
 * 으로만 존재한다(목업 대비 미지원 범위 — bambi-service-web CLAUDE.md, PR 문서 §3 참고).
 */
export function NotificationsScreen() {
  const { status, refreshAuth } = useAuth();

  if (status === "loading") return <NotificationsSkeleton />;
  if (status === "error") return <NotificationsAuthError onRetry={refreshAuth} />;
  if (status === "guest") return <NotificationsAccessRestricted />;
  return <NotificationsView />;
}

function NotificationsView() {
  const notifications = useNotifications();
  const { pendingId, error, openNotification } = useNotificationOpen(notifications.refetch);
  const [amOpen, setAmOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />

      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <SideLeft footLines={[]} />

          <main className="min-w-0 max-w-[760px] flex-1">
            <div className="mb-4">
              <h1 className="text-[22px] font-bold tracking-[-0.015em] text-foreground">알림</h1>
              <p className="mt-[5px] text-[13px] text-muted-foreground">
                새 보고서와 주요 업데이트를 알려드려요.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="mb-3 rounded-[10px] border border-wash-strong bg-wash px-4 py-2.5 text-[13px] whitespace-pre-line text-signal-ink"
              >
                {error.message}
              </p>
            )}

            {notifications.status === "loading" || notifications.status === "idle" ? (
              <NotificationsListSkeleton />
            ) : notifications.status === "error" ? (
              <StateView
                role="alert"
                className="min-h-[280px]"
                icon={<IconAlert />}
                title="알림을 불러오지 못했어요"
                description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
                actions={[{ label: "다시 시도", onClick: notifications.refetch, variant: "primary" }]}
              />
            ) : notifications.data.items.length === 0 ? (
              <StateView
                className="min-h-[240px]"
                icon={<IconEmptyDoc />}
                title="아직 알림이 없어요"
                description="새 보고서가 완성되면 이곳에서 알려드려요."
              />
            ) : (
              <NotificationGroups
                items={notifications.data.items}
                pendingId={pendingId}
                onOpen={openNotification}
              />
            )}
          </main>

          <NotificationsRail />
        </div>
      </div>

      {/* 알림 목록과는 독립적인 저장 흐름이라 onSaved(refetch)를 연결하지 않는다. */}
      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />
    </div>
  );
}

/** 날짜별 고정 그룹(오늘/어제/YYYY년 M월 D일) + 목록 끝 안내. 묶기 옵션 없음(보고서 전체 보기와 동일 규율). */
function NotificationGroups({
  items,
  pendingId,
  onOpen,
}: {
  items: NotificationDto[];
  pendingId: number | null;
  onOpen: (notification: NotificationDto) => void;
}) {
  const now = new Date();
  const groups = groupNotificationsByDate(items.map(toNotificationVM), now);

  return (
    <>
      {groups.map((group) => (
        <section key={group.key} className="mb-1">
          <h2 className="mt-4 mb-[9px] px-0.5 text-[12.5px] font-bold text-ink-mid">{group.label}</h2>
          <ul className="flex flex-col gap-[7px]">
            {group.items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                pending={pendingId === notification.id}
                onOpen={onOpen}
                variant="card"
              />
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-5 text-center text-[13px] font-bold text-ink-mid">최근 알림을 모두 봤어요</p>
    </>
  );
}

/** 목록 로딩 스켈레톤 — 그룹 헤딩 2개 + 카드형 행 골격(목업 카드 톤과 동일한 gap 기반 배치). */
function NotificationsListSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div aria-hidden="true">
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="animate-pulse">
          <div className={`mt-4 mb-[9px] h-3.5 w-16 ${bar}`} />
          <div className="flex flex-col gap-[7px]">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-[12px] border border-border bg-card px-[15px] py-3">
                <div className={`h-4 w-2/3 ${bar}`} />
                <div className={`mt-2 h-3.5 w-full ${bar}`} />
                <div className={`mt-2 h-3 w-16 ${bar}`} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
    </div>
  );
}

/** 인증 복구 중 — 중립 전체 스켈레톤(내 보고서 전체 보기와 동일 규율). */
function NotificationsSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <main className="min-w-0 max-w-[760px] flex-1">
            <div className="mb-5 h-7 w-24 rounded-md bg-[var(--skel1)]" />
            <NotificationsListSkeleton />
          </main>
        </div>
      </div>
    </div>
  );
}

/** 인증 복원 오류(500·네트워크) — 재시도 제공. */
function NotificationsAuthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        icon={<IconAlert />}
        title="인증 상태를 확인하지 못했어요"
        description="네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요."
        actions={[
          { label: "다시 시도", onClick: onRetry, variant: "primary" },
          { label: "홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}

/** guest 직접 진입 — 개인 데이터 화면이라 본문 대신 접근 제한 안내(§15). 목록 API는 호출되지 않는다. */
function NotificationsAccessRestricted() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        role="alert"
        iconTone="brand"
        icon={<Orb size={22} />}
        title="로그인이 필요한 페이지예요"
        description="알림은 로그인한 사용자만 볼 수 있어요."
        actions={[
          { label: "로그인", href: "/login", variant: "primary" },
          { label: "공개 홈으로", href: "/", variant: "ghost" },
        ]}
      />
    </div>
  );
}
