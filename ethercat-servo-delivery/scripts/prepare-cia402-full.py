"""Enumerate the supplied Part 2, with static judgments kept separate from source.

Uses local PDF/source only. Does not infer runtime compliance from OD registration.
"""
from pathlib import Path
import json,re,collections,hashlib,subprocess
import pdfplumber
from pypdf import PdfReader
from openpyxl import load_workbook

root=Path(__file__).resolve().parents[1]
cache=root/'.cache/cia402-detail'
source=json.loads((cache/'standard-extracted.json').read_text(encoding='utf-8'))
pdf=PdfReader(root/'CiA-402-2-version-3.0.0.pdf')
clean=lambda s:re.sub(r'\s+',' ',s or '').strip()
with pdfplumber.open(root/'CiA-402-2-version-3.0.0.pdf') as pp:
    toc='\n'.join(l['text'] for p in pp.pages[2:7] for l in p.extract_text_lines())
tocmap={s:t.strip() for s,t,p in re.findall(r'^(\d+(?:\.\d+){0,3})\s+([^\n]+?)\.{3,}\s*(\d+)\s*$',toc,re.M)}
objects={m[1]:(s,t) for s,t in tocmap.items() if (m:=re.search(r'Object ([0-9A-F]{4})',t))}
tables={}
for t in source['tables']:
    n=t['number']
    if n not in tables:tables[n]=dict(t,rows=[],pages=[])
    z=tables[n];z['pages'].append(t['page']);z['rows'] += [(t['page'],i,r) for i,r in enumerate(t['rows'])]
    if t['caption']=='Object description':
        v={r[0]:next((x for x in r[1:] if x),'') for r in t['rows'][1:] if r and r[0]}
        idx=re.sub('[^0-9A-F]','',v.get('Index',''))[:4]
        if idx:z['object']=idx;z['section']=objects.get(idx,(z['section'],''))[0]
for n in [60,61]:tables[n]['section']='9.2.1';tables[n]['object']='608F'
assert set(tables)==set(range(1,251))
# Expand the two explicit "02 ... to ... N" ranges, not just their endpoints.
for n,stop in [(100,6),(164,254)]:
    original=tables[n]['rows'];expanded=[]
    for p,k,r in original:
        if [v for v in r if v]==['to']:
            template=[q for q in expanded if any(q[2])][-7:]
            assert template[0][2][0]=='Sub-Index'
            for subindex in range(3,stop):
                for j,(_,_,tr) in enumerate(template):
                    v=list(tr)
                    if v[0]=='Sub-Index':v[2]=f'{subindex:02X} h'
                    if v[0]=='Description':v[2]=(f'Profile jerk {subindex}' if n==100 else f'{subindex}th set-point')+'（原表范围逐项展开）'
                    expanded.append((p,1000+subindex*10+j,v))
        else:expanded.append((p,k,r))
    tables[n]['rows']=expanded
meta={}
for t in tables.values():
    if t['caption']=='Object description':meta[t['object']]={r[0]:next((x for x in r[1:] if x),'') for _,_,r in t['rows'] if r and r[0]}
meta['6060']['Category']=meta['6061']['Category']='Conditional: mandatory if more than one mode is supported（勘误）'
meta['6064']['Category']='Mandatory if pp, ip, csp is supported（勘误）'
for o in ['6049','604A']:meta[o]['Category']='Optional（勘误）'

code={};src=root/'dfs-10a/df-sdk/modules/ethercat'
for filename in ['cia402appl.h','coeappl.c']:
    text=(src/filename).read_text(encoding='utf-8',errors='replace')
    for m in re.finditer(r'\{NULL,\s*NULL,\s*0x([0-9A-Fa-f]{4}),\s*\{(DEFTYPE_\w+)\s*,\s*(\d+)\s*\|\s*\((OBJCODE_\w+)',text):
        code[m[1].upper()]=dict(type=m[2],sub=int(m[3]),kind=m[4],ref=f'df-sdk/modules/ethercat/{filename}:{text[:m.start()].count(chr(10))+1}',entries=[])
    for idx,c in code.items():
        m=re.search(r'(?:as|s)EntryDesc0x'+idx+r'(?:\[\])?\s*=\s*(.*?);',text,re.S|re.I)
        if m:c['entries']=[dict(type=a,bits=int(b,16),access=d.strip(),ref=f'df-sdk/modules/ethercat/{filename}:{text[:m.start()].count(chr(10))+1}') for a,b,d in re.findall(r'\{\s*(DEFTYPE_\w+)\s*,\s*(0x[0-9A-Fa-f]+)\s*,\s*([^}]+)',m[1])]
odref='df-sdk/modules/ethercat/cia402appl.h:1673–1745；coeappl.c:494–512'
smref='df-sdk/modules/ethercat/cia402appl.c:369–646'
moderef='df-sdk/modules/ethercat/cia402appl.h:1211；cia402appl.c:71–100；ecat_common.c:233–280'
stopref='df-sdk/modules/ethercat/cia402appl.c:794–979'
errref='df-sdk/modules/ethercat/cia402appl.c:657–667；ecat_common.c:401–402；ecat_def.h:307'
names={o:re.sub(r'^Object [0-9A-F]{4}\s*h?\s*:\s*','',t) for o,(s,t) in objects.items()}
types={'DEFTYPE_UNSIGNED8':'Unsigned8','DEFTYPE_UNSIGNED16':'Unsigned16','DEFTYPE_UNSIGNED32':'Unsigned32','DEFTYPE_INTEGER8':'Integer8','DEFTYPE_INTEGER16':'Integer16','DEFTYPE_INTEGER32':'Integer32','DEFTYPE_VISIBLESTRING':'Visible string','DEFTYPE_RECORD':'Record'}
kinds={'OBJCODE_VAR':'Variable','OBJCODE_ARR':'Array','OBJCODE_REC':'Record'}
initial={'1000':'0x00000192','603F':'0','6040':'0','6041':'0','605A':'2','605B':'0','605C':'1','605E':'2','6060':'0','6061':'0','6064':'0','606C':'0','6071':'0','6077':'0','607A':'0','607D:00':'2','607D:01':'-2000000000','607D:02':'2000000000','6085':'0','60C2:00':'2','60C2:01':'1','60C2:02':'-3','60FF':'0','6502':'0x380','60FD':'0','60FE':'0'}

