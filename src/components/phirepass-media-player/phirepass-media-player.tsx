import { Component, Element, Event, EventEmitter, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import { formatBytes, formatClock, formatDay } from '../phirepass-downloader/format';
import { Icon } from '../phirepass-downloader/views/icons';
import { LinkMinter, PositionStore, RemotePlaybackLike, SAVE_EVERY_MS, StoredPosition, castBlocker, fetchLinkMinter, isAudio, localPositionStore, positionAction } from './player';

/**
 * What the player is showing. `buffering` is before the first frame;
 * `waiting` is a stall after it (a seek past what the node has, G2).
 */
export type PlayerPhase = 'prompt' | 'buffering' | 'playing' | 'waiting' | 'unsupported' | 'stopped' | 'casting';

/**
 * Plays a file from the node with the browser's own `<video>` or `<audio>`.
 *
 * It knows nothing of channels or WASM: `src` is a stream URL the server turns
 * into stream events towards the agent, and the browser's range requests do
 * the rest. A download that is still arriving plays as far as `ready` bytes;
 * past that the element waits, and so does the player, saying why.
 */
@Component({
    tag: 'phirepass-media-player',
    styleUrl: 'phirepass-media-player.css',
    shadow: true,
})
export class PhirepassMediaPlayer {
    @Element() el!: HTMLElement;

    private media?: HTMLMediaElement;
    private lastSave = 0;
    private resumeAt = 0;
    private everPlayed = false;
    /** A stored position was offered (G6): then `startAt` plays, not `autoplay`. */
    private positionPrompted = false;
    private availabilityId?: number;
    private onRemoteConnect = () => (this.phase = 'casting');
    private onRemoteDisconnect = () => {
        if (this.phase === 'casting') {
            this.phase = this.everPlayed ? 'playing' : 'buffering';
        }
    };

    /** The stream URL: `/api/web/stream/{node}/{download}/{file}` or a listing token URL. */
    @Prop() src!: string;

    @Prop() name!: string;

    /** Overrides the mime the extension implies. */
    @Prop() mime?: string;

    /** The status line above the picture, from the job: “Downloading · 23.4%”, “On the node”. */
    @Prop() status?: string;

    /** Bytes ready from the start of the file, while it is still downloading. */
    @Prop() ready?: number;

    /** “Continue watching”. Without one, positions stay in this browser. */
    @Prop() positionStore?: PositionStore;

    /** Key for the stored position: `dl:<download_id>:<file>` or `node:<node_id>:<path>`. */
    @Prop() positionKey?: string;

    /** Stands in for `video.remote`, for demos and tests (like `channelFactory`). */
    @Prop() remotePlayback?: RemotePlaybackLike;

    /** Makes the link a TV or VLC opens (T2.9). Defaults to POSTing `src`. */
    @Prop() linkMinter?: LinkMinter;

    /** Shown while casting, when the host knows the device's name. */
    @Prop() castDevice?: string;

    @Event({ eventName: 'phirepassPlayerClose', bubbles: true, composed: true })
    playerClose!: EventEmitter<void>;

    @State() phase: PlayerPhase = 'buffering';
    @State() stored: StoredPosition | null = null;
    @State() castAvailable = false;
    /** The ticket URL the element plays from once casting was asked for. */
    @State() castSrc: string | null = null;
    @State() linkNote: string | null = null;
    @State() currentTime = 0;
    @State() duration = 0;

    private get store(): PositionStore {
        return this.positionStore ?? localPositionStore;
    }

    private get audio(): boolean {
        return isAudio(this.name, this.mime);
    }

    async componentWillLoad() {
        if (this.positionKey) {
            const stored = await this.store.get(this.positionKey).catch(() => null);
            if (stored && positionAction(stored.secs, stored.duration) === 'save') {
                this.stored = stored;
                this.positionPrompted = true;
                this.phase = 'prompt';
            }
        }
    }

    componentDidLoad() {
        void this.watchRemote();
    }

    disconnectedCallback() {
        void this.savePosition(true);
        const remote = this.remote();
        if (remote) {
            remote.removeEventListener('connect', this.onRemoteConnect);
            remote.removeEventListener('disconnect', this.onRemoteDisconnect);
            if (this.availabilityId !== undefined) {
                void remote.cancelWatchAvailability(this.availabilityId).catch(() => undefined);
            }
        }
    }

    @Watch('src')
    onSrc() {
        this.castSrc = null;
        this.everPlayed = false;
        this.phase = 'buffering';
    }

    /** Closes the player, saving where it stopped. The download is not affected. */
    @Method()
    async close() {
        await this.savePosition(true);
        this.media?.pause?.();
        this.playerClose.emit();
    }

    private get minter(): LinkMinter {
        return this.linkMinter ?? fetchLinkMinter();
    }

    /**
     * The TV fetches the file itself and has no cookie, so the element first
     * moves to a ticket URL (same bytes, same position), then the device picker
     * opens. A ticket that cannot be had still opens the picker: on a
     * development stack the plain URL plays.
     */
    private async cast() {
        if (!this.castSrc) {
            const url = await this.minter(this.src);
            const media = this.media;
            if (url && media) {
                const at = media.currentTime;
                const playing = !media.paused;
                this.castSrc = url;
                media.src = url;
                this.resumeAt = at;
                if (at > 0) {
                    media.currentTime = at;
                }
                if (playing) {
                    void media.play?.()?.catch?.(() => undefined);
                }
            }
        }
        await this.remote()?.prompt().catch(() => undefined);
    }

    /** “Copy link for VLC”: the same ticket, on the clipboard. */
    private async copyLink() {
        const url = this.castSrc ?? (await this.minter(this.src));
        if (!url) {
            this.linkNote = 'Could not make a link.';
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            this.linkNote = 'Link copied. It works in VLC until it expires.';
        } catch {
            this.linkNote = url;
        }
    }

    private remote(): RemotePlaybackLike | undefined {
        return this.remotePlayback ?? ((this.media as any)?.remote as RemotePlaybackLike | undefined);
    }

    private async watchRemote() {
        const remote = this.remote();
        if (!remote || this.audio) {
            return;
        }
        remote.addEventListener('connect', this.onRemoteConnect);
        remote.addEventListener('disconnect', this.onRemoteDisconnect);
        if (remote.state === 'connected') {
            this.phase = 'casting';
        }
        try {
            this.availabilityId = await remote.watchAvailability(available => (this.castAvailable = available));
        } catch {
            // Browsers that cannot watch (Safari without a device, or a policy) still allow prompt() on click.
            this.castAvailable = true;
        }
    }

    private async savePosition(force = false) {
        const media = this.media;
        if (!media || !this.positionKey || !this.everPlayed) {
            return;
        }
        const now = Date.now();
        if (!force && now - this.lastSave < SAVE_EVERY_MS) {
            return;
        }
        this.lastSave = now;
        const action = positionAction(media.currentTime, media.duration);
        if (action === 'save') {
            await this.store.set(this.positionKey, media.currentTime, media.duration).catch(() => undefined);
        } else if (action === 'clear') {
            await this.store.clear?.(this.positionKey).catch(() => undefined);
        }
    }

    private startAt(secs: number) {
        this.stored = null;
        this.phase = 'buffering';
        this.resumeAt = secs;
        const media = this.media;
        if (media) {
            if (secs > 0) {
                media.currentTime = secs;
            }
            void media.play?.()?.catch?.(() => undefined);
        }
    }

    private retry() {
        const media = this.media;
        const at = media?.currentTime || this.resumeAt;
        this.phase = 'buffering';
        if (media) {
            media.load?.();
            this.startAt(at);
        }
    }

    private onError() {
        const code = this.media?.error?.code;
        // 2: the network dropped (the node went away or the session ended). 3 and 4: the browser cannot decode it.
        this.phase = code === 2 ? 'stopped' : 'unsupported';
    }

    private bindMedia(el?: HTMLMediaElement) {
        if (!el || el === this.media) {
            return;
        }
        this.media = el;
    }

    private renderStage() {
        switch (this.phase) {
            case 'prompt':
                return (
                    <div class="stage-msg" data-phase="prompt">
                        <b>Resume from {formatClock(this.stored!.secs)}?</b>
                        <span>
                            You stopped here on {formatDay(this.stored!.at)}. {formatClock(this.stored!.duration)} in total.
                        </span>
                        <div class="row">
                            <button type="button" class="btn" onClick={() => this.startAt(0)}>
                                Start over
                            </button>
                            <button type="button" class="btn pri" onClick={() => this.startAt(this.stored!.secs)}>
                                Resume
                            </button>
                        </div>
                    </div>
                );
            case 'buffering':
                return (
                    <div class="stage-msg overlay-msg" data-phase="buffering">
                        <span class="spin" aria-hidden="true"></span>
                        <b>Buffering</b>
                        {this.ready !== undefined && <span>{formatBytes(this.ready)} ready from the start</span>}
                    </div>
                );
            case 'waiting':
                return (
                    <div class="stage-msg overlay-msg" data-phase="waiting">
                        <span class="spin" aria-hidden="true"></span>
                        <b>Waiting for this part to download</b>
                        <span>You skipped ahead of what the node has. Playback resumes by itself.</span>
                    </div>
                );
            case 'unsupported':
                return (
                    <div class="stage-msg" data-phase="unsupported">
                        <Icon name="warn" size={28} />
                        <b>This browser cannot play this format</b>
                        <span>The download is not affected. Download the file to play it in another app.</span>
                        <a class="btn pri" href={this.src} download={this.name}>
                            Download file
                        </a>
                    </div>
                );
            case 'stopped':
                return (
                    <div class="stage-msg" data-phase="stopped">
                        <Icon name="signal" size={28} />
                        <b>Playback stopped</b>
                        <span>The connection to the node was lost.</span>
                        <button type="button" class="btn pri" onClick={() => this.retry()}>
                            Try again
                        </button>
                    </div>
                );
            case 'casting':
                return (
                    <div class="stage-msg" data-phase="casting">
                        <Icon name="cast" size={28} />
                        <b>Playing on {this.castDevice ?? 'your TV'}</b>
                        <span>The TV reads the file from the node. You can close this tab.</span>
                        <span class="clock">
                            {formatClock(this.currentTime)} / {formatClock(this.duration)}
                        </span>
                        <button type="button" class="btn" onClick={() => void this.remote()?.prompt().catch(() => undefined)}>
                            Stop casting
                        </button>
                    </div>
                );
            default:
                return null;
        }
    }

    render() {
        const audio = this.audio;
        const blocked = castBlocker(this.name, this.mime);
        const airplay = typeof (this.media as any)?.webkitShowPlaybackTargetPicker === 'function';
        const hideMedia = this.phase === 'prompt' || this.phase === 'unsupported' || this.phase === 'stopped' || this.phase === 'casting';
        const common = {
            ref: (el?: HTMLMediaElement) => this.bindMedia(el),
            src: this.castSrc ?? this.src,
            controls: true,
            // Play was pressed to get here; a stored position asks first (G6).
            preload: this.phase === 'prompt' ? 'metadata' : 'auto',
            autoplay: !this.positionPrompted,
            playsInline: true,
            class: { hidden: hideMedia },
            onCanPlay: () => {
                if (this.phase === 'buffering' || this.phase === 'waiting') {
                    this.phase = 'playing';
                }
            },
            onPlaying: () => {
                this.everPlayed = true;
                if (this.phase !== 'casting') {
                    this.phase = 'playing';
                }
            },
            onWaiting: () => {
                if (this.phase === 'playing') {
                    this.phase = this.everPlayed ? 'waiting' : 'buffering';
                }
            },
            onTimeUpdate: (e: Event) => {
                const m = e.target as HTMLMediaElement;
                this.currentTime = m.currentTime;
                void this.savePosition();
            },
            onDurationChange: (e: Event) => (this.duration = (e.target as HTMLMediaElement).duration || 0),
            onPause: () => void this.savePosition(true),
            onError: () => this.onError(),
        };

        return (
            <Host class={{ audio }}>
                <header class="bar">
                    <span class="nm" title={this.name}>
                        {this.name}
                    </span>
                    {this.status && <span class="pill">{this.status}</span>}
                    <span class="sp"></span>
                    {!audio && (this.castAvailable || blocked) && (
                        <button
                            type="button"
                            class="ib"
                            disabled={!!blocked}
                            title={blocked ?? 'Cast'}
                            aria-label={blocked ? `Cast unavailable: ${blocked}` : 'Cast'}
                            onClick={() => void this.cast()}
                        >
                            <Icon name="cast" size={15} />
                        </button>
                    )}
                    <button type="button" class="ib" title="Copy link for VLC" aria-label="Copy link for VLC" onClick={() => void this.copyLink()}>
                        <Icon name="link" size={15} />
                    </button>
                    {!audio && airplay && (
                        <button type="button" class="ib" title="AirPlay" aria-label="AirPlay" onClick={() => (this.media as any).webkitShowPlaybackTargetPicker()}>
                            <Icon name="cast" size={15} />
                        </button>
                    )}
                    <button type="button" class="ib" aria-label="Close player" title="Close" onClick={() => void this.close()}>
                        <Icon name="x" size={14} />
                    </button>
                </header>
                <div class={{ stage: true, audio }} data-phase={this.phase}>
                    {audio ? <audio {...common}></audio> : <video {...common}></video>}
                    {this.renderStage()}
                </div>
                {this.linkNote && (
                    <p class="link-note" role="status">
                        {this.linkNote}
                    </p>
                )}
            </Host>
        );
    }
}
