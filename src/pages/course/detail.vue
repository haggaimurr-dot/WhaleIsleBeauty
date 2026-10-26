<template>
  <PageLayout>
    <template #header>
      <LessonPlayer
        v-if="course && lesson"
        ref="player"
        :lesson="lesson"
        :cover="course.cover"
        :start-at="startAt"
        :autoplay="autoplay"
        @start="onStart"
        @time="onTime"
        @pause="onPause"
        @ended="onEnded"
      />
    </template>

    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton v-if="gone" variant="ghost" size="sm" @click="toList">看看别的课</AppButton>
      <AppButton v-else variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <view v-else-if="course" class="body">
      <view class="title">{{ course.title }}</view>
      <view class="meta">{{ CATEGORY_LABEL[course.category] }} · {{ course.lessonCount }} 节 · {{ formatCourseMinutes(course.durationSec) }}</view>
      <view class="summary">{{ course.summary }}</view>

      <view class="teacher">
        <ArchImage class="teacher__avatar" :src="course.teacher.avatar" />
        <view class="teacher__text">
          <view class="teacher__name">{{ course.teacher.name }}</view>
          <view class="teacher__intro">{{ teacherIntro }}</view>
        </view>
      </view>

      <!-- 这一节用到的：边看边对照 -->
      <view v-if="lessonProducts.length" class="box">
        <view class="box__title">这一节用到</view>
        <view v-for="p in lessonProducts" :key="p.id" class="use">
          <text class="use__brand">{{ p.brand }}</text>{{ p.name }}
          <view v-if="p.tip" class="use__tip">{{ p.tip }}</view>
        </view>
      </view>

      <view class="h">目录</view>
      <view class="box box--flush">
        <view v-for="(ch, ci) in course.chapters" :key="ci" class="chapter">
          <view v-if="course.chapters.length > 1" class="chapter__title">{{ ch.title }}</view>
          <view
            v-for="l in ch.lessons"
            :key="l.id"
            class="lesson"
            :class="{ 'lesson--on': l.id === lesson?.id }"
            hover-class="lesson--hover"
            @tap="pick(l)"
          >
            <text class="lesson__no">{{ lessonNo(l.id) }}</text>
            <view class="lesson__main">
              <view class="lesson__title">{{ l.title }}</view>
              <view class="lesson__sub">{{ formatPlayTime(l.durationSec) }}<text v-if="l.productIds.length"> · 用到 {{ l.productIds.length }} 件</text></view>
            </view>
            <text class="lesson__state">{{ l.id === lesson?.id ? '正在看' : finished.has(l.id) ? '看过了' : '' }}</text>
          </view>
        </view>
      </view>

      <template v-if="course.products.length">
        <view class="h">本课用到的化妆品<text class="h__opt">{{ course.products.length }} 件</text></view>
        <view class="box box--flush">
          <view v-for="p in course.products" :key="p.id" class="item">
            <view class="item__brand">{{ p.brand }}</view>
            <view class="item__name">{{ p.name }}</view>
            <view v-if="p.tip" class="item__tip">{{ p.tip }}</view>
            <view v-if="usedIn(p.id)" class="item__used">{{ usedIn(p.id) }}用到</view>
          </view>
        </view>
        <view class="more" @tap="toProducts">店里全部化妆品 ›</view>
      </template>

      <view class="bottom-space" />
    </view>

    <template #footer>
      <BottomBar v-if="course" :title="barTitle" :desc="barDesc">
        <AppButton @click="toBooking">预约同款</AppButton>
      </BottomBar>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onHide, onLoad, onShareAppMessage, onShareTimeline, onUnload } from '@dcloudio/uni-app'
import {
  api, errorText, ApiError, CATEGORY_LABEL,
  type Course, type ID, type Lesson, type Service,
} from '@/api'
import { formatCourseMinutes, formatPlayTime } from '@/utils/date'
import { formatPrice } from '@/utils/money'
import { isSinglePage, SHOP_NAME, shareImage, sharePath, shareQuery } from '@/utils/share'
import { switchTab } from '@/utils/tab'
import AppButton from '@/components/AppButton.vue'
import ArchImage from '@/components/ArchImage.vue'
import BottomBar from '@/components/BottomBar.vue'
import LessonPlayer from '@/components/LessonPlayer.vue'
import PageLayout from '@/components/PageLayout.vue'

/** 播放中多久记一次进度（秒） */
const SAVE_EVERY = 15