def applicability(obj,section):
    if section=='6.2' and obj in ['1000','1001','1018']:return '6.2正文规定必须实现；具体结构引用CiA301'
    cat=meta.get(obj,{}).get('Category','按本条功能适用')
    if cat.startswith('Conditional') or 'if ' in cat:
        supported=[x for x in ['csp','csv','cst'] if re.search(r'\b'+x+r'\b',cat)]
        if supported or obj in ['6060','6061']:return cat+'；当前条件满足'
        return cat+'；当前未声明相应模式'
    if cat=='Optional（勘误）' or cat=='Optional':return cat+'；未提供不自动违规，提供则须遵守定义'
    return cat

object_notes={
'1000':('已有实现','0x1000初值0x00000192（402），已在通用对象字典注册；附加信息位须结合Part 3核对。','df-sdk/modules/ethercat/coeappl.c:147,495'),
'1001':('对象已有；故障更新未见','1001描述为Unsigned8只读，初始0；未找到本地故障汇总更新u16ErrorRegister的生产代码。','df-sdk/modules/ethercat/coeappl.c:166–171,497'),
'1018':('对象及字段已有','Identity记录含00计数及Vendor ID/Product code/Revision/Serial number四字段；数值与出货ESI/标识一致性需实测。','df-sdk/modules/ethercat/coeappl.c:245–260,505'),
'603F':('存在缺口','对象可读，但CiA402_LocalError未见生产调用，反馈复制已注释；未建立本地故障到标准错误码的完整上报。',errref),
'6040':('部分实现','命令掩码与状态分支已实现；故障复位未判上升沿，Halt/模式专用位需按本条核对。',smref),
'6041':('部分实现','8种状态编码已定义；状态字部分位来源为轴软件标志，故障链和实际功率状态不能由声明证明。',smref),
'605A':('存在缺口','对象默认2；1–8的斜坡动作函数是占位。0没有相应自动禁用分支；非使能状态指令归零不等于按规定斜坡完成停车。',stopref),
'605B':('部分实现','0调用motor_disable；1的减速斜坡仅返回TRUE，未按标准斜坡执行。',stopref),
'605C':('存在缺口','默认1，斜坡函数仅返回TRUE后禁用；0有直接motor_disable路径。',stopref),
'605E':('存在缺口','默认2，故障斜坡为占位；本地故障未见接入CiA402_LocalError。',errref+'；'+stopref),
'6060':('部分实现','当前支持8/9/10；按6502判断并更新6061。默认工程未见ACTUAL_MOTOR宏启用，不能把条件编译的SDO专用回调当作已启用。',moderef+'；cia402appl.c:1704–1754'),
'6061':('部分实现','支持的请求模式复制到显示；不支持时显示0。显示更新先于后续模式准备，实际切换时序需实测。',moderef+'；cia402appl.c:858,960–965'),
'6064':('已有通路，待实测','编码器反馈经总线单位换算再写入6064；正负值、溢出和比例边界尚无实测证据。','app/Task_Control.c:1073–1087；df-sdk/modules/ethercat/ecat_common.c:419–450'),
'606C':('存在差异风险','606C直接取encoder speed，60FF则按总线位置单位/s换算为count/s；两者单位须证实一致。','app/Task_Control.c:1087；df-sdk/modules/ethercat/ecat_common.c:507–548'),
'6071':('存在差异风险','目标转矩原始数值进入插补后按电流转换到PU；未见额定转矩千分比的换算链。','df-sdk/modules/ethercat/cia402appl.c:973–976；ecat_common.c:158–161；app/Task_Control.c:967'),
'6077':('存在缺口','对象及复制代码存在，未见i16TorqueActualValue生产赋值；不能作为有效转矩反馈。','df-sdk/modules/ethercat/ecat_common.c:373；app/Task_Control.c:1091（已注释）'),
'607A':('已有通路，待实测','CSP目标位置经总线单位换算进入实际插补；PP未支持，不把CSP通路视为PP轨迹实现。','df-sdk/modules/ethercat/cia402appl.c:955–976；ecat_common.c:523–533'),
'607D':('存在差异风险','记录与DummyMotionControl限位判断存在；实际inter_cal_input仍取原目标，未见607D限位值接入该指令链。','df-sdk/modules/ethercat/cia402appl.c:680–779,949–976'),
'6085':('存在缺口','参数已存储；QUICKSTOP_RAMP只警告后返回TRUE，未见参数参与实际CiA402减速动作。',stopref),
'60C2':('存在缺口','U8/U8/I8记录已注册，默认1×10^-3 s；实际插补频率采用DC周期，未见本对象写值参与配置。','df-sdk/modules/ethercat/cia402appl.h:970–976,1209；ecat_common.c:91–97'),
'60FF':('已有通路，待实测','CSV速度目标按总线位置单位/s转换为count/s并进入速度插补；反馈单位仍有疑点。','df-sdk/modules/ethercat/cia402appl.c:957–976；ecat_common.c:151–155,539–548'),
'6502':('已有实现','组合PDO默认0x380，表示CSP/CSV/CST；专用PDO赋值可能缩小支持集合，须按实际组合读回。','df-sdk/modules/ethercat/cia402appl.h:1211；cia402appl.c:71–87,1421–1448'),
'60FD':('部分实现','bit0负限位、bit1正限位、bit2原点接入物理输入；其余位当前为0。','df-sdk/modules/ethercat/ecat_common.c:363–395'),
'60FE':('明确不一致','实际为Unsigned32 VAR:00；标准为ARRAY，00计数、01物理输出、02可选掩码。未见对象值驱动物理输出。','df-sdk/modules/ethercat/cia402appl.h:916,1741；cia402appl.c:1630'),
}
chapters={
'4':('部分实现','模式8/9/10已声明；标准对象区有定义，其他模式未声明，见逐项对象与保留范围。',moderef),
'6':('部分实现','1000已提供；本章6402–6407、6503/6505未在实际CoE字典注册。',odref),
'7':('存在缺口','本地保护存在，但未见标准错误码到603F/EMCY的完整报告链。',errref),
'8':('部分实现','已有FSA和控制/状态字；转换1/2被OP捷径绕过，故障复位边沿和停机动作有差异。',smref+'；'+stopref),
'9':('标准接口缺失','本地units.frac_bus1/2提供比例换算，但608F/6090/6091/6092/607E未注册；PLC不能通过这些标准对象配置。','df-sdk/modules/ethercat/ecat_common.c:419–548；'+odref),
'10':('未支持该标准模式','PP=1未声明且无对应模式分发；共享607A/607D/6085另列，不能据此视为PP已实现。',moderef),
'11':('未支持该标准模式','HM=6未声明，607C/6098/6099/609A和探针对象未注册；本地homing.c不能代替标准接口。',moderef+'；df-sdk/modules/motion/homing.c'),
'12':('部分实现','实际位置环和6064反馈存在；标准跟随误差、位置窗口等配置对象未注册。','app/Task_Control.c:842–870；'+odref),
'13':('未支持该标准模式','IP=7未声明；60C2虽存在，60C0/60C1/60C4以及标准IP缓冲/FSA未接入。',moderef+'；'+odref),
'14':('未支持该标准模式','PV=3未声明；606C/60FF用于CSV，不能视为PV斜坡轨迹和到达判断已实现。',moderef),
'15':('未支持该标准模式','PT=4未声明；6071/6077用于CST，标准PT斜坡与限制对象未注册。',moderef),
'16':('未支持该标准模式','vl=2未声明，6042–6050等本章标准对象未注册。',moderef+'；'+odref),
'17':('部分实现','CSP模式和实际位置指令链存在；标准跟随误差/窗口对象缺失，软件限位在实际链的生效有风险。','df-sdk/modules/ethercat/ecat_common.c:125–148；cia402appl.c:949–979'),
'18':('部分实现','CSV模式和速度插补通路存在；60FF与606C单位一致性尚未证实，标准限速/窗口对象未注册。','df-sdk/modules/ethercat/ecat_common.c:151–155,539–548；app/Task_Control.c:1087'),
'19':('存在缺口','CST模式通路存在；目标千分比换算未见，6077实际转矩反馈无生产赋值。','df-sdk/modules/ethercat/ecat_common.c:158–161,373；app/Task_Control.c:967,1091'),
'20':('部分实现','60FD前三位有实际输入；60FE对象结构与标准不一致，输出执行链未见。',object_notes['60FD'][2]+'；'+object_notes['60FE'][2]),
}
def base(section,obj=''):
    if obj and obj not in code:return '未找到标准对象',f'实际CoE对象字典未注册{obj}（{names.get(obj,"")}）；私有参数/本地算法不算该标准接口。',odref
    if obj in object_notes:return object_notes[obj]
    return chapters.get(section.split('.')[0],('背景/引用条款','本条用于界定范围和引用，不单独判定驱动功能有无。','客户PDF对应页'))

