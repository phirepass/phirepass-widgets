import type { Browsing, FetchCaps, FetchJob, FetchOptions, FetchSource, SubscribeScope } from '../common/fetch';
import type { SFTPListItem } from '../common/protocol';

/**
 * A scriptable stand-in for `phirepass-channel`'s `Channel`, for stories and
 * tests. Pass it through a widget's `channelFactory` and the real widget runs
 * against it: it authenticates, opens its tunnel and handles the same frames.
 *
 * Every call is recorded in `calls`. `emit()` pushes any frame at the widget.
 */

export type Call = { method: string; args: unknown[] };

type Cb<T = unknown> = (value: T) => void;

export type DownloadScript = {
    caps?: FetchCaps;
    jobs?: FetchJob[];
    /** Answer to `DownloadWhere`. Default: mapped into the folder asked about. */
    where?: (browsing: Browsing) => { saves_to: string; mapped: boolean };
    /** Sub-folders for the picker, keyed by sub-dir ('' for the root). */
    folders?: Record<string, string[]>;
    /**
     * What happens after `DownloadStart`. Default: accepted, then the node reports
     * the job Downloading. `'silent'`: accepted, and the node never reports
     * (offline). `'refuse'`: the node answers Cancelled with `refuseReason`.
     * `'error'`: the server answers an `Error` frame. `'hang'`: nothing at all.
     */
    onStart?: 'progress' | 'queued' | 'silent' | 'refuse' | 'error' | 'hang';
    refuseReason?: string;
    /** The name the node uses for a started link (to show N4). */
    savedAs?: string;
    /** Advance Downloading rows every second, for a live drawer. */
    live?: boolean;
};

export type MockOptions = {
    /** Delay before each answer, in ms. */
    latency?: number;
    /** `fail`: the server rejects the token. `never`: no answer at all. */
    auth?: 'ok' | 'fail' | 'never';
    /** `refuse`: the connection errors and closes. `never`: it never opens. */
    connect?: 'ok' | 'refuse' | 'never';
    version?: string;
    /** SFTP folders by path. */
    sftp?: { cwd: string; tree: Record<string, SFTPListItem[]>; requires?: 'username' | 'password' | 'both'; streams?: boolean };
    /** Bytes to print when an SSH tunnel opens, and whether keystrokes echo back. */
    ssh?: { banner?: string; echo?: boolean; requires?: 'username' | 'password' };
    rdp?: { ticket?: boolean; error?: string };
    /** Omit to build a channel that predates Remote Fetch. */
    downloads?: DownloadScript;
};

const ErrorKind = { Generic: 0, Authentication: 10, RequiresUsername: 100, RequiresPassword: 110, RequiresUsernamePassword: 120 };

let uuidSeq = 0x1000;

function uuid(): string {
    uuidSeq++;
    return `11111111-2222-4333-8444-${uuidSeq.toString(16).padStart(12, '0')}`;
}

function nameFromSource(source: FetchSource, savedAs?: string): { name: string; kind: FetchJob['kind'] } {
    if ('Http' in source) {
        const fromUrl = (() => {
            try {
                const last = new URL(source.Http.url).pathname.split('/').filter(Boolean).pop();
                return last ? decodeURIComponent(last) : 'download';
            } catch {
                return 'download';
            }
        })();
        return { name: savedAs ?? source.Http.save_as ?? fromUrl, kind: 'Http' };
    }
    if ('Magnet' in source) {
        const dn = new URLSearchParams(source.Magnet.uri.split('?')[1] ?? '').get('dn');
        return { name: dn ?? source.Magnet.uri.slice(0, 40), kind: 'Torrent' };
    }
    if ('TorrentFile' in source) {
        return { name: source.TorrentFile.name.replace(/\.torrent$/i, ''), kind: 'Torrent' };
    }
    if ('TorrentPath' in source) {
        return { name: source.TorrentPath.path.split('/').pop()!.replace(/\.torrent$/i, ''), kind: 'Torrent' };
    }
    return { name: source.Node.name, kind: 'Node' };
}

