// Deterministic pseudo-random based on seed
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const rng = seededRandom(42)

const EMPLOYEES = [
  { id: 'mg', name: 'María González', color: '#1e3a8a' },
  { id: 'cr', name: 'Carlos Rodríguez', color: '#3b82f6' },
  { id: 'am', name: 'Ana Martínez', color: '#0891b2' },
  { id: 'lb', name: 'Luis Benítez', color: '#059669' },
  { id: 'sl', name: 'Sandra López', color: '#d97706' },
]

const CLIENTS = [
  { id: 1, name: 'Agro Norte S.A.', share: 0.22, color: '#1e3a8a' },
  { id: 2, name: 'Cial. San Blas SRL', share: 0.18, color: '#3b82f6' },
  { id: 3, name: 'Constr. Paraná S.A.', share: 0.25, color: '#0891b2' },
  { id: 4, name: 'Import. Guaraní SRL', share: 0.20, color: '#059669' },
  { id: 5, name: 'Servicios del Este', share: 0.15, color: '#d97706' },
]

const EMP_BASE = { mg: 12, cr: 9, am: 14, lb: 11, sl: 13 }

// Generate 90 days of daily data starting 2025-03-01
function generateDays() {
  const days = []
  const start = new Date('2025-03-01')

  for (let i = 0; i < 90; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dow = d.getDay() // 0=Sun
    const isWeekend = dow === 0 || dow === 6
    const dayOfMonth = d.getDate()
    // Month-end/start peak
    const monthPeak = (dayOfMonth >= 28 || dayOfMonth <= 3) ? 1.35 : 1.0
    // Slight growth trend
    const trend = 1 + (i / 90) * 0.18

    const dayData = { date: d.toISOString().slice(0, 10), total: 0 }

    EMPLOYEES.forEach(emp => {
      const base = EMP_BASE[emp.id]
      const weekdayFactor = isWeekend ? 0.08 : (dow === 5 ? 0.72 : 1.0)
      const noise = 0.75 + rng() * 0.5
      const count = Math.round(base * weekdayFactor * monthPeak * trend * noise)
      dayData[emp.id] = count
      dayData.total += count
    })

    // Client distribution (proportional to total with noise)
    CLIENTS.forEach(c => {
      const base = dayData.total * c.share
      const noise = 0.8 + rng() * 0.4
      dayData[`c${c.id}`] = Math.round(base * noise)
    })

    days.push(dayData)
  }
  return days
}

const rawDays = generateDays()

// Aggregate by week
function aggregateWeeks(days) {
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7)
    const agg = { date: slice[0].date, label: `Sem ${Math.floor(i / 7) + 1}`, total: 0 }
    EMPLOYEES.forEach(e => { agg[e.id] = slice.reduce((s, d) => s + (d[e.id] || 0), 0) })
    CLIENTS.forEach(c => { agg[`c${c.id}`] = slice.reduce((s, d) => s + (d[`c${c.id}`] || 0), 0) })
    agg.total = slice.reduce((s, d) => s + d.total, 0)
    weeks.push(agg)
  }
  return weeks
}

// Aggregate by month
function aggregateMonths(days) {
  const byMonth = {}
  days.forEach(d => {
    const key = d.date.slice(0, 7)
    if (!byMonth[key]) {
      byMonth[key] = { date: key, label: key, total: 0 }
      EMPLOYEES.forEach(e => { byMonth[key][e.id] = 0 })
      CLIENTS.forEach(c => { byMonth[key][`c${c.id}`] = 0 })
    }
    byMonth[key].total += d.total
    EMPLOYEES.forEach(e => { byMonth[key][e.id] += d[e.id] || 0 })
    CLIENTS.forEach(c => { byMonth[key][`c${c.id}`] += d[`c${c.id}`] || 0 })
  })
  return Object.values(byMonth).map(m => ({
    ...m,
    label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][Number(m.date.slice(5, 7)) - 1],
  }))
}

