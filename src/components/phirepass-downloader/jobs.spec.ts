import { describe, expect, it } from 'vitest';
import { caps, job } from '../../testing/fixtures';
import {
    JobMap,
    Row,
    applyProgress,
    blockerFor,
    folderOf,
    isClearable,
    isNoSpace,
    isRunning,
    isStuck,
    joinPath,
    partPath,
    playCheck,
    renamedByNode,
    retryingForSecs,
    sortRows,
    statePill,
    statsLine,
    finishedLine,
    streamUrl,
    summarize,
    tabOf,
} from './jobs';

const media = (name: string, size = 1000) => [{ index: 0, name, size, done_bytes: 0, media: false, ready_from_start: 0 }];
const row = (over: Partial<Row>): Row => job(over) as Row;

describe('applyProgress', () => {
    it('adds a new job and reports it first', () => {
        const j = job({ state: 'Downloading' });
        const out = applyProgress({}, j);
        expect(out.first).toBe(true);
        expect(out.jobs[j.download_id].state).toBe('Downloading');
    });

    it('reports completion once, on the frame that finishes it', () => {
        const j = job({ state: 'Downloading' });
        let map: JobMap = applyProgress({}, j).jobs;
        const done = applyProgress(map, { ...j, state: 'Completed' });
        expect(done.completed?.download_id).toBe(j.download_id);
        map = done.jobs;
        expect(applyProgress(map, { ...j, state: 'Completed' }).completed).toBeUndefined();
    });

    it('does not report a job first seen as finished', () => {
        expect(applyProgress({}, job({ state: 'Completed' })).completed).toBeUndefined();
    });

    it('keeps Deleting until the node says Deleted, then drops the row', () => {
        const j = job({ state: 'Cancelled' });
        const map: JobMap = { [j.download_id]: { ...j, deleting: true } };
        expect(applyProgress(map, { ...j, done_bytes: 1 }).jobs[j.download_id].deleting).toBe(true);
        expect(applyProgress(map, { ...j, state: 'Deleted' }).jobs).toEqual({});
        expect(applyProgress({}, { ...j, state: 'Deleted' }).jobs).toEqual({});
    });

    it('shows Deleting for a delete sent from elsewhere or while the node was offline', () => {
        const j = job({ state: 'Stopped' });
        const told = applyProgress({}, { ...j, deleting: true }).jobs;
        expect(told[j.download_id].deleting).toBe(true);
        // The node's own progress before it applies the Delete keeps it.
        expect(applyProgress(told, { ...j, state: 'Stopped' }).jobs[j.download_id].deleting).toBe(true);
        expect(applyProgress({}, j).jobs[j.download_id].deleting).toBeUndefined();
    });
});

