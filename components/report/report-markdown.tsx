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
 */

type Block =
  | { kind: "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "ul"; items: { text: string; children: string[] }[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "code"; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const UL_ITEM = /^[-*]\s+(.*)$/;
const UL_CHILD = /^\s{2,}[-*]\s+(.*)$/;
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

function parseBlocks(markdown: string): Block[] {
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
      // 페이지가 이미 카드 제목(h1)을 렌더하므로 본문 제목은 h2/h3 로만 내린다.
      blocks.push({ kind: heading[1].length <= 2 ? "h2" : "h3", text: heading[2] ?? "" });
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
      const items: { text: string; children: string[] }[] = [];
      while (i < lines.length) {
        const current = lines[i] ?? "";
        const child = UL_CHILD.exec(current);
        if (child && items.length > 0) {
          items[items.length - 1]!.children.push(child[1] ?? "");
          i += 1;
          continue;
        }
        const item = UL_ITEM.exec(current);
        if (!item) break;
        items.push({ text: item[1] ?? "", children: [] });
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

/** 인라인 토큰 — **굵게** · `코드` · [텍스트](http/https URL). 그 외는 텍스트 그대로. */
const INLINE_TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
const INLINE_LINK = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let seq = 0;
  INLINE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_TOKEN.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-t${seq}`;
    if (token.startsWith("**")) {
      nodes.push(<b key={key}>{token.slice(2, -2)}</b>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
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

function renderBlock(block: Block, index: number): ReactNode {
  const key = `md-${index}`;
  switch (block.kind) {
    case "h2":
      return <h2 key={key}>{renderInline(block.text, key)}</h2>;
    case "h3":
      return <h3 key={key}>{renderInline(block.text, key)}</h3>;
    case "p":
      return <p key={key}>{renderInline(block.text, key)}</p>;
    case "quote":
      return (
        <blockquote key={key}>
          {block.lines.map((line, i) => (
            <p key={`${key}-q${i}`} className="last:mb-0">
              {renderInline(line, `${key}-q${i}`)}
            </p>
          ))}
        </blockquote>
      );
    case "ul":
      return (
        <ul key={key}>
          {block.items.map((item, i) => (
            <li key={`${key}-li${i}`}>
              {renderInline(item.text, `${key}-li${i}`)}
              {item.children.length > 0 && (
                <ul>
                  {item.children.map((child, j) => (
                    <li key={`${key}-li${i}-c${j}`}>
                      {renderInline(child, `${key}-li${i}-c${j}`)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key}>
          {block.items.map((item, i) => (
            <li key={`${key}-li${i}`}>{renderInline(item, `${key}-li${i}`)}</li>
          ))}
        </ol>
      );
    case "table":
      return (
        <table key={key}>
          <thead>
            <tr>
              {block.header.map((cell, i) => (
                <th key={`${key}-h${i}`}>{renderInline(cell, `${key}-h${i}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={`${key}-r${r}`}>
                {row.map((cell, c) => (
                  <td key={`${key}-r${r}-c${c}`}>{renderInline(cell, `${key}-r${r}-c${c}`)}</td>
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

/** Markdown 본문 → .md-viewer 스코프의 React 요소. 빈 본문은 호출부가 걸러 이 컴포넌트는 항상 내용이 있다. */
export function ReportMarkdown({ markdown }: { markdown: string }) {
  return <div className="md-viewer">{parseBlocks(markdown).map(renderBlock)}</div>;
}
