<template>
  <PageLayout ref="layout">
    <template #header>
      <view class="ptitle">店里用的化妆品</view>
      <view class="psub">都是专柜正品，到店可以看实物</view>
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

    <view v-else-if="status === 'ok' && !products.length" class="panel">
      <view class="panel__text">清单还在整理，到店可以直接看实物，也可以问化妆师。</view>
    </view>

    <template v-else-if="status === 'ok'">
      <view v-for="g in groups" :key="g.category" class="group">
        <view class="group__title">
          {{ PRODUCT_CATEGORY_LABEL[g.category] }}
          <text class="group__count">{{ g.items.length }} 件</text>
        </view>
        <view class="list">
          <view v-for="p in g.items" :key="p.id" class="item">
            <view class="item__brand">{{ p.brand }}</view>
            <view class="item__name">{{ p.name }}</view>
            <view v-if="p.note" class="item__note">{{ p.note }}</view>
          </view>
        </view>
      </view>

      <!-- 过敏、自带产品：安全感信息，用鼠尾草绿 -->
      <view class="tip">
        <view class="tip__text">有过敏或不能用的成分，填在肤质档案里，化妆师会提前换成你能用的。常用的产品也可以自己带来。</view>
        <text class="tip__link" @tap="toSkin">去填肤质档案 ›</text>
      </view>
    </template>

    <view class="bottom-space" />
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { api, errorText, PRODUCT_CATEGORY_LABEL, type Product, type ProductCategory } from '@/api'
import { SHOP_NAME, sharePath } from '@/utils/share'
import AppButton from '@/components/AppButton.vue'
import Chip from '@/components/Chip.vue'
import PageLayout from '@/components/PageLayout.vue'

const ORDER = Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]

const layout = ref<InstanceType<typeof PageLayout>>()
const products = ref<Product[]>([])
const category = ref<ProductCategory>()
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')

/** 一次取全部，筛选在本地做；只给有东西的类别出标签 */
const filters = computed(() => [
  { label: '全部', category: undefined as ProductCategory | undefined },
  ...ORDER.filter(c => products.value.some(p => p.category === c))
    .map(c => ({ label: PRODUCT_CATEGORY_LABEL[c], category: c as ProductCategory | undefined })),
])

const groups = computed(() =>
  ORDER.filter(c => !category.value || c === category.value)
    .map(c => ({ category: c, items: products.value.filter(p => p.category === c) }))
    .filter(g => g.items.length),
)

function select(c?: ProductCategory) {
  category.value = c
  layout.value?.scrollToTop()
}

async function load() {
  status.value = 'loading'
  try {
    products.value = await api.listProducts()
    // 从首页点进来的类别被店主删光了，就看全部
    if (category.value && !products.value.some(p => p.category === category.value)) category.value = undefined
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onLoad((query) => {
  const c = query?.category as ProductCategory | undefined
  if (c && c in PRODUCT_CATEGORY_LABEL) category.value = c
  load()
})

onShareAppMessage(() => ({ title: `${SHOP_NAME}｜店里用的化妆品`, path: sharePath('/pages/products/index') }))

const toSkin = () => uni.navigateTo({ url: '/pages/me/skin' })
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

.group {
  margin: 0 $page-x 40rpx;

  &__title {
    margin-bottom: 20rpx;
    font-family: $font-serif;
    font-weight: $fw-heading;
    font-size: 32rpx;
    letter-spacing: $ls-display;
  }

  &__count {
    margin-left: 12rpx;
    font-family: $font-sans;
    font-size: $fs-caption;
    color: $mute;
  }
}

.list {
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-soft;
  overflow: hidden;
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

  &__note {
    margin-top: 6rpx;
    font-size: $fs-caption + 2rpx;
    line-height: 1.6;
    color: $mute;
  }
}

.tip {
  margin: 8rpx $page-x 0;
  padding: 28rpx 32rpx;
  border-radius: $r-inner;
  background: $sage-bg;
  color: $sage-ink;

  &__text {
    font-size: $fs-caption + 2rpx;
    line-height: 1.7;
  }

  &__link {
    display: inline-block;
    margin-top: 12rpx;
    font-size: $fs-caption + 2rpx;
    font-weight: 600;
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