export class MockChannel {
    readonly calls: Call[] = [];
    readonly jobs = new Map<string, FetchJob>();
    private cb: { open?: Cb<void>; close?: Cb<void>; error?: Cb<Error>; message?: Cb; protocol?: Cb } = {};
    private connected = false;
    private timers = new Set<ReturnType<typeof setTimeout>>();
    private ticker?: ReturnType<typeof setInterval>;

    constructor(
        readonly endpoint: string,
        readonly nodeId: string,
        readonly options: MockOptions = {},
    ) {
        for (const j of options.downloads?.jobs ?? []) {
            this.jobs.set(j.download_id, { ...j });
        }
        if (!options.downloads) {
            // A channel from before Remote Fetch: the methods simply are not there.
            for (const m of Object.getOwnPropertyNames(MockChannel.prototype)) {
                if (m.startsWith('send_download_')) {
                    (this as Record<string, unknown>)[m] = undefined;
                }
            }
        }
        if (!options.sftp?.streams) {
            (this as Record<string, unknown>).send_sftp_open_stream = undefined;
        }
    }

    /** A `channelFactory` that builds one of these and keeps the last one built in `ref.current`. */
    static factory(options: MockOptions = {}, ref: { current?: MockChannel } = {}) {
        return (endpoint: string, nodeId: string) => (ref.current = new MockChannel(endpoint, nodeId, options));
    }

    private record(method: string, args: unknown[]) {
        this.calls.push({ method, args });
    }

    callsTo(method: string): unknown[][] {
        return this.calls.filter(c => c.method === method).map(c => c.args);
    }

    private later(fn: () => void, extra = 0) {
        const t = setTimeout(() => {
            this.timers.delete(t);
            fn();
        }, (this.options.latency ?? 0) + extra);
        this.timers.add(t);
    }

    /** Pushes a frame at the widget, as the server would. */
    emit(web: Record<string, unknown> & { type: string }) {
        this.cb.protocol?.({ version: 1, encoding: 'JSON', data: { web } });
    }

    /** Sends the node's latest word on a download to the widget. */
    progress(job: FetchJob) {
        if (job.state === 'Deleted') {
            this.jobs.delete(job.download_id);
        } else {
            this.jobs.set(job.download_id, job);
        }
        this.emit({ type: 'DownloadProgress', node_id: this.nodeId, job });
    }

    update(downloadId: string, patch: Partial<FetchJob>) {
        const current = this.jobs.get(downloadId);
        if (current) {
            this.progress({ ...current, ...patch });
        }
    }

    /** Drops the connection, as a network failure would. */
    drop() {
        this.connected = false;
        this.cb.close?.();
    }

    // ---- connection ----

    connect() {
        this.record('connect', []);
        const mode = this.options.connect ?? 'ok';
        if (mode === 'never') {
            return;
        }
        this.later(() => {
            if (mode === 'refuse') {
                this.cb.error?.(new Error('Connection refused'));
                this.cb.close?.();
                return;
            }
            this.connected = true;
            this.cb.open?.();
        });
    }

    disconnect() {
        this.record('disconnect', []);
        this.connected = false;
        this.timers.forEach(t => clearTimeout(t));
        this.timers.clear();
        if (this.ticker) {
            clearInterval(this.ticker);
            this.ticker = undefined;
        }
    }

    is_connected() {
        return this.connected;
    }

    authenticate(token: string, nodeId: string) {
        this.record('authenticate', [token, nodeId]);
        const mode = this.options.auth ?? 'ok';
        if (mode === 'never') {
            return;
        }
        this.later(() => {
            if (mode === 'fail') {
                this.emit({ type: 'Error', kind: ErrorKind.Authentication, message: 'Your session has expired.' });
                return;
            }
            this.emit({ type: 'AuthSuccess', cid: 'cid-mock', version: this.options.version ?? '0.1.356' });
        });
    }

    start_heartbeat(ms: number) {
        this.record('start_heartbeat', [ms]);
    }

    stop_heartbeat() {
        this.record('stop_heartbeat', []);
    }

