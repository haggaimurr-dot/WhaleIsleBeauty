<template>
  <div class="site">
    <header class="site-header">
      <a class="brand" href="#top">鲸屿<span>美妆 · 私人定制</span></a>
      <nav aria-label="主导航">
        <a href="#top">首页</a><a href="#works">作品</a><a href="#services">服务项目</a><a href="#courses">课堂</a><a href="#products">化妆品清单</a>
      </nav>
      <button class="primary small" :disabled="status !== 'ok'" @click="openBooking()">预约化妆 ↗</button>
    </header>
    <div class="demo-note">{{ IS_DEMO ? '网页演示版 · 预约不会扣款，刷新页面后恢复演示数据' : '门店资料来自本地服务 · 预约请使用微信小程序' }}</div>
    <main id="top" tabindex="-1">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow">鲸屿 / 私人化妆工作室</p>
          <h1 id="hero-title">为重要的那天，<br />认真画一次妆。</h1>
          <p class="intro">一对一，一客一消毒。<br /><span>约会、上镜、新娘，</span><span>都可以慢慢聊。</span></p>
          <button class="primary" :disabled="status !== 'ok'" @click="openBooking()">预约我的妆容 <span>↗</span></button>
          <p class="hero-footnote">留一点时间给自己，素颜过来就好。</p>
        </div>
        <div class="vanity">
          <div class="mirror">
            <ArchImage :src="heroes[heroIndex]?.image ?? 'placeholder:g1'" :alt="heroes[heroIndex]?.title ?? '妆面示意'" />
            <div class="mirror-caption"><span>店里的妆后作品</span><strong>{{ heroes[heroIndex]?.title ?? '慢慢找到适合你的妆' }}</strong></div>
          </div>
          <div class="desk"></div>
          <div v-if="heroes.length > 1" class="dots" aria-label="切换妆后作品">
            <button v-for="(work, index) in heroes" :key="work.id" :aria-label="`查看${work.title}`" :aria-pressed="heroIndex === index" @click="heroIndex = index"></button>
          </div>
        </div>
        <span class="hero-mark" aria-hidden="true">BE YOURSELF, BEAUTIFULLY.</span>
      </section>
      <div class="trust"><span>✓ 工具一客一消毒</span><a href="#products">✓ 用品品牌公开</a><span>✓ 到店不加价</span></div>
      <p v-if="status === 'loading'" class="state" role="status">正在整理妆容和项目…</p>
      <div v-else-if="status === 'error'" class="state" role="alert"><p>{{ error }}</p><button class="ghost" @click="load">再试一次</button></div>
      <template v-else>
        <section id="works" class="section">
          <div class="section-heading"><div><p class="eyebrow">为不同的日子</p><h2>按场合，找你的妆</h2></div><p>都是来过的客人，经本人同意后展示</p></div>
          <div class="occasion-grid">
            <button v-for="category in categories" :key="category" class="occasion" :class="{ selected: filter === category }" :aria-pressed="filter === category" @click="filter = filter === category ? '' : category">
              <div class="occasion-image"><ArchImage :src="works.find(work => work.category === category)?.image ?? 'placeholder:g1'" :alt="CATEGORY_LABEL[category] + '妆'" /></div>
              <span>{{ CATEGORY_LABEL[category] }}妆</span><small>{{ subtitles[category] }}</small>
            </button>
          </div>
          <div class="gallery-heading"><h3>{{ filter ? CATEGORY_LABEL[filter] + '作品' : '店里的作品' }}</h3><button v-if="filter" class="text-button" @click="filter = ''">看全部作品 ↗</button></div>
          <div class="works-grid"><button v-for="work in filteredWorks" :key="work.id" class="work" @click="openBooking(work.serviceId)"><div class="work-image"><ArchImage :src="work.image" :alt="work.title" shape="rect" /></div><strong>{{ work.title }}</strong><span>{{ work.durationText }} · 预约同款 ↗</span></button></div>
          <p v-if="!filteredWorks.length" class="state">这个场合的作品还在整理，先看看其他妆容吧。</p>
        </section>
        <section id="services" class="section">
          <div class="section-heading"><div><p class="eyebrow">一人一妆，慢慢来</p><h2>服务项目</h2></div><p>价格说清楚，来之前就心里有数。</p></div>
          <div class="service-grid">
            <article v-for="service in services" :key="service.id" class="service">
              <div class="service-image"><ArchImage :src="service.cover" :alt="service.name" shape="rect" /></div>
              <div class="service-copy"><h3>{{ service.name }}</h3><p>约 {{ service.durationMin }} 分钟 · {{ service.summary }}</p><div class="service-bottom"><strong class="price">{{ formatPrice(service.price) }}<small v-if="service.priceFrom"> 起</small></strong><button class="text-button" @click="openBooking(service.id)">预约这个妆 ↗</button></div></div>
              <details v-if="service.steps?.length"><summary>看看具体流程</summary><ol><li v-for="(step, index) in service.steps" :key="index">{{ step }}</li></ol></details>
            </article>
          </div>
        </section>
        <section id="courses" class="section">
          <div class="section-heading"><div><p class="eyebrow">把日常变得更顺手</p><h2>鲸屿课堂</h2></div><p>先认识妆容，也认识适合自己的画法。</p></div>
          <div class="course-grid"><article v-for="course in courses" :key="course.id" class="course"><div class="course-image"><ArchImage :src="course.cover" :alt="course.title" shape="rect" /></div><p class="eyebrow">{{ course.teacher.name }} · {{ course.lessonCount }} 节</p><h3>{{ course.title }}</h3><p>{{ course.summary }}</p></article></div>
          <p v-if="!courses.length" class="state">新课程还在准备，先看看店里的作品吧。</p>
        </section>
        <section id="products" class="section products-section">
          <div class="section-heading"><div><p class="eyebrow">用什么，都告诉你</p><h2>店里用的化妆品</h2></div><p>有过敏的成分，提前和我们说一声。</p></div>
          <div class="product-grid"><article v-for="category in productCategories" :key="category"><h3>{{ PRODUCT_CATEGORY_LABEL[category] }}</h3><p v-for="product in products.filter(item => item.category === category)" :key="product.id"><strong>{{ product.brand }}</strong> {{ product.name }}<small v-if="product.note">{{ product.note }}</small></p></article></div>
        </section>
      </template>
      <footer v-if="shop"><a class="brand" href="#top">鲸屿<span>美妆 · 私人定制</span></a><p>{{ shop.address }}<br />营业时间 {{ shop.openHours }}</p><p>联系门店<br /><a :href="`tel:${shop.phone}`">{{ shop.phone }}</a></p></footer>
    </main>
    <dialog ref="bookingDialog" aria-labelledby="booking-title" @cancel.prevent="closeBooking">
      <div class="dialog-heading"><div><p class="eyebrow">留一点时间给自己</p><h2 id="booking-title">预约化妆</h2></div><button class="close" aria-label="关闭预约" @click="closeBooking">×</button></div>
      <div v-if="!IS_DEMO" class="booking-result"><h3>在微信里，约好见面的时间</h3><p>请打开鲸屿微信小程序，选择项目、化妆师和到店时间。网页预约还在准备。</p><p v-if="shop">也可以联系门店：<a :href="`tel:${shop.phone}`">{{ shop.phone }}</a></p><button class="primary" @click="closeBooking">知道了</button></div><p v-if="IS_DEMO" class="demo-message">这是网页演示预约，不会真实扣款。</p>
      <form v-if="IS_DEMO && !created" @submit.prevent="submitBooking">
        <label>选一个妆<select v-model="form.serviceId" required><option v-for="service in services" :key="service.id" :value="service.id">{{ service.name }} · {{ formatPrice(service.price) }}</option></select></label>
        <div class="form-row"><label>化妆师<select v-model="form.artistId" required><option v-for="artist in artists" :key="artist.id" :value="artist.id">{{ artist.name }}</option></select></label><label>到店日期<select v-model="form.date" required><option v-for="date in dates" :key="date" :value="date">{{ date }}</option></select></label></div>
        <fieldset><legend>到店时间</legend><p v-if="slotsLoading" role="status">正在看空闲时段…</p><div v-else class="slot-grid"><button v-for="slot in slots" :key="slot.time" type="button" :disabled="!slot.available" :aria-pressed="form.time === slot.time" :class="{ selected: form.time === slot.time }" @click="form.time = slot.time">{{ slot.time }}</button></div><p v-if="!slotsLoading && !slots.some(slot => slot.available)">这天约满了，换一天看看吧。</p></fieldset>
        <label>想提前告诉化妆师的<textarea v-model="form.note" maxlength="200" placeholder="比如衣服颜色、想要的妆感、过敏成分" rows="3"></textarea></label>
        <p v-if="bookingError" class="form-error" role="alert">{{ bookingError }}</p>
        <button type="submit" class="primary submit" :disabled="submitting || slotsLoading || !form.time">{{ submitting ? '正在保留时段…' : '提交演示预约' }}</button>
      </form>
      <div v-else-if="IS_DEMO && created" class="booking-result" role="status"><h3>时段已为你保留</h3><p>{{ created.serviceName }}<br />{{ created.date }} {{ created.time }} · {{ created.artistName }}</p><p>当前状态：待付定金 {{ formatPrice(created.deposit) }}。<br />这是演示数据，15 分钟未付会自动释放时段。</p><button class="primary" @click="closeBooking">知道了</button></div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { api, IS_DEMO, formatPrice, CATEGORY_LABEL, PRODUCT_CATEGORY_LABEL, type Work, type Service, type Product, type CourseSummary, type Shop, type Artist, type SlotView, type Booking, type StyleCategory, type ProductCategory } from '@/api'
