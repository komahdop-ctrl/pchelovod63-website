import io
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from beget_preview import build, package, deploy
from beget_preview_remote import install, rollback

SOURCE = Path(__file__).resolve().parents[1]
SHA = 'a' * 40


class PreviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.webroot = self.base / 'public_html'
        self.webroot.mkdir()
        (self.webroot / 'other-site.txt').write_text('preserve me')

    def bundle(self, sha=SHA):
        output = self.base / ('bundle-' + sha)
        build(SOURCE, output, sha)
        return output, package(output)

    def test_first_install_preserves_other_files(self):
        output, payload = self.bundle()
        answer = install(str(self.webroot), SHA, payload)
        self.assertTrue(answer['ok'])
        self.assertFalse(answer['previous_available'])
        self.assertEqual((self.webroot / 'other-site.txt').read_text(), 'preserve me')
        self.assertEqual((output / 'index.html').read_bytes(),
                         (self.webroot / 'opylitel-preview' / 'index.html').read_bytes())
        self.assertFalse(list((self.webroot / 'opylitel-preview').rglob('*.php')))

    def test_update_and_rollback(self):
        _, first = self.bundle()
        install(str(self.webroot), SHA, first)
        second_sha = 'b' * 40
        _, second = self.bundle(second_sha)
        self.assertTrue(install(str(self.webroot), second_sha, second)['previous_available'])
        rollback(str(self.webroot), second_sha)
        release = json.loads((self.webroot / 'opylitel-preview/release.json').read_text())
        self.assertEqual(release['commit'], SHA)

    def test_failed_first_release_can_be_removed_from_public_path(self):
        _, payload = self.bundle()
        install(str(self.webroot), SHA, payload)
        rollback(str(self.webroot), SHA)
        self.assertFalse((self.webroot / 'opylitel-preview').exists())

    def test_refuses_unmanaged_directory(self):
        target = self.webroot / 'opylitel-preview'
        target.mkdir()
        (target / 'keep.txt').write_text('existing site')
        _, payload = self.bundle()
        with self.assertRaises((ValueError, FileNotFoundError)):
            install(str(self.webroot), SHA, payload)
        self.assertEqual((target / 'keep.txt').read_text(), 'existing site')

    def test_refuses_target_symlink(self):
        target = self.base / 'another-site'
        target.mkdir()
        (self.webroot / 'opylitel-preview').symlink_to(target, target_is_directory=True)
        _, payload = self.bundle()
        with self.assertRaises(ValueError):
            install(str(self.webroot), SHA, payload)
        self.assertEqual(list(target.iterdir()), [])

    def test_refuses_tar_path_traversal(self):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:') as archive:
            member = tarfile.TarInfo('../escape')
            member.size = 1
            archive.addfile(member, io.BytesIO(b'x'))
        with self.assertRaises(ValueError):
            install(str(self.webroot), SHA, stream.getvalue())
        self.assertFalse((self.base / 'escape').exists())

    def test_refuses_corrupted_page(self):
        output, _ = self.bundle()
        (output / 'index.html').write_text('unexpected replacement')
        with self.assertRaises(ValueError):
            install(str(self.webroot), SHA, package(output))
        self.assertFalse((self.webroot / 'opylitel-preview').exists())

    def test_refuses_missing_credentials_before_ssh(self):
        output, _ = self.bundle()
        with patch.dict(os.environ, {}, clear=True), patch('subprocess.run') as run:
            with self.assertRaisesRegex(ValueError, 'One-time setup incomplete'):
                deploy(output)
            run.assert_not_called()

    def test_preview_policy_and_closed_settings(self):
        output, _ = self.bundle()
        text = (output / 'index.html').read_text()
        self.assertIn('content="noindex,nofollow"', text)
        self.assertIn("connect-src 'none'", text)
        self.assertNotIn('window.OPYLITEL_INTAKE=window.OPYLITEL_INTAKE||', text)
        self.assertIn('legalDocumentsApproved:false', text)
        self.assertEqual(set(json.loads((output/'release.json').read_text())['sha256']),
                         {'index.html','agrarian.html','privacy.html','consent.html','.htaccess'})


if __name__ == '__main__':
    unittest.main()
