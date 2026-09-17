import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=path.join(root,'.cache/cia402-detail');
const dir=path.join(root,'outputs/01a08f03-8e5c-79e3-bb07-33816e14789f');
const data=JSON.parse(await fs.readFile(path.join(cache,'cdhd-comparison.json'),'utf8'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(dir,'DFS10A_CiA402_V3_全章节逐项核对_v3.xlsx')));
const col=i=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const navy='#274560',ink='#243547';
const render=[];
for(const [name,cfg]of Object.entries(data.changed)){
 const sh=wb.worksheets.getItem(name),p=cfg.position,end=cfg.last;
 for(const t of [...sh.tables.items])t.delete();
 if(cfg.oldCols===11)sh.getRange(`J7:J${end}`).dataValidation=null;
 // Copy values right to left; imported formatting is restored explicitly below.
 for(let c=cfg.oldCols-1;c>p;c--){
  sh.getRangeByIndexes(0,c+2,end,1).copyFrom(sh.getRangeByIndexes(0,c,end,1),'all');
  sh.getRangeByIndexes(0,c+2,end,1).format.columnWidth=cfg.widths[c];
 }
 for(const c of [p+1,p+2]){
  sh.getRangeByIndexes(0,c,end,1).clear({applyTo:'all'});
  sh.getRangeByIndexes(5,c,end-5,1).copyFrom(sh.getRangeByIndexes(5,p,end-5,1),'all');
  sh.getRangeByIndexes(0,c,end,1).format.columnWidthPx=c===p+1?520:350;
 }
 sh.getRangeByIndexes(6,0,end-6,cfg.oldCols+2).setNumberFormat('@');
 sh.getRangeByIndexes(5,0,1,cfg.oldCols+2).values=[cfg.headers];
 sh.getRangeByIndexes(6,0,end-6,cfg.oldCols+2).values=cfg.rows;
 for(const f of cfg.formats){const r=sh.getRangeByIndexes(f.row-1,f.col-1,1,1);r.format=f.format;r.setNumberFormat(f.numberFormat);}
 const t=sh.tables.add(`A6:${col(cfg.oldCols+1)}${end}`,true,cfg.table);t.style=cfg.tableStyle;t.showFilterButton=true;
 sh.getRangeByIndexes(5,p+1,1,2).format={fill:navy,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
 sh.getRangeByIndexes(6,p+1,end-6,2).format={font:{name:'Arial',size:10,color:ink},wrapText:true,verticalAlignment:'top'};
 sh.getRangeByIndexes(6,p+1,end-6,2).conditionalFormats.clear();
 const high=sh.getRangeByIndexes(6,p+1,end-6,1);
 high.conditionalFormats.add('containsText',{text:'有差异',format:{fill:'#FCE7E5'}});
 high.conditionalFormats.add('containsText',{text:'未列',format:{fill:'#FFF3D1'}});
 cfg.rows.forEach((r,i)=>{
  let lines=Math.max(...[p+1,p+2].map(j=>Math.ceil([...String(r[j]??'')].reduce((n,c)=>n+(c.charCodeAt(0)>255?13.5:7),0)/((j===p+1?520:350)-20))));
  sh.getRangeByIndexes(i+6,0,1,cfg.oldCols+2).format.rowHeight=Math.max(cfg.heights[i+7]??25,(lines*19+14)*.75);
  sh.getRangeByIndexes(i+6,p+1,1,2).format.fill=i%2?'#F4F7FA':'#FFFFFF';
 });
 if(cfg.oldCols===11){
  sh.getRange(`L7:L${end}`).dataValidation={rule:{type:'list',values:['未核对','已核对','有异议','待实测']}};
 }
 render.push([name,`${name==='重点差异与缺口'?'C':'D'}6:${col(Math.min(cfg.oldCols+1,p+3))}10`]);
}
function table(name,title,note,heads,rows,widths){
 const s=wb.worksheets.add(name);s.showGridLines=false;const n=heads.length,end=rows.length+6;
 s.getRangeByIndexes(0,0,end,n).format={font:{name:'Arial',size:10,color:ink},verticalAlignment:'top',rowHeightPx:25};
 widths.forEach((w,i)=>s.getRangeByIndexes(0,i,end,1).format.columnWidthPx=w);
 s.getRange('A2').values=[[title]];s.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:navy};
 s.getRange('A4').values=[[note]];s.getRange('A4').format.font.color='#536A7D';
 s.getRangeByIndexes(5,0,1,n).values=[heads];
 s.getRangeByIndexes(6,0,rows.length,n).setNumberFormat('@');s.getRangeByIndexes(6,0,rows.length,n).values=rows;
 const t=s.tables.add(`A6:${col(n-1)}${end}`,true,name==='参考对象对照'?'ReferenceObjects':'CDHDDeclarationDifferences');t.style='TableStyleMedium2';
 s.getRangeByIndexes(5,0,1,n).format={fill:navy,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true,rowHeightPx:44};
 s.getRangeByIndexes(6,0,rows.length,n).format.wrapText=true;
 rows.forEach((r,i)=>{
  const lines=Math.max(...r.map((v,j)=>Math.ceil([...String(v??'')].reduce((n,c)=>n+(c.charCodeAt(0)>255?13.5:7),0)/(widths[j]-20))));
  s.getRangeByIndexes(i+6,0,1,n).format={rowHeightPx:Math.max(58,lines*19+14),fill:i%2?'#F4F7FA':'#FFFFFF'};
 });
 s.freezePanes.freezeRows(6);s.freezePanes.freezeColumns(2);return s;
}
const inv=table('参考对象对照','以高创XML为参考的标准对象对照','每个对象只计一次：客户PDF表格定义101个对象，加6.2明确要求的1001/1018，共103个；仅高创XML列出的对象进入参考分母。',
 ['协议条款','对象索引','标准对象名称','标准适用条件','我方注册 1/0','高创声明 1/0','我们的当前判断','高创的判断（仅XML）','高创XML依据','参考对比结果','我们的源码依据'],data.inventory,[105,105,290,410,110,110,360,540,350,290,380]);
