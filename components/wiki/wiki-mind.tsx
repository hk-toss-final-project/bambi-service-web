"use client";


import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import type { InterestTaxonomyState } from "@/hooks/use-interest-taxonomy";
import type { WikiInterestsState } from "@/hooks/use-wiki-interests";
import {
  ETC_CATEGORY_ID,
  groupInterestsByCategory,
  type CategoryGroup,
  type CategoryItem,
} from "@/lib/interest-category";
import {
  INTEREST_LEVEL_BAR_CLASS,
  INTEREST_LEVEL_LABEL,
  interestBarWidthPercent,
  resolveInterestLevel,
} from "@/lib/interest-level";
import type { InterestDto } from "@/types/interest";
import type { WikiTag } from "@/types/wiki";

/**
 * [AI가 이해한 지금의 나] — `직접 추가` · `AI 발견` 두 구역 목록.
 *
 * 처음에는 AI 추론 태그 상위 4건만 나열했고(2026-08-05 이전), 다음으로 taxonomy 대분류로 묶었다
 * (2026-08-05 우석). 묶음 구조는 "무엇에 관심이 큰가"를 읽는 데는 오히려 방해가 됐다 —
 * 대분류 제목·개수·이모지가 행마다 끼어들고, 관심도가 큰 항목이 그룹 아래쪽에 숨었다(2026-08-13 검수).
 * 그래서 대분류 묶음을 걷었고, 대분류는 각 행 오른쪽 칩으로만 남는다(**되돌리지 않는다**).
 *
 * 그다음 한 목록 안에서 이름 앞 주황 점으로 출처를 구분해 봤는데, 점 하나가 감당하기엔 정보가 컸다 —
 * 점의 뜻을 안내 문구로 따로 설명해야 했고 그마저 색에 기대는 표시였다(2026-08-13 브라우저 검수).
 * 지금은 **구역 제목이 그 일을 한다**: 출처가 헤더 한 줄로 드러나므로 점도, 점을 설명하던 문구도 없다.
 *
 * 데이터: AI 추론 태그(GET /api/wiki/tags, score=0~1 상대 강도) + 내 관심사(GET /api/interests).
 * 분류 규칙은 lib/interest-category.ts 그대로 쓴다(온보딩 선택은 categoryId, 나머지는 이름 대조) —
 * 이 파일은 그 결과를 **표시용으로 나누고 정렬만** 하고, 원본 배열과 매핑 정책은 건드리지 않는다.
 */
export function WikiMind({
  taxonomy,
  tags,
  myInterests,
}: {
  taxonomy: InterestTaxonomyState & { refetch: () => void };
  tags: WikiInterestsState & { refetch: () => void };
  myInterests: InterestDto[] | null;
}) {
  return (
    <section aria-label="AI가 이해한 지금의 나" className="mb-8">
      <div className="rounded-[14px] border border-border bg-card px-[18px] py-4">
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
          AI가 이해한 지금의 나
        </h2>
        <p className="mt-0.5 mb-3.5 text-[12.5px] leading-[1.6] text-muted-foreground">
          직접 추가한 관심사와 AI가 발견한 관심사를 나눠 보여드려요. AI 발견 관심사는 관심도가 높은
          순이에요.
        </p>

        <Body taxonomy={taxonomy} tags={tags} myInterests={myInterests} />
      </div>
    </section>
  );
}

