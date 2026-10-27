import type { Api } from '../../../src/api/contract'
import { ApiError, type ErrorCode } from '../../../src/api/types'

export type PcApi = Pick<Api, 'listServices' | 'getService' | 'listWorks' | 'listCourses' | 'getCourse' | 'listProducts' | 'getShop' | 'listArtists' | 'listBookableDates' | 'listSlots' | 'createBooking'>

/** 浏览器只读公开资料，未实现网页登录前不发任何预约请求。 */
export function createPublicApi(): PcApi {
  async function get<T>(path: string): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch('/api/v1' + path, {
        method: 'GET', credentials: 'omit', redirect: 'error',
        headers: { Accept: 'application/json' }, signal: controller.signal,
      })
      const data = await response.json().catch(() => undefined)
      if (!response.ok) {
        if (response.status >= 500) throw new ApiError('NETWORK', '暂时连不上门店服务，稍后再试一次吧。')
        throw new ApiError((data?.code ?? 'UNKNOWN') as ErrorCode, data?.message || '这份资料暂时无法查看，回首页再试试吧。')
      }
      if (data === undefined) throw new ApiError('NETWORK', '门店资料没有取到，再试一次吧。')
      return data as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError('NETWORK', '暂时连不上门店服务，请确认本地后端已启动，再试一次。')
    } finally { clearTimeout(timeout) }
  }
  const authRequired = async (): Promise<never> => { throw new ApiError('UNAUTHORIZED', '网页预约还在准备，请先在微信小程序里预约。') }
  return {
    listServices: () => get('/services'), getService: id => get('/services/' + encodeURIComponent(id)),
    listWorks: category => get('/works' + (category ? '?category=' + encodeURIComponent(category) : '')),
    listCourses: category => get('/courses' + (category ? '?category=' + encodeURIComponent(category) : '')),
    getCourse: id => get('/courses/' + encodeURIComponent(id)),
    listProducts: category => get('/products' + (category ? '?category=' + encodeURIComponent(category) : '')),
    getShop: () => get('/shop'), listArtists: () => get('/artists'), listBookableDates: () => get('/dates'),
    listSlots: authRequired, createBooking: authRequired,
  }
}
