<template>
  <PageLayout>
    <template #header>
      <view class="psub">客人从顾客讲师的课点“预约同款”、到店做完的单，按下单时的比例从项目标价里分给讲师。月底后线下打款，打完在这里标记，讲师在“我的课堂”里能看到。</view>
    </template>

    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <view v-else-if="status === 'ok' && !payouts.length" class="panel">
      <view class="panel__text">最近 6 个月还没有分成。客人从讲师的课来、到店做完，就会记在这里。</view>
    </view>

    <template v-else-if="status === 'ok'">
      <view v-if="due.length" class="sum">
        <view class="sum__label">待付合计</view>
        <view class="sum__amount">{{ formatPrice(dueTotal) }}</view>
        <view class="sum__sub">{{ due.length }} 笔，都是已经过完的月份</view>
      </view>

      <view v-for="g in groups" :key="g.title">
        <view class="h">{{ g.title }}</view>
        <PayoutCard v-for="p in g.items" :key="`${p.teacherId}|${p.month}`" :payout="p" show-teacher>
          <view v-if="p.status === 'due'" class="mark">
            <AppButton
              variant="ghost"
              size="sm"
              :loading="marking === `${p.teacherId}|${p.month}`"
              loading-text="正在标记…"
              @click="markPaid(p)"
            >
              标记已付
            </AppButton>
          </view>
        </PayoutCard>
      </view>
      <view class="gap" />
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, errorText, type Payout } from '@/api'
import { formatMonth } from '@/utils/date'
import { formatPrice } from '@/utils/money'
import AppButton from '@/components/AppButton.vue'
import PageLayout from '@/components/PageLayout.vue'
import PayoutCard from '@/components/PayoutCard.vue'

const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
const payouts = ref<Payout[]>([])

const due = computed(() => payouts.value.filter(p => p.status === 'due'))
const dueTotal = computed(() => due.value.reduce((n, p) => n + p.amount, 0))

/** 待付的放最前，然后是本月进行中的，最后按月份列已付的 */
const groups = computed(() => [
  { title: '待付', items: due.value },
  { title: '本月进行中', items: payouts.value.filter(p => p.status === 'open') },
  ...[...new Set(payouts.value.filter(p => p.status === 'paid').map(p => p.month))]
    .map(m => ({ title: `${formatMonth(m)} · 已付`, items: payouts.value.filter(p => p.status === 'paid' && p.month === m) })),
].filter(g => g.items.length))

async function load() {
  if (status.value !== 'ok') status.value = 'loading'
  try {
    payouts.value = await api.listPayouts()
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onShow(load)

const marking = ref('')

function markPaid(p: Payout) {
  if (marking.value) return
  uni.showModal({
    title: `已经打给${p.teacherName}了？`,
    content: `${formatMonth(p.month)} ${p.count} 单，共 ${formatPrice(p.amount)}。标记后金额就定下来了，不能撤销。`,
    confirmText: '已经打了',
    cancelText: '还没有',
    confirmColor: '#6E5446',
    success: async (r) => {
      if (!r.confirm) return
      marking.value = `${p.teacherId}|${p.month}`
      try {
        await api.markPayoutPaid(p.teacherId, p.month)
        uni.showToast({ title: '标记好了', icon: 'none', duration: 1500 })
      } catch (e) {
        uni.showToast({ title: errorText(e), icon: 'none', duration: 3000 })
      } finally {
        marking.value = ''
        load()
      }
    },
  })
}
</script>

<style lang="scss">
.psub {
  padding: 8rpx $page-x 0;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;
  color: $mute;
}

.sum {
  margin: 32rpx $page-x 0;
  padding: 32rpx;
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-soft;

  &__label {
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }

  &__amount {
    margin-top: 8rpx;
    font-family: $font-serif;
    font-size: 48rpx;
    color: $mocha;
  }

  &__sub {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
  }
}

.h {
  margin: 44rpx $page-x 20rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.mark {
  display: flex;
  justify-content: flex-end;
  padding-top: 16rpx;
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
    font-size: $fs-small;
    line-height: 1.7;
    color: $mute;
  }
}
</style>
