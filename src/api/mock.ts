/**
 * 内存 mock 实现。行为尽量贴近真实后端：有网络延迟、有状态流转、有冲突校验。
 * 页面不要直接 import 这个文件，统一从 '@/api' 获取。
 */
import type { Api } from './contract'
import {
  ApiError, type Artist, type Booking, type BookingStatus, type CreateBookingReq,
  type DateStr, type DaySchedule, type ID, type Me, type OwnerBookingBrief, type OwnerNoticeKind,
  type ScheduleCell, type Service, type Shop, type SkinProfile, type SkinType, type SlotView,
  type TimeStr, type UpdateSkinProfileReq, type Work, type WorkInput, type Occasion, type MonthStats, TONE_LABEL,
  type Product, type ProductCategory, PRODUCT_CATEGORY_LABEL,
  type Course, type CourseInput, type CourseProgress, type CourseSummary, type CourseTeacher, type Lesson,
  type Payout, type ShareRecord, type Teacher, TEACHER_AGREEMENT_VERSION,
} from './types'
import {
  cleanArtist, cleanCourse, cleanProduct, cleanService, cleanShop, cleanTeacher, cleanWork,
  validateArtist, validateCourse, validateProduct, validateService, validateShop, validateTeacher, validateWork, LIMITS,
} from './catalog'
import { upcomingDates, datesFromToday, toTimestamp, hoursUntil, todayStr, nowTimeStr, parse, toDateStr } from '../utils/date'

// ---------- 种子数据 ----------

const TIMES: TimeStr[] = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30']

const artists: Artist[] = [
  { id: 'a1', name: '小鲸', title: '主理人', years: 8, avatar: 'placeholder:g1' },
  { id: 'a2', name: '安安', years: 6, specialty: '擅长新娘', avatar: 'placeholder:g4' },
  { id: 'a3', name: '七七', years: 4, specialty: '擅长日常', avatar: 'placeholder:g3' },
]

const services: Service[] = [
  {
    id: 's1', name: '韩式上镜妆（含发型）', summary: '适合拍照、证件照', category: 'camera',
    durationMin: 90, price: 29800, deposit: 5000,
    includes: ['妆前护肤和底妆', '眼妆、修容、唇妆', '简单盘发或卷发', '假睫毛可选，不另收费'],
    tags: ['拍照不假面', '氧气感底妆', '含简单盘发'],
    cover: 'placeholder:g2', images: ['placeholder:g2', 'placeholder:g6', 'placeholder:g4'], bookedCount: 128,
  },
  {
    id: 's2', name: '日常约会妆', summary: '可教你日常怎么画', category: 'date',
    durationMin: 60, price: 16800, deposit: 3000,
    includes: ['妆前护肤和底妆', '眼妆和唇妆', '化妆师讲解日常画法'],
    tags: ['近看也干净', '可学可带走'],
    cover: 'placeholder:g4', images: ['placeholder:g4', 'placeholder:g2'], bookedCount: 96,
  },
  {
    id: 's3', name: '新娘跟妆', summary: '需提前沟通，含试妆一次', category: 'bridal',
    durationMin: 180, price: 128000, priceFrom: true, deposit: 30000,
    includes: ['试妆一次', '婚礼当天早妆', '全天跟妆补妆', '造型更换两次'],
    tags: ['持妆一整天', '含试妆'],
    cover: 'placeholder:g3', images: ['placeholder:g3', 'placeholder:g1'], bookedCount: 41,
  },
  {
    id: 's4', name: '主持/年会妆', summary: '适合舞台灯光', category: 'host',
    durationMin: 90, price: 23800, deposit: 5000,
    includes: ['舞台底妆', '立体修容', '眼妆和唇妆', '简单发型'],
    tags: ['舞台灯光下', '上镜不反光'],
    cover: 'placeholder:g5', images: ['placeholder:g5'], bookedCount: 57,
  },
]

const works: Work[] = [
  { id: 'w1', title: '氧气上镜妆', category: 'camera', artistId: 'a1', serviceId: 's1', image: 'placeholder:g2', ratio: 1.25, durationText: '约 90 分钟' },
  { id: 'w2', title: '清透约会妆', category: 'date', artistId: 'a3', serviceId: 's2', image: 'placeholder:g4', ratio: 1.5, durationText: '约 60 分钟' },
  { id: 'w3', title: '中式新娘妆', category: 'bridal', artistId: 'a2', serviceId: 's3', image: 'placeholder:g3', ratio: 1.6, durationText: '需提前沟通' },
  { id: 'w4', title: '年会主持妆', category: 'host', artistId: 'a1', serviceId: 's4', image: 'placeholder:g5', ratio: 1.3, durationText: '约 90 分钟' },
  { id: 'w5', title: '毕业照妆', category: 'camera', artistId: 'a3', serviceId: 's1', image: 'placeholder:g6', ratio: 1.45, durationText: '约 75 分钟' },
  { id: 'w6', title: '韩式新娘妆', category: 'bridal', artistId: 'a2', serviceId: 's3', image: 'placeholder:g1', ratio: 1.25, durationText: '需提前沟通' },
  { id: 'w7', title: '面试淡妆', category: 'date', artistId: 'a3', serviceId: 's2', image: 'placeholder:g2', ratio: 1.4, durationText: '约 45 分钟' },
  { id: 'w8', title: '证件照妆', category: 'camera', artistId: 'a1', serviceId: 's1', image: 'placeholder:g4', ratio: 1.2, durationText: '约 60 分钟' },
]

/** 演示用的清单，店主在小程序里改。按加的先后存，读的时候再按类别排 */
const products: Product[] = [
  { id: 'p1', category: 'prep', brand: '雅漾', name: '舒泉调理喷雾', note: '敏感肌可用' },
  { id: 'p2', category: 'prep', brand: '理肤泉', name: 'B5 修复霜', note: '干皮上妆前先用它保湿' },
  { id: 'p3', category: 'base', brand: '雅诗兰黛', name: 'DW 持妆粉底液', note: '持妆久，新娘和主持妆用' },
  { id: 'p4', category: 'base', brand: 'NARS', name: '超方瓶粉底液', note: '轻薄，上镜和日常妆用' },
  { id: 'p5', category: 'base', brand: 'Laura Mercier', name: '柔光透明散粉', note: '定妆' },
  { id: 'p6', category: 'eye', brand: '植村秀', name: '砍刀眉笔' },
  { id: 'p7', category: 'eye', brand: '3CE', name: '九色眼影盘' },
  { id: 'p8', category: 'eye', brand: 'KISSME', name: '纤长睫毛膏', note: '防水，哭了也不晕' },
  { id: 'p9', category: 'lip', brand: 'MAC', name: '子弹头口红', note: '每位客人用一次性唇刷取用' },
  { id: 'p10', category: 'lip', brand: 'NARS', name: '腮红' },
  { id: 'p11', category: 'remover', brand: '贝德玛', name: '舒妍卸妆水', note: '无酒精，敏感肌可用' },
]

const PRODUCT_ORDER = Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]

/** 按类别顺序排，同类里先加的在前（sort 是稳定的） */
const sortedProducts = () =>
  [...products].sort((a, b) => PRODUCT_ORDER.indexOf(a.category) - PRODUCT_ORDER.indexOf(b.category))

