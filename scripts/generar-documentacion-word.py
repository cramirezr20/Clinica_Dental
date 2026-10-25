from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED
import re

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'DentalGest - Documentacion inicial.docx'
parts = []

def paragraph(text='', style='Normal', page=False):
    props = f'<w:pStyle w:val="{style}"/>'
    if page:
        props += '<w:pageBreakBefore/>'
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    parts.append(f'<w:p><w:pPr>{props}</w:pPr><w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')

paragraph('DentalGest: Documentación inicial', 'Title')
paragraph('Sistema de gestión de consultorio dental', 'Center')
paragraph('Documentación del proyecto', 'Center')
paragraph('25 de octubre de 2026', 'Center')
paragraph('Este documento reúne la documentación existente del proyecto. Los resultados de verificación corresponden a los reportes originales y no constituyen una nueva ejecución de pruebas.')

sources = [
    ('README.md', 'Presentación, instalación y configuración'),
    ('docs/ANALISIS.md', 'Análisis del sistema'),
    ('docs/MANUAL-USUARIO.md', 'Manual de usuario'),
    ('docs/VERIFICACION.md', 'Verificación técnica documentada'),
    ('docs/VERIFICACION-NAVEGADOR.md', 'Verificación de navegador documentada'),
]
for source, title in sources:
    paragraph(title, 'Heading1', page=True)
    lines = (ROOT / source).read_text(encoding='utf-8-sig').splitlines()
    in_code = False
    table_headers = None
    pending = []
    def flush():
        if pending:
            paragraph(' '.join(pending))
            pending.clear()
    for line in lines:
        line = line.strip()
        if line.startswith('```'):
            flush()
            in_code = not in_code
            continue
        if in_code:
            paragraph(line, 'Code')
            continue
        if not line:
            flush()
            table_headers = None
            continue
        if line.startswith('#'):
            flush()
            level = len(line) - len(line.lstrip('#'))
            if level > 1:
                paragraph(line.lstrip('#').strip(), 'Heading2' if level == 2 else 'Heading3')
            continue
        if line.startswith('|'):
            flush()
            cells = [c.strip() for c in line.strip('|').split('|')]
            if all(re.fullmatch(r':?-+:?', c) for c in cells):
                continue
            if table_headers is None:
                table_headers = cells
            else:
                paragraph('; '.join(f'{h}: {c}' for h, c in zip(table_headers, cells)))
            continue
        if re.match(r'^([-*] |\d+\. )', line):
            flush()
            paragraph(line[2:] if line.startswith(('- ', '* ')) else line)
        else:
            pending.append(line)
    flush()

paragraph('Archivos fuente del documento', 'Heading1', page=True)
for source, _ in sources:
    paragraph(source)
paragraph('Los diagramas UML se encuentran en docs/uml/index.html y sus archivos SVG y PlantUML. Este documento conserva su descripción textual. Las cuentas de demostración se consultan en USUARIOS-DE-PRUEBA.md.')

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
styles = f'''<w:styles xmlns:w="{W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:color w:val="000000"/><w:sz w:val="24"/><w:lang w:val="es-GT"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="480" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:ind w:firstLine="720"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Center"><w:name w:val="Centrado"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:ind w:firstLine="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Título"/><w:basedOn w:val="Center"/><w:pPr><w:spacing w:before="1440" w:after="0"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Título 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:jc w:val="center"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Título 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:ind w:firstLine="0"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Título 3"/><w:basedOn w:val="Heading2"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Comando"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/></w:pPr></w:style></w:styles>'''
document = f'''<w:document xmlns:w="{W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>{''.join(parts)}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr></w:body></w:document>'''
header = f'<w:hdr xmlns:w="{W}"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:hdr>'
content_types = '''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>'''
rels_ns = 'http://schemas.openxmlformats.org/package/2006/relationships'
office_rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
files = {
    '[Content_Types].xml': content_types,
    '_rels/.rels': f'<Relationships xmlns="{rels_ns}"><Relationship Id="rId1" Type="{office_rel}/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': document,
    'word/styles.xml': styles,
    'word/header1.xml': header,
    'word/_rels/document.xml.rels': f'<Relationships xmlns="{rels_ns}"><Relationship Id="rId1" Type="{office_rel}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="{office_rel}/header" Target="header1.xml"/></Relationships>',
}
with ZipFile(OUT, 'w', ZIP_DEFLATED) as archive:
    for name, data in files.items():
        archive.writestr(name, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + data)
print(OUT)
print(f'Párrafos: {len(parts)}')
