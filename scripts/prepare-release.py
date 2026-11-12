#!/usr/bin/env python3
"""Write the exact built source identity to a public, non-sensitive marker."""
import argparse
import json
import re
from pathlib import Path
from datetime import datetime, timezone


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='site/dist')
    parser.add_argument('--sha', required=True)
    parser.add_argument('--run-url', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.sha):
        parser.error('A full source commit SHA is required')
    root = Path(args.root)
    if not (root / 'index.html').is_file():
        parser.error('Built index.html is missing')
    marker = {'source_sha': args.sha, 'run_url': args.run_url,
              'built_at': datetime.now(timezone.utc).isoformat()}
    (root / 'deployment.json').write_text(json.dumps(marker, indent=2) + '\n')
    print('Prepared source', args.sha)


if __name__ == '__main__':
    main()