/** 地址取自原型；电话和坐标是演示用的假数据 */
let shop: Shop = {
  name: '鲸屿美妆', address: '蓝山CBD 3329', phone: '020-0000-0000', openHours: '09:00–21:00',
  latitude: 23.1291, longitude: 113.2644,
}

/** 演示时同一个人既是客人也是店主，方便一台手机走完整流程。改成 'customer' 可隐藏店主入口 */
const me: Me = { id: 'u1', nickname: '阿柚', avatar: 'placeholder:g4', role: 'owner', visitCount: 0 }

/** 原型里“敏感肌 · 冷白皮”、排班里“对酒精过敏”都来自这份档案 */
let skinProfile: SkinProfile = {
  skinType: 'sensitive', tone: 'cool_fair', allergies: '对酒精过敏', updatedAt: '2026-08-16T08:00:00+08:00',
}

/** 摘要里的叫法和日常说法一致，“不确定”不写进摘要 */
const SKIN_SUMMARY: Partial<Record<SkinType, string>> = {
  dry: '干皮', oily: '油皮', combination: '混合皮', sensitive: '敏感肌',
}

const hasProfile = (p: SkinProfile) => !!(p.skinType || p.tone || p.allergies || p.note)

/** 例如“敏感肌 · 冷白皮”；只填了文字说明时写“已填写” */
function skinSummary(p: SkinProfile): string | undefined {
  const parts = [p.skinType && SKIN_SUMMARY[p.skinType], p.tone && p.tone !== 'unsure' && TONE_LABEL[p.tone]].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return hasProfile(p) ? '已填写' : undefined
}

const OTHER_NAMES = ['林小姐', '陈小姐', '周小姐', '许小姐', '黄小姐', '吴小姐', '郑小姐', '何小姐']
const OTHER_SERVICES = ['上镜妆', '约会妆', '新娘试妆', '主持妆', '面试妆']
/** 和 OTHER_SERVICES 一一对应的定金，经营统计用 */
const OTHER_DEPOSITS = [5000, 3000, 30000, 5000, 3000]
const OTHER_OCCASIONS: Occasion[] = ['photo', 'date', 'event', 'interview']
const ACTIVE: BookingStatus[] = ['pending_payment', 'pending_confirm', 'confirmed']
const PAY_WINDOW_MS = 15 * 60 * 1000

// ---------- 工具 ----------

const delay = (ms = 250 + Math.random() * 250) => new Promise(r => setTimeout(r, ms))
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const slotKey = (artistId: ID, date: DateStr, time: TimeStr) => `${artistId}|${date}|${time}`

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 模拟“其他客人”已约走的时段：结果稳定，约 30% */
function takenByOthers(artistId: ID, date: DateStr, time: TimeStr) {
  return hash(slotKey(artistId, date, time)) % 10 < 3
}

function getOrThrow<T extends { id: ID }>(list: T[], id: ID): T {
  const item = list.find(x => x.id === id)
  if (!item) throw new ApiError('NOT_FOUND', '没有找到这条信息')
  return item
}

function artistName(id: ID) { return getOrThrow(artists, id).name }

// ---------- 可变状态 ----------

const bookings: Booking[] = (
  [
    ['s3', 'a2', '中式新娘试妆', '2026-08-16'],
    ['s2', 'a3', '日常约会妆', '2026-07-02'],
    ['s1', 'a1', '韩式上镜妆', '2026-05-20'],
  ] as const
).map(([serviceId, artistId, serviceName, date], i): Booking => ({
  id: `b${i + 1}`, serviceId, artistId, serviceName, artistName: artistName(artistId),
  date, time: '13:30', durationMin: 90, price: 29800, deposit: 5000,
  status: 'completed', createdAt: `${date}T08:00:00+08:00`, canCancel: false,
}))
const blocks = new Set<string>()
/** 付过定金的预约。Booking 上没有这个字段，经营统计要用：没付就取消的不算 */
const paidIds = new Set<ID>(bookings.map(b => b.id))
/** 付过定金后取消的预约：发起退款的时间（毫秒） */
const refunds = new Map<ID, number>()
/** 假退款多久到账。真实的微信零钱一般几分钟，演示时能看到“退款中”就行 */
const REFUND_MS = 2 * 60 * 1000
let seq = 100

/**
 * 模拟后端的定时任务：
 * - 超过付款截止时间的 pending_payment 自动取消，释放时段
 * - 到了开始时间还没确认的 pending_confirm 自动取消，定金原路退回
 * - 已确认的过了结束时间算完成
 */
function autoCancel() {
  const now = Date.now()
  for (const b of bookings) {
    if (b.status === 'pending_payment' && b.payDeadline && Date.parse(b.payDeadline) <= now) {
      b.status = 'cancelled'
      b.cancelReason = 'pay_timeout'
      delete b.payDeadline
    } else if (b.status === 'pending_confirm' && isPast(b.date, b.time)) {
      b.status = 'cancelled'
      b.cancelReason = 'not_confirmed'
      // 后端的定时任务在开始时间就会取消，退款也从那时算
      refund(b, Math.min(now, parse(b.date, b.time).getTime()))
    } else if (b.status === 'confirmed' && parse(b.date, b.time).getTime() + b.durationMin * 60_000 <= now) {
      b.status = 'completed'
    }
  }
}

/** 付过定金的原路退回，没付过的不用退 */
function refund(b: Booking, at = Date.now()) {
  if (paidIds.has(b.id) && !refunds.has(b.id)) refunds.set(b.id, at)
}

function getBookingOrThrow(id: ID) {
  autoCancel()
  return getOrThrow(bookings, id)
}

function payParams(b: Booking) {
  return {
    timeStamp: String(Math.floor(Date.now() / 1000)), nonceStr: 'mock',
    package: `prepay_id=mock_${b.id}`, signType: 'RSA' as const, paySign: 'mock',
  }
}

function findActive(artistId: ID, date: DateStr, time: TimeStr) {
  autoCancel()
  return bookings.find(b => b.artistId === artistId && b.date === date && b.time === time && ACTIVE.includes(b.status))
}

function isPast(date: DateStr, time: TimeStr) {
  return date < todayStr() || (date === todayStr() && time <= nowTimeStr())
}

/** 排班格子里的预约：进行中的优先，其次是已经完成的、标记了没来的 */
function scheduledAt(artistId: ID, date: DateStr, time: TimeStr) {
  const here = bookings.filter(b => b.artistId === artistId && b.date === date && b.time === time)
  return findActive(artistId, date, time)
    ?? here.find(b => b.status === 'completed')
    ?? here.find(b => b.cancelReason === 'no_show')
}

/** 店主能不能替客人改期、取消：还在进行中，而且没开始 */
const ownerCanChange = (b: Booking) => ACTIVE.includes(b.status) && !isPast(b.date, b.time)

/** 店主能不能标记没来：已确认或已完成，开始时间过了，还是预约当天 */
const canMarkNoShow = (b: Booking) =>
  (b.status === 'confirmed' || b.status === 'completed') && isPast(b.date, b.time) && b.date === todayStr()

