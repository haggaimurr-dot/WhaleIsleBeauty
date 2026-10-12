/** 化妆品清单：客人按类别看，店主维护。用例和 server/products_test.go 对齐 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { freshMock, useMockClock } from '@/test/helpers'
import { PRODUCT_CATEGORY_LABEL, type ProductCategory, type ProductInput } from '@/api/types'
import { cleanProduct, validateProduct } from '@/api/catalog'

let api: Awaited<ReturnType<typeof freshMock>>['api']

beforeEach(async () => {
  useMockClock()
  ;({ api } = await freshMock())
})
afterEach(() => { vi.useRealTimers() })

const code = (e: unknown) => (e as { code?: string })?.code
const message = (e: unknown) => (e as { message?: string })?.message

const product: ProductInput = { category: 'base', brand: ' 植村秀 ', name: '小方瓶粉底液', note: ' ' }
const ORDER = Object.keys(PRODUCT_CATEGORY_LABEL) as ProductCategory[]

describe('客人看清单', () => {
  it('每一类都有初始数据，按类别顺序排', async () => {
    const list = await api.listProducts()
    expect(new Set(list.map(p => p.category))).toEqual(new Set(ORDER))
    const idx = list.map(p => ORDER.indexOf(p.category))
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
  })

  it('按类别筛选', async () => {
    const eye = await api.listProducts('eye')
    expect(eye.length).toBeGreaterThan(0)
    expect(eye.every(p => p.category === 'eye')).toBe(true)
  })

})

describe('店主维护', () => {
  it('新加的排在同类最后，去掉首尾空格和空说明', async () => {
    const p = await api.createProduct(product)
    expect(p).toMatchObject({ brand: '植村秀', name: '小方瓶粉底液' })
    expect(p).not.toHaveProperty('note')
    const base = await api.listProducts('base')
    expect(base[base.length - 1].id).toBe(p.id)
    // 还在底妆这一段里，没跑到最后
    const all = await api.listProducts()
    expect(all[all.length - 1].category).toBe('remover')
  })

  it('修改后客人看到新的；换类别后跟着换', async () => {
    const [first] = await api.listProducts('lip')
    const p = await api.updateProduct(first.id, { category: 'eye', brand: first.brand, name: '改个名', note: '每人一支唇刷' })
    expect(p).toMatchObject({ id: first.id, category: 'eye', name: '改个名', note: '每人一支唇刷' })
    expect((await api.listProducts('lip')).some(x => x.id === first.id)).toBe(false)
    expect((await api.listProducts('eye')).some(x => x.id === first.id)).toBe(true)
  })

  it('删除后看不到；可以删光', async () => {
    for (const p of await api.listProducts()) await api.deleteProduct(p.id)
    expect(await api.listProducts()).toEqual([])
    await expect(api.deleteProduct('nope')).rejects.toSatisfy(e => code(e) === 'NOT_FOUND')
  })

  it('不符合规则时返回 UNKNOWN 和原因', async () => {
    await expect(api.createProduct({ ...product, brand: ' ' })).rejects.toSatisfy(e => code(e) === 'UNKNOWN' && message(e) === '品牌还没填')
    await expect(api.createProduct({ ...product, category: 'hair' as ProductCategory })).rejects.toSatisfy(e => message(e) === '还没选类别')
    await expect(api.updateProduct('nope', product)).rejects.toSatisfy(e => code(e) === 'NOT_FOUND')
  })
})

describe('字段规则', () => {
  it('cleanProduct + validateProduct', () => {
    expect(validateProduct(cleanProduct(product))).toBeUndefined()
    expect(validateProduct(cleanProduct({ ...product, name: '' }))).toBe('名称还没填')
    expect(validateProduct(cleanProduct({ ...product, note: '字'.repeat(31) }))).toBe('说明最多 30 个字')
    expect(validateProduct(cleanProduct({ ...product, brand: '字'.repeat(21) }))).toBe('品牌最多 20 个字')
  })
})
