import { Component, Element, Event, EventEmitter, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';
import { DownloadChannelFactory, DownloadChannelLike, supportsDownloads } from '../../common/channel';
import { Browsing, DOWNLOADER_MSG_ID_BASE, FetchCaps, FetchJob, ProtocolMessageWebDownload, isDownloadFrame } from '../../common/fetch';
import { ProtocolMessage, ProtocolMessageError, ProtocolMessageType, ProtocolMessageWebError } from '../../common/protocol';
import { formatBytes, formatRate } from './format';
import { EMPTY_FORM, FormState, buildStart, chooseTorrent, formModel, Note } from './form';
import {
    JobMap,
    Row,
    Tab,
    applyProgress,
    blockerFor,
    folderOf,
    isClearable,
    isFinished,
    isRunning,
    isStuck,
    joinPath,
    partPath,
    playCheck,
    renamedByNode,
    sortRows,
    streamUrl,
    summarize,
    isNoSpace,
    tabOf,
} from './jobs';
import { shortMagnet } from './source';
import { ConfirmDelete, ConfirmFastest, ConfirmStop, ConfirmTorrent, FolderPicker, Modal, NoSpace } from './views/dialogs';
import { FetchForm } from './views/fetch-form';
import { Icon } from './views/icons';
import { JobRow, RowActions } from './views/job-row';
import { Notice, NoticeKind, Notices } from './views/notices';
import { BlockerView, DrawerEmpty, Loading, SignedOut, StandaloneEmpty, Unreachable, Unsupported } from './views/states';

/** After `DownloadAccepted`, how long the dialog waits for the node's first word before it closes anyway. */
const NODE_SILENCE_MS = 8_000;
const NOTICE_MS = 6_000;
const TORRENT_ACK_KEY = 'phirepass.downloader.torrent-ack';

type Connection = 'connecting' | 'ready' | 'unreachable' | 'signed-out' | 'unsupported';

type Confirm =
    | { kind: 'stop'; row: Row; discard: boolean }
    | { kind: 'delete'; row: Row; deleteFile: boolean }
    | { kind: 'fastest'; row: Row }
    | { kind: 'torrent'; dontAsk: boolean }
    | { kind: 'space'; reason: string };

type Starting = { msgId: number; askedName?: string; downloadId?: string; silence?: number };

type Picker = { path: string[]; folders: string[] | null; msgId: number; error?: string; newName: string | null };

type Player = { src: string; name: string; downloadId: string; mime?: string };

function readTorrentAck(): boolean {
    try {
        return window.localStorage.getItem(TORRENT_ACK_KEY) === '1';
    } catch {
        return false;
    }
}

function writeTorrentAck() {
    try {
        window.localStorage.setItem(TORRENT_ACK_KEY, '1');
    } catch {
        // A private window keeps no storage: the question simply comes back next time.
    }
}

/**
 * Remote Fetch: paste a link or a magnet, or drop a `.torrent`, and the node
 * downloads it into its own download folder.
 *
 * Two forms, one component. **Embedded** in the SFTP browser (`compact`), it
 * shares the host's channel, which forwards it the `Download*` frames through
 * `receive()`, and saves into the folder on screen when the node can map it.
 * **Standalone**, it builds its own channel, signs in with `token`, and saves
 * into the download folder or a sub-folder of it. Either way it never asks for
 * a login: the node writes its own files.
 *
 * The widget only sends events and shows progress. Downloads run on the node
 * and carry on after the tab closes.
 */
@Component({
    tag: 'phirepass-downloader',
    styleUrl: 'phirepass-downloader.css',
    shadow: true,
})
export class PhirepassDownloader {
    @Element() el!: HTMLElement;

    private ownChannel = false;
    private msgId = DOWNLOADER_MSG_ID_BASE;
    private noticeId = 1;
    private seenNotices = new Set<string>();
    private torrentAcked = readTorrentAck();
    private noticeTimers = new Map<number, number>();
    private whereMsgId?: number;

    @Prop() nodeId!: string;

    /** What to call the node in sentences; the id is a uuid nobody reads. */
    @Prop() nodeLabel?: string;

    /** Session token, for the standalone form. Not needed when `channel` is given. */
    @Prop() token?: string;

    /**
     * A channel to share instead of opening one: the SFTP client passes its
     * own. The host must forward `Download*` frames (and `Error`s whose
     * `msg_id` is at or above `DOWNLOADER_MSG_ID_BASE`) to `receive()`, and set
     * `connected` once the channel is authenticated.
     */
    @Prop() channel?: DownloadChannelLike;

    /** With an injected `channel`: whether it is authenticated and usable. */
    @Prop() connected = false;

    /** Builds the channel in place of a WebSocket, for demos and tests (see `ChannelFactory`). */
    @Prop() channelFactory?: DownloadChannelFactory;

    /** The SFTP/SSH service the host is browsing, so the node can map `browsingPath`. */
    @Prop() browsingService?: string;

    /** The folder on screen in the host. Downloads land here when it lies inside the download folder. */
    @Prop({ mutable: true }) browsingPath?: string;

    /** The drawer layout used inside the SFTP browser. */
    @Prop({ reflect: true }) compact = false;

    /** Base URL for `/api/web/stream/…`. Defaults to the server the channel talks to. */
    @Prop() streamBase?: string;

    /** Whether the viewer may configure this node, which only changes advice text (B9). */
    @Prop() canConfigure = false;

    /** Open the built-in player on Play, unless a `phirepassPlay` listener calls `preventDefault()`. */
    @Prop() inlinePlayer = true;

    @Prop() serverHost = 'phirepass.com';
    @Prop() serverPort = 443;
    @Prop() serverId?: string;
    @Prop() allowInsecure = false;
    @Prop() heartbeatInterval = 30_000;

    /** A finished download, once per job. The SFTP client refreshes when it lands in the open folder. */
    @Event({ eventName: 'phirepassFetchCompleted', bubbles: true, composed: true })
    fetchCompleted!: EventEmitter<{ download_id: string; dest_root: string; sub_dir: string | null; name: string }>;

    /** Play was pressed. Cancelable: prevent it to open your own player instead. */
    @Event({ eventName: 'phirepassPlay', bubbles: true, composed: true, cancelable: true })
    play!: EventEmitter<{ src: string; name: string; downloadId: string }>;

    /** How many downloads are running, for a badge. */
    @Event({ eventName: 'phirepassActiveCount', bubbles: true, composed: true })
    activeCount!: EventEmitter<{ n: number }>;

    /** “Show in folder” on a finished row. */
    @Event({ eventName: 'phirepassShowInFolder', bubbles: true, composed: true })
    showInFolder!: EventEmitter<{ path: string; name: string }>;

    /** “Open node settings” (B9, no folder). */
    @Event({ eventName: 'phirepassOpenNodeSettings', bubbles: true, composed: true })
    openNodeSettings!: EventEmitter<{ nodeId: string }>;

    /** “Sign in” (X3). */
    @Event({ eventName: 'phirepassSignIn', bubbles: true, composed: true })
    signIn!: EventEmitter<void>;

    @State() connection: Connection = 'connecting';
    @State() caps: FetchCaps | null = null;
    @State() jobs: JobMap = {};
    @State() tab: Tab = 'active';
    @State() drawerOpen = false;
    @State() dialogOpen = false;
    @State() unread = 0;
    @State() form: FormState = EMPTY_FORM;
    @State() where: { saves_to: string; mapped: boolean } | null = null;
    @State() starting: Starting | null = null;
    @State() refusal: Note | null = null;
    @State() confirm: Confirm | null = null;
    @State() notices: Notice[] = [];
    @State() subDir: string | null = null;
    @State() picker: Picker | null = null;
    @State() player: Player | null = null;

    private get name(): string {
        return this.nodeLabel || this.nodeId;
    }

    private get ch(): DownloadChannelLike | undefined {
        return this.channel ?? this.ownedChannel;
    }

    private ownedChannel?: DownloadChannelLike;

    // ---------------------------------------------------------------- lifecycle

    async componentWillLoad() {
        if (this.channel) {
            this.adoptChannel();
            return;
        }
        await this.openOwnChannel();
    }

    disconnectedCallback() {
        this.noticeTimers.forEach(t => window.clearTimeout(t));
        this.noticeTimers.clear();
        if (this.starting?.silence) {
            window.clearTimeout(this.starting.silence);
        }
        if (this.ownChannel && this.ownedChannel) {
            this.ownedChannel.stop_heartbeat();
            this.ownedChannel.disconnect();
        }
    }

    @Watch('channel')
    onChannel() {
        if (this.channel) {
            this.adoptChannel();
        }
    }

    @Watch('connected')
    onConnected(now: boolean, before: boolean) {
        if (!this.channel) {
            return;
        }
        if (now && !before) {
            this.subscribe();
        } else if (!now && before) {
            this.connection = 'unreachable';
        }
    }

    @Watch('browsingPath')
    @Watch('browsingService')
    onBrowsing() {
        this.where = null;
        if (this.dialogOpen) {
            this.askWhere();
        }
    }

    @Watch('nodeId')
    onNode(now: string, before: string) {
        if (now === before) {
            return;
        }
        this.jobs = {};
        this.caps = null;
        this.where = null;
        if (this.channel) {
            if (this.connected) {
                this.subscribe();
            }
        } else if (this.ownedChannel) {
            this.ownedChannel.disconnect();
            void this.openOwnChannel();
        }
    }

    private adoptChannel() {
        this.ownChannel = false;
        if (!supportsDownloads(this.channel)) {
            this.connection = 'unsupported';
            return;
        }
        this.connection = 'connecting';
        if (this.connected) {
            this.subscribe();
        }
    }

    private endpoint(): string {
        const protocol = this.allowInsecure ? 'ws' : 'wss';
        const defaultPort = (!this.allowInsecure && this.serverPort === 443) || (this.allowInsecure && this.serverPort === 80);
        return `${protocol}://${this.serverHost}${defaultPort ? '' : `:${this.serverPort}`}/api/web/ws`;
    }

    private defaultStreamBase(): string {
        const protocol = this.allowInsecure ? 'http' : 'https';
        const defaultPort = (!this.allowInsecure && this.serverPort === 443) || (this.allowInsecure && this.serverPort === 80);
        return `${protocol}://${this.serverHost}${defaultPort ? '' : `:${this.serverPort}`}`;
    }

    private async openOwnChannel() {
        this.ownChannel = true;
        if (!this.token) {
            this.connection = 'signed-out';
            return;
        }
        if (!this.nodeId) {
            return;
        }
        if (!this.channelFactory) {
            await init();
        }
        const channel: DownloadChannelLike = this.channelFactory
            ? this.channelFactory(this.endpoint(), this.nodeId, this.serverId)
            : this.serverId
              ? new PhirepassChannel(this.endpoint(), this.nodeId, this.serverId)
              : new PhirepassChannel(this.endpoint(), this.nodeId);
        this.ownedChannel = channel;

        if (!supportsDownloads(channel)) {
            this.connection = 'unsupported';
            return;
        }

        channel.on_connection_open(() => channel.authenticate(this.token!, this.nodeId));
        channel.on_connection_close(() => {
            if (this.connection !== 'signed-out') {
                this.connection = 'unreachable';
            }
        });
        channel.on_connection_error(() => {
            if (this.connection !== 'signed-out') {
                this.connection = 'unreachable';
            }
        });
        channel.on_connection_message(() => undefined);
        channel.on_protocol_message((msg: ProtocolMessage) => this.dispatch(msg.data.web as any));
        this.connection = 'connecting';
        channel.connect();
    }

    private reconnect() {
        if (this.ownChannel) {
            this.ownedChannel?.disconnect();
            void this.openOwnChannel();
        } else if (this.connected) {
            this.subscribe();
        }
    }

    // ---------------------------------------------------------------- inbound

    /**
     * Hands this widget a frame from a shared channel: `Download*` frames, and
     * `Error`s answering one of its `msg_id`s. Anything else is ignored.
     */
    @Method()
    async receive(msg: ProtocolMessage | { data: { web: unknown } }) {
        this.dispatch((msg as ProtocolMessage).data.web as any);
    }

    private dispatch(web: ProtocolMessageWebDownload | ProtocolMessageWebError | { type: string }) {
        if (web.type === ProtocolMessageType.AuthSuccess) {
            this.ownedChannel?.start_heartbeat(Math.max(30_000, this.heartbeatInterval));
            this.subscribe();
            return;
        }
        if (web.type === ProtocolMessageType.Error) {
            this.handleError(web as ProtocolMessageWebError);
            return;
        }
        if (!isDownloadFrame(web)) {
            return;
        }
        switch (web.type) {
            case 'DownloadCaps':
                if (web.node_id === this.nodeId) {
                    this.caps = web.caps;
                    this.connection = 'ready';
                }
                break;
            case 'DownloadProgress':
                if (web.node_id === this.nodeId) {
                    this.onProgress(web.job);
                }
                break;
            case 'DownloadAccepted':
                this.onAccepted(web.msg_id, web.download_id);
                break;
            case 'DownloadWhereAnswer':
                if (web.msg_id === this.whereMsgId) {
                    this.where = { saves_to: web.saves_to, mapped: web.mapped };
                }
                break;
            case 'DownloadFoldersAnswer':
                if (this.picker && web.msg_id === this.picker.msgId) {
                    this.picker = { ...this.picker, folders: [...web.folders].sort((a, b) => a.localeCompare(b)) };
                }
                break;
        }
    }

    private handleError(error: ProtocolMessageWebError) {
        if (error.msg_id !== undefined && error.msg_id === this.starting?.msgId) {
            this.clearStarting();
            this.refusal = { tone: 'err', title: 'Refused', body: error.message || 'The server refused this download.' };
            return;
        }
        if (this.picker && error.msg_id === this.picker.msgId) {
            this.picker = { ...this.picker, folders: [], error: error.message };
            return;
        }
        if (error.msg_id !== undefined && error.msg_id >= DOWNLOADER_MSG_ID_BASE) {
            this.notify('error', 'That did not work', error.message || 'The server refused it.');
            return;
        }
        if (this.ownChannel && error.kind === ProtocolMessageError.Authentication) {
            this.connection = 'signed-out';
        }
    }

    private subscribe() {
        const ch = this.ch;
        if (!supportsDownloads(ch)) {
            this.connection = 'unsupported';
            return;
        }
        // A fresh subscription answers with caps and every current row.
        this.jobs = {};
        ch.send_download_subscribe({ Node: this.nodeId });
        if (this.dialogOpen) {
            this.askWhere();
        }
    }

    private onProgress(job: FetchJob) {
        const before = this.jobs[job.download_id];
        const { jobs, completed } = applyProgress(this.jobs, job);
        this.jobs = jobs;
        this.emitCount();

        if (this.starting?.downloadId === job.download_id && !before) {
            this.onFirstProgress(job);
        }

        if (completed) {
            this.fetchCompleted.emit({ download_id: job.download_id, dest_root: job.dest_root, sub_dir: job.sub_dir, name: job.name });
            if (!this.drawerOpen && this.compact) {
                this.unread++;
            }
            this.notify('completed', 'Download complete', `${job.name} → ${folderOf(job)}`, {
                label: 'Show',
                run: () => this.showInFolder.emit({ path: folderOf(job), name: job.name }),
            });
        }

        const row = this.jobs[job.download_id];
        if (row && isStuck(row) && !this.seenNotices.has(`stuck:${job.download_id}`)) {
            this.seenNotices.add(`stuck:${job.download_id}`);
            this.notify('stuck', 'Still retrying after a day', `${job.name} · ${job.retry_reason ?? 'no answer'}`, { label: 'Show', run: () => this.showRetrying() }, true);
        }
    }

    private onAccepted(msgId: number, downloadId: string) {
        if (!this.starting || this.starting.msgId !== msgId) {
            return;
        }
        if (this.jobs[downloadId]) {
            // The node already answered: progress beat the acceptance here.
            this.onFirstProgress(this.jobs[downloadId]);
            return;
        }
        const silence = window.setTimeout(() => this.nodeSilent(downloadId), NODE_SILENCE_MS);
        this.starting = { ...this.starting, downloadId, silence };
    }

    /** The server took it but the node has not spoken: it is offline, and the row says it waits. */
    private nodeSilent(downloadId: string) {
        if (this.starting?.downloadId !== downloadId || this.jobs[downloadId]) {
            return;
        }
        const name = this.starting.askedName ?? 'Download';
        const now = Date.now();
        const placeholder: Row = {
            download_id: downloadId,
            kind: 'Unknown',
            name,
            dest_root: this.where?.saves_to ?? this.caps?.folder ?? '',
            sub_dir: null,
            state: 'Queued',
            done_bytes: 0,
            total_bytes: null,
            down_bps: 0,
            up_bps: 0,
            peers: 0,
            in_order: true,
            started_at: now,
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
            waitingForNode: true,
        };
        this.jobs = { ...this.jobs, [downloadId]: placeholder };
        this.clearStarting();
        this.closeDialog(true);
        this.notify('queued', `Waiting for ${this.name}`, `${name} starts when the node reports in.`);
    }

    private onFirstProgress(job: FetchJob) {
        const asked = this.starting?.askedName;
        this.clearStarting();
        if (job.state === 'Cancelled') {
            const reason = job.reason ?? 'The node refused this download.';
            if (isNoSpace(reason)) {
                this.confirm = { kind: 'space', reason };
            } else if (this.dialogOpen || !this.compact) {
                this.refusal = { tone: 'err', title: 'Refused', body: reason };
            }
            return;
        }
        this.closeDialog(true);
        if (job.state === 'Queued') {
            const running = Object.values(this.jobs).filter(r => r.state === 'Downloading').length;
            this.notify('queued', 'Added to the queue', `${running} ${running === 1 ? 'download is' : 'downloads are'} already running on this node`);
        } else {
            this.notify('started', 'Download started', `${job.name} → ${folderOf(job)}`);
        }
        if (renamedByNode(asked, job.name)) {
            this.notify('renamed', `Saved as ${job.name}`, `A file named ${asked} was already in ${folderOf(job)}`);
        }
    }

    private clearStarting() {
        if (this.starting?.silence) {
            window.clearTimeout(this.starting.silence);
        }
        this.starting = null;
    }

    private emitCount() {
        this.activeCount.emit({ n: Object.values(this.jobs).filter(isRunning).length });
    }

    private notify(kind: NoticeKind, title: string, detail: string, action?: Notice['action'], sticky = false) {
        const id = this.noticeId++;
        this.notices = [...this.notices.slice(-2), { id, kind, title, detail, action, sticky }];
        if (!sticky) {
            this.noticeTimers.set(
                id,
                window.setTimeout(() => this.dismiss(id), NOTICE_MS),
            );
        }
    }

    private dismiss(id: number) {
        const t = this.noticeTimers.get(id);
        if (t) {
            window.clearTimeout(t);
            this.noticeTimers.delete(id);
        }
        this.notices = this.notices.filter(n => n.id !== id);
    }

    private showRetrying() {
        this.tab = 'retrying';
        this.drawerOpen = true;
    }

    // ---------------------------------------------------------------- public methods

    /** Opens the Fetch dialog (and the drawer behind it). `path` updates the folder on screen. */
    @Method()
    async openFetch(path?: string) {
        if (path !== undefined && path !== this.browsingPath) {
            this.browsingPath = path;
        }
        this.drawerOpen = true;
        this.unread = 0;
        this.dialogOpen = true;
        this.refusal = null;
        this.askWhere();
    }

    /** Opens or closes the drawer (embedded). */
    @Method()
    async toggleDrawer(open?: boolean) {
        this.drawerOpen = open ?? !this.drawerOpen;
        if (this.drawerOpen) {
            this.unread = 0;
        }
    }

    /** The running download whose part file this is, so the SFTP client can offer K3 instead of a plain delete. */
    @Method()
    async jobForPath(path: string): Promise<{ download_id: string; name: string } | null> {
        const row = Object.values(this.jobs).find(r => !isFinished(r.state) && r.state !== 'Cancelled' && partPath(r) === path);
        return row ? { download_id: row.download_id, name: row.name } : null;
    }

    /** Deletes a download (an unfinished one always loses its part file). */
    @Method()
    async deleteDownload(downloadId: string, deleteFile = false) {
        const row = this.jobs[downloadId];
        if (row) {
            this.sendDelete(row, deleteFile);
        }
    }

    /**
     * The path of a `.torrent` on the node relative to the download folder, or
     * null when it lies outside it (then C's menu item is not offered).
     */
    @Method()
    async torrentPathFor(path: string): Promise<string | null> {
        const root = this.caps?.folder;
        if (!root || !this.caps?.torrents || !/\.torrent$/i.test(path) || blockerFor(this.caps, this.name, this.canConfigure)) {
            return null;
        }
        const prefix = root.endsWith('/') ? root : `${root}/`;
        return path.startsWith(prefix) ? path.slice(prefix.length) : null;
    }

    /** C: download the contents of a `.torrent` already on the node, into the folder it sits in. */
    @Method()
    async startTorrentPath(path: string, inOrder = false) {
        const rel = await this.torrentPathFor(path);
        const ch = this.ch;
        if (rel === null || !supportsDownloads(ch)) {
            return false;
        }
        const msgId = this.nextMsgId();
        this.starting = { msgId, askedName: rel.split('/').pop()?.replace(/\.torrent$/i, '') };
        const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : null;
        ch.send_download_start(this.nodeId, { TorrentPath: { path: rel } }, dir, null, inOrder, { source_auth: null, ignore_window: false }, msgId);
        this.drawerOpen = true;
        return true;
    }

    // ---------------------------------------------------------------- outbound

    private nextMsgId(): number {
        this.msgId = this.msgId >= 0xffff_fff0 ? DOWNLOADER_MSG_ID_BASE : this.msgId + 1;
        return this.msgId;
    }

    private browsing(): Browsing | null {
        return this.compact && this.browsingService && this.browsingPath ? { service_id: this.browsingService, path: this.browsingPath } : null;
    }

    private askWhere() {
        const browsing = this.browsing();
        const ch = this.ch;
        if (!browsing || !supportsDownloads(ch) || this.connection !== 'ready') {
            return;
        }
        this.whereMsgId = this.nextMsgId();
        ch.send_download_where(this.nodeId, browsing, this.whereMsgId);
    }

    private destination(): { path: string; hint?: string } | null {
        if (this.browsing()) {
            if (!this.where) {
                return { path: this.browsingPath!, hint: 'Asking the node where this lands…' };
            }
            return this.where.mapped
                ? { path: this.where.saves_to }
                : { path: this.where.saves_to, hint: `This folder is outside ${this.name}'s download folder. The file will be saved to ${this.where.saves_to}.` };
        }
        const root = this.caps?.folder;
        return root ? { path: joinPath(root, this.subDir) } : null;
    }

    private formReady(): boolean {
        if (this.starting || this.connection !== 'ready') {
            return false;
        }
        return this.browsing() ? !!this.where : true;
    }

    private async pickTorrent(file: File) {
        const chosen = chooseTorrent(file);
        if (!chosen.error) {
            chosen.contents = new Uint8Array(await file.arrayBuffer());
        }
        this.form = { ...this.form, torrent: chosen, text: '', order: null };
        this.refusal = null;
    }

    private start(skipTorrentAsk = false) {
        const model = formModel(this.form, this.caps, this.formReady());
        const plan = buildStart(this.form);
        const ch = this.ch;
        if (!model.canStart || !plan || !supportsDownloads(ch)) {
            return;
        }
        if (model.isTorrent && !this.torrentAcked && !skipTorrentAsk) {
            this.confirm = { kind: 'torrent', dontAsk: false };
            return;
        }
        const msgId = this.nextMsgId();
        const askedName = model.askedName ?? (this.form.torrent ? this.form.torrent.name.replace(/\.torrent$/i, '') : model.detected.kind === 'magnet' ? shortMagnet(model.detected.uri) : undefined);
        this.starting = { msgId, askedName };
        this.refusal = null;
        const browsing = this.browsing();
        ch.send_download_start(this.nodeId, plan.source, browsing ? null : this.subDir, browsing, plan.inOrder, plan.options, msgId);
    }

    private closeDialog(started = false) {
        this.dialogOpen = false;
        this.refusal = null;
        if (started) {
            this.form = EMPTY_FORM;
            this.drawerOpen = true;
        }
    }

    private sendStop(row: Row, discard: boolean) {
        const ch = this.ch;
        if (supportsDownloads(ch)) {
            ch.send_download_stop(row.download_id, discard, this.nextMsgId());
        }
    }

    private sendDelete(row: Row, deleteFile: boolean) {
        const ch = this.ch;
        if (!supportsDownloads(ch)) {
            return;
        }
        ch.send_download_delete(row.download_id, deleteFile, this.nextMsgId());
        this.jobs = { ...this.jobs, [row.download_id]: { ...row, deleting: true } };
    }

    private actions: RowActions = {
        play: row => this.playRow(row),
        pause: row => this.sendStop(row, false),
        resume: (row, ignoreWindow = false) => {
            const ch = this.ch;
            if (supportsDownloads(ch)) {
                ch.send_download_resume(row.download_id, ignoreWindow, this.nextMsgId());
            }
        },
        stop: row => (this.confirm = { kind: 'stop', row, discard: false }),
        remove: row => {
            if (row.state === 'Completed' || row.state === 'Seeding' || row.state === 'Stopped') {
                this.confirm = { kind: 'delete', row, deleteFile: false };
            } else {
                // Cancelled: its part is already gone, so there is nothing to lose.
                this.sendDelete(row, false);
            }
        },
        setOrder: (row, inOrder) => {
            if (!inOrder && this.player?.downloadId === row.download_id) {
                this.confirm = { kind: 'fastest', row };
                return;
            }
            this.sendOrder(row, inOrder);
        },
        showInFolder: row => this.showInFolder.emit({ path: folderOf(row), name: row.name }),
    };

    private sendOrder(row: Row, inOrder: boolean) {
        const ch = this.ch;
        if (supportsDownloads(ch)) {
            ch.send_download_set_order(row.download_id, inOrder, this.nextMsgId());
        }
    }

    private playRow(row: Row) {
        const check = playCheck(row);
        if (!check.play || !check.file) {
            return;
        }
        const src = streamUrl(this.streamBase || this.defaultStreamBase(), this.nodeId, row.download_id, check.file.index);
        const event = this.play.emit({ src, name: check.file.name, downloadId: row.download_id });
        if (!event.defaultPrevented && this.inlinePlayer) {
            this.player = { src, name: check.file.name, downloadId: row.download_id };
        }
    }

    private clearFinished() {
        Object.values(this.jobs)
            .filter(isClearable)
            .forEach(row => this.sendDelete(row, false));
    }

    // ---------------------------------------------------------------- folder picker (H6)

    private canPickFolder(): boolean {
        return !!this.caps?.folder && typeof this.ch?.send_download_folders === 'function';
    }

    private listFolders(path: string[]) {
        const msgId = this.nextMsgId();
        this.picker = { path, folders: null, msgId, newName: null };
        this.ch?.send_download_folders?.(this.nodeId, path.length ? path.join('/') : null, msgId);
    }

    private savePicker() {
        if (!this.picker) {
            return;
        }
        const segs = [...this.picker.path];
        const fresh = this.picker.newName?.trim();
        if (fresh) {
            segs.push(fresh);
        }
        this.subDir = segs.length ? segs.join('/') : null;
        this.picker = null;
    }

    // ---------------------------------------------------------------- render

    private renderConfirm() {
        const c = this.confirm;
        if (!c) {
            return null;
        }
        const cancel = () => (this.confirm = null);
        switch (c.kind) {
            case 'stop':
                return (
                    <ConfirmStop
                        row={c.row}
                        discard={c.discard}
                        onDiscard={discard => (this.confirm = { ...c, discard })}
                        onCancel={cancel}
                        onConfirm={() => {
                            this.sendStop(c.row, c.discard);
                            this.confirm = null;
                        }}
                    />
                );
            case 'delete':
                return (
                    <ConfirmDelete
                        row={c.row}
                        nodeName={this.name}
                        deleteFile={c.deleteFile}
                        onDeleteFile={deleteFile => (this.confirm = { ...c, deleteFile })}
                        onCancel={cancel}
                        onConfirm={() => {
                            this.sendDelete(c.row, c.deleteFile);
                            this.confirm = null;
                        }}
                    />
                );
            case 'fastest':
                return (
                    <ConfirmFastest
                        row={c.row}
                        onCancel={cancel}
                        onConfirm={() => {
                            this.player = null;
                            this.sendOrder(c.row, false);
                            this.confirm = null;
                        }}
                    />
                );
            case 'torrent':
                return (
                    <ConfirmTorrent
                        nodeName={this.name}
                        dontAsk={c.dontAsk}
                        onDontAsk={dontAsk => (this.confirm = { ...c, dontAsk })}
                        onCancel={cancel}
                        onConfirm={() => {
                            if (c.dontAsk) {
                                writeTorrentAck();
                                this.torrentAcked = true;
                            }
                            this.confirm = null;
                            this.start(true);
                        }}
                    />
                );
            case 'space':
                return <NoSpace reason={c.reason} onClose={cancel} />;
        }
    }

    private renderForm(layout: 'dialog' | 'inline') {
        const blocker = this.caps ? blockerFor(this.caps, this.name, this.canConfigure) : null;
        const onAction = () => this.openNodeSettings.emit({ nodeId: this.nodeId });
        if (blocker) {
            return layout === 'dialog' ? (
                <div class="dlg">
                    <div class="dlg-h">
                        <Icon name="fetch" />
                        <h4>Fetch into this folder</h4>
                    </div>
                    <BlockerView blocker={blocker} onAction={onAction} onClose={() => this.closeDialog()} />
                </div>
            ) : (
                <BlockerView blocker={blocker} onAction={onAction} />
            );
        }
        const model = formModel(this.form, this.caps, this.formReady());
        return (
            <FetchForm
                form={this.form}
                model={model}
                caps={this.caps}
                layout={layout}
                title={this.browsing() ? 'Fetch into this folder' : 'Add download'}
                destination={layout === 'dialog' || this.browsing() ? this.destination() : null}
                starting={!!this.starting}
                refusal={this.refusal}
                onChange={patch => {
                    this.form = { ...this.form, ...patch };
                    if ('text' in patch || 'torrent' in patch) {
                        this.refusal = null;
                    }
                }}
                onAuth={patch => (this.form = { ...this.form, auth: { ...this.form.auth, ...patch } })}
                onPickTorrent={file => void this.pickTorrent(file)}
                onStart={() => this.start()}
                onCancel={() => this.closeDialog()}
            />
        );
    }

    private renderRows(rows: Row[]) {
        const running = rows.filter(r => r.state === 'Downloading').length;
        return (
            <div class="jobs" role="list">
                {sortRows(rows).map(row => (
                    <JobRow row={row} actions={this.actions} running={running} compact={this.compact} />
                ))}
            </div>
        );
    }

    private renderStatus() {
        switch (this.connection) {
            case 'unsupported':
                return <Unsupported />;
            case 'signed-out':
                return <SignedOut onSignIn={() => this.signIn.emit()} />;
            case 'unreachable':
                return <Unreachable nodeName={this.name} onRetry={() => this.reconnect()} />;
            case 'connecting':
                return <Loading />;
            default:
                return null;
        }
    }

    private renderCompact() {
        const rows = Object.values(this.jobs);
        const sum = summarize(rows);
        const status = this.renderStatus();
        if (this.connection === 'unsupported') {
            return null;
        }
        const finished = rows.some(isClearable);
        const showStrip = !this.drawerOpen && (sum.active > 0 || this.unread > 0);
        const summary = [`${sum.active} active`, sum.percent !== null && !this.drawerOpen ? `${Math.round(sum.percent)}%` : '', formatRate(sum.downBps)].filter(Boolean).join(' · ');

        return [
            this.drawerOpen && (
                <section class="drawer" aria-label="Transfers">
                    <div class="drawer-h">
                        <h4>Transfers</h4>
                        <span class="sum">{summary}</span>
                        <span class="sp"></span>
                        {finished && (
                            <button type="button" class="lnk" onClick={() => this.clearFinished()}>
                                Clear finished
                            </button>
                        )}
                        <button type="button" class="ib" aria-label="Collapse transfers" title="Collapse" onClick={() => (this.drawerOpen = false)}>
                            <Icon name="chevron" size={12} />
                        </button>
                    </div>
                    <div class="drawer-b">{status ?? (rows.length ? this.renderRows(rows) : <DrawerEmpty />)}</div>
                </section>
            ),
            showStrip && (
                <button type="button" class="strip" aria-label="Show transfers" onClick={() => this.toggleDrawer(true)}>
                    <h4>Transfers</h4>
                    <span class="bar">
                        <i style={{ width: `${sum.percent ?? 0}%` }}></i>
                    </span>
                    <span class="sum">{this.unread && !sum.active ? `${this.unread} finished` : summary}</span>
                    <Icon name="up" size={12} />
                </button>
            ),
            this.dialogOpen && (
                <Modal label="Fetch into this folder" onClose={() => this.closeDialog()}>
                    {status && this.connection !== 'ready' ? (
                        <div class="dlg">
                            {status}
                            <div class="dlg-f">
                                <button type="button" class="btn" onClick={() => this.closeDialog()}>
                                    Close
                                </button>
                            </div>
                        </div>
                    ) : (
                        this.renderForm('dialog')
                    )}
                </Modal>
            ),
        ];
    }

    private renderStandalone() {
        const status = this.renderStatus();
        const rows = Object.values(this.jobs);
        const byTab = { active: [] as Row[], finished: [] as Row[], retrying: [] as Row[] };
        rows.forEach(r => byTab[tabOf(r)].push(r));
        const sum = summarize(rows);
        const shown = byTab[this.tab];
        const folder = this.caps?.folder ? joinPath(this.caps.folder, this.subDir) : null;

        return (
            <section class="standalone">
                <header class="sa-head">
                    <div class="sa-title">
                        <h3>Downloads</h3>
                        <span class="node">{this.name}</span>
                        {sum.downBps > 0 && <span class="sum">{formatRate(sum.downBps)}</span>}
                    </div>
                    {folder && (
                        <span class="saving">
                            saving to <code>{folder}</code>
                            {this.caps && this.caps.folder_free_bytes > 0 && <span class="free"> · {formatBytes(this.caps.folder_free_bytes)} free</span>}
                        </span>
                    )}
                </header>
                {status ?? [
                    <div class="sa-add">
                        {this.renderForm('inline')}
                        {folder && !blockerFor(this.caps!, this.name, this.canConfigure) && (
                            <div class="sa-dest">
                                <span class="dest">
                                    <Icon name="folder" size={14} />
                                    <span>{folder}</span>
                                </span>
                                {this.canPickFolder() && (
                                    <button type="button" class="btn" onClick={() => this.listFolders(this.subDir ? this.subDir.split('/') : [])}>
                                        Choose folder…
                                    </button>
                                )}
                            </div>
                        )}
                    </div>,
                    <div class="tabs" role="tablist" aria-label="Downloads">
                        {(
                            [
                                ['active', 'Active'],
                                ['finished', 'Finished'],
                                ['retrying', 'Retrying'],
                            ] as const
                        ).map(([id, label]) => (
                            <button type="button" role="tab" aria-selected={this.tab === id ? 'true' : 'false'} class={{ on: this.tab === id }} onClick={() => (this.tab = id)}>
                                {label}
                                <b>{byTab[id].length}</b>
                            </button>
                        ))}
                    </div>,
                    this.tab === 'finished' && byTab.finished.length > 0 && (
                        <div class="tab-h">
                            <span>{byTab.finished.length} finished</span>
                            {byTab.finished.some(isClearable) && (
                                <button type="button" class="lnk" onClick={() => this.clearFinished()}>
                                    Clear finished
                                </button>
                            )}
                        </div>
                    ),
                    shown.length ? (
                        this.renderRows(shown)
                    ) : rows.length === 0 ? (
                        <StandaloneEmpty nodeName={this.name} folder={folder} />
                    ) : (
                        <div class="muted pad">{this.tab === 'retrying' ? 'Nothing is retrying.' : this.tab === 'finished' ? 'Nothing has finished yet.' : 'Nothing is running.'}</div>
                    ),
                ]}
            </section>
        );
    }

    render() {
        return (
            <Host class={{ compact: this.compact, standalone: !this.compact }}>
                {this.compact ? this.renderCompact() : this.renderStandalone()}
                {this.renderConfirm()}
                {this.picker && (
                    <FolderPicker
                        root={this.caps?.folder ?? ''}
                        path={this.picker.path}
                        folders={this.picker.folders}
                        error={this.picker.error}
                        newName={this.picker.newName}
                        onOpen={name => this.listFolders([...this.picker!.path, name])}
                        onUp={depth => this.listFolders(this.picker!.path.slice(0, depth))}
                        onNewName={newName => (this.picker = { ...this.picker!, newName })}
                        onCancel={() => (this.picker = null)}
                        onSave={() => this.savePicker()}
                    />
                )}
                {this.player && (
                    <div class="overlay player">
                        <phirepass-media-player
                            src={this.player.src}
                            name={this.player.name}
                            status={this.playerStatus()}
                            ready={this.playerReady()}
                            positionKey={`dl:${this.player.downloadId}`}
                            onPhirepassPlayerClose={() => (this.player = null)}
                        ></phirepass-media-player>
                    </div>
                )}
                <Notices notices={this.notices} onDismiss={id => this.dismiss(id)} />
            </Host>
        );
    }

    private playerRow(): Row | undefined {
        return this.player ? this.jobs[this.player.downloadId] : undefined;
    }

    private playerStatus(): string | undefined {
        const row = this.playerRow();
        if (!row) {
            return this.player ? 'On the node' : undefined;
        }
        if (isFinished(row.state)) {
            return 'On the node';
        }
        const pct = row.total_bytes ? ` · ${((row.done_bytes / row.total_bytes) * 100).toFixed(1)}%` : '';
        return `${row.state === 'Downloading' ? 'Downloading' : row.state}${pct}`;
    }

    private playerReady(): number | undefined {
        const row = this.playerRow();
        if (!row || isFinished(row.state)) {
            return undefined;
        }
        const file = playCheck(row);
        return file.file?.ready_from_start;
    }
}