    on_connection_open(cb: Cb<void>) {
        this.cb.open = cb;
    }

    on_connection_close(cb: Cb<void>) {
        this.cb.close = cb;
    }

    on_connection_error(cb: Cb<Error>) {
        this.cb.error = cb;
    }

    on_connection_message(cb: Cb) {
        this.cb.message = cb;
    }

    on_protocol_message(cb: Cb) {
        this.cb.protocol = cb;
    }

    // ---- SSH ----

    open_ssh_tunnel(nodeId: string, serviceId: string, username?: string, password?: string) {
        this.record('open_ssh_tunnel', [nodeId, serviceId, username, password]);
        const req = this.options.ssh?.requires;
        if (req === 'username' && !username) {
            this.later(() => this.emit({ type: 'Error', kind: ErrorKind.RequiresUsername, message: 'Username required' }));
            return;
        }
        if (req === 'password' && !password) {
            this.later(() => this.emit({ type: 'Error', kind: ErrorKind.RequiresPassword, message: 'Password required' }));
            return;
        }
        this.later(() => {
            this.emit({ type: 'TunnelOpened', sid: 1 });
            const banner = this.options.ssh?.banner;
            if (banner) {
                this.emit({ type: 'TunnelData', node_id: nodeId, sid: 1, data: new TextEncoder().encode(banner) });
            }
        });
    }

    send_ssh_tunnel_data(nodeId: string, sid: number, data: string) {
        this.record('send_ssh_tunnel_data', [nodeId, sid, data]);
        if (!this.options.ssh?.echo) {
            return;
        }
        const out = data.replace(/\r/g, '\r\n');
        this.later(() => this.emit({ type: 'TunnelData', node_id: nodeId, sid, data: new TextEncoder().encode(out) }));
    }

    send_ssh_terminal_resize(...args: unknown[]) {
        this.record('send_ssh_terminal_resize', args);
    }

    // ---- RDP ----

    open_rdp_tunnel(...args: unknown[]) {
        this.record('open_rdp_tunnel', args);
        const rdp = this.options.rdp ?? {};
        this.later(() => {
            if (rdp.error) {
                this.emit({ type: 'Error', kind: ErrorKind.Generic, message: rdp.error });
            } else if (rdp.ticket) {
                this.emit({ type: 'RDPAuthorized', sid: 1, ticket: 'mock-ticket' });
            }
        });
    }

    // ---- SFTP ----

    open_sftp_tunnel(nodeId: string, serviceId: string, username?: string, password?: string) {
        this.record('open_sftp_tunnel', [nodeId, serviceId, username, password]);
        const req = this.options.sftp?.requires;
        const kind =
            req === 'both' && !username && !password
                ? ErrorKind.RequiresUsernamePassword
                : req === 'username' && !username
                  ? ErrorKind.RequiresUsername
                  : req === 'password' && !password
                    ? ErrorKind.RequiresPassword
                    : null;
        this.later(() => {
            if (kind !== null) {
                this.emit({ type: 'Error', kind, message: 'Credentials required' });
                return;
            }
            this.emit({ type: 'TunnelOpened', sid: 1 });
        });
    }

    send_sftp_list_data(nodeId: string, sid: number, path: string, msgId?: number) {
        this.record('send_sftp_list_data', [nodeId, sid, path, msgId]);
        const sftp = this.options.sftp;
        const resolved = path === '.' ? (sftp?.cwd ?? '/') : path;
        const items = sftp?.tree[resolved] ?? [];
        this.later(() =>
            this.emit({
                type: 'SFTPListItems',
                path: resolved,
                sid,
                msg_id: msgId,
                dir: { name: resolved.split('/').pop() || '/', path: resolved, kind: 'Folder', items, attributes: { size: 0, uid: 0, user: 'pi', gid: 0, group: 'pi', permissions: 0o40755, atime: 0, modified: 0 } },
            }),
        );
    }

    private opDone(sid: number, msgId?: number) {
        this.later(() => this.emit({ type: 'SFTPOpResult', sid, msg_id: msgId, result: { result: 'Done' } }));
    }

