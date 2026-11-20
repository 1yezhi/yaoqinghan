const {
  listInvitations,
  createDraft,
  getRsvpSummary
} = require('../../services/invitation-store')
const { formatDate } = require('../../utils/date')

function coverOf(invitation) {
  const hero = (invitation.sections || []).find((section) => section.type === 'hero')
  return (hero && hero.data && hero.data.cover) || ''
}

function statusText(status) {
  if (status === 'published') return '已发布'
  if (status === 'closed' || status === 'expired') return '已结束'
  return '草稿'
}

Page({
  data: {
    invitations: []
  },

  onShow() {
    this.loadList()
  },

  loadList() {
    const list = listInvitations().map((item) => {
      const summary = getRsvpSummary(item.id)
      return {
        id: item.id,
        title: item.title || '未命名邀请函',
        status: item.status || 'draft',
        statusText: statusText(item.status),
        dateText: formatDate(item.event && item.event.startAt, '.'),
        venueName: (item.event && item.event.venue && item.event.venue.name) || '',
        cover: coverOf(item),
        rsvpCount: summary.total,
        guestCount: summary.guests
      }
    })
    this.setData({ invitations: list })
  },

  onCreate() {
    const draft = createDraft()
    wx.navigateTo({ url: `/packageHost/pages/editor/index?id=${draft.id}` })
  },

  onOpenDemo() {
    wx.navigateTo({ url: '/pages/invite/index?id=demo-invitation' })
  },

  onEdit(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/packageHost/pages/editor/index?id=${id}` })
  },

  onPreview(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/invite/index?id=${id}&preview=1` })
  },

  onResponses(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/packageHost/pages/responses/index?id=${id}` })
  },

  onShareAppMessage(options) {
    const id = options && options.target && options.target.dataset ? options.target.dataset.id : ''
    if (!id) {
      return {
        title: '诚挚邀请',
        path: '/pages/index/index'
      }
    }
    const invitation = this.data.invitations.find((item) => item.id === id)
    return {
      title: (invitation && invitation.title) || '诚挚邀请',
      path: `/pages/invite/index?id=${id}`,
      imageUrl: (invitation && invitation.cover) || ''
    }
  }
})
