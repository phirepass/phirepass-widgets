import type { FetchCaps, FetchFile, FetchJob, FetchState } from '../../common/fetch';
import { formatBytes, formatClock, formatDuration, formatEta, formatPercent, formatRate, formatWhen } from './format';

/**
 * A row as the widget holds it: the node's latest `FetchJob`, plus what the
 * widget itself is waiting on (a Delete sent but not yet confirmed).
 */
export type Row = FetchJob & {
    deleting?: boolean;
    /** Accepted by the server, but the node has not reported it yet (it may be offline). */
    waitingForNode?: boolean;
};

export type JobMap = Record<string, Row>;

/** Ends of a download where it stops moving by itself. */
const FINISHED: ReadonlySet<FetchState> = new Set(['Completed', 'Seeding']);

export function isFinished(state: FetchState): boolean {
    return FINISHED.has(state);
}

/**
 * Folds one `DownloadProgress` into the rows.
 *
 * `completed` is set only the first time a job reaches Completed or Seeding
 * from anything else: a re-sent Completed (after a reconnect, or the snapshot a
 * fresh subscription gets) is not a second completion. A job first seen already
 * finished is not one either. `Deleted` removes the row.
 */
export function applyProgress(prev: JobMap, job: FetchJob): { jobs: JobMap; completed?: FetchJob; first: boolean } {
    const before = prev[job.download_id];
    if (job.state === 'Deleted') {
        if (!before) {
            return { jobs: prev, first: false };
        }
        const { [job.download_id]: _gone, ...rest } = prev;
        return { jobs: rest, first: false };
    }
    const jobs = { ...prev, [job.download_id]: { ...job, deleting: before?.deleting } };
    const completed = before && !isFinished(before.state) && isFinished(job.state) ? job : undefined;
    return { jobs, completed, first: !before };
}

export type Tab = 'active' | 'finished' | 'retrying';

const ACTIVE_STATES: ReadonlySet<FetchState> = new Set(['Queued', 'Scheduled', 'Resolving', 'FetchingMetadata', 'Downloading', 'Verifying', 'Paused', 'Stopped', 'Unknown']);

export function tabOf(row: Row): Tab {
    if (row.state === 'Retrying') {
        return 'retrying';
    }
    if (ACTIVE_STATES.has(row.state)) {
        return 'active';
    }
    return 'finished';
}

/**
 * Jobs working towards their bytes: what the badge and “N active” count.
 * A Retrying job is waiting out its backoff, so it is not counted (mockup A
 * shows 3 active beside a retrying row); it has its own tab instead.
 */
export function isRunning(row: Row): boolean {
    return ['Queued', 'Scheduled', 'Resolving', 'FetchingMetadata', 'Downloading', 'Verifying', 'Paused'].includes(row.state);
}

/** Rows “Clear finished” deletes: Completed and Cancelled, never a seeding torrent. */
export function isClearable(row: Row): boolean {
    return (row.state === 'Completed' || row.state === 'Cancelled') && !row.deleting;
}

const ORDER: Record<FetchState, number> = {
    Downloading: 0,
    Verifying: 1,
    FetchingMetadata: 2,
    Resolving: 3,
    Paused: 4,
    Queued: 5,
    Scheduled: 6,
    Retrying: 7,
    Stopped: 8,
    Seeding: 9,
    Completed: 10,
    Cancelled: 11,
    Deleted: 12,
    Unknown: 13,
};

/** Active work first, newest first within a state; finished rows by when they finished. */
export function sortRows(rows: Row[]): Row[] {
    return [...rows].sort((a, b) => ORDER[a.state] - ORDER[b.state] || (b.finished_at ?? b.started_at) - (a.finished_at ?? a.started_at));
}

export function summarize(rows: Row[]): { active: number; downBps: number; done: number; total: number; percent: number | null } {
    const running = rows.filter(isRunning);
    const downBps = running.reduce((n, r) => n + (r.down_bps || 0), 0);
    const sized = running.filter(r => r.total_bytes);
    const done = sized.reduce((n, r) => n + r.done_bytes, 0);
    const total = sized.reduce((n, r) => n + (r.total_bytes ?? 0), 0);
    return { active: running.length, downBps, done, total, percent: total ? (done / total) * 100 : null };
}

// ---- playback ----

