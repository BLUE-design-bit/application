import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=path.join(root,'.cache/cia402-detail');
const dir=path.join(root,'outputs/01a08f03-8e5c-79e3-bb07-33816e14789f');
const input=path.join(dir,'DFS10A_CiA402_V3_模块覆盖初审.xlsx');
const out=path.join(dir,'DFS10A_CiA402_V3_数据类型逐项核对_v2.xlsx');
const data=JSON.parse(await fs.readFile(path.join(cache,'detail-data.json'),'utf8'));
assert.equal(data.types.length,24);
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(input));
const snapshot=wb.worksheets.getItemAt(0).getRange('A1:H27').values;
const before=await wb.render({sheetName:'目录模块总览',range:'A6:H12',scale:1,format:'png'});
await fs.writeFile(path.join(cache,'before.png'),new Uint8Array(await before.arrayBuffer()));
const navy='#274560',ink='#243547';
let counter=0;
const column=i=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const created=[];
function add(name,title,note,headers,rows,widths,checkColumn,statusColumn){
 const sh=wb.worksheets.add(name),n=headers.length,end=rows.length+6;
 created.push({name,end,n});sh.showGridLines=false;
 sh.getRangeByIndexes(0,0,end,n).format={font:{name:'Arial',size:10,color:ink},verticalAlignment:'top',rowHeightPx:25};
 widths.forEach((w,i)=>sh.getRangeByIndexes(0,i,end,1).format.columnWidthPx=w);
 sh.getRange('A2').values=[[title]];sh.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:navy};
 sh.getRange(`A3:${column(n-1)}3`).format.borders={bottom:{style:'thin',color:'#D7E0E8'}};
 sh.getRange('A4').values=[[note]];sh.getRange('A4').format.font={name:'Arial',size:10,color:'#536A7D'};
 sh.getRangeByIndexes(5,0,1,n).values=[headers];
 sh.getRangeByIndexes(6,0,rows.length,n).setNumberFormat('@');
 sh.getRangeByIndexes(6,0,rows.length,n).values=rows;
 const tbl=sh.tables.add(`A6:${column(n-1)}${end}`,true,`Detail${++counter}`);tbl.style='TableStyleMedium2';tbl.showFilterButton=true;
 sh.getRangeByIndexes(5,0,1,n).format={fill:navy,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',rowHeightPx:42,wrapText:true};
 sh.getRangeByIndexes(6,0,rows.length,n).format.wrapText=true;
 rows.forEach((r,i)=>{
  let lines=Math.max(...r.map((v,j)=>String(v??'').split('\n').reduce((n,s)=>n+Math.max(1,Math.ceil([...s].reduce((t,c)=>t+(c.charCodeAt(0)>255?13.5:7),0)/(widths[j]-20))),0)));
  sh.getRangeByIndexes(i+6,0,1,n).format.rowHeightPx=Math.max(58,lines*19+14);
  sh.getRangeByIndexes(i+6,0,1,n).format.fill=i%2?'#F4F7FA':'#FFFFFF';
 });
 if(checkColumn!==null){
  const check=sh.getRangeByIndexes(6,checkColumn,rows.length,1);check.format.fill='#FFF3D1';
  check.dataValidation={rule:{type:'list',values:['未核对','已核对','有异议','待实测']}};
  sh.getRangeByIndexes(6,checkColumn+1,rows.length,1).format.fill='#FFF3D1';
 }
 if(statusColumn!==null){
  const status=sh.getRangeByIndexes(6,statusColumn,rows.length,1);
  for(const [text,fill]of [['未找到','#FCE7E5'],['不一致','#FCE7E5'],['缺口','#FFEBCB'],['待','#FFF3D1'],['未接入','#EEF1F4']])status.conditionalFormats.add('containsText',{text,format:{fill}});
 }
 sh.freezePanes.freezeRows(6);sh.freezePanes.freezeColumns(2);return sh;
}
add('数据类型逐项','第5章 数据类型逐项核对','表1的11种类型 + 表2–4的13个字段全部列入。黄色列由工程师核对；“已核对”不等于实机符合性通过。',
 ['编号','协议条款','标准表/页','数据类型 / 记录字段','协议规定','当前判断','现在的实现','尚缺 / 判定边界','代码依据（路径相对df-sdk/modules/）','人工核对','核对备注 / 实测证据'],
 data.types,[110,78,150,260,325,160,405,385,340,115,280],9,5);
assert.deepEqual(wb.worksheets.getItemAt(0).getRange('A1:H27').values,snapshot);
await wb.recalculate();
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:2300})).ndjson);
await (await SpreadsheetFile.exportXlsx(wb)).save(out);
for(const [i,s]of created.entries()){
 const png=await wb.render({sheetName:s.name,range:`A6:${column(s.n-1)}${Math.min(11,s.end)}`,scale:1,format:'png'});
 await fs.writeFile(path.join(cache,`sheet-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
console.log(out);
