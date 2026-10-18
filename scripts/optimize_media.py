"""Build readable 1920px WebP, tiny previews and fast-start AAC speech copies.

Original PNG/WebP/M4A assets are never changed. Requires Pillow and PyAV.
"""
import hashlib
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageOps
from media_profile import apply_media

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, os.environ.get('AV_PACKAGES', str(ROOT.parent / '_929_transcript_repair/packages')))
import av
from build_content import SOURCE


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def image(source, folder, longest, quality):
    folder.mkdir(parents=True, exist_ok=True)
    temp = folder / (source.stem + '.tmp.webp')
    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original).convert('RGB')
        im.thumbnail((longest, longest), Image.Resampling.LANCZOS)
        im.save(temp, 'WEBP', quality=quality, method=5)
        width, height = im.size
    final = folder / f'{source.stem}.{digest(temp)[:12]}.webp'
    temp.replace(final)
    return {'src': final.relative_to(ROOT).as_posix(), 'width': width, 'height': height}


def audio(source, folder):
    folder.mkdir(parents=True, exist_ok=True)
    temp = folder / (source.stem + '.tmp.m4a')
    with av.open(str(source)) as original, av.open(str(temp), 'w', format='ipod', options={'movflags': '+faststart'}) as out:
        stream = out.add_stream('aac', rate=32000)
        stream.layout = 'mono'
        stream.bit_rate = 64000
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=32000)
        for frame in original.decode(audio=0):
            for converted in resampler.resample(frame):
                for packet in stream.encode(converted):
                    out.mux(packet)
        for converted in resampler.resample(None):
            for packet in stream.encode(converted):
                out.mux(packet)
        for packet in stream.encode(None):
            out.mux(packet)
    final = folder / f'{source.stem}.{digest(temp)[:12]}.m4a'
    temp.replace(final)
    with av.open(str(source)) as a, av.open(str(final)) as b:
        before, after = a.duration / av.time_base, b.duration / av.time_base
        assert abs(before-after) < .15, (source, 'duration differs')
    return {'src': final.relative_to(ROOT).as_posix(), 'duration': after}


def main():
    start = time.monotonic()
    path = ROOT / 'data/media-manifest.json'
    previous = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'bySource': {}}
    entries = previous['bySource']
    png_dirs = {}
    for md in SOURCE.glob('*.md'):
        front = dict(line.split(': ', 1) for line in md.read_text(encoding='utf-8').split('---', 2)[1].strip().splitlines())
        n = int(json.loads(front['id']).rsplit('-', 1)[1])
        png_dirs[n] = SOURCE / json.loads(front['image_directory'])
    jobs = []
    for report in sorted((ROOT / 'data').glob('[0-9][0-9].json')):
        detail = json.loads(report.read_text(encoding='utf-8'))
        n = detail['id']
        for item in detail['images']:
            original = item.get('originalSrc', item['src'])
            jobs.append(('image', original, png_dirs[n] / (Path(original).stem + '.png'), n))
        original = detail['audio'].get('originalSrc', detail['audio']['src'])
        jobs.append(('audio', original, ROOT / original, n))
    def convert(job):
        kind, original, source, n = job
        source_hash = digest(source)
        old = entries.get(original)
        if old and old.get('sourceHash') == source_hash and (ROOT / old['src']).exists():
            return original, old
        if kind == 'image':
            result = image(source, ROOT / f'assets/media/reports/{n:02d}', 1920, 85)
            result['preview'] = image(source, ROOT / f'assets/media/previews/{n:02d}', 640, 64)
        else:
            result = audio(source, ROOT / 'assets/media/audio')
            print(f'Audio {n:02d} optimized.', flush=True)
        result.update(sourceHash=source_hash, sourceBytes=(ROOT / original).stat().st_size)
        result['bytes'] = (ROOT / result['src']).stat().st_size
        return original, result
    with ThreadPoolExecutor(max_workers=4) as pool:
        converted = dict(pool.map(convert, jobs))
    manifest = {'profile': 'webp1920-q85-preview640-q64-aac64k-32khz-faststart-v1', 'bySource': converted}
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8', newline='\n')
    for report in sorted((ROOT / 'data').glob('[0-9][0-9].json')):
        detail = apply_media(json.loads(report.read_text(encoding='utf-8')), manifest)
        report.write_text(json.dumps(detail, ensure_ascii=False), encoding='utf-8', newline='\n')
    before = sum(v['sourceBytes'] for v in converted.values())
    after = sum(v['bytes'] + ((ROOT/v['preview']['src']).stat().st_size if 'preview' in v else 0) for v in converted.values())
    print(json.dumps({'beforeMB': round(before/1e6, 2), 'afterMB': round(after/1e6, 2), 'seconds': round(time.monotonic()-start, 1)}), flush=True)


if __name__ == '__main__':
    main()
