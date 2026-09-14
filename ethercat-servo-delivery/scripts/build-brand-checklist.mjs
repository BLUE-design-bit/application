import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

// Run with the bundled Codex Node runtime. Existing completed workbooks are not overwritten.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'outputs', '01a08f03-8e5c-79e3-bb07-33816e14789f');
const outPath = path.join(outDir, 'EtherCAT_品牌实测_checklist.xlsx');
const cache = path.join(root, '.cache', 'brand-checklist');
await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(cache, { recursive: true });
try {
  await fs.access(outPath);
  throw new Error('Output already exists. Archive completed records before explicitly rebuilding the blank template.');
} catch (e) { if (e.code !== 'ENOENT') throw e; }

const clean = s => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*|`/g, '').trim();
const md = await fs.readFile(path.join(root, 'acceptance-checklist.md'), 'utf8');
let section = '';
const items = [];
for (const line of md.split(/\r?\n/)) {
  if (/^## [A-L]\./.test(line)) section = line.replace(/^## /, '');
  if (/^\| (BAS|ESI|COM|DRV|UNT|MOT|HOM|REC|ADV|LIF|SUP|PLC)-\d{2} \|/.test(line)) {
    const cells = line.split('|').slice(1, -1).map(clean);
    assert.equal(cells.length, 6);
    items.push({ id: cells[0], section, scope: cells[1], steps: cells[2], criteria: cells[3], evidence: cells[4] });
  }
}
assert.equal(items.length, 109);
assert.equal(new Set(items.map(x => x.id)).size, 109);
const baselineMd = await fs.readFile(path.join(root, 'templates/01-product-customer-baseline.md'), 'utf8');
const numericSection = baselineMd.split('## 3. 数值验收契约')[1].split('## 4.')[0];
const thresholds = numericSection.split(/\r?\n/).filter(l => /^\| (T_|C_set|E_pos|W_done|V_max|Override|P_jump|N_repeat)/.test(l))
  .map(l => l.split('|').slice(1, -1).map(clean)).map(c => [c[0], c[1]]);
assert.ok(thresholds.length >= 12);

const brands = ['CDHD', '台达', '繁易', 'Elmo', 'KEBA（可选）'];
const baselineIds = ['CDHD-01', '台达-01', '繁易-01', 'Elmo-01', 'KEBA-01'];
const checks = ['☐ 未测试', '☑ 已实测', '— 不适用', '△ 阻塞'];
const outcomes = ['达标', '有差异', '不支持（实测）', '未定判据', '资料确认（未实测）', '不适用', '阻塞'];
const wb = Workbook.create();
const matrix = wb.worksheets.add('品牌勾选');
const log = wb.worksheets.add('实测记录');
const config = wb.worksheets.add('设备与判据');
const last = 9 + items.length;
const logLast = 9 + items.length * brands.length;
const colors = { ink: '#243447', navy: '#234661', line: '#CBD5DF', muted: '#617386', input: '#FFF5D6', band: '#F0F4F7' };

function setup(sheet, end, widths) {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${String.fromCharCode(64 + widths.length)}${end}`).format = {
    font: { name: 'Arial', size: 10, color: colors.ink },
    verticalAlignment: 'center', rowHeightPx: 27,
  };
  widths.forEach((w, i) => sheet.getRangeByIndexes(0, i, end, 1).format.columnWidthPx = w);
  sheet.getRange('A2').format.font = { name: 'Arial', size: 16, bold: true, color: colors.navy };
  sheet.getRange(`A2:${String.fromCharCode(64 + widths.length)}2`).format.rowHeightPx = 32;
  sheet.getRange(`A3:${String.fromCharCode(64 + widths.length)}3`).format.borders = { bottom: { style: 'thin', color: colors.line } };
}
function heading(sheet, row, values) {
  const r = sheet.getRangeByIndexes(row - 1, 0, 1, values.length);
  r.values = [values];
  r.format = { fill: colors.navy, font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' },
    horizontalAlignment: 'center', verticalAlignment: 'center', wrapText: true, rowHeightPx: 42,
    borders: { insideVertical: { style: 'thin', color: '#FFFFFF' } } };
}
function table(sheet, ref, name) {
  const t = sheet.tables.add(ref, true, name);
  t.style = 'TableStyleMedium2';
  t.showFilterButton = true;
  return t;
}
function textLines(text, width) {
  let px = 0;
  for (const ch of text) px += ch.charCodeAt(0) > 255 ? 13.5 : 7;
  return Math.ceil(px / (width - 22));
}

