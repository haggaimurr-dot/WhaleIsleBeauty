<template>
  <PageLayout>
    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <template v-else-if="status === 'ok'">
      <view class="h">封面</view>
      <view class="pics">
        <view
          v-for="src in PICS"
          :key="src"
          class="pics__item"
          :class="{ 'pics__item--on': form.cover === src }"
          @tap="form.cover = src"
        >
          <ArchImage class="pics__img" shape="rect" :src="src" />
        </view>
      </view>
      <view class="hint">演示版先从这几个里选，以后可以从视频里截一张。</view>

      <view class="h">课程名</view>
      <view class="pad">
        <input v-model="form.title" class="field" placeholder="比如 五分钟通勤妆" placeholder-class="field__ph" :maxlength="LIMITS.courseTitle" />
      </view>

      <view class="h">一句话介绍</view>
      <view class="pad">
        <textarea
          v-model="form.summary"
          class="field field--area"
          placeholder="比如 赶时间也来得及的日常妆，跟着画一遍就会"
          placeholder-class="field__ph"
          :maxlength="LIMITS.courseSummary"
        />
      </view>

      <view class="h">风格</view>
      <view class="chips">
        <Chip v-for="c in CATEGORIES" :key="c" :label="CATEGORY_LABEL[c]" :selected="form.category === c" @click="form.category = c" />
      </view>

      <view class="h">讲师</view>
      <view class="chips">
        <Chip v-for="a in artists" :key="a.id" :label="a.name" :selected="form.lecturer === `a:${a.id}`" @click="pickLecturer(`a:${a.id}`)" />
        <Chip
          v-for="t in teacherChoices"
          :key="t.id"
          :label="`${t.name}（${t.status === 'active' ? '客人' : TEACHER_STATUS_LABEL[t.status]}）`"
          :selected="form.lecturer === `t:${t.id}`"
          @click="pickLecturer(`t:${t.id}`)"
        />
      </view>
      <view class="hint">{{ lecturerHint }}</view>

      <view class="h">同款项目<text class="h__opt">客人点“预约同款”时预选</text></view>
      <view class="chips">
        <Chip label="不关联" :selected="!form.serviceId" @click="form.serviceId = ''" />
        <Chip
          v-for="s in services"
          :key="s.id"
          :label="s.hidden ? `${s.name}（已下架）` : s.name"
          :selected="form.serviceId === s.id"
          @click="pickService(s)"
        />
      </view>

      <!-- 目录 -->
      <view class="h">目录<text class="h__opt">{{ lessonCount }} 节 · {{ formatCourseMinutes(totalSec) }}</text></view>
      <view v-for="(ch, ci) in form.chapters" :key="ci" class="chapter">
        <view class="chapter__head">
          <input
            v-model="ch.title"
            class="chapter__title"
            :placeholder="`第 ${ci + 1} 章的名字，比如 底妆`"
            placeholder-class="field__ph"
            :maxlength="LIMITS.chapterTitle"
          />
          <text v-if="ci > 0" class="chapter__act" @tap="moveChapter(ci)">往前挪</text>
          <text class="chapter__act" @tap="removeChapter(ci)">删掉</text>
        </view>
        <view
          v-for="(l, li) in ch.lessons"
          :key="l.id ?? `new-${ci}-${li}`"
          class="lesson"
          hover-class="lesson--hover"
          @tap="openLesson(ci, li)"
        >
          <text class="lesson__no">{{ lessonNo(ci, li) }}</text>
          <view class="lesson__main">
            <view class="lesson__title">{{ l.title || '还没起名字' }}</view>
            <view class="lesson__sub">
              {{ l.video ? formatPlayTime(l.durationSec) : '还没传视频' }}<text v-if="l.productIds.length"> · 用到 {{ l.productIds.length }} 件</text>
            </view>
          </view>
          <text class="lesson__go">修改</text>
        </view>
        <view class="chapter__add" @tap="openLesson(ci, -1)">＋ 加一节</view>
      </view>
      <view class="pad">
        <view v-if="form.chapters.length < LIMITS.chapters" class="add-chapter" @tap="addChapter">＋ 加一章</view>
      </view>

      <!-- 本课化妆品 -->
      <view class="h">本课用到的化妆品<text class="h__opt">每件写一句用法，客人边看边对照</text></view>
      <view v-if="form.products.length" class="plist">
        <view v-for="(p, i) in form.products" :key="p.productId" class="pitem">
          <view class="pitem__head">
            <text class="pitem__name">{{ productName(p.productId) }}</text>
            <text class="pitem__act" @tap="removeProduct(i)">去掉</text>
          </view>
          <input
            v-model="p.tip"
            class="pitem__tip"
            placeholder="怎么用，比如 挤一颗黄豆大就够（可以不写）"
            placeholder-class="field__ph"
            :maxlength="LIMITS.productTip"
          />
        </view>
      </view>
      <view class="pad">
        <view class="add-chapter" @tap="productsOpen = true">{{ form.products.length ? '＋ 再选几件' : '＋ 从店里的清单里选' }}</view>
      </view>

      <view class="h">给客人看</view>
      <view class="chips">
        <Chip label="上架" :selected="!form.hidden" @click="setHidden(false)" />
        <Chip label="先不上架" :selected="form.hidden" @click="setHidden(true)" />
      </view>
      <view class="hint">{{ form.hidden ? '下架的课客人看不到，分享出去的链接也打不开。' : '上架后客人在“课堂”和首页能看到。' }}</view>

      <view class="pad">
        <view class="policy">出镜的人要先同意。顾客讲师只能用确认过授权的；化妆师自己录的，也先说好。</view>
      </view>

      <view v-if="id" class="remove">
        <AppButton variant="ghost" size="sm" :loading="removing" loading-text="正在删除…" @click="remove">删除这门课</AppButton>
      </view>
      <view v-else class="gap" />
    </template>

    <template #footer>
      <BottomBar v-if="status === 'ok'" :desc="id ? '改了马上生效' : '添加后排在“课堂”最前面'">
        <AppButton :disabled="!dirty" :loading="saving" loading-text="正在保存…" @click="save">
          {{ id ? '保存修改' : '添加课程' }}
        </AppButton>
      </BottomBar>
    </template>

    <!-- 编辑一节 -->
    <BottomSheet v-model:open="lessonOpen" @closed="editing = undefined">
      <view v-if="editing" class="sheet">
        <view class="sheet__title">{{ editing.li < 0 ? '加一节' : `第 ${lessonNo(editing.ci, editing.li)} 节` }}</view>

        <view class="sheet__h">小节名</view>
        <input
          v-model="editing.draft.title"
          class="field"
          placeholder="比如 粉底怎么推开"
          placeholder-class="field__ph"
          :maxlength="LIMITS.lessonTitle"
        />

        <view class="sheet__h">视频</view>
        <view class="video">
          <view class="video__main">
            <view class="video__state">{{ videoText }}</view>
            <view class="video__hint">一节最长 {{ LIMITS.maxLessonSec / 60 }} 分钟，竖拍横拍都可以</view>
          </view>
          <AppButton variant="ghost" size="sm" :loading="uploading >= 0" :loading-text="`上传 ${uploading}%`" @click="pickVideo">
            {{ editing.draft.video ? '换一个' : '选视频' }}
          </AppButton>
        </view>

        <view class="sheet__h">这一节用到</view>
        <view v-if="form.products.length" class="sheet__chips">
          <Chip
            v-for="p in form.products"
            :key="p.productId"
            :label="productName(p.productId)"
            :selected="editing.draft.productIds.includes(p.productId)"
            @click="toggleLessonProduct(p.productId)"
          />
        </view>
        <view v-else class="hint hint--flush">先在“本课用到的化妆品”里选几件，这里才能勾。</view>

        <view class="sheet__acts">
          <AppButton v-if="editing.li >= 0" variant="ghost" size="sm" @click="removeLesson">删掉这一节</AppButton>
          <AppButton v-if="editing.li > 0" variant="ghost" size="sm" @click="moveLesson">往前挪</AppButton>
          <AppButton size="sm" :disabled="uploading >= 0" @click="commitLesson">好了</AppButton>
        </view>
      </view>
    </BottomSheet>

    <!-- 选化妆品 -->
    <BottomSheet v-model:open="productsOpen">
      <view class="sheet">
        <view class="sheet__title">本课用到的化妆品</view>
        <view v-if="!shopProducts.length" class="hint hint--flush">店里的化妆品清单还是空的，先去“门店资料 → 化妆品”加几件。</view>
        <view v-for="g in productGroups" :key="g.category">
          <view class="sheet__h">{{ PRODUCT_CATEGORY_LABEL[g.category] }}</view>
          <view class="sheet__chips">
            <Chip
              v-for="p in g.items"
              :key="p.id"
              :label="`${p.brand} ${p.name}`"
              :selected="form.products.some(x => x.productId === p.id)"
              @click="toggleProduct(p.id)"
            />
          </view>
        </view>
        <view class="sheet__acts">
          <AppButton size="sm" @click="productsOpen = false">好了</AppButton>
        </view>
      </view>
    </BottomSheet>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  api, errorText, chooseAndUploadVideo, cleanCourse, validateCourse, LIMITS,
  CATEGORY_LABEL, PRODUCT_CATEGORY_LABEL, TEACHER_STATUS_LABEL,
  type Artist, type Course, type CourseInput, type ID, type Product, type ProductCategory,
  type Service, type StyleCategory, type Teacher,
} from '@/api'
import { formatCourseMinutes, formatPlayTime } from '@/utils/date'
import AppButton from '@/components/AppButton.vue'
import ArchImage from '@/components/ArchImage.vue'
import BottomBar from '@/components/BottomBar.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import Chip from '@/components/Chip.vue'
import PageLayout from '@/components/PageLayout.vue'

