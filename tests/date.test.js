const test = require('node:test')
const assert = require('node:assert/strict')
const {
  toTimestamp,
  formatDate,
  formatTime,
  formatDateInput,
  endOfDayTimestamp,
  isPast,
  diffParts
} = require('../utils/date')

test('toTimestamp 按北京时间换算成 UTC 时间戳', () => {
  assert.equal(toTimestamp('2027-05-20', '12:00'), Date.UTC(2027, 4, 20, 4, 0))
  assert.equal(toTimestamp('2027-01-01', '00:00'), Date.UTC(2026, 11, 31, 16, 0))
})

test('日期与时间格式化可往返', () => {
  const timestamp = toTimestamp('2027-05-20', '12:00')
  assert.equal(formatDate(timestamp, '.'), '2027.05.20')
  assert.equal(formatTime(timestamp), '12:00')
  assert.equal(formatDateInput(timestamp), '2027-05-20')
})

test('非法日期与时间返回 0', () => {
  assert.equal(toTimestamp('2027-02-30', '12:00'), 0)
  assert.equal(toTimestamp('2027-13-01', '12:00'), 0)
  assert.equal(toTimestamp('1999-12-31', '12:00'), 0)
  assert.equal(toTimestamp('2027-05-20', '24:00'), 0)
  assert.equal(toTimestamp('2027-05-20', '12:60'), 0)
  assert.equal(toTimestamp('2027-05-20', 'abc'), 0)
})

test('endOfDayTimestamp 落在当天 23:59', () => {
  const timestamp = endOfDayTimestamp('2027-05-20')
  assert.equal(formatDateInput(timestamp), '2027-05-20')
  assert.equal(formatTime(timestamp), '23:59')
})

test('isPast 与 diffParts 的边界', () => {
  assert.equal(isPast(0), false)
  assert.equal(isPast(Date.now() - 1000), true)
  assert.equal(isPast(Date.now() + 60000), false)
  const parts = diffParts(Date.now() + 65000)
  assert.equal(parts.ended, false)
  assert.equal(parts.minutes, 1)
  const ended = diffParts(Date.now() - 1000)
  assert.equal(ended.ended, true)
  assert.equal(ended.days, 0)
  assert.equal(ended.hours, 0)
})
