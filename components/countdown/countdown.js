const { diffParts, pad } = require('../../utils/date')

Component({
  properties: {
    target: {
      type: Number,
      value: 0,
      observer() {
        this.restart()
      }
    },
    endedText: {
      type: String,
      value: '活动已开始'
    }
  },

  data: {
    ready: false,
    ended: false,
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00'
  },

  lifetimes: {
    attached() {
      this.restart()
    },
    detached() {
      this.stop()
    }
  },

  pageLifetimes: {
    show() {
      this.restart()
    },
    hide() {
      this.stop()
    }
  },

  methods: {
    restart() {
      this.stop()
      const target = Number(this.data.target || 0)
      if (!target) {
        this.setData({ ready: false, ended: false })
        return
      }
      const ended = this.update(target)
      if (!ended) {
        this.timer = setInterval(() => this.tick(), 1000)
      }
    },

    stop() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    },

    tick() {
      const target = Number(this.data.target || 0)
      if (!target) {
        this.setData({ ready: false, ended: false })
        return true
      }
      const ended = this.update(target)
      if (ended) this.stop()
      return ended
    },

    // 返回是否已结束，避免依赖 setData 之后的 this.data 判断
    update(target) {
      const parts = diffParts(target)
      this.setData({
        ready: true,
        ended: parts.ended,
        days: parts.days > 99 ? String(parts.days) : pad(parts.days),
        hours: pad(parts.hours),
        minutes: pad(parts.minutes),
        seconds: pad(parts.seconds)
      })
      return parts.ended
    }
  }
})