const PICS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map(g => `placeholder:${g}`)
const CATEGORIES = Object.keys(CATEGORY_LABEL) as StyleCategory[]

const id = ref<ID>('')
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
const artists = ref<Artist[]>([])
const teachers = ref<Teacher[]>([])
const services = ref<Service[]>([])
const shopProducts = ref<Product[]>([])

// ---------- 表单 ----------

interface LessonDraft { id?: ID; title: string; video: string; durationSec: number; productIds: ID[] }
/** lecturer：'a:化妆师id' 或 't:讲师id'，没选是空字符串 */
interface Form {
  title: string; summary: string; category?: StyleCategory; cover: string
  lecturer: string; serviceId: ID
  chapters: { title: string; lessons: LessonDraft[] }[]
  products: { productId: ID; tip: string }[]
  hidden: boolean
}
const empty = (): Form => ({
  title: '', summary: '', category: undefined, cover: PICS[3], lecturer: '', serviceId: '',
  chapters: [{ title: '', lessons: [] }], products: [], hidden: false,
})
const form = reactive<Form>(empty())
const saved = ref<Form>(empty())

function toInput(f: Form): CourseInput {
  return cleanCourse({
    title: f.title, summary: f.summary, category: f.category as StyleCategory, cover: f.cover,
    artistId: f.lecturer.startsWith('a:') ? f.lecturer.slice(2) : undefined,
    teacherId: f.lecturer.startsWith('t:') ? f.lecturer.slice(2) : undefined,
    serviceId: f.serviceId || undefined,
    chapters: f.chapters,
    products: f.products,
    hidden: f.hidden,
  })
}

