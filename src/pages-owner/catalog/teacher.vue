<template>
  <PageLayout>
    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <template v-else-if="status === 'ok'">
      <!-- 已经发出邀请、TA 还没确认：把邀请发给 TA -->
      <view v-if="teacher?.status === 'invited' && teacher.inviteCode" class="invite">
        <view class="invite__title">等 {{ teacher.name }} 确认</view>
        <view class="invite__text">把邀请发给 TA，TA 打开后看过授权说明、点确认，就能上架 TA 的课。邀请只能用一次。</view>
        <view class="invite__acts">
          <button class="invite__share" open-type="share" hover-class="invite__share--hover">发给 TA</button>
          <text class="invite__peek" @tap="peek">自己先看看 ›</text>
        </view>
      </view>
      <view v-else-if="teacher" class="state" :class="`state--${teacher.status}`">
        {{ stateText }}
      </view>

      <view class="h">名字<text class="h__opt">课程上显示的，比如 林小姐</text></view>
      <view class="pad">
        <input v-model="form.name" class="field" placeholder="比如 林小姐" placeholder-class="field__ph" :maxlength="LIMITS.teacherName" />
      </view>

      <view class="h">头像</view>
      <view class="pics">
        <view
          v-for="src in PICS"
          :key="src"
          class="pics__item"
          :class="{ 'pics__item--on': form.avatar === src }"
          @tap="form.avatar = src"
        >
          <ArchImage class="pics__img" :src="src" />
        </view>
      </view>
      <view class="hint">演示版先从这几个里选，以后可以用 TA 的照片（要先问过 TA）。</view>

      <view class="h">一句介绍<text class="h__opt">可以不写</text></view>
      <view class="pad">
        <input v-model="form.intro" class="field" placeholder="比如 常来的客人，单眼皮" placeholder-class="field__ph" :maxlength="LIMITS.teacherIntro" />
      </view>

      <view class="h">分成比例</view>
      <view class="pad rate">
        <input
          v-model="form.rate"
          class="field rate__input"
          type="number"
          :disabled="locked"
          placeholder="0–50"
          placeholder-class="field__ph"
          :maxlength="2"
        />
        <text class="rate__unit">%</text>
      </view>
      <view class="hint">{{ locked
        ? 'TA 确认过这个比例，不能再改。要改就结束合作，再重新邀请。'
        : '客人从 TA 的课来、到店做完的单，按项目标价的这个比例分给 TA。TA 确认后就不能改了。' }}</view>

      <view v-if="id" class="remove">
        <AppButton v-if="teacher?.status !== 'ended'" variant="ghost" size="sm" :loading="ending" loading-text="正在处理…" @click="end">
          {{ teacher?.status === 'invited' ? '收回邀请' : '结束合作' }}
        </AppButton>
        <AppButton v-if="!teacher?.agreedAt" variant="ghost" size="sm" :loading="removing" loading-text="正在删除…" @click="remove">删除</AppButton>
      </view>
      <view v-else class="gap" />
    </template>

    <template #footer>
      <BottomBar v-if="status === 'ok'" :desc="id ? '改了马上生效' : '保存后把邀请发给 TA'">
        <AppButton :disabled="!dirty" :loading="saving" loading-text="正在保存…" @click="save">
          {{ id ? '保存修改' : '生成邀请' }}
        </AppButton>
      </BottomBar>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import {
  api, errorText, cleanTeacher, validateTeacher, LIMITS,
  type ID, type Teacher, type TeacherInput,
} from '@/api'
import { formatMonthDay, toDateStr } from '@/utils/date'
import { SHOP_NAME, sharePath } from '@/utils/share'
import AppButton from '@/components/AppButton.vue'
import ArchImage from '@/components/ArchImage.vue'
import BottomBar from '@/components/BottomBar.vue'
import PageLayout from '@/components/PageLayout.vue'

const PICS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map(g => `placeholder:${g}`)

const id = ref<ID>('')
const teacher = ref<Teacher>()
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')

/** 比例用字符串存输入框里的内容，提交时转数字 */
interface Form { name: string; avatar: string; intro: string; rate: string }
const EMPTY: Form = { name: '', avatar: PICS[5], intro: '', rate: '20' }
const form = reactive<Form>({ ...EMPTY })
const saved = ref<Form>({ ...EMPTY })

const toInput = (f: Form): TeacherInput =>
  cleanTeacher({ name: f.name, avatar: f.avatar, intro: f.intro, shareRate: f.rate.trim() === '' ? NaN : Number(f.rate) })
const toForm = (t: Teacher): Form => ({ name: t.name, avatar: t.avatar, intro: t.intro ?? '', rate: String(t.shareRate) })

const dirty = computed(() => JSON.stringify(toInput(form)) !== JSON.stringify(toInput(saved.value)))
/** TA 确认过的比例不能改 */
const locked = computed(() => !!teacher.value && teacher.value.status !== 'invited')

const day = (ts?: string) => ts ? formatMonthDay(toDateStr(new Date(ts))) : ''
const stateText = computed(() => {
  const t = teacher.value
  if (!t) return ''
  if (t.status === 'active') return `合作中，TA ${day(t.agreedAt)}确认的授权。`
  return t.agreedAt
    ? `${day(t.endedAt)}结束了合作，TA 的课都下架了。之前记下的分成照常付。`
    : '邀请已经收回了，TA 打不开了。'
})

function fill(t: Teacher) {
  teacher.value = t
  saved.value = toForm(t)
  Object.assign(form, saved.value)
}

