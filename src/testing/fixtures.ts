import type { FetchCaps, FetchJob } from '../common/fetch';
import type { SFTPListItem } from '../common/protocol';

/**
 * Data for stories and tests: the nodes, folders and downloads the Remote
 * Fetch mockups draw, so every screen can be shown with the real widgets.
 */

export const NODE_ID = '7b0c3c1e-6f0a-4f43-9d1e-0c5b8f1a2d10';
export const NODE_LABEL = 'raspberrypi';
export const DOWNLOAD_FOLDER = '/home/pi/Downloads';
export const MEDIA_FOLDER = '/home/pi/media';

const MB = 1_000_000;
const GB = 1_000_000_000;

export function caps(over: Partial<FetchCaps> = {}): FetchCaps {
    return {
        http: true,
        torrents: true,
        private_targets: false,
        max_active: 3,
        lock: 'None',
        folder: DOWNLOAD_FOLDER,
        folder_free_bytes: 41 * GB,
        agent_supported: true,
        ...over,
    };
}

let seq = 0;

export function job(over: Partial<FetchJob> = {}): FetchJob {
    seq++;
    const now = Date.now();
    return {
        download_id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
        kind: 'Http',
        name: `file-${seq}.bin`,
        dest_root: DOWNLOAD_FOLDER,
        sub_dir: null,
        state: 'Downloading',
        done_bytes: 0,
        total_bytes: null,
        down_bps: 0,
        up_bps: 0,
        peers: 0,
        in_order: true,
        started_at: now - 60_000,
        finished_at: null,
        reason: null,
        requested_by: null,
        files: [],
        up_total: 0,
        pause_reason: null,
        seeding_since: null,
        info_hash: null,
        retry_reason: null,
        attempt: 0,
        next_attempt_at: null,
        restarted_from_zero: false,
        ...over,
    };
}

function media(name: string, size: number, done: number, ready = done) {
    return [{ index: 0, name, size, done_bytes: done, media: true, ready_from_start: ready }];
}

/** Rows from mockup A: three active, one finished, one retrying. */
export function drawerJobs(): FetchJob[] {
    const now = Date.now();
    return [
        job({
            name: 'big_buck_bunny_1080p.mp4',
            dest_root: MEDIA_FOLDER,
            state: 'Downloading',
            done_bytes: 356 * MB,
            total_bytes: 920 * MB,
            down_bps: 11.8 * MB,
            files: media('big_buck_bunny_1080p.mp4', 920 * MB, 356 * MB),
        }),
        job({
            kind: 'Torrent',
            name: 'ubuntu-26.04-desktop-amd64.iso',
            dest_root: MEDIA_FOLDER,
            state: 'Downloading',
            in_order: false,
            done_bytes: 4.31 * GB,
            total_bytes: 6.05 * GB,
            down_bps: 2.4 * MB,
            up_bps: 0.6 * MB,
            peers: 42,
        }),
        job({ kind: 'Torrent', name: 'magnet:?xt=urn:btih:9f2c…a41e', dest_root: MEDIA_FOLDER, state: 'FetchingMetadata', peers: 3, started_at: now - 41_000 }),
        job({
            kind: 'Torrent',
            name: 'debian-13.2.0-amd64-netinst',
            dest_root: MEDIA_FOLDER,
            state: 'Completed',
            done_bytes: 784 * MB,
            total_bytes: 784 * MB,
            started_at: now - 600_000,
            finished_at: now - 348_000,
            files: [
                { index: 0, name: 'debian-13.2.0-amd64-netinst.iso', size: 783 * MB, done_bytes: 783 * MB, media: false, ready_from_start: 783 * MB },
                { index: 1, name: 'SHA256SUMS', size: 1200, done_bytes: 1200, media: false, ready_from_start: 1200 },
                { index: 2, name: 'SHA256SUMS.sign', size: 800, done_bytes: 800, media: false, ready_from_start: 800 },
            ],
        }),
        job({
            name: 'nightly-build.zip',
            dest_root: MEDIA_FOLDER,
            state: 'Retrying',
            done_bytes: 98 * MB,
            retry_reason: 'Server answered 403 Forbidden',
            attempt: 6,
            next_attempt_at: now + 8 * 60_000,
        }),
    ];
}