function toForm(c: Course): Form {
  return {
    title: c.title, summary: c.summary, category: c.category, cover: c.cover,
    lecturer: c.artistId ? `a:${c.artistId}` : c.teacherId ? `t:${c.teacherId}` : '',
    serviceId: c.serviceId ?? '',
    chapters: c.chapters.map(ch => ({ title: ch.title, lessons: ch.lessons.map(l => ({ ...l, productIds: [...l.productIds] })) })),
    products: c.products.map(p => ({ productId: p.id, tip: p.tip ?? '' })),
    hidden: !!c.hidden,
  }
}

const dirty = computed(() => JSON.stringify(toInput(form)) !== JSON.stringify(toInput(saved.value)))

const allLessons = computed(() => form.chapters.flatMap(ch => ch.lessons))
const lessonCount = computed(() => allLessons.value.length)
const totalSec = computed(() => allLessons.value.reduce((n, l) => n + (l.durationSec || 0), 0))
const lessonNo = (ci: number, li: number) =>
  form.chapters.slice(0, ci).reduce((n, ch) => n + ch.lessons.length, 0) + li + 1

// ---------- 讲师 ----------

/** 结束合作的讲师不能再选，除非这门课本来就是 TA 的 */
const teacherChoices = computed(() =>
  teachers.value.filter(t => t.status !== 'ended' || form.lecturer === `t:${t.id}`))

