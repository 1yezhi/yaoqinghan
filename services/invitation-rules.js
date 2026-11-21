/**
 * 邀请函字段规则：长度上限、必填、格式校验与空内容处理。
 * 编辑器与保存逻辑共用，保证“所见即所存”。
 */

const FIELD_LIMITS = {
  title: 24,
  hostA: 12,
  hostB: 12,
  hostLine: 40,
  eyebrow: 28,
  subtitle: 40,
  city: 10,
  venueName: 30,
  venueAddress: 60,
  letterTitle: 18,
  letterText: 600,
  storyTitle: 18,
  storyText: 400,
  signature: 32,
  scheduleTime: 5,
  scheduleTitle: 16,
  scheduleNote: 30,
  galleryAlt: 20,
  privacyPurpose: 80,
  musicSrc: 300
}

const MULTILINE_FIELDS = {
  letterText: true,
  storyText: true
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const LOOSE_TIME_RE = /^(\d{1,2})[:：](\d{1,2})$/

function fieldLimit(field) {
  return FIELD_LIMITS[field] || 0
}

function charCount(value) {
  return Array.from(String(value === null || value === undefined ? '' : value)).length
}

function clampText(value, max) {
  const text = String(value === null || value === undefined ? '' : value)
  if (!max || charCount(text) <= max) return text
  return Array.from(text).slice(0, max).join('')
}

function clampForDisplay(value, max) {
  const text = String(value === null || value === undefined ? '' : value)
  if (!max || charCount(text) <= max) return text
  return Array.from(text).slice(0, max).join('') + '…'
}

function normalizeText(value, field) {
  let text = String(value === null || value === undefined ? '' : value)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t\u3000]+/g, ' ')
  if (!MULTILINE_FIELDS[field]) {
    text = text.replace(/\n+/g, ' ')
  }
  return clampText(text.trim(), fieldLimit(field))
}

function normalizeMultiline(value, field) {
  const max = fieldLimit(field)
  const lines = String(value === null || value === undefined ? '' : value)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .split('\n')
    .map((line) => line.replace(/[ \t\u3000]+/g, ' ').trim())
  const output = []
  let lastBlank = false
  lines.forEach((line) => {
    if (!line) {
      if (output.length && !lastBlank) {
        output.push('')
        lastBlank = true
      }
      return
    }
    output.push(line)
    lastBlank = false
  })
  while (output.length && !output[output.length - 1]) output.pop()
  return clampText(output.join('\n'), max)
}

function normalizeField(field, value) {
  return MULTILINE_FIELDS[field]
    ? normalizeMultiline(value, field)
    : normalizeText(value, field)
}

