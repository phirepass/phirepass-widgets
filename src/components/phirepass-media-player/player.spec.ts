import { afterEach, describe, expect, it } from 'vitest';
import { castBlocker, isAudio, isPlayableName, isWatched, localPositionStore, mimeFor, positionAction } from './player';

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
