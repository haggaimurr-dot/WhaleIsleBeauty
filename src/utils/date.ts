import type { DateStr, TimeStr, Timestamp } from '../api/types'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** iOS 不支持 new Date('YYYY-MM-DD HH:mm')，统一用这个解析 */
export function parse(date: DateStr, time: TimeStr = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}

export const todayStr = () => toDateStr(new Date())
export const nowTimeStr = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const toTimestamp = (d: Date): Timestamp => d.toISOString()

function datesFrom(offset: number, n: number): DateStr[] {
  const t = new Date()
  return Array.from({ length: n }, (_, i) => toDateStr(new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset + i)))
}

/** 从明天开始的 n 天（客人可预约的日期） */
export const upcomingDates = (n: number) => datesFrom(1, n)

/** 从今天开始的 n 天（店主排班） */
export const datesFromToday = (n: number) => datesFrom(0, n)

/** '9月30日 周三' */
export function formatDateCN(date: DateStr): string {
  const d = parse(date)
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`
}

/** '8月16日'，用于历史记录 */
export function formatMonthDay(date: DateStr): string {
  const d = parse(date)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 日期条上的短标签：'今天'、'明天' 或 '周三' */
export function dayLabel(date: DateStr): string {
  if (date === todayStr()) return '今天'
  return date === upcomingDates(1)[0] ? '明天' : `周${WEEK[parse(date).getDay()]}`
}

/** ISO 时间戳 → 本地 'HH:mm'，用于付款截止时间 */
export function formatClock(ts: Timestamp): TimeStr {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** '09:00' + 90 → '10:30'，用于显示时间段 */
export function addMinutes(time: TimeStr, min: number): TimeStr {
  const [h, m] = time.split(':').map(Number)
  const t = h * 60 + m + min
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`
}

export const dayOfMonth = (date: DateStr) => parse(date).getDate()

export function hoursUntil(date: DateStr, time: TimeStr): number {
  return (parse(date, time).getTime() - Date.now()) / 3_600_000
}

/** 视频时长、播放位置：'4:05'，一小时以上 '1:02:05' */
export function formatPlayTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

/** 课程总时长：'约 20 分钟'，不到 1 分钟按 1 分钟算 */
export const formatCourseMinutes = (sec: number) => `约 ${Math.max(1, Math.round(sec / 60))} 分钟`

/** 'YYYY-MM' → '9 月'，不是今年的带上年份：'2025 年 12 月' */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return y === new Date().getFullYear() ? `${m} 月` : `${y} 年 ${m} 月`
}
