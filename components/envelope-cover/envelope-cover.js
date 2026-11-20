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

  methods: {
    onTap() {
      if (this.data.opening) {
        this.triggerEvent('skip')
      } else {
        this.triggerEvent('open')
      }
    }
  }
})
