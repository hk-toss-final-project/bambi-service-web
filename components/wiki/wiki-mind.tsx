"use client";


import { FeedSkeleton } from "@/components/home/feed-skeleton";
import { IconAlert, IconEmptyDoc } from "@/components/ui/state-icons";
import { StateView } from "@/components/ui/state-view";
import type { InterestTaxonomyState } from "@/hooks/use-interest-taxonomy";
import type { WikiInterestsState } from "@/hooks/use-wiki-interests";
import {
  groupInterestsByCategory,
  type CategoryGroup,
  type CategoryItem,
} from "@/lib/interest-category";
import type { InterestDto } from "@/types/interest";

/**
 * 관심사가 하나도 없는 대분류를 화면에 남길지.
 *
 * 원래 의도는 "이 서비스가 다루는 범위"를 보여주려고 빈 대분류도 남기는 것이었는데,
 * 지금은 agent 가 관심사에 taxonomy ID 를 붙여주지 않아 이름 대조에 실패한 것이 [기타]로 떨어진다
 * (2026-08-05 실측: 20건 중 20건). 그 상태로 빈 대분류 8개를 세우면 노이즈만 커져서 일단 접는다.
 *
 * 08-11 에 AI 추정을 이 섹션에서 뺀 뒤로 [기타] 는 크게 줄었다 — 온보딩 선택 관심사는
 * categoryId 가 정확해서 제 자리로 간다. 그래도 직접 입력한 이름은 여전히 대조에 기대므로
 * 판단은 유지한다. **agent 가 topicId 를 내려주기 시작하면 true 로 되돌린다.**
 */
const SHOW_EMPTY_CATEGORIES = false;

/**
 * [내 관심사 지도] — taxonomy 대분류로 묶어 보여준다(2026-08-05 우석 결정).
 *
 * 이전에는 AI 추론 태그 상위 4건만 나열해서 ⑴ 무엇을 기준으로 뽑힌 4개인지 알 수 없고
 * ⑵ 파악한 관심사 범위가 좁아 보이는 문제가 있었다. 이제 상한 없이 전부 보여주되
 * taxonomy 대분류(테크·IT / 비즈니스·경제 / …)로 묶는다.
 *
 * <b>AI 추정 태그는 여기 넣지 않는다 (2026-08-11 우석 — "난잡하다").</b>
 * 그전까지 이 섹션은 AI 추론 태그와 내 관심사를 합쳐 보여줬는데, 그러면 화면이 같은 데이터를
 * 세 번 보여주는 꼴이었다 — <b>이 섹션 = 왼쪽 [발견 후보] ∪ 오른쪽 [내 관심사]</b> 의 합집합.
 * 게다가 노이즈가 전부 AI 추정 쪽에서 나왔다: 문서 파편이 관심사로 올라오고(`이명박`·`KT`·
 * `AI 코어 오케스트레이터`), agent 가 taxonomy ID 를 안 줘서 그것들이 통째로 [기타]에 쌓였다.
 * 내 관심사만 남기면 온보딩 선택분은 categoryId 가 정확해 대분류가 제대로 채워진다.
 * <b>AI 가 찾은 후보는 사라지지 않는다</b> — 왼쪽 [AI가 최근 발견한 관심사] 패널이 전담한다.
 *
 * 데이터: 내 관심사(GET /api/interests). 강도 막대는 같은 이름의 AI 추론 태그가 있을 때만
 * 그 score 를 빌려 쓴다(GET /api/wiki/tags — 표시용이고 분류에는 쓰지 않는다).
 * 분류 규칙은 lib/interest-category.ts 참조(온보딩 선택은 categoryId, 나머지는 이름 대조).
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
    <section aria-label="내 관심사 지도" className="mb-8">
      <div className="rounded-[14px] border border-border bg-card px-[18px] py-4">
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
          내 관심사 지도
        </h2>
        <p className="mt-0.5 mb-3.5 text-[12.5px] leading-[1.6] text-muted-foreground">
          등록한 관심사를 주제별로 모아 봤어요. 막대는 저장한 자료에서 AI가 읽은 상대 강도예요.
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
        actions={[{ label: "다시 시도", onClick: tags.refetch, variant: "primary" }]}
      />
    );
  }

  const wikiTags = tags.status === "success" ? tags.data : [];
  /*
    태그를 넘기는 건 **강도 막대를 살리기 위해서다** — 같은 이름의 AI 추론 태그가 있으면
    merge 단계에서 score 를 물려받는다. 그 뒤 USER 만 남겨 AI 추정 전용 행을 걷어낸다
    (합치기 전에 태그를 빼면 내 관심사가 전부 막대 없는 줄이 된다).
  */
  const groups = groupInterestsByCategory(taxonomy.data, wikiTags, myInterests)
    .map((group) => ({ ...group, items: group.items.filter((item) => item.source === "USER") }));
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  if (total === 0) {
    return (
      <StateView
        className="min-h-[160px]"
        icon={<IconEmptyDoc />}
        title="아직 등록한 관심사가 없어요"
        description="아래 [AI가 최근 발견한 관심사]에서 추가하거나, 관심사를 직접 등록하면 여기에 주제별로 정리돼요."
      />
    );
  }

  const visible = SHOW_EMPTY_CATEGORIES ? groups : groups.filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {visible.map((group) => (
        <CategoryBlock key={group.id} group={group} />
      ))}
    </div>
  );
}