/** Mockup R: one row per state, top to bottom. */
export function everyState(): FetchJob[] {
    const now = Date.now();
    return [
        job({ name: 'nightly-build-4412.zip', state: 'Queued' }),
        job({ name: 'bbb_sunflower_1080p_60fps_normal.mp4', state: 'Resolving' }),
        job({ kind: 'Torrent', name: 'magnet:?xt=urn:btih:9f2c…a41e', state: 'FetchingMetadata', peers: 3, started_at: now - 41_000 }),
        job({ name: 'big_buck_bunny_1080p.mp4', state: 'Downloading', done_bytes: 356 * MB, total_bytes: 920 * MB, down_bps: 11.8 * MB, files: media('big_buck_bunny_1080p.mp4', 920 * MB, 356 * MB) }),
        job({
            kind: 'Torrent',
            name: 'Sintel.2010.1080p.mkv',
            state: 'Downloading',
            in_order: true,
            done_bytes: 263 * MB,
            total_bytes: 1.12 * GB,
            down_bps: 3.9 * MB,
            peers: 28,
            files: media('Sintel.2010.1080p.mkv', 1.12 * GB, 263 * MB, 240 * MB),
        }),
        job({
            kind: 'Torrent',
            name: 'ubuntu-26.04-desktop-amd64.iso',
            state: 'Downloading',
            in_order: false,
            done_bytes: 4.31 * GB,
            total_bytes: 6.05 * GB,
            down_bps: 2.4 * MB,
            peers: 42,
            files: media('ubuntu-26.04-desktop-amd64.mp4', 6.05 * GB, 4.31 * GB, 10 * MB),
        }),
        job({ name: 'dataset-2026.tar.zst', state: 'Stopped', done_bytes: 38 * MB, total_bytes: 100 * MB }),
        job({ name: 'nightly-build.zip', state: 'Retrying', done_bytes: 98 * MB, retry_reason: 'Server answered 403 Forbidden', attempt: 6, next_attempt_at: now + 8 * 60_000 }),
        job({ kind: 'Torrent', name: 'debian-13.2.0-amd64-netinst', state: 'Completed', done_bytes: 784 * MB, total_bytes: 784 * MB, started_at: now - 600_000, finished_at: now - 348_000 }),
        job({ name: 'old-iso.img', state: 'Cancelled', reason: 'Stopped with “also delete the part”' }),
    ];
}

/** Mockup R2: torrent, schedule, disk and login states. */
export function moreStates(): FetchJob[] {
    const now = Date.now();
    return [
        job({ kind: 'Torrent', name: 'ubuntu-26.04-desktop-amd64.iso', state: 'Verifying', done_bytes: 4.31 * GB, total_bytes: 10.5 * GB }),
        job({ kind: 'Torrent', name: 'debian-13.2.0-amd64-netinst', state: 'Seeding', done_bytes: 784 * MB, total_bytes: 784 * MB, up_bps: 1.4 * MB, up_total: 2.31 * GB, peers: 11, seeding_since: now - 3 * 86_400_000 }),
        job({ name: 'dataset-2026.tar.zst', state: 'Scheduled', next_attempt_at: now + (3 * 60 + 12) * 60_000 }),
        job({ name: 'big_buck_bunny_1080p.mp4', state: 'Paused', pause_reason: 'DiskFull', reason: '1.6 GB free on /srv/downloads, the floor is 2 GB', done_bytes: 600 * MB, total_bytes: 920 * MB }),
        job({ name: 'firmware-v2.4.bin', state: 'Downloading', done_bytes: 57 * MB, total_bytes: 100 * MB, down_bps: 6.2 * MB }),
    ];
}

