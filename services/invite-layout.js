/**
 * 受邀端版式引擎：按内容量与字段类型决定分块、密度和展示形式。
 * 目标：信息少时不空、信息多时不挤，所有章节连续滚动而非逐项分页。
 */

const { visibleSections } = require('./invitation-schema')
const {
  charCount,
  clampForDisplay,
  normalizeText,
  normalizeClock
} = require('./invitation-rules')

function textOf(value, field, displayMax) {
  return clampForDisplay(normalizeText(value, field), displayMax || 120)
}

function paragraphsOf(section, field) {
  const list = section && section.data && Array.isArray(section.data.paragraphs)
    ? section.data.paragraphs
    : []
  return list
    .map((paragraph) => normalizeText(paragraph, field))
    .filter(Boolean)
    .map((paragraph) => clampForDisplay(paragraph, 700))
}

function sumChars(paragraphs) {
  return paragraphs.reduce((total, paragraph) => total + charCount(paragraph), 0)
}

function densityOf(chars, paragraphCount) {
  if (chars <= 70) return 'sparse'
  if (paragraphCount <= 1 && chars <= 140) return 'sparse'
  if (chars <= 240) return 'normal'
  return 'rich'
}

function coordsOf(venue) {
  if (!venue || typeof venue !== 'object') return null
  const rawLat = venue.lat
  const rawLng = venue.lng
  // Number(null) === 0，必须先排除空值，否则只填经度会被当成 (0, lng) 的有效坐标
  if (
    rawLat === null || rawLat === undefined || rawLat === '' ||
    rawLng === null || rawLng === undefined || rawLng === ''
  ) {
    return null
  }
  const lat = Number(rawLat)
  const lng = Number(rawLng)
  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  return valid ? { lat, lng } : null
}

function captionOf(alt) {
  const text = normalizeText(alt, 'galleryAlt')
  if (!text) return ''
  if (/^(示例)?照片\s*\d+$/.test(text)) return ''
  return text
}

function buildSchedule(section) {
  const raw = section && section.data && Array.isArray(section.data.items)
    ? section.data.items
    : []
  const items = raw
    .map((entry, index) => {
      const item = entry || {}
      const time = normalizeClock(item.time) || normalizeText(item.time, 'scheduleTime')
      const title = normalizeText(item.title, 'scheduleTitle')
      return {
        itemKey: `${index}-${time}-${title}`.slice(0, 40),
        time,
        title,
        note: normalizeText(item.note, 'scheduleNote')
      }
    })
    .filter((item) => item.title || item.time)
    .slice(0, 8)
  return {
    title: textOf(section && section.data && section.data.title, 'letterTitle', 24) || '当天流程',
    items,
    hasTime: items.some((item) => !!item.time),
    hasNote: items.some((item) => !!item.note)
  }
}

function buildVenue(venue) {
  const coords = coordsOf(venue)
  return {
    name: textOf(venue.name, 'venueName', 40),
    city: textOf(venue.city, 'city', 16),
    address: textOf(venue.address, 'venueAddress', 80),
    hasCoords: !!coords,
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null
  }
}

