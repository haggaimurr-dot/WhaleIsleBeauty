<template>
  <PageLayout>
    <template #header>
      <view class="psub">请常来的客人录课：发邀请给 TA，TA 看过授权说明、确认后就能上架 TA 的课。客人从 TA 的课来、到店做完的单，按比例分给 TA。</view>
    </template>

    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <view v-else-if="status === 'ok' && !teachers.length" class="panel">
      <view class="panel__text">还没有讲师。店里的化妆师录课不用加在这里，直接在课程里选就好。</view>
    </view>

    <view v-else-if="status === 'ok'" class="list">
      <view v-for="t in teachers" :key="t.id" class="row" hover-class="row--hover" @tap="openEdit(t.id)">
        <ArchImage class="row__avatar" :src="t.avatar" />
        <view class="row__main">
          <view class="row__title">{{ t.name }}</view>
          <view class="row__desc">分成 {{ t.shareRate }}%　{{ courseCount(t.id) }} 门课</view>
        </view>
        <text class="row__status" :class="`row__status--${t.status}`">{{ TEACHER_STATUS_LABEL[t.status] }}</text>
      </view>
    </view>

    <template #footer>
      <BottomBar v-if="status === 'ok'">
        <AppButton @click="openEdit()">邀请讲师</AppButton>
      </BottomBar>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, errorText, TEACHER_STATUS_LABEL, type CourseSummary, type ID, type Teacher } from '@/api'
import AppButton from '@/components/AppButton.vue'
import ArchImage from '@/components/ArchImage.vue'
import BottomBar from '@/components/BottomBar.vue'
import PageLayout from '@/components/PageLayout.vue'

const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
const teachers = ref<Teacher[]>([])
const courses = ref<CourseSummary[]>([])
const courseCount = (id: ID) => courses.value.filter(c => c.teacherId === id).length

async function load() {
  if (status.value !== 'ok') status.value = 'loading'
  try {
    ;[teachers.value, courses.value] = await Promise.all([api.listTeachers(), api.listOwnerCourses()])
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onShow(load)

const openEdit = (id?: ID) => uni.navigateTo({ url: `/pages-owner/catalog/teacher${id ? `?id=${id}` : ''}` })
</script>

<style lang="scss">
.psub {
  padding: 8rpx $page-x 0;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;
  color: $mute;
}

.list {
  margin: 32rpx $page-x 0;
  border-radius: $r-card;
  background: $card;
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 32rpx;
  border-bottom: 2rpx solid $hair;

  &:last-child {
    border-bottom: none;
  }

  &--hover {
    background: $milk;
  }

  &__avatar {
    flex: none;
    width: 64rpx;
    height: 82rpx;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    margin-bottom: 6rpx;
    font-size: $fs-body;
    font-weight: 600;
    color: $ink;
  }

  &__desc {
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }

  &__status {
    flex: none;
    padding: 4rpx 16rpx;
    border-radius: $r-pill;
    font-size: $fs-caption;
    background: $milk;
    color: $mute;

    &--active {
      background: $sage-bg;
      color: $sage-ink;
    }

    &--invited {
      background: $blush;
      color: $blush-ink;
    }
  }
}

.panel {
  margin: 40rpx $page-x;
  padding: 64rpx 40rpx;
  border-radius: 40rpx;
  background: $card;
  text-align: center;

  &__text {
    font-size: $fs-small;
    line-height: 1.7;
    color: $mute;
  }
}
</style>