setup(matrix, last, [92, 160, 158, 380, 380, 100, 106, 106, 106, 106, 132]);
matrix.tabColor = colors.navy;
matrix.getRange('A2').values = [['EtherCAT 伺服驱动器品牌实测 checklist']];
matrix.getRange('A4').values = [['先在“设备与判据”登记组合。逐格下拉勾选，在“实测记录”填写测试人、日期、实际表现和证据。']];
matrix.getRange('A5').values = [['勾选表示已上机实测，不等于达标。实测不支持也可勾选。仅查手册不勾选。每项的适用分支应测全。']];
matrix.getRange('F6:F7').values = [['已勾选项数'], ['实测记录齐全数']];
matrix.getRange('A7').values = [['未测试、阻塞、不适用分开记录。不适用/阻塞请写原因。KEBA为可选。两项统计按ID逐项核证。']];
matrix.getRange('A4:F5').format.font = { name: 'Arial', size: 10, color: colors.muted };
matrix.getRange('A7:E7').format.font = { name: 'Arial', size: 10, color: colors.muted };
matrix.getRange('F6:F7').format.wrapText = true;
matrix.getRange('F6:K7').format.rowHeightPx = 36;
matrix.getRange('G6:K7').format.horizontalAlignment = 'center';
matrix.getRange('G6:K7').setNumberFormat('0');
const headers = ['编号', '阶段', '级别 / 适用', '客户动作与测试步骤', '原验收判据（对照）', '所需证据', ...brands];
const rows = items.map(x => [x.id, x.section, x.scope, x.steps, x.criteria, x.evidence, ...brands.map(() => checks[0])]);
matrix.getRange(`A10:K${last}`).values = rows;
heading(matrix, 9, headers);
table(matrix, `A9:K${last}`, 'BrandChecklist');
heading(matrix, 9, headers);
matrix.getRange(`A10:F${last}`).format.wrapText = true;
matrix.getRange(`B10:E${last}`).format.verticalAlignment = 'top';
matrix.getRange(`G10:K${last}`).format = { fill: colors.input, horizontalAlignment: 'center', wrapText: true };
matrix.getRange(`G10:K${last}`).dataValidation = { rule: { type: 'list', values: checks } };
matrix.getRange(`G10:K${last}`).conditionalFormats.add('containsText', { text: '阻塞', format: { fill: '#FCE7E7', font: { color: '#9C2929' } } });
matrix.getRange(`G10:K${last}`).conditionalFormats.add('containsText', { text: '不适用', format: { fill: '#EEF1F4', font: { color: '#697586' } } });
matrix.getRange(`G10:K${last}`).conditionalFormats.add('containsText', { text: '已实测', format: { fill: '#EDF2F7', font: { color: colors.ink } } });
items.forEach((x, i) => {
  const r = i + 10;
  const height = Math.max(64, Math.max(textLines(x.steps, 380), textLines(x.criteria, 380), textLines(x.scope, 158), textLines(x.section, 160)) * 17 + 15);
  matrix.getRange(`A${r}:K${r}`).format.rowHeightPx = height;
  if (i % 2 === 1) matrix.getRange(`A${r}:F${r}`).format.fill = '#F7F9FB';
  if (i === 0 || x.section !== items[i - 1].section) {
    matrix.getRange(`A${r}:K${r}`).format.borders = { top: { style: 'medium', color: colors.line } };
    matrix.getRange(`A${r}:B${r}`).format.font.bold = true;
  }
});
matrix.freezePanes.freezeRows(9);
matrix.freezePanes.freezeColumns(1);

