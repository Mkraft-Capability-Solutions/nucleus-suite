"""Minimal stdlib xlsx reader: dumps every sheet of every workbook to JSON (list of rows)."""
import zipfile, re, json, sys, os, glob
import xml.etree.ElementTree as ET
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def col_idx(ref):
    letters = re.match(r'[A-Z]+', ref).group()
    n = 0
    for ch in letters: n = n*26 + (ord(ch)-64)
    return n-1
def read_book(path):
    z = zipfile.ZipFile(path)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall('m:si', NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    relmap = {r.get('Id'): r.get('Target') for r in rels}
    out = {}
    for s in wb.find('m:sheets', NS):
        name = s.get('name'); rid = s.get('{%s}id' % NS['r'])
        target = relmap[rid].lstrip('/')
        if not target.startswith('xl/'): target = 'xl/' + target
        root = ET.fromstring(z.read(target))
        rows = []
        for row in root.iter('{%s}row' % NS['m']):
            vals = {}
            for c in row.findall('m:c', NS):
                t = c.get('t'); v = c.find('m:v', NS); val = None
                if t == 's' and v is not None: val = ss[int(v.text)]
                elif t == 'inlineStr':
                    val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                elif v is not None: val = v.text
                if val not in (None, ''): vals[col_idx(c.get('r'))] = val
            if vals:
                width = max(vals) + 1
                rows.append([vals.get(i, '') for i in range(width)])
        out[name] = rows
    return out
if __name__ == '__main__':
  src, dst = sys.argv[1], sys.argv[2]
  for f in sorted(glob.glob(os.path.join(src, '*.xlsx'))):
    data = read_book(f)
    base = os.path.splitext(os.path.basename(f))[0].replace(' ', '_')
    json.dump(data, open(os.path.join(dst, base + '.json'), 'w'), ensure_ascii=False)
    print(f"{base}: " + ", ".join(f"{k}={len(v)}" for k, v in data.items()))