def corrected(n,sub,key,value):
    v=value;note=''
    changes={(54,'Category'):meta['6060']['Category'],(56,'Category'):meta['6061']['Category'],(55,'Default value'):'0 if more than one mode supported; otherwise value of the supported mode', (134,'Category'):meta['6064']['Category'],(163,'Name'):'Interpolation data record',(226,'Category'):'Optional',(230,'Category'):'Optional'}
    if (n,key) in changes:v=changes[n,key];note='按2010勘误替换'
    if n in [61,63,65,67,76,78] and sub=='00' and key=='Default value':v='02h';note='按2010勘误替换'
    if n==164 and sub=='00' and key=='Default value':v='Manufacturer-specific';note='按2010勘误替换'
    if n==250 and sub=='00' and key=='Value range':v='01h to 02h';note='按2010勘误替换'
    if n in [122,124,126,128] and key=='Name':v={122:'Touch probe 1 positive edge',124:'Touch probe 1 negative edge',126:'Touch probe 2 positive edge',128:'Touch probe 2 negative edge'}[n];note='按2010勘误替换'
    return v,note

def num(v):
    v=v.replace(' ','')
    if re.fullmatch(r'[0-9A-Fa-f]+h',v):return int(v[:-1],16)
    try:return int(v,0) if v.lower().startswith('0x') else int(v)
    except ValueError:return None

