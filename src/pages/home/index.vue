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
      <!-- 梳妆台：拱形镜子一圈小灯，镜子里轮播店主挑的妆后图，下面一条台面 -->
      <view class="vanity">
        <view class="mirror">
          <view v-for="(bulb, bulbIndex) in BULBS" :key="bulbIndex" class="mirror__bulb" :style="bulb" />
          <view class="mirror__glass">
            <swiper
              v-if="heroes.length > 1"
              class="mirror__swiper"
              circular
              autoplay
              :interval="4000"
              :duration="600"
              @change="heroIndex = $event.detail.current"
            >
              <swiper-item v-for="hero in heroes" :key="hero.id" @tap="toHero(hero)">
                <ArchImage :src="hero.image" :label="hero.title" rim fill />
              </swiper-item>
            </swiper>
            <ArchImage
              v-else
              :src="heroes[0]?.image ?? 'placeholder:g1'"
              :label="heroes[0]?.title"
              rim
              fill
              @tap="heroes[0] && toHero(heroes[0])"
            />
          </view>
          <!-- 轮播的点放在镜框底边上，不压图上的标题 -->
          <view v-if="heroes.length > 1" class="mirror__dots">
            <view v-for="(hero, dotIndex) in heroes" :key="hero.id" class="mirror__dot" :class="{ 'mirror__dot--on': dotIndex === heroIndex }" />
          </view>
        </view>
        <view class="desk">
          <view class="desk__lipstick" />
          <view class="desk__bottle" />
        </view>
      </view>
    </view>

    <view class="trust">
      <view v-for="t in TRUST" :key="t.text" class="trust__item" @tap="onTrust(t.text)">
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
      <!-- 场合只有 4 个，一行排满，不横向滑 -->
      <view class="styles">
        <view
          v-for="s in styles"
          :key="s.category"
          class="style"
          hover-class="card--hover"
          @tap="toWorks(s.category)"
        >
          <ArchImage class="style__img" :src="s.image" rim />
          <view class="style__name">{{ s.name }}</view>
          <view class="style__sub">{{ s.sub }}</view>
        </view>
      </view>

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
        <view class="svc__top">
          <ArchImage class="svc__thumb" shape="rect" :src="s.cover" />
          <view class="svc__body">
            <view class="svc__name">{{ s.name }}</view>
            <view class="svc__meta" :class="{ 'svc__meta--open': openSvc === s.id }">约 {{ s.durationMin }} 分钟 · {{ s.summary }}</view>
            <view class="svc__foot">
              <view>
                <text class="price">{{ formatPrice(s.price) }}</text>
                <text v-if="s.priceFrom" class="price__from">起</text>
              </view>
              <view v-if="s.steps?.length" class="fold" @tap.stop="toggleSvc(s.id)">
                <text>{{ openSvc === s.id ? '收起' : '看流程' }}</text>
                <view class="fold__arrow" :class="{ 'fold__arrow--up': openSvc === s.id }" />
              </view>
            </view>
          </view>
        </view>
        <view v-if="openSvc === s.id" class="steps" @tap.stop>
          <view v-for="(step, stepIndex) in s.steps" :key="stepIndex" class="steps__item">
            <text class="steps__no">{{ stepIndex + 1 }}</text>
            <text>{{ step }}</text>
          </view>
          <view class="steps__more" @tap.stop="toService(s.id)">看项目详情 ›</view>
        </view>
      </view>

      <template v-if="courses.length">
        <view class="sec">
          <text class="sec__title">课堂</text>
          <text class="sec__link" @tap="toCourses">全部课程 ›</text>
        </view>
        <scroll-view scroll-x class="lessons" :show-scrollbar="false" enhanced>
          <view
            v-for="c in courses"
            :key="c.id"
            class="lesson"
            hover-class="card--hover"
            @tap="toCourse(c.id)"
          >
            <ArchImage class="lesson__cover" shape="rect" :src="c.cover" />
            <view class="lesson__title">{{ c.title }}</view>
            <view class="lesson__sub">{{ c.teacher.name }} · {{ c.lessonCount }} 节</view>
          </view>
        </scroll-view>
      </template>

      <template v-if="kits.length">
        <view class="sec">
          <text class="sec__title">店里用的化妆品</text>
          <text class="sec__link" @tap="toProducts()">全部清单 ›</text>
        </view>
        <scroll-view scroll-x class="kits" :show-scrollbar="false" enhanced>
          <view
            v-for="k in kits"
            :key="k.category"
            class="kit"
            hover-class="card--hover"
            @tap="toProducts(k.category)"
          >
            <view class="kit__name">{{ k.name }}</view>
            <view class="kit__count">{{ k.count }} 件</view>
            <view class="kit__brands">{{ k.brands }}</view>
          </view>
        </scroll-view>
      </template>
    </template>

    <view class="bottom-space" />
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import {
  api, errorText, CATEGORY_LABEL, LIMITS, PRODUCT_CATEGORY_LABEL,
  type CourseSummary, type Product, type ProductCategory, type Service, type StyleCategory, type Work,
} from '@/api'
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

