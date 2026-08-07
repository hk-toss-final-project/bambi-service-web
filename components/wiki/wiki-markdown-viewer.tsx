import type { ReactNode } from "react";

/** 신뢰하지 않는 Markdown을 HTML 주입 없이 문서형 React 요소로 렌더링한다. */
export function WikiMarkdownViewer({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  if (blocks.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground">정리된 본문이 아직 없어요.</p>;
  }
  return (
    <article className="min-w-0 [overflow-wrap:anywhere] text-[13px] leading-[1.75] text-ink-mid">
      {blocks}
    </article>
  );
}

function parseMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre
          key={`code-${blocks.length}`}
          className="my-3 overflow-x-auto rounded-[10px] border border-border bg-background p-3.5 font-mono text-[11.5px] leading-[1.7] text-foreground"
        >
          {language !== "" && (
            <span className="mb-2 block text-[9.5px] font-bold tracking-wide text-muted-foreground uppercase">
              {language}
            </span>
          )}
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push(renderHeading(heading[1].length, heading[2], blocks.length));
      index += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-4 border-0 border-t border-border" />);
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${blocks.length}`}
          className="my-3 rounded-r-[8px] border-l-[3px] border-primary bg-primary/5 px-3 py-2 text-muted-foreground"
        >
          {quote.map((value, quoteIndex) => (
            <span key={`quote-line-${quoteIndex}`} className="block">
              {renderInline(value, `quote-${blocks.length}-${quoteIndex}`)}
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-3 list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`ul-item-${itemIndex}`}>{renderInline(item, `ul-${blocks.length}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-3 list-decimal space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${itemIndex}`}>{renderInline(item, `ol-${blocks.length}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (isTableRow(line) && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const head = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push(renderTable(head, rows, blocks.length));
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && !startsMarkdownBlock(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    if (paragraph.length === 0) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2.5">
        {paragraph.map((value, lineIndex) => (
          <span key={`p-line-${lineIndex}`}>
            {lineIndex > 0 && <br />}
            {renderInline(value, `p-${blocks.length}-${lineIndex}`)}
          </span>
        ))}
      </p>,
    );
  }
  return blocks;
}

function renderHeading(level: number, text: string, index: number): ReactNode {
  const content = renderInline(text, `heading-${index}`);
  if (level === 1) {
    return (
      <h1
        key={`h1-${index}`}
        className="mt-5 mb-3 border-b border-border pb-2 text-[20px] leading-[1.35] font-bold tracking-[-0.02em] text-foreground first:mt-0"
      >
        {content}
      </h1>
    );
  }
  if (level === 2) {
    return (
      <h2
        key={`h2-${index}`}
        className="mt-5 mb-2 border-b border-border pb-1.5 text-[17px] leading-[1.4] font-bold tracking-[-0.015em] text-foreground first:mt-0"
      >
        {content}
      </h2>
    );
  }
  return (
    <h3
      key={`h${level}-${index}`}
      className="mt-4 mb-1.5 text-[14px] leading-[1.45] font-bold text-foreground first:mt-0"
    >
      {content}
    </h3>
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)\s]+\))/g;
  const result: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const offset = match.index ?? 0;
    if (offset > cursor) result.push(text.slice(cursor, offset));
    result.push(renderInlineToken(match[0], `${keyPrefix}-${tokenIndex}`));
    tokenIndex += 1;
    cursor = offset + match[0].length;
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}

function renderInlineToken(token: string, key: string): ReactNode {
  if (token.startsWith("`") && token.endsWith("`")) {
    return (
      <code key={key} className="rounded-[5px] bg-background px-1.5 py-0.5 font-mono text-[11.5px] text-primary">
        {token.slice(1, -1)}
      </code>
    );
  }
  if (token.startsWith("**") && token.endsWith("**")) {
    return (
      <strong key={key} className="font-bold text-foreground">
        {token.slice(2, -2)}
      </strong>
    );
  }
  if (token.startsWith("*") && token.endsWith("*")) {
    return <em key={key}>{token.slice(1, -1)}</em>;
  }
  if (token.startsWith("[[") && token.endsWith("]]")) {
    const [target, label] = token.slice(2, -2).split("|", 2);
    return (
      <span key={key} className="rounded-[5px] bg-signal-ink/10 px-1 text-signal-ink">
        {label || target}
      </span>
    );
  }
  const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
  if (link) {
    const href = safeUrl(link[2]);
    return href === null ? (
      link[1]
    ) : (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary underline decoration-primary/30 underline-offset-3 hover:decoration-primary"
      >
        {link[1]}
      </a>
    );
  }
  return token;
}

function renderTable(head: string[], rows: string[][], index: number): ReactNode {
  return (
    <div key={`table-wrap-${index}`} className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr>
            {head.map((cell, cellIndex) => (
              <th
                key={`head-${cellIndex}`}
                className="border border-border bg-background px-2.5 py-2 text-left font-bold text-foreground"
              >
                {renderInline(cell, `table-${index}-head-${cellIndex}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${cellIndex}`} className="border border-border px-2.5 py-2 align-top">
                  {renderInline(cell, `table-${index}-${rowIndex}-${cellIndex}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function startsMarkdownBlock(lines: string[], index: number): boolean {
  const line = lines[index];
  if (line.trim() === "") return true;
  if (/^(#{1,6})\s+/.test(line) || line.startsWith("```") || /^>\s?/.test(line)) return true;
  if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) return true;
  if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return true;
  return isTableRow(line) && index + 1 < lines.length && isTableDivider(lines[index + 1]);
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableDivider(line: string): boolean {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function safeUrl(value: string): string | null {
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("./")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
