function chooseMedia(count) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: resolve,
      fail: reject
    })
  })
}

function persistFile(tempFilePath) {
  return new Promise((resolve) => {
    if (!tempFilePath) {
      resolve('')
      return
    }
    wx.getFileSystemManager().saveFile({
      tempFilePath,
      success: (res) => resolve(res.savedFilePath || tempFilePath),
      // 开发工具或存储空间不足时，退回临时路径，至少本次会话可用
      fail: () => resolve(tempFilePath)
    })
  })
}

async function chooseAndPersistImages(count) {
  const result = await chooseMedia(count)
  const files = (result && result.tempFiles) || []
  return Promise.all(files.map((file) => persistFile(file.tempFilePath)))
}

function isPackageAsset(path) {
  return typeof path === 'string' && path.indexOf('/assets/') === 0
}

module.exports = {
  chooseAndPersistImages,
  persistFile,
  isPackageAsset
}
