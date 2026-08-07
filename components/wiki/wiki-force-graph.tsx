"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { WikiGraph, WikiGraphEdge, WikiGraphNode } from "@/types/wiki";

const GRAPH_WIDTH = 960;
const GRAPH_HEIGHT = 650;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const MIN_NODE_RADIUS = 10;
const MAX_NODE_RADIUS = 30;

type Position = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
};

type ViewTransform = { x: number; y: number; scale: number };
type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
};
type PanState = {
  pointerId: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
};

const INITIAL_TRANSFORM: ViewTransform = { x: 0, y: 0, scale: 1 };

/** Agent Wiki와 같은 Force simulation·Node drag·화면 pan·wheel zoom Graph를 제공한다. */
export function WikiForceGraph({
  graph,
  selectedDocumentId,
  onSelect,
  onClear,
}: {
  graph: WikiGraph;
  selectedDocumentId: string | null;
  onSelect: (documentId: string, options: { revealDetail: boolean }) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showEntity, setShowEntity] = useState(true);
  const [showConcept, setShowConcept] = useState(true);
  const [showOrphan, setShowOrphan] = useState(true);
  const [renderPositions, setRenderPositions] = useState<ReadonlyMap<string, Position>>(
    () => new Map(),
  );
  const [transform, setTransform] = useState<ViewTransform>(INITIAL_TRANSFORM);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const positionsRef = useRef(new Map<string, Position>());
  const transformRef = useRef<ViewTransform>(INITIAL_TRANSFORM);
  const frameRef = useRef<number | null>(null);
  const simulateRef = useRef<() => void>(() => {});
  const alphaRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);

  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter((node) => {
        if (node.documentKind === "entity" && !showEntity) return false;
        if (node.documentKind === "concept" && !showConcept) return false;
        return showOrphan || node.degree > 0;
      }),
    [graph.nodes, showConcept, showEntity, showOrphan],
  );
  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );
  const maxGraphDegree = useMemo(
    () => Math.max(0, ...graph.nodes.map((node) => node.degree)),
    [graph.nodes],
  );
  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      ),
    [graph.edges, visibleNodeIds],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("ko");
  const matchingNodeIds = useMemo(() => {
    if (normalizedQuery === "") return null;
    return new Set(
      visibleNodes
        .filter((node) =>
          [node.title, node.documentKey, node.subtype ?? "", node.summary ?? "", ...node.aliases]
            .join(" ")
            .toLocaleLowerCase("ko")
            .includes(normalizedQuery),
        )
        .map((node) => node.id),
    );
  }, [normalizedQuery, visibleNodes]);
  const neighborIds = useMemo(
    () => connectedNodeIds(selectedDocumentId, visibleEdges),
    [selectedDocumentId, visibleEdges],
  );

  useEffect(() => {
    seedPositions(positionsRef.current, visibleNodes);
    alphaRef.current = Math.max(alphaRef.current, 0.85);

    const simulate = () => {
      if (alphaRef.current < 0.012 || visibleNodes.length === 0) {
        frameRef.current = null;
        return;
      }
      simulateFrame(positionsRef.current, visibleNodes, visibleEdges, alphaRef.current);
      alphaRef.current *= 0.972;
      setRenderPositions(snapshotPositions(positionsRef.current));
      frameRef.current = requestAnimationFrame(simulate);
    };
    simulateRef.current = simulate;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(simulate);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [visibleEdges, visibleNodes]);

  function updateTransform(next: ViewTransform) {
    transformRef.current = next;
    setTransform(next);
  }

  useEffect(() => {
    const graphElement = svgRef.current;
    if (graphElement === null) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = graphElement.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) * (GRAPH_WIDTH / rect.width);
      const mouseY = (event.clientY - rect.top) * (GRAPH_HEIGHT / rect.height);
      const current = transformRef.current;
      const scale = clamp(
        current.scale * Math.exp(-event.deltaY * 0.0012),
        MIN_SCALE,
        MAX_SCALE,
      );
      const next = {
        x: mouseX - ((mouseX - current.x) / current.scale) * scale,
        y: mouseY - ((mouseY - current.y) / current.scale) * scale,
        scale,
      };
      transformRef.current = next;
      setTransform(next);
    };

    graphElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => graphElement.removeEventListener("wheel", handleWheel);
  }, [visibleNodes.length]);

  function reheat(alpha = 1) {
    alphaRef.current = Math.max(alphaRef.current, alpha);
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => simulateRef.current());
    }
  }

  function resetLayout() {
    positionsRef.current.clear();
    seedPositions(positionsRef.current, visibleNodes);
    setRenderPositions(snapshotPositions(positionsRef.current));
    reheat(1);
  }

  function fitGraph() {
    const points = visibleNodes
      .map((node) => positionsRef.current.get(node.id))
      .filter((point): point is Position => point !== undefined);
    if (points.length === 0) return;
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const contentWidth = Math.max(120, maxX - minX + 170);
    const contentHeight = Math.max(120, maxY - minY + 170);
    const scale = clamp(
      Math.min(GRAPH_WIDTH / contentWidth, GRAPH_HEIGHT / contentHeight),
      MIN_SCALE,
      1.6,
    );
    updateTransform({
      x: GRAPH_WIDTH / 2 - ((minX + maxX) / 2) * scale,
      y: GRAPH_HEIGHT / 2 - ((minY + maxY) / 2) * scale,
      scale,
    });
  }

  function graphPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const viewX = (clientX - rect.left) * (GRAPH_WIDTH / rect.width);
    const viewY = (clientY - rect.top) * (GRAPH_HEIGHT / rect.height);
    const view = transformRef.current;
    return { x: (viewX - view.x) / view.scale, y: (viewY - view.y) / view.scale };
  }

  function startNodeDrag(event: ReactPointerEvent<SVGGElement>, nodeId: string) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = positionsRef.current.get(nodeId);
    if (!point) return;
    point.fixed = true;
    dragRef.current = {
      id: nodeId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }

  function startPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || closestNode(event.target)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const view = transformRef.current;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: view.x,
      startY: view.y,
      moved: false,
    };
  }

  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      drag.moved =
        drag.moved ||
        Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 3;
      if (!drag.moved) return;
      const point = positionsRef.current.get(drag.id);
      const cursor = graphPoint(event.clientX, event.clientY);
      if (point) {
        drag.moved = true;
        point.x = cursor.x;
        point.y = cursor.y;
        point.vx = 0;
        point.vy = 0;
        setRenderPositions(snapshotPositions(positionsRef.current));
        reheat(0.3);
      }
    }
    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId) {
      const rect = event.currentTarget.getBoundingClientRect();
      const dx = (event.clientX - pan.x) * (GRAPH_WIDTH / rect.width);
      const dy = (event.clientY - pan.y) * (GRAPH_HEIGHT / rect.height);
      pan.moved = pan.moved || Math.abs(dx) + Math.abs(dy) > 3;
      updateTransform({ ...transformRef.current, x: pan.startX + dx, y: pan.startY + dy });
    }
  }

  function endPointer(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const point = positionsRef.current.get(drag.id);
      if (point) point.fixed = false;
      dragRef.current = null;
      if (drag.moved) reheat(0.25);
      onSelect(drag.id, { revealDetail: !drag.moved });
      return;
    }
    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId) {
      panRef.current = null;
      if (!pan.moved) onClear();
    }
  }

  function cancelPointer() {
    const drag = dragRef.current;
    if (drag) {
      const point = positionsRef.current.get(drag.id);
      if (point) point.fixed = false;
    }
    dragRef.current = null;
    panRef.current = null;
  }

  return (
    <section className="h-full min-h-[650px] bg-card">
      <div className="absolute top-4 left-4 z-10 w-[min(360px,calc(100%-32px))] rounded-[14px] border border-border bg-card/95 p-3.5 shadow-sm backdrop-blur">
        <label>
          <span className="sr-only">Wiki 노드 검색</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목, 별칭, subtype 검색"
            className="focus-ring h-10 w-full rounded-[10px] border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <GraphFilter label="Entity" checked={showEntity} tone="entity" onChange={setShowEntity} />
          <GraphFilter
            label="Concept"
            checked={showConcept}
            tone="concept"
            onChange={setShowConcept}
          />
          <GraphFilter label="고립 Node" checked={showOrphan} onChange={setShowOrphan} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <ToolbarButton label="화면 맞춤" onClick={fitGraph} />
          <ToolbarButton label="다시 펼치기" onClick={resetLayout} />
          <span className="ml-auto text-[10.5px] text-muted-foreground">
            드래그 이동 · 휠 확대
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2" aria-live="polite">
        <GraphStat value={visibleNodes.length} label="Nodes" />
        <GraphStat value={visibleEdges.length} label="Links" />
        <GraphStat
          value={visibleNodes.filter((node) => node.documentKind === "entity").length}
          label="Entities"
        />
        <GraphStat
          value={visibleNodes.filter((node) => node.documentKind === "concept").length}
          label="Concepts"
        />
      </div>

      {visibleNodes.length === 0 ? (
        <div className="flex min-h-[650px] items-center justify-center px-5 text-center text-[13px] text-muted-foreground">
          선택한 종류에 해당하는 Wiki 노드가 없어요.
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
          className="h-full min-h-[650px] w-full cursor-grab select-none active:cursor-grabbing"
          role="application"
          aria-label={`LLM Wiki Graph, 노드 ${visibleNodes.length}개, 연결 ${visibleEdges.length}개`}
          tabIndex={0}
          style={{ overscrollBehavior: "contain", touchAction: "none" }}
          onPointerDown={startPan}
          onPointerMove={movePointer}
          onPointerUp={endPointer}
          onPointerCancel={cancelPointer}
        >
          <rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="var(--card)" />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            <g aria-hidden="true">
              {visibleEdges.map((edge) => (
                <ForceEdge
                  key={edge.id}
                  edge={edge}
                  positions={renderPositions}
                  selectedDocumentId={selectedDocumentId}
                  matchingNodeIds={matchingNodeIds}
                />
              ))}
            </g>
            <g>
              {visibleNodes.map((node, index) => (
                <ForceNode
                  key={node.id}
                  node={node}
                  position={
                    renderPositions.get(node.id) ?? initialPosition(node.id, index, visibleNodes.length)
                  }
                  selected={node.id === selectedDocumentId}
                  neighbor={neighborIds.has(node.id)}
                  mutedBySelection={selectedDocumentId !== null && !neighborIds.has(node.id)}
                  mutedBySearch={matchingNodeIds !== null && !matchingNodeIds.has(node.id)}
                  maxDegree={maxGraphDegree}
                  onPointerDown={(event) => startNodeDrag(event, node.id)}
                  onSelect={() => onSelect(node.id, { revealDetail: true })}
                />
              ))}
            </g>
          </g>
        </svg>
      )}
    </section>
  );
}