def attribute(obj,sub,key,val,section):
    status,current,ref=base(section,obj)
    if obj not in code:return status,current,ref
    c=code[obj];si=int(sub or '0',16)
    ent=c['entries'][si] if si<len(c['entries']) else None
    if key=='Index':return '已注册',f'索引0x{obj}已注册。',c['ref']
    if key=='Name':return '已注册',f'已提供索引0x{obj}；功能语义见正文检查。',c['ref']
    if key=='Object code':
        kind=kinds[c['kind']];return ('引用定义待核对' if val.startswith('See ') else ('声明一致' if val==kind else '明确不一致')),f'实际对象结构：{kind}。',c['ref']
    if key=='Data type':
        kind=types.get(c['type'],c['type'])
        if obj=='60C2':return '字段结构一致','60C2为RECORD，子项00/01/02分别U8/U8/I8，见已认可的数据类型表。',c['ref']
        return ('声明一致' if val.lower().replace(' ','')==kind.lower().replace(' ','') else '引用定义待核对'),f'实际声明：{kind}。',c['ref']
    if sub and si>c['sub']:return '未找到子项',f'实际最高子索引为{c["sub"]}，没有标准子项{sub}。',c['ref']
    if obj=='60FE' and sub=='00' and key!='Category':return '明确不一致','实际00是32位输出值，标准00是最高子索引；不是同一字段。',c['ref']
    if key=='Sub-Index':return '已注册',f'子索引{sub}存在，最高子索引{c["sub"]}。',c['ref']
    if key=='Access' and ent:
        a=ent['access'];actual='rw' if 'READWRITE' in a else ('ro' if 'ACCESS_READ' in a and 'WRITE' not in a else a)
        return ('声明一致' if val==actual else '常量属性待核对' if val=='c' and actual=='ro' else '访问属性有差异'),f'描述符：{actual}；{a}。'+('只读属性不单独证明数值恒定。' if val=='c' else ''),ent['ref']
    if key=='Category':return '已提供该对象',applicability(obj,section)+'；对象存在，行为另判。',c['ref']
    if key=='Entry Category':return '已提供该字段',f'当前子项{sub}已注册；Mandatory以父对象适用/提供为前提。',c['ref']
    if key=='Default value':
        v=initial.get(obj+':'+sub,initial.get(obj))
        if v is None:return '初值待核对','需核对实际初始化；此处未从类型或索引推断数值。',c['ref']
        if num(val) is not None:return ('初值一致' if num(v)==num(val) else '初值有差异'),f'源码初值：{v}；复位/保存参数后的行为尚待实测。','df-sdk/modules/ethercat/cia402appl.h:1184–1218'
        return '已找到初值',f'源码初值：{v}；标准为{val}。','df-sdk/modules/ethercat/cia402appl.h:1184–1218'
    if key=='PDO mapping':return '映射声明已有；需Part 3判定',(ent['access'] if ent else c['type'])+'；本标准引用Part 3，不能仅凭Part 2判映射符合。',c['ref']
    if key=='Value range' and ent:
        dtype=types.get(ent['type'],ent['type'])
        if val==dtype:return '位宽/符号一致',f'子项实际为{dtype}，{ent["bits"]}位；边界传输仍待实测。',ent['ref']
        if obj in ['605A','605B','605C','605E']:return '范围校验缺口','通用SDO按Integer16写入；未见拒绝保留选项值的对象专用校验。','df-sdk/modules/ethercat/objdef.c:1547–1587；cia402appl.h:1695–1702'
    return status,current,ref

transitions={
0:('已有初始化','CiA402_Init初始化状态及轴对象；硬件上电/自检结果仍需验证。','df-sdk/modules/ethercat/cia402appl.c:108–164'),
1:('转换路径有差异','OP状态下先强制转Ready to switch on，正常循环绕过Not ready→Switch on disabled。',smref),
2:('转换条件有差异','Shutdown分支存在，但OP捷径在未检查Shutdown时直接转Ready to switch on。',smref),
3:('部分实现','收到Switch on改为Switched on；实际加功率/抱闸不是该分支直接确认。','df-sdk/modules/ethercat/cia402appl.c:433–437,608–613'),
4:('已有使能通路','等待motor_state==OPERATION_ENABLED再进入使能状态；使能前位置跟随实际值、速度/转矩归零。','df-sdk/modules/ethercat/cia402appl.c:462–487,967–979'),
5:('部分实现','605C=0直接禁用；默认605C=1所需斜坡仅占位。',stopref),
6:('已有禁用调用','Shutdown调用motor_disable后转Ready；实际断功率/抱闸时序待实测。','df-sdk/modules/ethercat/cia402appl.c:443–449'),
7:('已有状态分支','Quick stop或Disable voltage可转Switch on disabled；转换后的OP捷径另有差异。','df-sdk/modules/ethercat/cia402appl.c:428–431'),
8:('部分实现','605B=0直接禁用；1的斜坡占位后禁用。',stopref),
9:('已有禁用调用','Disable voltage调用motor_disable并转Switch on disabled；实际功率时序待实测。','df-sdk/modules/ethercat/cia402appl.c:532–538'),
10:('已有禁用调用','Switched on下Disable voltage/Quick stop调用motor_disable。','df-sdk/modules/ethercat/cia402appl.c:452–459'),
11:('存在缺口','进入Quick stop active，但规定的减速动作函数为占位。',stopref),
12:('部分实现','Disable voltage路径调用motor_disable；斜坡完成路径直接改状态，未证明真实减速完成及驱动禁用。',stopref),
13:('故障入口未接通','CiA402_LocalError可转Fault reaction active，但未找到本地故障的生产调用。',errref),
14:('存在缺口','配置斜坡仅返回TRUE，进入Fault未在此调用实际故障复位/断功率动作。',stopref),
15:('明确差异','只检查bit7当前为1，未检查上升沿，也未检查当前故障是否消失；motor_disable并不等于复位故障。','df-sdk/modules/ethercat/cia402appl.c:575–584'),
16:('未实现；标准不推荐','Quick stop active中未实现Enable operation返回使能的分支；标准明确不推荐支持此转换。','df-sdk/modules/ethercat/cia402appl.c:541–562'),
}

