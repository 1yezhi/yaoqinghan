const { uid } = require('../utils/id')
const {
  toTimestamp,
  formatDate,
  formatDateInput,
  formatTimeInput,
  endOfDayTimestamp
} = require('../utils/date')
const {
  normalizeText,
  normalizeClock,
  splitParagraphs: splitNormalizedParagraphs
} = require('./invitation-rules')

const ASSET_COVER = '/assets/images/cover.jpg'
const ASSET_STORY = '/assets/images/story.jpg'
const ASSET_GALLERY = [
  '/assets/images/gallery-1.jpg',
  '/assets/images/gallery-2.jpg',
  '/assets/images/gallery-3.jpg'
]
const DEFAULT_MUSIC = '/assets/audio/bgm.mp3'

const EVENT_TYPES = [
  { key: 'wedding', label: '婚礼 / 订婚' },
  { key: 'birthday', label: '生日 / 成长' },
  { key: 'anniversary', label: '纪念日' },
  { key: 'corporate', label: '企业活动' },
  { key: 'other', label: '其他' }
]

const THEMES = [
  {
    id: 'ivory-wax',
    label: '奶油纸张',
    desc: '暖米白、火漆金，适合婚礼与正式晚宴',
    color: '#A9784B'
  },
  {
    id: 'gallery-noir',
    label: '现代画廊',
    desc: '留白、黑白影像，适合艺术与品牌活动',
    color: '#2B2B2B'
  },
  {
    id: 'chinese-ink',
    label: '新中式',
    desc: '宣纸、墨色与朱砂，适合中式仪式',
    color: '#A33A2B'
  }
]

const SECTION_TITLES = {
  hero: '首屏',
  letter: '邀请正文',
  story: '故事',
  gallery: '相册',
  schedule: '流程',
  venue: '地点',
  countdown: '倒计时',
  rsvp: '回执',
  thanks: '致谢'
}

const EVENT_TYPE_KEYS = EVENT_TYPES.map((item) => item.key)
const THEME_IDS = THEMES.map((item) => item.id)
const MOTION_MODES = ['full', 'reduced']
const STATUSES = ['draft', 'published', 'closed', 'expired']

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function pick(value, allowed, fallback) {
  return allowed.indexOf(value) >= 0 ? value : fallback
}

function finiteNumber(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, numeric))
}

function mediaPath(value, max = 300) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function normalizeSections(sections) {
  return safeArray(sections)
    .filter((section) => section && typeof section === 'object' && typeof section.type === 'string')
    .map((section) => {
      const data = section.data && typeof section.data === 'object' ? section.data : {}
      const next = Object.assign({}, section, {
        enabled: section.enabled !== false,
        data
      })
      if (data.paragraphs !== undefined) {
        next.data.paragraphs = safeArray(data.paragraphs).filter(
          (paragraph) => typeof paragraph === 'string' && paragraph.trim()
        )
      }
      if (data.photos !== undefined) {
        next.data.photos = safeArray(data.photos).filter(
          (photo) => photo && typeof photo === 'object' && mediaPath(photo.url)
        )
      }
      if (data.items !== undefined) {
        next.data.items = safeArray(data.items).filter((item) => item && typeof item === 'object')
      }
      const stringFields = {
        hero: ['title', 'eyebrow', 'subtitle'],
        letter: ['title', 'signature'],
        story: ['title'],
        gallery: ['title'],
        schedule: ['title'],
        countdown: ['title', 'endedText'],
        rsvp: ['title', 'description', 'buttonText'],
        thanks: ['title', 'message', 'signature']
      }
      ;(stringFields[section.type] || []).forEach((field) => {
        if (data[field] !== undefined && typeof data[field] !== 'string') {
          next.data[field] = ''
        }
      })
      if (data.cover !== undefined) next.data.cover = mediaPath(data.cover)
      if (data.photo !== undefined) next.data.photo = mediaPath(data.photo)
      return next
    })
}

function hostLine(hosts) {
  return (hosts || [])
    .map((host) => (host && host.displayName ? host.displayName : ''))
    .filter(Boolean)
    .join(' & ')
}

function splitParagraphs(text) {
  return splitNormalizedParagraphs(text, 'letterText')
}