function Body({
  taxonomy,
  tags,
  myInterests,
}: {
  taxonomy: InterestTaxonomyState & { refetch: () => void };
  tags: WikiInterestsState & { refetch: () => void };
  myInterests: InterestDto[] | null;
}) {
  // 대분류 골격이 없으면 묶어서 보여줄 수 없다 → taxonomy 실패는 별도 에러로 다룬다.
  if (taxonomy.status === "error") {
    return (
      <StateView
        role="alert"
        className="min-h-[160px]"
        icon={<IconAlert />}
        title="관심사 분류를 불러오지 못했어요"
        description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
        errorCode={taxonomy.errorCode}
        actions={[{ label: "다시 시도", onClick: taxonomy.refetch, variant: "primary" }]}
      />
    );
  }
  if (taxonomy.status === "loading" || tags.status === "loading" || myInterests === null) {
    return <FeedSkeleton />;
  }
  if (tags.status === "error") {
    return (
      <StateView
        role="alert"
        className="min-h-[160px]"
        icon={<IconAlert />}
        title="관심사를 불러오지 못했어요"
        description="일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요."
        errorCode={tags.errorCode}
        actions={[{ label: "다시 시도", onClick: tags.refetch, variant: "primary" }]}
      />
    );
  }

  const wikiTags = tags.status === "success" ? tags.data : [];
  const { user, inferred } = displaySections(
    groupInterestsByCategory(taxonomy.data, wikiTags, myInterests),
    wikiTags,
    myInterests,
  );

  if (user.length + inferred.length === 0) {
    return (
      <StateView
        className="min-h-[160px]"
        icon={<IconEmptyDoc />}
        title="아직 파악한 관심사가 없어요"
        description="관심 자료를 저장하거나 관심사를 직접 추가하면 여기에 정리돼요."
      />
    );
  }

  /*
    구역 사이 여백(gap-6 = 24px)은 행 사이(gap-3 = 12px)의 두 배다 — 배 차이가 나야 "행이 하나 더
    떨어진 것"이 아니라 "구역이 갈린 것"으로 읽힌다. 구역 상자·구분선은 두지 않는다(평평한 목록 유지).
    한쪽 구역이 비면 그 자리는 아예 렌더되지 않으므로 빈 헤더도, 남는 여백도 생기지 않는다.
  */
  return (
    <div className="flex flex-col gap-6">
      <MindSection title="직접 추가" items={user} />
      <MindSection title="AI 발견" items={inferred} />
    </div>
  );
}

/** 구역 1개 — 제목 + 소속 관심사. 비어 있으면 헤더째 렌더하지 않는다. */
function MindSection({ title, items }: { title: string; items: MindItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      {/*
        구역 제목. 흐린 11.5px 보조 문구로 뒀더니 그냥 설명 줄처럼 보여 구역이 갈리지 않았다
        (2026-08-13 검수) → 관심사 이름(13px/--ink-mid)보다 한 단계 크고 진하게(13.5px/--foreground)
        올리고, 남는 폭은 얇은 선으로 채워 "제목 ─────" 로 읽히게 한다.
        선은 하이픈 문자가 아니라 `border-t` 다(폰트·자간에 따라 끊겨 보이지 않고, 낭독되지도 않는다).
        칩·배지·이모지·개수는 두지 않는다.
      */}
      <div className="mb-3 flex items-center gap-3">
        <h3 className="shrink-0 text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        <span aria-hidden="true" className="min-w-0 flex-1 border-t border-border" />
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <MindRow key={item.key} item={item} />
        ))}
      </ul>
    </section>
  );
}

/**
 * 어디에도 매칭되지 않은 항목(가상 [기타] 버킷)의 칩 문구.
 *
 * 잠깐 칩을 생략했는데(2026-08-13), agent 가 topicId 를 거의 안 내려줘 대부분이 이 버킷이라
 * 빈 칩 자리가 줄줄이 남고 열이 비뚤어 보였다 → 사용자 결정으로 fallback 문구를 표시한다.
 * **표시 전용이다** — 원본 배열·저장값·요청 어디에도 들어가지 않고, `lib/interest-category.ts` 의
 * 분류 규칙도 그대로다. 서버가 준 실제 카테고리와 구분되도록 여기 한 곳에서만 만든다.
 */
const ETC_FALLBACK_LABEL = "기타";

/** 화면에 그릴 관심사 1행 — 분류 결과에서 대분류 이름만 끌어와 붙인 파생 데이터다. */
type MindItem = CategoryItem & {
  /** 오른쪽 칩 문구. 매칭된 대분류 이름이거나, 없으면 표시 전용 fallback(`기타`)이다. */
  categoryName: string;
};