const MEDIA_EXT = /\.(mp4|m4v|webm|mkv|mov|mp3|m4a|flac|ogg|oga|opus|wav)$/i;
const AUDIO_EXT = /\.(mp3|m4a|flac|ogg|oga|opus|wav)$/i;

export function isMediaName(name: string): boolean {
    return MEDIA_EXT.test(name);
}

export function isAudioName(name: string): boolean {
    return AUDIO_EXT.test(name);
}

/** The file a player opens: the largest media file, which is the one the in-order reader follows. */
export function mediaFile(row: Row): FetchFile | null {
    const media = row.files.filter(f => f.media || isMediaName(f.name));
    if (media.length) {
        return media.reduce((a, b) => (b.size > a.size ? b : a));
    }
    if (!row.files.length && isMediaName(row.name)) {
        return { index: 0, name: row.name, size: row.total_bytes ?? 0, done_bytes: row.done_bytes, media: true, ready_from_start: row.in_order ? row.done_bytes : 0 };
    }
    return null;
}

export type PlayCheck = { play: boolean; file: FetchFile | null; switchToInOrder: boolean };

/**
 * Play appears only for video or audio whose size is known and whose download
 * is finished or in order. A Fastest torrent offers “Switch to in order to
 * watch” instead; the server refuses its stream anyway (409).
 */
export function playCheck(row: Row): PlayCheck {
    const file = mediaFile(row);
    if (!file || row.deleting) {
        return { play: false, file: null, switchToInOrder: false };
    }
    if (isFinished(row.state)) {
        return { play: true, file, switchToInOrder: false };
    }
    const moving = ['Downloading', 'Verifying', 'Paused', 'Stopped', 'Retrying'].includes(row.state);
    if (!moving || !file.size) {
        return { play: false, file: null, switchToInOrder: false };
    }
    if (row.in_order) {
        return { play: true, file, switchToInOrder: false };
    }
    return { play: false, file: null, switchToInOrder: row.kind === 'Torrent' };
}

export function streamUrl(base: string, nodeId: string, downloadId: string, fileIndex: number): string {
    return `${base.replace(/\/+$/, '')}/api/web/stream/${encodeURIComponent(nodeId)}/${encodeURIComponent(downloadId)}/${fileIndex}`;
}

// ---- where a job saves ----

export function joinPath(...parts: Array<string | null | undefined>): string {
    const joined = parts
        .filter((p): p is string => !!p)
        .join('/')
        .replace(/\/{2,}/g, '/');
    return joined.length > 1 ? joined.replace(/\/+$/, '') : joined;
}

export function folderOf(row: Pick<FetchJob, 'dest_root' | 'sub_dir'>): string {
    return joinPath(row.dest_root, row.sub_dir);
}

/** The path of a running link download's part file, as the SFTP listing shows it. */
export function partPath(row: Row): string {
    return `${joinPath(folderOf(row), row.name)}.phirepass-part`;
}

// ---- what a row says ----

export type Pill = { text: string; tone: 'dl' | 'meta' | 'mv' | 'ok' | 'err' | 'ps' | 'q' | 'sd' };

export function statePill(row: Row): Pill {
    if (row.deleting) {
        return { text: 'Deleting…', tone: 'ps' };
    }
    if (row.waitingForNode) {
        return { text: 'Waiting for the node', tone: 'q' };
    }
    switch (row.state) {
        case 'Queued':
            return { text: 'Queued', tone: 'q' };
        case 'Scheduled':
            return { text: 'Scheduled', tone: 'q' };
        case 'Resolving':
            return { text: 'Connecting', tone: 'meta' };
        case 'FetchingMetadata':
            return { text: 'Fetching metadata', tone: 'meta' };
        case 'Downloading':
            return { text: 'Downloading', tone: 'dl' };
        case 'Verifying':
            return { text: 'Checking pieces', tone: 'meta' };
        case 'Paused':
            return { text: row.pause_reason === 'DiskFull' ? 'Paused · disk almost full' : 'Paused', tone: 'mv' };
        case 'Retrying':
            return { text: 'Retrying', tone: 'mv' };
        case 'Seeding':
            return { text: 'Seeding', tone: 'sd' };
        case 'Completed':
            return { text: 'Completed', tone: 'ok' };
        case 'Stopped':
            return { text: 'Stopped', tone: 'ps' };
        case 'Cancelled':
            return { text: 'Cancelled', tone: 'err' };
        default:
            return { text: row.state, tone: 'ps' };
    }
}