function ForceEdge({
  edge,
  positions,
  selectedDocumentId,
  matchingNodeIds,
}: {
  edge: WikiGraphEdge;
  positions: ReadonlyMap<string, Position>;
  selectedDocumentId: string | null;
  matchingNodeIds: ReadonlySet<string> | null;
}) {
  const source = positions.get(edge.source);
  const target = positions.get(edge.target);
  if (!source || !target) return null;
  const focused =
    selectedDocumentId !== null &&
    (edge.source === selectedDocumentId || edge.target === selectedDocumentId);
  const mutedBySelection = selectedDocumentId !== null && !focused;
  const mutedBySearch =
    matchingNodeIds !== null &&
    !matchingNodeIds.has(edge.source) &&
    !matchingNodeIds.has(edge.target);
  return (
    <line
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      stroke={focused ? "var(--wiki-related)" : "var(--border)"}
      strokeWidth={focused ? 2.4 : 1.25}
      opacity={mutedBySelection || mutedBySearch ? 0.15 : focused ? 0.95 : 0.72}
    />
  );
}

function ForceNode({
  node,
  position,
  selected,
  neighbor,
  mutedBySelection,
  mutedBySearch,
  maxDegree,
  onPointerDown,
  onSelect,
}: {
  node: WikiGraphNode;
  position: Position;
  selected: boolean;
  neighbor: boolean;
  mutedBySelection: boolean;
  mutedBySearch: boolean;
  maxDegree: number;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  onSelect: () => void;
}) {
  const radius = nodeRadius(node.degree, maxDegree);
  const label = node.title.length > 28 ? `${node.title.slice(0, 27)}…` : node.title;
  const fill = node.documentKind === "entity" ? "var(--wiki-entity)" : "var(--wiki-concept)";
  return (
    <g
      data-node-id={node.id}
      role="button"
      tabIndex={0}
      aria-label={`${node.title}, ${node.documentKind}, 연결 ${node.degree}개`}
      transform={`translate(${position.x} ${position.y})`}
      opacity={mutedBySelection || mutedBySearch ? 0.14 : 1}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer outline-none active:cursor-grabbing"
    >
      <circle
        r={radius + (selected ? 6 : 3)}
        fill="transparent"
        stroke={selected ? "var(--foreground)" : neighbor ? "var(--wiki-related)" : "transparent"}
        strokeWidth={selected ? 3 : 1.5}
      />
      <circle r={radius} fill={fill} stroke="var(--card)" strokeWidth="3" />
      <text
        x={radius + 7}
        y="4"
        fill="var(--foreground)"
        fontSize="12"
        fontWeight={selected ? 760 : 620}
        paintOrder="stroke"
        stroke="var(--card)"
        strokeWidth="4"
        strokeLinejoin="round"
        pointerEvents="none"
      >
        {label}
      </text>
      <title>{`${node.title} · ${node.documentKind} · 연결 ${node.degree}개`}</title>
    </g>
  );
}

