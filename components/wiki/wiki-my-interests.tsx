"use client";

import { useRef, useState } from "react";

import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { Button } from "@/components/ui/button";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { ERROR_CODES } from "@/constants/errors";
import { ApiError } from "@/lib/api-client";
import { deleteInterest } from "@/lib/repositories/interests";
import type { MyInterestsState } from "@/hooks/use-my-interests";
import type { InterestDto } from "@/types/interest";

/**
 * 접힌 상태에서 보여줄 관심사 개수. 관심사가 늘어도 패널 높이가 따라 늘지 않게 막는다.
 * 나머지는 `전체 N개 보기`로 펼친다.
 */
const MY_PREVIEW = 6;

/**
 * [내 관심사] — 목업 wiki.html .wcard 목록 기준 (2026-08-05 목업 정렬).
 * 원천 = GET /api/interests (source=USER, 온보딩·발견 후보 추가·직접 추가가 모두 이리로 모인다).
 * - 삭제 = DELETE /api/interests/{id} (soft delete). 404 는 이미 없는 것 → 성공 취급(멱등).
 * - 목업의 "고정됨"·"잠시 쉬는 중"·수정하기 모달(rename)은 이번 범위 밖 — 고정/중지 백엔드가 없고
 *   rename 은 후속. 동작하지 않는 컨트롤을 만들지 않는다.
 *
 * <b>레이아웃 = 칩 + 편집 모드(2026-08-12 검수).</b> 잠깐 칩 클릭 → 팝오버(이름·삭제)를 썼는데,
 * 팝오버가 담을 게 삭제 하나뿐이라 기능에 비해 구조가 과했다(빈 상자에 버튼 한 개).
 * 평상시에는 칩만 두고, 제목 옆 `편집` 을 눌렀을 때만 칩마다 `×` 를 붙인다.
 * - 평상시 칩은 <b>버튼이 아니다</b>(span) — 눌러도 아무 일이 없어야 하므로 아예 상호작용을 두지 않는다.
 * - 확인 모달은 두지 않는다. 삭제는 `편집 → ×` 2단계를 이미 거치고, 지운 관심사는 옆 발견 목록으로
 *   돌아가 한 번에 되돌릴 수 있다(wiki-screen 의 removedNames). 되돌릴 수 없는 조작이 아니다.
 *
 * <b>출처 배지·근거 문구는 두지 않는다.</b> `fetchUserInterests` 가 `source === "USER"` 만 반환해
 * 목록이 전부 USER 라 출처는 표시해도 정보가 0 이고(2026-08-11 에 "AI 일치·신뢰도"를 뺀 이유와 동일),
 * agent 근거는 어느 관심사를 열어도 같은 상용구가 나와서 걷어냈다(2026-08-12).
 */
