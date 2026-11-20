let counter = 0

function uid(prefix = 'inv') {
  counter = (counter + 1) % 1000
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

module.exports = {
  uid
}
