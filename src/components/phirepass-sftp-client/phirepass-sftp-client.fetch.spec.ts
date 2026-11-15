import { describe, expect, it } from 'vitest';
import { folderOfCompleted, isPartFile, isPlayableFile, sameFolder } from './phirepass-sftp-client.fetch';

describe('SFTP Remote Fetch helpers', () => {
    it('spots part files', () => {
        expect(isPartFile('big.iso.phirepass-part')).toBe(true);
        expect(isPartFile('big.iso')).toBe(false);
    });

    it('never offers Play on a part file', () => {
        expect(isPlayableFile('film.mkv')).toBe(true);
        expect(isPlayableFile('film.mkv.phirepass-part')).toBe(false);
        expect(isPlayableFile('notes.txt')).toBe(false);
    });

    it('compares folders loosely on slashes', () => {
        expect(sameFolder('/home/pi/media/', '/home/pi//media')).toBe(true);
        expect(sameFolder('/home/pi/media', '/home/pi/media/films')).toBe(false);
    });

    it('works out where a finished download landed', () => {
        expect(folderOfCompleted({ dest_root: '/srv/downloads/', sub_dir: null })).toBe('/srv/downloads');
        expect(folderOfCompleted({ dest_root: '/srv/downloads', sub_dir: 'films' })).toBe('/srv/downloads/films');
    });
});