/**
 * 镜子一圈小灯的位置（rpx）。镜子 252×352，灯排在镜框中线上：
 * 上半圆 7 颗，两侧直边各 2 颗
 */
const MIRROR_W = 252
const RING = 8
const BULBS = (() => {
  const r = MIRROR_W / 2 - RING
  const c = MIRROR_W / 2
  const arc = [180, 150, 120, 90, 60, 30, 0].map((deg) => {
    const a = (deg * Math.PI) / 180
    return { left: c + r * Math.cos(a), top: c - r * Math.sin(a) }
  })
  const sides = [204, 282].flatMap(top => [{ left: RING, top }, { left: MIRROR_W - RING, top }])
  return [...arc, ...sides].map(p => `left:${p.left.toFixed(1)}rpx;top:${p.top.toFixed(1)}rpx`)
})()
/** 首页轮播最多几张；店主一张都没挑时放最新的几张 */
const HERO_FALLBACK = 3

const services = ref<Service[]>([])
const works = ref<Work[]>([])
const heroIndex = ref(0)
/** 展开了流程说明的项目，一次只展开一个 */
const openSvc = ref('')
const products = ref<Product[]>([])
/** 首页只放最新的几门 */
const courses = ref<CourseSummary[]>([])
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')

const heroes = computed(() => {
  const picked = works.value.filter(w => w.featured).slice(0, LIMITS.featuredWorks)
  return picked.length ? picked : works.value.slice(0, HERO_FALLBACK)
})

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

/** 化妆品按类别一张卡：几件、哪几个牌子（去重，最多 3 个） */
const kits = computed(() =>
  (Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[])
    .map((c) => {
      const items = products.value.filter(p => p.category === c)
      const brands = [...new Set(items.map(p => p.brand))]
      return {
        category: c,
        name: PRODUCT_CATEGORY_LABEL[c],
        count: items.length,
        brands: brands.slice(0, 3).join(' · ') + (brands.length > 3 ? ' 等' : ''),
      }
    })
    .filter(k => k.count),
)

