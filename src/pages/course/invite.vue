<template>
  <PageLayout>
    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton v-if="gone" variant="ghost" size="sm" @click="toHome">回首页</AppButton>
      <AppButton v-else variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <template v-else-if="invite">
      <view class="head">
        <view class="head__title">想请你录一节课</view>
        <view class="head__sub">{{ invite.shopName }}邀请你，把自己怎么画妆分享给别的客人。课上会写你的名字“{{ invite.name }}”。</view>
      </view>

      <view class="h">说好的几件事</view>
      <view class="card">
        <view v-for="(t, i) in terms" :key="i" class="term">
          <text class="term__no">{{ i + 1 }}</text>
          <text class="term__text">{{ t }}</text>
        </view>
      </view>

      <view class="safe">
        <view v-for="t in AGREEMENT_SAFETY" :key="t" class="safe__li">{{ t }}</view>
      </view>

      <view class="note">{{ AGREEMENT_NOTE }}</view>

      <view class="agree" @tap="agreed = !agreed">
        <view class="agree__box" :class="{ 'agree__box--on': agreed }"><view v-if="agreed" class="agree__tick" /></view>
        <text>我看过了，同意以上内容</text>
      </view>
      <view class="gap" />
    </template>

    <template #footer>
      <BottomBar v-if="invite" :desc="`分成 ${invite.shareRate}%`">
        <AppButton :disabled="!agreed" :loading="accepting" loading-text="正在确认…" @click="accept">确认授权</AppButton>
      </BottomBar>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { api, errorText, ApiError, type TeacherInvite } from '@/api'
import { AGREEMENT_NOTE, AGREEMENT_SAFETY, AGREEMENT_VERSION, agreementTerms } from '@/utils/teaching'
import { switchTab } from '@/utils/tab'
import AppButton from '@/components/AppButton.vue'
import BottomBar from '@/components/BottomBar.vue'
import PageLayout from '@/components/PageLayout.vue'

let code = ''
const invite = ref<TeacherInvite>()
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')
/** 邀请失效了，再试也没用 */
const gone = ref(false)
const agreed = ref(false)
const accepting = ref(false)

const terms = computed(() => agreementTerms(invite.value?.shareRate ?? 0))

async function load() {
  status.value = 'loading'
  try {
    invite.value = await api.getTeacherInvite(code)
    status.value = 'ok'
  } catch (e) {
    gone.value = e instanceof ApiError && e.code === 'NOT_FOUND'
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onLoad((query) => {
  code = query?.code ?? ''
  load()
})

async function accept() {
  if (!agreed.value || accepting.value) return
  accepting.value = true
  try {
    // 带上看到的说明版本；说明在这期间改了，后端会让重新看一遍
    await api.acceptTeacherInvite(code, invite.value?.agreementVersion ?? AGREEMENT_VERSION)
    uni.showToast({ title: '确认好了，课剪好就会放上来', icon: 'none', duration: 1500 })
    setTimeout(() => uni.redirectTo({ url: '/pages/me/teaching' }), 1500)
  } catch (e) {
    uni.showToast({ title: errorText(e), icon: 'none', duration: 3000 })
    if (e instanceof ApiError && (e.code === 'INVALID_STATE' || e.code === 'NOT_FOUND')) {
      agreed.value = false
      load()
    }
  } finally {
    accepting.value = false
  }
}

const toHome = () => switchTab('home')
</script>

<style lang="scss">
.head {
  padding: 24rpx $page-x 0;

  &__title {
    font-family: $font-serif;
    font-weight: $fw-display;
    font-size: $fs-title;
    letter-spacing: $ls-display;
  }

  &__sub {
    margin-top: 16rpx;
    font-size: $fs-small;
    line-height: $lh-body;
    color: $mute;
  }
}

.h {
  margin: 48rpx $page-x 20rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.card {
  margin: 0 $page-x;
  padding: 12rpx 32rpx;
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-soft;
}

.term {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 0;
  font-size: $fs-small;
  line-height: $lh-body;
  color: $ink;

  & + & {
    border-top: 2rpx solid $hair;
  }

  &__no {
    flex: none;
    font-family: $font-serif;
    color: $mocha;
  }
}

.safe {
  margin: $gap $page-x 0;
  padding: 24rpx 28rpx;
  border-radius: $r-inner;
  background: $sage-bg;
  color: $sage-ink;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;

  &__li + &__li {
    margin-top: 12rpx;
  }
}

.note {
  margin: 20rpx $page-x 0;
  font-size: $fs-caption;
  color: $mute;
}

.agree {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 40rpx $page-x 0;
  font-size: $fs-small;
  color: $ink;

  &__box {
    position: relative;
    width: 36rpx;
    height: 36rpx;
    border: 2rpx solid $disabled;
    border-radius: 10rpx;
    background: $card;

    &--on {
      border-color: $mocha;
      background: $mocha;
    }
  }

  &__tick {
    position: absolute;
    left: 11rpx;
    top: 4rpx;
    width: 10rpx;
    height: 18rpx;
    border: solid $card;
    border-width: 0 4rpx 4rpx 0;
    transform: rotate(45deg);
  }
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