function isAvailable(artistId: ID, date: DateStr, time: TimeStr, ignoreBookingId?: ID) {
  const active = findActive(artistId, date, time)
  return !isPast(date, time)
    && !takenByOthers(artistId, date, time)
    && !blocks.has(slotKey(artistId, date, time))
    && (!active || active.id === ignoreBookingId)
}

function out(b: Booking): Booking {
  const c = clone(b)
  c.canCancel = c.status === 'pending_payment' || (ACTIVE.includes(c.status) && hoursUntil(c.date, c.time) >= 24)
  const at = refunds.get(c.id)
  if (at !== undefined) {
    const done = at + REFUND_MS <= Date.now()
    c.refund = {
      amount: c.deposit, status: done ? 'succeeded' : 'processing', createdAt: toTimestamp(new Date(at)),
      ...(done && { succeededAt: toTimestamp(new Date(at + REFUND_MS)) }),
    }
  }
  return c
}

/** visitCount 按契约由预约记录算出：completed 的条数 */
function outMe(): Me {
  return {
    ...clone(me),
    visitCount: bookings.filter(b => b.status === 'completed').length,
    skinProfile: skinSummary(skinProfile),
  }
}

/** 合并这次预约和客人档案里需要化妆师提前知道的 */
function ownerAlert(bookingSkin?: SkinType, bookingNote?: string) {
  const sensitive = bookingSkin === 'sensitive' || skinProfile.skinType === 'sensitive'
  const allergies = skinProfile.allergies
  const note = [bookingNote, allergies && `过敏：${allergies}`].filter(Boolean).join('；')
  return {
    alert: sensitive ? '敏感肌' : allergies ? '有过敏' : undefined,
    note: note || undefined,
  }
}

function requireOwner() {
  if (me.role !== 'owner') throw new ApiError('FORBIDDEN', '只有店主可以进行这个操作')
}

// ---------- 通知店主 ----------

/** 店主还能收到几条提醒。mock 只有一位店主 */
let ownerQuota = 0
const ownerNoticeLog: { kind: OwnerNoticeKind, bookingId: ID }[] = []

/** 和后端一样：有额度才“发”，发一条减一 */
function notifyOwner(kind: OwnerNoticeKind, b: Booking) {
  if (ownerQuota <= 0) return
  ownerQuota--
  ownerNoticeLog.push({ kind, bookingId: b.id })
}

/** mock 专用：已经“发”给店主的提醒，测试用 */
export const __ownerNotices = () => ownerNoticeLog.map(n => ({ ...n }))

// ---------- 经营统计 ----------

const STATS_MONTHS = 6
/** 模拟的其他客人从这天开始有记录（门店开业），回头客从这里算起 */
const OTHERS_SINCE: DateStr = '2026-03-01'

/** 统计用的一条预约：只有付过定金的 */
interface StatRecord { customer: ID, date: DateStr, time: TimeStr, cancelled: boolean, noShow: boolean, completed: boolean, deposit: number }

/** 'YYYY-MM' 往前 n 个月 */
function monthBefore(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return toDateStr(d).slice(0, 7)
}

/**
 * 排班里“其他客人”占着的格子（takenByOthers）当作付过定金的预约：过了开始时间算完成，没过算已确认。
 * 另外少量没被占的格子当作付过定金后取消的。结果稳定，和排班看到的一致
 */
function otherRecords(until: DateStr): StatRecord[] {
  const out: StatRecord[] = []
  for (let d = parse(OTHERS_SINCE); toDateStr(d) <= until; d.setDate(d.getDate() + 1)) {
    const date = toDateStr(d)
    for (const a of artists) {
      for (const time of TIMES) {
        const h = hash(slotKey(a.id, date, time))
        const taken = takenByOthers(a.id, date, time)
        if (!taken && hash(slotKey(a.id, date, time) + '|cancel') % 25) continue
        out.push({
          customer: `other-${hash(slotKey(a.id, date, time) + '|who') % 1500}`, date, time, cancelled: !taken,
          // 已经过去的取消里，少数是客人没来
          noShow: !taken && isPast(date, time) && hash(slotKey(a.id, date, time) + '|noshow') % 4 === 0,
          completed: taken && isPast(date, time), deposit: OTHER_DEPOSITS[h % OTHER_DEPOSITS.length],
        })
      }
    }
  }
  return out
}

function myRecords(): StatRecord[] {
  autoCancel()
  return bookings
    .filter(b => paidIds.has(b.id) && b.status !== 'pending_payment')
    .map(b => ({
      customer: me.id, date: b.date, time: b.time, cancelled: b.status === 'cancelled',
      noShow: b.cancelReason === 'no_show', completed: b.status === 'completed', deposit: b.deposit,
    }))
}

function monthStats(): MonthStats[] {
  const thisMonth = todayStr().slice(0, 7)
  const months = Array.from({ length: STATS_MONTHS }, (_, i) => monthBefore(thisMonth, i))
  const records = [...otherRecords(`${thisMonth}-31`), ...myRecords()]
  // 每位客人第一次到店完成的日期
  const firstVisit = new Map<ID, DateStr>()
  for (const r of records) {
    const f = firstVisit.get(r.customer)
    if (r.completed && (!f || r.date < f)) firstVisit.set(r.customer, r.date)
  }
  return months.map(month => {
    const s: MonthStats = { month, bookings: 0, cancelled: 0, noShow: 0, deposit: 0, customers: 0, returning: 0 }
    // 这个月每位客人最后一次预约的日期
    const last = new Map<ID, DateStr>()
    for (const r of records) {
      if (r.date.slice(0, 7) !== month) continue
      if (r.cancelled) {
        s.cancelled++
        if (r.noShow) s.noShow++
        continue
      }
      s.bookings++
      s.deposit += r.deposit
      if ((last.get(r.customer) ?? '') < r.date) last.set(r.customer, r.date)
    }
    s.customers = last.size
    for (const [c, date] of last) {
      const f = firstVisit.get(c)
      if (f && f < date) s.returning++
    }
    return s
  })
}

// ---------- 课堂 ----------

/** 顾客讲师；userId 是 TA 的用户，不出现在返回里 */
interface TeacherRec extends Teacher { userId?: ID }

const teachers: TeacherRec[] = [
  {
    id: 't1', name: '林小姐', avatar: 'placeholder:g6', intro: '常来的客人，单眼皮', shareRate: 20, status: 'active',
    userId: 'u-lin', agreedAt: '2026-07-01T10:00:00+08:00', agreementVersion: TEACHER_AGREEMENT_VERSION,
  },
  // 演示用的邀请：打开这个邀请码，可以走一遍客人确认授权
  { id: 't2', name: '小周', avatar: 'placeholder:g5', intro: '新娘妆客人', shareRate: 15, status: 'invited', inviteCode: 'DEMO2026' },
]

interface CourseRec extends Omit<CourseInput, 'chapters'> {
  id: ID
  chapters: { title: string, lessons: Lesson[] }[]
}

const lesson = (id: ID, title: string, durationSec: number, productIds: ID[] = [], video = 'placeholder:v1'): Lesson =>
  ({ id, title, video, durationSec, productIds })

