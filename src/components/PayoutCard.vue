<template>
  <view class="payout">
    <view class="payout__head" hover-class="payout__head--hover" @tap="open = !open">
      <view class="payout__main">
        <view class="payout__title">{{ showTeacher ? `${payout.teacherName} · ` : '' }}{{ formatMonth(payout.month) }}</view>
        <view class="payout__sub">{{ payout.count }} 单{{ payout.paidAt ? ` · ${paidText}` : '' }}</view>
      </view>
      <view class="payout__right">
        <view class="payout__amount">{{ formatPrice(payout.amount) }}</view>
        <text class="payout__status" :class="`payout__status--${payout.status}`">{{ PAYOUT_STATUS_LABEL[payout.status] }}</text>
      </view>
    </view>

    <view v-if="open" class="payout__records">
      <view v-for="r in payout.records" :key="r.bookingId" class="rec">
        <view class="rec__main">
          <view>{{ formatMonthDay(r.date) }} · {{ r.serviceName }}</view>
          <view class="rec__sub">从《{{ r.courseTitle }}》来 · 标价 {{ formatPrice(r.price) }} × {{ r.rate }}%</view>
        </view>
        <text class="rec__amount">{{ formatPrice(r.amount) }}</text>
      </view>
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 一位讲师一个月的分成：点开看每一笔。店主页面在默认插槽里放“标记已付”。
 * 已付用鼠尾草绿（和“已确认”一样是定下来的状态），待付用雾玫瑰提醒。
 */
import { computed, ref } from 'vue'
import { PAYOUT_STATUS_LABEL, type Payout } from '@/api'
import { formatMonth, formatMonthDay, toDateStr } from '@/utils/date'
import { formatPrice } from '@/utils/money'

defineOptions({ options: { virtualHost: true } })

const props = defineProps<{
  payout: Payout
  /** 店主看所有讲师时显示名字 */
  showTeacher?: boolean
  /** 一开始就展开 */
  expanded?: boolean
}>()

const open = ref(!!props.expanded)
const paidText = computed(() => props.payout.paidAt ? `${formatMonthDay(toDateStr(new Date(props.payout.paidAt)))}付的` : '')
</script>

<style lang="scss">
.payout {
  margin: 0 $page-x $gap;
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-soft;
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    gap: $gap;
    padding: 28rpx 32rpx;

    &--hover {
      background: $milk;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: $fs-body;
    font-weight: 600;
    color: $ink;
  }

  &__sub {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
  }

  &__right {
    flex: none;
    text-align: right;
  }

  &__amount {
    font-family: $font-serif;
    font-size: 34rpx;
    color: $mocha;
  }

  &__status {
    display: inline-block;
    margin-top: 6rpx;
    padding: 2rpx 14rpx;
    border-radius: $r-pill;
    font-size: $fs-caption;

    &--open {
      background: $milk;
      color: $mute;
    }

    &--due {
      background: $blush;
      color: $blush-ink;
    }

    &--paid {
      background: $sage-bg;
      color: $sage-ink;
    }
  }

  &__records {
    padding: 0 32rpx 24rpx;
    border-top: 2rpx solid $hair;
  }
}

.rec {
  display: flex;
  align-items: center;
  gap: $gap;
  padding: 20rpx 0;
  font-size: $fs-small;
  color: $ink;

  & + & {
    border-top: 2rpx solid $hair;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__sub {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
  }

  &__amount {
    flex: none;
  }
}
</style>