describe('tabs and counts', () => {
    it('sorts rows into tabs', () => {
        expect(tabOf(row({ state: 'Retrying' }))).toBe('retrying');
        expect(tabOf(row({ state: 'Stopped' }))).toBe('active');
        expect(tabOf(row({ state: 'Seeding' }))).toBe('finished');
        expect(tabOf(row({ state: 'Cancelled' }))).toBe('finished');
    });

    it('keeps a torrent whose seeding was stopped with the finished rows', () => {
        const paused = row({ kind: 'Torrent', state: 'Stopped', seeding_since: 1, up_total: 2048, files: media('a.mkv') });
        expect(tabOf(paused)).toBe('finished');
        expect(statePill(paused).text).toBe('Seeding paused');
        expect(statsLine(paused).map(s => s.text)).toEqual(['2 KB uploaded', 'Seeding paused by you', 'Resume shares it again']);
        expect(playCheck(paused).switchToInOrder).toBe(false);
        expect(isRunning(paused)).toBe(false);
        expect(isClearable(paused)).toBe(false);
        // A torrent stopped before it finished, and a link, stay Active.
        expect(tabOf(row({ kind: 'Torrent', state: 'Stopped', seeding_since: null }))).toBe('active');
        expect(tabOf(row({ kind: 'Http', state: 'Stopped', seeding_since: 1 }))).toBe('active');
        expect(statePill(row({ kind: 'Torrent', state: 'Stopped', seeding_since: null })).text).toBe('Stopped');
    });

    it('does not count Retrying, Stopped or Seeding as running', () => {
        expect(isRunning(row({ state: 'Downloading' }))).toBe(true);
        expect(isRunning(row({ state: 'Retrying' }))).toBe(false);
        expect(isRunning(row({ state: 'Stopped' }))).toBe(false);
        expect(isRunning(row({ state: 'Seeding' }))).toBe(false);
    });

    it('never clears a seeding torrent or a row already being deleted', () => {
        expect(isClearable(row({ state: 'Completed' }))).toBe(true);
        expect(isClearable(row({ state: 'Cancelled' }))).toBe(true);
        expect(isClearable(row({ state: 'Seeding' }))).toBe(false);
        expect(isClearable(row({ state: 'Completed', deleting: true }))).toBe(false);
    });

    it('puts active work first', () => {
        const sorted = sortRows([row({ name: 'c', state: 'Completed' }), row({ name: 'd', state: 'Downloading' }), row({ name: 'q', state: 'Queued' })]);
        expect(sorted.map(r => r.name)).toEqual(['d', 'q', 'c']);
    });

    it('sums rates and progress over running rows with a size', () => {
        const s = summarize([
            row({ state: 'Downloading', down_bps: 10, done_bytes: 50, total_bytes: 100 }),
            row({ state: 'FetchingMetadata', down_bps: 0, done_bytes: 0, total_bytes: null }),
            row({ state: 'Completed', down_bps: 0, done_bytes: 100, total_bytes: 100 }),
        ]);
        expect(s).toEqual({ active: 2, downBps: 10, done: 50, total: 100, percent: 50 });
        expect(summarize([]).percent).toBeNull();
    });
});

describe('playCheck', () => {
    it('plays a finished media file', () => {
        expect(playCheck(row({ state: 'Completed', files: media('a.mp4') })).play).toBe(true);
    });

    it('plays while downloading only in order and with a known size', () => {
        expect(playCheck(row({ state: 'Downloading', in_order: true, files: media('a.mp4') })).play).toBe(true);
        expect(playCheck(row({ state: 'Downloading', in_order: true, files: media('a.mp4', 0) })).play).toBe(false);
    });

    it('offers in order for a Fastest torrent instead of Play', () => {
        expect(playCheck(row({ kind: 'Torrent', state: 'Downloading', in_order: false, files: media('a.mkv') }))).toEqual({ play: false, file: null, switchToInOrder: true });
        expect(playCheck(row({ kind: 'Http', state: 'Downloading', in_order: false, files: media('a.mkv') })).switchToInOrder).toBe(false);
    });

    it('plays a link by its own name as file 0, the shape the agent sends', () => {
        const link = row({ kind: 'Http', state: 'Downloading', in_order: true, files: [], name: 'film.mp4', total_bytes: 1000, done_bytes: 400 });
        const check = playCheck(link);
        expect(check.play).toBe(true);
        expect(check.file?.index).toBe(0);
        expect(playCheck({ ...link, total_bytes: null }).play).toBe(false);
    });

    it('never plays a non-media file, a queued job or a row being deleted', () => {
        expect(playCheck(row({ state: 'Completed', files: media('a.iso') })).play).toBe(false);
        expect(playCheck(row({ state: 'Queued', in_order: true, files: media('a.mp4') })).play).toBe(false);
        expect(playCheck(row({ state: 'Completed', files: media('a.mp4'), deleting: true })).play).toBe(false);
    });
});

describe('paths', () => {
    it('builds the stream URL with encoded parts', () => {
        expect(streamUrl('https://x/', 'n 1', 'd/2', 3)).toBe('https://x/api/web/stream/n%201/d%2F2/3');
    });

    it('joins paths without doubled or trailing slashes', () => {
        expect(joinPath('/srv/', null, 'movies/')).toBe('/srv/movies');
        expect(joinPath('/')).toBe('/');
        expect(folderOf({ dest_root: '/home/pi/Downloads', sub_dir: 'films' })).toBe('/home/pi/Downloads/films');
    });

    it('names the part file next to the final one', () => {
        expect(partPath(row({ dest_root: '/d', sub_dir: null, name: 'a.zip' }))).toBe('/d/a.zip.phirepass-part');
    });
});

