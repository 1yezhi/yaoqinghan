const {
  getInvitation,
  getMyRsvp,
  getRsvpSummary
} = require('../../services/invitation-store')
const {
  visibleSections,
  hostLine
} = require('../../services/invitation-schema')
const { buildLayout } = require('../../services/invite-layout')
const { clampForDisplay } = require('../../services/invitation-rules')
const {
  formatDate,
  formatTime,
  weekday,
  formatDeadline,
  isPast
} = require('../../utils/date')

const ERROR_COPY = {
  notFound: {
    title: '这封邀请函不存在',
    desc: '链接可能已失效，或邀请函已被删除。',
    actionText: '返回首页',
    action: 'home'
  },
  notPublished: {
    title: '邀请函还在准备中',
    desc: '发起人尚未发布，请稍后再打开。',
    actionText: '返回首页',
    action: 'home'
  },
  closed: {
    title: '这场邀请已结束',
    desc: '感谢您的关注，活动已经结束。',
    actionText: '返回首页',
    action: 'home'
  },
  empty: {
    title: '邀请函内容为空',
    desc: '发起人还没有添加章节，请稍后再试。',
    actionText: '返回首页',
    action: 'home'
  },
  load: {
    title: '邀请函加载失败',
    desc: '请检查网络后再试一次。',
    actionText: '重新加载',
    action: 'retry'
  }
}

function parseInvitationId(options) {
  if (options && options.id) return decodeURIComponent(options.id)
  if (options && options.scene) {
    const scene = decodeURIComponent(options.scene)
    const matched = scene.match(/(?:^|&)i=([^&]+)/)
    if (matched) return matched[1]
    return scene
  }
  return 'demo-invitation'
}