function joinParagraphs(paragraphs) {
  return safeArray(paragraphs)
    .filter((paragraph) => typeof paragraph === 'string')
    .join('\n\n')
}

function findSection(config, type) {
  return (config.sections || []).find((section) => section.type === type) || { data: {} }
}

function defaultDate() {
  return formatDateInput(Date.now() + 30 * 24 * 60 * 60 * 1000)
}

function createEmptyConfig(overrides = {}) {
  const dateStr = overrides.date || defaultDate()
  const startAt = toTimestamp(dateStr, '12:00')
  const defaultDeadlineDate = formatDateInput(startAt - 7 * 24 * 60 * 60 * 1000)
  const deadline = endOfDayTimestamp(overrides.deadline || defaultDeadlineDate)
  const base = {
    id: overrides.id || uid('inv'),
    schemaVersion: 1,
    status: overrides.status || 'draft',
    title: overrides.title || '未命名邀请函',
    eventType: overrides.eventType || 'wedding',
    hosts: overrides.hosts || [{ displayName: '' }],
    event: {
      startAt,
      endAt: startAt + 4 * 60 * 60 * 1000,
      timezone: 'Asia/Shanghai',
      venue: overrides.venue || {
        name: '',
        address: '',
        city: '',
        lat: null,
        lng: null,
        poiId: ''
      }
    },
    theme: {
      presetId: 'ivory-wax',
      motion: 'full'
    },
    music: {
      src: DEFAULT_MUSIC,
      title: '示例背景音乐',
      volume: 0.55,
      loop: true,
      license: 'demo'
    },
    sections: [],
    rsvp: {
      enabled: true,
      deadline,
      requirePhone: false,
      allowPlusOne: true,
      maxPartySize: 2,
      allowEdit: true,
      notifyHost: true
    },
    privacy: {
      collectFields: ['name', 'phone', 'attendance', 'partySize', 'dietary', 'message'],
      purpose: '用于活动回执统计、座位与餐食安排',
      retentionDays: 90,
      consentVersion: '2026-11-01'
    },
    share: {
      title: overrides.title || '诚挚邀请',
      imageUrl: ''
    },
    createdAt: overrides.createdAt || Date.now(),
    updatedAt: Date.now(),
    publishedAt: overrides.publishedAt || null
  }
  return fromEditorForm(toEditorForm(base), base)
}

function demoForm() {
  const date = '2027-05-20'
  return {
    title: '诚挚邀请',
    eventType: 'wedding',
    hostA: 'Alex',
    hostB: 'Mia',
    cover: ASSET_COVER,
    eyebrow: 'WE ARE GETTING MARRIED',
    subtitle: '诚邀您见证我们的重要时刻',
    date,
    time: '12:00',
    city: '上海',
    venueName: '示例宴会厅',
    venueAddress: '上海市示例区示例路 1 号',
    lat: '31.2304',
    lng: '121.4737',
    letterTitle: '写给您的一封信',
    letterText:
      '好久不见。我们要一起走进人生的下一段旅程了。\n\n这是一场小小的、真诚的相聚。希望您能来，和我们一起吃顿饭，聊聊天，见证这一刻。',
    storyTitle: '我们的故事',
    storyText:
      '从一次偶然的见面开始，我们一起走过了许多普通却珍贵的日子。\n\n现在，我们想把这份喜悦分享给您。',
    gallery: ASSET_GALLERY.map((url, index) => ({
      url,
      thumb: url,
      alt: `示例照片 ${index + 1}`
    })),
    storyPhoto: ASSET_STORY,
    schedule: [
      { time: '11:30', title: '签到与茶歇', note: '请提前 15 分钟到场' },
      { time: '12:00', title: '仪式', note: '' },
      { time: '12:30', title: '午宴', note: '' }
    ],
    themeId: 'ivory-wax',
    motion: 'full',
    musicSrc: DEFAULT_MUSIC,
    musicVolume: 55,
    rsvpEnabled: true,
    rsvpDeadline: '2027-05-10',
    requirePhone: false,
    maxPartySize: 2,
    privacyPurpose: '用于活动回执统计、座位与餐食安排',
    retentionDays: 90
  }
}