function buildLayout(config) {
  const source = config || {}
  const map = {}
  visibleSections(source).forEach((section) => {
    map[section.type] = section
  })

  const venue = (source.event && source.event.venue) || {}
  const venueData = buildVenue(venue)
  const cityLine = [venueData.city, venueData.name].filter(Boolean).join(' · ')
  const blocks = []

  if (map.hero) {
    const data = map.hero.data || {}
    const subtitle = textOf(data.subtitle, 'subtitle', 48)
    const heroTitle = textOf(data.title, 'hostLine', 40) || textOf(source.title, 'title', 30) || '诚挚邀请'
    const titleLength = charCount(heroTitle)
    const initials =
      (source.hosts || [])
        .map((host) => String((host && host.displayName) || '').trim().charAt(0))
        .filter(Boolean)
        .join('&')
        .slice(0, 3)
    const eventMarks = {
      wedding: '囍',
      birthday: '✦',
      anniversary: '∞',
      corporate: '◇',
      other: '邀'
    }
    const monogram =
      initials.length >= 3 ? initials : eventMarks[source.eventType] || '邀'
    blocks.push({
      id: 'hero',
      kind: 'hero',
      density: 'sparse',
      visible: false,
      cover: data.cover || '',
      eyebrow: textOf(data.eyebrow, 'eyebrow', 36) || 'YOU ARE INVITED',
      title: heroTitle,
      titleClass:
        titleLength <= 4
          ? 'is-brief'
          : titleLength > 20
            ? 'is-xlong'
            : titleLength > 14
              ? 'is-long'
              : '',
      monogram,
      subtitle,
      compact: !subtitle && !cityLine
    })
  }

  const letter = map.letter
  const story = map.story
  const letterParagraphs = paragraphsOf(letter, 'letterText')
  const storyParagraphs = paragraphsOf(story, 'storyText')
  const letterChars = sumChars(letterParagraphs)
  const storyChars = sumChars(storyParagraphs)
  const storyPhoto = story && story.data ? story.data.photo || '' : ''
  const mergeStory = !!(
    letterParagraphs.length &&
    storyParagraphs.length &&
    !storyPhoto &&
    letterChars <= 180 &&
    storyChars <= 140 &&
    letterParagraphs.length + storyParagraphs.length <= 5
  )

  if (letterParagraphs.length) {
    const signature = textOf(letter.data && letter.data.signature, 'signature', 32)
    const storyPart = mergeStory
      ? {
          title: textOf(story.data && story.data.title, 'storyTitle', 24) || '我们的故事',
          paragraphs: storyParagraphs,
          chars: storyChars,
          density: densityOf(storyChars, storyParagraphs.length),
          clampable: storyChars > 220
        }
      : null
    blocks.push({
      id: 'letter',
      kind: 'letter',
      density: densityOf(letterChars, letterParagraphs.length),
      visible: false,
      title: textOf(letter.data && letter.data.title, 'letterTitle', 24) || '写给您的一封信',
      paragraphs: letterParagraphs,
      signature,
      chars: letterChars,
      clampable: letterChars > 240,
      story: storyPart
    })
  }

  if (storyParagraphs.length && !mergeStory) {
    blocks.push({
      id: 'story',
      kind: 'story',
      density: densityOf(storyChars, storyParagraphs.length),
      visible: false,
      title: textOf(story.data && story.data.title, 'storyTitle', 24) || '我们的故事',
      paragraphs: storyParagraphs,
      chars: storyChars,
      clampable: storyChars > 240,
      photo: storyPhoto || ''
    })
  } else if (!mergeStory && storyPhoto && story && !storyParagraphs.length) {
    blocks.push({
      id: 'story',
      kind: 'story',
      density: 'sparse',
      visible: false,
      title: textOf(story.data && story.data.title, 'storyTitle', 24) || '我们的故事',
      paragraphs: [],
      chars: 0,
      clampable: false,
      photo: storyPhoto
    })
  }

  if (map.gallery) {
    const photos = (map.gallery.data && Array.isArray(map.gallery.data.photos)
      ? map.gallery.data.photos
      : [])
      .filter((photo) => photo && photo.url)
      .slice(0, 9)
      .map((photo, index) => ({
        itemKey: `${index}-${photo.url}`.slice(0, 60),
        url: photo.url,
        thumb: photo.thumb || photo.url,
        caption: captionOf(photo.alt)
      }))
    if (photos.length) {
      blocks.push({
        id: 'gallery',
        kind: 'gallery',
        density: 'normal',
        visible: false,
        title: textOf(map.gallery.data && map.gallery.data.title, 'letterTitle', 24) || '一些想与您分享的时刻',
        photos,
        count: photos.length,
        mode: photos.length === 1 ? 'single' : photos.length <= 3 ? 'grid' : 'strip'
      })
    }
  }

  const schedule = map.schedule ? buildSchedule(map.schedule) : null
  const hasVenue = !!map.venue && !!(venueData.name || venueData.address)
  const mergeDetails = !!(
    schedule &&
    schedule.items.length &&
    hasVenue &&
    !venueData.hasCoords &&
    schedule.items.length <= 4
  )

  if (schedule && schedule.items.length && mergeDetails) {
    blocks.push({
      id: 'details',
      kind: 'details',
      density: 'normal',
      visible: false,
      schedule,
      venue: venueData
    })
  } else {
    if (schedule && schedule.items.length) {
      blocks.push({
        id: 'schedule',
        kind: 'schedule',
        density: schedule.hasNote ? 'normal' : 'sparse',
        visible: false,
        schedule
      })
    }
    if (hasVenue) {
      blocks.push({
        id: 'venue',
        kind: 'venue',
        density: 'normal',
        visible: false,
        venue: venueData
      })
    }
  }

  const countdown = map.countdown
  const rsvp = map.rsvp
  const thanks = map.thanks
  const closing = {
    id: 'closing',
    kind: 'closing',
    density: 'normal',
    visible: false,
    countdown: countdown
      ? {
          title: textOf(countdown.data && countdown.data.title, 'letterTitle', 24) || '期待与您相见',
          endedText: textOf(countdown.data && countdown.data.endedText, 'letterTitle', 20) || '活动已开始'
        }
      : null,
    rsvp: rsvp
      ? {
          title: textOf(rsvp.data && rsvp.data.title, 'letterTitle', 24) || '能否赴约',
          description: textOf(rsvp.data && rsvp.data.description, 'subtitle', 60) || '',
          buttonText: textOf(rsvp.data && rsvp.data.buttonText, 'letterTitle', 12) || '填写回执'
        }
      : null,
    thanks: thanks
      ? {
          title: textOf(thanks.data && thanks.data.title, 'letterTitle', 24) || '谢谢您',
          message: textOf(thanks.data && thanks.data.message, 'storyText', 80) || '',
          signature: textOf(thanks.data && thanks.data.signature, 'signature', 32) || ''
        }
      : null
  }
  closing.parts =
    (closing.countdown ? 1 : 0) + (closing.rsvp ? 1 : 0) + (closing.thanks ? 1 : 0)
  if (closing.parts) blocks.push(closing)

  if (blocks[0] && blocks[0].kind === 'hero') {
    blocks[0].short = blocks.length <= 4
  }

  const totalChars = blocks.reduce((total, block) => {
    if (block.kind === 'letter') {
      return total + block.chars + (block.story ? block.story.chars : 0)
    }
    if (block.kind === 'story') return total + block.chars
    return total
  }, 0)

  return {
    blocks,
    totalChars,
    chapterCount: blocks.length
  }
}

module.exports = {
  buildLayout,
  densityOf,
  buildSchedule,
  buildVenue
}
