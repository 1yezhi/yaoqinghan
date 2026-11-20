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
      this.tick()
      if (!this.data.ended && this.data.ready) {
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
        return
      }
      const parts = diffParts(target)
      this.setData({
        ready: true,
        ended: parts.ended,
        days: parts.days > 99 ? String(parts.days) : pad(parts.days),
        hours: pad(parts.hours),
        minutes: pad(parts.minutes),
        seconds: pad(parts.seconds)
      })
      if (parts.ended) this.stop()
    }
  }
})
