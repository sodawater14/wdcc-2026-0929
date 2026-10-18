"""Apply generated web variants while retaining the original media references."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def apply_media(detail, manifest=None):
    path = ROOT / 'data/media-manifest.json'
    if manifest is None:
        if not path.exists():
            return detail
        manifest = json.loads(path.read_text(encoding='utf-8'))
    entries = manifest['bySource']
    for image in detail['images']:
        original = image.get('originalSrc', image['src'])
        if original in entries:
            variant = entries[original]
            image.update({key: variant[key] for key in ['src', 'width', 'height', 'preview']})
            image['originalSrc'] = original
    audio = detail['audio']
    original = audio.get('originalSrc', audio['src'])
    if original in entries:
        audio.update(src=entries[original]['src'], originalSrc=original)
    return detail
