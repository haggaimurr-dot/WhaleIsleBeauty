/**
 * 讲师授权说明。客人在录课邀请页看到、确认的就是这几条。
 * 改了内容要同时换 types.ts 的 TEACHER_AGREEMENT_VERSION（后端只认当前版本），已经确认过的讲师不受影响。
 * 这是给客人看的简要说明，正式的书面授权由店里另外签。
 */
import { TEACHER_AGREEMENT_VERSION } from '../api/types'

export const AGREEMENT_VERSION = TEACHER_AGREEMENT_VERSION

/** 怎么用你的视频、怎么分成 */
export function agreementTerms(shareRate: number): string[] {
  return [
    '你出镜录的课，放在鲸屿小程序的“课堂”里，客人可以免费看。',
    `客人从你的课点“预约同款”、到店做完的单，按这单项目标价的 ${shareRate}% 分给你。你自己约自己的课不算。`,
    '分成按到店的月份算，月底后店里打给你，每一笔在“我的课堂”里都能看到。',
    '按国家规定，劳务收入可能要代扣个税，打款前店里会和你说清楚。',
  ]
}

/** 你随时可以退出：安全感信息，页面上用鼠尾草绿 */
export const AGREEMENT_SAFETY = [
  '你的视频只用在鲸屿自己的小程序里，不会给别的商家，也不会拿你的名字做别的宣传。',
  '你随时可以在“我的课堂”里结束合作，结束后你出镜的课马上下架。已经记下的分成照常付。',
]

export const AGREEMENT_NOTE = '这是简要说明，店里会再和你签一份书面授权。'