const courseId = ref<ID>('')
const course = ref<Course>()
const service = ref<Service>()
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
/** 课下架了（或者被删了），不用“再试一次” */
const gone = ref(false)

const player = ref<InstanceType<typeof LessonPlayer>>()
const lesson = ref<Lesson>()
const startAt = ref(0)
const autoplay = ref(false)
const finished = ref(new Set<ID>())

const lessons = computed(() => course.value?.chapters.flatMap(ch => ch.lessons) ?? [])
const lessonNo = (id: ID) => lessons.value.findIndex(l => l.id === id) + 1

const lessonProducts = computed(() =>
  (lesson.value?.productIds ?? []).flatMap(id => course.value?.products.find(p => p.id === id) ?? []))

/** 例如“第 2、3 节” */
function usedIn(productId: ID) {
  const nos = lessons.value.filter(l => l.productIds.includes(productId)).map(l => lessonNo(l.id))
  return nos.length ? `第 ${nos.join('、')} 节` : ''
}

const teacherIntro = computed(() => {
  const t = course.value?.teacher
  if (!t) return ''
  // 顾客讲师说清楚是谁：客人自己录的，不是店里的化妆师
  return t.kind === 'customer' ? (t.intro ? `客人分享 · ${t.intro}` : '常来的客人，自己录的') : `化妆师${t.intro ? ` · ${t.intro}` : ''}`
})

const barTitle = computed(() => service.value?.name ?? '想让化妆师来画？')
const barDesc = computed(() => {
  const s = service.value
  if (!s) return '课里没讲清楚的，到店手把手教'
  return `${formatPrice(s.price, { from: s.priceFrom })} · 定金 ${formatPrice(s.deposit)}，到店付尾款`
})

// ---------- 加载 ----------

async function load() {
  status.value = 'loading'
  try {
    const c = await api.getCourse(courseId.value)
    course.value = c
    uni.setNavigationBarTitle({ title: c.title })
    finished.value = new Set(c.progress?.finishedLessonIds)
    resume(c)
    status.value = 'ok'
    // 只用来在底栏显示价格，拿不到就不显示
    service.value = c.serviceId ? await api.getService(c.serviceId).catch(() => undefined) : undefined
  } catch (e) {
    gone.value = e instanceof ApiError && e.code === 'NOT_FOUND'
    errorMsg.value = gone.value ? '这门课已经下架了，看看别的吧' : errorText(e)
    status.value = 'error'
  }
}

/** 接着上次看：上次那节看完了就从下一节开头 */
function resume(c: Course) {
  const all = c.chapters.flatMap(ch => ch.lessons)
  const p = c.progress
  const last = p && all.find(l => l.id === p.lessonId)
  autoplay.value = false
  if (!last || !p) {
    lesson.value = all[0]
    startAt.value = 0
  } else if (p.positionSec >= last.durationSec - 5) {
    const next = all[all.indexOf(last) + 1]
    lesson.value = next ?? last
    startAt.value = 0
  } else {
    lesson.value = last
    startAt.value = p.positionSec
  }
}

onLoad((query) => {
  courseId.value = query?.id ?? ''
  load()
})

// ---------- 进度 ----------

let lastSaved = 0

/** 朋友圈单页模式没登录，不记 */
function save(sec: number) {
  const l = lesson.value
  if (!l || isSinglePage()) return
  lastSaved = sec
  if (sec >= l.durationSec - 5) finished.value.add(l.id)
  api.saveCourseProgress(courseId.value, { lessonId: l.id, positionSec: sec }).catch(() => {})
}

function onStart() {
  lastSaved = startAt.value
}

function onTime(sec: number) {
  if (Math.abs(sec - lastSaved) >= SAVE_EVERY) save(sec)
}

const onPause = (sec: number) => save(sec)

/** 看完一节自动接下一节 */
function onEnded() {
  const l = lesson.value
  if (!l) return
  save(l.durationSec)
  const next = lessons.value[lessons.value.indexOf(l) + 1]
  if (next) play(next, 0)
}

function play(l: Lesson, at: number) {
  autoplay.value = true
  lesson.value = l
  startAt.value = at
}

function pick(l: Lesson) {
  if (l.id === lesson.value?.id) return
  const at = player.value?.stop()
  if (at !== undefined) save(at)
  play(l, 0)
}

function leave() {
  const at = player.value?.stop()
  if (at !== undefined && at !== lastSaved) save(at)
}
onHide(leave)
onUnload(leave)

