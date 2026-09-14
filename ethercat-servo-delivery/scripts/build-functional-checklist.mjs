import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

// Bundled runtime only. Refuse to overwrite any workbook containing engineers' records.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'outputs/01a08f03-8e5c-79e3-bb07-33816e14789f/EtherCAT_功能与路径实测_v2.xlsx');
const cache = path.join(root, '.cache/functional-checklist');
await fs.mkdir(cache, { recursive: true });
try { await fs.access(out); throw new Error('Output exists; do not overwrite recorded tests.'); }
catch (e) { if (e.code !== 'ENOENT') throw e; }

const scope = await fs.readFile(path.join(root, 'functional-scope-review.md'), 'utf8');
const funcs = [], paths = [], boundaries = [];
let group = '', groupId = '';
for (const line of scope.split(/\r?\n/)) {
  const h = line.match(/^## (\d+)\. (.+)：已确认$/);
  if (h) { groupId = h[1]; group = h[2]; }
  const m = line.match(/^\| ([MDSUHNPAECTR]\d{2}) \| (.+) \| (.+) \|$/);
  if (m) (m[1].startsWith('E') ? paths : funcs).push({ id: m[1], name: m[2], scope: m[3], group });
  if (/^(S04记录|同一参数既可|H01\/H02|N12不强制|P01不要求|A03不预设|C06的|T03按|R01不能)/.test(line)) boundaries.push([groupId, group, '适用边界', line]);
}
assert.equal(funcs.length, 106); assert.equal(paths.length, 12);
assert.equal(new Set(funcs.map(x => x.id)).size, 106);
assert.ok(!funcs.some(x => x.id === 'M08'));
const platforms = ['汇川小型', '汇川中大型', '欧姆龙'];
const brands = ['CDHD', '台达', '繁易', 'Elmo', 'KEBA（可选）'];
const statuses = ['☐ 未测试', '◐ 部分实测', '☑ 已实测', '— 不适用', '△ 阻塞'];
const combinations = platforms.flatMap((plc, p) => brands.map((brand, b) => ({id:`P${p+1}-B${b+1}-01`, plc, brand})));
const wb = Workbook.create();
const matrix = wb.worksheets.add('品牌勾选');
const log = wb.worksheets.add('路径与实测记录');
const config = wb.worksheets.add('设备与测试条件');
const c = {ink:'#253547', navy:'#25465F', line:'#CDD7DF', input:'#FFF4D5', muted:'#627487', light:'#F1F5F8', red:'#FBE5E5'};
const font = 'Arial';
const col = i => { let s=''; for (let n=i+1;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; };
function setup(sh,end,widths,title) {
  sh.showGridLines=false;
  sh.getRange(`A1:${col(widths.length-1)}${end}`).format={font:{name:font,size:10,color:c.ink},verticalAlignment:'center',rowHeightPx:28};
  widths.forEach((w,i)=>sh.getRangeByIndexes(0,i,end,1).format.columnWidthPx=w);
  sh.getRange('A2').values=[[title]];
  sh.getRange('A2').format.font={name:font,size:16,bold:true,color:c.navy};
  sh.getRange(`A2:${col(widths.length-1)}2`).format.rowHeightPx=34;
  sh.getRange(`A3:${col(widths.length-1)}3`).format.borders={bottom:{style:'thin',color:c.line}};
}
function header(sh,row,values) {
  const r=sh.getRangeByIndexes(row-1,0,1,values.length); r.values=[values];
  r.format={fill:c.navy,font:{name:font,size:10,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,rowHeightPx:44,borders:{insideVertical:{style:'thin',color:'#FFFFFF'}}};
}
function table(sh,ref,name,head,row) { header(sh,row,head); const t=sh.tables.add(ref,true,name); t.style='TableStyleMedium2'; t.showFilterButton=true; header(sh,row,head); return t; }
function list(sh,ref,values) { sh.getRange(ref).dataValidation={rule:{type:'list',values}}; }
function note(sh,cell,text) { sh.getRange(cell).values=[[text]]; sh.getRange(cell).format.font={name:font,size:10,color:c.muted}; }
function fit(sh,row,last,text,width,min=58) {
  const px=[...text].reduce((n,ch)=>n+(ch.charCodeAt(0)>255?13.5:7),0);
  sh.getRange(`A${row}:${last}${row}`).format.rowHeightPx=Math.max(min,Math.ceil(px/(width-22))*18+16);
}

// One row per approved function and PLC group. The five brand cells are user inputs.
const matrixRows=platforms.flatMap(plc=>funcs.map(x=>[plc,x.group,x.id,x.name,x.scope,...brands.map(()=>statuses[0])]));
const mLast=9+matrixRows.length;
setup(matrix,mLast,[116,180,70,222,465,120,120,120,120,138],'EtherCAT 功能与品牌实测');
matrix.tabColor=c.navy;
note(matrix,'A4','106项功能 × 3组PLC。黄色为填写区；筛选PLC或功能域查看。具体型号、版本见设备组合。');
note(matrix,'A5','勾选由工程师确认：全部设备组合及适用路径/分支测完且证据齐全，才记已实测；不等于功能达标。');
note(matrix,'A6','记录齐全数按实测记录行统计，不代表功能覆盖完成。KEBA可选；缺台架记阻塞，不算不适用。');
matrix.getRange('E7:E8').values=[['已勾选功能行数'],['实测记录齐全行数']];
matrix.getRange('F7:J8').setNumberFormat('0');
matrix.getRange('F7:J8').format.horizontalAlignment='center';
const mh=['PLC组','功能域','编号','功能','覆盖范围',...brands];
matrix.getRange(`A10:J${mLast}`).values=matrixRows;
table(matrix,`A9:J${mLast}`,'FunctionMatrix',mh,9);
matrix.getRange(`A10:J${mLast}`).format.wrapText=true;
matrix.getRange(`F10:J${mLast}`).format={fill:c.input,horizontalAlignment:'center'};
list(matrix,`F10:J${mLast}`,statuses);
for(const [text,fill] of [['阻塞',c.red],['部分实测','#FFE7B8'],['不适用','#EEF1F4'],['已实测','#EDF2F7']]) matrix.getRange(`F10:J${mLast}`).conditionalFormats.add('containsText',{text,format:{fill}});
matrixRows.forEach((r,i)=>{
  fit(matrix,i+10,'J',r[4],465,68);
  if (i%2) matrix.getRange(`A${i+10}:E${i+10}`).format.fill='#F7F9FB';
  if(i===0||r[1]!==matrixRows[i-1][1]||r[0]!==matrixRows[i-1][0]) matrix.getRange(`A${i+10}:J${i+10}`).format.borders={top:{style:'medium',color:c.line}};
});
matrix.freezePanes.freezeRows(9); matrix.freezePanes.freezeColumns(3);

// Baseline IDs are placeholders, not physical devices or compatibility claims.
setup(config,135,[145,145,155,330,180,235,220,160,235,200,315,155],'设备组合与测试条件');
config.tabColor='#71899D';
note(config,'A4','每个组合编号对应固定驱动、PLC和软件版本。新型号/版本追加独立组合；预留编号仅用于登记。');
note(config,'A5','基线归档需包含硬件、序列号、电机/编码器、接线、台架和工程。没有资料或实机，不预填能力结论。');
note(config,'A6','新增记录时扩展Excel表格并复制上一行的公式和下拉。设备表新增组合请插入整行；组合编号和记录编号须唯一。');
const ch=['组合编号','PLC组','驱动品牌','驱动型号','驱动固件','ESI版本/校验标识','PLC CPU/主站型号','PLC固件','工程软件版本','运行时/运动库版本','基线归档/资料位置','登记状态（自动）'];
config.getRange('A10:L24').values=combinations.map(x=>[x.id,x.plc,x.brand,...Array(9).fill(null)]);
table(config,'A9:L24','Equipment',ch,9);
config.getRange('A10:K24').format.fill=c.input;
config.getRange('A10:L24').format.wrapText=true;
config.getRange('A10:L24').format.rowHeightPx=58;
list(config,'B10:B24',platforms); list(config,'C10:C24',brands);
config.getRange('L10').formulas=[['=IF(A10="","",IF(COUNTIFS(Equipment[组合编号],A10)<>1,"编号重复",IF(AND(B10<>"",C10<>"",COUNTA(D10:K10)=8),"已登记","待补型号/版本")))']];
config.getRange('L10:L24').fillDown();
config.getRange('L10:L24').conditionalFormats.add('containsText',{text:'待补',format:{fill:c.input}});
config.getRange('L10:L24').conditionalFormats.add('containsText',{text:'重复',format:{fill:c.red}});
const th=['组合编号','测试条件编号','总线周期（ms）','模式/PDO/轴数/拓扑/负载/接线','持续运行（h）','重复次数','判据文件/版本','测量设备/采样条件'];
config.getRange('A29:H43').values=combinations.map(x=>[x.id,...Array(7).fill(null)]);
table(config,'A28:H43','Conditions',th,28);
config.getRange('A29:H43').format={fill:c.input,wrapText:true,rowHeightPx:64};
config.getRange('C29:C43').setNumberFormat('0.000'); config.getRange('E29:E43').setNumberFormat('0.0'); config.getRange('F29:F43').setNumberFormat('0');
note(config,'A45','一组设备可有多组测试条件。每条实测记录在“覆盖分支/条件编号”关联实际条件；数值留空表示尚未确定。');
const dims={E01:'配置入口',E02:'配置入口',E03:'轴适配',E04:'控制方式',E05:'控制方式',E06:'程序语言',E07:'程序语言',E08:'程序语言/顺序',E09:'操作入口',E10:'参数入口',E11:'工具/传输接口',E12:'应用触发'};
config.getRange('A49:D60').values=paths.map(x=>[x.id,x.name,dims[x.id],x.scope]);
header(config,48,['路径编号','使用路径','路径维度','覆盖分支']);
config.getRange('A49:D60').format.wrapText=true;
paths.forEach((x,i)=>fit(config,49+i,'D',x.scope,330,78));
note(config,'A62','组合示例：E01＋E03＋E04＋E06；梯形图组合另留记录。E11必须说明实际接口，USB成功不等于EtherCAT成功。');
const rules=[
  ['路径展开','全部适用组合','待展开不算覆盖','每个组合/功能先留一条占位。按适用入口组合及模式、异常等分支分别记录；只完成一种入口时，整项仍未测完。'],
  ['路径清单确认','每个组合/功能','人工确认','全部路径/分支列全后，在该组合/功能的一条主记录填写“已列全”、确认人和日期。此标记只确认计划完整，不代表测试完成。'],
  ['品牌勾选','每个PLC/品牌/功能','人工确认','检查全部登记设备组合、路径清单及每条结果和证据后，再选择主表状态。不适用需依据，阻塞需原因，资料确认不算实测。'],
  ['实测结论','与执行状态分开','支持/受限/不支持','上机确认不支持也属于实测。查手册得出的不支持写依据，执行状态保持未测试，不作为实测证据。'],
  ['记录检查','自动字段','完整性提示','检查设备登记、记录编号、路径/条件、人员/岗位、Excel日期、实际表现和证据。记录齐全只说明字段齐全，不能验证证据真假或穷尽覆盖。'],
  ['判据','按条件编号','待填写','时间/距离/误差等均注明单位、起止点和测量方法。未定判据可记录真实表现，不能宣称验收达标。'],
  ['扩展记录','追加Excel表格行','保留历史','同一功能多路径、不同设备版本或复测均追加新记录和唯一编号。复制完整行保留公式/下拉，修改组合、编号、路径等，清空旧实测内容。'],
  ['初始状态','空白模板','未测试','三组PLC × 五品牌预留15个组合、1590条待展开记录。KEBA可选；具体型号未确定，所有品牌格均未测试。'],
  ['资料来源','本项目范围审定','106项/12类','功能范围审定稿：M08已删除；PLC为汇川小型、汇川中大型、欧姆龙；品牌为CDHD、台达、繁易、Elmo、KEBA（可选）。'],
  ...boundaries,
];
header(config,65,['类别','关联范围','说明','内容']);
config.getRange(`A66:D${65+rules.length}`).values=rules;
config.getRange(`A66:D${65+rules.length}`).format.wrapText=true;
rules.forEach((r,i)=>fit(config,66+i,'D',r[3],330,65));
const sourceRows=[
  ['D06','Complete Access','Beckhoff','https://infosys.beckhoff.com/content/1033/tc3_io_intro/1357984011.html'],
  ['D06','启动参数整组访问','CODESYS','https://content.helpme-codesys.com/en/CODESYS%20EtherCAT/_ecat_edt_module_start_parameter.html'],
  ['D07','分段SDO','ETG.1500 §5.7.2/3','https://www.ethercat.org/download/documents/ETG1500_V1i0i2_D_R_MasterClasses.pdf'],
  ['D08','在线对象访问','Beckhoff','https://infosys.beckhoff.com/content/1033/tc3_io_intro/1446522251.html'],
  ['D09','缩放差异示例','Kollmorgen','https://www.kollmorgen.com/en-us/developer-network/position-scaling-akd-drive-ethercat-communication'],
];
header(config,87,['关联项','资料主题','来源','原始链接']);
config.getRange('A88:D92').values=sourceRows;
config.getRange('A88:D92').format.wrapText=true;
sourceRows.forEach((r,i)=>fit(config,88+i,'D',r[3],330,60));
note(config,'A94','来源沿用已有调研；D07依据已获取的官方索引段落，原PDF直接抓取曾返回403。品牌具体能力仍待型号资料与实测确认。');
const criteria=[
 ['时序','ms/s','计时起止点','上线、使能、模式切换、复位、看门狗、停机及恢复时间；记录最大值与条件。'],
 ['位置与同步','位置/时间单位','独立测量条件','定位误差、跟随误差、回零重复性、多轴同步误差、跨界/恢复瞬态。'],
 ['运动限制','速度/加速度/转矩单位','正负方向/负载','位置窗口及驻留、限速、限矩、停止距离，PLC与驱动各自的设置和反馈。'],
 ['网络负载','周期/轴数/字节/频率','实际网络组合','PDO长度、同步方式、邮箱访问负载、混合I/O、任务抖动和诊断统计窗口。'],
 ['持续与重复','h/次数','最差值/失败次数','运行时长、循环次数、运动负载、故障/恢复次数、实际失败数及最长恢复时间。'],
];
header(config,97,['判据类别','单位要求','条件要求','需要明确的量']);
config.getRange('A98:D102').values=criteria;
config.getRange('A98:D102').format.wrapText=true;
criteria.forEach((r,i)=>fit(config,98+i,'D',r[3],330,64));
config.freezePanes.freezeRows(9); config.freezePanes.freezeColumns(1);

// Path records are intentionally unexpanded until the actual platform capabilities are known.
const records=[];
for(const combo of combinations) for(const f of funcs) records.push([`REC-${String(records.length+1).padStart(5,'0')}`,combo.id,null,null,f.id,null,null,'待判定',null,'未测试',null,null,null,null,null,null,null,'待展开',null,null,null]);
const lLast=9+records.length;
setup(log,lLast,[135,135,116,128,76,285,300,105,270,105,110,360,105,125,115,280,260,170,110,120,170],'路径与实测记录');
note(log,'A4','每行对应一个设备组合、功能、路径组合和覆盖分支。预留行尚未展开；新增路径或复测请追加独立记录。');
note(log,'A5','黄色为填写区，灰色为自动字段。路径可填写E01＋E03＋E04＋E06，并说明实际入口；覆盖分支关联测试条件编号。');
note(log,'A6','同一组合/功能任选一条主记录确认路径清单已列全，填写确认人和日期；各分支全部完成后才勾主表。');
note(log,'A7','记录齐全只检查必要字段，不等于功能通过或全部路径测完。日期填写Excel日期；不适用和阻塞必须留原因。');
const lh=['记录编号','设备组合编号','PLC组（自动）','品牌（自动）','功能编号','使用路径组合/实际入口','覆盖分支/条件编号','适用性','适用性依据/阻塞原因','执行状态','能力结果','实际表现/数值/限制','测试人','岗位','测试日期','证据链接/文件编号','遗留问题/复测关联','本组合本功能路径清单','清单确认人','清单确认日期','记录检查（自动）'];
log.getRange(`A10:U${lLast}`).values=records;
const recordTable=table(log,`A9:U${lLast}`,'PathRecords',lh,9);
log.getRange(`A10:U${lLast}`).format={wrapText:true,rowHeightPx:58};
log.getRange(`A10:T${lLast}`).format.fill=c.input;
log.getRange(`C10:D${lLast}`).format.fill=c.light;
log.getRange(`U10:U${lLast}`).format.fill=c.light;
log.getRange(`O10:O${lLast}`).setNumberFormat('yyyy-mm-dd'); log.getRange(`T10:T${lLast}`).setNumberFormat('yyyy-mm-dd');
log.getRange(`B10:B${lLast}`).dataValidation={rule:{type:'list',formula1:'INDIRECT("Equipment[组合编号]")'}};
list(log,`H10:H${lLast}`,['待判定','适用','不适用']);
list(log,`J10:J${lLast}`,['未测试','已实测','阻塞']);
list(log,`K10:K${lLast}`,['支持','受限','不支持','未确定']);
list(log,`N10:N${lLast}`,['开发工程师','测试工程师','应用工程师','其他']);
list(log,`R10:R${lLast}`,['待展开','已列全','见主记录']);
function logFormulas(r) {
  return {
    C:`=IF(B${r}="","",IF(COUNTIFS(Equipment[组合编号],B${r})<>1,"组合编号无效",INDEX(Equipment[PLC组],MATCH(B${r},Equipment[组合编号],0))))`,
    D:`=IF(B${r}="","",IF(COUNTIFS(Equipment[组合编号],B${r})<>1,"组合编号无效",INDEX(Equipment[驱动品牌],MATCH(B${r},Equipment[组合编号],0))))`,
    U:`=IF(A${r}="","缺记录编号",IF(COUNTIFS(PathRecords[记录编号],A${r})<>1,"记录编号重复",IF(OR(B${r}="",E${r}=""),"缺组合/功能",IF(COUNTIFS(Equipment[组合编号],B${r})<>1,"组合编号无效",IF(COUNTIFS(FunctionMatrix[编号],E${r})=0,"功能编号无效",IF(H${r}="不适用",IF(J${r}="已实测","适用性冲突",IF(I${r}="","待补不适用依据","不适用（非实测）")),IF(J${r}="阻塞",IF(I${r}="","待补阻塞原因","阻塞（非实测）"),IF(J${r}<>"已实测",IF(F${r}="","待展开路径","未实测"),IF(H${r}<>"适用","待确认适用性",IF(INDEX(Equipment[登记状态（自动）],MATCH(B${r},Equipment[组合编号],0))<>"已登记","待补设备组合",IF(AND(F${r}<>"",G${r}<>"",K${r}<>"",L${r}<>"",M${r}<>"",N${r}<>"",ISNUMBER(O${r}),O${r}>0,P${r}<>""),"记录齐全","待补实测记录")))))))))))`,
  };
}
for (const k of ['C','D','U']) {log.getRange(`${k}10`).formulas=[[logFormulas(10)[k]]];log.getRange(`${k}10:${k}${lLast}`).fillDown();}
log.getRange(`U10:U${lLast}`).conditionalFormats.add('containsText',{text:'待补',format:{fill:c.red,font:{color:'#942E2E'}}});
for(const text of ['重复','无效','冲突']) log.getRange(`U10:U${lLast}`).conditionalFormats.add('containsText',{text,format:{fill:c.red}});
log.getRange(`R10:T${lLast}`).conditionalFormats.addCustom('AND($R10="已列全",OR($S10="",NOT(ISNUMBER($T10)),$T10<=0))',{fill:c.red});
log.freezePanes.freezeRows(9); log.freezePanes.freezeColumns(2);
brands.forEach((b,i)=>{
 const k=col(5+i);
 matrix.getRange(`${k}7`).formulas=[[`=COUNTIFS(${k}10:${k}${mLast},"☑ 已实测")`]];
 matrix.getRange(`${k}8`).formulas=[[`=COUNTIFS(PathRecords[品牌（自动）],${k}$9,PathRecords[记录检查（自动）],"记录齐全")`]];
});

// Exercise incomplete evidence, missing baseline, non-test outcomes and extension.
assert.equal(log.getRange('U10').values[0][0],'待展开路径');
log.getRange('F10:P10').values=[['E01+E04+E06','C01/CSP','适用',null,'已实测','受限','验证用实际表现','验证用姓名','测试工程师',new Date('2026-09-14T00:00:00Z'),null]];
assert.equal(log.getRange('U10').values[0][0],'待补设备组合');
config.getRange('D10:K10').values=[Array(8).fill('验证用基线')];
assert.equal(log.getRange('U10').values[0][0],'待补实测记录');
log.getRange('P10').values=[['验证用证据']];
assert.equal(log.getRange('U10').values[0][0],'记录齐全');
assert.equal(matrix.getRange('F8').values[0][0],1);
log.getRange('O10').values=[['2026-09-14']];
assert.equal(log.getRange('U10').values[0][0],'待补实测记录');
log.getRange('O10').values=[[new Date('2026-09-14T00:00:00Z')]];
log.getRange('H10').values=[['不适用']];
assert.equal(log.getRange('U10').values[0][0],'适用性冲突');
log.getRange('J10').values=[['未测试']];
assert.equal(log.getRange('U10').values[0][0],'待补不适用依据');
log.getRange('I10').values=[['验证用依据']];
assert.equal(log.getRange('U10').values[0][0],'不适用（非实测）');
assert.equal(matrix.getRange('F8').values[0][0],0);
// Restore the seeded row and baseline, then test the next added record.
log.getRange('F10:T10').values=[records[0].slice(5,20)]; config.getRange('D10:K10').clear({applyTo:'contents'});
const extra=lLast+1;
recordTable.rows.add(null,[[`REC-${String(records.length+1).padStart(5,'0')}`,combinations[0].id,null,null,'M01',...Array(16).fill(null)]]);
log.getRange(`A${extra}:U${extra}`).copyFrom(log.getRange('A10:U10'),'all');
log.getRange(`A${extra}`).values=[[`REC-${String(records.length+1).padStart(5,'0')}`]];
assert.equal(log.getRange(`C${extra}`).values[0][0],platforms[0]);
assert.equal(log.getRange(`U${extra}`).values[0][0],'待展开路径');
// Keep the additional row as an explicitly blank spare, inside the table for extension.
log.getRange(`A${extra}:B${extra}`).clear({applyTo:'contents'});
log.getRange(`E${extra}:T${extra}`).clear({applyTo:'contents'});
log.getRange(`U${extra}`).formulas=[[`=IF(COUNTA(A${extra}:B${extra},E${extra}:T${extra})=0,"",${logFormulas(extra).U.slice(1)})`]];
matrix.getRange('F10').values=[['☑ 已实测']]; assert.equal(matrix.getRange('F7').values[0][0],1);
matrix.getRange('F10').values=[[statuses[0]]];
wb.recalculate();
assert.deepEqual(matrix.getRange('F7:J8').values,[[0,0,0,0,0],[0,0,0,0,0]]);
assert.equal(matrix.getRange(`F10:J${mLast}`).values.flat().filter(x=>x===statuses[0]).length,1590);
assert.deepEqual(matrix.getRange(`A10:E${mLast}`).values,matrixRows.map(r=>r.slice(0,5)));
assert.ok(log.getRange(`K10:Q${lLast}`).values.flat().every(x=>x===null||x===''));
assert.ok(config.getRange('D10:K24').values.flat().every(x=>x===null||x===''));
assert.ok(log.getRange(`U10:U${lLast}`).values.every(r=>r[0]==='待展开路径'));
assert.equal(log.getRange(`U${extra}`).values[0][0],'');
console.log((await wb.inspect({kind:'table',range:'品牌勾选!E7:J10',include:'values,formulas',tableMaxRows:4,tableMaxCols:6,maxChars:1800})).ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},maxChars:1500});
console.log(errors.ndjson);
for(const [sheetName,range,name] of [
 ['品牌勾选','A1:J13','matrix'],['品牌勾选','A113:J117','matrix-platform'],
 ['路径与实测记录','A1:K12','paths'],['路径与实测记录','L9:U12','evidence'],
 ['设备与测试条件','A1:F12','equipment'],['设备与测试条件','G9:L12','versions'],
 ['设备与测试条件','A48:D52','path-definitions'],['设备与测试条件','A65:D68','rules'],
]) {
 const img=await wb.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile(path.join(cache,`${name}.png`),new Uint8Array(await img.arrayBuffer()));
}
const output=await SpreadsheetFile.exportXlsx(wb); await output.save(out);
await fs.writeFile(path.join(cache,'expected.json'),JSON.stringify({funcs,paths,matrixRows,records,combinations,mLast,lLast,extra,out},null,2));
console.log(JSON.stringify({out,functions:106,paths:12,matrixRows:318,brandCells:1590,plannedRecords:1590,blankSpareRows:1,combinations:15}));
