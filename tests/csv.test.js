const test = require('node:test')
const assert = require('node:assert/strict')
const { csvCell, toCsv } = require('../utils/csv')

test('CSV 单元格会转义双引号与换行', () => {
  assert.equal(csvCell('a"b'), '"a""b"')
  assert.equal(csvCell('a\nb'), '"a\nb"')
  assert.equal(csvCell(undefined), '""')
})

test('以公式字符开头的内容会被转义，避免 Excel 注入', () => {
  assert.equal(csvCell('=SUM(A1)'), `"'=SUM(A1)"`)
  assert.equal(csvCell('+86'), `"'+86"`)
  assert.equal(csvCell('-1'), `"'-1"`)
  assert.equal(csvCell('@cmd'), `"'@cmd"`)
})

test('toCsv 带 BOM 并用逗号换行连接', () => {
  const csv = toCsv([
    ['姓名', '人数'],
    ['王五', 2]
  ])
  assert.equal(csv, '\uFEFF"姓名","人数"\n"王五","2"')
})