/** 新的在前 */
const courses: CourseRec[] = [
  {
    id: 'c3', title: '单眼皮的眼妆', summary: '眼睛一睁开眼影就没了？换个画法就好', category: 'date', cover: 'placeholder:g3',
    teacherId: 't1', serviceId: 's2',
    chapters: [{
      title: '眼妆',
      lessons: [
        lesson('l8', '先看自己的眼型', 200, [], 'placeholder:v3'),
        lesson('l9', '眼影画在哪', 480, ['p7'], 'placeholder:v3'),
        lesson('l10', '睫毛刷了不晕', 260, ['p8'], 'placeholder:v3'),
      ],
    }],
    products: [{ productId: 'p7', tip: '用最浅的两格，睁眼能看到的地方才画' }, { productId: 'p8' }],
  },
  {
    id: 'c2', title: '上镜底妆不假面', summary: '拍照灯光下也自然的底妆，证件照不用愁', category: 'camera', cover: 'placeholder:g2',
    artistId: 'a1', serviceId: 's1',
    chapters: [{
      title: '底妆',
      lessons: [
        lesson('l5', '先看清自己的肤质', 300, [], 'placeholder:v2'),
        lesson('l6', '粉底怎么推开', 540, ['p3', 'p4'], 'placeholder:v2'),
        lesson('l7', '定妆不卡粉', 300, ['p5'], 'placeholder:v2'),
      ],
    }],
    products: [{ productId: 'p3', tip: '要持妆一整天的时候用' }, { productId: 'p4', tip: '日常和拍照用它，更轻薄' }, { productId: 'p5' }],
  },
  {
    id: 'c1', title: '五分钟通勤妆', summary: '赶时间也来得及的日常妆，跟着画一遍就会', category: 'date', cover: 'placeholder:g4',
    artistId: 'a3', serviceId: 's2',
    chapters: [
      { title: '准备', lessons: [lesson('l1', '妆前护肤怎么做', 240, ['p1', 'p2'])] },
      {
        title: '上妆',
        lessons: [
          lesson('l2', '底妆只用一支', 420, ['p4', 'p5']),
          lesson('l3', '眉毛和睫毛', 360, ['p6', 'p8']),
          lesson('l4', '唇颊一支搞定', 180, ['p9', 'p10']),
        ],
      },
    ],
    products: [
      { productId: 'p1', tip: '先喷一层，等它吸收' }, { productId: 'p2', tip: '干皮多抹一点' },
      { productId: 'p4', tip: '挤一颗黄豆大就够' }, { productId: 'p5' }, { productId: 'p6' }, { productId: 'p8' },
      { productId: 'p9', tip: '也可以点在脸颊当腮红' }, { productId: 'p10' },
    ],
  },
]

/** 我（mock 只有一位客人）在每门课上的进度 */
const progress = new Map<ID, CourseProgress>()

/** 预约是从哪门课来的；讲师是顾客讲师、而且能分成时带 teacherId 和下单时的比例 */
const bookingCourse = new Map<ID, { courseTitle: string, teacherId?: ID, rate?: number }>()

/** 演示用：其他客人从林小姐的课来、已经到店完成的单 */
const seedShares: (ShareRecord & { teacherId: ID })[] = (
  [
    ['x1', '2026-08-09', '日常约会妆', 16800],
    ['x2', '2026-08-23', '韩式上镜妆（含发型）', 29800],
    ['x3', '2026-09-12', '日常约会妆', 16800],
    ['x4', '2026-09-20', '日常约会妆', 16800],
  ] as const
).map(([bookingId, date, serviceName, price]) => ({
  teacherId: 't1', bookingId, date, serviceName, courseTitle: '单眼皮的眼妆', price, rate: 20, amount: Math.floor(price * 20 / 100),
}))

/** 标记了已付的：金额和明细定格。key 是 teacherId|month */
const paidPayouts = new Map<string, Payout>()

function lessonsOf(c: CourseRec) { return c.chapters.flatMap(ch => ch.lessons) }

function courseTeacher(c: CourseRec): CourseTeacher {
  if (c.artistId) {
    const a = getOrThrow(artists, c.artistId)
    return { kind: 'artist', name: a.name, avatar: a.avatar, intro: [a.title ?? a.specialty, `${a.years} 年`].filter(Boolean).join(' · ') }
  }
  const t = getOrThrow(teachers, c.teacherId as ID)
  return { kind: 'customer', name: t.name, avatar: t.avatar, ...(t.intro && { intro: t.intro }) }
}

function courseSummary(c: CourseRec): CourseSummary {
  const lessons = lessonsOf(c)
  return {
    id: c.id, title: c.title, summary: c.summary, category: c.category, cover: c.cover, teacher: courseTeacher(c),
    lessonCount: lessons.length, durationSec: lessons.reduce((n, l) => n + l.durationSec, 0),
    ...(c.hidden && { hidden: true }),
  }
}

function courseDetail(c: CourseRec, forOwner: boolean): Course {
  const d: Course = {
    ...courseSummary(c),
    chapters: clone(c.chapters),
    products: c.products.flatMap(p => {
      const product = products.find(x => x.id === p.productId)
      return product ? [{ ...clone(product), ...(p.tip && { tip: p.tip }) }] : []
    }),
  }
  if (c.artistId) d.artistId = c.artistId
  if (c.teacherId) d.teacherId = c.teacherId
  // 和作品一样：项目下架了客人那边就不预选
  if (c.serviceId && (forOwner || !services.find(s => s.id === c.serviceId)?.hidden)) d.serviceId = c.serviceId
  const p = progress.get(c.id)
  if (!forOwner && p) d.progress = clone(p)
  return d
}

function visibleCourse(id: ID) {
  const c = courses.find(x => x.id === id && !x.hidden)
  if (!c) throw new ApiError('NOT_FOUND', '这门课已经下架了')
  return c
}

/** 检查字段和引用，给新小节分配 id。old 是修改前的课 */
function checkCourse(req: CourseInput, old?: CourseRec): Omit<CourseRec, 'id'> {
  const c = checked(cleanCourse(req), validateCourse)
  if (c.artistId && !artists.some(a => a.id === c.artistId)) throw new ApiError('UNKNOWN', '选的化妆师不在了，换一位吧')
  const t = c.teacherId ? teachers.find(x => x.id === c.teacherId) : undefined
  if (c.teacherId && !t) throw new ApiError('UNKNOWN', '选的讲师不在了，换一位吧')
  if (t && t.status !== 'active' && !c.hidden) {
    throw new ApiError('UNKNOWN', t.status === 'invited' ? 'TA 还没确认授权，先存成下架，确认后再上架' : '和 TA 的合作已经结束了，这门课不能上架')
  }
  if (c.serviceId && !services.some(s => s.id === c.serviceId)) throw new ApiError('UNKNOWN', '关联的项目不在了，换一个吧')
  if (c.products.some(p => !products.some(x => x.id === p.productId))) {
    throw new ApiError('UNKNOWN', '有化妆品已经从店里的清单删掉了，重新选一下')
  }
  const oldIds = new Set(old ? lessonsOf(old).map(l => l.id) : [])
  const used = new Set<ID>()
  const chapters = c.chapters.map(ch => ({
    title: ch.title,
    lessons: ch.lessons.map(({ id, ...l }): Lesson => {
      if (id && (!oldIds.has(id) || used.has(id))) throw new ApiError('UNKNOWN', '有小节不是这门课的，刷新后再改')
      const lessonId = id ?? `l${++seq}`
      used.add(lessonId)
      return { id: lessonId, ...l }
    }),
  }))
  return { ...c, chapters }
}

