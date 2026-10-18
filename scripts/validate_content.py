"""Check that every source report, text section and ordered image is delivered."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = next((p for p in [ROOT.parent / '9.29网站内容文档', ROOT.parent / '9.29' / '9.29网站内容文档'] if p.is_dir()), ROOT.parent / '9.29网站内容文档')

class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, data):
        self.parts.append(data)

def plain_html(value):
    parser = Text()
    parser.feed(value)
    return ''.join(parser.parts)

def normalize(value):
    return re.sub(r'\s+', '', value)

manifest = json.loads((ROOT / 'data/reports.json').read_text(encoding='utf-8'))
assert len(list(SOURCE.glob('*.md'))) == 15, 'Expected 15 source Markdown reports'
assert len(manifest) == 15 and all(report['enabled'] for report in manifest)
total = 0
for report, source in zip(manifest, sorted(SOURCE.glob('*.md'))):
    n = report['id']
    text = source.read_text(encoding='utf-8')
    parts = re.split(r'^## (.+)\n', text, flags=re.M)[1:]
    sections = dict(zip(parts[::2], parts[1::2]))
    data = json.loads((ROOT / f'data/{n:02d}.json').read_text(encoding='utf-8'))
    assert len(data['images']) == report['imageCount']
    assert len(data['personalSummary']) == 4
    assert data['title'] == report['title']
    fields = [('AI转录原文', data['transcript']), ('AI总结', data['aiSummary']),
              ('综合提炼总结', ''.join(s['title'] + s['html'] for s in data['personalSummary']))]
    for name, rendered in fields:
        original = re.sub(r'^(?:#{1,6}\s+|[-•]\s+|\d+\.\s+)', '', sections[name], flags=re.M).replace('**', '')
        assert normalize(original) == normalize(plain_html(rendered)), (n, name, 'text differs')
    for i, image in enumerate(data['images'], 1):
        file = ROOT / image['src']
        assert file.stem == f'{i:03d}' and file.exists()
        with Image.open(file) as im:
            assert im.size == (image['width'], image['height'])
            im.verify()
    total += len(data['images'])
assert total == 390
print('PASS: all 15 reports; 45 text sections match source Markdown; 390 ordered, valid images.')
