function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function installStorage(options = {}) {
  const memory = {}
  const state = { failWrites: !!options.failWrites, writes: 0 }
  global.wx = {
    getStorageSync(key) {
      // 真机每次读取都是反序列化后的新对象，这里保持一致，避免测试之间共享引用
      return memory[key] === undefined ? undefined : clone(memory[key])
    },
    setStorageSync(key, value) {
      if (state.failWrites) throw new Error('storage quota exceeded')
      state.writes += 1
      memory[key] = clone(value)
    }
  }
  return {
    memory,
    writes: () => state.writes,
    resetWrites: () => {
      state.writes = 0
    },
    failWrites: (value) => {
      state.failWrites = !!value
    }
  }
}

module.exports = { installStorage }