def behavior(n,section,obj,r):
    key=r[0] or '';value=' '.join(x or '' for x in r)
    if n==24:return '未找到标准错误码映射','未见本地保护到该标准错误码的映射及603F/EMCY上报；不据此断言硬件没有该保护。',errref
    if n==26 and key.isdigit():return transitions[int(key)]
    if n==27:
        if key=='Fault reset':return transitions[15]
        return '命令译码已有','控制字掩码和分支存在；涉及斜坡的动作缺口见转换表，不能只看译码通过。',smref+'；cia402appl.h:58–80'
    if n==30:return '状态编码一致','状态码宏与本行编码一致；实际状态及其变化真实性另按转换和反馈检查。','df-sdk/modules/ethercat/cia402appl.h:98–105；cia402appl.c:403–646'
    if n in [38,41,44,50]:
        v=num(key)
        if 'reserved' in value.lower():return '保留值校验未见','通用SDO写入Integer16，未见拒绝本行保留值的对象专用判断。','df-sdk/modules/ethercat/objdef.c:1547–1587；'+stopref
        if 'Manufacturer' in value:return '厂商范围未定义','未见本行厂商负值的动作定义；不是要求必须实现全部厂商值。',stopref
        if v==0 and n in [41,44]:return '已有禁用调用','该选项调用motor_disable；实际输出断开及停车行为待实测。',smref
        if v==0:return base(section,obj)
        return '斜坡动作未实现','对应slow down/quick stop/current limit/voltage limit函数仅警告后返回TRUE；未执行本行斜坡。',stopref
    if n==53:
        v=num(key)
        if v in [8,9,10]:return '已支持该模式','6502默认声明且实际模式分发有对应通路；单位/限制/反馈仍按模式章节逐项判。',moderef
        if v in [1,2,3,4,6,7]:return '未支持该模式','6502未声明，实际模式分发仅8/9/10。',moderef
        if v==0:return '已有厂商行为','0时显示0，不准备新的支持模式；2010勘误规定模式0行为为厂商自定义。',moderef
        return '未定义为支持模式','6502未声明这些值；默认SDO可写请求但显示0。非支持值的报错策略需结合EMCY要求核对。',moderef
    if n in [236,243,244]:
        bit=str(r[0]);v=str(r[1])
        if bit=='12':return '存在差异风险','bit12主要由pending option决定；pending=0时置1，但非Operation enabled时实际指令被实际位置/零速度/零转矩替代，标志可能未反映实际目标是否被采用。','df-sdk/modules/ethercat/cia402appl.c:845–856,942,971–979'
        if bit=='13' and n==236:return '未找到标准跟随误差状态','未见6065/6066配置及超窗计时到6041 bit13的更新；本地跟随误差保护不等于标准状态上报。',odref+'；'+smref
        if bit=='10':return '保留位需核对','本模式将bit10定义为保留；通用605A=5–8完成分支会置bit10，缺少按模式隔离。','df-sdk/modules/ethercat/cia402appl.c:899'
        return '未使用保留位','CSV/CST未见bit13更新；复位初值为0，仍需核对所有模式切换后的保持/清除。',smref
    return base(section,obj)

attribute_rows=[];behavior_rows=[];body_rows=[];corr_rows=[];coverage=[]
headers={'Index':'对象索引','Name':'对象名称','Object code':'对象结构','Data type':'数据类型','Category':'对象实现要求','Sub-Index':'子索引','Description':'字段定义','Entry Category':'字段实现要求','Access':'访问权限','Value range':'允许范围','Default value':'默认值','PDO mapping':'PDO映射要求'}
def row(rid,section,page,label,expect,obj,verdict):
    status,current,ref=verdict
    return [rid,section,page,label,expect,applicability(obj,section),status,current,ref,'未核对','']

