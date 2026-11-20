const TIMEZONE_OFFSET_MINUTES = 480
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad(value) {
  return String(value).padStart(2, '0')
}

function parseParts(value) {
  const parts = String(value || '').split('-').map(Number)
  return {
    year: parts[0],
    month: parts[1],
    day: parts[2]
  }
}

function parseTimeParts(value) {
  const parts = String(value || '').split(':').map(Number)
  return {
    hour: parts[0] || 0,
    minute: parts[1] || 0
  }
}

/**
 * Convert a local date/time in a fixed timezone (default Asia/Shanghai)
 * into a UTC millisecond timestamp.
 */
function toTimestamp(dateStr, timeStr, offsetMinutes = TIMEZONE_OFFSET_MINUTES) {
  const date = parseParts(dateStr)
  const time = parseTimeParts(timeStr)
  if (!date.year || !date.month || !date.day) return 0
  return Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute) - offsetMinutes * 60 * 1000
}

function shiftedDate(timestamp, offsetMinutes = TIMEZONE_OFFSET_MINUTES) {
  return new Date(Number(timestamp || 0) + offsetMinutes * 60 * 1000)
}

function formatDate(timestamp, separator = '.') {
  const date = shiftedDate(timestamp)
  return [date.getUTCFullYear(), pad(date.getUTCMonth() + 1), pad(date.getUTCDate())].join(separator)
}

function formatDateCN(timestamp) {
  const date = shiftedDate(timestamp)
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

function formatTime(timestamp) {
  const date = shiftedDate(timestamp)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function weekday(timestamp) {
  return WEEKDAYS[shiftedDate(timestamp).getUTCDay()] || ''
}

function formatDateInput(timestamp) {
  const date = shiftedDate(timestamp)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function formatTimeInput(timestamp) {
  const date = shiftedDate(timestamp)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function formatDeadline(timestamp) {
  const date = shiftedDate(timestamp)
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日 23:59`
}

function formatDateTime(timestamp) {
  return `${formatDate(timestamp, '-')} ${formatTime(timestamp)}`
}

function endOfDayTimestamp(dateStr, offsetMinutes = TIMEZONE_OFFSET_MINUTES) {
  return toTimestamp(dateStr, '23:59', offsetMinutes)
}

function isPast(timestamp) {
  return Number(timestamp || 0) > 0 && Date.now() > Number(timestamp)
}

function diffParts(target, now = Date.now()) {
  const remaining = Math.max(0, Number(target || 0) - Number(now || 0))
  const totalSeconds = Math.floor(remaining / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    ended: remaining <= 0
  }
}

module.exports = {
  TIMEZONE_OFFSET_MINUTES,
  pad,
  toTimestamp,
  formatDate,
  formatDateCN,
  formatTime,
  weekday,
  formatDateInput,
  formatTimeInput,
  formatDeadline,
  formatDateTime,
  endOfDayTimestamp,
  isPast,
  diffParts
}
