const {
  getInvitation,
  saveInvitation,
  publishInvitation
} = require('../../../services/invitation-store')
const {
  EVENT_TYPES,
  THEMES,
  toEditorForm,
  fromEditorForm
} = require('../../../services/invitation-schema')
const {
  FIELD_LIMITS,
  validateForm,
  normalizeClock
} = require('../../../services/invitation-rules')
const { chooseAndPersistImages } = require('../../../utils/media')

const STEPS = [
  { key: 'basic', label: '基础' },
  { key: 'event', label: '时间地点' },
  { key: 'content', label: '内容' },
  { key: 'theme', label: '主题' },
  { key: 'publish', label: '回执与发布' }
]

function findEventTypeIndex(key) {
  const index = EVENT_TYPES.findIndex((item) => item.key === key)
  return index >= 0 ? index : 0
}

Page({
  data: {
    steps: STEPS,
    step: 0,
    eventTypes: EVENT_TYPES,
    eventTypeLabels: EVENT_TYPES.map((item) => item.label),
    eventTypeIndex: 0,
    eventTypeLabel: '婚礼 / 订婚',
    themes: THEMES,
    form: null,
    limits: FIELD_LIMITS,
    errors: {},
    checklist: [],
    saving: false
  },

  onLoad(options) {
    const id = options && options.id
    if (!id) {
      wx.showToast({ title: '缺少邀请函 ID', icon: 'none' })
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/index/index' }) }), 500)
      return
    }
    this.invitationId = id
    const config = getInvitation(id)
    if (!config) {
      wx.showToast({ title: '邀请函不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/index/index' }) }), 500)
      return
    }
    this.config = config
    const form = toEditorForm(config)
    const eventTypeIndex = findEventTypeIndex(form.eventType)
    this.setData({
      form,
      eventTypeIndex,
      eventTypeLabel: EVENT_TYPES[eventTypeIndex].label,
      checklist: this.buildChecklist(form)
    })
  },

  onHide() {
    this.saveDraft(true)
  },

  onUnload() {
    this.saveDraft(true)
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) return
    const updates = { [`form.${field}`]: event.detail.value }
    if (this.data.errors[field]) updates[`errors.${field}`] = ''
    this.setData(updates)
  },

  onEventTypeChange(event) {
    const index = Number(event.detail.value || 0)
    const type = EVENT_TYPES[index] || EVENT_TYPES[0]
    this.setData({
      eventTypeIndex: index,
      eventTypeLabel: type.label,
      'form.eventType': type.key
    })
  },

  onDateChange(event) {
    const updates = { 'form.date': event.detail.value }
    if (this.data.errors.date) updates['errors.date'] = ''
    this.setData(updates)
  },

  onTimeChange(event) {
    const updates = { 'form.time': event.detail.value }
    if (this.data.errors.time) updates['errors.time'] = ''
    this.setData(updates)
  },

  onDeadlineChange(event) {
    const updates = { 'form.rsvpDeadline': event.detail.value }
    if (this.data.errors.rsvpDeadline) updates['errors.rsvpDeadline'] = ''
    this.setData(updates)
  },

  onVolumeChange(event) {
    this.setData({ 'form.musicVolume': Number(event.detail.value || 0) })
  },

  onThemeSelect(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    this.setData({ 'form.themeId': id })
  },

  onMotionSelect(event) {
    const value = event.currentTarget.dataset.value
    this.setData({ 'form.motion': value === 'reduced' ? 'reduced' : 'full' })
  },

  onRsvpToggle(event) {
    this.setData({ 'form.rsvpEnabled': !!event.detail.value })
  },

  onRequirePhoneToggle(event) {
    this.setData({ 'form.requirePhone': !!event.detail.value })
  },

  changePartySize(event) {
    const delta = Number(event.currentTarget.dataset.delta || 0)
    const current = Number(this.data.form.maxPartySize || 2)
    const next = Math.max(1, Math.min(6, current + delta))
    this.setData({ 'form.maxPartySize': next })
  },

  async onChooseCover() {
    try {
      const files = await chooseAndPersistImages(1)
      if (files && files[0]) {
        this.setData({ 'form.cover': files[0] })
        this.saveDraft(true)
      }
    } catch (error) {
      // 用户取消选择时不提示
    }
  },

  async onChooseGallery() {
    const current = this.data.form.gallery || []
    const remaining = 6 - current.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多添加 6 张照片', icon: 'none' })
      return
    }
    try {
      const files = await chooseAndPersistImages(remaining)
      const next = current.concat(
        (files || []).filter(Boolean).map((url, index) => ({
          url,
          thumb: url,
          alt: `照片 ${current.length + index + 1}`
        }))
      )
      this.setData({ 'form.gallery': next })
      this.saveDraft(true)
    } catch (error) {
      // 用户取消选择时不提示
    }
  },

  onRemoveGallery(event) {
    const index = Number(event.currentTarget.dataset.index)
    const gallery = (this.data.form.gallery || []).slice()
    gallery.splice(index, 1)
    this.setData({ 'form.gallery': gallery })
    this.saveDraft(true)
  },

  onAddSchedule() {
    const schedule = (this.data.form.schedule || []).slice()
    if (schedule.length >= 8) {
      wx.showToast({ title: '最多添加 8 项流程', icon: 'none' })
      return
    }
    schedule.push({ time: '', title: '', note: '' })
    this.setData({ 'form.schedule': schedule })
  },

  onRemoveSchedule(event) {
    const index = Number(event.currentTarget.dataset.index)
    const schedule = (this.data.form.schedule || []).slice()
    schedule.splice(index, 1)
    this.setData({ 'form.schedule': schedule })
    this.saveDraft(true)
  },

  onScheduleInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    if (!field) return
    const updates = { [`form.schedule[${index}].${field}`]: event.detail.value }
    if (this.data.errors.schedule) updates['errors.schedule'] = ''
    this.setData(updates)
  },

  onScheduleTimeBlur(event) {
    const index = Number(event.currentTarget.dataset.index)
    const schedule = (this.data.form && this.data.form.schedule) || []
    const current = schedule[index]
    if (!current || !current.time) return
    const normalized = normalizeClock(current.time)
    if (!normalized || normalized === current.time) return
    this.setData({ [`form.schedule[${index}].time`]: normalized })
  },

  onStepTap(event) {
    const step = Number(event.currentTarget.dataset.index || 0)
    this.saveDraft(true)
    this.setData({
      step,
      errors: {},
      checklist: this.buildChecklist(this.data.form)
    })
  },

  onNext() {
    if (!this.validateStep(this.data.step)) return
    this.saveDraft(true)
    const next = Math.min(this.data.steps.length - 1, this.data.step + 1)
    this.setData({
      step: next,
      checklist: this.buildChecklist(this.data.form)
    })
  },

  onPrev() {
    this.saveDraft(true)
    this.setData({ step: Math.max(0, this.data.step - 1), errors: {} })
  },

  onJumpStep(event) {
    const step = Number(event.currentTarget.dataset.step || 0)
    this.setData({ step })
  },

  validateStep(step) {
    const result = validateForm(this.data.form || {}, step)
    if (!result.ok) {
      this.setData({ errors: result.errors })
      wx.showToast({ title: result.message, icon: 'none' })
      return false
    }
    this.setData({ errors: {} })
    return true
  },

  validateAll() {
    for (let i = 0; i < this.data.steps.length; i += 1) {
      if (!this.validateStep(i)) {
        this.setData({ step: i, checklist: this.buildChecklist(this.data.form) })
        return false
      }
    }
    return true
  },

  buildChecklist(form) {
    if (!form) return []
    return [
      {
        key: 'basic',
        label: '标题与发起人',
        ok: validateForm(form, 0).ok,
        step: 0
      },
      {
        key: 'event',
        label: '日期、时间与场地',
        ok: validateForm(form, 1).ok,
        step: 1
      },
      {
        key: 'letter',
        label: '邀请正文',
        ok: validateForm(form, 2).ok,
        step: 2
      },
      {
        key: 'rsvp',
        label: '回执截止与信息说明',
        ok: validateForm(form, 4).ok,
        step: 4
      }
    ]
  },

  saveDraft(silent) {
    if (!this.data.form || !this.config) return this.config
    const next = fromEditorForm(this.data.form, this.config)
    this.config = saveInvitation(next)
    if (!silent) {
      wx.showToast({ title: '草稿已保存', icon: 'success' })
    }
    return this.config
  },

  onSave() {
    this.saveDraft(false)
  },

  onPreview() {
    if (!this.validateAll()) return
    this.saveDraft(true)
    wx.navigateTo({
      url: `/pages/invite/index?id=${this.invitationId}&preview=1`
    })
  },

  onPublish() {
    if (!this.validateAll()) return
    const saved = this.saveDraft(true)
    if (!saved) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      return
    }
    const published = publishInvitation(this.invitationId)
    if (!published) {
      wx.showToast({ title: '发布失败，请重试', icon: 'none' })
      return
    }
    this.config = published
    wx.showModal({
      title: '发布成功',
      content: '邀请函已经可以分享给宾客了。',
      confirmText: '查看邀请函',
      cancelText: '继续编辑',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: `/pages/invite/index?id=${this.invitationId}` })
        }
      }
    })
  },

  onShareAppMessage() {
    const form = this.data.form || {}
    return {
      title: (form.title || '诚挚邀请'),
      path: `/pages/invite/index?id=${this.invitationId}`,
      imageUrl: form.cover || ''
    }
  }
})