/** 대분류 1개 — 제목 줄 + 소속 관심사. 비어 있으면 옅게 두어 "채울 수 있는 자리"로 보이게 한다. */
function CategoryBlock({ group }: { group: CategoryGroup }) {
  const empty = group.items.length === 0;
  return (
    <div className={empty ? "opacity-45" : undefined}>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span aria-hidden="true" className="text-[13px]">
          {group.emoji}
        </span>
        <h3 className="text-[13px] font-bold text-foreground">{group.name}</h3>
        {!empty && (
          <span className="text-[11.5px] font-semibold text-muted-foreground">
            {group.items.length}
          </span>
        )}
      </div>

      {empty ? (
        <p className="pl-[22px] text-[12px] text-muted-foreground">아직 없어요</p>
      ) : (
        <ul className="flex flex-col gap-1.5 pl-[22px]">
          {group.items.map((item) => (
            <MindRow key={item.key} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 관심사 1줄. score 가 있으면 상대 강도 막대를, 없으면(직접 추가만 한 관심사) 안내 문구를 둔다.
 * 막대 최소 폭 8% — 0 에 가까워도 막대가 사라져 보이지 않게 한다(rail 집계와 동일 규칙).
 * 절대 수치로 오해하지 않도록 %는 표기하지 않는다.
 */
function MindRow({ item }: { item: CategoryItem }) {
  const width = item.score === null ? 0 : Math.max(8, Math.round(item.score * 100));

  /*
    ≥360px 은 한 줄 배치다: 이름(w-32) · 강도 막대(flex-1).
    좁은 화면에서는 고정폭이 행 가용폭을 넘겨 가로 스크롤이 생겼었다(실측 +9px). 폭을 더 깎으면
    막대가 10px대로 뭉개지므로, 줄이는 대신 **막대만 다음 줄로 내린다**(flex-wrap + order-last + w-full).
    order 는 시각 순서만 바꾸므로 DOM·읽기 순서는 그대로고, 막대는 aria-hidden 이라 영향이 없다.
  */
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground min-[360px]:w-32 min-[360px]:flex-none">
        {item.name}
      </span>
      {item.score === null ? (
        <span className="order-last w-full text-[11.5px] text-muted-foreground min-[360px]:order-none min-[360px]:w-auto min-[360px]:min-w-0 min-[360px]:flex-1">
          직접 추가한 관심사
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="order-last h-2 w-full rounded-full bg-background min-[360px]:order-none min-[360px]:w-auto min-[360px]:min-w-0 min-[360px]:flex-1"
        >
          <span className="block h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
        </span>
      )}
      {/*
        출처 라벨("내 관심사"/"AI 추정")은 없앴다(2026-08-11 우석) — 이제 이 섹션은 내 관심사만
        보여주므로 모든 행이 같은 값이 되어, 8줄 내내 같은 단어가 반복되는 열이 됐다.
        삭제 버튼도 두지 않는다 — 추가·삭제는 아래 2열 패널(발견 후보 ↔ 내 관심사)이 전담한다.
      */}
    </li>
  );
}
