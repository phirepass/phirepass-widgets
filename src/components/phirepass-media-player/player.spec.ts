import { afterEach, describe, expect, it, vi } from 'vitest';
import { castBlocker, fetchLinkMinter, isAudio, isPlayableName, isWatched, localPositionStore, mimeFor, positionAction, ticketUrl } from './player';

describe('mime and kind', () => {
    it('maps extensions the way the stream server does', () => {
        expect(mimeFor('a.MP4')).toBe('video/mp4');
        expect(mimeFor('a.mkv')).toBe('video/x-matroska');
        expect(mimeFor('a.unknown')).toBe('application/octet-stream');
    });

    it('tells audio from video', () => {
        expect(isAudio('podcast.mp3')).toBe(true);
        expect(isAudio('film.webm')).toBe(false);
        expect(isAudio('x.bin', 'audio/flac')).toBe(true);
    });

    it('knows what is playable', () => {
        expect(isPlayableName('film.mp4')).toBe(true);
        expect(isPlayableName('notes.txt')).toBe(false);
    });
});

describe('castBlocker', () => {
    it('blocks MKV and MOV with a reason', () => {
        expect(castBlocker('a.mkv')).toMatch(/MKV/);
        expect(castBlocker('a.mov')).toMatch(/MOV/);
        expect(castBlocker('a.mp4')).toBeNull();
    });
});

describe('positionAction', () => {
    it('skips the first 30 seconds', () => {
        expect(positionAction(29, 3600)).toBe('skip');
        expect(positionAction(30, 3600)).toBe('save');
    });

    it('clears past 95% or within the last two minutes', () => {
        expect(positionAction(3420, 3600)).toBe('clear');
        expect(positionAction(3481, 3600)).toBe('clear');
        expect(positionAction(3400, 3600)).toBe('save');
    });

    it('never counts an unknown length as watched', () => {
        expect(isWatched(100, NaN)).toBe(false);
        expect(isWatched(100, 0)).toBe(false);
    });
});

describe('localPositionStore', () => {
    afterEach(() => window.localStorage.clear());

    it('stores, reads and clears a position', async () => {
        await localPositionStore.set('k', 61, 300);
        expect(await localPositionStore.get('k')).toMatchObject({ secs: 61, duration: 300 });
        await localPositionStore.clear!('k');
        expect(await localPositionStore.get('k')).toBeNull();
    });

    it('ignores garbage in storage', async () => {
        window.localStorage.setItem('phirepass.player.position.bad', '{not json');
        expect(await localPositionStore.get('bad')).toBeNull();
    });
});

describe('stream links (T2.9)', () => {
    it('puts the ticket on the stream URL, absolute', () => {
        expect(ticketUrl('/api/web/stream/n/d/0', 'abc', 'https://www.phirepass.com/x')).toBe('https://www.phirepass.com/api/web/stream/n/d/0?ticket=abc');
        expect(ticketUrl('https://relay.example/api/web/stream/n/t/tok', 'a-b_c')).toBe('https://relay.example/api/web/stream/n/t/tok?ticket=a-b_c');
    });

    it('POSTs the stream URL with the cookie and builds the link', async () => {
        const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ ticket: 'T1', expires_in: 21600 }) }) as unknown as Response);
        const link = await fetchLinkMinter(fetcher as unknown as typeof fetch)('https://relay.example/api/web/stream/n/d/0');
        expect(link).toBe('https://relay.example/api/web/stream/n/d/0?ticket=T1');
        expect(fetcher).toHaveBeenCalledWith('https://relay.example/api/web/stream/n/d/0', { method: 'POST', credentials: 'include' });
    });

    it('answers null when the server refuses or is unreachable', async () => {
        const refused = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as unknown as Response);
        expect(await fetchLinkMinter(refused as unknown as typeof fetch)('https://r/x')).toBeNull();
        const down = vi.fn(async () => {
            throw new Error('offline');
        });
        expect(await fetchLinkMinter(down as unknown as typeof fetch)('https://r/x')).toBeNull();
    });
});