/** 结束合作：TA 的课全部下架，邀请作废 */
function endTeaching(t: TeacherRec) {
  t.status = 'ended'
  t.endedAt = toTimestamp(new Date())
  delete t.inviteCode
  for (const c of courses) if (c.teacherId === t.id) c.hidden = true
}

/** 返回给页面的讲师：不带 userId；客人看自己的不带邀请码 */
function outTeacher(t: TeacherRec, forOwner = true): Teacher {
  const { userId: _, ...rest } = clone(t)
  if (!forOwner) delete rest.inviteCode
  return rest
}

function newInviteCode() {
  let code: string
  do code = Math.random().toString(36).slice(2, 10).toUpperCase()
  while (code.length < 8 || teachers.some(t => t.inviteCode === code))
  return code
}

/** 所有分成：演示数据 + 我从课程来、已经到店完成的单。按到店日期排 */
function shareRecords(): (ShareRecord & { teacherId: ID })[] {
  autoCancel()
  const live = bookings.flatMap(b => {
    const src = bookingCourse.get(b.id)
    if (b.status !== 'completed' || !src?.teacherId || src.rate === undefined) return []
    return [{
      teacherId: src.teacherId, bookingId: b.id, date: b.date, serviceName: b.serviceName, courseTitle: src.courseTitle,
      price: b.price, rate: src.rate, amount: Math.floor(b.price * src.rate / 100),
    }]
  })
  return [...seedShares, ...live].sort((a, b) => a.date.localeCompare(b.date))
}

function payoutOf(t: TeacherRec, month: string, records = shareRecords()): Payout | undefined {
  const paid = paidPayouts.get(`${t.id}|${month}`)
  if (paid) return { ...clone(paid), teacherName: t.name }
  const mine: ShareRecord[] = records
    .filter(r => r.teacherId === t.id && r.date.slice(0, 7) === month)
    .map(({ teacherId: _, ...r }) => r)
  if (!mine.length) return undefined
  return {
    teacherId: t.id, teacherName: t.name, month, status: month < todayStr().slice(0, 7) ? 'due' : 'open',
    count: mine.length, amount: mine.reduce((n, r) => n + r.amount, 0), records: mine,
  }
}

/** 最近 6 个月有分成的，月份新的在前、同月按讲师先后 */
function payouts(teacherId?: ID): Payout[] {
  const thisMonth = todayStr().slice(0, 7)
  const records = shareRecords()
  return Array.from({ length: STATS_MONTHS }, (_, i) => monthBefore(thisMonth, i)).flatMap(month =>
    teachers.filter(t => !teacherId || t.id === teacherId).flatMap(t => payoutOf(t, month, records) ?? []))
}

// 林小姐 8 月的分成已经付过了
paidPayouts.set('t1|2026-08', { ...(payoutOf(teachers[0], '2026-08') as Payout), status: 'paid', paidAt: '2026-09-03T10:00:00+08:00' })

// ---------- 资料维护 ----------

function indexOrThrow<T extends { id: ID }>(list: T[], id: ID): number {
  const i = list.findIndex(x => x.id === id)
  if (i < 0) throw new ApiError('NOT_FOUND', '没有找到这条信息')
  return i
}

/** 不符合规则时和后端一样返回 400 UNKNOWN，message 说明哪里不对 */
function checked<T>(v: T, validate: (v: T) => string | undefined): T {
  const msg = validate(v)
  if (msg) throw new ApiError('UNKNOWN', msg)
  return v
}

function checkWork(req: WorkInput): WorkInput {
  const w = checked(cleanWork(req), validateWork)
  if (!artists.some(a => a.id === w.artistId)) throw new ApiError('UNKNOWN', '选的化妆师不在了，换一位吧')
  if (w.serviceId && !services.some(s => s.id === w.serviceId)) throw new ApiError('UNKNOWN', '关联的项目不在了，换一个吧')
  return w
}

/** 下架或删掉 id 之后，至少还要有一个在接预约的项目，不然客人没法约 */
function requireAnotherOnSale(id: ID) {
  if (!services.some(s => s.id !== id && !s.hidden)) {
    throw new ApiError('INVALID_STATE', '至少要留一个在接预约的项目')
  }
}

/** mock 专用：模拟微信支付回调。真实环境由微信支付通知后端完成状态变更。 */
export async function __simulatePaid(id: ID) {
  await delay(600)
  const b = getBookingOrThrow(id)
  if (b.status === 'pending_payment') {
    b.status = 'pending_confirm'
    delete b.payDeadline
    paidIds.add(b.id)
    notifyOwner('new', b)
  }
}

// ---------- 实现 ----------

