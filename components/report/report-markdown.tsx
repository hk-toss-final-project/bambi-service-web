import type { ReactNode } from "react";

/**
 * 리포트 본문(Markdown) 안전 렌더러 — 외부 의존성 없이 agent 생성 본문의 실측 부분집합만 다룬다.
 * (계약: bambi-agent-api report_builder_system.md — Markdown 본문 + [P1]·[G1]·[L1] 인용 참조)
 *
 * - React 요소로만 조립한다(dangerouslySetInnerHTML 미사용) → 본문에 HTML 태그가 섞여 있어도
 *   문자 그대로 표시될 뿐 실행되지 않는다(무검증 raw HTML 렌더 금지 원칙).
 * - 블록: 제목(#·## → h2, ### 이상 → h3) · 문단 · 목록(-·* 1단계 중첩, "1." 순서 목록) ·
 *   인용(>) · 표(|…|) · 코드 펜스(```). 수평선(---)은 대응 스타일이 없어 구분 없이 건너뛴다.
 * - 인라인: **굵게** · `코드` · [텍스트](http/https URL) 링크만. [P1] 같은 인용 참조는 뒤에
 *   (URL) 이 없어 링크로 해석되지 않고 본문 텍스트로 남는다(계약 표기 유지).
 *   http/https 외 스킴은 링크로 만들지 않는다(원문 텍스트 유지).
 * - 지원 밖 문법은 변형 없이 원문 텍스트로 노출된다(내용 유실 없음).
 * - 스타일은 기존 .md-viewer(globals.css) 컨테이너 스코프를 그대로 쓴다(목업 1:1).
 *
 * ## delta 모드 (변경점 폼 본문)
 *
 * `delta` 는 리포트 응답의 `changeHistoryEnabled`(service-api #92) 하나로만 켜진다 — 본문 헤더
 * 문자열("변경사항" 등)을 파싱해 폼을 추측하지 않는다(계약이 금지한다). 켜지면 변경점
 * 본문이 실제로 쓰는 두 문법을 **추가로** 해석한다:
 *   1. GFM 취소선 `~~2026-2Q~~` → <del>
 *   2. 들여쓴 비-불릿 행 → 같은 <li> 안의 다음 줄. 앞에 `- ` 항목이 있으면 그 항목의 연속 줄로,
 *      **없으면(agent 실제 출력) 들여쓴 줄 묶음 자체가 목록**이 되고 빈 줄이 항목을 가른다
 *      (`  (기존) …` / `  (변경) …` 가 하나의 비교 항목으로 묶인다)
 *
 * 두 규칙 모두 delta 일 때만 적용한다. 기존(자유 형식) 본문은 `changeHistoryEnabled=false`·
 * 필드 누락이라 **파싱·출력이 이전과 완전히 동일**하다 — 렌더링 회귀를 원천 차단하려는 의도다.
 * `(기존)`·`(변경)` 같은 한국어 표기 자체는 해석하지 않는다(문구가 바뀌어도 안 깨진다).
 */

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "ul"; items: { text: string; children: string[]; continuation: string[] }[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "code"; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const UL_ITEM = /^[-*]\s+(.*)$/;
const UL_CHILD = /^\s{2,}[-*]\s+(.*)$/;
/**
 * 목록 항목의 들여쓴 연속 행(delta 전용) — 앞의 `- …` 항목에 이어지는 같은 항목의 다음 줄이다.
 * 하위 불릿(`  - …`)은 `UL_CHILD` 몫이라 부정 전방탐색으로 제외하고, 표·인용·코드 펜스처럼
 * 자체 블록을 여는 표기도 연속 행으로 삼키지 않는다(그 블록들이 정상적으로 열려야 한다).
 */
const UL_CONTINUATION = /^\s{2,}(?![-*]\s)(?![|>#]|```|\d+[.)]\s)(\S.*)$/;
const OL_ITEM = /^\d+[.)]\s+(.*)$/;
const HR = /^-{3,}\s*$/;
/** 표 구분행(|---|:--:|…) — 셀이 전부 -·: 로만 구성. */
const TABLE_SEPARATOR = /^\|?[\s:|-]+\|?$/;

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseBlocks(markdown: string, delta: boolean): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // 코드 펜스 — 닫는 ``` 전까지 원문 그대로(언어 표기는 표시하지 않음).
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        buf.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // 닫는 펜스(또는 EOF)
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      // markdown 원본 depth 를 그대로 싣는다 — h 태그로 낮추는 건 렌더 단계(headingTag)의 몫이다.
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2] ?? "" });
      i += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith(">")) {
        buf.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", lines: buf });
      continue;
    }

    if (UL_ITEM.test(line)) {
      const items: { text: string; children: string[]; continuation: string[] }[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? "";
        const child = UL_CHILD.exec(current);
        if (child && items.length > 0) {
          items[items.length - 1]!.children.push(child[1] ?? "");
          i += 1;
          continue;
        }
        // delta 전용 — 들여쓴 비-불릿 행은 직전 항목의 연속 줄이다(별도 문단으로 떨어뜨리지 않는다).
        if (delta && items.length > 0) {
          const continuation = UL_CONTINUATION.exec(current);
          if (continuation) {
            items[items.length - 1]!.continuation.push(continuation[1] ?? "");
            i += 1;
            continue;
          }
        }
        /*
          delta 전용 — 항목 사이 빈 줄은 목록을 끊지 않는다.

          agent 는 신규 팩트 불릿을 "\n\n" 로 이어붙여(assembly.py: `"\n\n".join(_new_line(...))`)
          한 항목마다 빈 줄이 들어간다. 기존 규칙대로 끊으면 [새롭게 확인된 사실] 4건이 <ul> 4개로
          쪼개져 항목 간격이 8px(li) 대신 24px(li 8 + ul 16)이 된다 — 같은 섹션의 [변경된 사실]
          묶음과 리듬이 어긋난다(2026-08-11 운영 본문 실측).

          **뒤에 또 목록 항목이 있을 때만** 이어붙인다 — 빈 줄 다음이 제목·문단이면 그대로 끊어
          다음 블록이 정상적으로 열린다.
        */
        if (delta && items.length > 0 && current.trim() === "") {
          let next = i + 1;
          while (next < lines.length && (lines[next] ?? "").trim() === "") next += 1;
          if (next < lines.length && UL_ITEM.test(lines[next] ?? "")) {
            i = next;
            continue;
          }
          break;
        }
        const item = UL_ITEM.exec(current);
        if (!item) break;
        items.push({ text: item[1] ?? "", children: [], continuation: [] });
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (OL_ITEM.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const item = OL_ITEM.exec(lines[i] ?? "");
        if (!item) break;
        items.push(item[1] ?? "");
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    if (line.trimStart().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").trimStart().startsWith("|")) {
        const raw = (lines[i] ?? "").trim();
        if (!TABLE_SEPARATOR.test(raw)) rows.push(splitTableRow(raw));
        i += 1;
      }
      if (rows.length > 0) {
        blocks.push({ kind: "table", header: rows[0] ?? [], rows: rows.slice(1) });
      }
      continue;
    }

    if (HR.test(line.trim())) {
      i += 1;
      continue;
    }

    /*
      delta 전용 — **불릿 없이 들여쓴 행만으로** 이루어진 변경 항목 묶음((기존)/(변경) 쌍).

      agent 는 이 두 줄을 `- ` 없이 2칸 들여쓰기로만 내보내고, 항목 사이는 빈 줄로 나눈다
      (bambi-agent-api `assembly.py` `_changed_line()`:
         "  (기존) ~~{before}~~\n  (변경) `{today}`[L1]" 를 "\n\n" 로 이어붙임).
      계약 문서 예시에는 앞줄에 `- ` 가 있지만 **실제 출력에는 없다**(2026-08-11 운영 실측).

      그래서 위 `ul` 분기(UL_ITEM = 들여쓰기 없는 `- `)에 걸리지 않고, 그 안에서만 도는
      UL_CONTINUATION 도 발동하지 않아 **아래 문단 수집기가 두 줄을 " " 로 이어붙여 한 줄로
      만들어 버렸다** — (기존)과 (변경) 사이 줄바꿈이 사라지는 원인이다.

      여기서 같은 `ul` 블록으로 묶어 첫 줄을 항목 본문, 빈 줄 없이 이어지는 들여쓴 줄을
      continuation 으로 넣는다 → 기존 `.md-cont`(display:block) 렌더를 그대로 재사용해
      한 항목이 두 줄로 읽힌다. 새 블록 종류·새 스타일을 만들지 않는다.

      delta 일 때만 도는 분기라 기존(자유 형식) 본문의 파싱·출력은 이전과 완전히 동일하다.
    */
    if (delta && UL_CONTINUATION.test(line)) {
      const items: { text: string; children: string[]; continuation: string[] }[] = [];
      let startsNewItem = true;
      while (i < lines.length) {
        const current = lines[i] ?? "";
        if (current.trim() === "") {
          // 빈 줄은 항목 구분자다 — 뒤에 들여쓴 행이 또 나올 때만 묶음을 계속한다.
          let next = i + 1;
          while (next < lines.length && (lines[next] ?? "").trim() === "") next += 1;
          if (next >= lines.length || !UL_CONTINUATION.test(lines[next] ?? "")) break;
          startsNewItem = true;
          i = next;
          continue;
        }
        const continuation = UL_CONTINUATION.exec(current);
        if (!continuation) break;
        const text = continuation[1] ?? "";
        if (startsNewItem || items.length === 0) {
          items.push({ text, children: [], continuation: [] });
          startsNewItem = false;
        } else {
          items[items.length - 1]!.continuation.push(text);
        }
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // 문단 — 다른 블록 시작 전까지의 연속 줄을 하나로 합친다.
    const buf: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? "";
      if (
        current.trim() === "" ||
        current.startsWith("```") ||
        current.startsWith(">") ||
        HEADING.test(current) ||
        UL_ITEM.test(current) ||
        OL_ITEM.test(current) ||
        current.trimStart().startsWith("|")
      ) {
        break;
      }
      buf.push(current.trim());
      i += 1;
    }
    blocks.push({ kind: "p", text: buf.join(" ") });
  }

  return blocks;
}

/* ─────────────────────────────────────────────────────────────
   delta 구조 판정 — **구조를 먼저 정하고, 그 다음 텍스트를 정확히 일치시킨다.**
   ───────────────────────────────────────────────────────────── */

/** 변경점 배지가 붙는 소제목 문구 — **정확히 일치**할 때만. 부분 포함 매칭·else 기본값 없음. */
const CHANGED_HEADING = "변경된 사실";
const FRESH_HEADING = "새롭게 확인된 사실";

/**
 * 소제목 끝의 건수 표기(` (2건)`) — agent 가 **항상** 붙인다
 * (bambi-agent-api `agent/change_history/features/assembly.py`:
 *  `f"{CHANGED_SUBHEADING} ({len(changed)}건)"`, 계약 문서 `### 변경된 사실 (N건)`).
 *
 * 이걸 떼지 않으면 운영 본문의 `### 변경된 사실 (2건)` 이 완전일치에서 탈락해 **배지도 백틱 값
 * 색상도 전혀 붙지 않는다** — 2026-08-11 운영 실측에서 델타 보고서 3건 전부 미적용이었다.
 * (#86 테스트는 계약 문서 예시 대신 건수 없는 픽스처를 써서 이 차이를 잡지 못했다.)
 *
 * 떼는 대상은 **끝에 붙은 건수 표기 하나**뿐이라 완전일치 규율은 그대로다: `변경된 사실 안내`
 * 처럼 문구 자체가 다른 제목은 접미사가 없어 그대로 탈락한다(부분 포함 매칭이 아니다).
 */
const HEADING_COUNT_SUFFIX = /\s*\(\d+건\)$/;

/** 배지 판정용 소제목 문구 — 끝의 건수 표기만 떼고 나머지는 원문 그대로 비교한다. */
function headingBaseText(text: string): string {
  return text.replace(HEADING_COUNT_SUFFIX, "").trimEnd();
}

/**
 * heading 역할.
 * - `section`: Delta 섹션 헤더(단일 주제의 `## 변경사항`, 다주제의 `### 변경사항`).
 * - `changed`/`fresh`: 섹션 안의 **최심 소제목**이면서 문구가 정확히 일치하는 것만.
 * - `null`: 그 외 전부(주제명·알 수 없는 제목·부분 일치). **배지를 붙이지 않는다.**
 */
type HeadingRole = "section" | "changed" | "fresh" | null;

/** 백틱 값이 놓인 문맥 — 확정된 상위 소제목에서만 물려받는다. 추측하지 않는다. */
type ValueContext = "changed" | "fresh" | null;

type Annotated = { block: Block; role: HeadingRole; context: ValueContext };

/**
 * 문서의 heading 계층에서 **섹션 레벨과 최심 소제목 레벨**을 뽑는다(태그명이 아니라 구조 기준).
 *
 *   단일 주제  `## 변경사항` / `### 변경된 사실`            → levels [2,3] → 섹션 2, 최심 3
 *   다주제     `## 주제명` / `### 변경사항` / `#### 변경된 사실`
 *                                                          → levels [2,3,4] → 섹션 3, 최심 4
 *
 * 즉 최심 = 가장 깊은 레벨, 섹션 = 그 **바로 위 레벨**이다. 다주제의 `## 주제명` 은 섹션 레벨이
 * 아니므로 섹션 스타일을 받지 않는다 — "모든 h3 에 같은 스타일" 같은 태그명 기반 판정을 피한다.
 * heading 레벨이 한 종류뿐이면 그 레벨이 섹션이고 최심 소제목은 없다(배지 대상 없음).
 */
function deltaHeadingLevels(blocks: Block[]): {
  sectionLevel: number | null;
  badgeLevel: number | null;
} {
  const levels = [
    ...new Set(blocks.filter((b) => b.kind === "heading").map((b) => b.level)),
  ].sort((a, b) => a - b);
  if (levels.length === 0) return { sectionLevel: null, badgeLevel: null };
  if (levels.length === 1) return { sectionLevel: levels[0]!, badgeLevel: null };
  return { sectionLevel: levels[levels.length - 2]!, badgeLevel: levels[levels.length - 1]! };
}

/**
 * 블록에 delta 역할·문맥을 붙인다. delta 가 아니면 전부 null 이라 렌더가 기존과 완전히 같아진다.
 *
 * 배지 판정 순서가 중요하다: **(1) 구조로 최심 소제목인지 확인 → (2) 문구가 정확히 일치하는지 확인.**
 * 둘 다 만족할 때만 changed/fresh 다. 문구가 다르면(`변경된 사실 안내`·`내용`·`시사점`·
 * 새로 생긴 제목 등) **아무 배지도 붙이지 않는다** — "달라진"이 포함되면 changed, 아니면 fresh 로
 * 떨어뜨리는 else 기본값을 두지 않는다(참고 구현 change_history_views.py 의 결함을 복제하지 않는다).
 *
 * 백틱 값 문맥도 같은 규율이다: 확정된 changed/fresh 소제목 아래에서만 물려받고, 그 밖의 heading
 * 을 만나면 즉시 해제한다 → 문맥 밖 일반 인라인 코드는 기존 스타일 그대로다.
 */
function annotate(blocks: Block[], delta: boolean): Annotated[] {
  if (!delta) return blocks.map((block) => ({ block, role: null, context: null }));

  const { sectionLevel, badgeLevel } = deltaHeadingLevels(blocks);
  let context: ValueContext = null;

  return blocks.map((block) => {
    if (block.kind !== "heading") return { block, role: null, context };

    const text = block.text.trim();
    let role: HeadingRole = null;
    if (badgeLevel !== null && block.level === badgeLevel) {
      // 최심 소제목 — 건수 표기만 뗀 문구가 정확히 일치하는 둘만 배지를 받는다(부분 일치 금지).
      const base = headingBaseText(text);
      if (base === CHANGED_HEADING) role = "changed";
      else if (base === FRESH_HEADING) role = "fresh";
    }
    if (role === null && sectionLevel !== null && block.level === sectionLevel) {
      role = "section";
    }

    context = role === "changed" ? "changed" : role === "fresh" ? "fresh" : null;
    return { block, role, context: null };
  });
}

/** markdown depth → HTML heading 태그. 페이지가 h1 을 이미 쓰므로 본문은 h2 부터 시작한다. */
function headingTag(level: number, delta: boolean): "h2" | "h3" | "h4" | "h5" | "h6" {
  // 기존(자유 형식) 본문은 예전 그대로 h2/h3 로만 접는다 — 렌더링 회귀를 만들지 않는다.
  if (!delta) return level <= 2 ? "h2" : "h3";
  const clamped = Math.min(Math.max(level, 2), 6);
  return (["h2", "h3", "h4", "h5", "h6"] as const)[clamped - 2]!;
}

/** heading 역할 → 클래스. 역할이 없으면 클래스도 없다(기존 heading 스타일 그대로). */
function headingClass(role: HeadingRole): string | undefined {
  if (role === "section") return "md-delta-section";
  if (role === "changed") return "md-delta-changed";
  if (role === "fresh") return "md-delta-fresh";
  return undefined;
}

/** 인라인 토큰 — **굵게** · `코드` · [텍스트](http/https URL). 그 외는 텍스트 그대로. */
const INLINE_TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
/** delta 전용 — 위 토큰에 GFM 취소선(~~…~~)을 더한다. 기존 본문의 `~~` 는 지금처럼 원문 유지. */
const INLINE_TOKEN_DELTA = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
const INLINE_LINK = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

/** 백틱 값 문맥 → 클래스. 문맥이 없으면 클래스도 없다(일반 인라인 코드는 기존 스타일 유지). */
function valueClass(context: ValueContext): string | undefined {
  if (context === "changed") return "md-delta-value-changed";
  if (context === "fresh") return "md-delta-value-fresh";
  return undefined;
}

function renderInline(
  text: string,
  keyPrefix: string,
  delta: boolean,
  context: ValueContext = null,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let seq = 0;
  const pattern = delta ? INLINE_TOKEN_DELTA : INLINE_TOKEN;
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-t${seq}`;
    if (token.startsWith("**")) {
      nodes.push(<b key={key}>{token.slice(2, -2)}</b>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className={valueClass(context)}>
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = INLINE_LINK.exec(token);
      if (link) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token); // 방어적 — 토큰 매칭과 링크 파싱이 어긋나면 원문 유지
      }
    }
    last = match.index + token.length;
    seq += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderBlock(entry: Annotated, index: number, delta: boolean): ReactNode {
  const { block, role, context } = entry;
  const key = `md-${index}`;
  switch (block.kind) {
    case "heading": {
      // 원본 depth 를 보존한 태그 + 구조로 판정된 역할 클래스(없으면 클래스 없음).
      const Tag = headingTag(block.level, delta);
      return (
        <Tag key={key} className={headingClass(role)}>
          {renderInline(block.text, key, delta)}
        </Tag>
      );
    }
    case "p":
      return <p key={key}>{renderInline(block.text, key, delta)}</p>;
    case "quote":
      return (
        <blockquote key={key}>
          {block.lines.map((line, i) => (
            <p key={`${key}-q${i}`} className="last:mb-0">
              {renderInline(line, `${key}-q${i}`, delta, context)}
            </p>
          ))}
        </blockquote>
      );
    case "ul":
      return (
        <ul
          key={key}
          className={
            context === "changed"
              ? "md-delta-list md-delta-list-changed"
              : context === "fresh"
                ? "md-delta-list md-delta-list-fresh"
                : undefined
          }
        >
          {block.items.map((item, i) => {
            const comparison = context === "changed" && item.continuation.length > 0;
            return (
              <li
                key={`${key}-li${i}`}
                className={comparison ? "md-delta-comparison" : undefined}
              >
                {comparison ? (
                  <span className="md-delta-line md-delta-before-line">
                    {renderInline(item.text, `${key}-li${i}`, delta, context)}
                  </span>
                ) : (
                  renderInline(item.text, `${key}-li${i}`, delta, context)
                )}
                {/* 들여쓴 연속 행 — 같은 항목 안에서 줄만 바꾼다(별도 문단·하위 불릿이 아니다). */}
                {item.continuation.map((line, j) => (
                  <span
                    key={`${key}-li${i}-n${j}`}
                    className={
                      comparison ? "md-cont md-delta-line md-delta-after-line" : "md-cont"
                    }
                  >
                    {renderInline(line, `${key}-li${i}-n${j}`, delta, context)}
                  </span>
                ))}
                {item.children.length > 0 && (
                  <ul>
                    {item.children.map((child, j) => (
                      <li key={`${key}-li${i}-c${j}`}>
                        {renderInline(child, `${key}-li${i}-c${j}`, delta, context)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      );
    case "ol":
      return (
        <ol key={key}>
          {block.items.map((item, i) => (
            <li key={`${key}-li${i}`}>{renderInline(item, `${key}-li${i}`, delta, context)}</li>
          ))}
        </ol>
      );
    case "table":
      return (
        <table key={key}>
          <thead>
            <tr>
              {block.header.map((cell, i) => (
                <th key={`${key}-h${i}`}>{renderInline(cell, `${key}-h${i}`, delta, context)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={`${key}-r${r}`}>
                {row.map((cell, c) => (
                  <td key={`${key}-r${r}-c${c}`}>
                    {renderInline(cell, `${key}-r${r}-c${c}`, delta, context)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "code":
      return (
        <pre key={key} className="code">
          {block.text}
        </pre>
      );
  }
}

/**
 * Markdown 본문 → .md-viewer 스코프의 React 요소. 빈 본문은 호출부가 걸러 이 컴포넌트는 항상 내용이 있다.
 *
 * `delta` 는 리포트 응답의 `changeHistoryEnabled` 를 그대로 받는다(기본 false = 기존 자유 형식).
 * 계정 설정이 아니라 **그 보고서 응답값**이어야 한다 — 판정 근거는 lib/report-delta.ts 참조.
 */
export function ReportMarkdown({
  markdown,
  delta = false,
}: {
  markdown: string;
  delta?: boolean;
}) {
  return (
    <div className={delta ? "md-viewer md-delta" : "md-viewer"}>
      {annotate(parseBlocks(markdown, delta), delta).map((entry, index) =>
        renderBlock(entry, index, delta),
      )}
    </div>
  );
}
