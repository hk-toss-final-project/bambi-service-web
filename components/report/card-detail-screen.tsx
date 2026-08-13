"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth/use-auth";
import { Orb } from "@/components/brand/orb";
import { AddMaterialModal } from "@/components/home/add-material-modal";
import { HomeNav } from "@/components/home/home-nav";
import { SideLeft } from "@/components/home/side-left";
import { PageState } from "@/components/ui/page-state";
import { IconAlert, IconSearch } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import { CardComments } from "@/components/report/card-comments";
import { CardLikeButton } from "@/components/report/card-like-button";
import { CardScrapButton } from "@/components/report/card-scrap-button";
import { CardVisibilityToggle } from "@/components/report/card-visibility-toggle";
import { ReportTypeBadge } from "@/components/report/report-type-badge";
import { CopyToast } from "@/components/ui/copy-toast";
import type { ErrorCode } from "@/constants/errors";
import { useCardDetail } from "@/hooks/use-card-detail";
import { useCopyCardLink } from "@/hooks/use-copy-card-link";
import { useReportBody, type ReportBodyState } from "@/hooks/use-report-body";
import {
  isCardOwner,
  isPublicCard,
  toCardSocial,
  toFeedCardVM,
  toScrapped,
} from "@/lib/adapters/card";
import {
  toReportCoverImage,
  toReportRailVM,
  type ReportCoverImageVM,
} from "@/lib/adapters/report";
import { homeTabHref, reportBackTarget, type ReportOrigin } from "@/lib/report-origin";
import { ReportMarkdown } from "@/components/report/report-markdown";
import { isDeltaReport } from "@/lib/report-delta";
import { isMorningBriefing } from "@/lib/report-type";
import type { CardResponse, CardVisibility } from "@/types/feed";

/**
 * 실 카드 상세 (GET /api/cards/{publicId}) — /report/{UUID}.
 *
 * 2단계 데이터 흐름(2026-08-03 본문 연결, service-api PR #25·#30 실측):
 *   GET /api/cards/{publicId} → CardResponse.reportId(리포트 publicId, nullable)
 *   → reportId 있으면 GET /api/reports/{reportId} → body(Markdown) 렌더(ReportMarkdown).
 *   reportId=null 은 계약상 "리포트 없는 카드"(동기 즉시 카드 등) — 본문 섹션 없이 기존 요약 화면 그대로.
 *
 * 공개 열람(2026-08-04, service-api #30 실측): GET /api/cards/* · /api/reports/* 는 permitAll 이고
 * 권한은 "내 카드 or PUBLIC" 이다 → guest 도, 로그인한 타인도 PUBLIC 카드 상세를 그대로 본다.
 * 남의 PRIVATE·부재·형식오류는 401/403 이 아니라 전부 404 라 아래 DetailNotFound 한 갈래로 모인다.
 * 좋아요(2026-08-04, service-api PR #35 소셜 필드): PUBLIC 카드에서만 토글을 렌더하고,
 * 작성자 본인 여부로는 숨기거나 막지 않는다(정책 확정 — 서버도 소유자를 차단하지 않는다).
 * 소셜 값이 검증되지 않으면(미배포 응답·비정상 null) 좋아요 UI 자체를 두지 않는다.
 * 보관(2026-08-07, service-api #53 `CardResponse.scrapped`)은 좋아요보다 범위가 한 겹 넓다 —
 * service-api #85 이후 **본인 소유 PRIVATE 도 담을 수 있다**. PUBLIC 이거나 내 카드이고 값 검증을
 * 통과하면 readbar 에 토글을 렌더하며, 좋아요 값과 **독립적으로** 판정한다.
 * 인증(복구) 상태 우선 → 데이터 상태(두 loading 분리). 백엔드가 주는 값만 렌더한다.
 * 리포트의 title·summary·citations 는 카드의 title·summary·sources 와 같은 발행 payload 라
 * 다시 렌더하지 않는다(중복 방지, PublishProcessingService 실측) — 본문(body)만 추가한다.
 * id 존재검증·라우팅은 서버(app/report/[id]/page.tsx)가 하고, 여기선 등록된 UUID 의 데이터만 다룬다.
 *
 * 뒤로가기(2026-08-12): 문구·목적지를 **진입 출처(`origin`)** 에서 함께 파생한다(lib/report-origin.ts).
 * 서버가 URL 의 `?from=` 을 허용 토큰으로 좁혀 넘겨주므로 새로고침·직접 진입에서도 값이 같고,
 * 소유자 여부·`document.referrer` 로 출처를 추측하지 않는다(홈 피드에서 자기 공개 카드를 열 수 있다).
 */