export const mockApi: Api = {
  async login() { await delay(); return outMe() },
  async getMe() { await delay(100); return outMe() },

  async getSkinProfile() { await delay(150); return clone(skinProfile) },
  async updateSkinProfile(req: UpdateSkinProfileReq) {
    await delay(400)
    const text = (s?: string) => s?.trim() || undefined
    skinProfile = {
      skinType: req.skinType, tone: req.tone,
      allergies: text(req.allergies), note: text(req.note),
      updatedAt: toTimestamp(new Date()),
    }
    // 去掉 undefined，和 JSON 返回一致
    return clone(skinProfile)
  },

  async listArtists() { await delay(); return clone(artists) },
  async listServices() { await delay(); return clone(services.filter(s => !s.hidden)) },
  async getService(id) { await delay(); return clone(getOrThrow(services, id)) },
  async listWorks(category) {
    await delay()
    return clone(category ? works.filter(w => w.category === category) : works).map(w => {
      // 关联的项目下架了就不带，“预约同款”不预选
      if (w.serviceId && services.find(s => s.id === w.serviceId)?.hidden) delete w.serviceId
      return w
    })
  },
  async listBookableDates() { await delay(100); return upcomingDates(7) },
  async getShop() { await delay(100); return clone(shop) },
  async listProducts(category) {
    await delay()
    return clone(sortedProducts().filter(p => !category || p.category === category))
  },

  async listSlots(artistId, date, _serviceId, excludeBookingId): Promise<SlotView[]> {
    await delay()
    // 只认还在进行中的预约；mock 里只有一个用户，不用再校验归属
    const exclude = bookings.find(b => b.id === excludeBookingId && ACTIVE.includes(b.status))?.id
    return TIMES.map(time => ({ time, available: isAvailable(artistId, date, time, exclude) }))
  },

  async createBooking(req: CreateBookingReq) {
    await delay(500)
    const service = getOrThrow(services, req.serviceId)
    if (service.hidden) throw new ApiError('INVALID_STATE', '这个项目暂时不接预约了，看看别的吧')
    getOrThrow(artists, req.artistId)
    if (!isAvailable(req.artistId, req.date, req.time)) {
      throw new ApiError('SLOT_TAKEN', '这个时间刚被约走了，换一个时间吧')
    }
    const booking: Booking = {
      id: `b${++seq}`,
      serviceId: service.id, serviceName: service.name,
      artistId: req.artistId, artistName: artistName(req.artistId),
      date: req.date, time: req.time, durationMin: service.durationMin,
      price: service.price, deposit: service.deposit,
      status: 'pending_payment',
      occasion: req.occasion, skinType: req.skinType, note: req.note,
      createdAt: toTimestamp(new Date()), canCancel: true,
      payDeadline: toTimestamp(new Date(Date.now() + PAY_WINDOW_MS)),
    }
    bookings.push(booking)
    const course = req.courseId ? courses.find(c => c.id === req.courseId && !c.hidden) : undefined
    if (course) {
      const t = course.teacherId ? teachers.find(x => x.id === course.teacherId) : undefined
      // 讲师自己约自己的课不分成
      const earns = t?.status === 'active' && t.userId !== me.id
      bookingCourse.set(booking.id, { courseTitle: course.title, ...(earns && { teacherId: t.id, rate: t.shareRate }) })
    }
    return { booking: out(booking), payment: payParams(booking) }
  },

  async getBooking(id) { await delay(150); return out(getBookingOrThrow(id)) },

  async resumePayment(id) {
    await delay(300)
    const b = getBookingOrThrow(id)
    if (b.status !== 'pending_payment') {
      throw new ApiError('INVALID_STATE', b.status === 'cancelled'
        ? '超过 15 分钟没付定金，这个时段已经放出去了，重新约一次吧'
        : '这个预约已经付过定金了')
    }
    return { booking: out(b), payment: payParams(b) }
  },

  async listMyBookings(scope) {
    await delay()
    const upcoming = scope === 'upcoming'
    autoCancel()
    const wanted: BookingStatus[] = upcoming ? ACTIVE : ['completed', 'cancelled']
    return bookings
      .filter(b => wanted.includes(b.status))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) * (upcoming ? 1 : -1))
      .map(out)
  },

  async cancelBooking(id) {
    await delay()
    const b = getBookingOrThrow(id)
    if (!ACTIVE.includes(b.status)) throw new ApiError('INVALID_STATE', '这个预约的状态已经变了')
    if (!out(b).canCancel) throw new ApiError('CANCEL_TOO_LATE', '距离开始不到 24 小时，需要取消请直接联系门店')
    const paid = b.status !== 'pending_payment'
    b.status = 'cancelled'
    b.cancelReason = 'customer'
    delete b.payDeadline
    refund(b)
    if (paid) notifyOwner('cancelled', b)
    return out(b)
  },

  async rescheduleBooking(id, req) {
    await delay(400)
    const b = getBookingOrThrow(id)
    if (!ACTIVE.includes(b.status)) throw new ApiError('INVALID_STATE', '这个预约的状态已经变了')
    if (!out(b).canCancel) throw new ApiError('CANCEL_TOO_LATE', '距离开始不到 24 小时，需要改期请直接联系门店')
    if (!isAvailable(req.artistId, req.date, req.time, b.id)) {
      throw new ApiError('SLOT_TAKEN', '这个时间刚被约走了，换一个时间吧')
    }
    Object.assign(b, {
      artistId: req.artistId, artistName: artistName(req.artistId),
      date: req.date, time: req.time,
      // 付过定金的要店里重新确认；还没付的仍是待付定金，不能借改期绕过付款
      status: b.status === 'pending_payment' ? 'pending_payment' : 'pending_confirm',
    })
    if (b.status !== 'pending_payment') notifyOwner('rescheduled', b)
    return out(b)
  },

  async listScheduleDates() {
    await delay(100)
    requireOwner()
    return datesFromToday(8)
  },

  async getDaySchedule(date): Promise<DaySchedule> {
    await delay()
    requireOwner()
    const cells: ScheduleCell[] = []
    const stats = { total: 0, pending: 0, free: 0, stale: 0 }
    for (const time of TIMES) {
      for (const a of artists) {
        const cell: ScheduleCell = { artistId: a.id, time, state: 'free' }
        const real = scheduledAt(a.id, date, time)
        if (real) {
          const brief: OwnerBookingBrief = {
            id: real.id, customerName: me.nickname, serviceName: real.serviceName, status: real.status,
            ...ownerAlert(real.skinType, real.note),
            canConfirm: real.status === 'pending_confirm' && !isPast(real.date, real.time),
            durationMin: real.durationMin, occasion: real.occasion, skinType: real.skinType,
            profile: hasProfile(skinProfile) ? clone(skinProfile) : undefined,
            canChange: ownerCanChange(real), canMarkNoShow: canMarkNoShow(real),
            courseTitle: bookingCourse.get(real.id)?.courseTitle,
          }
          // pending_payment 也算占着：付款截止前为客人保留
          cell.state = real.status === 'pending_confirm' ? 'pending' : 'booked'
          cell.booking = brief
        } else if (takenByOthers(a.id, date, time)) {
          const h = hash(slotKey(a.id, date, time))
          const sensitive = h % 5 === 0
          cell.state = 'booked'
          cell.booking = {
            id: `other-${h}`, customerName: OTHER_NAMES[h % OTHER_NAMES.length],
            serviceName: OTHER_SERVICES[h % OTHER_SERVICES.length], status: 'confirmed',
            alert: sensitive ? '敏感肌' : undefined, note: sensitive ? '过敏：对酒精过敏' : undefined,
            canConfirm: false,
            durationMin: 90,
            occasion: OTHER_OCCASIONS[h % OTHER_OCCASIONS.length],
            profile: sensitive
              ? { skinType: 'sensitive', tone: 'warm_fair', allergies: '对酒精过敏' }
              : h % 3 === 0 ? { skinType: 'oily', note: '单眼皮，喜欢眼妆淡一点' } : undefined,
          }
        } else if (isPast(date, time)) {
          cell.state = 'past'
        } else if (blocks.has(slotKey(a.id, date, time))) {
          cell.state = 'blocked'
        }
        // 待付定金的还没算数，没来的不算当天的预约
        const uncounted = cell.booking?.status === 'pending_payment' || cell.booking?.status === 'cancelled'
        if ((cell.state === 'booked' || cell.state === 'pending') && !uncounted) stats.total++
        if (cell.state === 'pending') stats.pending++
        if (cell.state === 'pending' && !cell.booking?.canConfirm) stats.stale++
        if (cell.state === 'free') stats.free++
        cells.push(cell)
      }
    }
    return { date, times: [...TIMES], artists: artists.map(({ id, name }) => ({ id, name })), cells, stats }
  },

  async confirmBooking(id) {
    await delay()
    requireOwner()
    const b = getBookingOrThrow(id)
    if (b.status !== 'pending_confirm') throw new ApiError('INVALID_STATE', '这个预约已经处理过了')
    if (isPast(b.date, b.time)) throw new ApiError('INVALID_STATE', '预约时间已经过了，不能再确认')
    b.status = 'confirmed'
    return out(b)
  },

  async ownerCancelBooking(id) {
    await delay()
    requireOwner()
    const b = getBookingOrThrow(id)
    if (!ownerCanChange(b)) throw new ApiError('INVALID_STATE', ACTIVE.includes(b.status) ? '预约已经开始了，不能再取消' : '这个预约已经结束了')
    // 付过的定金原路退回；店里自己操作的，不用再提醒店主
    b.status = 'cancelled'
    b.cancelReason = 'customer'
    delete b.payDeadline
    refund(b)
    return out(b)
  },

  async ownerRescheduleBooking(id, req) {
    await delay(400)
    requireOwner()
    const b = getBookingOrThrow(id)
    if (!ownerCanChange(b)) throw new ApiError('INVALID_STATE', ACTIVE.includes(b.status) ? '预约已经开始了，不能再改期' : '这个预约已经结束了')
    getOrThrow(artists, req.artistId)
    if (!datesFromToday(8).includes(req.date)) throw new ApiError('INVALID_STATE', '这一天还排不到，换一天吧')
    if (isPast(req.date, req.time)) throw new ApiError('SLOT_TAKEN', '这个时间已经过去了，换一个吧')
    if (blocks.has(slotKey(req.artistId, req.date, req.time))) {
      throw new ApiError('SLOT_TAKEN', '这个时段设了休息，先恢复可约再改过来')
    }
    if (!isAvailable(req.artistId, req.date, req.time, b.id)) {
      throw new ApiError('SLOT_TAKEN', '这个时间已经有预约了，换一个吧')
    }
    Object.assign(b, {
      artistId: req.artistId, artistName: artistName(req.artistId),
      date: req.date, time: req.time,
      // 店里和客人说好了的，付过定金的直接算确认；还没付的仍要付
      status: b.status === 'pending_payment' ? 'pending_payment' : 'confirmed',
    })
    return out(b)
  },

  async markNoShow(id) {
    await delay()
    requireOwner()
    const b = getBookingOrThrow(id)
    if (!canMarkNoShow(b)) {
      throw new ApiError('INVALID_STATE', isPast(b.date, b.time) ? '只能在预约当天标记没来' : '预约还没开始，不能标记没来')
    }
    // 定金同样原路退回
    b.status = 'cancelled'
    b.cancelReason = 'no_show'
    refund(b)
    return out(b)
  },

  async blockSlot(artistId, date, time) {
    await delay(200)
    requireOwner()
    if (isPast(date, time)) throw new ApiError('INVALID_STATE', '这个时段已经过去了')
    if (findActive(artistId, date, time) || takenByOthers(artistId, date, time)) {
      throw new ApiError('INVALID_STATE', '这个时段已经有预约了')
    }
    blocks.add(slotKey(artistId, date, time))
  },

  async unblockSlot(artistId, date, time) {
    await delay(200)
    requireOwner()
    if (isPast(date, time)) throw new ApiError('INVALID_STATE', '这个时段已经过去了')
    blocks.delete(slotKey(artistId, date, time))
  },

  async getOwnerNotify() {
    await delay(100)
    requireOwner()
    return { quota: ownerQuota }
  },

  async addOwnerNotify(count) {
    await delay(150)
    requireOwner()
    if (!Number.isInteger(count) || count < 1 || count > 5) throw new ApiError('UNKNOWN', '额度一次只能加 1–5 条')
    ownerQuota += count
    return { quota: ownerQuota }
  },

  async listMonthStats() {
    await delay()
    requireOwner()
    return monthStats()
  },

  async updateShop(req) {
    await delay(400)
    requireOwner()
    shop = checked(cleanShop(req), validateShop)
    return clone(shop)
  },

  async createArtist(req) {
    await delay(400)
    requireOwner()
    const a: Artist = { id: `a${++seq}`, ...checked(cleanArtist(req), validateArtist) }
    artists.push(a)
    return clone(a)
  },
  async updateArtist(id, req) {
    await delay(400)
    requireOwner()
    const i = indexOrThrow(artists, id)
    artists[i] = { id, ...checked(cleanArtist(req), validateArtist) }
    return clone(artists[i])
  },
  async deleteArtist(id) {
    await delay(400)
    requireOwner()
    const i = indexOrThrow(artists, id)
    autoCancel()
    if (bookings.some(b => b.artistId === id && ACTIVE.includes(b.status))) {
      throw new ApiError('INVALID_STATE', 'TA 还有没结束的预约，处理完再删')
    }
    const n = works.filter(w => w.artistId === id).length
    if (n) throw new ApiError('INVALID_STATE', `TA 名下还有 ${n} 个作品，先改给别人或删掉`)
    const nc = courses.filter(c => c.artistId === id).length
    if (nc) throw new ApiError('INVALID_STATE', `TA 名下还有 ${nc} 门课，先改给别人或删掉`)
    if (artists.length === 1) throw new ApiError('INVALID_STATE', '至少要留一位化妆师')
    artists.splice(i, 1)
  },

  async listOwnerServices() {
    await delay()
    requireOwner()
    return clone(services)
  },
  async createService(req) {
    await delay(400)
    requireOwner()
    const s: Service = { id: `s${++seq}`, ...checked(cleanService(req), validateService), bookedCount: 0 }
    services.push(s)
    return clone(s)
  },
  async updateService(id, req) {
    await delay(400)
    requireOwner()
    const i = indexOrThrow(services, id)
    const next: Service = { id, ...checked(cleanService(req), validateService), bookedCount: services[i].bookedCount }
    if (next.hidden && !services[i].hidden) requireAnotherOnSale(id)
    services[i] = next
    return clone(next)
  },
  async deleteService(id) {
    await delay(400)
    requireOwner()
    const i = indexOrThrow(services, id)
    autoCancel()
    if (bookings.some(b => b.serviceId === id && ACTIVE.includes(b.status))) {
      throw new ApiError('INVALID_STATE', '这个项目还有没结束的预约，可以先下架，等预约都结束了再删')
    }
    if (!services[i].hidden) requireAnotherOnSale(id)
    services.splice(i, 1)
    for (const w of works) if (w.serviceId === id) delete w.serviceId
    for (const c of courses) if (c.serviceId === id) delete c.serviceId
  },

  async listOwnerWorks() {
    await delay()
    requireOwner()
    return clone(works)
  },
  async createWork(req) {
    await delay(400)
    requireOwner()
    const w: Work = { id: `w${++seq}`, ...checkWork(req) }
    works.unshift(w)
    return clone(w)
  },
  async updateWork(id, req) {
    await delay(400)
    requireOwner()
    const i = indexOrThrow(works, id)
    works[i] = { id, ...checkWork(req) }
    return clone(works[i])
  },
  async deleteWork(id) {
    await delay(300)
    requireOwner()
    works.splice(indexOrThrow(works, id), 1)
  },

  async createProduct(req) {
    await delay(400)
    requireOwner()
    if (products.length >= LIMITS.maxProducts) throw new ApiError('UNKNOWN', `化妆品最多放 ${LIMITS.maxProducts} 件`)
    const p: Product = { id: `p${++seq}`, ...checked(cleanProduct(req), validateProduct) }
    products.push(p)
    return clone(p)
  },
  async updateProduct(id, req) {
    await delay(400)
    requireOwner()
    const i = indexOrThrow(products, id)
    products[i] = { id, ...checked(cleanProduct(req), validateProduct) }
    return clone(products[i])
  },
  async deleteProduct(id) {
    await delay(300)
    requireOwner()
    products.splice(indexOrThrow(products, id), 1)
    for (const c of courses) {
      c.products = c.products.filter(p => p.productId !== id)
      for (const l of lessonsOf(c)) l.productIds = l.productIds.filter(x => x !== id)
    }
  },

  async listCourses(category) {
    await delay()
    return courses.filter(c => !c.hidden && (!category || c.category === category)).map(courseSummary)
  },
  async getCourse(id) {
    await delay()
    return courseDetail(visibleCourse(id), false)
  },
  async saveCourseProgress(courseId, req) {
    await delay(150)
    const l = lessonsOf(visibleCourse(courseId)).find(x => x.id === req.lessonId)
    if (!l) throw new ApiError('NOT_FOUND', '这一节已经不在了')
    const positionSec = Math.min(l.durationSec, Math.max(0, Math.floor(Number(req.positionSec) || 0)))
    const finished = new Set(progress.get(courseId)?.finishedLessonIds)
    if (positionSec >= l.durationSec - 5) finished.add(l.id)
    const p: CourseProgress = { lessonId: l.id, positionSec, finishedLessonIds: [...finished], updatedAt: toTimestamp(new Date()) }
    progress.set(courseId, p)
    return clone(p)
  },

  async getTeacherInvite(code) {
    await delay()
    const t = teachers.find(x => x.status === 'invited' && x.inviteCode === code)
    if (!t) throw new ApiError('NOT_FOUND', '这个邀请已经失效了，找店里重新要一个')
    return { code, name: t.name, shareRate: t.shareRate, shopName: shop.name, agreementVersion: TEACHER_AGREEMENT_VERSION }
  },
  async acceptTeacherInvite(code, agreementVersion) {
    await delay(400)
    const t = teachers.find(x => x.status === 'invited' && x.inviteCode === code)
    if (!t) throw new ApiError('NOT_FOUND', '这个邀请已经失效了，找店里重新要一个')
    if (agreementVersion !== TEACHER_AGREEMENT_VERSION) throw new ApiError('INVALID_STATE', '授权说明更新了，重新看一遍再确认')
    if (teachers.some(x => x.id === me.teacherId && x.status === 'active')) throw new ApiError('INVALID_STATE', '你已经是讲师了')
    Object.assign(t, { status: 'active', userId: me.id, agreedAt: toTimestamp(new Date()), agreementVersion })
    delete t.inviteCode
    me.teacherId = t.id
    return outTeacher(t, false)
  },
  async getMyTeaching() {
    await delay()
    const t = teachers.find(x => x.id === me.teacherId)
    if (!t) throw new ApiError('NOT_FOUND', '你还不是讲师')
    return {
      teacher: outTeacher(t, false),
      courses: courses.filter(c => c.teacherId === t.id).map(courseSummary),
      payouts: payouts(t.id),
    }
  },
  async quitTeaching() {
    await delay(400)
    const t = teachers.find(x => x.id === me.teacherId)
    if (t?.status !== 'active') throw new ApiError('INVALID_STATE', '你现在不是合作中的讲师')
    endTeaching(t)
    return outTeacher(t, false)
  },

  async listOwnerCourses() {
    await delay()
    requireOwner()
    return courses.map(courseSummary)
  },
  async getOwnerCourse(id) {
    await delay()
    requireOwner()
    return courseDetail(getOrThrow(courses, id), true)
  },
  async createCourse(req) {
    await delay(400)
    requireOwner()
    if (courses.length >= LIMITS.maxCourses) throw new ApiError('UNKNOWN', `课程最多放 ${LIMITS.maxCourses} 门`)
    const c: CourseRec = { id: `c${++seq}`, ...checkCourse(req) }
    courses.unshift(c)
    return courseDetail(c, true)
  },
  async updateCourse(id, req) {
    await delay(400)
    requireOwner()
    const i = indexOrThrow(courses, id)
    const c: CourseRec = { id, ...checkCourse(req, courses[i]) }
    courses[i] = c
    // 删掉的小节不再算进度
    const p = progress.get(id)
    if (p) {
      const ids = new Set(lessonsOf(c).map(l => l.id))
      if (!ids.has(p.lessonId)) progress.delete(id)
      else p.finishedLessonIds = p.finishedLessonIds.filter(x => ids.has(x))
    }
    return courseDetail(c, true)
  },
  async deleteCourse(id) {
    await delay(300)
    requireOwner()
    courses.splice(indexOrThrow(courses, id), 1)
    progress.delete(id)
  },

  async listTeachers() {
    await delay()
    requireOwner()
    return teachers.map(t => outTeacher(t))
  },
  async createTeacher(req) {
    await delay(400)
    requireOwner()
    const t: TeacherRec = { id: `t${++seq}`, ...checked(cleanTeacher(req), validateTeacher), status: 'invited', inviteCode: newInviteCode() }
    teachers.push(t)
    return outTeacher(t)
  },
  async updateTeacher(id, req) {
    await delay(400)
    requireOwner()
    const t = getOrThrow(teachers, id)
    const next = checked(cleanTeacher(req), validateTeacher)
    if (t.status !== 'invited' && next.shareRate !== t.shareRate) {
      throw new ApiError('INVALID_STATE', '分成比例 TA 已经确认过了，不能改；要改就结束合作再重新邀请')
    }
    delete t.intro
    Object.assign(t, next)
    return outTeacher(t)
  },
  async endTeacher(id) {
    await delay(400)
    requireOwner()
    const t = getOrThrow(teachers, id)
    if (t.status === 'ended') throw new ApiError('INVALID_STATE', '已经结束合作了')
    endTeaching(t)
    return outTeacher(t)
  },
  async deleteTeacher(id) {
    await delay(300)
    requireOwner()
    const i = indexOrThrow(teachers, id)
    if (teachers[i].agreedAt) throw new ApiError('INVALID_STATE', 'TA 确认过授权，不能删，可以结束合作')
    const n = courses.filter(c => c.teacherId === id).length
    if (n) throw new ApiError('INVALID_STATE', `TA 名下还有 ${n} 门课，先改给别人或删掉`)
    teachers.splice(i, 1)
  },

  async listPayouts() {
    await delay()
    requireOwner()
    return payouts()
  },
  async markPayoutPaid(teacherId, month) {
    await delay(400)
    requireOwner()
    const t = getOrThrow(teachers, teacherId)
    const p = payoutOf(t, month)
    if (!p) throw new ApiError('INVALID_STATE', '这个月没有要付的分成')
    if (p.status === 'paid') throw new ApiError('INVALID_STATE', '这个月已经标记过了')
    if (p.status === 'open') throw new ApiError('INVALID_STATE', '这个月还没过完，月底后再结')
    const paid: Payout = { ...p, status: 'paid', paidAt: toTimestamp(new Date()) }
    paidPayouts.set(`${teacherId}|${month}`, paid)
    return clone(paid)
  },
}
