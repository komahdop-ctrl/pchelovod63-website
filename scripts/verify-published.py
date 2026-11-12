#!/usr/bin/env python3
"""Check the exact release and critical public pages, with bounded CDN retries."""
import argparse
import json
import re
import time
import urllib.request
from urllib.parse import urljoin, urlsplit


def check(base, expected_sha, paths, timeout=15):
    origin = urlsplit(base)
    if origin.scheme not in ('https', 'http') or not origin.netloc:
        raise ValueError('Invalid site URL')
    if not re.fullmatch(r'[0-9a-f]{40}', expected_sha):
        raise ValueError('A full source SHA is required')
    def get(path):
        url = urljoin(base, path.lstrip('/'))
        request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'Pchelovod63-release-check'})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            final = urlsplit(response.url)
            if (final.scheme, final.netloc) != (origin.scheme, origin.netloc):
                raise ValueError('Unexpected cross-origin redirect')
            return response.read(), response.headers.get('Content-Type', '')
    raw, _ = get('deployment.json?expected=' + expected_sha)
    marker = json.loads(raw)
    if marker.get('source_sha') != expected_sha:
        raise ValueError('CDN is serving another source commit')
    for path in paths:
        raw, content_type = get(path)
        html = raw.decode('utf-8')
        if 'text/html' not in content_type or not re.search(r'<html\b', html, re.I):
            raise ValueError('Expected HTML at ' + path)
        if not re.search(r'<h1\b', html, re.I):
            raise ValueError('Missing page heading at ' + path)
    return marker


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--registry', default='ops/sites.json')
    parser.add_argument('--attempts', type=int, default=12)
    parser.add_argument('--delay', type=float, default=10)
    args = parser.parse_args()
    paths = json.loads(open(args.registry).read())['pchelovod63']['smoke_paths']
    for attempt in range(1, args.attempts + 1):
        try:
            check(args.url, args.sha, paths)
            print('Published release verified:', args.sha, args.url)
            return
        except (OSError, ValueError) as error:
            print(f'Check {attempt}/{args.attempts}: {error}', flush=True)
            if attempt == args.attempts:
                raise SystemExit('Publication verification failed; inspect deployment before declaring success')
            time.sleep(args.delay)


if __name__ == '__main__':
    main()
