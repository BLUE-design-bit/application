"""Prepare chapter 5 only: all 11 types and 13 record fields from customer PDF.

Implementation judgments are static code findings, not runtime certification.
"""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
cache=root/'.cache/cia402-detail'
data=json.loads((cache/'standard-extracted.json').read_text(encoding='utf-8'))
clean=lambda s: re.sub(r'\s+',' ',s or '').strip()
tablemap={t['number']:dict(t,rows=[(t['page'],r) for r in t['rows']]) for t in data['tables'] if t['number']<=4}
assert set(tablemap)=={1,2,3,4}
type_assess=[
('已有类型处理','UINT8=uint8_t；SDO读/写有Unsigned8分支；1001、60C2:01已使用。','类型处理存在。每个对象的单位、范围及字节打包仍需按其对象要求核对。','ethercat/objdef.h:64；ecat_def.h:436；objdef.c:1057,1504'),
('已有类型处理','UINT16=uint16_t；6040/6041为Unsigned16、16bit。','类型处理存在；不据此宣布全部16位对象符合。','ethercat/objdef.h:65；ecat_def.h:442；cia402appl.h:837,843'),
('已有类型处理','UINT32=uint32_t；6085、6502等声明Unsigned32、32bit。','类型处理存在；功能/范围见各对象。','ethercat/objdef.h:67；ecat_def.h:448；cia402appl.h:960'),
('已有类型处理','INT8=int8_t；6060/6061及60C2:02有Integer8描述。','符号与8bit声明已具备；负数和边界读写尚未实测。','ethercat/objdef.h:57；ecat_def.h:466；cia402appl.h:873,879,973'),
('已有类型处理','INT16=int16_t；605A/B/C/E、6071/6077有Integer16描述。','类型处理存在；转矩的千分比单位是独立要求。','ethercat/objdef.h:58；ecat_def.h:472；objdef.c:1097,1547'),
('已有类型处理','INT32=int32_t；6064/606C/607A/60FF有Integer32描述。','类型处理存在；位置/速度单位换算和限幅须另查。','ethercat/objdef.h:60；ecat_def.h:478；objdef.c:1113,1628'),
('已有类型处理','DEFTYPE_VISIBLESTRING；通用SDO有字符串复制分支；1008/1009/100A已使用。','6403/6404/6405/6503/6505本身未注册；有字符串能力不等于有这些信息对象。','ethercat/objdef.h:69；objdef.c:1170,1670；coeappl.c:190,209,228,499–503'),
('仅有类型编号','有DEFTYPE_TIME_OF_DAY=0x000C；通用读写switch未见此分支；6406未注册。','未见可工作的Time of day对象或专用回调。不能把宏定义算作类型已支持。','ethercat/objdef.h:72；objdef.c:1189–1191,1699–1701；cia402appl.h:1673–1745'),
('已有记录结构','60C2对应TOBJ60C2；子项结构为U8/U8/I8。','记录结构具备；周期参数是否真正生效见第13/17–19章。','ethercat/cia402appl.h:442–448,970–976,1733'),
('未找到记录实现','未见60C4或该记录结构注册到实际轴字典。','缺最大/实际缓冲区、组织方式、位置、记录长度和清除字段。','ethercat/cia402appl.h:1673–1745'),
('未找到记录实现','未见6048/6049/604A及对应记录结构注册。','缺vl加减速/急停参数记录；当前也未声明vl模式。','ethercat/cia402appl.h:1673–1745；ecat_common.c:233–244'),
]
type_rows=[]
for i,(page,r) in enumerate(tablemap[1]['rows'][1:]):
    status,current,gap,ref=type_assess[i]
    explain=['8位无符号整数','16位无符号整数','32位无符号整数','8位有符号整数','16位有符号整数','32位有符号整数','可见字符串','日期/时间类型','插补时间周期记录，0080h','插补数据配置记录，0081h','vl速度加减速记录，0082h'][i]
    type_rows.append([f'T01-{i+1:02}','5.1',f'表1，p{page}',r[0],explain+'；'+r[1],status,current,gap,ref,'未核对',''])
for num,objectid in [(2,'60C2'),(3,'60C4'),(4,'6048/6049/604A')]:
    for i,(page,r) in enumerate(tablemap[num]['rows'][1:]):
        idx={2:'0080h',3:'0081h',4:'0082h'}[num];sub=clean(r[1]).replace(' ','');desc=r[2].replace('Highest index supported','Highest sub-index supported')
        expect=f'{desc}；{r[3]}；记录类型{idx}，子索引{sub}'
        if num==2:
            current=['内部u16SubIndex0；对外描述Unsigned8、8bit，默认2。','UINT8 u8InterpolationPeriod；Unsigned8、8bit，默认1。','INT8 i8InterpolationIndex；Integer8、8bit，默认-3。'][i]
            status='字段结构一致';gap='子项00按勘误改称Highest sub-index supported；内部16位存储不是对外16位。' if i==0 else '本行仅确认字段类型；运行期生效、允许值和访问规则在60C2条款另查。';ref='ethercat/cia402appl.h:442–448,970–973,1209'
        else:status='未找到记录字段';current=f'实际轴字典未注册{objectid}。';gap='本字段保留为缺项；不因可选对象或未声明模式的缺失直接判违规。';ref='ethercat/cia402appl.h:1673–1745'
        type_rows.append([f'T{num:02}-{i:02}','5.2',f'表{num}，p{page}'+('；勘误PDF133' if i==0 else ''),f'{objectid}:{sub}',expect,status,current,gap,ref,'未核对',''])
assert len(type_rows)==24
(cache/'detail-data.json').write_text(json.dumps({'types':type_rows},ensure_ascii=False,indent=2),encoding='utf-8')
print('Chapter 5: 11 types + 13 record fields = 24 checks')
