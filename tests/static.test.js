const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SKIP_DIRS = new Set(['.git', 'tests', 'node_modules', 'miniprogram_npm'])
const VOID_TAGS = new Set([
  'input', 'switch', 'slider', 'icon', 'progress', 'checkbox', 'radio', 'textarea',
  'audio', 'video', 'camera', 'map', 'cover-image', 'ad', 'official-account',
  'open-data', 'web-view', 'live-player', 'live-pusher', 'voip-room'
])

function walk(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name.startsWith('.') && entry.name !== '.eslintrc.js') return
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) return
      walk(path.join(dir, entry.name), files)
      return
    }
    files.push(path.join(dir, entry.name))
  })
  return files
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/')
}

const files = walk(ROOT)

test('所有 JSON 都能解析', () => {
  files.filter((file) => file.endsWith('.json')).forEach((file) => {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file, 'utf8')), relative(file))
  })
})

test('WXML 标签闭合、Mustache 成对且事件处理函数存在', () => {
  const errors = []
  files.filter((file) => file.endsWith('.wxml')).forEach((file) => {
    const source = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
    if ((source.match(/\{\{/g) || []).length !== (source.match(/\}\}/g) || []).length) {
      errors.push(`${relative(file)}: Mustache 未闭合`)
    }
    const tagSource = source.replace(/\{\{[\s\S]*?\}\}/g, '{{}}')
    const stack = []
    const tagPattern = /<\s*(\/?)\s*([a-zA-Z0-9_-]+)([^>]*)>/g
    let matched
    while ((matched = tagPattern.exec(tagSource))) {
      const closing = matched[1] === '/'
      const tag = matched[2].toLowerCase()
      const rest = matched[3]
      if (closing) {
        if (!stack.length) {
          errors.push(`${relative(file)}: 多余的 </${tag}>`)
        } else if (stack[stack.length - 1] !== tag) {
          errors.push(`${relative(file)}: </${tag}> 与 <${stack[stack.length - 1]}> 不匹配`)
          const index = stack.lastIndexOf(tag)
          if (index >= 0) stack.length = index
        } else {
          stack.pop()
        }
        continue
      }
      if (rest.trim().endsWith('/') || VOID_TAGS.has(tag)) continue
      stack.push(tag)
    }
    if (stack.length) errors.push(`${relative(file)}: 未闭合 ${stack.slice(-5).join(',')}`)

    const jsFile = file.replace(/\.wxml$/, '.js')
    if (fs.existsSync(jsFile)) {
      const js = fs.readFileSync(jsFile, 'utf8')
      const handlerPattern = /(?:bind|catch)(?::)?[a-zA-Z]+="([a-zA-Z0-9_]+)"/g
      let handler
      while ((handler = handlerPattern.exec(source))) {
        const name = handler[1]
        if (name === 'true' || name === 'false') continue
        if (!new RegExp(`\\b${name}\\s*\\(`).test(js)) {
          errors.push(`${relative(file)}: 缺少事件处理函数 ${name}`)
        }
      }
    }
  })
  assert.deepEqual(errors, [])
})

test('WXSS 大括号配对', () => {
  const errors = []
  files.filter((file) => file.endsWith('.wxss')).forEach((file) => {
    const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    if ((source.match(/\{/g) || []).length !== (source.match(/\}/g) || []).length) {
      errors.push(relative(file))
    }
  })
  assert.deepEqual(errors, [])
})

test('页面、分包与组件引用完整', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
  const routes = [...(app.pages || [])]
  ;(app.subpackages || []).forEach((subpackage) => {
    ;(subpackage.pages || []).forEach((page) => routes.push(`${subpackage.root}/${page}`))
  })
  routes.forEach((route) => {
    ;['.js', '.json', '.wxml', '.wxss'].forEach((extension) => {
      assert.ok(fs.existsSync(path.join(ROOT, route + extension)), `缺少 ${route}${extension}`)
    })
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, `${route}.json`), 'utf8'))
    Object.values(config.usingComponents || {}).forEach((component) => {
      const base = path.join(ROOT, component.replace(/^\//, ''))
      assert.ok(
        fs.existsSync(`${base}.json`) || fs.existsSync(path.join(base, 'index.json')),
        `组件不存在 ${component}`
      )
    })
  })
})

test('相对 require 路径都存在', () => {
  files.filter((file) => file.endsWith('.js')).forEach((file) => {
    const source = fs.readFileSync(file, 'utf8')
    const pattern = /require\(['"]([^'"]+)['"]\)/g
    let matched
    while ((matched = pattern.exec(source))) {
      const request = matched[1]
      if (!request.startsWith('.')) continue
      const base = path.resolve(path.dirname(file), request)
      const exists =
        fs.existsSync(base) ||
        fs.existsSync(`${base}.js`) ||
        fs.existsSync(path.join(base, 'index.js'))
      assert.ok(exists, `${relative(file)} require ${request}`)
    }
  })
})

test('WXML 中引用的包内静态资源存在', () => {
  const errors = []
  files.filter((file) => file.endsWith('.wxml')).forEach((file) => {
    const source = fs.readFileSync(file, 'utf8')
    const pattern = /src="(\/assets\/[^"{}]+)"/g
    let matched
    while ((matched = pattern.exec(source))) {
      const target = path.join(ROOT, matched[1])
      if (!fs.existsSync(target)) errors.push(`${relative(file)} -> ${matched[1]}`)
    }
  })
  assert.deepEqual(errors, [])
})
