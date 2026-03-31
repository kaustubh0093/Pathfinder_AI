import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
)

/**
 * Extract embedded chart JSON from LLM markdown output.
 * The LLM wraps chart data in HTML comment markers: <!-- CHART_DATA { ... } -->
 */
export function extractChartData(markdown) {
  const regex = /<!--\s*CHART_DATA\s*([\s\S]*?)\s*-->/
  const match = markdown.match(regex)
  if (match) {
    try {
      return JSON.parse(match[1].trim())
    } catch {
      return null
    }
  }
  return null
}

/**
 * Walk `text` starting at the '{' at index `start` and return the index
 * one past the matching '}'. Returns -1 if the object is unterminated.
 */
function _jsonSpan(text, start) {
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (esc) { esc = false; continue }
    if (c === '\\' && inStr) { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i + 1 }
  }
  return -1
}

/**
 * Remove all bare JSON objects from `markdown` that contain `requiredKey`
 * as a top-level key (optional extra validator function).
 */
function _removeBareJson(markdown, requiredKey, validator) {
  let out = markdown
  let changed = true
  while (changed) {
    changed = false
    let i = 0
    while (i < out.length) {
      if (out[i] !== '{') { i++; continue }
      const end = _jsonSpan(out, i)
      if (end === -1) { i++; continue }
      try {
        const obj = JSON.parse(out.slice(i, end))
        if (requiredKey in obj && (!validator || validator(obj))) {
          out = out.slice(0, i) + out.slice(end)
          changed = true
          break
        }
      } catch {}
      i++
    }
  }
  return out
}

/**
 * Strip all data comment/code blocks from markdown before rendering.
 * Handles HTML comment format, labelled code-block format, and bare JSON.
 */
export function stripChartComment(markdown) {
  let out = markdown
  // HTML comment blocks
  out = out.replace(/<!--\s*CHART_DATA[\s\S]*?-->/g, '')
  out = out.replace(/<!--\s*INSIGHTS_DATA[\s\S]*?-->/g, '')
  // Labelled code blocks (LLM fallback format)
  out = out.replace(/\*{0,2}INSIGHTS_DATA\*{0,2}[^\n]*\n```(?:json)?\n[\s\S]*?\n```/g, '')
  out = out.replace(/\*{0,2}(?:Updated\s+)?(?:\w+\s+)?Chart\s+Data\*{0,2}[^\n]*\n```(?:json)?\n[\s\S]*?\n```/gi, '')
  // Stray JSON code blocks that begin with known data keys
  out = out.replace(/```(?:json)?\s*\n?\s*\{\s*"(?:skills|salary|roadmap|careerLadder|type)[\s\S]*?\n?```/g, '')
  // Bare JSON objects emitted without any wrapper (LLM ignoring the comment format)
  out = _removeBareJson(out, 'skills', null)
  out = _removeBareJson(out, 'type', obj => obj.type === 'radar' || obj.type === 'bar')
  out = _removeBareJson(out, 'salary', null)
  return out.trim()
}

/** Shared Chart.js options — Pathfinder AI cyan/teal theme */
export const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: 'rgba(193,198,215,0.7)', font: { size: 12 } },
    },
    tooltip: {
      backgroundColor: 'rgba(12,14,16,0.95)',
      titleColor: '#e2e2e5',
      bodyColor: 'rgba(193,198,215,0.8)',
      borderColor: 'rgba(92,215,229,0.3)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      grid: { color: 'rgba(65,71,84,0.2)' },
      ticks: { color: 'rgba(193,198,215,0.6)' },
    },
    y: {
      grid: { color: 'rgba(65,71,84,0.2)' },
      ticks: { color: 'rgba(193,198,215,0.6)' },
    },
  },
}

export const radarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: 'rgba(193,198,215,0.7)', font: { size: 12 } },
    },
    tooltip: {
      backgroundColor: 'rgba(12,14,16,0.95)',
      titleColor: '#e2e2e5',
      bodyColor: 'rgba(193,198,215,0.8)',
      borderColor: 'rgba(92,215,229,0.3)',
      borderWidth: 1,
    },
  },
  scales: {
    r: {
      min: 0,
      max: 100,
      grid: { color: 'rgba(92,215,229,0.08)' },
      angleLines: { color: 'rgba(92,215,229,0.08)' },
      pointLabels: { color: 'rgba(193,198,215,0.6)', font: { size: 11 } },
      ticks: { color: 'rgba(193,198,215,0.4)', backdropColor: 'transparent', stepSize: 20 },
    },
  },
}

export function buildBarDataset(chartData) {
  return {
    labels: chartData.labels,
    datasets: [
      {
        label: chartData.label || chartData.unit || 'Value',
        data: chartData.data,
        backgroundColor: [
          'rgba(92,215,229,0.55)',
          'rgba(0,223,193,0.55)',
          'rgba(0,160,173,0.55)',
          'rgba(172,201,237,0.55)',
          'rgba(92,215,229,0.35)',
          'rgba(0,223,193,0.35)',
        ],
        borderColor: ['#5cd7e5', '#00dfc1', '#00a0ad', '#acc9ed', '#5cd7e5', '#00dfc1'],
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }
}

export function buildRadarDataset(chartData) {
  return {
    labels: chartData.labels,
    datasets: [
      {
        label: chartData.label,
        data: chartData.data,
        backgroundColor: 'rgba(92,215,229,0.12)',
        borderColor: '#5cd7e5',
        pointBackgroundColor: '#5cd7e5',
        pointBorderColor: '#0c0e10',
        pointHoverBackgroundColor: '#00dfc1',
        pointHoverBorderColor: '#5cd7e5',
        borderWidth: 2,
      },
    ],
  }
}
