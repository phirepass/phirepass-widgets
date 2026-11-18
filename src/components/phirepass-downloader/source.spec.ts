import { describe, expect, it } from 'vitest';
import { EMPTY_AUTH, buildSourceAuth, checkTorrentFile, detectSource, shortMagnet } from './source';

describe('detectSource', () => {
    it('is empty for blank input', () => {
        expect(detectSource('   ')).toEqual({ kind: 'empty' });
    });

    it('reads an HTTPS link, its host and file name', () => {
        expect(detectSource(' https://download.blender.org/peach/big%20buck.mp4 ')).toEqual({
            kind: 'http',
            url: 'https://download.blender.org/peach/big%20buck.mp4',
            host: 'download.blender.org',
            name: 'big buck.mp4',
            scheme: 'HTTPS',
        });
    });

    it('names a link without a path “download”', () => {
        expect(detectSource('http://example.com')).toMatchObject({ kind: 'http', scheme: 'HTTP', name: 'download' });
    });

    it('treats a link to a .torrent file as a link (fetched as a file)', () => {
        expect(detectSource('https://example.com/ubuntu.iso.torrent')).toMatchObject({ kind: 'torrent-url', name: 'ubuntu.iso.torrent' });
    });

    it('reads a magnet with its name and info hash', () => {
        expect(detectSource('magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel')).toMatchObject({
            kind: 'magnet',
            name: 'Sintel',
            infoHash: '08ada5a7a6183aae1e09d831df6748d566095a10',
        });
    });

    it('leaves the name off a magnet without dn', () => {
        const d = detectSource('magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10');
        expect(d.kind).toBe('magnet');
        expect('name' in d).toBe(false);
    });

    it.each([
        ['ftp://example.com/file.iso'],
        ['file:///etc/passwd'],
        ['not a link'],
        ['magnet:?dn=no-hash'],
        ['https://user:secret@example.com/file.zip'],
    ])('refuses %s', text => {
        expect(detectSource(text)).toEqual({ kind: 'invalid' });
    });
});

describe('shortMagnet', () => {
    it('keeps the first and last four of the hash', () => {
        expect(shortMagnet('magnet:?xt=urn:btih:9f2c0000000000000000000000000000000a41e')).toBe('magnet:?xt=urn:btih:9f2c…a41e');
    });

    it('truncates something without a hash', () => {
        expect(shortMagnet('magnet:?' + 'x'.repeat(60))).toHaveLength(38);
    });
});

describe('checkTorrentFile', () => {
    it('accepts a .torrent up to 2 MB', () => {
        expect(checkTorrentFile({ name: 'a.TORRENT', size: 2_000_000 })).toEqual({ ok: true });
    });

    it('refuses anything bigger', () => {
        expect(checkTorrentFile({ name: 'a.torrent', size: 3 * 1024 * 1024 })).toEqual({ ok: false, reason: 'too-large' });
    });

    it('refuses another kind of file', () => {
        expect(checkTorrentFile({ name: 'movie.mkv', size: 10 })).toEqual({ ok: false, reason: 'not-torrent' });
    });
});

describe('buildSourceAuth', () => {
    it('is no login by default', () => {
        expect(buildSourceAuth(EMPTY_AUTH)).toEqual({ auth: null });
    });

    it('needs a username for basic auth, but allows an empty password', () => {
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'basic' }).error).toBe('Enter a username.');
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'basic', username: 'pi' })).toEqual({ auth: { Basic: { username: 'pi', password: '' } } });
    });

    it('trims a bearer token', () => {
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'bearer', token: '  abc ' })).toEqual({ auth: { Bearer: { token: 'abc' } } });
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'bearer', token: ' ' }).error).toBe('Enter a token.');
    });

    it('validates a custom header name', () => {
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'header', headerName: 'X Bad' }).error).toBe('Enter a valid header name.');
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'header', headerName: 'X-Api-Key', headerValue: 'v' })).toEqual({ auth: { Header: { name: 'X-Api-Key', value: 'v' } } });
    });

    it.each(['Host', 'range', 'Content-Length'])('refuses the header %s', name => {
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'header', headerName: name }).error).toBe(`${name} cannot be set here.`);
    });
});

describe('buildSourceAuth refuses what the node would refuse', () => {
    it('a line break in any field, and a colon in a username', () => {
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'bearer', token: 'a\r\nX-Evil: 1' }).error).toBe('A login cannot contain line breaks.');
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'header', headerName: 'X-Key', headerValue: 'v\n' }).error).toBe('A login cannot contain line breaks.');
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'basic', username: 'a:b' }).error).toBe('A username cannot contain a colon.');
        expect(buildSourceAuth({ ...EMPTY_AUTH, mode: 'basic', username: 'ana', password: 'p' }).auth).toEqual({ Basic: { username: 'ana', password: 'p' } });
    });
});