const pickedTeacher = computed(() =>
  form.lecturer.startsWith('t:') ? teachers.value.find(t => t.id === form.lecturer.slice(2)) : undefined)

/** 讲师还没确认或已经结束：只能存成下架 */
const mustHide = computed(() => !!pickedTeacher.value && pickedTeacher.value.status !== 'active')

function pickLecturer(v: string) {
  form.lecturer = v
  if (mustHide.value) form.hidden = true
}

const lecturerHint = computed(() => {
  const t = pickedTeacher.value
  if (!t) return form.lecturer ? '店里的化妆师录的，不算分成。' : '店里的化妆师，或者确认过授权的客人。'
  if (t.status === 'invited') return 'TA 还没确认授权，先存成下架，确认后再上架。'
  if (t.status === 'ended') return '和 TA 的合作已经结束了，这门课不能再上架。'
  return `客人从这门课来、到店做完的单，按 ${t.shareRate}% 分给 TA。`
})

function setHidden(v: boolean) {
  if (!v && mustHide.value) {
    uni.showToast({ title: lecturerHint.value, icon: 'none', duration: 2500 })
    return
  }
  form.hidden = v
}

function pickService(s: Service) {
  form.serviceId = s.id
  if (!form.category) form.category = s.category
}

// ---------- 章节 ----------

function addChapter() {
  form.chapters.push({ title: '', lessons: [] })
}

function moveChapter(ci: number) {
  const [ch] = form.chapters.splice(ci, 1)
  form.chapters.splice(ci - 1, 0, ch)
}

function removeChapter(ci: number) {
  const ch = form.chapters[ci]
  const drop = () => form.chapters.splice(ci, 1)
  if (!ch.lessons.length) return drop()
  uni.showModal({
    title: '删掉这一章？',
    content: `里面的 ${ch.lessons.length} 节也一起删掉，保存后才生效。`,
    confirmText: '删掉',
    cancelText: '先不删',
    success: r => { if (r.confirm) drop() },
  })
}

// ---------- 小节 ----------

const lessonOpen = ref(false)
/** li 为 -1 表示新加的一节 */
const editing = ref<{ ci: number; li: number; draft: LessonDraft }>()
const uploading = ref(-1)

function openLesson(ci: number, li: number) {
  const l = form.chapters[ci].lessons[li]
  if (li < 0 && form.chapters[ci].lessons.length >= LIMITS.lessons) {
    uni.showToast({ title: `每章最多 ${LIMITS.lessons} 节`, icon: 'none' })
    return
  }
  editing.value = {
    ci, li,
    draft: l ? { ...l, productIds: [...l.productIds] } : { title: '', video: '', durationSec: 0, productIds: [] },
  }
  lessonOpen.value = true
}

const videoText = computed(() => {
  const d = editing.value?.draft
  if (!d?.video) return '还没传视频'
  return `已传好 · ${formatPlayTime(d.durationSec)}`
})

async function pickVideo() {
  const e = editing.value
  if (!e || uploading.value >= 0) return
  try {
    uploading.value = 0
    const v = await chooseAndUploadVideo(p => { uploading.value = Math.round(p) })
    if (v) {
      e.draft.video = v.video
      e.draft.durationSec = v.durationSec
    }
  } catch (err) {
    uni.showToast({ title: errorText(err), icon: 'none', duration: 3000 })
  } finally {
    uploading.value = -1
  }
}

function toggleLessonProduct(pid: ID) {
  const ids = editing.value?.draft.productIds
  if (!ids) return
  const i = ids.indexOf(pid)
  if (i >= 0) ids.splice(i, 1)
  else ids.push(pid)
}

function commitLesson() {
  const e = editing.value
  if (!e) return
  if (!e.draft.title.trim()) {
    uni.showToast({ title: '给这一节起个名字', icon: 'none' })
    return
  }
  const lessons = form.chapters[e.ci].lessons
  if (e.li < 0) lessons.push(e.draft)
  else lessons.splice(e.li, 1, e.draft)
  lessonOpen.value = false
}