inv.getRange(`E7:F${data.inventory.length+6}`).setNumberFormat('0');
inv.getRange(`J7:J${data.inventory.length+6}`).conditionalFormats.add('containsText',{text:'我方缺对象',format:{fill:'#FCE7E5'}});
render.push(['参考对象对照','A6:K11']);
table('高创声明差异','高创XML相对客户标准的声明差异','这里是声明差异，不是实机违规清单。默认值需上电SDO读回；60C4最高子索引也涉及客户标准自身的表格不一致。',
 ['明细编号','协议条款','对比项','客户标准规定','高创的判断（仅XML）','XML依据','明细定位'],data.issues,[155,105,280,540,640,360,260]);
render.push(['高创声明差异','A6:G11']);
const s=wb.worksheets.add('高创参考覆盖');s.showGridLines=false;
s.getRange('A1:F35').format={font:{name:'Arial',size:11,color:ink},verticalAlignment:'center',rowHeightPx:31};
[340,145,590,120,120,120].forEach((w,i)=>s.getRangeByIndexes(0,i,35,1).format.columnWidthPx=w);
s.getRange('A2').values=[['CDHD2参考范围与我方覆盖']];s.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:navy};
s.getRange('A4').values=[['仅统计对象是否存在；不代表完整功能、属性或运行符合率。']];
s.getRange('A6:C6').values=[['统计口径','数量 / 比例','说明']];
s.getRange('A6:C6').format={fill:navy,font:{color:'#FFFFFF',bold:true,size:11},rowHeightPx:36};
const end=data.inventory.length+6;
const metrics=[
 ['高创列出的标准相关对象',`=COUNTIFS('参考对象对照'!F7:F${end},1)`,'分母：按对象索引去重；高创私有对象不计入。'],
 ['我们也已注册的对象',`=COUNTIFS('参考对象对照'!F7:F${end},1,'参考对象对照'!E7:E${end},1)`,'仅代表索引存在；包含60FE这类结构仍有差异的对象。'],
 ['高创有、我们尚未注册',`=COUNTIFS('参考对象对照'!F7:F${end},1,'参考对象对照'!E7:E${end},0)`,'在参考对象对照中筛选“高创列出，我方缺对象”。'],
 ['对象存在覆盖率','=B8/B7','不是完整功能覆盖率，更不是CiA402符合率。'],
 ['我方有、高创XML未列',`=COUNTIFS('参考对象对照'!F7:F${end},0,'参考对象对照'!E7:E${end},1)`,'当前为605A。XML未列不等于高创固件没有。'],
 ];