/** H4: the Finished tab. */
export function finishedJobs(): FetchJob[] {
    const today = new Date();
    const at = (h: number, m: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m).getTime();
    return [
        job({ kind: 'Torrent', name: 'Sintel.2010.1080p.mkv', state: 'Completed', done_bytes: 1.12 * GB, total_bytes: 1.12 * GB, started_at: at(21, 40), finished_at: at(21, 52), files: media('Sintel.2010.1080p.mkv', 1.12 * GB, 1.12 * GB) }),
        job({ name: 'home-assistant-backup.tar', state: 'Completed', done_bytes: 812 * MB, total_bytes: 812 * MB, started_at: at(21, 42), finished_at: at(21, 44) }),
        job({ kind: 'Torrent', name: 'debian-13.2.0-amd64-netinst', dest_root: MEDIA_FOLDER, state: 'Completed', done_bytes: 784 * MB, total_bytes: 784 * MB, started_at: at(21, 37), finished_at: at(21, 41) }),
        job({ name: 'raspios-bookworm.img.xz', state: 'Completed', done_bytes: 436 * MB, total_bytes: 436 * MB, started_at: at(20, 1), finished_at: at(20, 3) }),
        job({ kind: 'Torrent', name: 'archlinux-2026.11.01-x86_64.iso', state: 'Seeding', done_bytes: 1.2 * GB, total_bytes: 1.2 * GB, up_bps: 0.3 * MB, up_total: 400 * MB, peers: 4, seeding_since: Date.now() - 86_400_000 }),
    ];
}

/** H: the standalone desktop. */
export function standaloneJobs(): FetchJob[] {
    return [
        job({
            kind: 'Torrent',
            name: 'Sintel.2010.1080p.mkv',
            state: 'Downloading',
            in_order: true,
            done_bytes: 263 * MB,
            total_bytes: 1.12 * GB,
            down_bps: 3.9 * MB,
            up_bps: 0.4 * MB,
            peers: 28,
            files: media('Sintel.2010.1080p.mkv', 1.12 * GB, 263 * MB, 240 * MB),
        }),
        job({ name: 'raspios-bookworm-arm64-lite.img.xz', state: 'Downloading', done_bytes: 279 * MB, total_bytes: 436 * MB, down_bps: 9.1 * MB }),
        ...finishedJobs().slice(0, 3),
        job({ name: 'nightly-build.zip', state: 'Retrying', done_bytes: 98 * MB, retry_reason: 'Server answered 403 Forbidden', attempt: 6, next_attempt_at: Date.now() + 8 * 60_000 }),
    ];
}

export function entry(name: string, kind: SFTPListItem['kind'], over: Partial<SFTPListItem['attributes']> = {}, path = MEDIA_FOLDER): SFTPListItem {
    return {
        name,
        path,
        kind,
        items: [],
        attributes: { size: 0, uid: 1000, user: 'pi', gid: 1000, group: 'pi', permissions: kind === 'Folder' ? 0o40755 : 0o100644, atime: 0, modified: 1_763_000_000, ...over },
    };
}

/** The folders mockups A and C browse. */
export function mediaListing(): Record<string, SFTPListItem[]> {
    return {
        [MEDIA_FOLDER]: [
            entry('Shows', 'Folder'),
            entry('debian-13.2.0-amd64-netinst', 'Folder'),
            entry('home-assistant-backup.tar', 'File', { size: 812 * MB }),
            entry('big_buck_bunny_1080p.mp4.phirepass-part', 'File', { size: 356 * MB }),
            entry('holiday-2025.mp4', 'File', { size: 1.4 * GB }),
            entry('podcast-ep-212.mp3', 'File', { size: 52 * MB }),
            entry('notes.txt', 'File', { size: 2000 }),
        ],
        [`${MEDIA_FOLDER}/Shows`]: [entry('Season 1', 'Folder', {}, `${MEDIA_FOLDER}/Shows`), entry('trailer.webm', 'File', { size: 48 * MB }, `${MEDIA_FOLDER}/Shows`)],
        [DOWNLOAD_FOLDER]: [
            entry('archlinux-2026.11.01-x86_64.iso.torrent', 'File', { size: 48_000 }, DOWNLOAD_FOLDER),
            entry('movies', 'Folder', {}, DOWNLOAD_FOLDER),
            entry('report.pdf', 'File', { size: 300_000 }, DOWNLOAD_FOLDER),
        ],
    };
}
