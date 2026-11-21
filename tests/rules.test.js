const test = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizeText,
  normalizeMultiline,
  charCount,
  isValidDate,
  normalizeClock,
  validateCoords,
  validateForm
} = require('../services/invitation-rules')
const { demoConfig, toEditorForm } = require('../services/invitation-schema')

test('normalizeText 去控制字符、合并空格并截断', () => {
  assert.equal(normalizeText('  你好\u0000   世界  ', 'title'), '你好 世界')
  assert.equal(normalizeText('a\nb', 'title'), 'a b')
  assert.equal(charCount(normalizeText('😀😀', 'hostA')), 2)
})

test('normalizeMultiline 合并连续空行并去掉首尾空行', () => {
  const text = normalizeMultiline('\n\n第一段\n\n\n\n第二段\n\n', 'letterText')
  assert.equal(text, '第一段\n\n第二段')
})

test('isValidDate 校验真实日历日期', () => {
  assert.equal(isValidDate('2028-02-29'), true)
  assert.equal(isValidDate('2027-02-29'), false)
  assert.equal(isValidDate('2027-04-31'), false)
  assert.equal(isValidDate('2027-5-1'), false)
})

test('normalizeClock 兼容 9:5 与全角冒号', () => {
  assert.equal(normalizeClock('9:5'), '09:05')
  assert.equal(normalizeClock('12：30'), '12:30')
  assert.equal(normalizeClock('24:00'), '')
  assert.equal(normalizeClock('12:60'), '')
  assert.equal(normalizeClock('abc'), '')
})

test('validateCoords 要求经纬度成对且在范围内', () => {
  assert.equal(validateCoords('', ''), '')
  assert.match(validateCoords('31.2', ''), /同时填写/)
  assert.match(validateCoords('0', '0'), /真实/)
  assert.match(validateCoords('91', '121'), /纬度/)
  assert.match(validateCoords('31', '181'), /经度/)
  assert.equal(validateCoords('31.2', '121.4'), '')
})

test('validateForm 各步骤必填校验', () => {
  const empty = { title: '', hostA: '', date: '', time: '', venueName: '', venueAddress: '', letterText: '', rsvpEnabled: false }
  assert.equal(validateForm(empty, 0).ok, false)
  assert.equal(validateForm(empty, 1).ok, false)
  assert.equal(validateForm(empty, 2).ok, false)
  assert.equal(validateForm(empty, 3).ok, true)

  const form = toEditorForm(demoConfig())
  for (const step of [0, 1, 2, 3, 4]) {
    assert.equal(validateForm(form, step).ok, true, `step ${step}`)
  }
})

test('validateForm 覆盖流程备注长度', () => {
  const form = toEditorForm(demoConfig())
  form.schedule = [{ time: '10:00', title: '仪式', note: '备'.repeat(31) }]
  const result = validateForm(form, 2)
  assert.equal(result.ok, false)
  assert.match(result.message, /流程条目/)
})