async function load() {
  status.value = 'loading'
  try {
    if (id.value) {
      const t = (await api.listTeachers()).find(x => x.id === id.value)
      if (!t) {
        errorMsg.value = '这位讲师已经被删掉了'
        status.value = 'error'
        return
      }
      fill(t)
      uni.setNavigationBarTitle({ title: t.name })
    }
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onLoad((query) => {
  id.value = query?.id ?? ''
  if (!id.value) uni.setNavigationBarTitle({ title: '邀请讲师' })
  load()
})

// ---------- 邀请 ----------

onShareAppMessage(() => {
  const t = teacher.value
  return {
    title: `${SHOP_NAME}想请你录一节课`,
    path: sharePath('/pages/course/invite', { code: t?.inviteCode }),
  }
})

const peek = () => uni.navigateTo({ url: `/pages/course/invite?code=${teacher.value?.inviteCode ?? ''}` })

// ---------- 保存 ----------

const saving = ref(false)
const toast = (title: string, duration = 2500) => uni.showToast({ title, icon: 'none', duration })

async function save() {
  if (!dirty.value || saving.value) return
  const input = toInput(form)
  const msg = validateTeacher(input)
  if (msg) return toast(msg)
  saving.value = true
  try {
    const t = id.value ? await api.updateTeacher(id.value, input) : await api.createTeacher(input)
    if (!id.value) {
      // 新建后留在这一页，马上能发邀请
      id.value = t.id
      uni.setNavigationBarTitle({ title: t.name })
      toast('邀请生成好了，点“发给 TA”')
    } else {
      toast('存好了', 1200)
    }
    fill(t)
  } catch (e) {
    toast(errorText(e), 3000)
  } finally {
    saving.value = false
  }
}

// ---------- 结束合作、删除 ----------

const ending = ref(false)

function end() {
  const t = teacher.value
  if (!t || ending.value) return
  const invited = t.status === 'invited'
  uni.showModal({
    title: invited ? '收回邀请？' : `和${t.name}结束合作？`,
    content: invited ? 'TA 就打不开这个邀请了。' : 'TA 的课会马上下架。之前记下的分成照常要付。',
    confirmText: invited ? '收回' : '结束合作',
    cancelText: '再想想',
    confirmColor: '#6E5446',
    success: async (r) => {
      if (!r.confirm) return
      ending.value = true
      try {
        fill(await api.endTeacher(t.id))
      } catch (e) {
        toast(errorText(e), 3000)
      } finally {
        ending.value = false
      }
    },
  })
}

const removing = ref(false)

function remove() {
  if (removing.value) return
  uni.showModal({
    title: `删除${saved.value.name}？`,
    content: '删掉后这个邀请也失效了。',
    confirmText: '删除',
    cancelText: '先不删',
    success: async (r) => {
      if (!r.confirm) return
      removing.value = true
      try {
        await api.deleteTeacher(id.value)
        toast('删好了', 1200)
        setTimeout(() => uni.navigateBack(), 1200)
      } catch (e) {
        toast(errorText(e), 3000)
      } finally {
        removing.value = false
      }
    },
  })
}
</script>

<style lang="scss">
.pad {
  padding: 0 $page-x;
}

.invite {
  margin: 32rpx $page-x 0;
  padding: 32rpx;
  border-radius: $r-card;
  background: $card;
  box-shadow: $shadow-soft;

  &__title {
    font-family: $font-serif;
    font-size: 32rpx;
  }

  &__text {
    margin-top: 12rpx;
    font-size: $fs-caption + 2rpx;
    line-height: 1.7;
    color: $mute;
  }

  &__acts {
    display: flex;
    align-items: center;
    gap: 32rpx;
    margin-top: 24rpx;
  }

  // 原生分享按钮做成和 AppButton 一样的次按钮（白底细边框），页面底部的“保存”才是主按钮
  &__share {
    margin: 0;
    padding: 0 40rpx;
    height: 64rpx;
    line-height: 60rpx;
    border: 2rpx solid $hair;
    border-radius: $r-pill;
    background: $card;
    font-size: $fs-small;
    color: $mocha;

    &::after {
      border: none;
    }

    &--hover {
      opacity: 0.7;
    }
  }

  &__peek {
    font-size: $fs-caption + 2rpx;
    color: $mute;
  }
}

.state {
  margin: 32rpx $page-x 0;
  padding: 24rpx 28rpx;
  border-radius: $r-inner;
  background: $card;
  font-size: $fs-caption + 2rpx;
  line-height: 1.7;
  color: $mute;

  &--active {
    background: $sage-bg;
    color: $sage-ink;
  }
}

.h {
  margin: 44rpx $page-x 20rpx;
  font-size: 30rpx;
  font-weight: 600;

  &__opt {
    margin-left: 16rpx;
    font-size: $fs-caption;
    font-weight: normal;
    color: $mute;
  }
}

.hint {
  margin: 16rpx $page-x 0;
  font-size: $fs-caption;
  line-height: 1.6;
  color: $mute;
}

.field {
  box-sizing: border-box;
  width: 100%;
  height: 92rpx;
  padding: 0 28rpx;
  border-radius: $r-inner;
  background: $card;
  font-size: $fs-body;
  color: $ink;

  &__ph {
    color: $disabled;
  }
}

.rate {
  display: flex;
  align-items: center;
  gap: 16rpx;

  &__input {
    width: 200rpx;
  }

  &__unit {
    font-size: $fs-body;
    color: $ink;
  }
}

.pics {
  display: flex;
  justify-content: space-between;
  padding: 0 $page-x;

  &__item {
    padding: 6rpx;
    border-radius: $r-arch;

    &--on {
      box-shadow: 0 0 0 3rpx $rose;
    }
  }

  &__img {
    width: 88rpx;
    height: 110rpx;
  }
}

.remove {
  display: flex;
  justify-content: center;
  gap: 24rpx;
  margin: 64rpx 0 48rpx;
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
