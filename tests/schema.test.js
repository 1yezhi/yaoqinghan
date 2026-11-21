const test = require('node:test')
const assert = require('node:assert/strict')
const schema = require('../services/invitation-schema')

test('示例邀请函包含完整章节与发布状态', () => {
  const config = schema.demoConfig()
  assert.equal(config.status, 'published')
  assert.equal(config.hosts.length, 2)
  assert.ok(config.sections.length >= 8)
  assert.equal(config.theme.presetId, 'ivory-wax')
  assert.equal(config.rsvp.enabled, true)
})

test('编辑器表单与配置可以往返', () => {
  const config = schema.demoConfig()
  const form = schema.toEditorForm(config)
  assert.equal(form.title, config.title)
  assert.equal(form.hostA, 'Alex')
  assert.equal(form.date, '2027-05-20')
  assert.equal(form.time, '12:00')
  assert.equal(form.venueName, '示例宴会厅')

  const rebuilt = schema.fromEditorForm(form, config)
  assert.equal(rebuilt.id, config.id)
  assert.equal(rebuilt.status, 'published')
  assert.equal(rebuilt.event.startAt, config.event.startAt)
  assert.equal(rebuilt.hosts[0].displayName, 'Alex')
  assert.equal(rebuilt.event.venue.lat, 31.2304)
  assert.equal(rebuilt.sections.find((item) => item.type === 'letter').data.paragraphs.length, 2)
})

test('非法数值与枚举会回落到安全默认值', () => {
  const form = schema.toEditorForm(schema.demoConfig())
  form.maxPartySize = 'abc'
  form.musicVolume = 'abc'
  form.retentionDays = 'abc'
  form.themeId = 'not-a-theme'
  form.motion = 'not-a-motion'
  form.eventType = 'not-a-type'
  form.cover = { bad: true }
  form.gallery = 'not-an-array'
  form.schedule = { bad: true }

  const config = schema.fromEditorForm(form, schema.demoConfig())
  assert.equal(config.rsvp.maxPartySize, 2)
  assert.equal(config.music.volume, 0.55)
  assert.equal(config.privacy.retentionDays, 90)
  assert.equal(config.theme.presetId, 'ivory-wax')
  assert.equal(config.theme.motion, 'full')
  assert.equal(config.eventType, 'wedding')
  assert.equal(config.sections.find((item) => item.type === 'hero').data.cover, '')
  assert.deepEqual(config.sections.find((item) => item.type === 'gallery').data.photos, [])
  assert.deepEqual(config.sections.find((item) => item.type === 'schedule').data.items, [])
})

test('normalizeConfig 修复损坏的 hosts、sections 与数值', () => {
  const config = schema.demoConfig()
  const broken = Object.assign({}, config, {
    hosts: [null, { displayName: '  B  ' }],
    sections: [
      null,
      { type: 'hero', data: { cover: { bad: true }, title: 123 } },
      { type: 'letter', data: { paragraphs: 'oops' } },
      { type: 'gallery', data: { photos: 'oops' } },
      { type: 'schedule', data: { items: null } }
    ],
    music: { src: 123, volume: 'abc' },
    rsvp: { enabled: true, maxPartySize: 99 },
    theme: { presetId: 'x', motion: 'y' },
    status: 'unknown'
  })
  const normalized = schema.normalizeConfig(broken)
  assert.deepEqual(normalized.hosts, [{ displayName: 'B' }])
  assert.equal(normalized.status, 'draft')
  assert.equal(normalized.theme.presetId, 'ivory-wax')
  assert.equal(normalized.theme.motion, 'full')
  assert.equal(normalized.music.src, schema.DEFAULT_MUSIC)
  assert.equal(normalized.music.volume, 0.55)
  assert.equal(normalized.rsvp.maxPartySize, 6)
  assert.equal(normalized.sections.length, 4)
  assert.equal(normalized.sections[0].data.cover, '')
  assert.equal(normalized.sections[0].data.title, '')
  assert.deepEqual(normalized.sections[1].data.paragraphs, [])
  assert.deepEqual(normalized.sections[2].data.photos, [])
  assert.deepEqual(normalized.sections[3].data.items, [])
})

test('normalizeConfig 对空配置返回 null', () => {
  assert.equal(schema.normalizeConfig(null), null)
  assert.equal(schema.normalizeConfig('bad'), null)
})

test('visibleSections 过滤空章节并兼容非数组数据', () => {
  const config = schema.demoConfig()
  const letter = config.sections.find((item) => item.type === 'letter')
  letter.data.paragraphs = []
  const story = config.sections.find((item) => item.type === 'story')
  story.data.paragraphs = []
  story.data.photo = ''
  const visible = schema.visibleSections(config).map((item) => item.type)
  assert.equal(visible.includes('letter'), false)
  assert.equal(visible.includes('story'), false)
  assert.equal(schema.visibleSections({ sections: 'bad' }).length, 0)
})
