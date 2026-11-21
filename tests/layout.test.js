const test = require('node:test')
const assert = require('node:assert/strict')
const schema = require('../services/invitation-schema')
const { buildLayout } = require('../services/invite-layout')

function demoLayout() {
  return buildLayout(schema.demoConfig())
}

test('示例版式包含首屏、正文、相册与收尾卡', () => {
  const layout = demoLayout()
  const kinds = layout.blocks.map((block) => block.kind)
  assert.deepEqual(kinds.slice(0, 2), ['hero', 'letter'])
  assert.ok(kinds.includes('gallery'))
  assert.ok(kinds.includes('closing'))
  const gallery = layout.blocks.find((block) => block.kind === 'gallery')
  assert.equal(gallery.mode, 'grid')
  assert.equal(gallery.count, 3)
})

test('无坐标时流程与地址合并，有坐标时拆开', () => {
  const config = schema.demoConfig()
  config.event.venue.lat = null
  config.event.venue.lng = null
  const merged = buildLayout(config).blocks.map((block) => block.kind)
  assert.ok(merged.includes('details'))
  assert.equal(merged.includes('venue'), false)

  const withCoords = demoLayout().blocks.map((block) => block.kind)
  assert.ok(withCoords.includes('schedule'))
  assert.ok(withCoords.includes('venue'))
  assert.equal(withCoords.includes('details'), false)
})

test('只填经度不会被当成有效坐标', () => {
  const config = schema.demoConfig()
  config.event.venue.lat = null
  config.event.venue.lng = 121.47
  const block = buildLayout(config).blocks.find(
    (item) => item.kind === 'venue' || item.kind === 'details'
  )
  assert.equal(block.venue.hasCoords, false)
  assert.equal(block.venue.lat, null)
})

test('空正文与空故事不会生成章节', () => {
  const config = schema.demoConfig()
  const letter = config.sections.find((item) => item.type === 'letter')
  letter.data.paragraphs = []
  const story = config.sections.find((item) => item.type === 'story')
  story.data.paragraphs = []
  story.data.photo = ''
  const kinds = buildLayout(config).blocks.map((block) => block.kind)
  assert.equal(kinds.includes('letter'), false)
  assert.equal(kinds.includes('story'), false)
})

test('长正文会被标记为可折叠', () => {
  const config = schema.demoConfig()
  const letter = config.sections.find((item) => item.type === 'letter')
  letter.data.paragraphs = ['这是一段很长的邀请正文。'.repeat(40)]
  const block = buildLayout(config).blocks.find((item) => item.kind === 'letter')
  assert.equal(block.clampable, true)
})

test('buildLayout 能处理空配置与损坏数据', () => {
  assert.deepEqual(buildLayout({}).blocks, [])
  const config = schema.demoConfig()
  config.sections = [{ type: 'letter', data: { paragraphs: 'bad' } }]
  const layout = buildLayout(config)
  assert.equal(layout.blocks.length, 0)
})

test('相册数量决定排版模式', () => {
  const config = schema.demoConfig()
  const gallery = config.sections.find((item) => item.type === 'gallery')
  const sample = gallery.data.photos[0]
  gallery.data.photos = [sample]
  assert.equal(buildLayout(config).blocks.find((item) => item.kind === 'gallery').mode, 'single')
  gallery.data.photos = [1, 2, 3, 4].map((index) => ({
    url: `/assets/images/gallery-${index}.jpg`,
    thumb: `/assets/images/gallery-${index}.jpg`,
    alt: ''
  }))
  assert.equal(buildLayout(config).blocks.find((item) => item.kind === 'gallery').mode, 'strip')
})
