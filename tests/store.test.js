const test = require('node:test')
const assert = require('node:assert/strict')
const { installStorage } = require('./helpers')
const store = require('../services/invitation-store')
const schema = require('../services/invitation-schema')

test('首次读取播种示例，之后读取不再写存储', () => {
  const storage = installStorage()
  store.seedIfEmpty()
  assert.equal(storage.writes(), 1)
  storage.resetWrites()
  store.getInvitation('demo-invitation')
  store.listInvitations()
  store.getRsvpSummary('demo-invitation')
  assert.equal(storage.writes(), 0)
})

test('删除全部邀请函后不会被重新播种', () => {
  const storage = installStorage()
  store.seedIfEmpty()
  storage.memory[store.STORAGE_KEY].invitations = []
  assert.deepEqual(store.listInvitations(), [])
  assert.equal(storage.memory[store.STORAGE_KEY].invitations.length, 0)
})

test('创建草稿、保存与发布流程', () => {
  installStorage()
  const draft = store.createDraft()
  assert.ok(draft && draft.id)
  assert.equal(store.getInvitation(draft.id).status, 'draft')

  const form = schema.toEditorForm(draft)
  form.title = '测试邀请'
  form.hostA = '林'
  form.date = '2027-08-08'
  form.time = '18:30'
  form.venueName = '小院'
  form.venueAddress = '杭州市西湖区示例路 8 号'
  form.letterText = '好久不见，想请你来家里吃顿饭。'
  const config = schema.fromEditorForm(form, draft)
  assert.ok(store.saveInvitation(config))

  const published = store.publishInvitation(draft.id)
  assert.equal(published.status, 'published')
  assert.ok(published.publishedAt > 0)
})

test('回执写入会裁剪长度与人数并汇总', () => {
  installStorage()
  const saved = store.saveRsvp('demo-invitation', {
    name: '  王五  ',
    phone: '13800000000',
    attendance: 'yes',
    partySize: 99,
    dietary: '素',
    message: 'x'.repeat(300),
    consent: true
  })
  assert.equal(saved.name, '王五')
  assert.equal(saved.partySize, 6)
  assert.equal(saved.message.length, 200)
  const summary = store.getRsvpSummary('demo-invitation')
  assert.equal(summary.attending, 1)
  assert.equal(summary.guests, 6)
  assert.equal(summary.total, 1)
})

test('存储写入失败时返回 null 或抛错', () => {
  const storage = installStorage()
  store.seedIfEmpty()
  storage.failWrites(true)

  const config = schema.demoConfig()
  config.id = 'another'
  assert.equal(store.saveInvitation(config), null)
  assert.equal(store.createDraft(), null)
  assert.equal(store.publishInvitation('demo-invitation'), null)
  assert.throws(() => {
    store.saveRsvp('demo-invitation', { name: '甲', attendance: 'yes', partySize: 1, consent: true })
  }, /storage/)
})

test('不存在的邀请函不会写入回执', () => {
  installStorage()
  store.seedIfEmpty()
  assert.equal(store.saveRsvp('missing', { name: '甲', consent: true }), null)
})

test('损坏的 hosts 不会让读取抛错', () => {
  const storage = installStorage()
  store.seedIfEmpty()
  storage.memory[store.STORAGE_KEY].invitations[0].hosts = [null, { displayName: 'B' }]
  const config = store.getInvitation('demo-invitation')
  assert.deepEqual(config.hosts, [{ displayName: 'B' }])
})