Page({
  data: {
    loading: true,
    error: '',
    errorTitle: '',
    errorDesc: '',
    errorActionText: '',
    errorAction: '',
    config: null,
    blocks: [],
    expanded: { letter: false, story: false },
    progress: 0,
    opened: false,
    opening: false,
    musicPlaying: false,
    musicTop: 100,
    preview: false,
    themeId: 'ivory-wax',
    invitationId: '',
    envelopeHosts: '',
    dateText: '',
    timeText: '',
    weekdayText: '',
    cityLine: '',
    seal: '囍',
    rsvpVisible: false,
    myRsvp: null,
    myRsvpText: '',
    myRsvpSub: '',
    rsvpSummary: { attending: 0, declined: 0, guests: 0, total: 0 },
    rsvpDeadlineText: '',
    deadlinePassed: false,
    galleryUrls: []
  },

  onLoad(options) {
    this.invitationId = parseInvitationId(options)
    this.isPreview = options && options.preview === '1'
    this.musicVolume = 0.55
    this.audioReady = false
    this.audioError = false
    this.userPaused = false
    this.hasStarted = false
    this.resumeOnShow = false
    this.musicErrorToastShown = false
    this.setMenuButtonTop()
    this.setData({ preview: this.isPreview })
    this.setupAudioInterruption()
    this.initOpenSound()
    this.loadInvitation()
  },

  onShow() {
    if (this.resumeOnShow && this.hasStarted && !this.userPaused) {
      this.playMusic()
    }
    this.resumeOnShow = false
  },

  onHide() {
    this.resumeOnShow = this.data.musicPlaying
    if (this.data.musicPlaying) {
      this.pauseMusic(false)
    }
  },

  onUnload() {
    this.clearTimers()
    this.clearFade()
    this.clearRevealTimers()
    if (this.audio) {
      try {
        this.audio.destroy()
      } catch (error) {
        // ignore audio cleanup errors
      }
      this.audio = null
    }
    if (this.openAudio) {
      try {
        this.openAudio.destroy()
      } catch (error) {
        // ignore audio cleanup errors
      }
      this.openAudio = null
    }
    if (wx.offAudioInterruptionBegin && this.handleAudioBegin) {
      wx.offAudioInterruptionBegin(this.handleAudioBegin)
    }
    if (wx.offAudioInterruptionEnd && this.handleAudioEnd) {
      wx.offAudioInterruptionEnd(this.handleAudioEnd)
    }
  },

  setMenuButtonTop() {
    try {
      const rect = wx.getMenuButtonBoundingClientRect()
      this.setData({ musicTop: rect.bottom + 10 })
    } catch (error) {
      this.setData({ musicTop: 110 })
    }
  },

  setupAudioInterruption() {
    this.handleAudioBegin = () => {
      this.wasPlayingBeforeInterruption = this.data.musicPlaying
      if (this.data.musicPlaying) this.pauseMusic(false)
    }
    this.handleAudioEnd = () => {
      if (this.wasPlayingBeforeInterruption && !this.userPaused) {
        this.playMusic()
      }
      this.wasPlayingBeforeInterruption = false
    }
    if (wx.onAudioInterruptionBegin) wx.onAudioInterruptionBegin(this.handleAudioBegin)
    if (wx.onAudioInterruptionEnd) wx.onAudioInterruptionEnd(this.handleAudioEnd)
  },

  initOpenSound() {
    try {
      this.openAudio = wx.createInnerAudioContext()
      this.openAudio.src = '/assets/audio/envelope-open.mp3'
      this.openAudio.volume = 0.8
      this.openAudio.loop = false
      this.openAudio.onError(() => {
        // 音效缺失时不影响动画
      })
    } catch (error) {
      this.openAudio = null
    }
  },

  playOpenSound() {
    if (!this.openAudio) return
    try {
      this.openAudio.stop()
    } catch (error) {
      // ignore
    }
    try {
      this.openAudio.seek(0)
    } catch (error) {
      // ignore
    }
    try {
      this.openAudio.play()
    } catch (error) {
      // ignore
    }
  },

  vibrateOpen() {
    if (!wx.vibrateShort) return
    try {
      wx.vibrateShort({ type: 'light', fail: () => {} })
    } catch (error) {
      // ignore
    }
  },

  loadInvitation() {
    this.setData({ loading: true, error: '' })
    try {
      const config = getInvitation(this.invitationId)
      if (!config) {
        this.showError('notFound')
        return
      }
      if (!this.isPreview && (config.status === 'closed' || config.status === 'expired')) {
        this.showError('closed')
        return
      }
      if (!this.isPreview && config.status !== 'published') {
        this.showError('notPublished')
        return
      }
      const sections = visibleSections(config)
      if (!sections.length) {
        this.showError('empty')
        return
      }
      const layout = buildLayout(config)
      if (!layout.blocks.length) {
        this.showError('empty')
        return
      }
      const venue = config.event.venue || {}
      const hosts = config.hosts || []
      const names = hostLine(hosts) || config.title
      const myRsvp = getMyRsvp(config.id)
      const summary = getRsvpSummary(config.id)
      const galleryUrls = []
      sections.forEach((section) => {
        if (section.type === 'gallery' && section.data && section.data.photos) {
          section.data.photos.forEach((photo) => {
            if (photo.url) galleryUrls.push(photo.url)
          })
        }
      })
      const envelopeHosts = clampForDisplay(
        hosts.length > 1
          ? `${hosts[0].displayName || ''} & ${hosts[1].displayName || ''}`
          : names,
        22
      )
      const myRsvpText = myRsvp
        ? (myRsvp.attendance === 'yes' ? '已回复：出席' : '已回复：不出席')
        : ''
      const myRsvpSub = myRsvp
        ? (myRsvp.attendance === 'yes' ? `同行 ${myRsvp.partySize || 1} 人` : '感谢您的回复')
        : ''
      this.setData({
        loading: false,
        config,
        themeId: (config.theme && config.theme.presetId) || 'ivory-wax',
        blocks: layout.blocks,
        expanded: { letter: false, story: false },
        progress: 0,
        invitationId: config.id,
        envelopeHosts,
        dateText: formatDate(config.event.startAt, '.'),
        timeText: formatTime(config.event.startAt),
        weekdayText: weekday(config.event.startAt),
        cityLine: [venue.city, venue.name].filter(Boolean).join(' · '),
        seal: hosts
          .map((host) => String(host.displayName || '').trim().charAt(0))
          .filter(Boolean)
          .join('&')
          .slice(0, 7) || '囍',
        myRsvp,
        myRsvpText,
        myRsvpSub,
        rsvpSummary: summary,
        rsvpDeadlineText: config.rsvp && config.rsvp.deadline ? formatDeadline(config.rsvp.deadline) : '',
        deadlinePassed: !!(config.rsvp && isPast(config.rsvp.deadline)),
        galleryUrls
      })
      this.initAudio(config.music || {})
    } catch (error) {
      this.showError('load')
    }
  },

  showError(type) {
    const copy = ERROR_COPY[type] || ERROR_COPY.load
    this.setData({
      loading: false,
      error: type,
      errorTitle: copy.title,
      errorDesc: copy.desc,
      errorActionText: copy.actionText,
      errorAction: copy.action
    })
  },

  onErrorAction() {
    if (this.data.errorAction === 'retry') {
      this.loadInvitation()
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  initAudio(music) {
    if (this.audio) {
      try {
        this.audio.destroy()
      } catch (error) {
        // ignore
      }
      this.audio = null
    }
    if (!music || !music.src) return
    const audio = wx.createInnerAudioContext()
    audio.src = music.src
    audio.loop = true
    audio.autoplay = false
    audio.volume = 0
    this.musicVolume = Math.max(0, Math.min(1, Number(music.volume !== undefined ? music.volume : 0.55)))
    this.audioReady = false
    this.audioError = false
    audio.onCanplay(() => {
      this.audioReady = true
    })
    audio.onPlay(() => {
      this.setData({ musicPlaying: true })
    })
    audio.onPause(() => {
      this.setData({ musicPlaying: false })
    })
    audio.onStop(() => {
      this.setData({ musicPlaying: false })
    })
    audio.onError(() => {
      this.audioError = true
      this.setData({ musicPlaying: false })
      if (this.hasStarted && !this.musicErrorToastShown) {
        this.musicErrorToastShown = true
        wx.showToast({ title: '音乐加载失败，可继续浏览', icon: 'none' })
      }
    })
    this.audio = audio
  },

  onOpen() {
    if (this.data.opened || this.data.opening) return
    // 必须在用户点击的同一个调用栈里开始播放，避免丢失手势
    this.playMusic()
    this.playOpenSound()
    this.vibrateOpen()
    this.setData({ opening: true })
    const reduced = this.data.config && this.data.config.theme && this.data.config.theme.motion === 'reduced'
    this.openTimer = setTimeout(() => this.finishOpening(), reduced ? 420 : 1500)
  },

  finishOpening() {
    this.clearTimers()
    if (this.data.opened) return
    const updates = { opening: false, opened: true }
    if (this.data.blocks.length) updates['blocks[0].visible'] = true
    this.setData(updates, () => {
      this.prepareReveal()
    })
  },

  prepareReveal() {
    this.clearRevealTimers()
    const theme = (this.data.config && this.data.config.theme) || {}
    if (theme.motion === 'reduced') {
      this.revealAll()
      this.measureFlow()
      return
    }
    this.revealFallback = setTimeout(() => {
      if (!this.blockTops || !this.blockTops.length) this.revealAll()
    }, 900)
    this.revealTimer = setTimeout(() => this.measureFlow(), 80)
  },

  measureFlow() {
    const query = wx.createSelectorQuery()
    query.select('.invite-scroll').boundingClientRect()
    query.select('.invite-flow').boundingClientRect()
    query.selectAll('.flow-block').boundingClientRect()
    query.exec((res) => {
      const view = res && res[0]
      const flow = res && res[1]
      const list = res && res[2]
      if (!view || !flow || !list || !list.length || !view.height) {
        this.revealAll()
        return
      }
      this.viewHeight = view.height
      this.viewTop = view.top
      this.flowHeight = flow.height
      this.blockTops = list.map((item) => item.top - view.top)
      this.applyScroll(0, true)
    })
  },

  revealAll() {
    const blocks = this.data.blocks || []
    if (!blocks.length) return
    this.setData({
      blocks: blocks.map((block) => Object.assign({}, block, { visible: true }))
    })
  },

  applyScroll(top, force) {
    const blocks = this.data.blocks || []
    const tops = this.blockTops || []
    const viewHeight = this.viewHeight || 0
    if (!blocks.length || !viewHeight) return
    const fits = this.flowHeight > 0 && this.flowHeight <= viewHeight + 1
    const updates = {}
    let changed = false
    for (let i = 0; i < blocks.length; i += 1) {
      if (blocks[i].visible) continue
      const offset = tops[i]
      if (offset === undefined) continue
      if (fits || offset < top + viewHeight - 96) {
        updates[`blocks[${i}].visible`] = true
        changed = true
      }
    }
    const max = Math.max(1, (this.flowHeight || 0) - viewHeight)
    const progress = Math.max(0, Math.min(100, Math.round((top / max) * 100)))
    if (force || progress !== this.data.progress) {
      updates.progress = progress
      changed = true
    }
    if (changed) this.setData(updates)
  },

  onScroll(event) {
    this.lastScrollTop = (event.detail && event.detail.scrollTop) || 0
    if (this.scrollTimer) return
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null
      this.applyScroll(this.lastScrollTop)
    }, 70)
  },

  refreshFlowHeight() {
    if (!this.data.opened) return
    const query = wx.createSelectorQuery()
    query.select('.invite-flow').boundingClientRect()
    query.exec((res) => {
      if (res && res[0]) this.flowHeight = res[0].height
    })
  },

  toggleLetter(event) {
    const key = event.currentTarget.dataset.key === 'story' ? 'story' : 'letter'
    const expanded = this.data.expanded || {}
    const next = {}
    next[`expanded.${key}`] = !expanded[key]
    this.setData(next, () => this.refreshFlowHeight())
  },

  clearRevealTimers() {
    if (this.revealFallback) {
      clearTimeout(this.revealFallback)
      this.revealFallback = null
    }
    if (this.revealTimer) {
      clearTimeout(this.revealTimer)
      this.revealTimer = null
    }
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer)
      this.scrollTimer = null
    }
  },

  clearTimers() {
    if (this.openTimer) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
  },

  playMusic() {
    if (!this.audio) return
    if (this.audioError) {
      if (!this.musicErrorToastShown) {
        this.musicErrorToastShown = true
        wx.showToast({ title: '音乐加载失败，可继续浏览', icon: 'none' })
      }
      return
    }
    this.hasStarted = true
    this.userPaused = false
    try {
      this.audio.volume = 0
      this.audio.play()
      this.fadeIn()
    } catch (error) {
      this.audioError = true
      this.setData({ musicPlaying: false })
    }
  },

  pauseMusic(fromUser) {
    if (!this.audio) return
    this.clearFade()
    try {
      this.audio.pause()
    } catch (error) {
      // ignore
    }
    if (fromUser) this.userPaused = true
    this.setData({ musicPlaying: false })
  },

  toggleMusic() {
    if (this.data.musicPlaying) {
      this.pauseMusic(true)
    } else {
      this.playMusic()
    }
  },

  fadeIn() {
    this.clearFade()
    let current = 0
    const target = this.musicVolume
    this.fadeTimer = setInterval(() => {
      if (!this.audio) {
        this.clearFade()
        return
      }
      current = Math.min(target, current + target / 15)
      try {
        this.audio.volume = current
      } catch (error) {
        // ignore volume write errors
      }
      if (current >= target) this.clearFade()
    }, 40)
  },

  clearFade() {
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer)
      this.fadeTimer = null
    }
  },

  openRsvp() {
    if (!this.data.config || !this.data.config.rsvp || !this.data.config.rsvp.enabled) {
      wx.showToast({ title: '发起人暂未开启回执', icon: 'none' })
      return
    }
    this.setData({ rsvpVisible: true })
  },

  closeRsvp() {
    this.setData({ rsvpVisible: false })
  },

  onRsvpSubmitted(event) {
    const saved = event.detail
    const summary = getRsvpSummary(this.invitationId)
    this.setData({
      myRsvp: saved,
      myRsvpText: saved.attendance === 'yes' ? '已回复：出席' : '已回复：不出席',
      myRsvpSub: saved.attendance === 'yes' ? `同行 ${saved.partySize || 1} 人` : '感谢您的回复',
      rsvpSummary: summary
    })
  },

  onNavigate() {
    const venue = (this.data.config && this.data.config.event && this.data.config.event.venue) || {}
    const latitude = Number(venue.lat)
    const longitude = Number(venue.lng)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !latitude || !longitude) {
      this.copyAddress()
      return
    }
    wx.openLocation({
      latitude,
      longitude,
      name: venue.name || '活动地点',
      address: venue.address || '',
      scale: 18,
      fail: () => this.copyAddress()
    })
  },

  copyAddress() {
    const venue = (this.data.config && this.data.config.event && this.data.config.event.venue) || {}
    const address = [venue.city, venue.name, venue.address].filter(Boolean).join(' ')
    if (!address) {
      wx.showToast({ title: '暂未填写地址', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: address,
      success: () => wx.showToast({ title: '地址已复制', icon: 'success' })
    })
  },

  onPreviewPhoto(event) {
    const current = event.currentTarget.dataset.url
    const urls = this.data.galleryUrls.length ? this.data.galleryUrls : [current]
    wx.previewImage({ current, urls })
  },

  onShareAppMessage() {
    const config = this.data.config
    if (!config) return { title: '诚挚邀请', path: '/pages/index/index' }
    if (this.data.preview) {
      return { title: config.share.title, path: '/pages/index/index' }
    }
    return {
      title: (config.share && config.share.title) || config.title,
      path: `/pages/invite/index?id=${config.id}`,
      imageUrl: (config.share && config.share.imageUrl) || ''
    }
  },

  onShareTimeline() {
    const config = this.data.config
    if (!config || this.data.preview) return { title: '诚挚邀请' }
    return {
      title: (config.share && config.share.title) || config.title,
      query: `id=${config.id}`,
      imageUrl: (config.share && config.share.imageUrl) || ''
    }
  },

  onBackToEditor() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.redirectTo({ url: `/packageHost/pages/editor/index?id=${this.invitationId}` })
      }
    })
  }
})
