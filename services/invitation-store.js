const { uid } = require('../utils/id')
const {
  createEmptyConfig,
  demoConfig,
  normalizeConfig
} = require('./invitation-schema')

const STORAGE_KEY = 'invitation_app_v1'

function defaultState() {
  return {
    invitations: [],
    rsvps: {},
    guestId: uid('guest'),
    seededAt: Date.now()
  }
}

function loadState() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object' && Array.isArray(raw.invitations)) {
      return {
        ...defaultState(),
        ...raw,
        rsvps: raw.rsvps || {}
      }
    }
  } catch (error) {
    // 本地存储不可用时退回内存态，至少保证本次会话可预览
  }
  return defaultState()
}

function saveState(state) {
  try {
    wx.setStorageSync(STORAGE_KEY, state)
  } catch (error) {
    // 忽略本地存储写入失败，页面仍然可以使用当前内存数据
  }
}

function seedIfEmpty() {
  const state = loadState()
  if (!state.invitations.length) {
    state.invitations = [demoConfig()]
  }
  if (!state.guestId) {
    state.guestId = uid('guest')
  }
  saveState(state)
  return state
}

function listInvitations() {
  const state = seedIfEmpty()
  return state.invitations
    .slice()
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
}

function getInvitation(id) {
  const state = seedIfEmpty()
  const found = state.invitations.find((item) => item.id === id)
  return found ? normalizeConfig(found) : null
}

function saveInvitation(config) {
  const state = seedIfEmpty()
  const normalized = normalizeConfig(config)
  if (!normalized) return null
  normalized.updatedAt = Date.now()
  const index = state.invitations.findIndex((item) => item.id === normalized.id)
  if (index >= 0) {
    state.invitations[index] = normalized
  } else {
    state.invitations.unshift(normalized)
  }
  saveState(state)
  return normalized
}

function createDraft() {
  const state = seedIfEmpty()
  const draft = createEmptyConfig({
    id: uid('inv'),
    status: 'draft',
    title: '未命名邀请函'
  })
  state.invitations.unshift(draft)
  saveState(state)
  return draft
}

function publishInvitation(id) {
  const state = seedIfEmpty()
  const target = state.invitations.find((item) => item.id === id)
  if (!target) return null
  target.status = 'published'
  target.publishedAt = Date.now()
  target.updatedAt = Date.now()
  saveState(state)
  return normalizeConfig(target)
}

function unpublishInvitation(id) {
  const state = seedIfEmpty()
  const target = state.invitations.find((item) => item.id === id)
  if (!target) return null
  target.status = 'draft'
  target.updatedAt = Date.now()
  saveState(state)
  return normalizeConfig(target)
}

function removeInvitation(id) {
  const state = seedIfEmpty()
  state.invitations = state.invitations.filter((item) => item.id !== id)
  delete state.rsvps[id]
  saveState(state)
  return true
}

function getGuestId() {
  const state = seedIfEmpty()
  return state.guestId
}

function listRsvps(invitationId) {
  const state = seedIfEmpty()
  const list = state.rsvps[invitationId] || []
  return list
    .slice()
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
}

function getMyRsvp(invitationId) {
  const state = seedIfEmpty()
  const list = state.rsvps[invitationId] || []
  return list.find((item) => item.guestId === state.guestId) || null
}

function saveRsvp(invitationId, form) {
  const state = seedIfEmpty()
  const now = Date.now()
  const list = state.rsvps[invitationId] || []
  const index = list.findIndex((item) => item.guestId === state.guestId)
  const payload = {
    id: index >= 0 ? list[index].id : uid('rsvp'),
    invitationId,
    guestId: state.guestId,
    name: String(form.name || '').trim(),
    phone: String(form.phone || '').trim(),
    attendance: form.attendance === 'no' ? 'no' : 'yes',
    partySize: form.attendance === 'no' ? 1 : Math.max(1, Number(form.partySize || 1)),
    dietary: String(form.dietary || '').trim(),
    message: String(form.message || '').trim(),
    consent: !!form.consent,
    consentVersion: '2026-11-01',
    source: 'mini-program',
    createdAt: index >= 0 ? list[index].createdAt : now,
    updatedAt: now
  }
  if (index >= 0) {
    list[index] = payload
  } else {
    list.unshift(payload)
  }
  state.rsvps[invitationId] = list
  saveState(state)
  return payload
}

function getRsvpSummary(invitationId) {
  const list = listRsvps(invitationId)
  return list.reduce(
    (summary, item) => {
      if (item.attendance === 'yes') {
        summary.attending += 1
        summary.guests += Number(item.partySize || 1)
      } else {
        summary.declined += 1
      }
      summary.total += 1
      return summary
    },
    { attending: 0, declined: 0, guests: 0, total: 0 }
  )
}

module.exports = {
  STORAGE_KEY,
  seedIfEmpty,
  listInvitations,
  getInvitation,
  saveInvitation,
  createDraft,
  publishInvitation,
  unpublishInvitation,
  removeInvitation,
  getGuestId,
  listRsvps,
  getMyRsvp,
  saveRsvp,
  getRsvpSummary
}
