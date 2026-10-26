<template>
  <PageLayout>
    <template #header>
      <view class="psub">客人在小程序里看到的门店信息、化妆师、项目、作品、化妆品和课程都在这里改。改了马上生效，已经下的单不受影响。</view>
    </template>

    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton v-if="!forbidden" variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <template v-else-if="shop">
      <view class="h">门店</view>
      <view class="card" hover-class="card--hover" @tap="openShop">
        <view class="card__main">
          <view class="card__name">{{ shop.name }}</view>
          <view class="card__line">{{ shop.address }}</view>
          <view class="card__line">{{ shop.phone }}　营业 {{ shop.openHours }}</view>
        </view>
        <text class="card__go">修改</text>
      </view>

      <view class="h">店里的资料</view>
      <view class="menu">
        <view class="menu__row" hover-class="menu__row--hover" @tap="openArtists">
          <view class="menu__main">
            化妆师
            <view class="menu__sub">{{ artistNames }}</view>
          </view>
          <text class="menu__hint">{{ artists.length }} 位</text>
        </view>
        <view class="menu__row" hover-class="menu__row--hover" @tap="openServices">
          <view class="menu__main">
            项目
            <view class="menu__sub">{{ serviceSub }}</view>
          </view>
          <text class="menu__hint">{{ services.length }} 个</text>
        </view>
        <view class="menu__row" hover-class="menu__row--hover" @tap="openWorks">
          <view class="menu__main">
            作品
            <view class="menu__sub">{{ workSub }}</view>
          </view>
          <text class="menu__hint">{{ works.length }} 件</text>
        </view>
        <view class="menu__row" hover-class="menu__row--hover" @tap="openProducts">
          <view class="menu__main">
            化妆品
            <view class="menu__sub">{{ productSub }}</view>
          </view>
          <text class="menu__hint">{{ products.length }} 件</text>
        </view>
      </view>

      <view class="h">课堂</view>
      <view class="menu">
        <view class="menu__row" hover-class="menu__row--hover" @tap="go('courses')">
          <view class="menu__main">
            课程
            <view class="menu__sub">{{ courseSub }}</view>
          </view>
          <text class="menu__hint">{{ courses.length }} 门</text>
        </view>
        <view class="menu__row" hover-class="menu__row--hover" @tap="go('teachers')">
          <view class="menu__main">
            讲师
            <view class="menu__sub">{{ teacherSub }}</view>
          </view>
          <text class="menu__hint">{{ teachers.length }} 位</text>
        </view>
        <view class="menu__row" hover-class="menu__row--hover" @tap="go('payouts')">
          <view class="menu__main">
            讲师分成
            <view class="menu__sub">{{ payoutSub }}</view>
          </view>
          <text class="menu__hint">{{ dueTotal ? formatPrice(dueTotal) : '' }}</text>
        </view>
      </view>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  api, errorText, ApiError, PRODUCT_CATEGORY_LABEL,
  type Artist, type CourseSummary, type Payout, type Product, type ProductCategory, type Service, type Shop, type Teacher, type Work,
} from '@/api'
import { formatPrice } from '@/utils/money'
import AppButton from '@/components/AppButton.vue'
import PageLayout from '@/components/PageLayout.vue'

const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
const forbidden = ref(false)
const shop = ref<Shop>()
const artists = ref<Artist[]>([])
const artistNames = computed(() => artists.value.map(a => a.name).join('、'))
const services = ref<Service[]>([])
const serviceSub = computed(() => {
  const hidden = services.value.filter(s => s.hidden).length
  const onSale = services.value.length - hidden
  return hidden ? `${onSale} 个在接预约，${hidden} 个已下架` : '都在接预约'
})

const works = ref<Work[]>([])
const workSub = computed(() => works.value.length ? `最新一件：${works.value[0].title}` : '还没有，放几张客人的妆面吧')

const products = ref<Product[]>([])
/** 每类几件，例如“底妆 3 · 眼妆 3” */
const productSub = computed(() => {
  if (!products.value.length) return '还没有，列出店里用的，客人看了放心'
  return (Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[])
    .map(c => [c, products.value.filter(p => p.category === c).length] as const)
    .filter(([, n]) => n)
    .map(([c, n]) => `${PRODUCT_CATEGORY_LABEL[c]} ${n}`)
    .join(' · ')
})