export function WikiMyInterests({
  state,
  onRemoved,
}: {
  state: MyInterestsState & { refetch: () => void };
  /** 뺀 관심사 이름을 알린다 — 화면이 그 이름을 발견 목록에 남겨 되돌릴 수 있게 한다. */
  onRemoved: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editRequested, setEditRequested] = useState(false);
  /** 삭제 성공 낭독 — 칩이 사라지는 조작이라 시각 피드백만으로는 알 수 없다. */
  const [announcement, setAnnouncement] = useState("");
  /** 삭제 실패 안내 — 칩은 그대로 두고 목록 아래에 어느 관심사가 실패했는지 적는다. */
  const [error, setError] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const interests = state.status === "success" ? state.data : [];
  const visible = expanded ? interests : interests.slice(0, MY_PREVIEW);
  /**
   * 편집 상태는 파생값이다 — 마지막 관심사를 지우면 편집할 대상이 없으므로 자동으로 풀린다.
   * (state 로만 들고 있으면 목록이 빈 뒤에도 편집 중이 남아, 새로 추가한 칩에 ×가 붙어 나온다.)
   */
  const editing = editRequested && interests.length > 0;

  /** 삭제로 칩이 사라지면 포커스가 body 로 떨어진다 → 목록으로 되돌린다. */
  function recoverFocus() {
    listRef.current?.focus();
  }

  return (
    // 발견 후보 패널과 짝을 이루는 박스(2026-08-11 우석 — 2열 배치). 같은 껍데기·같은 제목 크기라
    // 왼쪽에서 추가하면 오른쪽에 나타나는 이동이 한눈에 읽힌다.
    <section
      aria-label="내 관심사"
      className="rounded-[14px] border border-border bg-card px-[18px] py-4"
    >
      {/* 제목 | 개수(보조) ────── 편집/완료. 개수는 제목에 붙여 두고 버튼만 오른쪽 끝으로 민다. */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-baseline gap-2 text-[15px] font-bold tracking-[-0.01em] text-foreground">
          내 관심사
          {state.status === "success" && (
            <span className="text-[11.5px] font-normal text-muted-foreground">
              {state.data.length}개
            </span>
          )}
        </h2>
        {interests.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              setEditRequested((v) => !v);
              setError("");
            }}
            aria-pressed={editing}
            className="min-h-8 shrink-0 text-[12px] font-semibold text-ink-mid"
          >
            {editing ? "완료" : "편집"}
          </Button>
        )}
      </div>

      {/* 안내는 섹션에 한 번만 둔다(2026-08-11 우석 — 화면 정리). 칩에는 이름만 남긴다. */}
      <p className="mt-1 mb-3 text-[12.5px] leading-[1.6] text-pretty text-muted-foreground">
        브리핑 주제로 사용하는 관심사예요. 편집을 눌러 관심사를 정리할 수 있어요.
      </p>

      {state.status === "loading" && <FeedSkeleton />}

      {state.status === "error" && (
        <StateView
          role="alert"
          className="min-h-[120px]"
          icon={<IconAlert />}
          title="내 관심사를 불러오지 못했어요"
          description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
          errorCode={state.errorCode}
          actions={[{ label: "다시 시도", onClick: state.refetch, variant: "primary" }]}
        />
      )}

      {state.status === "success" && state.data.length === 0 && (
        <StateView
          className="min-h-[120px]"
          icon={<IconEmptyDoc />}
          title="아직 관심사가 없어요"
          description="발견 목록에서 추가하거나, 관심 자료를 저장해 AI가 찾게 해보세요."
        />
      )}

      {state.status === "success" && state.data.length > 0 && (
        <>
          <ul ref={listRef} tabIndex={-1} className="flex flex-wrap gap-1.5 outline-none">
            {visible.map((interest) => (
              <li key={interest.id} className="min-w-0 max-w-full">
                <InterestChip
                  interest={interest}
                  editing={editing}
                  onRemoved={onRemoved}
                  announce={setAnnouncement}
                  onError={setError}
                  recoverFocus={recoverFocus}
                />
              </li>
            ))}
          </ul>

          {error && (
            <p role="alert" className="mt-2 text-[11.5px] leading-[1.6] text-destructive">
              {error}
            </p>
          )}

          {state.data.length > MY_PREVIEW && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 min-h-9 w-full text-[12.5px] font-semibold text-ink-mid"
            >
              {expanded ? "접기" : `전체 ${state.data.length}개 보기`}
            </Button>
          )}
        </>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

/**
 * 관심사 칩 1개.
 *
 * 평상시에는 `span` 이다 — 누를 게 없으므로 버튼으로 만들지 않는다(빈 동작 금지).
 * 편집 중에만 오른쪽에 삭제 `×` 버튼이 붙는다. 칩 높이는 두 상태가 같고(min-h-9),
 * 늘어나는 건 `×` 자리(오른쪽 여백을 줄여 증가폭을 줄였다)뿐이라 배치가 크게 흔들리지 않는다.
 *
 * 삭제 요청 중에는 칩을 흐리게 하고 버튼을 비활성화해 중복 요청을 막는다.
 * 실패해도 칩은 그대로 두고, 어느 관심사가 실패했는지 목록 아래 안내로 알린다.
 */
function InterestChip({
  interest,
  editing,
  onRemoved,
  announce,
  onError,
  recoverFocus,
}: {
  interest: InterestDto;
  editing: boolean;
  onRemoved: (name: string) => void;
  announce: (message: string) => void;
  onError: (message: string) => void;
  recoverFocus: () => void;
}) {
  const [busy, setBusy] = useState(false);

  function finishRemoved() {
    announce(`${interest.name} 관심사를 삭제했어요`);
    onRemoved(interest.name);
    recoverFocus();
  }

  function remove() {
    if (busy) return;
    setBusy(true);
    onError("");
    deleteInterest(interest.id)
      .then(finishRemoved)
      .catch((err) => {
        // 이미 삭제된 경우 목표 상태 달성 — 목록 재조회로 정합시킨다.
        if (err instanceof ApiError && err.code === ERROR_CODES.NOT_FOUND) {
          finishRemoved();
          return;
        }
        onError(`${interest.name} 관심사를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.`);
      })
      .finally(() => setBusy(false));
  }

  /*
    칩 = 흰 배경 + 주황 틴트 테두리 (2026-08-12 검수). 전부 기존 토큰이다 —
    `bg-card`(라이트 #FFFFFF · 다크 #181B21: 다크에서 순백을 쓰지 않는다) ·
    `border-wash-strong` · 본문색 `text-foreground` · hover 는 아주 옅은 주황 배경
    `bg-wash`(주황 9%/다크 14%). 새 색값을 만들지 않았다.

    테두리는 `--primary` 원색(#FF5A00)이 아니라 **`--wash-strong`(주황 20%/다크 30%)** 이다.
    원색으로 두니 칩마다 진한 주황 링이 6~9개씩 반복돼 목록이 튀었다(2026-08-12 검수).
    `--wash-strong` 은 globals.css 에서 "주황 틴트(테두리)" 용도로 정의된 토큰이고,
    같은 화면의 `＋ 추가` 버튼 테두리와도 같은 값이라 언어가 맞는다.
    포커스 링은 편집 중 `×` 버튼의 `.focus-ring` 이 맡고, 그 색이 `--ring`(= primary)이다.
  */
  return (
    <span
      className={`inline-flex min-h-9 max-w-full min-w-0 items-center rounded-full border border-wash-strong bg-card text-[12.5px] font-semibold text-foreground transition-colors hover:bg-wash ${
        editing ? "py-1 pr-1 pl-3" : "px-3 py-1.5"
      } ${busy ? "opacity-60" : ""}`}
    >
      <span className="min-w-0 truncate">{interest.name}</span>
      {editing && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-busy={busy}
          aria-label={`${interest.name} 관심사 삭제`}
          className="focus-ring ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] leading-none text-muted-foreground hover:bg-background hover:text-destructive disabled:cursor-not-allowed"
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}