export function CardDetailScreen({
  publicId,
  origin,
}: {
  publicId: string;
  origin: ReportOrigin;
}) {
  const { status, user, refreshAuth } = useAuth();
  const detail = useCardDetail(publicId);

  // 1) 인증(복구) 상태 — 확정 전엔 데이터 화면을 내보내지 않는다.
  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailAuthError onRetry={refreshAuth} />;

  // 2) 데이터 상태 — 인증 확정(guest·authenticated) 후에 평가한다.
  //    guest 도 여기까지 온다: PUBLIC 이면 상세가 뜨고, 아니면 API 404 → DetailNotFound.
  if (detail.status === "loading") return <DetailSkeleton />;
  if (detail.status === "error")
    return <DetailDataError onRetry={detail.refetch} errorCode={detail.errorCode} />;
  if (detail.status === "notFound") return <DetailNotFound />;
  return (
    <CardDetailView
      card={detail.card}
      guest={status === "guest"}
      origin={origin}
      // 소유자 판정의 좌변. guest·error·loading 에서는 user 가 null 이라 자연히 비소유자가 된다.
      // publicId 는 백엔드 UserSummary 확장(#24) 이후 값이라 optional — 없으면 판정이 false 다.
      viewerPublicId={user?.publicId ?? null}
    />
  );
}

/**
 * 실제 상세 렌더 — 실 필드만. 크롬은 mock 상세와 공유하되 보관·MD 는 두지 않는다(실 카드 미지원).
 * guest 는 좌측 내비를 아이콘 전용으로 렌더한다(§15) — 홈 외 항목은 GuestGateModal 로 게이트된다.
 * 상단 HomeNav 는 자체적으로 useAuth 로 분기하므로 별도 prop 이 필요 없다.
 *
 * **공개 범위·공유는 이 화면이 담당한다**(목록 카드에는 읽기 전용 배지만 둔다):
 * - 소유자: readbar 의 공개 범위 드롭다운(`CardVisibilityToggle`) — 버튼은 현재 상태만 말하고
 *   값은 목록에서 고를 때만 바뀐다. 공개 상태면 `링크 복사`가 함께 뜬다(비공개 링크는 남이 못 열어
 *   의미가 없다).
 * - 비소유자·게스트: PUBLIC 상세에서 링크 복사만 (여기 도달하는 남의 카드는 PUBLIC 뿐 —
 *   남의 PRIVATE 는 서버가 404 로 감춰 DetailNotFound 로 간다)
 * 전환이 성공하면 같은 화면에서 좋아요·댓글 노출 조건이 곧바로 다시 평가된다(재요청·이동 없음).
 */
