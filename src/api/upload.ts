/**
 * 店主传课程视频：从相册选或现拍，传到云托管的对象存储，拿到 fileID 填进 Lesson.video。
 * 演示（USE_MOCK）时不真的传，返回占位 placeholder:v1 和选中视频的真实时长。
 * 对象存储要在云托管控制台把读权限设成“所有用户可读”，客人才能播。
 */
import { USE_MOCK } from './client'
import { CLOUD_ENV } from './config'
import { LIMITS } from './catalog'
import { ApiError } from './types'

export interface UploadedVideo {
  video: string
  durationSec: number
}

interface UploadTask { onProgressUpdate(cb: (res: { progress: number }) => void): void }
interface WxCloudStorage {
  init(opt?: { env?: string }): void
  uploadFile(opt: {
    cloudPath: string
    filePath: string
    config?: { env: string }
    success: (res: { fileID: string }) => void
    fail: (err: unknown) => void
  }): UploadTask
}
declare const wx: { cloud?: WxCloudStorage }

/** 一个视频最大 1GB，再大传得太慢 */
const MAX_BYTES = 1024 * 1024 * 1024

let cloudReady = false

/**
 * 选一个视频并上传。客人取消选择时返回 undefined。
 * onProgress 给 0–100 的上传进度。
 */
export async function chooseAndUploadVideo(onProgress?: (percent: number) => void): Promise<UploadedVideo | undefined> {
  let file: { tempFilePath: string, duration: number, size: number }
  try {
    file = await new Promise<typeof file>((resolve, reject) => uni.chooseMedia({
      count: 1, mediaType: ['video'], sourceType: ['album', 'camera'], maxDuration: 60,
      success: res => resolve(res.tempFiles[0] as unknown as typeof file),
      fail: reject,
    }))
  } catch {
    // 取消选择
    return undefined
  }
  const durationSec = Math.max(1, Math.round(file.duration))
  if (durationSec > LIMITS.maxLessonSec) throw new ApiError('UNKNOWN', `一节最长 ${LIMITS.maxLessonSec / 60} 分钟，剪短一点再传`)
  if (file.size > MAX_BYTES) throw new ApiError('UNKNOWN', '视频太大了，压缩到 1GB 以内再传')

  if (USE_MOCK) {
    onProgress?.(100)
    return { video: 'placeholder:v1', durationSec }
  }

  const cloud = wx.cloud
  if (!cloud) throw new ApiError('NETWORK', '微信版本太低，传不了视频')
  if (!cloudReady) { cloud.init({ env: CLOUD_ENV }); cloudReady = true }
  const ext = /\.\w+$/.exec(file.tempFilePath)?.[0] ?? '.mp4'
  const month = new Date().toISOString().slice(0, 7)
  const cloudPath = `courses/${month}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
  const fileID = await new Promise<string>((resolve, reject) => {
    const task = cloud.uploadFile({
      cloudPath, filePath: file.tempFilePath, config: { env: CLOUD_ENV },
      success: res => resolve(res.fileID),
      fail: () => reject(new ApiError('NETWORK', '视频没传上去，网络好一点再试')),
    })
    task?.onProgressUpdate?.(res => onProgress?.(res.progress))
  })
  return { video: fileID, durationSec }
}