setup(log, logLast, [130, 126, 94, 140, 104, 125, 110, 150, 385, 275, 285, 132]);
log.getRange('A2').values = [['品牌实测记录']];
log.getRange('A4').values = [['按品牌、编号筛选后填写黄色区域。测试人、日期、实测结论、实际表现及证据必须齐全，才能作为勾选凭据。']];
log.getRange('A5').values = [['“不支持（实测）”需记录实际尝试与设备响应。资料确认、阻塞、不适用不算上机实测，原因写在备注。']];
log.getRange('A6').values = [['模式、周期、PDO、负载或操作步骤有差异时，在实际表现中写清。详细波形、子用例及复测记录可用链接或文件编号关联。']];
log.getRange('A7').values = [['日期填写Excel日期。多人或多次测试可在备注注明，主记录保留本轮测试人与结论。更换基线组合另存整本。']];
const records = [];
for (const x of items) brands.forEach((b, i) => records.push([`${x.id}/${b}`, b, x.id, baselineIds[i], null, null, null, null, null, null, null, null]));
log.getRange(`A10:L${logLast}`).values = records;
heading(log, 9, ['记录键', '品牌', '检查项编号', '基线编号', '测试人', '岗位', '测试日期', '实测结论', '实际表现 / 数值 / 使用差异', '证据链接 / 文件编号', '备注 / 不适用原因 / 复测', '记录状态（自动）']);
table(log, `A9:L${logLast}`, 'TestRecords');
heading(log, 9, ['记录键', '品牌', '检查项编号', '基线编号', '测试人', '岗位', '测试日期', '实测结论', '实际表现 / 数值 / 使用差异', '证据链接 / 文件编号', '备注 / 不适用原因 / 复测', '记录状态（自动）']);
log.getRange(`A10:D${logLast}`).format.fill = colors.band;
log.getRange(`E10:K${logLast}`).format.fill = colors.input;
log.getRange(`A10:L${logLast}`).format.wrapText = true;
log.getRange(`A10:L${logLast}`).format.rowHeightPx = 64;
log.getRange(`G10:G${logLast}`).setNumberFormat('yyyy-mm-dd');
log.getRange(`F10:F${logLast}`).dataValidation = { rule: { type: 'list', values: ['开发工程师', '测试工程师', '应用工程师', '其他'] } };
log.getRange(`H10:H${logLast}`).dataValidation = { rule: { type: 'list', values: outcomes } };
log.getRange('L10').formulas = [['=IF(COUNTA(E10:K10)=0,"",IF(OR(H10="不适用",H10="阻塞",H10="资料确认（未实测）"),"非实测记录",IF(AND(E10<>"",ISNUMBER(G10),G10>0,H10<>"",I10<>"",J10<>""),"记录齐全","待补记录")))']];
log.getRange(`L10:L${logLast}`).fillDown();
log.getRange(`L10:L${logLast}`).conditionalFormats.add('containsText', { text: '待补', format: { fill: '#FCE7E7', font: { color: '#9C2929' } } });
log.getRange(`H10:H${logLast}`).conditionalFormats.add('containsText', { text: '有差异', format: { fill: '#FFE8BA', font: { color: '#794613' } } });
log.freezePanes.freezeRows(9);
log.freezePanes.freezeColumns(3);
brands.forEach((b, i) => {
  const col = String.fromCharCode(71 + i);
  matrix.getRange(`${col}6`).formulas = [[`=COUNTIFS(${col}10:${col}${last},"☑ 已实测")`]];
  matrix.getRange(`${col}7`).formulas = [[`=COUNTIFS('实测记录'!$B$10:$B$${logLast},${col}$9,'实测记录'!$L$10:$L$${logLast},"记录齐全")`]];
});