function demoConfig() {
  const form = demoForm()
  const base = {
    id: 'demo-invitation',
    status: 'published',
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    publishedAt: Date.now() - 6 * 24 * 60 * 60 * 1000
  }
  const config = fromEditorForm(form, base)
  config.status = 'published'
  config.share.imageUrl = ASSET_COVER
  return config
}

function toEditorForm(config) {
  const source = config || {}
  const event = source.event || {}
  const venue = event.venue || {}
  const hero = findSection(source, 'hero')
  const letter = findSection(source, 'letter')
  const story = findSection(source, 'story')
  const gallery = findSection(source, 'gallery')
  const schedule = findSection(source, 'schedule')
  const rsvp = source.rsvp || {}
  const privacy = source.privacy || {}
  const hosts = safeArray(source.hosts)
  const musicVolume = finiteNumber(source.music && source.music.volume, 0.55)
  return {
    title: typeof source.title === 'string' ? source.title : '',
    eventType: pick(source.eventType, EVENT_TYPE_KEYS, 'wedding'),
    hostA: (hosts[0] && typeof hosts[0].displayName === 'string' && hosts[0].displayName) || '',
    hostB: (hosts[1] && typeof hosts[1].displayName === 'string' && hosts[1].displayName) || '',
    cover: mediaPath(hero.data && hero.data.cover),
    eyebrow:
      (hero.data && typeof hero.data.eyebrow === 'string' && hero.data.eyebrow) || 'YOU ARE INVITED',
    subtitle: (hero.data && typeof hero.data.subtitle === 'string' && hero.data.subtitle) || '',
    date: event.startAt ? formatDateInput(event.startAt) : defaultDate(),
    time: event.startAt ? formatTimeInput(event.startAt) : '12:00',
    city: venue.city || '',
    venueName: venue.name || '',
    venueAddress: venue.address || '',
    lat: venue.lat === null || venue.lat === undefined ? '' : String(venue.lat),
    lng: venue.lng === null || venue.lng === undefined ? '' : String(venue.lng),
    letterTitle: (letter.data && letter.data.title) || '写给您的一封信',
    letterText: joinParagraphs((letter.data && letter.data.paragraphs) || []),
    storyTitle: (story.data && story.data.title) || '我们的故事',
    storyText: joinParagraphs((story.data && story.data.paragraphs) || []),
    storyPhoto: mediaPath(story.data && story.data.photo),
    gallery: safeArray(gallery.data && gallery.data.photos)
      .filter((photo) => photo && typeof photo === 'object' && mediaPath(photo.url))
      .map((photo) => ({
        url: mediaPath(photo.url),
        thumb: mediaPath(photo.thumb) || mediaPath(photo.url),
        alt: typeof photo.alt === 'string' ? photo.alt : ''
      })),
    schedule: safeArray(schedule.data && schedule.data.items)
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        time: typeof item.time === 'string' ? item.time : '',
        title: typeof item.title === 'string' ? item.title : '',
        note: typeof item.note === 'string' ? item.note : ''
      })),
    themeId: pick(source.theme && source.theme.presetId, THEME_IDS, 'ivory-wax'),
    motion: pick(source.theme && source.theme.motion, MOTION_MODES, 'full'),
    musicSrc: mediaPath(source.music && source.music.src) || DEFAULT_MUSIC,
    musicVolume: Math.round(clampNumber(musicVolume, 0, 1, 0.55) * 100),
    rsvpEnabled: !!(rsvp.enabled === undefined ? true : rsvp.enabled),
    rsvpDeadline: rsvp.deadline ? formatDateInput(rsvp.deadline) : '',
    requirePhone: !!rsvp.requirePhone,
    maxPartySize: clampNumber(rsvp.maxPartySize, 1, 6, 2),
    privacyPurpose:
      (typeof privacy.purpose === 'string' && privacy.purpose) || '用于活动回执统计、座位与餐食安排',
    retentionDays: Math.round(clampNumber(privacy.retentionDays, 1, 3650, 90))
  }
}