/** The second pill on a torrent row: which order it downloads in. */
export function orderPill(row: Row): string | null {
    if (row.kind !== 'Torrent' || !['Downloading', 'Verifying', 'Paused'].includes(row.state)) {
        return null;
    }
    return row.in_order ? 'In order' : 'Fastest';
}

export type Stat = { text: string; strong?: boolean; error?: boolean };

/** The stats line under a row's bar, state by state, as mockups R and R2 draw it. */
export function statsLine(row: Row, ctx: { now?: number; running?: number; source?: string } = {}): Stat[] {
    const now = ctx.now ?? Date.now();
    const pct = formatPercent(row.done_bytes, row.total_bytes);
    const sizes = row.total_bytes ? `${formatBytes(row.done_bytes)} of ${formatBytes(row.total_bytes)}` : row.done_bytes ? formatBytes(row.done_bytes) : '';
    const out: Stat[] = [];
    const push = (text: string, extra: Partial<Stat> = {}) => text && out.push({ text, ...extra });

    if (row.deleting) {
        push('Waiting for the node to confirm');
        return out;
    }
    if (row.waitingForNode) {
        push('Starts when the node reports in');
        push('It keeps going after you close this tab');
        return out;
    }

    switch (row.state) {
        case 'Queued':
            push('Waiting for a free slot');
            if (ctx.running) {
                push(`${ctx.running} ${ctx.running === 1 ? 'is' : 'are'} running`);
            }
            break;
        case 'Scheduled':
            push('Waits for the download window');
            if (row.next_attempt_at && row.next_attempt_at > now) {
                push(`starts in ${formatDuration((row.next_attempt_at - now) / 1000)}`);
            }
            break;
        case 'Resolving':
            push(ctx.source ? `Contacting ${ctx.source}` : 'Contacting the server');
            break;
        case 'FetchingMetadata':
            push('Asking peers for the torrent info');
            push(`${row.peers} ${row.peers === 1 ? 'peer' : 'peers'}`);
            push(formatClock((now - row.started_at) / 1000));
            break;
        case 'Downloading':
            push(pct, { strong: true });
            push(sizes);
            push(formatRate(row.down_bps));
            if (row.kind === 'Torrent') {
                push(formatRate(row.up_bps, '↑'));
                push(`${row.peers} ${row.peers === 1 ? 'peer' : 'peers'}`);
            }
            push(formatEta(row.done_bytes, row.total_bytes, row.down_bps));
            if (row.restarted_from_zero) {
                push('The file changed on the server, so it started over');
            }
            if (ctx.source) {
                push(ctx.source);
            }
            break;
        case 'Verifying':
            push(pct, { strong: true });
            push('Checking downloaded pieces after a restart');
            push(`${formatBytes(row.done_bytes)} already on disk`);
            break;
        case 'Paused':
            if (row.pause_reason === 'DiskFull') {
                push(row.reason ?? 'Free space is below the floor');
                push('Resumes by itself when there is room');
            } else {
                push(pct, { strong: true });
                push('Outside the download window');
                push('Resumes by itself');
            }
            break;
        case 'Retrying':
            push(row.retry_reason ?? row.reason ?? 'Something went wrong', { error: true });
            push(`attempt ${row.attempt}`);
            if (row.next_attempt_at) {
                push(row.next_attempt_at > now ? `Next try in ${formatDuration((row.next_attempt_at - now) / 1000)}` : 'Trying again now');
            }
            if (row.done_bytes) {
                push(`${formatBytes(row.done_bytes)} kept`);
            }
            break;
        case 'Seeding':
            push(formatRate(row.up_bps, '↑'));
            push(`${formatBytes(row.up_total)} uploaded`);
            push(`${row.peers} ${row.peers === 1 ? 'peer' : 'peers'}`);
            if (row.seeding_since) {
                push(`seeding for ${formatDuration((now - row.seeding_since) / 1000).replace(/ \d+[hm]$/, '')}, until you delete it`);
            }
            break;
        case 'Completed': {
            push('100%', { strong: true });
            push(row.files.length > 1 ? `${row.files.length} files · ${formatBytes(row.total_bytes ?? row.done_bytes)}` : formatBytes(row.total_bytes ?? row.done_bytes));
            if (row.finished_at && row.started_at) {
                const secs = (row.finished_at - row.started_at) / 1000;
                push(`took ${formatDuration(secs)}`);
                if (secs > 0 && (row.total_bytes ?? row.done_bytes)) {
                    push(`avg ${formatBytes((row.total_bytes ?? row.done_bytes) / secs)}/s`);
                }
            }
            break;
        }
        case 'Stopped':
            push(pct, { strong: true });
            push(row.reason ?? 'Stopped by you');
            push('Resume continues from here');
            break;
        case 'Cancelled':
            push(row.reason ?? 'Stopped and its part deleted', { error: !!row.reason });
            push('Resume starts from zero');
            break;
        default:
            break;
    }
    return out;
}

