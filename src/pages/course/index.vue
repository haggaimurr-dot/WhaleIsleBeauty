<template>
  <PageLayout ref="layout">
    <template #header>
      <view class="ptitle">课堂</view>
      <view class="psub">化妆师和常来的客人录的小课，在家也能跟着画</view>
      <scroll-view v-if="filters.length > 1" scroll-x class="filter" :show-scrollbar="false" enhanced>
        <Chip
          v-for="f in filters"
          :key="f.label"
          class="filter__chip"
          :label="f.label"
          :selected="f.category === category"
          @click="select(f.category)"
        />
      </scroll-view>
    </template>

    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <view v-else-if="status === 'ok' && !courses.length" class="panel">
      <view class="panel__text">课还在录，过阵子再来看看。想学的话，到店时化妆师也可以边画边教。</view>
      <AppButton variant="ghost" size="sm" @click="toBooking">去预约</AppButton>
    </view>

    <template v-else-if="status === 'ok'">
      <CourseCard v-for="c in shown" :key="c.id" :course="c" @click="open(c.id)" />
    </template>

    <view class="bottom-space" />
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { api, errorText, CATEGORY_LABEL, type CourseSummary, type StyleCategory } from '@/api'
import { SHOP_NAME, sharePath } from '@/utils/share'
import { switchTab } from '@/utils/tab'
import AppButton from '@/components/AppButton.vue'
import Chip from '@/components/Chip.vue'
import CourseCard from '@/components/CourseCard.vue'
import PageLayout from '@/components/PageLayout.vue'

const ORDER = Object.keys(CATEGORY_LABEL) as StyleCategory[]

const layout = ref<InstanceType<typeof PageLayout>>()
const courses = ref<CourseSummary[]>([])
const category = ref<StyleCategory>()
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')

/** 一次取全部，筛选在本地做；只给有课的风格出标签 */
const filters = computed(() => [
  { label: '全部', category: undefined as StyleCategory | undefined },
  ...ORDER.filter(c => courses.value.some(x => x.category === c))
    .map(c => ({ label: CATEGORY_LABEL[c], category: c as StyleCategory | undefined })),
])

const shown = computed(() => courses.value.filter(c => !category.value || c.category === category.value))

function select(c?: StyleCategory) {
  category.value = c
  layout.value?.scrollToTop()
}

async function load() {
  status.value = 'loading'
  try {
    courses.value = await api.listCourses()
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onLoad(load)

const SHARE_TITLE = `${SHOP_NAME}｜课堂，在家也能跟着画`
onShareAppMessage(() => ({ title: SHARE_TITLE, path: sharePath('/pages/course/index') }))
onShareTimeline(() => ({ title: SHARE_TITLE }))

const open = (id: string) => uni.navigateTo({ url: `/pages/course/detail?id=${id}` })
const toBooking = () => switchTab('booking')
</script>

<style lang="scss">
.ptitle {
  margin: 8rpx 0;
  padding: 0 $page-x;
  font-family: $font-serif;
  font-weight: $fw-display;
  font-size: $fs-title;
  letter-spacing: $ls-display;
}

.psub {
  margin-bottom: 28rpx;
  padding: 0 $page-x;
  font-size: $fs-caption + 2rpx;
  color: $mute;
}

.filter {
  white-space: nowrap;
  padding: 0 0 28rpx $page-x;
  box-sizing: border-box;

  &__chip {
    margin-right: 16rpx;

    &:last-child {
      margin-right: $page-x;
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
