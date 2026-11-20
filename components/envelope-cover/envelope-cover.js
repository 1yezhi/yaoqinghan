// 信封视觉全部由 WXML 分层图片 + CSS 完成，不再依赖 Canvas / Lottie。
// 这样包内 PNG 由 image 组件直接渲染，不存在 canvas.createImage 读不到代码包路径的问题。

Component({
  properties: {
    title: { type: String, value: '诚挚邀请' },
    hosts: { type: String, value: '' },
    dateText: { type: String, value: '' },
    seal: { type: String, value: '囍' },
    opening: { type: Boolean, value: false },
    theme: { type: String, value: 'ivory-wax' },
    motion: { type: String, value: 'full' }
  },

  data: {
    nameClass: ''
  },

  observers: {
    hosts(value) {
      const length = Array.from(String(value || '')).length
      const nameClass = length > 16 ? 'is-xlong' : length > 10 ? 'is-long' : ''
      if (nameClass !== this.data.nameClass) {
        this.setData({ nameClass })
      }
    }
  },

  methods: {
    onTap() {
      if (this.data.opening || this.localOpening) return
      this.localOpening = true
      this.triggerEvent('open')
      setTimeout(() => {
        this.localOpening = false
      }, 600)
    }
  }
})