// Simple linear forecast: project next 14 days from last 14
function buildForecast(days) {
  const last14 = days.slice(-14)
  const n = last14.length
  const xMean = (n - 1) / 2
  const yMean = last14.reduce((s, d) => s + d.total, 0) / n
  let num = 0, den = 0
  last14.forEach((d, i) => { num += (i - xMean) * (d.total - yMean); den += (i - xMean) ** 2 })
  const slope = num / den
  const intercept = yMean - slope * xMean

  const history = days.slice(-30).map((d, i) => ({
    date: d.date,
    actual: d.total,
    label: d.date.slice(5),
  }))

  // Project 14 future days
  const lastDate = new Date(days[days.length - 1].date)
  const projected = []
  for (let i = 1; i <= 14; i++) {
    const d = new Date(lastDate)
    d.setDate(lastDate.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    const base = Math.round(intercept + slope * (n - 1 + i))
    const adjusted = isWeekend ? Math.round(base * 0.1) : base
    const sigma = Math.round(base * 0.12)
    projected.push({
      date: dateStr,
      label: dateStr.slice(5),
      forecast: Math.max(0, adjusted),
      forecastLow: Math.max(0, adjusted - sigma),
      forecastHigh: adjusted + sigma,
    })
  }

  return { history, projected }
}

// Workload in hours (each doc ~15 min avg processing)
function docsToHours(docs) { return Math.round((docs * 0.25) * 10) / 10 }
function docsToFTE(docs, daysInPeriod) {
  const hoursPerDay = docsToHours(docs) / daysInPeriod
  return Math.round((hoursPerDay / 7) * 100) / 100 // 7h workday
}

export const CHART_COLORS = {
  primary: '#1e3a8a',
  blue: '#3b82f6',
  cyan: '#0891b2',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  slate: '#64748b',
  grid: '#f1f5f9',
  muted: '#94a3b8',
}

export const employees = EMPLOYEES
export const clients = CLIENTS

export function getTimeData(period) {
  if (period === 'dia') return rawDays.slice(-14)
  if (period === 'semana') return aggregateWeeks(rawDays)
  if (period === 'mes') return aggregateMonths(rawDays)
  if (period === 'año') return aggregateMonths(rawDays) // same, would have more data in prod
  return rawDays.slice(-14)
}

export function getEmployeeStats(period) {
  const data = getTimeData(period)
  const totalPeriod = data.reduce((s, d) => s + d.total, 0)
  const prevData = period === 'dia' ? rawDays.slice(-28, -14) : rawDays.slice(0, rawDays.length / 2)
  const prevTotal = prevData.reduce((s, d) => s + d.total, 0)
  const prevPerEmp = {}
  EMPLOYEES.forEach(e => { prevPerEmp[e.id] = prevData.reduce((s, d) => s + (d[e.id] || 0), 0) })

  return EMPLOYEES.map(emp => {
    const total = data.reduce((s, d) => s + (d[emp.id] || 0), 0)
    const prev = prevPerEmp[emp.id] || 1
    const pct = Math.round(((total - prev) / prev) * 100)
    const share = Math.round((total / totalPeriod) * 100)
    const daily = data.map(d => d[emp.id] || 0)
    return { ...emp, total, pct, share, daily, hours: docsToHours(total) }
  }).sort((a, b) => b.total - a.total)
}

export function getClientStats(period) {
  const data = getTimeData(period)
  return CLIENTS.map(c => {
    const total = data.reduce((s, d) => s + (d[`c${c.id}`] || 0), 0)
    const daily = data.map(d => d[`c${c.id}`] || 0)
    return { ...c, total, daily }
  }).sort((a, b) => b.total - a.total)
}

export function getForecast() {
  return buildForecast(rawDays)
}

export function getSummaryKPIs(period) {
  const data = getTimeData(period)
  const total = data.reduce((s, d) => s + d.total, 0)
  const days = period === 'dia' ? 14 : period === 'semana' ? 91 : 91

  // Previous period for comparison
  const prev = period === 'dia'
    ? rawDays.slice(-28, -14).reduce((s, d) => s + d.total, 0)
    : rawDays.slice(0, 45).reduce((s, d) => s + d.total, 0)

  const delta = Math.round(((total - prev) / prev) * 100)
  const avgDay = Math.round(total / data.length)
  const peakDay = Math.max(...data.map(d => d.total))
  const peakDate = data.find(d => d.total === peakDay)?.date || ''
  const hours = docsToHours(total)
  const fte = docsToFTE(total, data.length)

  // Docs by channel (mock split)
  const channels = [
    { name: 'WhatsApp', value: Math.round(total * 0.28), color: CHART_COLORS.green },
    { name: 'Email', value: Math.round(total * 0.32), color: CHART_COLORS.primary },
    { name: 'Drive', value: Math.round(total * 0.22), color: CHART_COLORS.blue },
    { name: 'Físico', value: Math.round(total * 0.11), color: CHART_COLORS.amber },
    { name: 'Sistema', value: Math.round(total * 0.07), color: CHART_COLORS.slate },
  ]

  return { total, delta, avgDay, peakDay, peakDate, hours, fte, channels }
}

export function getActivityHeatmap() {
  const weeks = 12
  const grid = []
  for (let w = 0; w < weeks; w++) {
    const row = []
    for (let d = 0; d < 7; d++) {
      const idx = (weeks - 1 - w) * 7 + d
      row.push(rawDays[idx]?.total || 0)
    }
    grid.push(row)
  }
  return grid
}

export function getWeekdayPattern() {
  const totals = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  rawDays.forEach(d => {
    const dow = new Date(d.date).getDay()
    totals[dow] += d.total
    counts[dow]++
  })
  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return labels.map((label, i) => ({
    label,
    avg: Math.round(totals[i] / (counts[i] || 1)),
    isWeekday: i > 0 && i < 6,
  }))
}