// ---------- 分享和跳转 ----------

function shareTitle() {
  const c = course.value
  return c ? `${c.title}｜${c.teacher.name}的小课，${c.lessonCount} 节` : `${SHOP_NAME}｜课堂`
}
onShareAppMessage(() => ({
  title: shareTitle(),
  path: sharePath('/pages/course/detail', { id: courseId.value }),
  imageUrl: shareImage(course.value?.cover),
}))
onShareTimeline(() => ({
  title: shareTitle(),
  query: shareQuery({ id: courseId.value }),
  imageUrl: shareImage(course.value?.cover),
}))

/** 预选课里的项目和化妆师（化妆师自己录的才预选），并记下是从这门课来的 */
function toBooking() {
  const c = course.value
  if (!c) return
  switchTab('booking', { serviceId: c.serviceId, artistId: c.artistId, courseId: c.id })
}

function toList() {
  if (getCurrentPages().length > 1) uni.navigateBack()
  else uni.redirectTo({ url: '/pages/course/index' })
}

const toProducts = () => uni.navigateTo({ url: '/pages/products/index' })
</script>

<style lang="scss">
.body {
  padding: 36rpx $page-x 0;
}

.title {
  font-family: $font-serif;
  font-weight: $fw-display;
  font-size: $fs-title;
  letter-spacing: $ls-display;
}

.meta {
  margin-top: 8rpx;
  font-size: $fs-caption + 2rpx;
  color: $mute;
}

.summary {
  margin-top: 20rpx;
  font-size: $fs-small;
  line-height: $lh-body;
  color: $ink;
}

.teacher {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin: 32rpx 0 36rpx;

  &__avatar {
    flex: none;
    width: 72rpx;
    height: 92rpx;
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: $fs-body;
    font-weight: 600;
  }

  &__intro {
    margin-top: 4rpx;
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }
}

.h {
  margin: 44rpx 0 20rpx;
  font-family: $font-serif;
  font-weight: $fw-heading;
  font-size: 32rpx;
  letter-spacing: $ls-display;

  &__opt {
    margin-left: 12rpx;
    font-family: $font-sans;
    font-size: $fs-caption;
    color: $mute;
  }
}

.box {
  padding: 32rpx;
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-soft;

  &--flush {
    padding: 0;
    overflow: hidden;
  }

  &__title {
    margin-bottom: 16rpx;
    font-size: $fs-body;
    font-weight: 600;
  }
}

.use {
  padding: 12rpx 0;
  font-size: $fs-small;
  color: $ink;

  &__brand {
    margin-right: 12rpx;
    color: $mute;
  }

  &__tip {
    margin-top: 4rpx;
    font-size: $fs-caption + 2rpx;
    line-height: 1.6;
    color: $mute;
  }
}

.chapter {
  &__title {
    padding: 28rpx 32rpx 8rpx;
    font-size: $fs-caption + 2rpx;
    font-weight: 600;
    color: $mute;
  }
}

.lesson {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  border-bottom: 2rpx solid $hair;

  .chapter:last-child &:last-child {
    border-bottom: none;
  }

  &--hover {
    background: $milk;
  }

  &--on {
    background: $blush;
  }

  &__no {
    flex: none;
    width: 40rpx;
    font-family: $font-serif;
    font-size: $fs-body;
    color: $mute;
  }

  &--on &__no,
  &--on &__title {
    color: $mocha;
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

  &__state {
    flex: none;
    font-size: $fs-caption;
    color: $mute;
  }

  &--on &__state {
    color: $mocha;
  }
}

.item {
  padding: 28rpx 32rpx;
  border-bottom: 2rpx solid $hair;

  &:last-child {
    border-bottom: none;
  }

  &__brand {
    font-size: $fs-caption;
    letter-spacing: 0.04em;
    color: $mute;
  }

  &__name {
    margin-top: 4rpx;
    font-size: $fs-body;
    color: $ink;
  }

  &__tip {
    margin-top: 6rpx;
    font-size: $fs-caption + 2rpx;
    line-height: 1.6;
    color: $ink;
  }

  &__used {
    margin-top: 6rpx;
    font-size: $fs-caption;
    color: $mute;
  }
}

.more {
  margin-top: 20rpx;
  text-align: right;
  font-size: $fs-caption + 2rpx;
  color: $mute;
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

.bottom-space {
  height: 48rpx;
}
</style>
