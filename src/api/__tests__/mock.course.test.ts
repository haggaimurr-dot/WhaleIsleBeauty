/** 课堂：课程、观看进度、顾客讲师的授权和分成。用例和 server/courses_test.go 对齐 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freshMock, useMockClock } from '@/test/helpers'
import { TEACHER_AGREEMENT_VERSION, type CourseInput, type Payout, type TeacherInput } from '@/api/types'
import { cleanCourse, cleanTeacher, validateCourse, validateTeacher } from '@/api/catalog'

let api: Awaited<ReturnType<typeof freshMock>>['api']
let simulatePaid: Awaited<ReturnType<typeof freshMock>>['simulatePaid']

beforeEach(async () => {
  // 月中：可预约的日期（9/11–9/17）都在本月
  useMockClock(new Date(2026, 8, 10, 10, 0))
  ;({ api, simulatePaid } = await freshMock())
})
afterEach(() => { vi.useRealTimers() })

const code = (e: unknown) => (e as { code?: string })?.code
const message = (e: unknown) => (e as { message?: string })?.message

const course: CourseInput = {
  title: ' 新娘早妆 ', summary: '婚礼当天早上怎么配合化妆师', category: 'bridal', cover: 'placeholder:g1',
  artistId: 'a2', serviceId: 's3',
  chapters: [{ title: '当天', lessons: [{ title: '素颜过来就好', video: 'placeholder:v1', durationSec: 120, productIds: ['p1'] }] }],
  products: [{ productId: 'p1', tip: ' ' }],
}
const teacher: TeacherInput = { name: '小陈', avatar: 'placeholder:g2', intro: '', shareRate: 10 }

/** 从某门课点进来，约 a1 在某天第一个能约的时间，付定金，店里确认 */
async function bookFrom(courseId: string | undefined, date: string, serviceId = 's2') {
  const slot = (await api.listSlots('a1', date, serviceId)).find(s => s.available)
  if (!slot) throw new Error('没有能约的时间')
  const { booking } = await api.createBooking({ serviceId, artistId: 'a1', date, time: slot.time, courseId })
  await simulatePaid(booking.id)
  await api.confirmBooking(booking.id)
  return booking
}

const linPayout = async (month: string) =>
  (await api.listPayouts()).find(p => p.teacherId === 't1' && p.month === month) as Payout

describe('客人看课', () => {
  it('列表新的在前，按风格筛选，算好节数和总时长', async () => {
    const list = await api.listCourses()
    expect(list.map(c => c.id)).toEqual(['c3', 'c2', 'c1'])
    expect(list[2]).toMatchObject({ lessonCount: 4, durationSec: 240 + 420 + 360 + 180 })
    expect(list[2].teacher).toEqual({ kind: 'artist', name: '七七', avatar: 'placeholder:g3', intro: '擅长日常 · 4 年' })
    expect(list[0].teacher).toMatchObject({ kind: 'customer', name: '林小姐' })
    expect((await api.listCourses('camera')).map(c => c.id)).toEqual(['c2'])
  })

  it('详情带目录和化妆品，用法写在化妆品上；没看过不带进度', async () => {
    const c = await api.getCourse('c1')
    expect(c.chapters.map(ch => ch.title)).toEqual(['准备', '上妆'])
    expect(c.products.find(p => p.id === 'p4')).toMatchObject({ brand: 'NARS', tip: '挤一颗黄豆大就够' })
    expect(c.products.find(p => p.id === 'p5')).not.toHaveProperty('tip')
    expect(c).toMatchObject({ artistId: 'a3', serviceId: 's2' })
    expect(c).not.toHaveProperty('progress')
  })

  it('项目下架后客人那边不带 serviceId，店主那边照常带', async () => {
    const s = await api.getService('s1')
    await api.updateService('s1', { ...s, hidden: true })
    expect(await api.getCourse('c2')).not.toHaveProperty('serviceId')
    expect(await api.getOwnerCourse('c2')).toHaveProperty('serviceId', 's1')
  })

  it('删掉化妆品后，课里用到它的地方一起去掉', async () => {
    await api.deleteProduct('p4')
    const c = await api.getCourse('c1')
    expect(c.products.some(p => p.id === 'p4')).toBe(false)
    expect(c.chapters[1].lessons[0].productIds).toEqual(['p5'])
  })
})

