<template>
  <view class="player">
    <!-- 还没开始播：封面 + 播放键，写清楚要播哪一节、从哪接着看 -->
    <view v-if="!started" class="player__poster" @tap="start">
      <ArchImage class="player__fill" shape="rect" :src="cover" />
      <view class="player__shade" />
      <view class="player__play"><view class="player__tri" /></view>
      <view class="player__caption">
        <view class="player__title">{{ lesson.title }}</view>
        <view>{{ startAt > 0 ? `从 ${formatPlayTime(startAt)} 接着看` : `${formatPlayTime(lesson.durationSec)}` }}</view>
      </view>
    </view>

    <!-- 演示数据没有真视频：用计时代替播放，10 倍速，方便试进度 -->
    <view v-else-if="demo" class="player__demo" @tap="toggleDemo">
      <ArchImage class="player__fill" shape="rect" :src="cover" />
      <view class="player__shade" />
      <view class="player__demo-text">
        <view class="player__title">{{ lesson.title }}</view>
        <view>演示视频 · 10 倍速 · {{ demoPlaying ? '点一下暂停' : '已暂停，点一下继续' }}</view>
      </view>
      <view class="player__bar">
        <text>{{ formatPlayTime(demoPos) }}</text>
        <view class="player__track"><view class="player__done" :style="{ width: `${demoPos / lesson.durationSec * 100}%` }" /></view>
        <text>{{ formatPlayTime(lesson.durationSec) }}</text>
      </view>
    </view>

    <video
      v-else
      :key="lesson.id"
      class="player__video"
      :src="lesson.video"
      :initial-time="startAt"
      autoplay
      object-fit="contain"
      :show-fullscreen-btn="true"
      @timeupdate="onTime"
      @pause="emit('pause', pos)"
      @ended="onEnded"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 一节课的播放器。真视频用原生 video；src 以 placeholder: 开头时（演示数据）用计时模拟播放。
 * - time：播放中位置变了（秒）
 * - pause：暂停了，带当前位置
 * - ended：播完了
 * 换小节时父组件换 lesson 和 startAt，并决定要不要直接播（autoplay）。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Lesson } from '@/api'
import { formatPlayTime } from '@/utils/date'
import ArchImage from './ArchImage.vue'

defineOptions({ options: { virtualHost: true } })

const props = defineProps<{
  lesson: Lesson
  cover: string
  /** 从第几秒开始 */
  startAt: number
  /** 换了小节后直接播，不再显示封面 */
  autoplay?: boolean
}>()
const emit = defineEmits<{
  (e: 'time', sec: number): void
  (e: 'pause', sec: number): void
  (e: 'ended'): void
  (e: 'start'): void
}>()

const DEMO_SPEED = 10

const started = ref(false)
const demo = computed(() => props.lesson.video.startsWith('placeholder:'))
/** 当前位置，暂停时上报用 */
const pos = ref(0)

function start() {
  started.value = true
  pos.value = props.startAt
  emit('start')
  if (demo.value) playDemo()
}

watch(() => [props.lesson.id, props.startAt], () => {
  stopDemo()
  started.value = false
  if (props.autoplay) start()
})

function onTime(e: Event) {
  pos.value = (e as unknown as { detail: { currentTime: number } }).detail.currentTime
  emit('time', pos.value)
}

function onEnded() {
  pos.value = props.lesson.durationSec
  emit('ended')
}

// ---------- 演示播放 ----------

const demoPos = ref(0)
const demoPlaying = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function playDemo() {
  demoPos.value = Math.min(props.startAt, props.lesson.durationSec)
  resumeDemo()
}

function resumeDemo() {
  demoPlaying.value = true
  timer = setInterval(() => {
    demoPos.value = Math.min(props.lesson.durationSec, demoPos.value + DEMO_SPEED)
    pos.value = demoPos.value
    if (demoPos.value >= props.lesson.durationSec) {
      stopDemo()
      emit('ended')
    } else {
      emit('time', demoPos.value)
    }
  }, 1000)
}

function stopDemo() {
  demoPlaying.value = false
  clearInterval(timer)
  timer = undefined
}

function toggleDemo() {
  if (demoPlaying.value) {
    stopDemo()
    emit('pause', demoPos.value)
  } else if (demoPos.value < props.lesson.durationSec) {
    resumeDemo()
  }
}

/** 父组件离开页面时调用：停下演示计时，返回当前位置；没开始播返回 undefined */
function stop(): number | undefined {
  stopDemo()
  return started.value ? pos.value : undefined
}

onBeforeUnmount(stopDemo)

defineExpose({ stop })
</script>

<style lang="scss">
.player {
  position: relative;
  width: 750rpx;
  height: 422rpx;
  background: $ink;
  overflow: hidden;

  &__poster,
  &__demo,
  &__video,
  &__fill,
  &__shade {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  &__shade {
    background: linear-gradient(180deg, rgba($ink, 0) 40%, rgba($ink, 0.55));
  }

  &__play {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 112rpx;
    height: 112rpx;
    margin: -56rpx 0 0 -56rpx;
    border-radius: 50%;
    background: rgba($card, 0.9);
  }

  &__tri {
    position: absolute;
    top: 50%;
    left: 50%;
    margin: -20rpx 0 0 -10rpx;
    border-style: solid;
    border-width: 20rpx 0 20rpx 32rpx;
    border-color: transparent transparent transparent $mocha;
  }

  &__caption,
  &__demo-text {
    position: absolute;
    left: $page-x;
    right: $page-x;
    bottom: 28rpx;
    font-size: $fs-caption + 2rpx;
    color: rgba($card, 0.9);
  }

  &__demo-text {
    bottom: 96rpx;
  }

  &__title {
    margin-bottom: 4rpx;
    font-family: $font-serif;
    font-size: 32rpx;
    color: $card;
  }

  &__bar {
    position: absolute;
    left: $page-x;
    right: $page-x;
    bottom: 32rpx;
    display: flex;
    align-items: center;
    gap: 16rpx;
    font-size: $fs-caption;
    color: rgba($card, 0.9);
  }

  &__track {
    flex: 1;
    height: 6rpx;
    border-radius: $r-pill;
    background: rgba($card, 0.35);
    overflow: hidden;
  }

  &__done {
    height: 100%;
    background: $card;
  }
}
</style>
