"""Read-only checks: preserved initial workbook, complete table/type inventory, export fidelity."""
from pathlib import Path
from copy import copy
import json,re,collections,sys
from openpyxl import load_workbook
root=Path(__file__).resolve().parents[1]
out=root/'outputs/01a08f03-8e5c-79e3-bb07-33816e14789f'
full='--full' in sys.argv
before=load_workbook(out/('DFS10A_CiA402_V3_数据类型逐项核对_v2.xlsx' if full else 'DFS10A_CiA402_V3_模块覆盖初审.xlsx'))
after=load_workbook(out/('DFS10A_CiA402_V3_全章节逐项核对_v3.xlsx' if full else 'DFS10A_CiA402_V3_数据类型逐项核对_v2.xlsx'))
data=json.loads((root/'.cache/cia402-detail'/('full-detail-data.json' if full else 'detail-data.json')).read_text(encoding='utf-8'))
assert after.sheetnames[:len(before.sheetnames)]==before.sheetnames
for old in before:
    new=after[old.title]
    assert (new.max_row,new.max_column)==(old.max_row,old.max_column)
    for row in old:
        for c in row:
            x=new[c.coordinate]
            assert c.value==x.value,(old.title,c.coordinate,'value')
            for attr in ['font','fill','alignment','border','protection']:
                assert copy(getattr(c,attr))==copy(getattr(x,attr)),(old.title,c.coordinate,attr)
            assert c.number_format==x.number_format
    assert old.freeze_panes==new.freeze_panes
    assert list(old.tables)==list(new.tables)
    for col,dim in old.column_dimensions.items():assert dim.width==new.column_dimensions[col].width
    for row,dim in old.row_dimensions.items():assert dim.height==new.row_dimensions[row].height
    assert len(old.conditional_formatting)==len(new.conditional_formatting)
    assert old.data_validations==new.data_validations
names={'attributes':'对象属性逐项','behaviors':'行为与位定义逐项','narrative':'正文条款逐项','corrigendum':'勘误逐项','coverage':'来源覆盖索引'} if full else {'types':'数据类型逐项'}
assert len(after.sheetnames)==(9 if full else 4)
for key,name in names.items():
    sh=after[name];rows=data[key]
    assert sh.max_row==len(rows)+6
    for i,expected in enumerate(rows,7):
        for j,value in enumerate(expected,1):
            actual=sh.cell(i,j).value
            assert actual==(None if value=='' else value),(name,i,j,actual,value)
    assert sh.freeze_panes=='C7' and len(sh.tables)==1
    assert not any(c.data_type=='e' for row in sh for c in row)
    assert max(d.height or 0 for d in sh.row_dimensions.values())<=409
    if key!='coverage':
        assert len(sh.data_validations.dataValidation)==1
        checkcol=10
        assert all(sh.cell(r,checkcol).value=='未核对' for r in range(7,sh.max_row+1))
if full:
    ids=[r[0] for k in ['attributes','behaviors','narrative','corrigendum'] for r in data[k]]
    assert len(ids)==len(set(ids))
    assert [r[0] for r in data['coverage'][:250]]==[f'表{i}' for i in range(1,251)]
    assert {r[0] for r in data['coverage'] if r[0].startswith('图')}=={f'图{i}' for i in range(1,73)}
    expected_sections={s for s in data['toc'] if int(s.split('.')[0])>=6}
    assert {r[1] for r in data['coverage'] if r[0].startswith('条款')}==expected_sections
    assert all(r[5]>0 for r in data['coverage'] if r[0].startswith('条款'))
    counts=collections.Counter(int(m[1]) for k in ['attributes','behaviors'] for r in data[k] if (m:=re.match(r'T(\d+)-',r[0])))
    for r in data['coverage'][4:250]:assert counts[int(r[0][1:])]==r[5],r
    assert len(data['corrigendum'])==73
    for obj,n in [('60A4',6),('60C1',254)]:
        subs={r[3].split(':')[1].split(' ')[0] for r in data['attributes'] if r[3].startswith(obj+':') and r[3].endswith('子索引')}
        assert subs=={f'{x:02X}' for x in range(n+1)},(obj,subs)
    assert sum(r[0].startswith('T025-') for r in data['behaviors'])==40
    assert sum(r[0].startswith('F') for r in data['behaviors'])==128
    assert next(r for r in data['attributes'] if r[0]=='T005-P011-R03')[6]!='明确不一致'
    assert any(r[1]=='8.4.1' and 'Bits 9, 6, 5' in r[4] for r in data['narrative'])
    assert any(r[1]=='8.4.2' and 'If bit 4' in r[4] for r in data['narrative'])
    print('PASS: 4 accepted sheets preserved including styles and validations; 250 tables, 194 clauses, 72 figures, 73 corrigendum instructions; 128 explicit bit checks; full range expansion; export fidelity; no error cells.')
    print({k:len(data[k]) for k in names})
else:
    assert len(data['types'])==24
    assert [sum(r[0].startswith('T'+str(i).zfill(2)+'-') for r in data['types']) for i in range(1,5)]==[11,3,7,3]
    print('PASS: 3 original sheets preserved including styles; chapter 5 all 24 checks; export fidelity; dropdowns; no error cells.')