for n,t in tables.items():
    if n<=4:
        coverage.append([f'表{n}',t['section'],t['caption'],','.join(map(str,t['pages'])),'数据类型逐项',{1:11,2:3,3:7,4:3}[n]])
        continue
    sec=t['section'];obj=t['object'];sub='';dest=attribute_rows if t['caption'] in ['Object description','Entry description'] else behavior_rows
    before=len(dest);hdr=t['rows'][0][2];carry=None
    for p,k,r in t['rows']:
        if not any(r) or r==hdr:continue
        rid=f'T{n:03}-P{p:03}-R{k:02}'
        vals=[v for v in r if v];key=vals[0];val=' / '.join(vals[1:])
        if dest is attribute_rows:
            if key=='Sub-Index':sub=re.match('[0-9A-F]{2}',val)[0]
            if key not in headers:raise ValueError((n,r))
            corrected_value,note=corrected(n,sub,key,val)
            judgement=attribute(obj,sub,key,corrected_value,sec)
            req=corrected_value+(f'（{note}；原值：{val}）' if note else '')
            dest.append(row(rid,sec,f'表{n}，PDF {p}',f'{obj}'+(':'+sub if sub else '')+' '+headers[key],req,obj,judgement))
        elif n==25:
            if r[0] is None:continue
            state_names=['Not ready to switch on','Switch on disabled','Ready to switch on','Switched on','Operation enabled','Quick stop active','Fault reaction active','Fault']
            for j,(state,req) in enumerate(zip(state_names,r[1:])):
                actual={'Brake applied, if present':['TRUE']*4+['FALSE']*3+['TRUE'],'Low-level power applied':['TRUE']*8,'High-level power applied':['FALSE']*3+['TRUE']*4+['FALSE'],'Drive function enabled':['FALSE']*4+['TRUE']*3+['FALSE'],'Configuration allowed':['TRUE']*4+['FALSE']*3+['TRUE']}[r[0]][j]
                verdict=('软件标志已有；硬件待核对',f'该状态对应软件标志={actual}；需要核对真实制动器/功率/使能/配置权限与标志一致。','df-sdk/modules/ethercat/cia402appl.c:600–630；cia402appl.h:1228–1238')
                dest.append(row(rid+f'-S{j}',sec,f'表{n}，PDF {p}',state+' / '+r[0],req,obj,verdict))
        else:
            if n==27 and r[0] is None:continue
            rr=list(r)
            if hdr[0] in ['Bit','Index']:
                if rr[0] is not None:carry=rr[0]
                elif not str(rr[-1] or '').startswith('NOTE'):rr[0]=carry
            h=['Command','bit7','bit3','bit2','bit1','bit0','Transitions'] if n==27 else hdr
            req='；'.join((str(h[j] or f'列{j+1}')+': '+v) for j,v in enumerate(rr) if v)
            if n==27 and rr[0]=='Fault reset':req+='；bit7为上升沿（原表图形箭头）'
            if n==24:
                req=req.replace('FF00 h','FF01 h（勘误）')
                for x,add in [('2310','device output side'),('5100','device hardware'),('5200','device hardware'),('7100','additional modules'),('8A00','monitoring'),('F004','additional functions')]:
                    if x in req:req+='（勘误补充：'+add+'）'
            if n==119 and rr[0] in ['1','2','9','10'] and rr[1]=='1':req=f'Bit {rr[0]}=1: '+{'1':'Touch probe 1 positive edge position stored','2':'Touch probe 1 negative edge position stored','9':'Touch probe 2 positive edge position stored','10':'Touch probe 2 negative edge position stored'}[rr[0]]+'（勘误）'
            dest.append(row(rid,sec,f'表{n}，PDF {p}',(obj+' ' if obj else '')+t['caption']+' / '+str(rr[0] or key),req,obj,behavior(n,sec,obj,rr)))
    coverage.append([f'表{n}',sec,t['caption'],','.join(map(str,sorted(set(t['pages'])))),'对象属性逐项' if dest is attribute_rows else '行为与位定义逐项',len(dest)-before])

# Outside-table text remains in source order; headings/table captions serve the source index.
section='';buf=[];p0=p1=0
def flush():
    global buf
    if not buf or not section:return
    text=clean(' '.join(buf));buf=[]
    if int(section.split('.')[0])<6:return
    if re.fullmatch(r'Table \d+\s*[–—-].+',text):return
    if re.fullmatch(re.escape(section)+r'\s+.+' ,text) and len(text)<len(tocmap.get(section,''))+len(section)+10:return
    obj='';m=re.search(r'Object ([0-9A-F]{4})',tocmap.get(section,''))
    if m:obj=m[1]
    if section=='6.2':
        m=re.search(r'\b(?:1000|1001|1018)\b',text)
        if m:obj=m[0]
    status,current,ref=base(section,obj)
    if section=='16.2.1':status='勘误已删除';current='2010勘误删除本条，不作为现行要求。'
    if section=='11.3.10':text=text.replace('Homing on index pulse','Homing on current position')+'（勘误：支持Homing模式时Method35必需）'
    if section in ['17.2','18.3','19.3'] and 'interpolation time period defines' in text.lower():status,current,ref=object_notes['60C2']
    if section=='17.2' and 'following error time out shall result' in text:status,current,ref=behavior(236,section,'',['13','1'])
    if section=='18.3' and 'velocity actual value is used as mandatory' in text:status,current,ref=object_notes['606C']
    if section=='19.3' and 'torque actual value is used as mandatory' in text:status,current,ref=object_notes['6077']
    if text.startswith('Figure '):current='按本图所属功能判断；箭头/曲线/空间关系以原PDF图为准。'+current
    body_rows.append(row(f'N{len(body_rows)+1:04}',section,f'正文PDF {p0}'+(f'–{p1}' if p1!=p0 else ''),tocmap.get(section,section),text,obj,(status,current,ref)))
for b in source['blocks']:
    for line in b['lines']:
        if re.fullmatch(r'(?:h\s*)+',line):continue
        if re.match(r'^Table \d+\s*[–—-]',line):flush();continue
        m=re.match(r'^(\d+(?:\.\d+){0,3})\s+([A-Z].*)',line)
        if m and m[1] in tocmap:
            flush();section=m[1];p0=p1=b['page'];buf=[line];continue
        if not section:continue
        if line.startswith(('Table ','Figure ','•','NOTE','LEGEND')) and buf:flush()
        if not buf:p0=b['page']
        buf.append(line);p1=b['page']
        if (line.endswith('.') or line.endswith(':')) and len(' '.join(buf))>100:flush()
        if len(' '.join(buf))>900:flush()
