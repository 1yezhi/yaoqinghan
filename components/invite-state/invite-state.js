Component({
  properties: {
    eyebrow: { type: String, value: 'INVITATION' },
    title: { type: String, value: '这封邀请函不存在' },
    description: { type: String, value: '' },
    actionText: { type: String, value: '返回首页' },
    showAction: { type: Boolean, value: true },
    theme: { type: String, value: 'ivory-wax' }
  },

  methods: {
    onAction() {
      this.triggerEvent('action')
    }
  }
})