/**
 * 대분류 묶음을 걷고 **출처 기준 두 구역으로 나눈다**. 원본 배열(tags·myInterests)과 분류 결과는
 * 읽기만 한다 — 어느 항목도 걸러내지 않으므로 두 구역 합은 항상 원래 개수다.
 *
 * 정렬:
 *  - `직접 추가`(source === "USER"): `GET /api/interests` 응답 순서 그대로. 점수가 있든 없든
 *    관심도로 줄 세우지 않는다 — 점수가 없는 항목에 0 을 끼워 넣어 "관심 없음"처럼 보이게 하지
 *    않으려는 것이고, 점수가 있는 항목까지 같은 규칙이어야 구역 안 순서가 흔들리지 않는다.
 *  - `AI 발견`: **막대 길이를 만드는 그 점수**로 내림차순(별도 점수 없음).
 *    점수가 같으면 `GET /api/wiki/tags` 응답 순서를 유지한다.
 *
 * 순서 기준을 묶음 결과가 아니라 원본 배열 index 에서 가져오는 이유: `groupInterestsByCategory` 는
 * 버킷마다 점수 내림차순으로 다시 정렬하므로, 거기서 편 순서는 이미 API 순서가 아니다.
 */
function displaySections(
  groups: CategoryGroup[],
  tags: WikiTag[],
  interests: InterestDto[],
): { user: MindItem[]; inferred: MindItem[] } {
  const interestOrder = new Map(interests.map((interest, index) => [interest.id, index]));
  const tagOrder = new Map(tags.map((tag, index) => [tag.tagId, index]));
  const rows = groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      categoryName: group.id === ETC_CATEGORY_ID ? ETC_FALLBACK_LABEL : group.name,
    })),
  );

  return {
    user: rows
      .filter((row) => row.source === "USER")
      .sort(
        (a, b) =>
          (interestOrder.get(a.interestId ?? -1) ?? 0) -
          (interestOrder.get(b.interestId ?? -1) ?? 0),
      ),
    inferred: rows
      .filter((row) => row.source !== "USER")
      .sort(
        (a, b) =>
          (b.score ?? 0) - (a.score ?? 0) || (tagOrder.get(a.key) ?? 0) - (tagOrder.get(b.key) ?? 0),
      ),
  };
}

/**
 * 관심사 1줄 — 이름 · 관심도 막대 · 대분류 칩.
 *
 * 눈에 보이는 관심도는 **막대 길이 하나뿐**이다. `매우 높음`·`높음` 같은 단계 글자를 옆에 함께 두면
 * 같은 정보를 두 번 적는 셈이고, 행마다 글자가 하나씩 더 붙어 목록이 빽빽해졌다(2026-08-13 검수).
 * 단계 이름은 스크린리더용 sr-only 로만 남는다(막대가 aria-hidden 이라 그마저 없으면 낭독이 빈다).
 * 막대 길이·색 단계 기준은 그대로 `lib/interest-level.ts` 가 정한다 — 임계값·색을 여기 다시 적지 않는다.
 *
 * score 가 없으면(직접 추가만 한 관심사) 막대를 **지어내지 않는다**. 빈 트랙조차 그리지 않는데,
 * 폭 0 짜리 막대는 "관심도 0"(서버가 실제로 0 을 준 경우 → 최하 단계 막대가 그려진다)과 구별되지 않기
 * 때문이다. 대신 그 행에는 아무 관심도 표시도 두지 않는다.
 * 절대 수치로 오해하지 않도록 %는 표기하지 않는다.
 *
 * <b>배치는 flex 가 아니라 grid 다(2026-08-13 브라우저 검수).</b> flex 로 두니 막대가 `flex-1` 로
 * 남는 폭을 먹어서, 칩이 없는 행은 트랙이 오른쪽 끝까지 늘고 칩이 있는 행은 짧아졌다 —
 * 행마다 트랙 총길이가 달라 같은 점수도 다른 길이로 보였다. 열 너비를 **내용이 아니라 템플릿이**
 * 정하게 바꾸면 칩 유무와 무관하게 세 열의 시작·끝이 항상 같다.
 */