flush()

# Every corrigendum instruction is retained, assigned to its original clause, and assessed.
corrtext=' '.join(clean(p.extract_text()) for p in pdf.pages[132:140])
corrtext=re.sub(r'! CiA 2010 – All rights reserved\d*\s*\d*','',corrtext)
for part in re.split(r'(?=Page\s+\d)',corrtext):
    m=re.match(r'Page\s+(\d+)(?:\s+to\s+(\d+))?[,.: ]*\s*(\d+\.\d+(?:\.\d+)?)?',part)
    if not m:continue
    sec=m[3] or ('11.3.10' if m[1]=='62' and '11.3.10' in part[:35] else '')
    obj='';om=re.search(r'Object ([0-9A-F]{4})',tocmap.get(sec,''))
    if om:obj=om[1]
    for instruction in re.split(r'(?=\b(?:Add|Replace|Delete|Indent)\s)',part):
        if not re.match(r'^(Add|Replace|Delete|Indent)\s',instruction):continue
        status,current,ref=base(sec,obj)
        if sec=='4.2':status='未占用新增保留索引';current='当前单轴注册字典未使用6050/6051、6200–62FF及6600–67EF保留索引；MAX_AXES=1。';ref=odref+'；cia402appl.h:335'
        if sec=='5.2':status='已纳入数据类型表';current='最高索引名称已按勘误修订为最高子索引。';ref='数据类型逐项'
        if sec=='16.2.1':status='删除条款';current='不作为本版有效功能要求。';ref='客户PDF139'
        corr_rows.append(row(f'C{len(corr_rows)+1:02}',sec,f'勘误；原正文PDF {m[1]}'+('–'+m[2] if m[2] else ''),m[0],clean(instruction),obj,(status,current,ref)))

for rid,sec,obj,req in [('C24-8613','7.1','','新增错误码8613h：Homing error'),('C119-N','11.5.6','60B9','60B8 bit0=0时60B9 bit1/2清0；60B8 bit8=0时bit9/10清0。'),('C159-0','13.4','','IP状态字bit13=0：No following error'),('C159-1','13.4','','IP状态字bit13=1：Following error')]:
    behavior_rows.append(row(rid,sec,'2010勘误PDF134/137/138',req,req,obj,base(sec,obj)))

# Bit-field figures must be actionable per bit, not an unreadable line of drawing labels.
control_names={0:'Switch on',1:'Enable voltage',2:'Quick stop',3:'Enable operation',4:'Operation mode specific',5:'Operation mode specific',6:'Operation mode specific',7:'Fault reset',8:'Halt',9:'Operation mode specific',10:'Reserved (0)',11:'Manufacturer-specific',12:'Manufacturer-specific',13:'Manufacturer-specific',14:'Manufacturer-specific',15:'Manufacturer-specific'}
status_names={0:'Ready to switch on',1:'Switched on',2:'Operation enabled',3:'Fault',4:'Voltage enabled',5:'Quick stop',6:'Switch on disabled',7:'Warning',8:'Manufacturer-specific',9:'Remote',10:'Target reached (mode-specific exceptions)',11:'Internal limit active',12:'Operation mode specific',13:'Operation mode specific',14:'Manufacturer-specific',15:'Manufacturer-specific'}
for bit,label in control_names.items():
    verdict=('命令译码已有','命令掩码及状态分支使用此位；相应执行动作另见表26/选项码。',smref)
    if bit==7:verdict=transitions[15]
    if bit==8:verdict=('未找到Halt执行','未见bit8进入实际停车/恢复逻辑；605D也未注册。按模式及勘误核对所需Halt功能。',smref+'；'+stopref)
    if bit in [4,5,6,9]:verdict=('当前模式无专用控制位','CSP/CSV/CST没有模式专用控制位；其他模式未声明。不可按PP/HM位义解释这些位。',moderef)
    if bit>=10:verdict=('未定义扩展功能','未见此位参与生产控制；保留位由主站按0发送，厂商位不要求必须实现。',smref)
    behavior_rows.append(row(f'F05-B{bit:02}','8.4.1','图5，PDF25–26；勘误134',f'6040 bit{bit}',label,'6040',verdict))
for bit,label in status_names.items():
    verdict=('状态编码已有','该位由状态码或软件状态标志生成；真实状态仍按FSA转换核对。',smref)
    if bit==3:verdict=('故障入口未接通','本地故障未见调用CiA402_LocalError，不能保证该位反映真实故障。',errref)
    if bit==4:verdict=('软件标志已有；硬件待核对','按bHighLevelPowerApplied置位，未见该位直接验证母线高压实际施加。','df-sdk/modules/ethercat/cia402appl.c:634–643')
    if bit==7:verdict=('部分警告已有','motor_enable失败置Warning；未见完整设备告警汇总到该位。','df-sdk/modules/ethercat/cia402appl.c:474–483')
    if bit==9:verdict=('固定报告Remote','循环末尾强制置Remote；正常远程控制可用，本地控制切换/忽略控制字时语义待核对。','df-sdk/modules/ethercat/cia402appl.c:646')
    if bit==10:verdict=('部分实现','仅找到Quick stop选项5–8完成时置位；其他模式到达/切换行为未见，CSP/CSV/CST该位为保留。','df-sdk/modules/ethercat/cia402appl.c:899')
    if bit==11:verdict=('存在差异风险','DummyMotionControl依据607D设置此位，实际命令入口仍走独立插补，需确认位与真实限制一致。','df-sdk/modules/ethercat/cia402appl.c:680–779,949–979')
    if bit==12:verdict=behavior(236,'17.3','',['12','1'])
    if bit==13:verdict=behavior(236,'17.3','',['13','1'])
    if bit in [8,14,15]:verdict=('未定义厂商位','未见这些厂商位的扩展含义；标准不要求一定实现。',smref)
    behavior_rows.append(row(f'F06-B{bit:02}','8.4.2','图6，PDF27；勘误134–135',f'6041 bit{bit}',label,'6041',verdict))