    send_sftp_mkdir(_n: string, sid: number, path: string, msgId?: number) {
        this.record('send_sftp_mkdir', [_n, sid, path, msgId]);
        this.opDone(sid, msgId);
    }

    send_sftp_rename(_n: string, sid: number, from: string, to: string, msgId?: number) {
        this.record('send_sftp_rename', [_n, sid, from, to, msgId]);
        this.opDone(sid, msgId);
    }

    send_sftp_chmod(_n: string, sid: number, path: string, mode: number, msgId?: number) {
        this.record('send_sftp_chmod', [_n, sid, path, mode, msgId]);
        this.opDone(sid, msgId);
    }

    send_sftp_remove(_n: string, sid: number, path: string, recursive: boolean, msgId?: number) {
        this.record('send_sftp_remove', [_n, sid, path, recursive, msgId]);
        this.opDone(sid, msgId);
    }

    send_sftp_read_file(_n: string, sid: number, path: string, msgId?: number) {
        this.record('send_sftp_read_file', [_n, sid, path, msgId]);
        const contents = new TextEncoder().encode(`# ${path}\nlisten: 0.0.0.0:8080\nlog_level: info\n`);
        this.later(() => this.emit({ type: 'SFTPOpResult', sid, msg_id: msgId, result: { result: 'FileContents', path, contents } }));
    }

    send_sftp_write_file(_n: string, sid: number, path: string, _contents: unknown, msgId?: number) {
        this.record('send_sftp_write_file', [_n, sid, path, msgId]);
        this.opDone(sid, msgId);
    }

    send_sftp_open_stream(_n: string, sid: number, path: string, msgId?: number) {
        this.record('send_sftp_open_stream', [_n, sid, path, msgId]);
        this.later(() => this.emit({ type: 'SFTPOpResult', sid, msg_id: msgId, result: { result: 'Stream', token: 'tok-mock', size: 1000, mime: 'video/mp4' } }));
    }

    send_sftp_download_start(...args: unknown[]) {
        this.record('send_sftp_download_start', args);
    }

    send_sftp_download_ack(...args: unknown[]) {
        this.record('send_sftp_download_ack', args);
    }

    send_sftp_upload_start(...args: unknown[]) {
        this.record('send_sftp_upload_start', args);
    }

    send_sftp_upload_chunk(...args: unknown[]) {
        this.record('send_sftp_upload_chunk', args);
    }

    // ---- Remote Fetch ----

    send_download_subscribe(scope: SubscribeScope) {
        this.record('send_download_subscribe', [scope]);
        const d = this.options.downloads;
        if (!d) {
            return;
        }
        this.later(() => {
            if (d.caps) {
                this.emit({ type: 'DownloadCaps', node_id: this.nodeId, caps: d.caps });
            }
            this.jobs.forEach(j => this.emit({ type: 'DownloadProgress', node_id: this.nodeId, job: j }));
        });
        if (d.live && !this.ticker) {
            this.ticker = setInterval(() => this.tick(), 1000);
        }
    }

    private tick() {
        this.jobs.forEach(j => {
            if (j.state !== 'Downloading' || !j.total_bytes || !j.down_bps) {
                return;
            }
            const done = Math.min(j.total_bytes, j.done_bytes + j.down_bps);
            const finished = done >= j.total_bytes;
            const files = j.files.map(f => ({ ...f, done_bytes: Math.min(f.size, f.done_bytes + j.down_bps), ready_from_start: j.in_order ? Math.min(f.size, f.ready_from_start + j.down_bps) : f.ready_from_start }));
            this.progress({
                ...j,
                done_bytes: done,
                files,
                state: finished ? (j.kind === 'Torrent' ? 'Seeding' : 'Completed') : 'Downloading',
                finished_at: finished ? Date.now() : null,
                seeding_since: finished && j.kind === 'Torrent' ? Date.now() : j.seeding_since,
                down_bps: finished ? 0 : j.down_bps,
            });
        });
    }

