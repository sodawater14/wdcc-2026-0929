"""Stage public media only, never the website backend, credentials or feedback."""
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'qa/media-public'


def stage(relative):
    source, destination = ROOT / relative, PUBLIC / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        return
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for cover in (ROOT / 'assets/covers').glob('*.webp'):
        stage(cover.relative_to(ROOT).as_posix())
    # A stable benchmark reference, identical to the GitHub-hosted original.
    stage('assets/reports/01/001.webp')
    manifest = ROOT / 'data/media-manifest.json'
    if manifest.exists():
        for item in json.loads(manifest.read_text(encoding='utf-8'))['bySource'].values():
            stage(item['src'])
            if 'preview' in item:
                stage(item['preview']['src'])
    (PUBLIC / '_headers').write_text('/assets/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=86400\n/assets/media/*\n  Cache-Control: public, max-age=31536000, immutable\n', encoding='utf-8', newline='\n')
    print('Public media staged; no private data included.')


if __name__ == '__main__':
    main()
