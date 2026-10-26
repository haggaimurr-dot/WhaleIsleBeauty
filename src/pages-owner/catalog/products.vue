<template>
  <PageLayout>
    <template #header>
      <view class="psub">客人在首页和化妆品清单里按类别看到，同一类里先加的在前。</view>
    </template>

    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <view v-else-if="status === 'ok' && !products.length" class="panel">
      <view class="panel__text">还没有化妆品。把店里常用的列出来，客人知道用的是什么，会更放心。</view>
    </view>

    <template v-else-if="status === 'ok'">
      <view v-for="g in groups" :key="g.category">
        <view class="h">{{ PRODUCT_CATEGORY_LABEL[g.category] }}</view>
        <view class="list">
          <view v-for="p in g.items" :key="p.id" class="row" hover-class="row--hover" @tap="openEdit(p.id)">
            <view class="row__main">
              <view class="row__title">{{ p.brand }} {{ p.name }}</view>
              <view class="row__desc">{{ p.note || '没写说明' }}</view>
            </view>
            <text class="row__go">修改</text>
          </view>
        </view>
      </view>
      <view class="gap" />
    </template>

    <template #footer>
      <BottomBar v-if="status === 'ok'" :desc="products.length ? `共 ${products.length} 件` : ''">
        <AppButton :disabled="full" @click="openEdit()">{{ full ? `最多放 ${LIMITS.maxProducts} 件` : '添加化妆品' }}</AppButton>
      </BottomBar>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api, errorText, LIMITS, PRODUCT_CATEGORY_LABEL, type ID, type Product, type ProductCategory } from '@/api'
import AppButton from '@/components/AppButton.vue'
import BottomBar from '@/components/BottomBar.vue'
import PageLayout from '@/components/PageLayout.vue'

const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
const products = ref<Product[]>([])
const full = computed(() => products.value.length >= LIMITS.maxProducts)

const groups = computed(() =>
  (Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[])
    .map(c => ({ category: c, items: products.value.filter(p => p.category === c) }))
    .filter(g => g.items.length),
)

async function load() {
  // 从编辑页返回时不清空，避免闪一下
  if (status.value !== 'ok') status.value = 'loading'
  try {
    products.value = await api.listProducts()
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onShow(load)

const openEdit = (id?: ID) => uni.navigateTo({ url: `/pages-owner/catalog/product${id ? `?id=${id}` : ''}` })
</script>

<style lang="scss">
.psub {
  padding: 8rpx $page-x 0;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;
  color: $mute;
}

.h {
  margin: 40rpx $page-x 20rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.list {
  margin: 0 $page-x;
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

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    margin-bottom: 6rpx;
    font-size: $fs-body;
    font-weight: 600;
    color: $ink;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__desc {
    font-size: $fs-caption + 2rpx;
    line-height: 1.6;
    color: $mute;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__go {
    flex: none;
    font-size: $fs-small;
    color: $mocha;
  }
}

.gap {
  height: 40rpx;
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