const courses = ref<CourseSummary[]>([])
const courseSub = computed(() => {
  if (!courses.value.length) return '还没有，录几节小课带客人来'
  const hidden = courses.value.filter(c => c.hidden).length
  return hidden ? `${courses.value.length - hidden} 门在架上，${hidden} 门下架了` : '都在架上'
})
const teachers = ref<Teacher[]>([])
const teacherSub = computed(() => {
  const n = (s: Teacher['status']) => teachers.value.filter(t => t.status === s).length
  if (!teachers.value.length) return '请常来的客人录课，按带来的预约分成'
  return [n('active') && `${n('active')} 位合作中`, n('invited') && `${n('invited')} 位等确认`].filter(Boolean).join('，') || '都结束合作了'
})
const payouts = ref<Payout[]>([])
const dueTotal = computed(() => payouts.value.filter(p => p.status === 'due').reduce((n, p) => n + p.amount, 0))
const payoutSub = computed(() => dueTotal.value ? '有待付的分成，打完款记得标记' : '没有待付的')

async function load() {
  // 已经有数据时（从编辑页返回）不清空，避免闪一下
  if (!shop.value) status.value = 'loading'
  try {
    // 先确认是店主：资料本身客人也能读，这里提前挡住，免得进到编辑页才报错
    const me = await api.getMe()
    if (me.role !== 'owner') throw new ApiError('FORBIDDEN', '')
    ;[shop.value, artists.value, services.value, works.value, products.value] = await Promise.all([
      api.getShop(), api.listArtists(), api.listOwnerServices(), api.listOwnerWorks(), api.listProducts(),
    ])
    // 课堂这一块取不到不影响改别的资料
    ;[courses.value, teachers.value, payouts.value] = await Promise.all([
      api.listOwnerCourses().catch(() => []), api.listTeachers().catch(() => []), api.listPayouts().catch(() => []),
    ])
    status.value = 'ok'
  } catch (e) {
    forbidden.value = e instanceof ApiError && e.code === 'FORBIDDEN'
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onShow(load)

const openShop = () => uni.navigateTo({ url: '/pages-owner/catalog/shop' })
const openArtists = () => uni.navigateTo({ url: '/pages-owner/catalog/artists' })
const openServices = () => uni.navigateTo({ url: '/pages-owner/catalog/services' })
const openWorks = () => uni.navigateTo({ url: '/pages-owner/catalog/works' })
const openProducts = () => uni.navigateTo({ url: '/pages-owner/catalog/products' })
const go = (page: 'courses' | 'teachers' | 'payouts') => uni.navigateTo({ url: `/pages-owner/catalog/${page}` })
</script>

<style lang="scss">
.psub {
  padding: 8rpx $page-x 0;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;
  color: $mute;
}

.h {
  margin: 44rpx $page-x 20rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.card {
  display: flex;
  align-items: center;
  gap: $gap;
  margin: 0 $page-x;
  padding: 32rpx;
  border-radius: $r-card;
  background: $card;

  &--hover {
    opacity: 0.7;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    margin-bottom: 8rpx;
    font-family: $font-serif;
    font-size: $fs-body + 2rpx;
    font-weight: 600;
    color: $ink;
  }

  &__line {
    font-size: $fs-caption + 2rpx;
    line-height: 1.7;
    color: $mute;
  }

  &__go {
    flex: none;
    font-size: $fs-small;
    color: $mocha;
  }
}

.menu {
  margin: 0 $page-x 40rpx;
  border-radius: $r-card;
  background: $card;
  overflow: hidden;

  &__row {
    display: flex;
    align-items: center;
    gap: $gap;
    padding: 30rpx 32rpx;
    border-bottom: 2rpx solid $hair;
    font-size: $fs-body;
    color: $ink;

    &:last-child {
      border-bottom: none;
    }

    &--hover {
      background: $milk;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__sub {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__hint {
    flex: none;
    font-size: $fs-small;
    color: $mute;
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
</style>
