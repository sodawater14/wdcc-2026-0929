"""Generate the demo's content and resized images from the original Markdown/PNG."""
import html
import json
import re
import shutil
from summary_structure import enrich
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = next((p for p in [ROOT.parent / '9.29网站内容文档', ROOT.parent / '9.29' / '9.29网站内容文档'] if p.is_dir()), ROOT.parent / '9.29网站内容文档')
ENABLED = set(range(1, 16))
Image.MAX_IMAGE_PIXELS = None

REPAIRED = ROOT.parent / 'WDCC_9.29_15场报告_录音修复版.md'
AUDIO_SOURCE = Path(r'F:\AI-Projects\LLM-Wiki\raw\WDCC 2026\9.29\录音')
AUDIO_MAP = {**{n:n for n in range(1,10)}, **{n:n+1 for n in range(10,15)}, 15:10}

def repaired_transcripts():
    text = REPAIRED.read_text(encoding='utf-8')
    parts = re.split(r'^## (\d{2})｜[^\n]+\n', text, flags=re.M)[1:]
    result = {}
    for number, content in zip(parts[::2], parts[1::2]):
        content = re.split(r'^---\s*$|^## 核对提示', content, maxsplit=1, flags=re.M)[0]
        lines = content.strip().splitlines()
        assert lines[0].startswith('原始录音：') and lines[1].startswith('Figma 转录：')
        result[int(number)] = '\n'.join(lines[2:]).strip()
    assert set(result) == set(range(1,16)), 'Expected 15 repaired transcripts'
    return result

def audio_file(number):
    matches = list(AUDIO_SOURCE.glob(f'{AUDIO_MAP[number]}、*.m4a'))
    assert len(matches) == 1, (number, 'Expected one matching recording')
    return matches[0]

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
    repaired = repaired_transcripts()
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
            enrich(personal)
            with ThreadPoolExecutor(max_workers=4) as pool:
                gallery = list(pool.map(lambda p: convert(p, ROOT / f'assets/reports/{n:02d}/{p.stem}.webp', 2400, 91), images))
            audio_src = audio_file(n)
            audio_dest = ROOT / f'assets/audio/{n:02d}.m4a'
            audio_dest.parent.mkdir(parents=True, exist_ok=True)
            if not audio_dest.exists() or audio_dest.stat().st_size != audio_src.stat().st_size:
                shutil.copy2(audio_src, audio_dest)
            detail = {'id': n, 'title': meta['title'], 'speaker': meta['speaker'],
                      'transcript': markdown(repaired[AUDIO_MAP[n]]),
                      'audio': {'src': audio_dest.relative_to(ROOT).as_posix(), 'type': 'audio/mp4'},
                      'personalSummary': personal,
                      'images': gallery}
            (data_dir / f'{n:02d}.json').write_text(json.dumps(detail, ensure_ascii=False), encoding='utf-8', newline='\n')
            print(f'Report {n:02d}: {len(images)} images ready.', flush=True)
        manifest.append(report)
    assert len(manifest) == 15
    (data_dir / 'reports.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8', newline='\n')
    backend_dir = ROOT / 'backend'
    backend_dir.mkdir(exist_ok=True)
    (backend_dir / 'reports.json').write_text(json.dumps([{k: r[k] for k in ['id', 'title', 'speaker']} for r in manifest], ensure_ascii=False, indent=2), encoding='utf-8', newline='\n')
    print(f'Generated {len(manifest)} covers and {len(ENABLED)} full reports ({sum(r["imageCount"] for r in manifest if r["enabled"])} images).')

if __name__ == '__main__':
    build()
