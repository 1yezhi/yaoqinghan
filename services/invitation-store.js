const { uid } = require('../utils/id')
const {
  createEmptyConfig,
  demoConfig,
  normalizeConfig
} = require('./invitation-schema')

const STORAGE_KEY = 'invitation_app_v1'
const MAX_RSVP_PARTY = 6
const RSVP_NAME_MAX = 20
const RSVP_PHONE_MAX = 20
const RSVP_TEXT_MAX = 200

function defaultState() {
  return {
    invitations: [],
    rsvps: {},
    guestId: uid('guest'),
    seeded: false,
    seededAt: 0
  }
}

function loadState() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object' && Array.isArray(raw.invitations)) {
      const invitations = raw.invitations.filter(
        (item) => item && typeof item === 'object' && typeof item.id === 'string'
      )
      return {
        ...defaultState(),
        ...raw,
        invitations,
        rsvps: raw.rsvps && typeof raw.rsvps === 'object' ? raw.rsvps : {},
        // 老版本没有 seeded 字段：有邀请函就视为已经初始化过，避免用户删空后又被塞回示例
        seeded: raw.seeded === undefined ? invitations.length > 0 : !!raw.seeded
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
    return true
  } catch (error) {
    // 存储空间不足或环境不支持时返回 false，由调用方决定是否提示
    return false
  }
}

function seedIfEmpty() {
  const state = loadState()
  let changed = false
  if (!state.seeded) {
    if (!state.invitations.length) {
      state.invitations = [demoConfig()]
    }
    state.seeded = true
    state.seededAt = Date.now()
    changed = true
  }
  if (!state.guestId) {
    state.guestId = uid('guest')
    changed = true
  }
  if (changed) saveState(state)
  return state
}

function listInvitations() {
  const state = seedIfEmpty()
  return state.invitations
    .filter((item) => item && typeof item === 'object')
    .map(normalizeConfig)
    .filter(Boolean)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
}

function getInvitation(id) {
  const state = seedIfEmpty()
  const found = state.invitations.find((item) => item && item.id === id)
  return found ? normalizeConfig(found) : null
}

function saveInvitation(config) {
  const state = seedIfEmpty()
  const normalized = normalizeConfig(config)
  if (!normalized) return null
  normalized.updatedAt = Date.now()
  const index = state.invitations.findIndex((item) => item && item.id === normalized.id)
  if (index >= 0) {
    state.invitations[index] = normalized
  } else {
    state.invitations.unshift(normalized)
  }
  if (!saveState(state)) return null
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
  if (!saveState(state)) return null
  return draft
}

function publishInvitation(id) {
  const state = seedIfEmpty()
  const target = state.invitations.find((item) => item && item.id === id)
  if (!target) return null
  target.status = 'published'
  target.publishedAt = Date.now()
  target.updatedAt = Date.now()
  if (!saveState(state)) return null
  return normalizeConfig(target)
}

function unpublishInvitation(id) {
  const state = seedIfEmpty()
  const target = state.invitations.find((item) => item && item.id === id)
  if (!target) return null
  target.status = 'draft'
  target.updatedAt = Date.now()
  if (!saveState(state)) return null
  return normalizeConfig(target)
}

function removeInvitation(id) {
  const state = seedIfEmpty()
  const before = state.invitations.length
  state.invitations = state.invitations.filter((item) => item.id !== id)
  if (state.invitations.length === before) return false
  delete state.rsvps[id]
  return saveState(state)
}

function getGuestId() {
  const state = seedIfEmpty()
  return state.guestId
}

function listRsvps(invitationId) {
  const state = seedIfEmpty()
  const raw = state.rsvps[invitationId]
  const list = Array.isArray(raw) ? raw : []
  return list
    .filter((item) => item && typeof item === 'object')
    .slice()
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
}

function getMyRsvp(invitationId) {
  const state = seedIfEmpty()
  const list = listRsvps(invitationId)
  return list.find((item) => item.guestId === state.guestId) || null
}

function clampText(value, max) {
  return Array.from(String(value === null || value === undefined ? '' : value).trim())
    .slice(0, max)
    .join('')
}

function normalizePartySize(value) {
  const numeric = Math.floor(Number(value))
  if (!Number.isFinite(numeric)) return 1
  return Math.max(1, Math.min(MAX_RSVP_PARTY, numeric))
}

function saveRsvp(invitationId, form) {
  if (!invitationId) return null
  const state = seedIfEmpty()
  if (!state.invitations.some((item) => item.id === invitationId)) return null
  const source = form || {}
  const now = Date.now()
  const list = (Array.isArray(state.rsvps[invitationId]) ? state.rsvps[invitationId] : [])
    .filter((item) => item && typeof item === 'object')
  const index = list.findIndex((item) => item.guestId === state.guestId)
  const attendance = source.attendance === 'no' ? 'no' : 'yes'
  const name = clampText(source.name, RSVP_NAME_MAX)
  if (!name || !source.consent) return null
  const payload = {
    id: index >= 0 ? list[index].id : uid('rsvp'),
    invitationId,
    guestId: state.guestId,
    name,
    phone: clampText(source.phone, RSVP_PHONE_MAX),
    attendance,
    partySize: attendance === 'no' ? 1 : normalizePartySize(source.partySize),
    dietary: clampText(source.dietary, RSVP_TEXT_MAX),
    message: clampText(source.message, RSVP_TEXT_MAX),
    consent: !!source.consent,
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
  if (!saveState(state)) {
    throw new Error('storage unavailable')
  }
  return payload
}

function getRsvpSummary(invitationId) {
  const list = listRsvps(invitationId)
  return list.reduce(
    (summary, item) => {
      if (item && item.attendance === 'yes') {
        summary.attending += 1
        summary.guests += normalizePartySize(item.partySize)
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
