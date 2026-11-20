const lottie = require('../../miniprogram_npm/lottie-miniprogram/index.js')
const animationData = require('../../assets/envelope/envelope-data')
const { resolveEnvelopeAssets } = require('./envelope-assets')

const FINAL_FRAME = 65
const TEXT_FADE_MS = 380
const INIT_RETRY = 3
const READY_TIMEOUT = 1200

function getDpr() {
  try {
    if (wx.getWindowInfo) {
      return wx.getWindowInfo().pixelRatio || 2
    }
    return wx.getSystemInfoSync().pixelRatio || 2
  } catch (error) {
    return 2
  }
}

function clampText(value, max) {
  const chars = Array.from(String(value || ''))
  if (chars.length <= max) return chars.join('')
  return chars.slice(0, max).join('') + '…'
}

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
    // Lottie 首帧确认前先显示静态分层信封，避免白屏
    showFallback: true,
    textStage: false
  },

  observers: {
    opening(value) {
      if (value) this.play()
    }
  },

  lifetimes: {
    ready() {
      this.initLottie(0)
    },
    detached() {
      this.destroy()
    }
  },

  methods: {
    initLottie(attempt) {
      this.createSelectorQuery()
        .select('#envelope-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (this.destroyed) return
          const info = res && res[0]
          if (!info || !info.node || !info.width || !info.height) {
            if (attempt < INIT_RETRY) {
              setTimeout(() => this.initLottie(attempt + 1), 120)
            } else {
              // 画布不可用时保留静态信封，交互仍然可用
              this.lottieBroken = true
            }
            return
          }
          try {
            const canvas = info.node
            const dpr = getDpr()
            canvas.width = Math.round(info.width * dpr)
            canvas.height = Math.round(info.height * dpr)
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('no 2d context')
            this.canvas = canvas
            this.ctx = ctx
            this.dpr = dpr
            lottie.setup(canvas)
          } catch (error) {
            this.lottieBroken = true
            return
          }
          this.loadAnimation()
        })
    },

    loadAnimation() {
      resolveEnvelopeAssets()
        .then((sources) => {
          if (this.destroyed) return
          const data = JSON.parse(JSON.stringify(animationData))
          data.assets.forEach((asset) => {
            const source = sources[asset.id]
            if (!source) return
            asset.e = 1
            asset.u = ''
            asset.p = source
          })
          this.ani = lottie.loadAnimation({
            loop: false,
            autoplay: false,
            animationData: data,
            rendererSettings: {
              context: this.ctx,
              clearCanvas: true
            }
          })
          this.ani.addEventListener('DOMLoaded', () => this.renderFirstFrame())
          this.ani.addEventListener('complete', () => {
            if (!this.destroyed) this.showText()
          })
          // DOMLoaded 在部分基础库上可能早于监听绑定
          this.readyTimer = setTimeout(() => this.renderFirstFrame(), READY_TIMEOUT)
        })
        .catch(() => {
          this.lottieBroken = true
        })
    },

    renderFirstFrame() {
      if (this.destroyed || this.firstFrame || !this.ani) return
      this.firstFrame = true
      if (this.readyTimer) {
        clearTimeout(this.readyTimer)
        this.readyTimer = null
      }
      try {
        this.ani.goToAndStop(0, true)
      } catch (error) {
        this.lottieBroken = true
        return
      }
      this.checkPainted()
    },

    // 采样信封中心像素，确认 Lottie 真的画出了图像而不是空白画布
    checkPainted() {
      let painted = false
      try {
        const canvas = this.canvas
        const pixel = this.ctx.getImageData(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height * 0.7065),
          1,
          1
        ).data
        painted = !!(pixel && pixel[3] > 8)
      } catch (error) {
        // 个别基础库不支持 getImageData，按已渲染处理
        painted = true
      }
      if (!painted) {
        this.lottieBroken = true
        return
      }
      this.lottieReady = true
      // 用户已经点击时让 CSS 兜底动画继续，避免画面中途切换
      if (!this.data.opening) {
        this.setData({ showFallback: false })
      }
      if (this.data.opening && this.data.motion === 'reduced') {
        try {
          this.ani.goToAndStop(FINAL_FRAME, true)
        } catch (error) {
          // ignore
        }
        this.showText(true)
      }
    },

    play() {
      if (this.destroyed || this.playing) return
      // Lottie 未就绪时由 WXML 静态信层的 CSS 动画接管
      if (!this.lottieReady || !this.ani) return
      this.playing = true
      if (this.data.motion === 'reduced') {
        try {
          this.ani.goToAndStop(FINAL_FRAME, true)
        } catch (error) {
          // ignore
        }
        this.showText(true)
        return
      }
      this.ani.play()
      this.textTimer = setTimeout(() => {
        if (this.destroyed) return
        try {
          this.ani.pause()
        } catch (error) {
          // ignore
        }
        this.showText()
      }, 1120)
    },

    showText(immediate) {
      if (this.textStarted || this.destroyed) return
      this.textStarted = true
      this.setData({ textStage: true }, () => {
        this.createSelectorQuery()
          .select('#text-canvas')
          .fields({ node: true, size: true })
          .exec((res) => {
            const info = res && res[0]
            if (!info || !info.node || this.destroyed) return
            this.initTextCanvas(info, !!immediate)
          })
      })
    },

    initTextCanvas(info, immediate) {
      const canvas = info.node
      const dpr = getDpr()
      const width = info.width
      const height = info.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      const ctx = canvas.getContext('2d')
      this.textCanvas = canvas
      this.textCtx = ctx
      this.textWidth = width
      this.textHeight = height
      this.textDpr = dpr

      if (immediate) {
        this.drawText(ctx, width, height, 1)
        return
      }

      const startedAt = Date.now()
      const loop = () => {
        if (this.destroyed) return
        const progress = Math.min(1, (Date.now() - startedAt) / TEXT_FADE_MS)
        const eased = 1 - Math.pow(1 - progress, 3)
        this.drawText(ctx, width, height, eased)
        if (progress < 1) {
          this.textFrame = canvas.requestAnimationFrame(loop)
        }
      }
      this.textFrame = canvas.requestAnimationFrame(loop)
    },

    drawText(ctx, width, height, alpha) {
      ctx.setTransform(this.textDpr, 0, 0, this.textDpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const nameText = clampText(this.data.hosts || this.data.title, 24)
      const nameLength = Array.from(nameText).length
      const nameSize = Math.round(
        width * (nameLength <= 10 ? 0.05 : nameLength <= 16 ? 0.044 : 0.038)
      )
      ctx.font = `${nameSize}px "Songti SC", "STSong", serif`
      const lines = this.wrapLines(ctx, nameText, width * 0.44)
      const lineHeight = nameSize * 1.28
      const centerY = height * 0.49
      const startY = centerY - ((lines.length - 1) * lineHeight) / 2

      ctx.globalAlpha = alpha * 0.6
      ctx.fillStyle = '#a9784b'
      ctx.fillRect(width / 2 - width * 0.045, startY - lineHeight * 0.92, width * 0.09, 1)

      ctx.globalAlpha = alpha
      ctx.fillStyle = '#7a1f1a'
      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + index * lineHeight)
      })

      ctx.font = `${Math.max(9, Math.round(width * 0.026))}px "Songti SC", "STSong", serif`
      ctx.fillStyle = '#8a5a2b'
      ctx.fillText(this.data.dateText, width / 2, height * 0.56)

      const sealY = height * 0.655
      const sealRadius = Math.max(13, width * 0.043)
      ctx.beginPath()
      ctx.arc(width / 2, sealY, sealRadius, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(169, 120, 75, 0.5)'
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.font = `${Math.max(9, Math.round(width * 0.03))}px "Songti SC", "STSong", serif`
      ctx.fillStyle = '#a9784b'
      ctx.fillText(clampText(this.data.seal, 3), width / 2, sealY)

      ctx.restore()
    },

    wrapLines(ctx, text, maxWidth) {
      const tokens = String(text || '').match(/[A-Za-z0-9&'’\-.]+|\s+|[\s\S]/g) || []
      const lines = []
      let line = ''
      tokens.forEach((token) => {
        if (!line && /^\s+$/.test(token)) return
        const next = line + token
        if (line && ctx.measureText(next).width > maxWidth) {
          lines.push(line.trim())
          line = /^\s+$/.test(token) ? '' : token
        } else {
          line = next
        }
      })
      if (line.trim()) lines.push(line.trim())
      return lines.length ? lines : ['']
    },

    onTap() {
      if (this.data.opening || this.localOpening) return
      this.localOpening = true
      this.triggerEvent('open')
      setTimeout(() => {
        this.localOpening = false
      }, 600)
    },

    destroy() {
      this.destroyed = true
      if (this.textTimer) {
        clearTimeout(this.textTimer)
        this.textTimer = null
      }
      if (this.readyTimer) {
        clearTimeout(this.readyTimer)
        this.readyTimer = null
      }
      if (this.textCanvas && this.textFrame) {
        try {
          this.textCanvas.cancelAnimationFrame(this.textFrame)
        } catch (error) {
          // ignore
        }
      }
      this.textFrame = null
      if (this.ani) {
        try {
          this.ani.destroy()
        } catch (error) {
          // ignore
        }
        this.ani = null
      }
    }
  }
})