function MindRow({ item }: { item: MindItem }) {
  const level = resolveInterestLevel(item.score);

  /*
    열 템플릿 — 이름(고정) · 막대(남는 폭) · 칩(고정). 세 폭 모두 템플릿이 정하므로 셀이 비어도
    자리는 그대로다. 그래서 `막대 없음`·`칩 없음` 행에 빈 상자를 채워 넣을 필요가 없다:
    각 셀에 명시적 `col-start` 를 주면 앞 셀이 없어도 뒤 셀이 당겨지지 않는다.

    ≥480px — 1행 3열: [10.5rem] [1fr] [6.5rem]
    <480px — 2행 2열: 1줄 [1fr][6.5rem] = 이름·칩 / 2줄 = 막대(두 열 span)
      좁은 폭에서 셋을 한 줄에 두면 막대가 수십 px 로 뭉개진다. 막대만 아래 줄로 내리되
      **두 열을 모두 덮어** 어느 행이든 트랙 폭이 같게 만든다(칩이 없는 행도 동일).
      막대가 없는 행은 2줄 자체가 생기지 않아 빈 줄 높이·gap 이 남지 않는다.
  */
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-center gap-x-3 gap-y-2 min-[480px]:grid-cols-[10.5rem_minmax(0,1fr)_6.5rem]">
      <span className="col-start-1 row-start-1 min-w-0 truncate text-[13px] font-semibold text-ink-mid">
        {item.name}
      </span>
      {level !== null && (
        <span className="col-span-2 col-start-1 row-start-2 min-w-0 min-[480px]:col-span-1 min-[480px]:col-start-2 min-[480px]:row-start-1">
          <span aria-hidden="true" className="block h-2 w-full rounded-full bg-background">
            <span
              className={`block h-full rounded-full ${INTEREST_LEVEL_BAR_CLASS[level]}`}
              style={{ width: `${interestBarWidthPercent(item.score ?? 0)}%` }}
            />
          </span>
          {/*
            막대가 aria-hidden 이라 이 문구가 없으면 스크린리더에는 관심도가 **아무것도** 남지 않는다.
            화면에서 걷어낸 것은 눈에 보이는 등급 글자이지 정보 자체가 아니므로, 같은 단계 이름을
            sr-only 로만 남긴다(문구의 단일 소스는 그대로 lib/interest-level.ts).
          */}
          <span className="sr-only">관심도 {INTEREST_LEVEL_LABEL[level]}</span>
        </span>
      )}
      {/*
        대분류는 그룹 헤더 대신 행 오른쪽 칩으로 남긴다. 관심도(주황)와 경쟁하지 않게 중립 배경 +
        낮은 대비의 남회색 글자로 두고, 이모지는 넣지 않는다. 매칭이 없으면 표시 전용 fallback
        (`기타`)을 쓰므로 **모든 행에 칩이 있다** — 빈 칩 자리로 열이 비뚤어 보이지 않는다.
        칩 폭은 열 폭(6.5rem)을 넘지 못하고 넘치면 말줄임 → 긴 분류명이 다른 열을 밀지 않는다.

        삭제 버튼은 두지 않는다(2026-08-11 우석). 추가·삭제는 아래 2열 패널(발견 후보 ↔ 내 관심사)이
        전담하고, 이 섹션은 "AI 가 지금 나를 어떻게 보는가"를 읽는 자리다.
      */}
      <span className="col-start-2 row-start-1 max-w-full justify-self-end truncate rounded-[4px] bg-secondary px-1.5 py-px text-[10.5px] leading-[1.6] font-semibold text-muted-foreground min-[480px]:col-start-3">
        {item.categoryName}
      </span>
    </li>
  );
}
