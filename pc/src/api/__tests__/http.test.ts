import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPublicApi } from '../http'

afterEach(() => vi.unstubAllGlobals())
describe('网页公开接口', () => {
  it('读同源代理，不携带 cookie 或微信身份', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 's1' }])))
    vi.stubGlobal('fetch', fetcher)
    expect(await createPublicApi().listServices()).toEqual([{ id: 's1' }])
    expect(fetcher).toHaveBeenCalledWith('/api/v1/services', expect.objectContaining({ credentials: 'omit', method: 'GET' }))
    expect(fetcher.mock.calls[0][1].headers).toEqual({ Accept: 'application/json' })
  })
  it('筛选参数编码后传入，详情 id 不得改变接口路径', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response('[]')))
    vi.stubGlobal('fetch', fetcher)
    const api = createPublicApi()
    await api.listWorks('bridal')
    await api.getService('a/b')
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/works?category=bridal')
    expect(fetcher.mock.calls[1][0]).toBe('/api/v1/services/a%2Fb')
  })
  it('请求失败显示错误，不能静默退回演示数据', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(createPublicApi().listServices()).rejects.toMatchObject({ code: 'NETWORK' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>proxy error</html>', { status: 502 })))
    await expect(createPublicApi().getShop()).rejects.toMatchObject({ code: 'NETWORK' })
  })
  it('没有网页登录时，预约调用必须拒绝且不能发送请求', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(createPublicApi().createBooking({ serviceId: 's1', artistId: 'a1', date: '2026-10-27', time: '09:00' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(createPublicApi().listSlots('a1', '2026-10-27', 's1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
