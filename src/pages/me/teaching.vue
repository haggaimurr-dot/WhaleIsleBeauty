<template>
  <PageLayout>
    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <template v-else-if="data">
      <view class="head">
        <ArchImage class="head__avatar" :src="t.avatar" />
        <view class="head__main">
          <view class="head__name">{{ t.name }}</view>
          <view class="head__sub">分成 {{ t.shareRate }}%<text v-if="agreedText"> · {{ agreedText }}</text></view>
        </view>
        <text class="head__status" :class="`head__status--${t.status}`">{{ TEACHER_STATUS_LABEL[t.status] }}</text>
      </view>
      <view v-if="t.status === 'ended'" class="ended">合作已经结束，你出镜的课都下架了。之前记下的分成店里照常付。</view>

      <view class="h">我的课</view>
      <view v-if="!data.courses.length" class="empty">店里还在剪你的课，剪好会放在这里。</view>
      <CourseCard v-for="c in data.courses" :key="c.id" :course="c" @click="openCourse(c.id, c.hidden)" />

      <view class="h">分成</view>
      <view v-if="!data.payouts.length" class="empty">还没有分成。客人从你的课点“预约同款”、到店做完，就会记在这里。</view>
      <PayoutCard v-for="(p, i) in data.payouts" :key="p.month" :payout="p" :expanded="i === 0" />
      <view v-if="data.payouts.length" class="hint">只列最近 6 个月。每月月底后店里打款，打完会标成“已付”。</view>

      <view v-if="t.status === 'active'" class="quit">
        <AppButton variant="ghost" size="sm" :loading="quitting" loading-text="正在结束…" @click="quit">结束合作</AppButton>
      </view>
      <view class="gap" />
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, errorText, TEACHER_STATUS_LABEL, type ID, type MyTeaching, type Teacher } from '@/api'
import { formatMonthDay, toDateStr } from '@/utils/date'
import AppButton from '@/components/AppButton.vue'
import ArchImage from '@/components/ArchImage.vue'
import CourseCard from '@/components/CourseCard.vue'
import PageLayout from '@/components/PageLayout.vue'
import PayoutCard from '@/components/PayoutCard.vue'

const data = ref<MyTeaching>()
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
const t = computed(() => data.value?.teacher as Teacher)

const agreedText = computed(() => {
  const at = t.value?.agreedAt
  return at ? `${formatMonthDay(toDateStr(new Date(at)))}确认的授权` : ''
})

async function load() {
  if (!data.value) status.value = 'loading'
  try {
    data.value = await api.getMyTeaching()
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onShow(load)

function openCourse(id: ID, hidden?: boolean) {
  if (hidden) uni.showToast({ title: '这门课下架了，客人看不到', icon: 'none', duration: 2000 })
  else uni.navigateTo({ url: `/pages/course/detail?id=${id}` })
}

const quitting = ref(false)

function quit() {
  uni.showModal({
    title: '结束合作？',
    content: '结束后你出镜的课马上下架，客人就看不到了。之前记下的分成照常付。',
    confirmText: '结束合作',
    cancelText: '再想想',
    confirmColor: '#6E5446',
    success: async ({ confirm }) => {
      if (!confirm) return
      quitting.value = true
      try {
        await api.quitTeaching()
        uni.showToast({ title: '已经结束了，谢谢你', icon: 'none', duration: 2000 })
      } catch (e) {
        uni.showToast({ title: errorText(e), icon: 'none', duration: 2500 })
      } finally {
        quitting.value = false
        load()
      }
    },
  })
}
</script>

<style lang="scss">
.head {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin: 24rpx $page-x 0;

  &__avatar {
    flex: none;
    width: 96rpx;
    height: 124rpx;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-family: $font-serif;
    font-weight: $fw-display;
    font-size: 40rpx;
    letter-spacing: $ls-display;
  }

  &__sub {
    margin-top: 6rpx;
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }

  &__status {
    flex: none;
    padding: 6rpx 18rpx;
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

.ended {
  margin: 24rpx $page-x 0;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;
  color: $mute;
}

.h {
  margin: 48rpx $page-x 20rpx;
  font-family: $font-serif;
  font-weight: $fw-heading;
  font-size: 32rpx;
  letter-spacing: $ls-display;
}

.empty {
  margin: 0 $page-x;
  padding: 40rpx 32rpx;
  border-radius: $r-card;
  background: $card;
  font-size: $fs-small;
  line-height: 1.7;
  color: $mute;
}

.hint {
  margin: 0 $page-x;
  font-size: $fs-caption;
  line-height: 1.6;
  color: $mute;
}

.quit {
  display: flex;
  justify-content: center;
  margin-top: 64rpx;
}

.gap {
  height: 48rpx;
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
