const { saveRsvp } = require('../../services/invitation-store')
const { formatDeadline } = require('../../utils/date')

function emptyForm() {
  return {
    name: '',
    phone: '',
    attendance: 'yes',
    partySize: 1,
    dietary: '',
    message: '',
    consent: false
  }
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer(value) {
        if (value) this.fillForm()
      }
    },
    invitationId: { type: String, value: '' },
    config: {
      type: Object,
      value: {},
      observer() {
        this.syncConfig()
      }
    },
    privacy: { type: Object, value: {} },
    existing: {
      type: Object,
      value: null,
      observer() {
        if (this.data.visible && !this.data.success) this.fillForm()
      }
    },
    preview: {
      type: Boolean,
      value: false,
      observer() {
        this.updateLabels()
      }
    },
    deadlinePassed: {
      type: Boolean,
      value: false,
      observer() {
        this.updateLabels()
      }
    }
  },

  data: {
    form: emptyForm(),
    errors: {},
    submitting: false,
    success: false,
    submitted: null,
    maxPartySize: 2,
    requirePhone: false,
    deadlineText: '',
    attendanceText: '',
    submitLabel: '提交回执'
  },

  lifetimes: {
    attached() {
      this.syncConfig()
    }
  },

  methods: {
    syncConfig() {
      const config = this.data.config || {}
      this.setData({
        maxPartySize: Math.max(1, Number(config.maxPartySize || 2)),
        requirePhone: !!config.requirePhone,
        deadlineText: config.deadline ? formatDeadline(config.deadline) : ''
      })
      this.updateLabels()
    },

    updateLabels() {
      this.setData({
        submitLabel: this.data.preview
          ? '预览模式不可提交'
          : (this.data.deadlinePassed ? '回执已截止' : '提交回执')
      })
    },

    fillForm() {
      const existing = this.data.existing
      const maxPartySize = Math.max(1, Number((this.data.config && this.data.config.maxPartySize) || 2))
      if (existing) {
        this.setData({
          form: {
            name: existing.name || '',
            phone: existing.phone || '',
            attendance: existing.attendance === 'no' ? 'no' : 'yes',
            partySize: Math.max(1, Math.min(maxPartySize, Number(existing.partySize || 1))),
            dietary: existing.dietary || '',
            message: existing.message || '',
            consent: !!existing.consent
          },
          submitted: existing,
          success: false,
          errors: {},
          attendanceText: existing.attendance === 'no' ? '不出席' : `出席 · ${existing.partySize || 1} 人`
        })
      } else {
        this.setData({
          form: emptyForm(),
          submitted: null,
          success: false,
          errors: {},
          attendanceText: ''
        })
      }
    },

    noop() {},

    close() {
      if (this.data.submitting) return
      this.triggerEvent('close')
    },

    onMaskTap() {
      this.close()
    },

    onInput(event) {
      const field = event.currentTarget.dataset.field
      if (!field) return
      const value = event.detail.value
      this.setData({
        [`form.${field}`]: value,
        [`errors.${field}`]: ''
      })
    },

    onAttendance(event) {
      const value = event.currentTarget.dataset.value === 'no' ? 'no' : 'yes'
      this.setData({
        'form.attendance': value,
        'form.partySize': value === 'no' ? 1 : this.data.form.partySize,
        'errors.attendance': ''
      })
    },

    changePartySize(event) {
      const delta = Number(event.currentTarget.dataset.delta || 0)
      const next = Math.max(1, Math.min(this.data.maxPartySize, Number(this.data.form.partySize || 1) + delta))
      this.setData({ 'form.partySize': next })
    },

    toggleConsent() {
      this.setData({
        'form.consent': !this.data.form.consent,
        'errors.consent': ''
      })
    },

    validate() {
      const form = this.data.form
      const errors = {}
      if (!String(form.name || '').trim()) {
        errors.name = '请填写您的姓名'
      }
      if (this.data.requirePhone) {
        const phone = String(form.phone || '').trim()
        if (!phone) {
          errors.phone = '请填写手机号'
        } else if (!/^[+\d][\d\s-]{5,19}$/.test(phone)) {
          errors.phone = '手机号格式不正确'
        }
      }
      if (!form.consent) {
        errors.consent = '请先同意信息使用说明'
      }
      if (form.attendance === 'yes') {
        const size = Number(form.partySize || 1)
        if (size < 1 || size > this.data.maxPartySize) {
          errors.partySize = `同行人数需在 1–${this.data.maxPartySize} 人之间`
        }
      }
      this.setData({ errors })
      return Object.keys(errors).length === 0
    },

    submit() {
      if (this.data.preview) {
        wx.showToast({ title: '预览模式不可提交', icon: 'none' })
        return
      }
      if (this.data.deadlinePassed) {
        wx.showToast({ title: '回执已截止', icon: 'none' })
        return
      }
      if (this.data.submitting) return
      if (!this.validate()) return
      this.setData({ submitting: true })
      try {
        const saved = saveRsvp(this.data.invitationId, this.data.form)
        this.setData({
          submitting: false,
          success: true,
          submitted: saved,
          attendanceText: saved.attendance === 'no' ? '不出席' : `出席 · ${saved.partySize || 1} 人`
        })
        this.triggerEvent('submitted', saved)
        wx.showToast({ title: '回执已提交', icon: 'success' })
      } catch (error) {
        this.setData({ submitting: false })
        wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      }
    },

    editAgain() {
      this.setData({ success: false })
    }
  }
})
