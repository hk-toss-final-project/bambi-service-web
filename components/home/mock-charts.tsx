/**
 * 피드 카드 mock 차트 — 목업 home-feed.html 의 인라인 SVG 그대로 (색만 토큰 var).
 * ★ 실제 API 교체 지점: 계약 확정 시 이미지 URL 렌더링으로 교체된다 (lib/mock/feed.ts 참조).
 *
 * 접근성(A-7): 내부 `<text>` 의 수치("−6bp"·"82.4" 등)는 실제 데이터가 아니라 목업 샘플이라
 * 스크린리더에 맥락 없는 숫자로 읽히면 오해를 준다. 카드 본문 텍스트가 이미 내용을 전달하므로
 * 장식으로 간주해 `aria-hidden` 처리한다. 실 데이터 이미지로 교체될 때 대체 텍스트 정책을 다시 정한다.
 */

const FONT = "Pretendard Variable,Pretendard,Apple SD Gothic Neo,sans-serif";
const IMG_CLASS = "block h-full w-full";

/** CARD B — US 10Y 야간 금리 차트 */
export function Us10yChart() {
  return (
    <svg className={IMG_CLASS} viewBox="0 0 596 280" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <rect width="596" height="280" style={{ fill: "var(--background)" }} />
      <g style={{ stroke: "var(--border)" }} strokeWidth={1}>
        <line x1="0" y1="93" x2="596" y2="93" />
        <line x1="0" y1="186" x2="596" y2="186" />
      </g>
      <polyline
        style={{ fill: "none", stroke: "var(--primary)" }}
        strokeWidth={2.5}
        points="24,120 106,112 188,136 270,120 352,150 434,142 516,176 572,170"
      />
      <circle cx="352" cy="150" r="3.5" style={{ fill: "var(--primary)" }} />
      <text x="24" y="32" style={{ fill: "var(--muted-foreground)" }} fontFamily={FONT} fontSize={13}>
        US 10Y · overnight
      </text>
      <text x="500" y="32" style={{ fill: "var(--ink-mid)" }} fontFamily={FONT} fontSize={13} fontWeight={600}>
        −6bp
      </text>
    </svg>
  );
}

/** CARD E — USD/KRW 트리거 라인 차트 */
export function FxTriggerChart() {
  return (
    <svg className={IMG_CLASS} viewBox="0 0 596 280" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <rect width="596" height="280" style={{ fill: "var(--background)" }} />
      <g style={{ stroke: "var(--border)" }} strokeWidth={1}>
        <line x1="0" y1="93" x2="596" y2="93" />
        <line x1="0" y1="186" x2="596" y2="186" />
      </g>
      <polyline
        style={{ fill: "none", stroke: "var(--primary)" }}
        strokeWidth={2.5}
        points="24,150 106,140 188,158 270,120 352,132 434,98 516,112 572,140"
      />
      <line
        x1="0"
        y1="120"
        x2="596"
        y2="120"
        style={{ stroke: "var(--muted-foreground)" }}
        strokeWidth={1.2}
        strokeDasharray="6 6"
        opacity={0.7}
      />
      <text x="24" y="32" style={{ fill: "var(--muted-foreground)" }} fontFamily={FONT} fontSize={13}>
        USD/KRW · 트리거 라인
      </text>
    </svg>
  );
}

/** CARD C — LLM 릴리즈 이미지 그리드 (4타일 + "+2") */
export function LlmGrid() {
  return (
    <>
      <span className="relative h-[146px] overflow-hidden bg-[var(--img)]">
        <svg className={IMG_CLASS} viewBox="0 0 300 146" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <rect width="300" height="146" style={{ fill: "var(--secondary)" }} />
          <g style={{ fill: "var(--primary)" }}>
            <rect x="34" y="78" width="24" height="48" />
            <rect x="74" y="60" width="24" height="66" />
            <rect x="114" y="44" width="24" height="82" />
          </g>
          <g style={{ fill: "var(--low)" }}>
            <rect x="170" y="92" width="24" height="34" />
            <rect x="210" y="76" width="24" height="50" />
            <rect x="250" y="64" width="24" height="62" />
          </g>
        </svg>
      </span>
      <span className="relative h-[146px] overflow-hidden bg-[var(--img)]">
        <svg className={IMG_CLASS} viewBox="0 0 300 146" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <rect width="300" height="146" style={{ fill: "var(--background)" }} />
          <g style={{ stroke: "var(--border)" }} strokeWidth={1}>
            <line x1="0" y1="49" x2="300" y2="49" />
            <line x1="0" y1="98" x2="300" y2="98" />
          </g>
          <polyline
            style={{ fill: "none", stroke: "var(--primary)" }}
            strokeWidth={2.5}
            points="14,108 64,80 114,88 164,56 214,62 276,34"
          />
        </svg>
      </span>
      <span className="relative h-[146px] overflow-hidden bg-[var(--img)]">
        <svg className={IMG_CLASS} viewBox="0 0 300 146" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <rect width="300" height="146" style={{ fill: "var(--secondary)" }} />
          <g fontFamily={FONT} style={{ fill: "var(--muted-foreground)" }} fontSize={14}>
            <text x="26" y="52">MMLU</text>
            <text x="26" y="86">HumanEval</text>
          </g>
          <g fontFamily={FONT} style={{ fill: "var(--ink-mid)" }} fontSize={14} fontWeight={600}>
            <text x="200" y="52">82.4</text>
            <text x="200" y="86">74.1</text>
          </g>
        </svg>
      </span>
      <span className="relative h-[146px] overflow-hidden bg-[var(--img)]">
        <svg className={IMG_CLASS} viewBox="0 0 300 146" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <rect width="300" height="146" style={{ fill: "var(--background)" }} />
          <rect x="40" y="44" width="150" height="12" rx="6" style={{ fill: "var(--input)" }} />
          <rect x="40" y="70" width="110" height="12" rx="6" style={{ fill: "var(--input)" }} />
          <rect x="40" y="96" width="130" height="12" rx="6" style={{ fill: "var(--border)" }} />
        </svg>
        {/* .pgrid .gi .more — 남은 이미지 수를 알리는 시각 표시(목업 샘플). 위 SVG 와 함께 장식 처리. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-[rgba(20,22,25,.42)] text-lg font-semibold text-white [font-family:'Space_Grotesk',monospace]"
        >
          +2
        </span>
      </span>
    </>
  );
}
