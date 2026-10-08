<template>
  <PageLayout>
    <template #header>
      <view class="brand">
        <text class="brand__name">鲸屿</text>
        <text class="brand__sub">美妆 · 私人定制</text>
      </view>
    </template>

    <view class="hero">
      <view class="hero__text">
        <view class="hero__title">为重要的那天，</view>
        <view class="hero__title">认真画一次妆</view>
        <view class="hero__desc">一对一，一客一消毒。</view>
        <view class="hero__desc hero__desc--last">约会、上镜、新娘，都可以慢慢聊。</view>
        <AppButton class="hero__btn" @click="toBooking">预约化妆</AppButton>
      </view>
      <ArchImage class="hero__img" src="placeholder:g1" />
    </view>

    <view class="trust">
      <view v-for="t in TRUST" :key="t.text" class="trust__item">
        <image class="trust__icon" :src="t.icon" />
        <text>{{ t.text }}</text>
      </view>
    </view>

    <view v-if="status === 'error'" class="load-error">
      <view class="load-error__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <template v-else-if="status === 'ok'">
      <view class="sec">
        <text class="sec__title">按场合选妆</text>
        <text class="sec__link" @tap="toWorks()">全部作品 ›</text>
      </view>
      <scroll-view scroll-x class="styles" :show-scrollbar="false" enhanced>
        <view
          v-for="s in styles"
          :key="s.category"
          class="style"
          hover-class="card--hover"
          @tap="toWorks(s.category)"
        >
          <ArchImage class="style__img" :src="s.image" />
          <view>{{ s.name }}</view>
          <view class="style__sub">{{ s.sub }}</view>
        </view>
      </scroll-view>

      <view class="sec">
        <text class="sec__title">服务项目</text>
      </view>
      <view
        v-for="s in services"
        :key="s.id"
        class="svc"
        hover-class="card--hover"
        @tap="toService(s.id)"
      >
        <ArchImage class="svc__thumb" shape="rect" :src="s.cover" />
        <view class="svc__body">
          <view class="svc__name">{{ s.name }}</view>
          <view class="svc__meta">约 {{ s.durationMin }} 分钟 · {{ s.summary }}</view>
          <text class="price">{{ formatPrice(s.price) }}</text>
          <text v-if="s.priceFrom" class="price__from">起</text>
        </view>
      </view>
    </template>

    <view class="bottom-space" />
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { api, errorText, CATEGORY_LABEL, type Service, type StyleCategory } from '@/api'
import { formatPrice } from '@/utils/money'
import { SHOP_NAME, sharePath } from '@/utils/share'
import { switchTab } from '@/utils/tab'
import AppButton from '@/components/AppButton.vue'
import ArchImage from '@/components/ArchImage.vue'
import PageLayout from '@/components/PageLayout.vue'

const TRUST = [
  { icon: '/static/icons/trust-clean.svg', text: '工具一客一消毒' },
  { icon: '/static/icons/trust-brand.svg', text: '用品品牌公开' },
  { icon: '/static/icons/trust-price.svg', text: '到店不加价' },
]

const services = ref<Service[]>([])
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')

/** 每个场合取第一个服务项目作为入口 */
const styles = computed(() => {
  const seen = new Set<StyleCategory>()
  return services.value
    .filter(s => !seen.has(s.category) && seen.add(s.category))
    .map(s => ({
      category: s.category,
      name: `${CATEGORY_LABEL[s.category]}妆`,
      sub: s.tags[0] ?? '',
      image: s.cover,
    }))
})

async function load() {
  status.value = 'loading'
  try {
    services.value = await api.listServices()
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onLoad(load)

const SHARE_TITLE = `${SHOP_NAME}｜私人化妆工作室，素颜过来就好`
onShareAppMessage(() => ({ title: SHARE_TITLE, path: sharePath('/pages/home/index') }))
onShareTimeline(() => ({ title: SHARE_TITLE }))

const toBooking = () => switchTab('booking')
const toWorks = (category?: StyleCategory) => switchTab('works', { category })
const toService = (id: string) => uni.navigateTo({ url: `/pages/service/detail?id=${id}` })
</script>

<style lang="scss">
page {
  background: $milk-wash;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 20rpx;
  padding: 8rpx $page-x 16rpx;

  &__name {
    font-family: $font-serif;
    font-weight: $fw-display;
    font-size: $fs-title;
    letter-spacing: 0.12em;
    color: $mocha;
  }

  &__sub {
    font-size: $fs-caption;
    letter-spacing: 0.08em;
    color: $mute;
  }
}

.hero {
  display: flex;
  align-items: flex-end;
  gap: 28rpx;
  margin: 40rpx $page-x 0;

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-family: $font-serif;
    font-weight: $fw-display;
    font-size: $fs-title;
    line-height: $lh-title;
    letter-spacing: $ls-display;
  }

  &__title + &__desc {
    margin-top: 24rpx;
  }

  &__desc {
    font-size: $fs-small;
    line-height: $lh-body;
    color: $mute;

    &--last {
      margin-bottom: 40rpx;
    }
  }

  & &__btn {
    height: 80rpx;
    padding: 0 52rpx;
    letter-spacing: 0.12em;
  }

  &__img {
    flex: none;
    width: 252rpx;
    height: 352rpx;
    box-shadow: $shadow-float;
  }
}

// 安全感信息：不铺底色，一行三项用细竖线隔开，只留绿色字
.trust {
  display: flex;
  align-items: center;
  margin: 56rpx $page-x 0;
  padding: 28rpx 0;
  border-top: 1rpx solid $hair;
  border-bottom: 1rpx solid $hair;

  &__item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    font-size: $fs-caption;
    line-height: 1.4;
    color: $sage-ink;
    white-space: nowrap;

    & + & {
      border-left: 1rpx solid $hair;
    }
  }

  &__icon {
    flex: none;
    width: 28rpx;
    height: 28rpx;
  }
}

.sec {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 72rpx $page-x 28rpx;

  &__title {
    font-family: $font-serif;
    font-weight: $fw-heading;
    font-size: $fs-h2;
    letter-spacing: $ls-display;
  }

  &__link {
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }
}

.styles {
  white-space: nowrap;
  padding-left: $page-x;
  box-sizing: border-box;
}

.style {
  display: inline-block;
  width: 192rpx;
  margin-right: $gap;
  vertical-align: top;
  text-align: center;
  font-size: $fs-small;
  white-space: normal;

  &:last-child {
    margin-right: $page-x;
  }

  &__img {
    height: 248rpx;
    margin-bottom: 16rpx;
  }

  &__sub {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
  }
}

.svc {
  display: flex;
  align-items: center;
  gap: $gap;
  margin: 0 $page-x $gap;
  padding: $gap;
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-soft;

  &__thumb {
    flex: none;
    width: 144rpx;
    height: 144rpx;
    border-radius: $r-inner;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    margin-bottom: 8rpx;
    font-size: 30rpx;
    font-weight: 600;
  }

  &__meta {
    margin-bottom: 12rpx;
    line-height: 1.5;
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }
}

.price {
  font-family: $font-serif;
  font-weight: 600;
  font-size: 34rpx;
  color: $mocha;

  &__from {
    margin-left: 8rpx;
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }
}

.load-error {
  margin: 56rpx $page-x 0;
  padding: 64rpx 40rpx;
  border-radius: $r-card;
  background: $card;
  text-align: center;

  &__text {
    margin-bottom: 32rpx;
    font-size: $fs-small;
    line-height: 1.7;
    color: $mute;
  }
}


.card--hover {
  opacity: 0.85;
}

.bottom-space {
  height: 32rpx;
}
</style>
