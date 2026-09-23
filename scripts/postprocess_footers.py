"""Post-process footer per toc.md:
1. Petakan footerReference tiap section -> file footer XML via document.xml.rels
2. Section front-matter (footer pertama) -> PAGE \\* ROMAN \\* MERGEFORMAT
3. Section body (footer kedua)       -> PAGE \\* arabic \\* MERGEFORMAT
4. Hapus <w:pgNumType/> kosong (emisi docx-js yang membingungkan WPS)
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

DOCX = Path(sys.argv[1])
TMP = DOCX.with_suffix(".tmp.docx")

with zipfile.ZipFile(DOCX) as z:
    names = z.namelist()
    data = {n: z.read(n) for n in names}

doc_xml = data["word/document.xml"].decode("utf-8")
rels_xml = data["word/_rels/document.xml.rels"].decode("utf-8")

# Urutan kemunculan footerReference default di document.xml = urutan section
footer_ids = re.findall(
    r'<w:footerReference w:type="default" r:id="(rId\d+)"/>', doc_xml)
print("footerReference ids (urut section):", footer_ids)

rel_map = dict(re.findall(
    r'<Relationship Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels_xml))
print("rels map:", rel_map)

formats = ["ROMAN", "arabic"]  # footer pertama = front matter, kedua = body
seen = []
for i, rid in enumerate(footer_ids):
    target = rel_map.get(rid)
    if not target or target in seen:
        continue
    seen.append(target)
    fmt = formats[min(i, len(formats) - 1)]
    key = f"word/{target}"
    xml = data[key].decode("utf-8")
    xml2, n = re.subn(
        r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
        rf'\1 PAGE \\* {fmt} \\* MERGEFORMAT \2',
        xml)
    data[key] = xml2.encode("utf-8")
    print(f"{key}: {n} field PAGE dipatch -> {fmt}")

# Hapus pgNumType kosong (tanpa atribut)
doc_xml2, n_removed = re.subn(r'<w:pgNumType/>', "", doc_xml)
data["word/document.xml"] = doc_xml2.encode("utf-8")
print("pgNumType kosong dihapus:", n_removed)

with zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, data[n])
shutil.move(TMP, DOCX)
print("OK:", DOCX)
