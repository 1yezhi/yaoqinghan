// Excel 会把 = + - @ 开头的单元格当公式执行，导出前加单引号转义
function csvCell(value) {
  let text = String(value === undefined || value === null ? '' : value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows) {
  return '\uFEFF' + (rows || []).map((row) => row.map(csvCell).join(',')).join('\n')
}

module.exports = { csvCell, toCsv }