for(let i=0;i<metrics.length;i++){const r=i+7;s.getRange(`A${r}:C${r}`).values=[[metrics[i][0],null,metrics[i][2]]];s.getRange(`B${r}`).formulas=[[metrics[i][1]]];}
s.getRange('B7:B11').setNumberFormat('0');s.getRange('B10').setNumberFormat('0.0%');s.getRange('B10').format.font={size:16,bold:true,color:navy};
s.getRange('A13:C13').values=[['能否认定高创完全符合？','不能','ESI声明ProfileNo=402，但存在声明差异，且不证明固件的FSA、停车、单位、错误及同步行为。']];
s.getRange('A15:C15').values=[['模式参考','我们的当前判断','高创的判断（仅XML）']];s.getRange('A15:C15').format={fill:navy,font:{color:'#FFFFFF',bold:true}};
const modes=[['PP / 1','未声明','6502 bit0=1，声明支持'],['vl / 2','未声明','6502 bit1=0，未声明'],['PV / 3','未声明','6502 bit2=1，声明支持'],['PT / 4','未声明','6502 bit3=1，声明支持'],['HM / 6','未声明','6502 bit5=0，但回零对象已列，声明需核实'],['IP / 7','未声明','6502 bit6=1，声明支持'],['CSP / 8','已接入，有缺口','6502 bit7=1，声明支持'],['CSV / 9','已接入，有待核对','6502 bit8=1，声明支持'],['CST / 10','已接入，有缺口','6502 bit9=0，未声明；6071/6077也可用于PT']];
s.getRange('A16:C24').values=modes;
s.getRange('A26:C31').values=[
 ['关键声明疑点','0x1DD','6502 bit4是客户标准的保留位，却被置1；不能擅自替厂家纠正成另一个值。'],
 ['对象总数',data.source.objects,'XML共540个对象；其中包含大量厂商对象，不能全部当作CiA402标准对象。'],
 ['设备基线','CD02',`Vendor ${data.source.vendor}；Product ${data.source.product}；Revision ${data.source.revision}`],
 ['CoE声明','CA=0','SdoInfo=0；CompleteAccess=0；PdoAssign=1；PdoConfig=1。这些不作为Part 2完整符合证明。'],
 ['XML来源',null,data.source.path],
 ['XML SHA256',null,data.source.sha256],
 ];
s.getRange('A33:C34').values=[['比对基准',null,'客户CiA402 Part 2 V3.0及2010勘误；我方基线沿用v3工作簿中的源码审查。'],['未完成证据',null,'未获取CDHD固件/实机SDO读回/认证报告。默认值、访问权限和运行行为应以版本一致的设备复核。']];
s.getRange('A7:C34').format.wrapText=true;
for(let r=7;r<=34;r++)s.getRange(`A${r}:C${r}`).format.rowHeightPx=[13,26,29,30,31,33,34].includes(r)?64:40;
s.getRange('A30:C31').format.rowHeightPx=66;
render.push(['高创参考覆盖','A2:C13'],['高创参考覆盖','A15:C29']);
await wb.recalculate();
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:2600})).ndjson);
const out=path.join(dir,'DFS10A_高创CDHD2_CiA402逐项对照_v4.xlsx');
await(await SpreadsheetFile.exportXlsx(wb)).save(out);
for(let i=0;i<render.length;i++){
 const [sheetName,range]=render[i];const png=await wb.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile(path.join(cache,`cdhd-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
console.log(out);