function GraphFilter({
  label,
  checked,
  tone,
  onChange,
}: {
  label: string;
  checked: boolean;
  tone?: "entity" | "concept";
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-ink-mid">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-primary"
      />
      {tone && (
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${tone === "entity" ? "bg-wiki-entity" : "bg-wiki-concept"}`}
        />
      )}
      {label}
    </label>
  );
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring h-8 rounded-[8px] border border-border bg-background px-2.5 text-[11.5px] font-semibold text-ink-mid hover:text-foreground"
    >
      {label}
    </button>
  );
}

function GraphStat({ value, label }: { value: number; label: string }) {
  return (
    <span className="rounded-[10px] border border-border bg-card/95 px-2.5 py-1.5 text-[10.5px] text-muted-foreground shadow-sm backdrop-blur">
      <b className="mr-1 text-[12px] text-foreground">{value}</b>
      {label}
    </span>
  );
}

function seedPositions(positions: Map<string, Position>, nodes: WikiGraphNode[]) {
  nodes.forEach((node, index) => {
    if (positions.has(node.id)) return;
    positions.set(node.id, initialPosition(node.id, index, nodes.length));
  });
}

function snapshotPositions(positions: ReadonlyMap<string, Position>): ReadonlyMap<string, Position> {
  return new Map(Array.from(positions, ([id, position]) => [id, { ...position }]));
}

function initialPosition(nodeId: string, index: number, count: number): Position {
  const seed = hash(nodeId);
  const angle = (index / Math.max(1, count)) * Math.PI * 2 + (seed % 100) / 100;
  const radius = count === 1 ? 0 : 70 + Math.sqrt(index + 1) * 26;
  return {
    x: GRAPH_WIDTH / 2 + Math.cos(angle) * radius,
    y: GRAPH_HEIGHT / 2 + Math.sin(angle) * radius,
    vx: 0,
    vy: 0,
    fixed: false,
  };
}

function simulateFrame(
  positions: Map<string, Position>,
  nodes: WikiGraphNode[],
  edges: WikiGraphEdge[],
  alpha: number,
) {
  for (let index = 0; index < nodes.length; index += 1) {
    const current = positions.get(nodes[index].id);
    if (!current || current.fixed) continue;
    for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
      const other = positions.get(nodes[otherIndex].id);
      if (!other) continue;
      let dx = current.x - other.x;
      let dy = current.y - other.y;
      const distanceSquared = dx * dx + dy * dy + 0.1;
      const force = Math.min(4, (1500 * alpha) / distanceSquared);
      const distance = Math.sqrt(distanceSquared);
      dx /= distance;
      dy /= distance;
      current.vx += dx * force;
      current.vy += dy * force;
      if (!other.fixed) {
        other.vx -= dx * force;
        other.vy -= dy * force;
      }
    }
  }
  edges.forEach((edge) => applyLinkForce(positions, edge, alpha));
  nodes.forEach((node) => {
    const point = positions.get(node.id);
    if (!point || point.fixed) return;
    point.vx += (GRAPH_WIDTH / 2 - point.x) * 0.0008 * alpha;
    point.vy += (GRAPH_HEIGHT / 2 - point.y) * 0.0008 * alpha;
    point.vx *= 0.86;
    point.vy *= 0.86;
    point.x += point.vx;
    point.y += point.vy;
  });
}

function applyLinkForce(positions: Map<string, Position>, edge: WikiGraphEdge, alpha: number) {
  const source = positions.get(edge.source);
  const target = positions.get(edge.target);
  if (!source || !target) return;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const pull = (distance - 105) * 0.006 * alpha;
  const forceX = (dx / distance) * pull;
  const forceY = (dy / distance) * pull;
  if (!source.fixed) {
    source.vx += forceX;
    source.vy += forceY;
  }
  if (!target.fixed) {
    target.vx -= forceX;
    target.vy -= forceY;
  }
}

function connectedNodeIds(
  selectedDocumentId: string | null,
  edges: WikiGraphEdge[],
): ReadonlySet<string> {
  if (selectedDocumentId === null) return new Set();
  const result = new Set([selectedDocumentId]);
  edges.forEach((edge) => {
    if (edge.source === selectedDocumentId) result.add(edge.target);
    if (edge.target === selectedDocumentId) result.add(edge.source);
  });
  return result;
}

function closestNode(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest("[data-node-id]") : null;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nodeRadius(degree: number, maxDegree: number): number {
  if (maxDegree <= 0) return MIN_NODE_RADIUS;
  const importance = Math.sqrt(clamp(degree, 0, maxDegree) / maxDegree);
  return MIN_NODE_RADIUS + importance * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
}