describe('retrying', () => {
    it('adds up the backoff: 10 s doubling, capped', () => {
        expect(retryingForSecs(0)).toBe(0);
        expect(retryingForSecs(3)).toBe(70);
        expect(retryingForSecs(10, 60)).toBe(10 + 20 + 40 + 60 * 7);
    });

    it('is stuck after a day of retrying', () => {
        expect(isStuck(row({ state: 'Retrying', attempt: 6 }))).toBe(false);
        expect(isStuck(row({ state: 'Retrying', attempt: 40 }))).toBe(true);
        expect(isStuck(row({ state: 'Downloading', attempt: 40 }))).toBe(false);
    });
});

describe('renamedByNode', () => {
    it('notices a “(1)” the node added', () => {
        expect(renamedByNode('report.pdf', 'report (1).pdf')).toBe(true);
        expect(renamedByNode('report.pdf', 'report.pdf')).toBe(false);
        expect(renamedByNode(undefined, 'report (1).pdf')).toBe(false);
        expect(renamedByNode('a.pdf', 'b.pdf')).toBe(false);
    });
});

describe('blockerFor', () => {
    it('lets a normal node start', () => {
        expect(blockerFor(caps(), 'pi', true)).toBeNull();
    });

    it('ranks an old agent, then the organisation, then the node switch, then the folder', () => {
        expect(blockerFor(caps({ agent_supported: false, lock: 'Organisation' }), 'pi', true)?.id).toBe('too-old');
        expect(blockerFor(caps({ lock: 'Organisation', http: false }), 'pi', true)?.id).toBe('blocked');
        expect(blockerFor(caps({ http: false, lock: 'NoFolder' }), 'pi', true)?.id).toBe('off');
        expect(blockerFor(caps({ lock: 'NoFolder' }), 'pi', true)?.id).toBe('no-folder');
    });

    it('offers node settings only to someone who can configure it', () => {
        expect(blockerFor(caps({ http: false }), 'pi', true)?.action).toBe('Open node settings');
        expect(blockerFor(caps({ http: false }), 'pi', false)?.action).toBeUndefined();
    });
});

describe('isNoSpace', () => {
    it.each([
        ['This download needs 6.05 GB. /home/pi/Downloads has 4.2 GB free.', true],
        ['Not enough space on the disk', true],
        ['Disk is full', true],
        ['Server answered 403 Forbidden', false],
        ['Waiting for a free slot', false],
        [null, false],
    ])('%s → %s', (reason, expected) => {
        expect(isNoSpace(reason)).toBe(expected);
    });
});

/**
 * The real channel hands a Rust `None` over as an absent field, not `null`
 * (checked against the WASM build). Every row helper must read such a job
 * exactly as it reads the `null` form the fixtures use.
 */
describe('a job as the real channel delivers it', () => {
    const OPTIONAL = ['total_bytes', 'finished_at', 'reason', 'requested_by', 'sub_dir', 'pause_reason', 'seeding_since', 'info_hash', 'retry_reason', 'next_attempt_at'] as const;
    const absent = (r: Row): Row => {
        const copy: Record<string, unknown> = { ...r };
        for (const key of OPTIONAL) {
            if (copy[key] === null) delete copy[key];
        }
        return copy as Row;
    };
    const states = ['Queued', 'Downloading', 'Paused', 'Retrying', 'Seeding', 'Completed', 'Stopped', 'Cancelled'] as const;

    it.each(states)('reads a %s row the same with absent fields as with nulls', state => {
        const withNulls = row({ state, done_bytes: 2048, down_bps: 512 });
        const asSent = absent(withNulls);
        expect(Object.keys(asSent).length).toBeLessThan(Object.keys(withNulls).length);
        const now = 1_763_200_000_000;
        expect(statsLine(asSent, { now })).toEqual(statsLine(withNulls, { now }));
        expect(statePill(asSent)).toEqual(statePill(withNulls));
        expect(finishedLine(asSent, now)).toEqual(finishedLine(withNulls, now));
        expect(folderOf(asSent)).toEqual(folderOf(withNulls));
        expect(summarize([asSent])).toEqual(summarize([withNulls]));
        expect(isStuck(asSent)).toEqual(isStuck(withNulls));
    });
});
