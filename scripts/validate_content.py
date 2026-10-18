"""Check that every source report, text section and ordered image is delivered."""
import json
import hashlib
from build_content import repaired_transcripts, audio_file, AUDIO_MAP
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
repaired = repaired_transcripts()
total = 0
source_item_total = 0
for report, source in zip(manifest, sorted(SOURCE.glob('*.md'))):
    n = report['id']
    text = source.read_text(encoding='utf-8')
    parts = re.split(r'^## (.+)\n', text, flags=re.M)[1:]
    sections = dict(zip(parts[::2], parts[1::2]))
    data = json.loads((ROOT / f'data/{n:02d}.json').read_text(encoding='utf-8'))
    assert len(data['images']) == report['imageCount']
    assert len(data['personalSummary']) == 4
    assert data['title'] == report['title']
    assert 'aiSummary' not in data
    assert normalize(repaired[AUDIO_MAP[n]]) == normalize(plain_html(data['transcript'])), (n, 'repaired transcript differs')
    audio = ROOT / data['audio'].get('originalSrc', data['audio']['src'])
    assert audio.name == f'{n:02d}.m4a' and data['audio']['type'] == 'audio/mp4'
    assert hashlib.sha256(audio.read_bytes()).digest() == hashlib.sha256(audio_file(n).read_bytes()).digest(), (n, 'audio mismatch')
    def reconstruct(items):
        return ''.join(item['title'] + plain_html(item['bodyHtml']) + reconstruct(item.get('children', [])) for item in items)
    def source_count(items):
        return sum(item['sourceItemCount'] + source_count(item.get('children', [])) for item in items)
    def check_bodies(items):
        for item in items:
            assert item['title'].strip() and (plain_html(item['bodyHtml']).strip() or item.get('children')), (n, 'empty disclosure')
            check_bodies(item.get('children', []))
    for section in data['personalSummary'][1:3]:
        items = section['items']
        assert normalize(reconstruct(items)) == normalize(plain_html(section['html'])), (n, 'structured text differs')
        count = len(re.findall('<li>', section['html']))
        assert source_count(items) == count
        source_item_total += count
        check_bodies(items)
    keywords = data['personalSummary'][3]
    assert normalize('；'.join(keywords['keywords'])) == normalize(plain_html(keywords['html'])), (n, 'keywords differ')
    if n == 12:
        group = next(i for i in data['personalSummary'][1]['items'] if i['title'] == '三项设计能力：')
        assert len(group['children']) == 3 and all(i['sourceItemCount'] == 0 for i in group['children'])
    if n == 15:
        group = next(i for i in data['personalSummary'][1]['items'] if i['title'] == '人机分工随阶段变化：')
        assert len(group['children']) == 3 and all(i['sourceItemCount'] == 1 for i in group['children'])
    fields = [('综合提炼总结', ''.join(s['title'] + s['html'] for s in data['personalSummary']))]
    for name, rendered in fields:
        original = re.sub(r'^(?:#{1,6}\s+|[-•]\s+|\d+\.\s+)', '', sections[name], flags=re.M).replace('**', '')
        assert normalize(original) == normalize(plain_html(rendered)), (n, name, 'text differs')
    for i, image in enumerate(data['images'], 1):
        file = ROOT / image['src']
        original = ROOT / image.get('originalSrc', image['src'])
        assert original.stem == f'{i:03d}' and original.exists() and file.exists()
        with Image.open(file) as im:
            assert im.size == (image['width'], image['height'])
            im.verify()
        if image.get('preview'):
            with Image.open(ROOT / image['preview']['src']) as preview:
                assert max(preview.size) <= 640
                preview.verify()
    total += len(data['images'])
assert total == 390
assert source_item_total == 166
print('PASS: all 15 reports; 15 repaired transcripts and 15 personal summaries match source; 15 recordings match originals; 390 ordered, valid images; all 166 original list items preserved in disclosures, including T12/T15 groups.')