const fields = [
  ['基线编号', '与实测记录一致，标识一套固定组合。', ...baselineIds],
  ['驱动器具体型号', '品牌不等于型号，同品牌不同型号需分开。'],
  ['硬件 / 序列号', '记录硬件版本及设备序列号。'],
  ['固件 / 引导程序', '填写完整版本。'],
  ['ESI / 对象字典', '文件名、版本及校验值。'],
  ['PLC CPU / 主站模块', '填写实际主站与运动模块型号。'],
  ['PLC固件 / 工程软件', '填写完整版本。'],
  ['运行时 / 运动库 / 许可', '包括设备包和第三方轴驱动版本。'],
  ['工程 / 启动参数', '工程归档和Startup SDO清单编号。'],
  ['模式 / PDO / 同步周期', '记录本次实测的具体模式、映射和时钟配置。'],
  ['电机 / 编码器 / 制动器', '型号、分辨率、绝对/增量及制动器供电。'],
  ['机械 / 负载 / 传动', '水平/垂直、惯量、传动比、导程与行程。'],
  ['轴数 / 拓扑 / 线缆', '包含混合I/O和供电方式。'],
  ['原点 / 限位 / 输入接线', '输入接PLC还是驱动，极性与回零方法。'],
  ['安全与故障注入条件', '台架约束、独立停止手段、负载保持和中止条件。'],
  ['资料 / 手册依据', '对应型号的手册版本、章节和资料位置。'],
  ['负责人 / 测试轮次', '本轮开发/测试负责人及轮次。'],
];
const thresholdStart = 30;
const noteStart = thresholdStart + thresholds.length + 3;
const notes = [
  ['判据用途', '主表保留原验收判据供对照。先记录各品牌真实表现，再比较差异，不据品牌名预填支持或通过。'],
  ['未定判据', '未冻结数值时可以记录观察，结论选“未定判据”。不得把“已实测”解释为性能达标。'],
  ['支持范围', '功能不支持、无相应硬件和测试条件不具备分别记录。仅查手册不算上机实测。'],
  ['分支覆盖', '一个ID有多个适用模式、故障分支或子功能时，证据应覆盖全部分支。未完成前不勾已实测。'],
  ['P0 / P1 / P2', '沿用原验收优先级。P0优先验证关键路径与错误运动风险，P1覆盖正式交付，P2覆盖扩展场景。'],
  ['E0', '基线、版本、能力说明。'], ['E1', '工程、ESI、PDO、启动SDO及参数读回。'],
  ['E2', 'PLC功能块、驱动状态和目标/反馈的同步Trace。'], ['E3', '网络、AL、WKC、同步、SDO诊断及抓包。'],
  ['E4', '机械测量、停机时间/距离、输入与制动时序。失联后不得用缓存PDO证明机械已停止。'],
  ['E5', '发布包、备份迁移与支持演练记录。'],
  ['资料来源', '原验收checklist v0.1（2026-09-11），109项按原ID完整转入。品牌清单由项目方于2026-09-14指定。'],
];
setup(config, noteStart + notes.length, [200, 385, 190, 190, 190, 190, 190]);
config.getRange('A2').values = [['设备组合与对照判据']];
config.getRange('A4').values = [['每列对应一套固定型号、固件与PLC组合。黄色单元格供填写，空白表示待确认。更换组合时另存整本。']];
config.getRange('A5').values = [['本表用于各品牌实机对照，未预填任何功能支持结论。KEBA可不纳入本轮。']];
heading(config, 9, ['字段', '填写要求', ...brands]);
config.getRange(`A10:G${9 + fields.length}`).values = fields.map(f => f.length === 7 ? f : [...f, null, null, null, null, null]);
heading(config, thresholdStart, ['判据符号', '定义 / 单位 / 测量条件', ...brands]);
config.getRange(`A${thresholdStart + 1}:G${thresholdStart + thresholds.length}`).values = thresholds.map(x => [...x, null, null, null, null, null]);
for (const [start, end] of [[10, 9 + fields.length], [thresholdStart + 1, thresholdStart + thresholds.length]]) {
  config.getRange(`A${start}:G${end}`).format.wrapText = true;
  config.getRange(`C${start}:G${end}`).format.fill = colors.input;
  config.getRange(`A${start}:G${end}`).format.rowHeightPx = 70;
}
config.getRange(`A${noteStart}`).values = [['执行与证据说明']];
config.getRange(`A${noteStart}`).format.font.bold = true;
notes.forEach((n, i) => {
  const r = noteStart + i + 1;
  config.getRange(`A${r}:B${r}`).values = [n];
  config.getRange(`A${r}:B${r}`).format.wrapText = true;
  config.getRange(`A${r}:B${r}`).format.rowHeightPx = Math.max(44, textLines(n[1], 385) * 17 + 14);
});
config.freezePanes.freezeRows(9);
config.freezePanes.freezeColumns(2);