function removeLesson() {
  const e = editing.value
  if (!e || e.li < 0) return
  form.chapters[e.ci].lessons.splice(e.li, 1)
  lessonOpen.value = false
}

function moveLesson() {
  const e = editing.value
  if (!e || e.li <= 0) return
  const lessons = form.chapters[e.ci].lessons
  lessons.splice(e.li, 1)
  lessons.splice(e.li - 1, 0, e.draft)
  lessonOpen.value = false
}

// ---------- 化妆品 ----------

const productsOpen = ref(false)

const productGroups = computed(() =>
  (Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[])
    .map(c => ({ category: c, items: shopProducts.value.filter(p => p.category === c) }))
    .filter(g => g.items.length))

const productName = (pid: ID) => {
  const p = shopProducts.value.find(x => x.id === pid)
  return p ? `${p.brand} ${p.name}` : '已经删掉的化妆品'
}

function toggleProduct(pid: ID) {
  const i = form.products.findIndex(p => p.productId === pid)
  if (i >= 0) removeProduct(i)
  else if (form.products.length >= LIMITS.courseProducts) uni.showToast({ title: `最多选 ${LIMITS.courseProducts} 件`, icon: 'none' })
  else form.products.push({ productId: pid, tip: '' })
}

/** 去掉后，小节里勾的也一起去掉 */
function removeProduct(i: number) {
  const [p] = form.products.splice(i, 1)
  for (const l of allLessons.value) {
    const j = l.productIds.indexOf(p.productId)
    if (j >= 0) l.productIds.splice(j, 1)
  }
}

// ---------- 加载 ----------

function fill(f: Form) {
  saved.value = JSON.parse(JSON.stringify(f))
  Object.assign(form, JSON.parse(JSON.stringify(f)))
}