import ArchImage from './components/ArchImage.vue'

const services = ref<Service[]>([]), works = ref<Work[]>([]), courses = ref<CourseSummary[]>([]), products = ref<Product[]>([])
const shop = ref<Shop>(), artists = ref<Artist[]>([]), dates = ref<string[]>([])
const status = ref<'loading' | 'ok' | 'error'>('loading'), error = ref('')
const categories: StyleCategory[] = ['camera', 'date', 'bridal', 'host']
const productCategories = Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]
const subtitles = { camera: '镜头里的好气色', date: '近看也很干净', bridal: '留住重要的那天', host: '灯光下，自在发光' }
const filter = ref<StyleCategory | ''>(''), heroIndex = ref(0)
const heroes = computed(() => { const picked = works.value.filter(work => work.featured); return picked.length ? picked.slice(0, 6) : works.value.slice(0, 3) })
const filteredWorks = computed(() => works.value.filter(work => !filter.value || work.category === filter.value))
let timer: ReturnType<typeof setInterval> | undefined
async function load() {
  status.value = 'loading'
  try {
    ;[services.value, works.value, courses.value, products.value, shop.value, artists.value, dates.value] = await Promise.all([api.listServices(), api.listWorks(), api.listCourses(), api.listProducts(), api.getShop(), api.listArtists(), api.listBookableDates()])
    status.value = 'ok'
  } catch (err) { error.value = err instanceof Error ? err.message || '资料暂时没取到，再试一次吧。' : '资料暂时没取到，再试一次吧。'; status.value = 'error' }
}
onMounted(() => { load(); timer = setInterval(() => { if (!document.hidden && heroes.value.length) heroIndex.value = (heroIndex.value + 1) % heroes.value.length }, 5000) })
onUnmounted(() => { clearInterval(timer) })
const bookingDialog = ref<HTMLDialogElement>(), slots = ref<SlotView[]>([]), slotsLoading = ref(false), submitting = ref(false)
const bookingError = ref(''), created = ref<Booking>()
const form = reactive({ serviceId: '', artistId: '', date: '', time: '', note: '' })
let slotsRequest = 0
async function refreshSlots() {
  if (!IS_DEMO) return
  const request = ++slotsRequest
  form.time = ''; slots.value = []; bookingError.value = ''
  if (!form.serviceId || !form.artistId || !form.date) return
  slotsLoading.value = true
  try {
    const result = await api.listSlots(form.artistId, form.date, form.serviceId)
    if (request === slotsRequest) slots.value = result
  } catch (err) { if (request === slotsRequest) bookingError.value = err instanceof Error ? err.message : '时段没取到，换一天再试试。' }
  finally { if (request === slotsRequest) slotsLoading.value = false }
}
watch(() => [form.serviceId, form.artistId, form.date], refreshSlots)
function openBooking(serviceId?: string) {
  if (!IS_DEMO) { bookingDialog.value?.showModal(); return }
  created.value = undefined; bookingError.value = ''; form.note = ''
  form.serviceId = serviceId || services.value[0]?.id || ''; form.artistId = artists.value[0]?.id || ''; form.date = dates.value[0] || ''
  refreshSlots(); bookingDialog.value?.showModal()
}
function closeBooking() { if (!submitting.value) bookingDialog.value?.close() }
async function submitBooking() {
  if (submitting.value || !form.time || slotsLoading.value) return
  submitting.value = true; bookingError.value = ''
  try { created.value = (await api.createBooking({ ...form, note: form.note.trim() || undefined })).booking }
  catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'SLOT_TAKEN') { await refreshSlots(); bookingError.value = '这个时间刚被约走了，换一个时间吧。' }
    else bookingError.value = err instanceof Error ? err.message : '预约没提交成功，再试一次吧。'
  } finally { submitting.value = false }
}
</script>