function fromEditorForm(form, base = {}) {
  const source = form || {}
  const hostA = normalizeText(source.hostA, 'hostA')
  const hostB = normalizeText(source.hostB, 'hostB')
  const hosts = [
    { displayName: hostA },
    { displayName: hostB }
  ].filter((host) => host.displayName)
  const title = normalizeText(source.title, 'title') || '诚挚邀请'
  const names = hostLine(hosts) || title
  const startAt = toTimestamp(source.date, source.time) || Date.now() + 30 * 24 * 60 * 60 * 1000
  const cover = mediaPath(source.cover)
  const gallery = safeArray(source.gallery)
    .filter((photo) => photo && typeof photo === 'object' && mediaPath(photo.url))
    .slice(0, 6)
    .map((photo, index) => ({
      url: mediaPath(photo.url),
      thumb: mediaPath(photo.thumb) || mediaPath(photo.url),
      alt: normalizeText(photo.alt, 'galleryAlt') || `照片 ${index + 1}`
    }))
  const schedule = safeArray(source.schedule)
    .map((item) => {
      const entry = item && typeof item === 'object' ? item : {}
      return {
        time: normalizeClock(entry.time) || normalizeText(entry.time, 'scheduleTime'),
        title: normalizeText(entry.title, 'scheduleTitle'),
        note: normalizeText(entry.note, 'scheduleNote')
      }
    })
    .filter((item) => item.title || item.time)
    .slice(0, 8)
  const maxPartySize = clampNumber(source.maxPartySize, 1, 6, 2)
  const deadline = endOfDayTimestamp(source.rsvpDeadline || source.date) || startAt
  const musicSrc = normalizeText(source.musicSrc, 'musicSrc') || DEFAULT_MUSIC
  const musicVolume = clampNumber(source.musicVolume, 0, 100, 55)

  const config = {
    id: (base && base.id) || uid('inv'),
    schemaVersion: 1,
    status: pick(base && base.status, STATUSES, 'draft'),
    title,
    eventType: pick(source.eventType, EVENT_TYPE_KEYS, 'wedding'),
    hosts,
    event: {
      startAt,
      endAt: startAt + 4 * 60 * 60 * 1000,
      timezone: 'Asia/Shanghai',
      venue: {
        name: normalizeText(source.venueName, 'venueName'),
        address: normalizeText(source.venueAddress, 'venueAddress'),
        city: normalizeText(source.city, 'city'),
        lat: latValue(source.lat),
        lng: lngValue(source.lng),
        poiId: ''
      }
    },
    theme: {
      presetId: pick(source.themeId, THEME_IDS, 'ivory-wax'),
      motion: pick(source.motion, MOTION_MODES, 'full')
    },
    music: {
      src: musicSrc,
      title: '背景音乐',
      volume: musicVolume / 100,
      loop: true,
      license: 'demo'
    },
    sections: [
      {
        id: 'hero',
        type: 'hero',
        enabled: true,
        data: {
          eyebrow: normalizeText(source.eyebrow, 'eyebrow') || 'YOU ARE INVITED',
          title: names,
          subtitle: normalizeText(source.subtitle, 'subtitle'),
          dateText: formatDate(startAt),
          cover
        }
      },
      {
        id: 'letter',
        type: 'letter',
        enabled: true,
        data: {
          title: normalizeText(source.letterTitle, 'letterTitle') || '写给您的一封信',
          paragraphs: splitNormalizedParagraphs(source.letterText, 'letterText'),
          signature: names
        }
      },
      {
        id: 'story',
        type: 'story',
        enabled: true,
        data: {
          title: normalizeText(source.storyTitle, 'storyTitle') || '我们的故事',
          paragraphs: splitNormalizedParagraphs(source.storyText, 'storyText'),
          photo: storyPhoto(source.storyPhoto)
        }
      },
      {
        id: 'gallery',
        type: 'gallery',
        enabled: true,
        data: {
          title: '一些想与您分享的时刻',
          photos: gallery
        }
      },
      {
        id: 'schedule',
        type: 'schedule',
        enabled: true,
        data: {
          title: '当天流程',
          items: schedule
        }
      },
      {
        id: 'venue',
        type: 'venue',
        enabled: true,
        data: {
          title: '地点',
          mapMode: 'static',
          showNavigate: true
        }
      },
      {
        id: 'countdown',
        type: 'countdown',
        enabled: true,
        data: {
          title: '期待与您相见',
          target: 'event.startAt',
          endedText: '活动已开始'
        }
      },
      {
        id: 'rsvp',
        type: 'rsvp',
        enabled: source.rsvpEnabled !== false,
        data: {
          title: '能否赴约',
          description: '请于截止日期前告诉我们，方便安排座位与餐食。',
          buttonText: '填写回执'
        }
      },
      {
        id: 'thanks',
        type: 'thanks',
        enabled: true,
        data: {
          title: '谢谢您',
          message: '期待与您相见。',
          signature: names
        }
      }
    ],
    rsvp: {
      enabled: source.rsvpEnabled !== false,
      deadline,
      requirePhone: !!source.requirePhone,
      allowPlusOne: maxPartySize > 1,
      maxPartySize,
      allowEdit: true,
      notifyHost: true
    },
    privacy: {
      collectFields: [
        'name',
        'phone',
        'attendance',
        'partySize',
        'dietary',
        'message'
      ],
      purpose:
        normalizeText(source.privacyPurpose, 'privacyPurpose') ||
        '用于活动回执统计、座位与餐食安排',
      retentionDays: Math.round(clampNumber(source.retentionDays, 1, 3650, 90)),
      consentVersion: (base && base.privacy && base.privacy.consentVersion) || '2026-11-01'
    },
    share: {
      title: `${title}｜${names}`.slice(0, 60),
      imageUrl: cover
    },
    createdAt: (base && base.createdAt) || Date.now(),
    updatedAt: Date.now(),
    publishedAt: (base && base.publishedAt) || null
  }

  if (config.status === 'published' && !config.publishedAt) {
    config.publishedAt = Date.now()
  }
  return config
}

