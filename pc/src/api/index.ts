/** 默认连接本地 Go；演示模式必须显式选择。页面只从 @/api 取数据。 */
import { mockApi } from '../../../src/api/mock'
import { createPublicApi, type PcApi } from './http'
export const IS_DEMO = import.meta.env.VITE_DATA_MODE === 'demo'
export const api: PcApi = IS_DEMO ? mockApi : createPublicApi()
export * from '../../../src/api/types'
export { formatPrice } from '../../../src/utils/money'