describe('观看进度', () => {
  it('记录看到哪；超过时长按时长算；离结尾不到 5 秒算看完', async () => {
    let p = await api.saveCourseProgress('c1', { lessonId: 'l2', positionSec: 100.7 })
    expect(p).toMatchObject({ lessonId: 'l2', positionSec: 100, finishedLessonIds: [] })
    p = await api.saveCourseProgress('c1', { lessonId: 'l2', positionSec: 416 })
    expect(p.finishedLessonIds).toEqual(['l2'])
    p = await api.saveCourseProgress('c1', { lessonId: 'l3', positionSec: 9999 })
    expect(p).toMatchObject({ lessonId: 'l3', positionSec: 360, finishedLessonIds: ['l2', 'l3'] })
    expect((await api.getCourse('c1')).progress).toMatchObject({ lessonId: 'l3', positionSec: 360 })
    expect(await api.getOwnerCourse('c1')).not.toHaveProperty('progress')
  })

  it('小节不在这门课里返回 NOT_FOUND', async () => {
    await expect(api.saveCourseProgress('c1', { lessonId: 'l8', positionSec: 1 })).rejects.toSatisfy(e => code(e) === 'NOT_FOUND')
  })

  it('改课时删掉的小节不再算进度', async () => {
    await api.saveCourseProgress('c1', { lessonId: 'l1', positionSec: 240 })
    await api.saveCourseProgress('c1', { lessonId: 'l2', positionSec: 10 })
    const c = await api.getOwnerCourse('c1')
    const input: CourseInput = {
      ...c, products: c.products.map(p => ({ productId: p.id, tip: p.tip })),
      chapters: [c.chapters[1]],
    }
    await api.updateCourse('c1', input)
    expect((await api.getCourse('c1')).progress).toMatchObject({ lessonId: 'l2', finishedLessonIds: [] })
  })
})

describe('分成', () => {
  it('从顾客讲师的课来、到店完成的单，按下单时的比例记一笔', async () => {
    const before = await linPayout('2026-09')
    expect(before).toMatchObject({ status: 'open', count: 2 })
    const b = await bookFrom('c3', '2026-09-12')
    // 还没到店不算
    expect((await linPayout('2026-09')).count).toBe(2)
    vi.setSystemTime(new Date(2026, 8, 20, 10, 0))
    const after = await linPayout('2026-09')
    expect(after.count).toBe(3)
    const r = after.records.find(x => x.bookingId === b.id)
    expect(r).toMatchObject({ courseTitle: '单眼皮的眼妆', price: 16800, rate: 20, amount: 3360, date: '2026-09-12' })
    expect(after.amount).toBe(before.amount + 3360)
  })

  it('化妆师的课、没从课来、取消了的都不分成；排班里能看到从哪门课来', async () => {
    const before = await linPayout('2026-09')
    const fromArtist = await bookFrom('c1', '2026-09-12')
    await bookFrom(undefined, '2026-09-13')
    const cancelled = await bookFrom('c3', '2026-09-14')
    await api.ownerCancelBooking(cancelled.id)
    const day = await api.getDaySchedule('2026-09-12')
    expect(day.cells.find(c => c.booking?.id === fromArtist.id)?.booking?.courseTitle).toBe('五分钟通勤妆')
    vi.setSystemTime(new Date(2026, 8, 20, 10, 0))
    expect((await linPayout('2026-09')).count).toBe(before.count)
  })

  it('结束合作前已经下的单，到店完成后照常分', async () => {
    const b = await bookFrom('c3', '2026-09-12')
    await api.endTeacher('t1')
    vi.setSystemTime(new Date(2026, 8, 20, 10, 0))
    expect((await linPayout('2026-09')).records.some(r => r.bookingId === b.id)).toBe(true)
  })

  it('课下架后从它来的单不分成', async () => {
    const before = await linPayout('2026-09')
    await api.endTeacher('t1')
    await bookFrom('c3', '2026-09-12')
    vi.setSystemTime(new Date(2026, 8, 20, 10, 0))
    expect((await linPayout('2026-09')).count).toBe(before.count)
  })

  it('讲师约自己的课不分成', async () => {
    const t = await api.createTeacher(teacher)
    await api.acceptTeacherInvite(t.inviteCode as string, TEACHER_AGREEMENT_VERSION)
    const c = await api.createCourse({ ...course, artistId: undefined, teacherId: t.id })
    await bookFrom(c.id, '2026-09-12')
    vi.setSystemTime(new Date(2026, 8, 20, 10, 0))
    expect((await api.listPayouts()).some(p => p.teacherId === t.id)).toBe(false)
  })

  it('本月还没过完不能标记；过了月底是待付，标记后定格', async () => {
    expect(await linPayout('2026-08')).toMatchObject({ status: 'paid', count: 2, amount: 3360 + 5960 })
    await expect(api.markPayoutPaid('t1', '2026-09')).rejects.toSatisfy(e => code(e) === 'INVALID_STATE' && message(e) === '这个月还没过完，月底后再结')
    await expect(api.markPayoutPaid('t1', '2026-08')).rejects.toSatisfy(e => message(e) === '这个月已经标记过了')
    await expect(api.markPayoutPaid('t1', '2026-07')).rejects.toSatisfy(e => message(e) === '这个月没有要付的分成')

    vi.setSystemTime(new Date(2026, 9, 2, 10, 0))
    expect((await linPayout('2026-09')).status).toBe('due')
    const paid = await api.markPayoutPaid('t1', '2026-09')
    expect(paid).toMatchObject({ status: 'paid', count: 2 })
    expect(paid.paidAt).toBeTruthy()
    expect(await linPayout('2026-09')).toEqual(paid)
  })
})