function storyPhoto(explicitPhoto) {
  return mediaPath(explicitPhoto)
}

function coordinateValue(value) {
  if (value === '' || value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function latValue(value) {
  const numeric = coordinateValue(value)
  return numeric !== null && Math.abs(numeric) <= 90 ? numeric : null
}

function lngValue(value) {
  const numeric = coordinateValue(value)
  return numeric !== null && Math.abs(numeric) <= 180 ? numeric : null
}

function visibleSections(config) {
  const list = safeArray(config && config.sections).filter(
    (section) => section && typeof section === 'object' && section.enabled !== false
  )
  return list.filter((section) => {
    const data = section.data && typeof section.data === 'object' ? section.data : {}
    if (section.type === 'letter') {
      return safeArray(data.paragraphs).length > 0
    }
    if (section.type === 'story') {
      return safeArray(data.paragraphs).length > 0 || !!mediaPath(data.photo)
    }
    if (section.type === 'gallery') {
      return safeArray(data.photos).some((photo) => photo && mediaPath(photo.url))
    }
    if (section.type === 'schedule') {
      return safeArray(data.items).some((item) => item && (item.title || item.time))
    }
    if (section.type === 'venue') {
      const venue = (config.event && config.event.venue) || {}
      return !!(venue.name || venue.address)
    }
    if (section.type === 'rsvp') {
      return !!(config.rsvp && config.rsvp.enabled)
    }
    if (section.type === 'thanks') {
      return !!(
        normalizeText(data.message, 'storyText') ||
        normalizeText(data.signature, 'signature')
      )
    }
    if (section.type === 'countdown') {
      return Number(config.event && config.event.startAt) > 0
    }
    return true
  })
}

function normalizeConfig(config) {
  if (!config || typeof config !== 'object') return null
  const normalized = clone(config)
  const event = normalized.event && typeof normalized.event === 'object' ? normalized.event : {}
  const venue = event.venue && typeof event.venue === 'object' ? event.venue : {}
  const theme = normalized.theme && typeof normalized.theme === 'object' ? normalized.theme : {}
  const music = normalized.music && typeof normalized.music === 'object' ? normalized.music : {}
  const rsvp = normalized.rsvp && typeof normalized.rsvp === 'object' ? normalized.rsvp : {}
  const privacy =
    normalized.privacy && typeof normalized.privacy === 'object' ? normalized.privacy : {}
  const share = normalized.share && typeof normalized.share === 'object' ? normalized.share : {}
  const startAt = Number(event.startAt)

  normalized.id = typeof normalized.id === 'string' && normalized.id ? normalized.id : uid('inv')
  normalized.schemaVersion = 1
  normalized.status = pick(normalized.status, STATUSES, 'draft')
  normalized.title = normalizeText(normalized.title, 'title') || '未命名邀请函'
  normalized.eventType = pick(normalized.eventType, EVENT_TYPE_KEYS, 'wedding')
  normalized.hosts = safeArray(normalized.hosts)
    .filter((host) => host && typeof host === 'object')
    .map((host) => Object.assign({}, host, { displayName: normalizeText(host.displayName, 'hostA') }))
    .filter((host) => host.displayName)
    .slice(0, 2)

  normalized.event = {
    startAt: Number.isFinite(startAt) && startAt > 0 ? startAt : 0,
    endAt: finiteNumber(event.endAt, 0),
    timezone: typeof event.timezone === 'string' ? event.timezone : 'Asia/Shanghai',
    venue: {
      name: normalizeText(venue.name, 'venueName'),
      address: normalizeText(venue.address, 'venueAddress'),
      city: normalizeText(venue.city, 'city'),
      lat: latValue(venue.lat),
      lng: lngValue(venue.lng),
      poiId: typeof venue.poiId === 'string' ? venue.poiId : ''
    }
  }
  if (!normalized.event.endAt && normalized.event.startAt) {
    normalized.event.endAt = normalized.event.startAt + 4 * 60 * 60 * 1000
  }

  normalized.theme = {
    presetId: pick(theme.presetId, THEME_IDS, 'ivory-wax'),
    motion: pick(theme.motion, MOTION_MODES, 'full')
  }
  normalized.music = {
    src: mediaPath(music.src) || DEFAULT_MUSIC,
    title: typeof music.title === 'string' ? music.title.slice(0, 40) : '背景音乐',
    volume: clampNumber(music.volume, 0, 1, 0.55),
    loop: true,
    license: typeof music.license === 'string' ? music.license : 'demo'
  }
  normalized.rsvp = {
    enabled: rsvp.enabled === undefined ? true : !!rsvp.enabled,
    deadline: finiteNumber(rsvp.deadline, 0),
    requirePhone: !!rsvp.requirePhone,
    allowPlusOne: rsvp.allowPlusOne === undefined ? true : !!rsvp.allowPlusOne,
    maxPartySize: Math.round(clampNumber(rsvp.maxPartySize, 1, 6, 2)),
    allowEdit: rsvp.allowEdit === undefined ? true : !!rsvp.allowEdit,
    notifyHost: rsvp.notifyHost === undefined ? true : !!rsvp.notifyHost
  }
  normalized.privacy = {
    collectFields: safeArray(privacy.collectFields).filter((field) => typeof field === 'string'),
    purpose: normalizeText(privacy.purpose, 'privacyPurpose'),
    retentionDays: Math.round(clampNumber(privacy.retentionDays, 1, 3650, 90)),
    consentVersion:
      typeof privacy.consentVersion === 'string' ? privacy.consentVersion : '2026-11-01'
  }
  normalized.share = {
    title: mediaPath(share.title, 60) || normalized.title,
    imageUrl: mediaPath(share.imageUrl)
  }
  normalized.sections = normalizeSections(normalized.sections)
  normalized.createdAt = finiteNumber(normalized.createdAt, Date.now())
  normalized.updatedAt = finiteNumber(normalized.updatedAt, normalized.createdAt)
  normalized.publishedAt = finiteNumber(normalized.publishedAt, 0) || null
  return normalized
}

module.exports = {
  ASSET_COVER,
  ASSET_STORY,
  ASSET_GALLERY,
  DEFAULT_MUSIC,
  EVENT_TYPES,
  THEMES,
  SECTION_TITLES,
  createEmptyConfig,
  demoConfig,
  toEditorForm,
  fromEditorForm,
  visibleSections,
  normalizeConfig,
  hostLine,
  splitParagraphs
}
