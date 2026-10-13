<template>
  <PageLayout>
    <template #header>
      <view class="psub">客人在“课堂”里看到上架的课，新加的排在最前。顾客讲师结束合作后，TA 的课会自动下架。</view>
    </template>

    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <view v-else-if="status === 'ok' && !courses.length" class="panel">
      <view class="panel__text">还没有课程。录几节小课，讲讲日常怎么画、店里用的是什么，客人看了会想来店里。</view>
    </view>

    <template v-else-if="status === 'ok'">
      <view class="gap-top" />
      <CourseCard v-for="c in courses" :key="c.id" :course="c" @click="openEdit(c.id)" />
    </template>

    <template #footer>
      <BottomBar v-if="status === 'ok'" :desc="courses.length ? `共 ${courses.length} 门` : ''">
        <AppButton :disabled="full" @click="openEdit()">{{ full ? `最多放 ${LIMITS.maxCourses} 门` : '添加课程' }}</AppButton>
      </BottomBar>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, errorText, LIMITS, type CourseSummary, type ID } from '@/api'
import AppButton from '@/components/AppButton.vue'
import BottomBar from '@/components/BottomBar.vue'
import CourseCard from '@/components/CourseCard.vue'
import PageLayout from '@/components/PageLayout.vue'

const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
const courses = ref<CourseSummary[]>([])
const full = computed(() => courses.value.length >= LIMITS.maxCourses)

async function load() {
  // 从编辑页返回时不清空，避免闪一下
  if (status.value !== 'ok') status.value = 'loading'
  try {
    courses.value = await api.listOwnerCourses()
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onShow(load)

const openEdit = (id?: ID) => uni.navigateTo({ url: `/pages-owner/catalog/course${id ? `?id=${id}` : ''}` })
</script>

<style lang="scss">
.psub {
  padding: 8rpx $page-x 0;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;
  color: $mute;
}

.gap-top {
  height: 32rpx;
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