describe('顾客当讲师', () => {
  it('打开邀请、确认授权后成为讲师，能看到自己的课和分成', async () => {
    const invite = await api.getTeacherInvite('DEMO2026')
    expect(invite).toMatchObject({ name: '小周', shareRate: 15, shopName: '鲸屿美妆', agreementVersion: TEACHER_AGREEMENT_VERSION })
    await expect(api.getMyTeaching()).rejects.toSatisfy(e => code(e) === 'NOT_FOUND')

    await expect(api.acceptTeacherInvite('DEMO2026', '2000-01')).rejects.toSatisfy(e => code(e) === 'INVALID_STATE')
    const t = await api.acceptTeacherInvite('DEMO2026', TEACHER_AGREEMENT_VERSION)
    expect(t).toMatchObject({ id: 't2', status: 'active', agreementVersion: TEACHER_AGREEMENT_VERSION })
    expect(t).not.toHaveProperty('inviteCode')
    expect(t.agreedAt).toBeTruthy()
    expect((await api.getMe()).teacherId).toBe('t2')

    // 邀请只能用一次
    await expect(api.getTeacherInvite('DEMO2026')).rejects.toSatisfy(e => code(e) === 'NOT_FOUND')
    const mine = await api.getMyTeaching()
    expect(mine).toMatchObject({ teacher: { id: 't2' }, courses: [], payouts: [] })
  })

  it('已经是合作中的讲师不能再接受别的邀请', async () => {
    await api.acceptTeacherInvite('DEMO2026', TEACHER_AGREEMENT_VERSION)
    const other = await api.createTeacher(teacher)
    await expect(api.acceptTeacherInvite(other.inviteCode as string, TEACHER_AGREEMENT_VERSION))
      .rejects.toSatisfy(e => message(e) === '你已经是讲师了')
  })

  it('自己结束合作：TA 的课全部下架，课程详情打不开', async () => {
    await api.acceptTeacherInvite('DEMO2026', TEACHER_AGREEMENT_VERSION)
    const c = await api.createCourse({ ...course, artistId: undefined, teacherId: 't2' })
    expect((await api.listCourses()).some(x => x.id === c.id)).toBe(true)
    const t = await api.quitTeaching()
    expect(t.status).toBe('ended')
    expect((await api.listCourses()).some(x => x.id === c.id)).toBe(false)
    await expect(api.getCourse(c.id)).rejects.toSatisfy(e => code(e) === 'NOT_FOUND')
    expect((await api.getMyTeaching()).courses).toMatchObject([{ id: c.id, hidden: true }])
    await expect(api.quitTeaching()).rejects.toSatisfy(e => code(e) === 'INVALID_STATE')
  })
})