function CardDetailView({
  card,
  guest,
  origin,
  viewerPublicId,
}: {
  card: CardResponse;
  guest: boolean;
  origin: ReportOrigin;
  viewerPublicId: string | null;
}) {
  const [amOpen, setAmOpen] = useState(false);
  /*
    공개 범위 변경 결과 — PATCH 성공 응답의 `visibility` **한 필드만** 서버 카드 위에 얹는다.
    응답 전체로 교체하지 않는 이유: PATCH 응답은 목록용 변환 경로라 author·likeCount·liked 가
    모두 null 이다(2026-08-05 실측). 통째로 갈아끼우면 방금 켜진 좋아요 UI 와 소유자 판정이 사라진다.

    `source` 로 원본 카드 참조를 함께 들고 render 시점에 비교한다 — 카드가 바뀌거나(다른 publicId)
    서버 응답이 새로 오면 참조가 달라져 이전 override 가 새 카드에 얹히지 않는다. effect 초기화가
    없으므로 set-state-in-effect 도, useAsyncData cleanup·StrictMode 동작 변경도 없다.
  */
  const [override, setOverride] = useState<{ source: CardResponse; visibility: CardVisibility } | null>(
    null,
  );
  const visibility = override !== null && override.source === card ? override.visibility : card.visibility;
  const shown: CardResponse = visibility === card.visibility ? card : { ...card, visibility };

  const applyVisibility = useCallback(
    (next: CardVisibility) => setOverride({ source: card, visibility: next }),
    [card],
  );

  const vm = toFeedCardVM(shown);
  // 좋아요 초기값 — 단건 상세 응답의 author·likeCount·liked 를 런타임 검증해 좁힌다.
  // 소셜 필드가 없는 응답(미배포·비정상 null)이면 null 이고, 그때는 좋아요 UI 를 렌더하지 않는다.
  const social = toCardSocial(shown);
  // 보관 초기값 — 좋아요와 **독립적으로** 검증한다(소셜 값이 없어도 보관은 그대로 쓸 수 있다).
  // null(필드 미배포·비정상 값)이면 담긴 상태를 알 수 없다는 뜻이라 버튼을 두지 않는다.
  const scrapped = toScrapped(shown.scrapped);
  // 본문(리포트) — 카드 ready 후에만 이 컴포넌트가 mount 되므로 여기서 2단계 요청을 시작한다.
  const body = useReportBody(card.reportId);
  // 카드 상세 계약을 우선하고, 단계적 배포 중 필드가 없으면 리포트 상세 계약으로 폴백한다.
  const rawCoverImage =
    shown.coverImage ?? (body.status === "ready" ? body.report.coverImage : null);
  const coverImage = toReportCoverImage(rawCoverImage);
  // 공개 범위 변경은 **카드 소유자에게만** 노출한다(비소유자·게스트는 링크 복사만).
  const owner = isCardOwner(shown, viewerPublicId);
  const isPublic = isPublicCard(shown);
  // 뒤로가기 문구·목적지 — 진입 출처에서만 나온다. 소유자 여부(`owner`)와는 **무관**하다:
  // 홈 피드에서 자기 공개 보고서를 열면 소유자여도 돌아갈 곳은 홈 피드다.
  const back = reportBackTarget(origin);
  /*
    아침 브리핑 + PRIVATE → 공유 진입점 자체를 두지 않는다.

    이 조합에서는 모달을 열어도 할 수 있는 일이 없다. 공개 전환은 정책상 막혀 있고(#92),
    PRIVATE 링크는 남이 열 수 없어 `링크 복사`도 의미가 없다 — 남는 건 닫기뿐이라 진입점이
    막다른 길이 된다. 눌러도 아무것도 못 하는 버튼을 두지 않는다는 기존 원칙과 같다.

    **PUBLIC 아침 브리핑(구 데이터)에서는 그대로 둔다.** 서버 가드가 없던 시절 공개된 카드가
    있을 수 있고, 그 모달이 `비공개로 전환` 의 유일한 경로다. 여기까지 감추면 사용자가 이미
    나간 노출을 스스로 거둘 수 없다(#92 가 PUBLIC→PRIVATE 를 막지 않는 것과 같은 이유).

    판별은 콘텐츠 유형을 명시적으로 본다 — `lib/report-type.ts` 의 `isMorningBriefing`
    (서버 `reportType` 단일 근거). 제목·URL·공개 여부로 유형을 추정하지 않는다.
    ⚠️ 이건 진입점 정리(UX)일 뿐 차단 수단이 아니다. 공개 차단은 훅(use-card-visibility)과
    서버가 계속 담당한다 — 버튼을 감췄다고 그쪽 로직을 걷어내지 않는다.
  */
  const morningBriefingPrivate = isMorningBriefing(shown.reportType) && !isPublic;

  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => setAmOpen(true)} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          {/* 개인 foot 데이터가 없어 footLines 는 비운다(임의 생성 금지). */}
          <SideLeft footLines={[]} guest={guest} />

          <main className="min-w-0 max-w-[760px] flex-1">
            {/*
              .readbar — 좌측 뒤로가기 + 우측 액션(보관·공유). MD 내려받기는 실 카드 미지원 → 두지 않음.

              목업(report-detail.html)의 readbar 는 padding 9px 12px 이고, **두께는 내부
              `.btn`(height:32px)이 만든다** → 좌측 링크와 우측 버튼 모두 32px 높이를 줘 목업과
              같은 두께(32 + 9·2 + 보더 2 = 52px)를 유지한다. sticky·border·bg-card·rounded·
              shadow·focus-ring 은 기존 그대로이고 새 강조색을 만들지 않는다.

              클릭 영역은 `←` + 문구가 실제로 차지하는 만큼이다. 예전에는 링크가 flex-1 로 남은
              가로 공간까지 차지해 바의 빈 자리를 눌러도 돌아갔는데, 누른 줄도 모르고 화면이
              바뀌는 오작동이라 걷어냈다. 지금은 inline-flex + w-fit 으로 콘텐츠 폭만 쓰고 우측
              액션은 링크의 mr-auto 가 민다 — hover·focus·pointer 도 링크 영역에만 걸린다.

              문구·목적지는 진입 출처 하나에서 같이 나온다(`reportBackTarget`) — 둘이 어긋날 수
              없다. `←` 는 장식이라 aria-hidden 이고, 링크의 접근 가능한 이름 = 화면 문구다.
            */}
            <div className="sticky top-4 z-20 mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-[9px] shadow-[var(--shadow)]">
              <Link
                href={back.href}
                className="focus-ring mr-auto inline-flex min-h-8 w-fit items-center gap-2 rounded-lg text-[13.5px] font-semibold whitespace-nowrap text-ink-mid hover:text-signal-ink"
              >
                <span aria-hidden="true" className="text-muted-foreground">
                  ←
                </span>
                {back.label}
              </Link>
              {/*
                보관 — readbar 의 공유 왼쪽. `PUBLIC 이거나 내 카드` + `scrapped` 검증 통과일 때 렌더한다.

                `|| owner` 가 붙은 이유(2026-08-12, service-api #85): 서버가 **본인 소유 PRIVATE 의
                스크랩 생성·해제를 허용**하고 `GET /api/scraps` 에도 포함해 내려준다. 그전까지는
                스크랩 대상이 PUBLIC 뿐이라 `isPublic` 하나로 막아 뒀는데, 그 조건이 그대로 남아
                내 비공개 보고서만 담기 버튼이 사라져 있었다(서버는 되는데 화면이 막던 자리).

                **남의 PRIVATE 는 이 조건으로도 열리지 않는다**: `isPublic` 이 false 이고 `owner` 는
                `isCardOwner`(양쪽 publicId 의 UUID 일치)가 false 라 둘 다 걸리지 않는다. 애초에
                서버가 남의 PRIVATE 를 404 로 감춰 이 화면까지 오지도 않는다(DetailNotFound).
                author 가 없는 응답에서도 `isCardOwner` 는 false 라 안전한 쪽으로 닫힌다.

                좋아요(카드 article 하단)와 같은 줄에 두지 않은 이유: 두 액션의 노출 조건이 서로
                달라(`social !== null` vs `scrapped !== null`) 한 줄로 묶으면 한쪽이 없을 때 빈
                구분선만 남는다. readbar 는 이미 `공유` 를 담은 액션 자리이고 스크롤과 무관하게
                고정돼 있어, 상세 레이아웃을 건드리지 않고 들어갈 수 있는 가장 자연스러운 위치다.
              */}
              {(isPublic || owner) && scrapped !== null && (
                <CardScrapButton
                  publicId={shown.publicId}
                  initialScrapped={scrapped}
                  variant="bar"
                />
              )}
              {/*
                공유 — 권한과 상태에 따라 할 수 있는 일이 다르다.
                - 소유자: 공개 범위 설명·변경과 링크 복사를 담은 모달을 연다.
                  단 PRIVATE 아침 브리핑은 제외 — 모달에 남는 액션이 없다(위 주석 참조).
                - 비소유자·게스트(PUBLIC 만 여기 도달): 링크 복사만. 공개 범위 변경 UI 도,
                  공개/비공개 문구도 노출하지 않는다(권한 없는 기능을 보여주지 않는다).

                버튼이 빠져도 바 높이·정렬은 그대로다 — 두께는 좌측 링크의 min-h-8 이 만들고
                링크의 mr-auto 가 우측 액션을 민다(우측 액션은 shrink-0 부가 요소).
              */}
              {owner && !morningBriefingPrivate ? (
                <>
                  {/*
                    링크 복사는 **공개 상태일 때만** 둔다. 비공개 링크는 남이 열 수 없어
                    복사해도 줄 곳이 없다(모달 시절 `링크 복사`를 PRIVATE 에서 빼둔 것과 같은 이유).
                  */}
                  {isPublic && <CopyLinkButton publicId={shown.publicId} />}
                  <CardVisibilityToggle
                    publicId={shown.publicId}
                    reportType={shown.reportType}
                    visibility={visibility}
                    onChanged={applyVisibility}
                  />
                </>
              ) : (
                isPublic && <CopyLinkButton publicId={shown.publicId} />
              )}
            </div>

            {/* .dcard */}
            <article className="mb-4 rounded-2xl border border-border bg-card px-5 py-6 sm:px-[30px] sm:py-[26px]">
              <ReportCoverHero coverImage={coverImage} />
              {/*
                생성 종류 + 작성 시각 한 줄. 종류 배지는 **내 보고서에만** 의미가 있으므로
                소유자에게만 렌더한다 — 이 화면은 소유자와 공개 카드 열람자(타인·게스트)가 같은
                컴포넌트를 공유하는 유일한 자리라, 게이트 없이 두면 남의 카드에 배지가 노출된다.
                값이 없으면 배지가 스스로 사라지고 기존 날짜 줄만 남는다(레이아웃 동일).
              */}
              {(owner || vm.createdAtLabel) && (
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {owner && <ReportTypeBadge reportType={vm.reportType} />}
                  {vm.createdAtLabel && <span>{vm.createdAtLabel}</span>}
                </div>
              )}
              <h1 className="mb-3 text-[25px] leading-[1.38] font-bold tracking-[-0.015em] text-foreground">
                {vm.title}
              </h1>
              <p className="text-base leading-[1.66] text-ink-mid">{vm.summary}</p>

              {/* 왜 나에게 왔나 (whyForYou) */}
              {vm.whyForYou && (
                <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-[13px] leading-[1.6] text-ink-mid">
                  <span className="mt-[6px] h-[5px] w-[5px] shrink-0 rounded-full bg-primary" />
                  <span>{vm.whyForYou}</span>
                </div>
              )}

              {/* 리포트 본문 — reportId 로 이어지는 2번째 요청의 상태별 렌더(카드 요약 아래). */}
              <CardReportBody body={body} />

              {/*
                좋아요 — 본문 아래, 카드 article 최하단. PUBLIC 이고 소셜 값이 검증됐을 때만 렌더한다.
                PRIVATE 카드는 서버가 좋아요를 404 로 막으므로 버튼 자체를 두지 않는다.
                작성자 본인 여부는 검사하지 않는다(정책: 본인도 좋아요 가능).
              */}
              {isPublic && social !== null && (
                <CardLikeButton publicId={shown.publicId} social={social} />
              )}
            </article>

            {/*
              출처 — 어댑터(toCardSources)가 정규화한 출처만 온다: 빈 출처({title:null,url:null} 등)는
              제외되고, 건수도 정규화 결과 기준이다. 유효 출처가 0건이면 섹션 자체를 렌더하지 않는다.
              URL 은 http/https 인 경우에만 실제 외부 링크로 나간다(mock 상세의 시각 전용 링크와 다름).
            */}
            {vm.sources.length > 0 && (
              <section className="mb-4 rounded-2xl border border-border bg-card px-6 py-5">
                <div className="mb-3.5 text-[15px] font-bold text-foreground">
                  출처{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    {vm.sources.length}건
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {vm.sources.map((source, i) => (
                    <li
                      key={`${vm.publicId}-src-${i}`}
                      className="flex items-center gap-[11px] rounded-[10px] border border-border bg-card px-3.5 py-[11px]"
                    >
                      <span className="w-[22px] shrink-0 text-[11.5px] text-muted-foreground">
                        [{i + 1}]
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-foreground">
                          {source.label}
                        </div>
                        {/* 제목이 없어 URL 이 라벨로 쓰인 출처는 같은 URL 을 두 번 쓰지 않는다. */}
                        {source.url && source.url !== source.label && (
                          <div className="mt-px truncate text-[11.5px] text-muted-foreground">
                            {source.url}
                          </div>
                        )}
                      </div>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-ring ml-auto shrink-0 rounded-[3px] text-xs font-semibold whitespace-nowrap text-signal-ink hover:underline"
                        >
                          원문 열기 ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/*
              댓글 — 카드 본문 → 출처 → 댓글 순서. **PUBLIC 카드에서만** 렌더한다:
              서버가 PRIVATE·부재·형식오류를 전부 404 로 막으므로(CommentService.resolvePublicCard)
              비공개 카드에 섹션을 두면 확실한 404 를 부르게 된다.
              이 컴포넌트는 카드 상세가 ready 인 뒤에만 mount 되므로 loading/error/notFound 중에는
              댓글 요청이 나가지 않는다. 경로에는 카드 publicId 만 쓴다(내부 id·reportId 사용 금지).
            */}
            {isPublic && <CardComments cardPublicId={shown.publicId} guest={guest} />}
          </main>

          {/* 우측 rail — 실 UUID 상세 전용. 값이 실제로 있는 리포트(ready)에서만 렌더된다. */}
          <CardReportRail body={body} />
        </div>
      </div>

      <AddMaterialModal open={amOpen} onClose={() => setAmOpen(false)} />
    </div>
  );
}

/**
 * 리포트 상단 대표 이미지. 외부 도메인은 응답마다 달라 Next Image allowlist로 안전하게
 * 열거할 수 없으므로 검증된 원본 URL을 직접 사용한다. 로드 실패 시 빈 프레임도 남기지 않는다.
 */
function ReportCoverHero({ coverImage }: { coverImage: ReportCoverImageVM | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (coverImage === null || failedUrl === coverImage.url) return null;

  return (
    <figure className="mb-6 overflow-hidden rounded-xl border border-border bg-background">
      <a
        href={coverImage.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${coverImage.sourceLabel} 원문 열기`}
        className="focus-ring block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 출처별 동적 도메인은 Next Image allowlist로 열지 않는다. */}
        <img
          src={coverImage.url}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(coverImage.url)}
          className="aspect-video w-full bg-[var(--skel1)] object-cover"
        />
      </a>
      <figcaption className="border-t border-border px-3 py-2 text-[11.5px] text-muted-foreground">
        <a
          href={coverImage.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring rounded-sm hover:text-signal-ink hover:underline"
        >
          이미지 출처 · {coverImage.sourceLabel} ↗
        </a>
      </figcaption>
    </figure>
  );
}

/**
 * 링크 복사 버튼 — 비소유자·게스트가 보는 PUBLIC 상세의 유일한 공유 액션.
 * PATCH 요청은 나가지 않고(복사는 읽기 동작), 공개/비공개 문구나 변경 버튼도 노출하지 않는다.
 *
 * 결과는 피드 카드와 같은 방식으로 알린다(2026-08-07 UI 검수): 눈으로는 화면 하단
 * 토스트(`CopyToast`), 스크린리더로는 상시 sr-only live region. 버튼 옆 11.5px 회색 문구는
 * 복사 여부를 알아채기 어려워 시각 표시를 토스트로 옮겼다.
 */
function CopyLinkButton({ publicId }: { publicId: string }) {
  const { copy, feedback } = useCopyCardLink(publicId);
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {feedback?.message ?? ""}
      </span>
      <CopyToast feedback={feedback} />
      <button
        type="button"
        onClick={copy}
        className="focus-ring inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-[12.5px] font-semibold whitespace-nowrap text-ink-mid hover:bg-background"
      >
        링크 복사
      </button>
    </>
  );
}

/**
 * 리포트 본문 섹션 — useReportBody 상태별 렌더. 카드 요약 article 내부, whyForYou 아래에 붙는다.
 * - none: reportId=null(계약: 리포트 없는 카드) → 아무것도 렌더하지 않는다(기존 요약 화면 유지,
 *   생성 중 같은 추측 상태 금지).
 * - ready 인데 body 가 비어 있으면(컬럼 nullable) 섹션 자체를 생략한다(빈 껍데기 금지).
 * - notFound: 404(부재·접근 불가 — 존재 노출 없음) → 조용한 안내만(재시도 무의미).
 * - error: 일시 오류 → 본문만 다시 시도(카드 요약은 이미 떠 있다).
 */
function CardReportBody({ body }: { body: ReportBodyState & { refetch: () => void } }) {
  if (body.status === "none") return null;

  if (body.status === "loading") {
    const bar = "rounded-md bg-[var(--skel1)]";
    return (
      <div className="mt-4 border-t border-border pt-4">
        <div aria-hidden="true" className="animate-pulse">
          <div className={`mb-3 h-4 w-36 ${bar}`} />
          <div className={`mb-2 h-4 w-full ${bar}`} />
          <div className={`mb-2 h-4 w-[92%] ${bar}`} />
          <div className={`h-4 w-[68%] ${bar}`} />
        </div>
        <span className="sr-only" role="status">
          본문을 불러오는 중…
        </span>
      </div>
    );
  }

  if (body.status === "error") {
    return (
      <div role="alert" className="mt-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-background px-4 py-3">
          <p className="min-w-0 flex-1 text-[13px] leading-[1.6] text-ink-mid">
            본문을 불러오지 못했어요. 일시적인 문제일 수 있어요.
          </p>
          <button
            type="button"
            onClick={body.refetch}
            className="focus-ring shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-ink-mid hover:bg-background"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (body.status === "notFound") {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <p className="text-[13px] leading-[1.6] text-muted-foreground">
          본문을 찾을 수 없어요 — 이미 삭제됐거나 접근할 수 없는 본문이에요.
        </p>
      </div>
    );
  }

  const markdown = body.report.body?.trim() ?? "";
  if (markdown === "") return null; // body 컬럼 nullable — 빈 본문이면 섹션 생략

  return (
    <div className="mt-4 border-t border-border pt-1.5">
      {/* 폼 판정은 이 보고서 응답값 하나로만 한다(계정 설정 아님) — lib/report-delta.ts */}
      <ReportMarkdown markdown={markdown} delta={isDeltaReport(body.report)} />
    </div>
  );
}

/**
 * 우측 rail — mock 상세(ReportScreen)의 "출처 신뢰도 요약" rail 과 시각적으로 정렬되는 실 데이터 전용 카드.
 * SideRight(홈 rail)는 쓰지 않는다. 레이아웃은 SideLeft(300px) + reader(760px) + rail(300px), gap 22px.
 *
 * 표시하는 값은 API 가 실제로 주는 것만이다:
 * - 출처: 정규화된 유효 citation 개수(raw citations.length 아님). 0 이면 행을 숨긴다.
 *   카드 sources 와 합산하지 않는다(같은 발행 payload 라 합치면 중복 계산).
 * - 마지막 업데이트: report.createdAt 포맷. 파싱 실패면 행을 숨긴다.
 * 신뢰도·조회수·읽음 시간·작성자 통계처럼 API 에 없는 값은 만들지 않는다.
 *
 * none·loading·error·notFound 에서는 report 기반 수치가 존재하지 않으므로 rail 자체를 렌더하지 않는다
 * (임의 날짜·임의 수치 생성 금지). 표시할 행이 하나도 없으면 빈 카드도 두지 않는다.
 * 반응형: 1240px 이하 rail 숨김 / 1100px 이하 좌측 내비 숨김(SideLeft) → 모바일은 본문 단일 칼럼.
 */
function CardReportRail({ body }: { body: ReportBodyState }) {
  if (body.status !== "ready") return null;

  const rail = toReportRailVM(body.report);
  const rows: { label: string; value: string }[] = [];
  if (rail.citationCount > 0) rows.push({ label: "출처", value: `${rail.citationCount}건` });
  if (rail.updatedAtLabel !== "") {
    rows.push({ label: "마지막 업데이트", value: rail.updatedAtLabel });
  }
  if (rows.length === 0) return null;

  return (
    <aside className="sticky top-4 flex w-[300px] shrink-0 flex-col gap-3.5 max-[1240px]:hidden">
      <div className="rounded-[14px] border border-border bg-card px-4 py-[15px]">
        <h4 className="mb-[15px] flex items-center text-[13px] font-bold text-foreground">
          본문 정보
        </h4>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-3 border-t border-border py-2 text-[12.5px] text-ink-mid ${i === 0 ? "border-t-0 pt-px" : ""}`}
          >
            <span className="shrink-0">{row.label}</span>
            <b className="min-w-0 truncate font-bold text-foreground">{row.value}</b>
          </div>
        ))}
      </div>
    </aside>
  );
}

/** 인증 복원 / 데이터 로딩 공통 스켈레톤 — reader 컬럼만 중립 placeholder. */
function DetailSkeleton() {
  const bar = "rounded-md bg-[var(--skel1)]";
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-start justify-center gap-[22px] px-5 pt-6 pb-14">
          <main className="min-w-0 max-w-[760px] flex-1" aria-hidden="true">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-[9px]">
              <div className={`h-4 w-24 ${bar}`} />
            </div>
            <div className="animate-pulse rounded-2xl border border-border bg-card px-[30px] py-[26px]">
              <div className={`mb-3 h-3 w-32 ${bar}`} />
              <div className={`mb-3 h-7 w-[80%] ${bar}`} />
              <div className={`mb-2 h-4 w-full ${bar}`} />
              <div className={`mb-2 h-4 w-[92%] ${bar}`} />
              <div className={`h-4 w-[60%] ${bar}`} />
            </div>
          </main>
        </div>
      </div>
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
    </div>
  );
}