async function load() {
  status.value = 'loading'
  try {
    // 化妆品清单、课程取不到不影响首页，这一块不显示就好
    ;[services.value, products.value, courses.value, works.value] = await Promise.all([
      api.listServices(),
      api.listProducts().catch(() => []),
      api.listCourses().then(list => list.slice(0, 6)).catch(() => []),
      // 作品取不到时镜子里放占位图
      api.listWorks().catch(() => []),
    ])
    heroIndex.value = 0
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
const toProducts = (category?: ProductCategory) =>
  uni.navigateTo({ url: `/pages/products/index${category ? `?category=${category}` : ''}` })
const toCourses = () => uni.navigateTo({ url: '/pages/course/index' })
const toCourse = (id: string) => uni.navigateTo({ url: `/pages/course/detail?id=${id}` })
/** 镜子里的作品：关联了项目就去看项目，没关联就去作品页看同一类 */
const toHero = (w: Work) => (w.serviceId ? toService(w.serviceId) : toWorks(w.category))
const toggleSvc = (id: string) => { openSvc.value = openSvc.value === id ? '' : id }
/** 信任条里只有“用品品牌公开”能点，点了看化妆品清单 */
const onTrust = (text: string) => { if (text === TRUST[1].text) toProducts() }
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
}

// ---------- 梳妆台 ----------

.vanity {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}

// 镜框：浅香槟色的一圈，镜面往里收 16rpx
.mirror {
  position: relative;
  width: 252rpx;
  height: 352rpx;
  border-radius: $r-arch;
  background: linear-gradient(160deg, $card 0%, $blush 100%);
  box-shadow: $shadow-float, inset 0 0 0 1rpx $hair;

  &__glass {
    position: absolute;
    top: 16rpx;
    right: 16rpx;
    bottom: 16rpx;
    left: 16rpx;
    border-radius: 999rpx 999rpx 28rpx 28rpx;
    overflow: hidden;
    // iOS 上 swiper 不跟着父元素的圆角裁切，加一层合成层
    transform: translateZ(0);
  }

  &__swiper {
    width: 100%;
    height: 100%;
  }

  // 镜框上的小灯：暖白的点，外面一圈雾玫瑰色的光晕
  &__bulb {
    position: absolute;
    width: 10rpx;
    height: 10rpx;
    margin: -5rpx 0 0 -5rpx;
    border-radius: 50%;
    background: $card;
    box-shadow: 0 0 0 2rpx rgba($rose, 0.35), 0 0 12rpx 2rpx rgba($rose, 0.55);
  }

  &__dots {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 4rpx;
    display: flex;
    justify-content: center;
    gap: 8rpx;
  }

  &__dot {
    width: 8rpx;
    height: 8rpx;
    border-radius: $r-pill;
    background: rgba($mocha, 0.25);

    &--on {
      width: 20rpx;
      background: $mocha;
    }
  }
}

// 镜子底下的台面，比镜子宽 24rpx 一边，左边一支口红、右边一瓶香水
.desk {
  position: relative;
  width: 300rpx;
  height: 12rpx;
  margin-top: -2rpx;
  border-radius: 6rpx;
  background: linear-gradient($blush, $rose);
  box-shadow: $shadow-card;

  &__lipstick {
    position: absolute;
    left: 8rpx;
    bottom: 12rpx;
    width: 8rpx;
    height: 28rpx;
    border-radius: 6rpx 2rpx 2rpx 2rpx;
    background: linear-gradient($rose 0 40%, $mocha 40% 100%);
  }

  &__bottle {
    position: absolute;
    right: 4rpx;
    bottom: 12rpx;
    width: 18rpx;
    height: 18rpx;
    border-radius: 6rpx;
    background: rgba($card, 0.85);
    box-shadow: inset 0 0 0 1rpx $hair;

    &::before {
      content: '';
      position: absolute;
      left: 5rpx;
      top: -8rpx;
      width: 8rpx;
      height: 8rpx;
      border-radius: 2rpx;
      background: $mocha;
    }
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
  display: flex;
  gap: 20rpx;
  margin: 0 $page-x;
}

.style {
  flex: 1;
  min-width: 0;
  text-align: center;

  &__img {
    height: 204rpx;
    margin-bottom: 16rpx;
    box-shadow: $shadow-card;
  }

  &__name {
    font-size: $fs-small;
    color: $ink;
  }

  &__sub {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

.svc {
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

  &__top {
    display: flex;
    align-items: center;
    gap: $gap;
  }

  // 收起时一行，放不下用省略号；展开后整句显示
  &__meta {
    margin-bottom: 12rpx;
    line-height: 1.5;
    font-size: $fs-caption + 2rpx;
    color: $mute;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    &--open {
      white-space: normal;
    }
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}

// “看流程”：小字加一个向下的箭头，点了在卡片里展开步骤
.fold {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 0 8rpx 16rpx;
  font-size: $fs-caption + 2rpx;
  color: $mute;

  &__arrow {
    width: 10rpx;
    height: 10rpx;
    margin-top: -6rpx;
    border-right: 2rpx solid $mute;
    border-bottom: 2rpx solid $mute;
    transform: rotate(45deg);

    &--up {
      margin-top: 6rpx;
      transform: rotate(-135deg);
    }
  }
}

.steps {
  margin-top: $gap;
  padding-top: $gap;
  border-top: 1rpx solid $hair;

  &__item {
    display: flex;
    gap: 16rpx;
    font-size: $fs-small;
    line-height: 1.8;
    color: $ink;

    & + & {
      margin-top: 8rpx;
    }
  }

  &__no {
    flex: none;
    width: 28rpx;
    font-family: $font-serif;
    color: $mocha;
  }

  &__more {
    margin-top: 16rpx;
    font-size: $fs-caption + 2rpx;
    color: $mute;
    text-align: right;
  }
}

.lessons {
  white-space: nowrap;
  padding-left: $page-x;
  box-sizing: border-box;
}

.lesson {
  display: inline-block;
  width: 280rpx;
  margin-right: $gap;
  vertical-align: top;
  white-space: normal;

  &:last-child {
    margin-right: $page-x;
  }

  &__cover {
    height: 200rpx;
    border-radius: $r-inner;
    box-shadow: $shadow-card;
  }

  &__title {
    margin-top: 16rpx;
    font-size: $fs-small;
    color: $ink;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__sub {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
  }
}

.kits {
  white-space: nowrap;
  padding-left: $page-x;
  box-sizing: border-box;
}

.kit {
  display: inline-block;
  width: 216rpx;
  margin-right: $gap;
  padding: 28rpx 28rpx 32rpx;
  box-sizing: border-box;
  vertical-align: top;
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-card;
  white-space: normal;

  &:last-child {
    margin-right: $page-x;
  }

  &__name {
    font-family: $font-serif;
    font-weight: $fw-heading;
    font-size: 30rpx;
    letter-spacing: $ls-display;
  }

  &__count {
    margin-top: 4rpx;
    font-size: $fs-caption;
    color: $mute;
  }

  // 固定两行高，几张卡一样高
  &__brands {
    height: 2 * 1.6em;
    margin-top: 16rpx;
    font-size: $fs-caption;
    line-height: 1.6;
    color: $ink;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
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
