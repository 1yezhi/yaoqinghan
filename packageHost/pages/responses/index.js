const {
  getInvitation,
  listRsvps,
  getRsvpSummary
} = require('../../../services/invitation-store')
const { formatDateTime } = require('../../../utils/date')

function maskPhone(phone) {
  const value = String(phone || '').trim()
  if (!value) return '未填写手机号'
  if (value.length < 7) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

function attendanceText(item) {
  return item.attendance === 'yes' ? `出席 · ${item.partySize || 1} 人` : '不出席'
}

Page({
  data: {
    invitationTitle: '',
    summary: { attending: 0, declined: 0, guests: 0, total: 0 },
    filter: 'all',
    filterTabs: [],
    responses: [],
    filtered: []
  },

  onLoad(options) {
    this.invitationId = options && options.id
    if (!this.invitationId) {
      wx.showToast({ title: '缺少邀请函 ID', icon: 'none' })
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/index/index' }) }), 500)
      return
    }
    this.loadResponses()
  },

  onShow() {
    if (this.invitationId) this.loadResponses()
  },

  loadResponses() {
    const invitation = getInvitation(this.invitationId)
    if (!invitation) {
      wx.showToast({ title: '邀请函不存在', icon: 'none' })
      return
    }
    const list = listRsvps(this.invitationId).map((item) => ({
      ...item,
      attendanceText: attendanceText(item),
      phoneMasked: maskPhone(item.phone),
      timeText: formatDateTime(item.updatedAt || item.createdAt)
    }))
    const summary = getRsvpSummary(this.invitationId)
    const filterTabs = [
      { key: 'all', label: '全部', count: summary.total },
      { key: 'yes', label: '出席', count: summary.attending },
      { key: 'no', label: '不出席', count: summary.declined }
    ]
    this.setData({
      invitationTitle: invitation.title || '邀请函',
      summary,
      responses: list,
      filterTabs
    })
    this.applyFilter(this.data.filter, list)
  },

  applyFilter(filter, source) {
    const list = source || this.data.responses
    const filtered = filter === 'all' ? list : list.filter((item) => item.attendance === filter)
    this.setData({ filter, filtered })
  },

  onFilter(event) {
    const filter = event.currentTarget.dataset.key || 'all'
    this.applyFilter(filter)
  },

  onCopyCsv() {
    const list = this.data.responses
    if (!list.length) {
      wx.showToast({ title: '还没有回执', icon: 'none' })
      return
    }
    const header = ['姓名', '手机号', '是否出席', '人数', '饮食禁忌', '留言', '提交时间']
    const rows = list.map((item) => [
      item.name,
      item.phoneMasked,
      item.attendance === 'yes' ? '出席' : '不出席',
      item.attendance === 'yes' ? item.partySize : 0,
      item.dietary || '',
      item.message || '',
      item.timeText
    ])
    const csv = '\uFEFF' + [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell === undefined ? '' : cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    wx.setClipboardData({
      data: csv,
      success: () => wx.showToast({ title: '名单已复制', icon: 'success' })
    })
  }
})
