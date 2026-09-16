import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Workbook, SpreadsheetFile} from '@oai/artifact-tool';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'outputs/01a08f03-8e5c-79e3-bb07-33816e14789f/DFS10A_CiA402_V3_模块覆盖初审.xlsx');
const cache=path.join(root,'.cache/cia402-audit');
await fs.mkdir(cache,{recursive:true});
// A customer-standard chapter is the primary unit. Do not score optional omissions as violations.
const rows=[
['1','Scope｜范围','8','说明项','不作符合判定','本次审查对应 Part 2：运行模式及应用数据。','完整 EtherCAT、ESI、PDO 映射及 PLC 兼容性不在此分册内。','S01'],
['2','Normative references｜规范性引用','8','说明项','未扩展验证','保留 CiA301、CiA402-1、CiA402-3 的引用关系。','本版只按客户所给 Part 2 及其附带勘误审查。','S01'],
['3','Abbreviations and definitions｜术语','8','说明项','不作符合判定','沿用标准 PP、HM、IP、PV、PT、vl、CSP、CSV、CST 分类。','vl（模式2）与 PV（模式3）、CSV（模式9）分别判断。','S01'],
['4','Introduction｜运行模式与对象字典','8–9','有基础实现','部分覆盖','有 CoE 对象字典、轴对象注册；6502 默认 0x380 声明 CSP/CSV/CST。','实际为单轴；标准保留索引、访问属性及全部默认值待逐项核对。','E01/E02'],
['5','Data types｜数据类型','9–11','有基础实现','部分覆盖','6040/6041、6060/6061、位置/速度/转矩对象有类型描述。','已见 60FE 用 VAR 而非 ARRAY；全部对象位宽、符号、子项未逐个核验。','E02/E10'],
['6','General object definitions｜通用对象','11–16','部分实现','部分覆盖','1000 设备类型、1001 错误寄存器、1018 身份信息有字典。','未找到 6402–6407、6503、6505 标准电机/驱动信息对象；可选缺项不直接判违规。','E03/E02'],
['7','Error codes and error behaviour｜错误码与行为','16–21','有框架未闭环','存在缺口','有本地故障保护与 CiA402_LocalError 接口、603F 对象。','未找到本地故障调用该接口；1001/603F 与真实故障联动未闭环，EMCY 配置为关闭。','E04'],
['8','Controlling the power drive system｜驱动控制','21–36','部分实现','已见明确差异','有 402 状态机、6040/6041、模式选择和 605A/B/C/E 对象。','停机动作函数是占位；故障状态/复位联动、bit12 与实际执行状态需细审。','E05/E06'],
['9','Factor group｜单位与比例换算','36–40','内部有；标准接口未见','可选接口缺失','内部有总线位置/速度换算及两级比例参数。','608F、6090、6091、6092、607E 未在轴字典中找到；内部单位功能不等于标准对象支持。','E02/E07'],
['10','Profile position mode｜PP 轮廓位置','41–57','未支持标准模式','未声明该模式','607A 和内部运动规划存在，但不能据此算 PP。','6502 无模式1；未找到 PP 新设定点握手和标准轮廓参数控制链。','E02/E08'],
['11','Homing mode｜HM 回零与探针','57–70','内部有；标准模式未支持','未声明该模式','有本地 homing 模块和原点输入；未接通模式6。','607C、6098/6099/609A、60B8–60BD 未进轴字典；勘误要求支持 HM 时必须有方法35。','E02/E09'],
['12','Position control function｜位置控制功能','70–80','部分实现','部分覆盖','真实位置环与 6064 实际位置反馈已接入。','6062/6063、6065–6068、60F4 等标准对象未见；跟随误差状态、窗口及限位执行待核对。','E02/E07/E11'],
['13','Interpolated position mode｜IP 插补位置','80–92','未支持标准模式','未声明该模式','有内部周期插补和 60C2 对象。','6502 无模式7；60C0/60C1/60C4、IP 缓冲握手未见。CSP 内部插补不能替代 IP。','E02/E08'],
['14','Profile velocity mode｜PV 轮廓速度','92–99','未支持标准模式','未声明该模式','60FF/606C 服务于 CSV，不足以证明 PV。','6502 无模式3；PV 斜坡、速度窗口及模式握手未见完整接入。','E02/E08'],
['15','Profile torque mode｜PT 轮廓转矩','99–107','未支持标准模式','未声明该模式','6071/6077 服务于 CST，不足以证明 PT。','6502 无模式4；6087 转矩斜率、6088 轮廓类型未见。CST 共用对象问题见第19章。','E02/E08/E12'],
['16','Velocity mode｜vl 速度模式','107–120','未支持标准模式','未声明该模式','未找到模式2专用控制链。','6042/6043/6044、6046、6048–604C 等 vl 对象未见。','E02/E08'],
['17','Cyclic synchronous position mode｜CSP','120–124','核心通路已接入','部分覆盖','模式8：607A → 单位换算 → 插补 → 位置环；6064 来自编码器。','60B0/B1/B2 可选偏置未见；软限位、跟随误差和 bit12 的真实语义待核对。','E07/E08/E11'],
['18','Cyclic synchronous velocity mode｜CSV','124–127','核心通路已接入','部分覆盖','模式9：60FF → 单位换算 → 插补 → 速度环；有 606C。','606C 直接取编码器 speed，需核对与指令单位一致；60B1/B2 可选偏置未见。','E07/E08/E11'],
['19','Cyclic synchronous torque mode｜CST','127–128','有控制通路；反馈缺口','存在缺口','模式10：6071 → 转矩插补 → 电流环输入；6502 声明支持。','未找到 6077 实际反馈的生产赋值；6071 的额定转矩千分比换算也需优先核对。','E08/E12'],
['20','Optional application FE｜数字输入输出','128–130','输入有；输出不完整','已见明确差异','60FD 已接负限位、正限位、原点输入。','60FE 被定义为 32 位 VAR:00，与标准 ARRAY:01 结构不同；未见驱动物理输出的使用链。','E10'],
['勘误1','Corrigendum 1｜2010-09-09','PDF 132–140','已纳入审查基准','修订需随模块细审','本 PDF 自带勘误：控制/状态字、模式条件、HM35、6064、60FE 等均有修订。','这是同一文件的一部分，后续细审须按修订后条文；不按纯2007正文单独判定。','S01'],
];
assert.deepEqual(rows.slice(0,20).map(x=>Number(x[0])),Array.from({length:20},(_,i)=>i+1));
const issues=[
['D01','8.4.5–9','明确差异','605A/B/C/E 停机动作','605A 默认2；TransitionAction 对减速、急停、电流/电压限幅停机仅警告并直接返回 TRUE。','PLC 可看到状态转移已完成，但该通路没有按选项执行并等待规定斜坡。底层独立保护不能自动补足此语义。','正文29–33；表38等','E05','优先核对停止选项与真实减速完成条件。'],
['D02','20.3','明确差异','60FE 数字输出对象结构','代码为 UNSIGNED32 VAR，sub0 即输出值；标准为 ARRAY，sub0 为最高子索引、sub1 为物理输出。','PLC 按标准写 60FE:01 的路径无法按此字典工作；勘误允许最高子索引为1或2，不允许改成 VAR。','正文129–130；勘误PDF139–140','E10','核对 ESI、SDO、PDO 和实际输出的一致结构。'],
['D03','19.3 / 15.5.7','静态缺口','CST 的 6077 实际转矩反馈','轴6077从 App_Pdo.i16TorqueActualValue 复制；在 app/及 modules/未找到该字段的有效生产赋值。','CST 已声明支持；标准19.3要求实际转矩输出。当前代码证据不足以提供真实反馈。','正文104–105、127','E12','追踪实际电流/转矩到6077的来源、单位和更新周期。'],
['D04','15.5.1 / 19','疑似差异','6071 目标转矩单位','原始 INT16 经插补进入 target_pva.acc，再作为电流参数传给 currentToPU；未见额定转矩千分比换算。','标准单位是额定转矩的千分之一；若原始值直接按安培解释，PLC 给定与电机输出比例会不同。','正文101–102、127–128','E12','核对额定电流、额定转矩、转矩常数及数值1000的含义。'],
['D05','7 / 8.2 / 8.4.3','静态缺口','真实故障 → 402状态/603F','有 CiA402_LocalError 定义，但 app/及 modules/未找到调用；本地故障状态机独立运行。','驱动本地停机不等于 PLC 收到 Fault 和标准错误码；故障复位与错误清除也需闭环确认。','正文16–24、28','E04','按过流、欠压、编码器、通信等实际错误追完整上报链。'],
['D06','8.2 / 8.4.1','需细审','状态转换与故障复位边沿','进入 EtherCAT OP 时跳过402转换1/2；故障复位按bit7当前电平判定，未见边沿记忆。','需对照标准状态图和 Fault reset 边沿语义，验证上电、重复故障、持续高bit7行为。','正文22–26','E06','逐条检查转换1–16；避免把已有状态机判成完整符合。'],
['D07','17.3 / 18.4 / 19.4','需细审','状态字 bit12 是否真的跟随指令','无 pending option 时置 Drive follows command；实际指令又受 Operation enabled 门控。','尚未证明 bit12 与目标被实际控制环采用完全一致；CSP 跟随误差bit13也未见闭环。','正文121–122、126、128','E06/E08','对照未使能、限位、停机、故障时的状态字。'],
['D08','9 / 14.5.4 / 18','需细审','速度反馈与指令单位一致性','目标速度做总线单位到 count/s 换算，606C直接取 encoder speed。','需确认 encoder speed 的单位及电子齿轮变化后的反馈缩放，不能只检查数值在变化。','正文36–40、95–96、124–127','E07/E11','核对速度指令/反馈正负号、倍率、额定值。'],
['D09','10.5.3 / 12 / 17','需细审','607D 软件限位是否约束真实指令','限位判断位于 DummyMotionControl；其后真实 inter_cal_input 仍按 Operation enabled 输入目标。','已见限位状态位处理，但未证明真实位置目标被截断或停止；需检查本地限位是否使用同一参数。','正文47–48、70–80、120–122','E11','核对越界、退限位、单位换算与bit11。'],
['D10','13.5.3 / 17–19','需细审','60C2 与实际插补周期','60C2 在字典中可访问；应用周期来自 Sync0CycleTime，插补频率来自 ecat.sync_time。','未见60C2写值参与实际周期配置；存在参数可写但行为不随之改变的风险。','正文87–88、120、125、127','E13','核对主站周期、60C2与DC同步周期关系。'],
['D11','10/11/13/14/15/16','未支持；不自动判违规','六种未声明的标准运动模式','6502默认仅位7/8/9；控制分发仅8/9/10。HM及其他底层运动函数不能代替标准模式接口。','PP、HM、IP、PV、PT、vl 应列为产品能力缺项；是否必须补齐取决于客户用法与产品承诺。','各对应章节；8.4.12','E02/E08/E09','先确定客户需要的模式，再对选定模式做细审。'],
['D12','9 / 11.5.5–10 / 17.4','可选接口未见','Factor、Touch Probe、同步模式偏置','未见608F/6090/6091/6092/607E、60B8–60BD、60B0–60B2注册到轴字典。','不能用私有参数表中的同名字段证明PLC可经标准SDO/PDO使用；可选对象不因缺失就判违规。','正文36–40、66–70、122–124','E02/E09','后续按客户探针、电子齿轮、前馈需求选择。'],
];
const evidence=[
['S01','标准文件','CiA-402-2-version-3.0.0.pdf','140页；正文1–130，131为空白，132–140为2010勘误；正文可见修订标注。','SHA256 909af4faa9d1b97855751743b3ca67b7f2e8ce27b50e331a54a0d2c40d59bc24'],
['E01','工程接入','DFS_10A.emProject:537–580；df-sdk/modules/ethercat/ecatappl.c:918','项目实际列入 ethercat 模块；主循环调用402状态机。未把 hpm_sdk/samples 当作产品功能。','dfs-10a HEAD 233caefc993978a50f8ad64d806d51acc06d198b；df-sdk HEAD a7848cfa291a82a018463d44fa9371a1b16b7e5d'],
['E02','轴对象及支持模式','df-sdk/modules/ethercat/cia402appl.h:335,1185–1220,1673–1742；cia402appl.c:128–325,1423–1441','MAX_AXES=1；默认6502=0x380；CSP/CSV专用PDO下分别为0x80/0x100。逐项扫描轴字典的6000区对象。','已列入对象不代表已实现行为；未见对象以此实际字典及app/modules搜索为依据。'],
['E03','通用对象','df-sdk/modules/ethercat/coeappl.c:142–176,494起','有1000/1001及1018对象；本轮未对身份值与发布ESI逐值比对。','CANopen专用通信对象需结合CoE适配判断，未将CAN专用传输要求直接套到EtherCAT。'],
['E04','故障上报链','df-sdk/modules/ethercat/cia402appl.c:657–667；ecat_common.c:401–402；ecat_def.h:305–307；df-sdk/modules/monitor/statemachine.c:245–336','CiA402_LocalError仅见定义/声明；错误值复制被注释；EMERGENCY_SUPPORTED=0；本地监控另有故障状态机。','搜索app/及df-sdk/modules/有效.c/.h；未验证硬件故障注入。'],
['E05','停机斜坡','df-sdk/modules/ethercat/cia402appl.c:794–834,860–939；cia402appl.h:1196–1199','四种斜坡分支警告后返回TRUE；调用者据此完成转换；605A默认2。','明确代码差异限定在402停机选项通路，不否认本地有独立急停/保护。'],
['E06','状态机与状态位','df-sdk/modules/ethercat/cia402appl.c:395–423,462–499,575–585,843–858,966–981','有真实motor_enable状态确认；OP跳转、故障复位电平判断、bit12置位及目标门控需要联动核查。','未运行编译或台架测试；条款细节暂不全部判定。'],
['E07','总线单位换算','df-sdk/modules/ethercat/ecat_common.c:417–526；app/Task_Control.c:1086–1087','位置/速度指令有比例换算；位置反馈反向换算；速度反馈直接赋encoder speed。','内部ratio参数存在不代表已导出第9章对象。'],
['E08','模式控制通路','df-sdk/modules/ethercat/ecat_common.c:125–162,233–280；cia402appl.c:952–981；df-sdk/modules/motion/interpolation.c:628–642；app/Task_Control.c:853–867,963–967','8/9/10分别进入位置、速度、转矩插补与实际控制环输入；无1/2/3/4/6/7分发。','ObjWrite0x6060只在CONFIG_CIA402_USING_ACTUAL_MOTOR分支绑定；一般字典分支为通用SDO写。不能据该回调单独断言所有构建拒绝非法模式。'],
['E09','本地回零与探针占位','df-sdk/modules/motion/homing.c；df-sdk/modules/mcp/parameter_interface.c:333–338；df-sdk/modules/ethercat/cia402appl.h:1673–1742','本地Homing实现存在；私有参数表有probe字段，但标记DISABLED/RESERVED；轴字典未注册HM与探针对象。','因此结论是标准接口未接入，而不是整个固件没有回零算法。'],
['E10','数字输入输出','df-sdk/modules/ethercat/cia402appl.h:916,1738–1741；cia402appl.c:1630；ecat_common.c:377–395','60FD bit0/1/2由物理限位/原点更新；60FE为VAR:00，PDO只复制到objDigitalOutputs。','未见objDigitalOutputs驱动物理输出的后续读取；标准表249/250及勘误要求ARRAY。'],
['E11','位置控制/软限位','app/Task_Control.c:853–854,1086–1087；df-sdk/modules/ethercat/cia402appl.c:674–784,945–981','真实位置环存在；Dummy分支判断607D并更新bit11；随后真实输入链独立输送目标。','构建未见定义CONFIG_CIA402_USING_ACTUAL_MOTOR；保留两个分支风险，最终以实际编译宏/固件确认。'],
['E12','转矩给定与反馈','df-sdk/modules/ethercat/ecat_common.c:158–161,373；cia402appl.c:973–977；df-sdk/modules/motion/interpolation.c:638–641；app/Task_Control.c:967,1086–1091；df-sdk/modules/common/units/per_unit.c:101–104','CST给定一路传至currentToPU；6077仅从App_Pdo复制；搜索i16TorqueActualValue未见有效赋值（注释除外）。','按标准15.5.1核对千分额定转矩；按19.3核对强制实际转矩输出。'],
['E13','插补周期','df-sdk/modules/ethercat/cia402appl.c:283,1276；ecat_common.c:95–99；cia402appl.h:1732–1733','60C2有对象；u32CycleTime=Sync0CycleTime，插补频率取ecat.sync_time。','未见60C2至实际插补参数的数据消费；不将内部插补当IP模式实现。'],
];
const wb=Workbook.create();
const navy='#274560',ink='#243547',line='#D7E0E8';
let tableId=0;
function make(name,title,note,heads,data,widths){
 const sh=wb.worksheets.add(name); sh.showGridLines=false;
 const end=data.length+6, n=heads.length, col=i=>String.fromCharCode(65+i);
 sh.getRangeByIndexes(0,0,end,n).format={font:{name:'Arial',size:10,color:ink},verticalAlignment:'top',rowHeightPx:24};
 widths.forEach((w,i)=>sh.getRangeByIndexes(0,i,end,1).format.columnWidthPx=w);
 sh.getRange('A2').values=[[title]]; sh.getRange('A2').format.font={name:'Arial',size:16,bold:true,color:navy};
 sh.getRange(`A3:${col(n-1)}3`).format.borders={bottom:{style:'thin',color:line}};
 sh.getRange('A4').values=[[note]]; sh.getRange('A4').format.font={name:'Arial',size:10,color:'#586C80'};
 sh.getRangeByIndexes(5,0,1,n).values=[heads];
 sh.getRangeByIndexes(6,0,data.length,n).values=data;
 const table=sh.tables.add(`A6:${col(n-1)}${end}`,true,`Audit${++tableId}`); table.style='TableStyleMedium2';
 sh.getRangeByIndexes(5,0,1,n).format={fill:navy,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center',rowHeightPx:38};
 sh.getRangeByIndexes(6,0,data.length,n).format.wrapText=true;
 data.forEach((r,i)=>{
  const lines=Math.max(...r.map((v,j)=>String(v).split('\n').reduce((a,t)=>a+Math.max(1,Math.ceil([...t].reduce((s,c)=>s+(c.charCodeAt(0)>255?13.5:7),0)/(widths[j]-18))),0)));
  sh.getRangeByIndexes(i+6,0,1,n).format.rowHeightPx=Math.max(62,lines*19+16);
  if(i%2)sh.getRangeByIndexes(i+6,0,1,n).format.fill='#F5F8FA';
 });
 sh.freezePanes.freezeRows(6); sh.freezePanes.freezeColumns(2); return sh;
}
// Unique tables use explicit counter in the current workbook API.
const main=make('目录模块总览','DFS-10A · CiA402 模块覆盖初审','基于客户 V3.0 + 文件附带2010勘误｜静态初审：有通路 ≠ 已通过符合性测试；未支持可选模式 ≠ 违规。',
 ['章节','标准目录模块','标准页码','当前实现覆盖','符合性初判','已经有什么','缺口 / 尚未确认','依据编号'],rows,[62,310,100,165,145,365,445,120]);
main.tabColor=navy;
const detail=make('重点差异与缺口','优先核对的差异与缺口','用于选择下一轮细审模块；“明确差异”有直接条文/代码对照，“需细审”尚未完成判定。',
 ['编号','关联章节','性质','检查主题','当前代码证据','与标准的差距 / 影响','标准定位','依据编号','下一轮核对范围'],issues,[65,110,150,220,410,440,160,115,285]);
detail.tabColor='#7E6477';
const source=make('审查依据','审查基线与代码证据','日期：2026-09-16｜代码路径相对 dfs-10a/；未修改源码，未编译/烧录/实机测试；未核验客户已发布固件和ESI。',
 ['编号','依据主题','文件 / 行号','已查内容','审查边界 / 版本'],evidence,[65,180,520,470,475]);
source.tabColor='#8796A4';
for(const sh of [main,detail]){
 const range=sh===main?'E7:E27':'C7:C18';
 for(const [text,fill]of [['明确差异','#FBE4E3'],['缺口','#FFF0D3'],['需细审','#FFF0D3'],['未声明','#EDF0F3']]) sh.getRange(range).conditionalFormats.add('containsText',{text,format:{fill}});
}
await wb.recalculate();
await fs.writeFile(path.join(cache,'audit-data.json'),JSON.stringify({rows,issues,evidence},null,2));
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:1500})).ndjson);
await fs.mkdir(path.dirname(out),{recursive:true});
await (await SpreadsheetFile.exportXlsx(wb)).save(out);
for(const [name,range,file] of [['目录模块总览','A6:H12','overview'],['重点差异与缺口','A6:I10','differences'],['审查依据','A6:E10','sources']]){
 const png=await wb.render({sheetName:name,range,scale:1,format:'png'});
 await fs.writeFile(path.join(cache,`${file}.png`),new Uint8Array(await png.arrayBuffer()));
}
console.log(out);