describe('店主管讲师', () => {
  it('新讲师等确认，带邀请码；确认前可以改比例，确认后不能', async () => {
    const t = await api.createTeacher(teacher)
    expect(t).toMatchObject({ name: '小陈', status: 'invited', shareRate: 10 })
    expect(t).not.toHaveProperty('intro')
    expect(t.inviteCode).toMatch(/^[0-9A-Z]{8}$/)
    expect((await api.updateTeacher(t.id, { ...teacher, shareRate: 12 })).shareRate).toBe(12)

    await expect(api.updateTeacher('t1', { ...teacher, shareRate: 30 })).rejects.toSatisfy(e => code(e) === 'INVALID_STATE')
    // 比例不变时可以改别的
    expect((await api.updateTeacher('t1', { ...teacher, shareRate: 20 })).name).toBe('小陈')
  })

  it('还没确认的讲师的课只能存成下架', async () => {
    await expect(api.createCourse({ ...course, artistId: undefined, teacherId: 't2' }))
      .rejects.toSatisfy(e => code(e) === 'UNKNOWN' && message(e) === 'TA 还没确认授权，先存成下架，确认后再上架')
    const c = await api.createCourse({ ...course, artistId: undefined, teacherId: 't2', hidden: true })
    expect(c.hidden).toBe(true)
  })

  it('结束合作：TA 的课下架，不能再上架；邀请作废', async () => {
    await api.endTeacher('t1')
    expect((await api.listCourses()).some(c => c.id === 'c3')).toBe(false)
    const c3 = await api.getOwnerCourse('c3')
    const input: CourseInput = { ...c3, hidden: false, products: c3.products.map(p => ({ productId: p.id, tip: p.tip })) }
    await expect(api.updateCourse('c3', input)).rejects.toSatisfy(e => message(e) === '和 TA 的合作已经结束了，这门课不能上架')
    await expect(api.endTeacher('t1')).rejects.toSatisfy(e => code(e) === 'INVALID_STATE')

    await api.endTeacher('t2')
    await expect(api.getTeacherInvite('DEMO2026')).rejects.toSatisfy(e => code(e) === 'NOT_FOUND')
  })

  it('确认过的讲师不能删；没确认、也没有课的可以删', async () => {
    await expect(api.deleteTeacher('t1')).rejects.toSatisfy(e => code(e) === 'INVALID_STATE')
    await api.deleteTeacher('t2')
    expect((await api.listTeachers()).map(t => t.id)).toEqual(['t1'])
  })

  it('讲师列表不带 userId', async () => {
    const [t1] = await api.listTeachers()
    expect(t1).not.toHaveProperty('userId')
  })
})

