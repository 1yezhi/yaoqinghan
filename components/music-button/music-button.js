Component({
  properties: {
    playing: { type: Boolean, value: false },
    top: { type: Number, value: 100 }
  },

  methods: {
    onToggle() {
      this.triggerEvent('toggle')
    }
  }
})
