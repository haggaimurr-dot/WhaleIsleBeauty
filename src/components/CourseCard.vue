<template>
  <view class="course-card" hover-class="course-card--hover" @tap="emit('click')">
    <!-- 组件里的 ArchImage 拿不到这里的 class 样式（样式隔离），尺寸放在外层 -->
    <view class="course-card__cover"><ArchImage shape="rect" :src="course.cover" fill /></view>
    <view class="course-card__body">
      <view class="course-card__title">
        <text>{{ course.title }}</text>
        <text v-if="course.hidden" class="course-card__badge">已下架</text>
      </view>
      <view class="course-card__summary">{{ course.summary }}</view>
      <view class="course-card__teacher">
        <view class="course-card__avatar"><ArchImage :src="course.teacher.avatar" fill /></view>
        <text class="course-card__name">{{ course.teacher.name }}</text>
        <text v-if="course.teacher.kind === 'customer'" class="course-card__kind">客人分享</text>
      </view>
      <view class="course-card__meta">{{ course.lessonCount }} 节 · {{ formatCourseMinutes(course.durationSec) }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 课程卡片：课堂列表、我的课堂、店主的课程列表共用。点击发出 click。
 * 封面用普通圆角（拱形只留给人像），讲师头像用小拱形。
 */
import type { CourseSummary } from '@/api'
import { formatCourseMinutes } from '@/utils/date'
import ArchImage from './ArchImage.vue'

defineOptions({ options: { virtualHost: true } })

defineProps<{ course: CourseSummary }>()
const emit = defineEmits<{ (e: 'click'): void }>()
</script>

<style lang="scss">
.course-card {
  display: flex;
  gap: $gap;
  margin: 0 $page-x $gap;
  padding: $gap;
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-soft;

  &--hover {
    opacity: 0.85;
  }

  &__cover {
    flex: none;
    width: 176rpx;
    height: 220rpx;
    border-radius: $r-inner;
    overflow: hidden;
  }

  &__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  &__title {
    font-family: $font-serif;
    font-weight: $fw-heading;
    font-size: 32rpx;
    letter-spacing: $ls-display;
    color: $ink;
  }

  &__badge {
    margin-left: 12rpx;
    padding: 2rpx 12rpx;
    border-radius: $r-pill;
    background: $milk;
    font-family: $font-sans;
    font-size: $fs-caption;
    color: $mute;
  }

  &__summary {
    margin-top: 8rpx;
    font-size: $fs-caption + 2rpx;
    line-height: 1.6;
    color: $mute;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__teacher {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-top: auto;
    padding-top: 12rpx;
    font-size: $fs-caption + 2rpx;
    color: $ink;
  }

  &__avatar {
    flex: none;
    width: 36rpx;
    height: 46rpx;
  }

  &__kind {
    padding: 2rpx 12rpx;
    border-radius: $r-pill;
    background: $blush;
    font-size: $fs-caption;
    color: $blush-ink;
  }

  &__meta {
    margin-top: 6rpx;
    font-size: $fs-caption;
    color: $mute;
  }
}
</style>