    send_download_where(nodeId: string, browsing: Browsing, msgId?: number) {
        this.record('send_download_where', [nodeId, browsing, msgId]);
        const d = this.options.downloads;
        const answer = d?.where?.(browsing) ?? { saves_to: browsing.path, mapped: true };
        this.later(() => this.emit({ type: 'DownloadWhereAnswer', msg_id: msgId, ...answer }));
    }

    send_download_folders(nodeId: string, subDir: string | null, msgId?: number) {
        this.record('send_download_folders', [nodeId, subDir, msgId]);
        const folders = this.options.downloads?.folders?.[subDir ?? ''] ?? [];
        this.later(() => this.emit({ type: 'DownloadFoldersAnswer', msg_id: msgId, folders }));
    }

    send_download_start(nodeId: string, source: FetchSource, subDir: string | null, browsing: Browsing | null, inOrder: boolean, options: FetchOptions, msgId?: number) {
        this.record('send_download_start', [nodeId, source, subDir, browsing, inOrder, options, msgId]);
        const d = this.options.downloads ?? {};
        const mode = d.onStart ?? 'progress';
        if (mode === 'hang') {
            return;
        }
        if (mode === 'error') {
            this.later(() => this.emit({ type: 'Error', kind: ErrorKind.Generic, message: d.refuseReason ?? 'You cannot download to this node.', msg_id: msgId }));
            return;
        }
        const id = uuid();
        const { name, kind } = nameFromSource(source, d.savedAs);
        const root = d.caps?.folder ?? '/srv/downloads';
        const dest = browsing ? (d.where?.(browsing) ?? { saves_to: browsing.path }).saves_to : root;
        this.later(() => {
            this.emit({ type: 'DownloadAccepted', msg_id: msgId, download_id: id });
            if (mode === 'silent') {
                return;
            }
            const base: FetchJob = {
                download_id: id,
                kind,
                name,
                dest_root: browsing ? dest : root,
                sub_dir: browsing ? null : subDir,
                state: mode === 'queued' ? 'Queued' : mode === 'refuse' ? 'Cancelled' : 'Downloading',
                done_bytes: 0,
                total_bytes: kind === 'Http' ? 120_000_000 : null,
                down_bps: mode === 'progress' ? 8_000_000 : 0,
                up_bps: 0,
                peers: 0,
                in_order: inOrder,
                started_at: Date.now(),
                finished_at: null,
                reason: mode === 'refuse' ? (d.refuseReason ?? 'This node does not download from private network addresses.') : null,
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
            };
            this.progress(base);
        }, 5);
    }

    send_download_stop(downloadId: string, discard: boolean, msgId?: number) {
        this.record('send_download_stop', [downloadId, discard, msgId]);
        this.later(() => this.update(downloadId, discard ? { state: 'Cancelled', done_bytes: 0, down_bps: 0, reason: null } : { state: 'Stopped', down_bps: 0, up_bps: 0 }));
    }

    send_download_resume(downloadId: string, ignoreWindow: boolean, msgId?: number) {
        this.record('send_download_resume', [downloadId, ignoreWindow, msgId]);
        this.later(() => {
            const j = this.jobs.get(downloadId);
            this.update(downloadId, { state: j?.state === 'Completed' ? 'Completed' : j?.done_bytes && j.total_bytes && j.done_bytes >= j.total_bytes ? 'Seeding' : 'Downloading', attempt: 0, retry_reason: null, next_attempt_at: null });
        });
    }

    send_download_set_order(downloadId: string, inOrder: boolean, msgId?: number) {
        this.record('send_download_set_order', [downloadId, inOrder, msgId]);
        this.later(() => this.update(downloadId, { in_order: inOrder }));
    }

    send_download_delete(downloadId: string, deleteFile: boolean, msgId?: number) {
        this.record('send_download_delete', [downloadId, deleteFile, msgId]);
        this.later(() => {
            const j = this.jobs.get(downloadId);
            if (j) {
                this.progress({ ...j, state: 'Deleted' });
            }
            // The node takes a moment to delete files: long enough to see “Deleting…”.
        }, 300);
    }
}