// Exercise actual user workflow, then clear every test input before export.
log.getRange('E10:J10').values = [['验证用姓名', '测试工程师', new Date('2026-09-14T00:00:00Z'), '有差异', '验证用描述', null]];
assert.equal(log.getRange('L10').values[0][0], '待补记录');
log.getRange('J10').values = [['验证用证据']];
assert.equal(log.getRange('L10').values[0][0], '记录齐全');
matrix.getRange('G10').values = [['☑ 已实测']];
assert.equal(matrix.getRange('G6').values[0][0], 1);
assert.equal(matrix.getRange('G7').values[0][0], 1);
log.getRange('H10').values = [['不适用']];
assert.equal(log.getRange('L10').values[0][0], '非实测记录');
assert.equal(matrix.getRange('G7').values[0][0], 0);
log.getRange('E10:K10').clear({ applyTo: 'contents' });
matrix.getRange('G10').values = [[checks[0]]];
wb.recalculate();
assert.equal(log.getRange('L10').values[0][0], '');
assert.deepEqual(matrix.getRange('G6:K7').values, [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]);
assert.equal(matrix.getRange(`G10:K${last}`).values.flat().filter(x => x === checks[0]).length, 545);
assert.ok(log.getRange(`E10:K${logLast}`).values.flat().every(x => x === null || x === ''));
assert.deepEqual(matrix.getRange(`A10:F${last}`).values, rows.map(r => r.slice(0, 6)));
for (const r of [10, 278, logLast]) assert.ok(log.getRange(`L${r}`).formulas[0][0].includes(`E${r}:K${r}`));
console.log((await wb.inspect({ kind: 'table', range: '品牌勾选!F6:K10', include: 'values,formulas', tableMaxRows: 5, tableMaxCols: 6, maxChars: 3500 })).ndjson);
console.log((await wb.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 20 }, summary: 'final formula error scan', maxChars: 2500 })).ndjson);
for (const [sheetName, range, filename] of [
  ['品牌勾选', 'A1:K12', 'matrix-top.png'],
  ['品牌勾选', 'A70:K72', 'matrix-middle.png'],
  ['实测记录', 'A1:L12', 'records.png'],
  ['设备与判据', 'A1:G16', 'equipment.png'],
  ['设备与判据', `A${thresholdStart}:G${thresholdStart + 5}`, 'criteria.png'],
]) {
  const image = await wb.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(path.join(cache, filename), new Uint8Array(await image.arrayBuffer()));
}
const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outPath);
await fs.writeFile(path.join(cache, 'build-report.json'), JSON.stringify({ items: items.length, brands, records: records.length, thresholds: thresholds.length, last, logLast, outPath }, null, 2));
console.log(JSON.stringify({ output: outPath, items: items.length, brandCells: 545, testRecords: records.length, thresholds: thresholds.length }));
