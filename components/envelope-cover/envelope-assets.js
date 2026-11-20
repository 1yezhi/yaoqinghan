// Canvas 2D 无法直接读取代码包路径，需要临时路径或 base64。
// 这里按 “getImageInfo 多路径尝试 -> 读包内文件转 base64 -> 原始路径” 依次降级。

const ASSETS = [
  { id: 'body', file: 'body.png' },
  { id: 'pocket', file: 'pocket.png' },
  { id: 'flap-front', file: 'flap-front.png' },
  { id: 'flap-back', file: 'flap-back.png' },
  { id: 'letter', file: 'letter.png' },
  { id: 'sticker', file: 'sticker.png' },
  { id: 'shadow', file: 'shadow.png' }
]

const ABS_DIR = '/assets/envelope/'
const REL_DIR = '../../assets/envelope/'
const PKG_DIR = 'assets/envelope/'

let cache = null

function isUsablePath(path) {
  return (
    typeof path === 'string' &&
    /^(wxfile:\/\/|https?:\/\/|file:\/\/|\/var\/|\/private\/|\/data\/)/.test(path)
  )
}

function getImagePath(src) {
  return new Promise((resolve) => {
    if (!wx.getImageInfo) {
      resolve('')
      return
    }
    wx.getImageInfo({
      src,
      success: (res) => resolve((res && res.path) || ''),
      fail: () => resolve('')
    })
  })
}

function readBase64(filePath) {
  return new Promise((resolve) => {
    let manager = null
    try {
      manager = wx.getFileSystemManager ? wx.getFileSystemManager() : null
    } catch (error) {
      manager = null
    }
    if (!manager || !manager.readFile) {
      resolve('')
      return
    }
    manager.readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve((res && res.data) || ''),
      fail: () => resolve('')
    })
  })
}

function resolveOne(item) {
  const candidates = [ABS_DIR + item.file, REL_DIR + item.file, PKG_DIR + item.file]
  return candidates
    .reduce(
      (chain, src) =>
        chain.then((found) => {
          if (found) return found
          return getImagePath(src).then((path) => (isUsablePath(path) ? path : ''))
        }),
      Promise.resolve('')
    )
    .then((tempPath) => {
      if (tempPath) return tempPath
      return readBase64(ABS_DIR + item.file).then((base64) => {
        if (base64) return 'data:image/png;base64,' + base64
        return readBase64(PKG_DIR + item.file).then((fallback) => {
          if (fallback) return 'data:image/png;base64,' + fallback
          console.warn('[envelope] 图层读取失败，回退到包路径：' + item.file)
          return ABS_DIR + item.file
        })
      })
    })
}

function resolveEnvelopeAssets() {
  if (cache) return cache
  cache = Promise.all(ASSETS.map(resolveOne)).then((sources) => {
    const map = {}
    ASSETS.forEach((item, index) => {
      map[item.id] = sources[index]
    })
    return map
  })
  return cache
}

module.exports = { resolveEnvelopeAssets }
