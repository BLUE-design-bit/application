"""Extract the customer PDF's tables and clause text, retaining page/table provenance."""
from pathlib import Path
import json,re
import pdfplumber
root=Path(__file__).resolve().parents[1]
out=root/'.cache/cia402-detail'
out.mkdir(parents=True,exist_ok=True)
clean=lambda x: re.sub(r'\s+',' ',x or '').strip()
tables=[]; blocks=[]; section=''; title=''; obj=''; lasttable=None
with pdfplumber.open(root/'CiA-402-2-version-3.0.0.pdf') as pdf:
    toc=' '.join(p.extract_text() or '' for p in pdf.pages[2:7])
    valid_sections=set(re.findall(r'(?:^|\s)([1-9]\d?(?:\.\d+){0,3})\s+[A-Z]',toc))
    for page in pdf.pages[7:130]:
        n=page.page_number
        lines=page.extract_text_lines()
        page_tables=page.find_tables()
        events=[]
        for line in lines:
            if not 65 < line['top'] < 790: continue
            s=clean(line['text'])
            if re.match(r'^\d+(?:\.\d+){0,3}\s+[A-Z]',s):
                m=re.match(r'^(\d+(?:\.\d+){0,3})\s+(.+)',s)
                in_table=any(t.bbox[1]-2<=line['top']<t.bbox[3] for t in page_tables)
                if m[1] in valid_sections and not in_table: events.append((line['top'],'section',m.groups()))
            m=re.match(r'^Table\s+(\d+)\s*[–—-]\s*(.*)',s)
            if m: events.append((line['top'],'caption',(int(m[1]),m[2])))
        boxes=[]
        for t in page_tables: events.append((t.bbox[1],'table',t))
        caption=None
        for y,kind,value in sorted(events,key=lambda v:v[0]):
            if kind=='section':
                section,title=value
                m=re.search(r'Object\s+([0-9A-F]{4})\s*(?:h)?\s*:',title)
                obj=m[1] if m else ('1000' if section=='6.2' else '')
            elif kind=='caption': caption=(y,*value)
            else:
                t=value
                if caption and 0<=y-caption[0]<65:
                    num,cap=caption[1:]
                elif y<125 and lasttable and n==lasttable['page']+1:
                    num,cap=lasttable['number'],lasttable['caption']
                else: continue
                rows=[[clean(c) if c is not None else None for c in row] for row in t.extract()]
                record=dict(page=n,section=section,title=title,object=obj,number=num,caption=cap,rows=rows)
                tables.append(record); lasttable=record; boxes.append(t.bbox); caption=None
        # Text outside ruled tables retains narrative and figure labels, in page order.
        body=[]
        for l in lines:
            if not 65<l['top']<790:continue
            if any(b[1]-2<=l['top'] and l['bottom']<=b[3]+2 and l['x0']>=b[0]-2 and l['x1']<=b[2]+2 for b in boxes):continue
            body.append(clean(l['text']))
        blocks.append(dict(page=n,lines=body))
data=dict(tables=tables,blocks=blocks)
(out/'standard-extracted.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
nums=set(t['number'] for t in tables)
print('Table segments:',len(tables),'unique:',len(nums),'missing:',sorted(set(range(1,251))-nums))
print('Body lines:',sum(len(b['lines']) for b in blocks))