mode_bits={0:'pp',1:'vl',2:'pv',3:'tq',4:'Reserved',5:'hm',6:'ip',7:'csp',8:'csv',9:'cst'}
for bit in range(32):
    label=mode_bits.get(bit,'Reserved' if bit<16 else 'Manufacturer-specific')
    actual=1 if bit in [7,8,9] else 0
    verdict=('支持声明已有' if actual else '未声明该功能',f'组合PDO默认0x380，本位={actual}；专用CSP/CSV组合分别0x80/0x100。',object_notes['6502'][2])
    behavior_rows.append(row(f'F07-B{bit:02}','8.4.12','图7，PDF35',f'6502 bit{bit}',label+'；支持=1，不支持/保留=0','6502',verdict))
for bit in range(32):
    label={0:'Negative limit switch',1:'Positive limit switch',2:'Home switch',3:'Interlock'}.get(bit,'Reserved' if bit<16 else 'Manufacturer-specific')
    verdict=('已有物理输入通路',f'bit{bit}由相应负限位/正限位/原点物理信号更新；0=off，1=on。',object_notes['60FD'][2]) if bit<3 else ('当前固定为0','每周期从0构造60FD；本位没有实际信号来源。'+('保留位为0。' if bit<16 and bit>3 else ''),object_notes['60FD'][2])
    behavior_rows.append(row(f'F71-B{bit:02}','20.2','图71，PDF129',f'60FD bit{bit}',label,'60FD',verdict))
    label='Set brake' if bit==0 else ('Reserved' if bit<16 else 'Manufacturer-specific')
    behavior_rows.append(row(f'F72-B{bit:02}','20.3','图72，PDF129–130',f'60FE:01 bit{bit}',label,'60FE',object_notes['60FE']))

# Retain corrected-text precedence next to affected body paragraphs, not only in a remote note.
changed_sections={r[1] for r in corr_rows}
for r in body_rows:
    if r[1] in changed_sections and r[6]!='勘误已删除':r[4]+='【本条有2010勘误，新增/替换/删除内容见“勘误逐项”；勘误优先】'

# Full source-location inventory: table numbers, TOC clauses and figure captions.
for sec,title in tocmap.items():
    if int(sec.split('.')[0])<6:continue
    matches=[r for rows in [attribute_rows,behavior_rows,body_rows] for r in rows if r[1]==sec or r[1].startswith(sec+'.')]
    coverage.append(['条款'+sec,sec,title,'见逐项行页码','对象属性/行为/正文',len(matches)])
figure_sec='';figures={}
for b in source['blocks']:
    for line in b['lines']:
        m=re.match(r'^(\d+(?:\.\d+){0,3})\s+([A-Z].*)',line)
        if m and m[1] in tocmap:figure_sec=m[1]
        m=re.match(r'^Figure (\d+)\s*[–—-]\s*(.*)',line)
        if m:figures[int(m[1])]=(figure_sec,b['page'],m[2])
assert set(figures)==set(range(1,73)),set(range(1,73))-set(figures)
for n,(sec,p,title) in figures.items():
    cnt=sum(r[0].startswith(f'F{n:02}-') for r in behavior_rows)
    coverage.append([f'图{n}',sec,title,str(p),'行为与位定义逐项' if cnt else ('正文条款逐项；图形关系以原PDF为准' if int(sec.split('.')[0])>=6 else '初审总览背景'),cnt or '按图所属条款'])

coverage += [
['审查基线','PDF','CiA-402-2-version-3.0.0.pdf；V3.0正文及2010勘误','1–140','SHA256',hashlib.sha256((root/'CiA-402-2-version-3.0.0.pdf').read_bytes()).hexdigest()],
['审查基线','源码','dfs-10a HEAD','2026-09-17','Git',subprocess.check_output(['git','-C',str(root/'dfs-10a'),'rev-parse','HEAD'],text=True).strip()],
['审查基线','源码','df-sdk HEAD；本次未修改驱动器源码','2026-09-17','Git',subprocess.check_output(['git','-C',str(root/'dfs-10a/df-sdk'),'rev-parse','HEAD'],text=True).strip()],
['判定边界','代码路径','新表代码路径均相对dfs-10a；部分后续文件沿用前缀','本次静态审查','声明/代码/实机分开','未编译、烧录或进行实机测试'],
['判定边界','引用标准','客户Part 2引用CiA301和Part 3时保留引用，不假造未提供的条款','源表对应行','缺少引用全文的结论保持待核对','有对象不等于行为符合'],
['判定边界','可选范围','60C1:02–FE、60A4:02–06按源表范围逐项展开；可选子项不要求全部实现','表100/164','缺失不自动判违规','由实际支持个数及父对象适用条件决定'],
]

behavior_rows.sort(key=lambda r:tuple(map(int,r[1].split('.'))))
result=dict(attributes=attribute_rows,behaviors=behavior_rows,narrative=body_rows,corrigendum=corr_rows,coverage=coverage,code=code,toc=tocmap)
(cache/'full-detail-data.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print({k:len(v) for k,v in result.items()})
