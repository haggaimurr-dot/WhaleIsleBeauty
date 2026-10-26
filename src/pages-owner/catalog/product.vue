<template>
  <PageLayout>
    <view v-if="status === 'error'" class="panel">
      <view class="panel__text">{{ errorMsg }}</view>
      <AppButton variant="ghost" size="sm" @click="load">再试一次</AppButton>
    </view>

    <template v-else-if="status === 'ok'">
      <view class="h">类别</view>
      <view class="chips">
        <Chip v-for="c in CATEGORIES" :key="c" :label="PRODUCT_CATEGORY_LABEL[c]" :selected="form.category === c" @click="form.category = c" />
      </view>

      <view class="h">品牌</view>
      <view class="pad">
        <input v-model="form.brand" class="field" placeholder="比如 雅诗兰黛" placeholder-class="field__ph" :maxlength="LIMITS.brand" />
      </view>

      <view class="h">名称</view>
      <view class="pad">
        <input v-model="form.name" class="field" placeholder="比如 DW 持妆粉底液" placeholder-class="field__ph" :maxlength="LIMITS.productName" />
      </view>

      <view class="h">说明<text class="h__opt">可以不写</text></view>
      <view class="pad">
        <input v-model="form.note" class="field" placeholder="比如 无酒精，敏感肌可用" placeholder-class="field__ph" :maxlength="LIMITS.productNote" />
      </view>
      <view class="hint">客人最关心能不能用：写清楚适合什么肤质、有没有酒精香精、是不是一人一份。</view>

      <view v-if="id" class="remove">
        <AppButton variant="ghost" size="sm" :loading="removing" loading-text="正在删除…" @click="remove">删除这件化妆品</AppButton>
      </view>
      <view v-else class="gap" />
    </template>

    <template #footer>
      <BottomBar v-if="status === 'ok'" :desc="id ? '改了马上生效' : '添加后排在同类的最后'">
        <AppButton :disabled="!dirty" :loading="saving" loading-text="正在保存…" @click="save">
          {{ id ? '保存修改' : '添加化妆品' }}
        </AppButton>
      </BottomBar>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  api, errorText, cleanProduct, validateProduct, LIMITS, PRODUCT_CATEGORY_LABEL,
  type ID, type Product, type ProductCategory, type ProductInput,
} from '@/api'
import AppButton from '@/components/AppButton.vue'
import BottomBar from '@/components/BottomBar.vue'
import Chip from '@/components/Chip.vue'
import PageLayout from '@/components/PageLayout.vue'

const CATEGORIES = Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]

const id = ref<ID>('')
const status = ref<'loading' | 'ok' | 'error'>('loading')
const errorMsg = ref('')

interface Form { category?: ProductCategory; brand: string; name: string; note: string }
const EMPTY: Form = { category: undefined, brand: '', name: '', note: '' }
const form = reactive<Form>({ ...EMPTY })
const saved = ref<Form>({ ...EMPTY })

const toInput = (f: Form): ProductInput =>
  cleanProduct({ category: f.category as ProductCategory, brand: f.brand, name: f.name, note: f.note })
const toForm = (p: Product): Form => ({ category: p.category, brand: p.brand, name: p.name, note: p.note ?? '' })

const dirty = computed(() => JSON.stringify(toInput(form)) !== JSON.stringify(toInput(saved.value)))

function fill(f: Form) {
  saved.value = { ...f }
  Object.assign(form, f)
}

async function load() {
  status.value = 'loading'
  try {
    if (id.value) {
      const p = (await api.listProducts()).find(x => x.id === id.value)
      if (!p) {
        errorMsg.value = '这件化妆品已经被删掉了'
        status.value = 'error'
        return
      }
      fill(toForm(p))
      uni.setNavigationBarTitle({ title: p.name })
    } else {
      fill({ ...EMPTY })
    }
    status.value = 'ok'
  } catch (e) {
    errorMsg.value = errorText(e)
    status.value = 'error'
  }
}

onLoad((query) => {
  id.value = query?.id ?? ''
  if (!id.value) uni.setNavigationBarTitle({ title: '添加化妆品' })
  load()
})

// ---------- 保存 ----------

const saving = ref(false)

async function save() {
  if (!dirty.value || saving.value) return
  const input = toInput(form)
  const msg = validateProduct(input)
  if (msg) {
    uni.showToast({ title: msg, icon: 'none', duration: 2500 })
    return
  }
  saving.value = true
  try {
    const p = id.value ? await api.updateProduct(id.value, input) : await api.createProduct(input)
    fill(toForm(p))
    uni.showToast({ title: id.value ? '存好了' : '添加好了', icon: 'none', duration: 1200 })
    setTimeout(() => uni.navigateBack(), 1200)
  } catch (e) {
    uni.showToast({ title: errorText(e), icon: 'none', duration: 3000 })
  } finally {
    saving.value = false
  }
}

// ---------- 删除 ----------

const removing = ref(false)

function remove() {
  if (removing.value) return
  uni.showModal({
    title: `删除${saved.value.name}？`,
    content: '删掉后客人在化妆品清单里就看不到了。',
    confirmText: '删除',
    cancelText: '先不删',
    success: async (r) => {
      if (!r.confirm) return
      removing.value = true
      try {
        await api.deleteProduct(id.value)
        uni.showToast({ title: '删好了', icon: 'none', duration: 1200 })
        setTimeout(() => uni.navigateBack(), 1200)
      } catch (e) {
        uni.showToast({ title: errorText(e), icon: 'none', duration: 3000 })
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 0 $page-x;
}

.remove {
  display: flex;
  justify-content: center;
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
