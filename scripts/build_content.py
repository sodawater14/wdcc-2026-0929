"""Generate the demo's content and resized images from the original Markdown/PNG."""
import html
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = next((p for p in [ROOT.parent / '9.29网站内容文档', ROOT.parent / '9.29' / '9.29网站内容文档'] if p.is_dir()), ROOT.parent / '9.29网站内容文档')
ENABLED = set(range(1, 16))
Image.MAX_IMAGE_PIXELS = None

def inline(text):
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html.escape(text))

def markdown(text):
    blocks = []
    list_type = None
    for raw in re.split(r'\n\s*\n', text.strip()):
        line = raw.strip()
        match = re.match(r'^(#{3,4}) (.+)$', line)
        bullet = re.match(r'^[-•] (.*)$', line, re.S)
        number = re.match(r'^\d+\. (.*)$', line, re.S)
        current = 'ul' if bullet else 'ol' if number else None
        if list_type != current and list_type:
            blocks.append(f'</{list_type}>')
            list_type = None
        if current:
            if not list_type:
                blocks.append(f'<{current}>')
                list_type = current
            blocks.append('<li>' + inline((bullet or number).group(1).replace('\n', ' ')) + '</li>')
        elif match:
            level = len(match.group(1))
            blocks.append(f'<h{level}>' + inline(match.group(2)) + f'</h{level}>')
        elif line:
            blocks.append('<p>' + inline(line.replace('\n', ' ')) + '</p>')
    if list_type:
        blocks.append(f'</{list_type}>')
    return '\n'.join(blocks)

def convert(source, destination, longest, quality):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_mtime >= source.stat().st_mtime:
        with Image.open(destination) as existing:
            return {'src': destination.relative_to(ROOT).as_posix(), 'width': existing.width, 'height': existing.height}
    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original).convert('RGB')
        im.thumbnail((longest, longest), Image.Resampling.LANCZOS)
        if not destination.exists() or destination.stat().st_mtime < source.stat().st_mtime:
            im.save(destination, 'WEBP', quality=quality, method=6)
        return {'src': destination.relative_to(ROOT).as_posix(), 'width': im.width, 'height': im.height}

def build():
    assert len(list(SOURCE.glob('*.md'))) == 15, 'Expected 15 source Markdown reports'
    manifest = []
    data_dir = ROOT / 'data'
    data_dir.mkdir(exist_ok=True)
    for path in sorted(SOURCE.glob('*.md')):
        text = path.read_text(encoding='utf-8')
        front = text.split('---', 2)[1]
        meta = {}
        for line in front.strip().splitlines():
            key, value = line.split(': ', 1)
            meta[key] = json.loads(value)
        n = int(meta['id'].rsplit('-', 1)[1])
        images_dir = SOURCE / meta['image_directory']
        images = sorted(images_dir.glob('*.png'))
        assert len(images) == meta['image_count']
        cover = convert(images[0], ROOT / f'assets/covers/{n:02d}.webp', 800, 88)
        report = {'id': n, 'code': f'T{n:02d}', 'title': meta['title'], 'speaker': meta['speaker'],
                  'time': meta['time'], 'enabled': n in ENABLED, 'cover': cover, 'imageCount': len(images)}
        if n in ENABLED:
            sections = dict(zip(*[iter(re.split(r'^## (.+)\n', text, flags=re.M)[1:])]*2))
            personal = []
            parts = re.split(r'^### (.+)\n', sections['综合提炼总结'], flags=re.M)[1:]
            for title, content in zip(parts[::2], parts[1::2]):
                personal.append({'title': title, 'html': markdown(content)})
            with ThreadPoolExecutor(max_workers=4) as pool:
                gallery = list(pool.map(lambda p: convert(p, ROOT / f'assets/reports/{n:02d}/{p.stem}.webp', 2400, 91), images))
            detail = {'id': n, 'title': meta['title'], 'speaker': meta['speaker'],
                      'transcript': markdown(sections['AI转录原文']), 'aiSummary': markdown(sections['AI总结']),
                      'personalSummary': personal,
                      'images': gallery}
            (data_dir / f'{n:02d}.json').write_text(json.dumps(detail, ensure_ascii=False), encoding='utf-8')
            print(f'Report {n:02d}: {len(images)} images ready.', flush=True)
        manifest.append(report)
    assert len(manifest) == 15
    (data_dir / 'reports.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Generated {len(manifest)} covers and {len(ENABLED)} full reports ({sum(r["imageCount"] for r in manifest if r["enabled"])} images).')

if __name__ == '__main__':
    build()
