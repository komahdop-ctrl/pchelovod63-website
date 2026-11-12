#!/usr/bin/env python3
import importlib.util
import io
import json
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('release', 'scripts/verify-published.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
SHA = 'a' * 40

class Response(io.BytesIO):
    def __init__(self, data, url='https://example.test/', content_type='text/html'):
        super().__init__(data)
        self.url = url
        self.headers = {'Content-Type': content_type}

class ReleaseChecks(unittest.TestCase):
    def test_matching_release_and_html(self):
        with patch.object(release.urllib.request, 'urlopen', side_effect=[Response(json.dumps({'source_sha': SHA}).encode()), Response(b'<html><h1>Home</h1></html>')]):
            self.assertEqual(release.check('https://example.test/', SHA, ['/'])['source_sha'], SHA)
    def test_stale_release_rejected(self):
        with patch.object(release.urllib.request, 'urlopen', return_value=Response(b'{"source_sha":"old"}')):
            with self.assertRaisesRegex(ValueError, 'another source'):
                release.check('https://example.test/', SHA, ['/'])
    def test_wrong_destination_rejected(self):
        with patch.object(release.urllib.request, 'urlopen', return_value=Response(b'{}', url='https://other.test/')):
            with self.assertRaisesRegex(ValueError, 'cross-origin'):
                release.check('https://example.test/', SHA, ['/'])
    def test_soft_error_page_rejected(self):
        with patch.object(release.urllib.request, 'urlopen', side_effect=[Response(json.dumps({'source_sha': SHA}).encode()), Response(b'<html>Error</html>')]):
            with self.assertRaisesRegex(ValueError, 'heading'):
                release.check('https://example.test/', SHA, ['/'])

if __name__ == '__main__':
    unittest.main()
