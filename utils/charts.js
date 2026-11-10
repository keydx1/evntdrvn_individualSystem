/**
 * Dependency free chart renderers for the dashboard.
 *
 * The project ships no charting library, so these build plain SVG strings.
 * Templates emit them with triple braces, e.g. {{{ trendChart trend }}}.
 *
 * The trend chart also publishes its geometry and series as data-* attributes
 * so public/js/app.js can draw a crosshair without recomputing the axis scale.
 */

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Round a "nice" grid step (1, 2, 5, 10 × 10ⁿ) for roughly four gridlines. */
const niceStep = (max) => {
  if (!(max > 0)) return 1;
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
};

/**
 * Line + area chart comparing two series across a shared list of points.
 * Each point: { label, in, out }.
 */
export const trendChart = (series) => {
  const points = Array.isArray(series) ? series : [];
  if (points.length === 0) return "";

  const width = 680;
  const height = 230;
  const pad = { top: 14, right: 14, bottom: 32, left: 44 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const peak = Math.max(
    1,
    ...points.map((point) => Math.max(Number(point.in) || 0, Number(point.out) || 0))
  );
  const step = niceStep(peak);
  const axisTop = step * Math.ceil(peak / step);
  const gridCount = Math.max(1, Math.round(axisTop / step));

  const x = (index) =>
    points.length === 1
      ? pad.left + innerWidth / 2
      : pad.left + (index / (points.length - 1)) * innerWidth;

  const y = (value) =>
    pad.top + innerHeight - (Math.max(0, Number(value) || 0) / axisTop) * innerHeight;

  const line = (key) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`
      )
      .join(" ");

  const baseline = (pad.top + innerHeight).toFixed(1);
  const area = (key) =>
    `${line(key)} L${x(points.length - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;

  const grid = [];
  for (let index = 0; index <= gridCount; index += 1) {
    const value = (axisTop / gridCount) * index;
    const yPos = y(value).toFixed(1);
    grid.push(
      `<line class="chart-grid" x1="${pad.left}" y1="${yPos}" x2="${width - pad.right}" y2="${yPos}" />` +
        `<text class="chart-tick" x="${pad.left - 8}" y="${Number(yPos) + 4}" text-anchor="end">${Math.round(value)}</text>`
    );
  }

  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const xLabels = points
    .map((point, index) => {
      if (index % labelEvery !== 0 && index !== points.length - 1) return "";
      return `<text class="chart-tick" x="${x(index).toFixed(1)}" y="${height - 10}" text-anchor="middle">${esc(
        point.label
      )}</text>`;
    })
    .join("");

  const geometry = esc(JSON.stringify({ width, height, pad, axisTop }));
  const payload = esc(JSON.stringify(points));

  return [
    `<svg class="trend-svg" viewBox="0 0 ${width} ${height}" ` +
      `data-geometry="${geometry}" data-series="${payload}" ` +
      `role="img" aria-label="Stock movement trend across the last ${points.length} days" xmlns="http://www.w3.org/2000/svg">`,
    `<path class="trend-area trend-area-in" d="${area("in")}" />`,
    `<path class="trend-area trend-area-out" d="${area("out")}" />`,
    grid.join(""),
    `<path class="trend-line trend-line-in" pathLength="1" d="${line("in")}" />`,
    `<path class="trend-line trend-line-out" pathLength="1" d="${line("out")}" />`,
    xLabels,
    "</svg>",
  ].join("");
};

/**
 * Pie chart for a set of shares — solid wedges starting from the top,
 * separated by a thin white stroke.
 * Each segment: { value, color } — segments of 0 are skipped.
 *
 * Every wedge carries --push-x/--push-y (its own bisector direction) so CSS
 * can pop it out from under the cursor.
 */
export const pieChart = (segments) => {
  const list = Array.isArray(segments) ? segments : [];
  const active = list.filter((segment) => (Number(segment.value) || 0) > 0);
  const total = active.reduce((sum, segment) => sum + (Number(segment.value) || 0), 0);
  if (total <= 0) return "";

  const size = 176;
  const centre = size / 2;
  const radius = centre - 2;
  const svg = (body) =>
    `<svg class="pie-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Stock status breakdown" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  // A single share covers the whole circle; an arc cannot draw that, so use a circle.
  if (active.length === 1) {
    return svg(
      `<circle class="pie-slice" cx="${centre}" cy="${centre}" r="${radius}" fill="${esc(
        active[0].color
      )}" />`
    );
  }

  const pointAt = (angle) => [
    (centre + radius * Math.cos(angle)).toFixed(2),
    (centre + radius * Math.sin(angle)).toFixed(2),
  ];

  let cursor = -Math.PI / 2; // 12 o'clock
  const wedges = active
    .map((segment) => {
      const sweep = ((Number(segment.value) || 0) / total) * Math.PI * 2;
      const [x0, y0] = pointAt(cursor);
      const [x1, y1] = pointAt(cursor + sweep);
      const largeArc = sweep > Math.PI ? 1 : 0;
      const bisector = cursor + sweep / 2;
      cursor += sweep;

      // Distance this wedge travels when hovered: 8 user units outward.
      const pushX = (Math.cos(bisector) * 8).toFixed(1);
      const pushY = (Math.sin(bisector) * 8).toFixed(1);

      return (
        `<path class="pie-slice" style="--push-x:${pushX}px;--push-y:${pushY}px" ` +
        `d="M ${centre} ${centre} L ${x0} ${y0} ` +
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z" ` +
        `fill="${esc(segment.color)}" stroke="#ffffff" stroke-width="2" />`
      );
    })
    .join("");

  return svg(wedges);
};
