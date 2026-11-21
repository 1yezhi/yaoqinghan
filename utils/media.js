function chooseMedia(count) {
  return new Promise((resolve, reject) => {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: resolve,
        fail: reject
      })
      return
    }
    // 兼容 2.10.0 以下没有 chooseMedia 的基础库
    if (wx.chooseImage) {
      wx.chooseImage({
        count,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          resolve({
            tempFiles: (res.tempFilePaths || []).map((path) => ({ tempFilePath: path }))
          })
        },
        fail: reject
      })
      return
    }
    reject(new Error('choose media unsupported'))
  })
}

function persistFile(tempFilePath) {
  return new Promise((resolve) => {
    if (!tempFilePath) {
      resolve('')
      return
    }
    let manager = null
    try {
      manager = wx.getFileSystemManager ? wx.getFileSystemManager() : null
    } catch (error) {
      manager = null
    }
    if (!manager || !manager.saveFile) {
      resolve(tempFilePath)
      return
    }
    manager.saveFile({
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