/** The line under a finished row in the standalone Finished tab (H4). */
export function finishedLine(row: Row, now = Date.now()): string {
    const size = row.files.length > 1 ? `${row.files.length} files · ${formatBytes(row.total_bytes ?? row.done_bytes)}` : formatBytes(row.total_bytes ?? row.done_bytes);
    return [size, folderOf(row)].join(' · ') + (row.finished_at ? `  ${formatWhen(row.finished_at, now)}` : '');
}

// ---- notices ----

/** Default longest retry wait (node setting “Longest retry wait”). */
export const RETRY_MAX_SECS = 3600;

/**
 * How long a job has been retrying, from its attempt count: 10 s doubling,
 * capped at the node's longest wait. It ignores jitter and time spent
 * downloading between attempts, which only makes it later, never earlier.
 */
export function retryingForSecs(attempt: number, maxSecs = RETRY_MAX_SECS): number {
    let total = 0;
    for (let i = 0; i < attempt; i++) {
        total += Math.min(10 * 2 ** i, maxSecs);
    }
    return total;
}

export const STUCK_AFTER_SECS = 24 * 3600;

export function isStuck(row: Row, maxSecs = RETRY_MAX_SECS): boolean {
    return row.state === 'Retrying' && retryingForSecs(row.attempt, maxSecs) >= STUCK_AFTER_SECS;
}

/** True when the node saved under another name than the one asked for (N4). */
export function renamedByNode(asked: string | undefined, used: string): boolean {
    return !!asked && asked !== used && / \(\d+\)(\.[^.]*)?$/.test(used);
}

export type Blocker = { id: 'too-old' | 'off' | 'blocked' | 'no-folder'; title: string; body: string; secondary?: string; action?: string };

/**
 * Why nothing can be started on this node, if anything stops it (B8, B9, L3).
 * Order matters: an agent too old to download is the first thing to fix, an
 * organisation block outranks the node's own switch.
 */
export function blockerFor(caps: FetchCaps, nodeName: string, canConfigure: boolean): Blocker | null {
    if (!caps.agent_supported) {
        return {
            id: 'too-old',
            title: 'Too old',
            body: `${nodeName} runs an agent that cannot download. Update the agent on that machine, then try again.`,
        };
    }
    if (caps.lock === 'Organisation') {
        return {
            id: 'blocked',
            title: 'Blocked',
            body: `Your organisation does not allow downloads on ${nodeName}.`,
            secondary: 'An owner or admin of the organisation can change this under Organisation → Downloads.',
        };
    }
    if (!caps.http) {
        return {
            id: 'off',
            title: 'Downloads are off',
            body: `Downloads are turned off for ${nodeName}.`,
            secondary: canConfigure ? "You can turn them on in the node's settings." : "Ask the node's owner to turn them on.",
            action: canConfigure ? 'Open node settings' : undefined,
        };
    }
    if (caps.lock === 'NoFolder') {
        return {
            id: 'no-folder',
            title: 'No download folder',
            body: "The download folder on this node is missing or can't be written.",
            secondary: 'Someone who can configure the node can pick another one.',
            action: canConfigure ? 'Open node settings' : undefined,
        };
    }
    return null;
}

/**
 * Whether a Cancelled reason is the node's free-space check (K5), which gets
 * its own dialog. The node words it as “needs X … has Y free” or “not enough
 * space”; until the protocol carries a code for it, the wording decides.
 */
export function isNoSpace(reason: string | null | undefined): boolean {
    return !!reason && /not enough (disk )?space|disk (is )?full|needs [\d.]+ ?[kmgt]?b\b.*\bfree\b/i.test(reason);
}