async function load() {
  status.value = 'loading'
  try {
    const [a, t, s, p, c] = await Promise.all([
      api.listArtists(), api.listTeachers(), api.listOwnerServices(), api.listProducts(),
      id.value ? api.getOwnerCourse(id.value) : Promise.resolve(undefined),
    ])
    artists.value = a
    teachers.value = t
    services.value = s
    shopProducts.value = p
    if (c) {
      fill(toForm(c))
      uni.setNavigationBarTitle({ title: c.title })
    } else {
      fill({ ...empty(), lecturer: a.length === 1 ? `a:${a[0].id}` : '' })
    }
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onLoad((query) => {
  id.value = query?.id ?? ''
  if (!id.value) uni.setNavigationBarTitle({ title: '添加课程' })
  load()
})

// ---------- 保存 ----------

const saving = ref(false)
const toast = (title: string, duration = 2500) => uni.showToast({ title, icon: 'none', duration })

async function save() {
  if (!dirty.value || saving.value) return
  const input = toInput(form)
  const msg = validateCourse(input)
  if (msg) return toast(msg)
  saving.value = true
  try {
    const c = id.value ? await api.updateCourse(id.value, input) : await api.createCourse(input)
    fill(toForm(c))
    toast(id.value ? '存好了' : '添加好了', 1200)
    setTimeout(() => uni.navigateBack(), 1200)
  } catch (e) {
    toast(errorText(e), 3000)
  } finally {
    saving.value = false
  }
}

// ---------- 删除 ----------

const removing = ref(false)

function remove() {
  if (removing.value) return
  uni.showModal({
    title: `删除${saved.value.title}？`,
    content: '删掉后客人就看不到了，看过的进度也一起删掉。已经记下的分成不受影响。',
    confirmText: '删除',
    cancelText: '先不删',
    success: async (r) => {
      if (!r.confirm) return
      removing.value = true
      try {
        await api.deleteCourse(id.value)
        toast('删好了', 1200)
        setTimeout(() => uni.navigateBack(), 1200)
      } catch (e) {
        toast(errorText(e), 3000)
      } finally {
        removing.value = false
      }
    },
  })
}
</script>

<style lang="scss">
.pad {
  padding: 0 $page-x;
}

.h {
  margin: 44rpx $page-x 20rpx;
  font-size: 30rpx;
  font-weight: 600;

  &__opt {
    margin-left: 16rpx;
    font-size: $fs-caption;
    font-weight: normal;
    color: $mute;
  }
}

.hint {
  margin: 16rpx $page-x 0;
  font-size: $fs-caption;
  line-height: 1.6;
  color: $mute;

  &--flush {
    margin: 0;
  }
}

.field {
  box-sizing: border-box;
  width: 100%;
  height: 92rpx;
  padding: 0 28rpx;
  border-radius: $r-inner;
  background: $card;
  font-size: $fs-body;
  color: $ink;

  &--area {
    height: 168rpx;
    padding: 24rpx 28rpx;
    line-height: 1.6;
  }

  &__ph {
    color: $disabled;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 0 $page-x;
}

.pics {
  display: flex;
  justify-content: space-between;
  padding: 0 $page-x;

  &__item {
    padding: 6rpx;
    border-radius: $r-small;

    &--on {
      box-shadow: 0 0 0 3rpx $rose;
    }
  }

  &__img {
    width: 88rpx;
    height: 110rpx;
    border-radius: $r-small;
  }
}

.chapter {
  margin: 0 $page-x $gap;
  border-radius: $r-card;
  background: $card;
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 20rpx 32rpx;
    border-bottom: 2rpx solid $hair;
  }

  &__title {
    flex: 1;
    height: 64rpx;
    font-size: $fs-body;
    font-weight: 600;
    color: $ink;
  }

  &__act {
    flex: none;
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }

  &__add {
    padding: 24rpx 32rpx;
    font-size: $fs-small;
    color: $mocha;
  }
}

.lesson {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid $hair;

  &--hover {
    background: $milk;
  }

  &__no {
    flex: none;
    width: 40rpx;
    font-family: $font-serif;
    color: $mute;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: $fs-body;
    color: $ink;
  }

  &__sub {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
  }

  &__go {
    flex: none;
    font-size: $fs-small;
    color: $mocha;
  }
}

.add-chapter {
  padding: 28rpx 0;
  border: 2rpx dashed $disabled;
  border-radius: $r-card;
  text-align: center;
  font-size: $fs-small;
  color: $mocha;
}

.plist {
  margin: 0 $page-x $gap;
  border-radius: $r-card;
  background: $card;
  overflow: hidden;
}

.pitem {
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid $hair;

  &:last-child {
    border-bottom: none;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 20rpx;
  }

  &__name {
    flex: 1;
    min-width: 0;
    font-size: $fs-body;
    color: $ink;
  }

  &__act {
    flex: none;
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }

  &__tip {
    margin-top: 12rpx;
    height: 64rpx;
    padding: 0 20rpx;
    border-radius: $r-small;
    background: $milk;
    font-size: $fs-small;
    color: $ink;
  }
}

.policy {
  margin-top: 44rpx;
  padding: 24rpx 28rpx;
  border-radius: $r-inner;
  background: $sage-bg;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;
  color: $sage-ink;
}

.remove {
  display: flex;
  justify-content: center;
  margin: 64rpx 0 48rpx;
}

.gap {
  height: 48rpx;
}

.sheet {
  max-height: 70vh;
  padding: 8rpx $page-x 0;
  overflow-y: auto;
  @include safe-bottom(32rpx);

  &__title {
    font-family: $font-serif;
    font-size: $fs-h2;
    letter-spacing: $ls-display;
  }

  &__h {
    margin: 32rpx 0 16rpx;
    font-size: $fs-small;
    font-weight: 600;
    color: $ink;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
  }

  &__acts {
    display: flex;
    justify-content: flex-end;
    gap: 20rpx;
    margin-top: 40rpx;
  }

  .field {
    background: $milk;
  }
}

.video {
  display: flex;
  align-items: center;
  gap: $gap;
  padding: 24rpx 28rpx;
  border-radius: $r-inner;
  background: $milk;

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__state {
    font-size: $fs-body;
    color: $ink;
  }

  &__hint {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
  }
}

.panel {
  margin: 40rpx $page-x;
  padding: 64rpx 40rpx;
  border-radius: 40rpx;
  background: $card;
  text-align: center;

  &__text {
    margin-bottom: 32rpx;
    font-size: $fs-small;
    line-height: 1.7;
    color: $mute;
  }
}
</style>