function splitParagraphs(value, field = 'letterText') {
  return normalizeMultiline(value, field)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isValidDate(value) {
  const matched = DATE_RE.exec(String(value || '').trim())
  if (!matched) return false
  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  if (year < 2000 || year > 2100) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidTime(value) {
  return TIME_RE.test(String(value || '').trim())
}

function normalizeClock(value) {
  const text = String(value || '').trim()
  if (isValidTime(text)) return text
  const matched = LOOSE_TIME_RE.exec(text)
  if (!matched) return ''
  const hour = Number(matched[1])
  const minute = Number(matched[2])
  if (hour > 23 || minute > 59) return ''
  const hourText = hour < 10 ? `0${hour}` : String(hour)
  const minuteText = minute < 10 ? `0${minute}` : String(minute)
  return `${hourText}:${minuteText}`
}

function hasValue(value) {
  return value !== '' && value !== null && value !== undefined
}

function validateCoords(latValue, lngValue) {
  const hasLat = hasValue(latValue)
  const hasLng = hasValue(lngValue)
  if (!hasLat && !hasLng) return ''
  if (hasLat !== hasLng) return '经纬度需要同时填写，或都留空'
  const lat = Number(latValue)
  const lng = Number(lngValue)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return '纬度需在 -90 到 90 之间'
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return '经度需在 -180 到 180 之间'
  if (lat === 0 && lng === 0) return '请填写真实的经纬度'
  return ''
}

function firstError(errors) {
  const keys = Object.keys(errors || {})
  return keys.length ? errors[keys[0]] : ''
}

/**
 * 分步骤校验。返回 { ok, errors, message }，errors 可直接用于表单内联提示。
 */
function validateForm(form, step) {
  const source = form || {}
  const errors = {}
  const add = (field, message) => {
    if (!errors[field]) errors[field] = message
  }

  const checkLength = (field, label) => {
    const limit = fieldLimit(field)
    if (limit && charCount(source[field]) > limit) {
      add(field, `${label}最多 ${limit} 字`)
    }
  }

  if (step === 0) {
    if (!normalizeText(source.title, 'title')) add('title', '请填写邀请函标题')
    if (!normalizeText(source.hostA, 'hostA')) add('hostA', '请填写发起人姓名')
    checkLength('title', '邀请函标题')
    checkLength('hostA', '发起人姓名')
    checkLength('hostB', '发起人姓名')
    checkLength('subtitle', '首屏副标题')
  }

  if (step === 1) {
    if (!isValidDate(source.date)) add('date', '请选择有效的日期')
    if (!isValidTime(source.time)) add('time', '请选择有效的时间')
    if (!normalizeText(source.venueName, 'venueName')) add('venueName', '请填写场地名称')
    if (!normalizeText(source.venueAddress, 'venueAddress')) add('venueAddress', '请填写详细地址')
    checkLength('city', '城市')
    checkLength('venueName', '场地名称')
    checkLength('venueAddress', '详细地址')
    const coordError = validateCoords(source.lat, source.lng)
    if (coordError) {
      add('lat', coordError)
      add('lng', coordError)
    }
  }

  if (step === 2) {
    const letterText = normalizeMultiline(source.letterText, 'letterText')
    if (!letterText) add('letterText', '请写一段邀请正文')
    if (letterText && charCount(letterText) < 6) add('letterText', '邀请正文至少写 6 个字')
    checkLength('letterTitle', '正文标题')
    checkLength('letterText', '邀请正文')
    checkLength('storyTitle', '故事标题')
    checkLength('storyText', '故事内容')
    const schedule = source.schedule || []
    const badTime = schedule.find((item) => item && String(item.time || '').trim() && !normalizeClock(item.time))
    if (badTime) add('schedule', '流程时间请使用 00:00–23:59 的格式')
    const overlong = schedule.find(
      (item) =>
        item &&
        (charCount(item.time) > FIELD_LIMITS.scheduleTime ||
          charCount(item.title) > FIELD_LIMITS.scheduleTitle ||
          charCount(item.note) > FIELD_LIMITS.scheduleNote)
    )
    if (overlong) add('schedule', '流程条目超出字数上限')
  }

  if (step === 3) {
    if (source.musicSrc && !/^(https:\/\/|\/)/.test(String(source.musicSrc).trim())) {
      add('musicSrc', '音乐地址需以 https:// 或 / 开头')
    }
    checkLength('musicSrc', '音乐地址')
  }

  if (step === 4) {
    if (source.rsvpEnabled) {
      if (!isValidDate(source.rsvpDeadline)) {
        add('rsvpDeadline', '请选择回执截止日期')
      } else if (isValidDate(source.date) && source.rsvpDeadline > source.date) {
        add('rsvpDeadline', '回执截止日期不能晚于活动日期')
      }
      if (!normalizeText(source.privacyPurpose, 'privacyPurpose')) {
        add('privacyPurpose', '请填写信息使用说明')
      }
      checkLength('privacyPurpose', '信息使用说明')
      const maxPartySize = Number(source.maxPartySize || 2)
      if (!Number.isFinite(maxPartySize) || maxPartySize < 1 || maxPartySize > 6) {
        add('maxPartySize', '同行人数需在 1–6 人之间')
      }
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    message: firstError(errors)
  }
}

module.exports = {
  FIELD_LIMITS,
  MULTILINE_FIELDS,
  fieldLimit,
  charCount,
  clampText,
  clampForDisplay,
  normalizeText,
  normalizeMultiline,
  normalizeField,
  splitParagraphs,
  isValidDate,
  isValidTime,
  normalizeClock,
  validateCoords,
  validateForm,
  firstError
}