describe('店主管课程', () => {
  it('新课排在最前，去掉空格和空的用法，分配小节 id', async () => {
    const c = await api.createCourse(course)
    expect(c).toMatchObject({ title: '新娘早妆', lessonCount: 1, durationSec: 120, teacher: { kind: 'artist', name: '安安' } })
    expect(c.products[0]).not.toHaveProperty('tip')
    expect(c.chapters[0].lessons[0].id).toBeTruthy()
    expect((await api.listOwnerCourses())[0].id).toBe(c.id)
  })

  it('修改时保留原来小节的 id，别的课的小节 id 不认', async () => {
    const c = await api.getOwnerCourse('c2')
    const base: CourseInput = { ...c, products: c.products.map(p => ({ productId: p.id, tip: p.tip })) }
    const updated = await api.updateCourse('c2', {
      ...base,
      chapters: [{ title: '底妆', lessons: [...c.chapters[0].lessons, { title: '补妆', video: 'placeholder:v2', durationSec: 60, productIds: [] }] }],
    })
    const ids = updated.chapters[0].lessons.map(l => l.id)
    expect(ids.slice(0, 3)).toEqual(['l5', 'l6', 'l7'])
    expect(ids[3]).not.toMatch(/^l[5-7]$/)

    const foreign = { ...c.chapters[0].lessons[0], id: 'l1' }
    await expect(api.updateCourse('c2', { ...base, chapters: [{ title: '底妆', lessons: [foreign] }] }))
      .rejects.toSatisfy(e => message(e) === '有小节不是这门课的，刷新后再改')
  })

  it('引用不存在时返回 UNKNOWN', async () => {
    await expect(api.createCourse({ ...course, artistId: 'nope' })).rejects.toSatisfy(e => message(e) === '选的化妆师不在了，换一位吧')
    await expect(api.createCourse({ ...course, serviceId: 'nope' })).rejects.toSatisfy(e => message(e) === '关联的项目不在了，换一个吧')
    await expect(api.createCourse({ ...course, products: [{ productId: 'nope' }], chapters: [{ title: '当天', lessons: [{ ...course.chapters[0].lessons[0], productIds: [] }] }] }))
      .rejects.toSatisfy(e => message(e) === '有化妆品已经从店里的清单删掉了，重新选一下')
  })

  it('删课后客人看不到；化妆师名下有课时不能删', async () => {
    await api.deleteCourse('c1')
    expect((await api.listCourses()).some(c => c.id === 'c1')).toBe(false)
    const a = await api.createArtist({ name: '新人', years: 1, avatar: 'placeholder:g1' })
    await api.createCourse({ ...course, artistId: a.id })
    await expect(api.deleteArtist(a.id)).rejects.toSatisfy(e => message(e) === 'TA 名下还有 1 门课，先改给别人或删掉')
  })

  it('删掉项目后课程不再带 serviceId', async () => {
    const c = await api.createCourse({ ...course, serviceId: 's4' })
    await api.deleteService('s4')
    expect(await api.getOwnerCourse(c.id)).not.toHaveProperty('serviceId')
  })
})

describe('字段规则', () => {
  const ok = (c: CourseInput) => validateCourse(cleanCourse(c))
  const lessonOf = (patch: object) => ({ ...course, chapters: [{ title: '当天', lessons: [{ ...course.chapters[0].lessons[0], ...patch }] }] })

  it('validateCourse', () => {
    expect(ok(course)).toBeUndefined()
    expect(ok({ ...course, artistId: undefined })).toBe('还没选讲师')
    expect(ok({ ...course, teacherId: 't1' })).toBe('讲师只能选一位')
    expect(ok({ ...course, chapters: [] })).toBe('至少要有一章')
    expect(ok({ ...course, chapters: [{ title: '空的', lessons: [] }] })).toBe('「空的」还没有小节')
    expect(ok(lessonOf({ video: '' }))).toBe('「素颜过来就好」还没传视频')
    expect(ok(lessonOf({ durationSec: 3601 }))).toBe('「素颜过来就好」的视频要在 60 分钟以内')
    expect(ok(lessonOf({ productIds: ['p9'] }))).toBe('「素颜过来就好」用到的化妆品要先加进本课清单')
    expect(ok({ ...course, products: [{ productId: 'p1', tip: '字'.repeat(41) }] })).toBe('化妆品用法每条最多 40 个字')
  })

  it('cleanCourse 去掉重复的化妆品', () => {
    const c = cleanCourse({ ...course, products: [{ productId: 'p1', tip: '先' }, { productId: 'p1', tip: '后' }] })
    expect(c.products).toEqual([{ productId: 'p1', tip: '先' }])
  })

  it('validateTeacher', () => {
    const ok = (t: TeacherInput) => validateTeacher(cleanTeacher(t))
    expect(ok(teacher)).toBeUndefined()
    expect(ok({ ...teacher, name: ' ' })).toBe('名字还没填')
    expect(ok({ ...teacher, shareRate: 51 })).toBe('分成比例填 0–50 的整数')
    expect(ok({ ...teacher, shareRate: 12.5 })).toBe('分成比例填 0–50 的整数')
  })
})