/** 인증 복원 오류(500·네트워크) — 재시도. */
function DetailAuthError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-5 py-24">
        <StateView
          role="alert"
          className="w-[420px] max-w-full"
          iconTone="brand"
          icon={<Orb size={22} />}
          title="인증 상태를 확인하지 못했어요"
          description="네트워크나 서버 상태를 확인한 뒤 다시 시도해 주세요."
          actions={[
            { label: "다시 시도", onClick: onRetry, variant: "primary" },
            { label: "홈으로", href: "/", variant: "ghost" },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * 카드 데이터 로드 실패(error) — 재시도(refetch).
 * 원인이 특정되는 코드(권한·AI 장애)면 StateView 가 설명을 공통 문구로 바꾼다. 제목·액션은 그대로다.
 */
function DetailDataError({ onRetry, errorCode }: { onRetry: () => void; errorCode?: ErrorCode }) {
  return (
    <div className="min-h-screen bg-background">
      <HomeNav onAddOpen={() => {}} />
      <div className="mx-auto flex max-w-[1440px] items-center justify-center px-5 py-24">
        <StateView
          role="alert"
          className="w-[440px] max-w-full"
          icon={<IconAlert />}
          title="카드를 불러오지 못했어요"
          description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
          errorCode={errorCode}
          actions={[
            { label: "다시 시도", onClick: onRetry, variant: "primary" },
            // 홈 `/` 의 기본 탭은 [내 보고서]라 문구대로 피드에 닿으려면 탭을 명시해야 한다.
            { label: "홈 피드로", href: homeTabHref("feed"), variant: "ghost" },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * 화면 내부 Not Found — API 404(존재하지 않음/남의 PRIVATE/soft delete). 서버 notFound() 가 아니라
 * 클라이언트 상태다(정상 UUID 는 서버가 존재를 알 수 없어 200 으로 렌더된 뒤 이 상태가 뜬다).
 * 백엔드가 비공개를 403 이 아닌 404 로 감추므로(존재 노출 없음) guest·member 모두 같은 화면을 본다 —
 * "로그인하면 볼 수 있다"고 안내하지 않는다(사실이 아닐 수 있고, 카드 존재를 알려주게 된다).
 */
function DetailNotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <HomeNav onAddOpen={() => {}} />
      <PageState
        icon={<IconSearch />}
        title="카드를 찾을 수 없어요"
        description={
          <>
            이미 삭제됐거나 접근할 수 없는 카드예요.
            <br />
            홈 피드에서 다시 확인해 주세요.
          </>
        }
        actions={[{ label: "홈 피드로", href: homeTabHref("feed"), variant: "primary" }]}
      />
    </div>
  );
}
