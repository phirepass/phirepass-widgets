import { Component, Host, h, Element, Method, Prop, State, Watch } from '@stencil/core';
import { Event, EventEmitter } from '@stencil/core';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';
import type { DesktopSize, UserInteraction } from '@devolutions/iron-remote-desktop';
import {
    ConnectionState,
    ProtocolMessage,
    ProtocolMessageType,
    ProtocolMessageWebAuthSuccess,
    ProtocolMessageWebError,
    ProtocolMessageWebRDPAuthorized,
    ProtocolMessageWebTunnelClosed,
} from '../../common/protocol';
import { measure_initial_desktop_size, ViewportSync } from './phirepass-rdp.viewport';
import {
    focus_client,
    keyboard_lock_supported,
    lock_keyboard,
    shown_fullscreen,
    toggle_fullscreen,
    unlock_keyboard,
} from './phirepass-rdp.keyboard';

/** The `iron-remote-desktop` element configures itself from JS properties. */
type IronRemoteDesktopElement = HTMLElement & {
    module: unknown;
    scale: string;
    flexcenter: boolean;
    verbose: boolean;
};

/**
 * Remote desktop over RDP.
 *
 * Unlike the terminal and SFTP widgets this one does not pipe protocol bytes
 * through the phirepass channel. The channel is used only to authorise the
 * session; the actual RDP stream runs on a second WebSocket opened by IronRDP's
 * own client, because that client speaks RDCleanPath and can set neither
 * headers nor a subprotocol on the socket it opens. See `RDP.md` in
 * `phirepass-rs` for why the session is split across two sockets.
 */
@Component({
    tag: 'phirepass-rdp',
    styleUrl: 'phirepass-rdp.css',
    shadow: true,
})
export class PhirepassRdp {
    private channel!: PhirepassChannel;
    private containerEl?: HTMLDivElement;
    private ironEl?: IronRemoteDesktopElement;
    private userInteraction?: UserInteraction;
    private viewport?: ViewportSync;

    private domReady = false;
    private runtimeReady = false;
    private connected = false;
    private disposed = false;
    private session_id?: number;

    private readonly onFullscreenChange = () => this.sync_keyboard_lock();

    /** Credentials in force for this session, from props or from the prompt. */
    private credentials?: { username: string; password: string };

    @State()
    private credentialsPrompt = false;

    @State()
    private statusMessage?: string;

    private usernameBuffer = '';
    private passwordBuffer = '';

    @Element()
    el!: HTMLElement;

    @Prop()
    serverHost = "phirepass.com";

    @Prop()
    serverPort = 443;

    @Prop()
    allowInsecure = false;

    @Prop()
    heartbeatInterval = 30_000;

    @Prop()
    nodeId!: string;

    @Prop()
    serviceId!: string;

    @Prop()
    token!: string;

    /**
     * Credentials for the remote host. When either is missing the widget
     * prompts for both.
     *
     * They serve two purposes at once: the agent checks them before it
     * authorises the tunnel, and the browser uses them for CredSSP. The agent
     * never logs in with them — it discards them once the tunnel is authorised.
     */
    @Prop()
    username?: string;

    @Prop()
    password?: string;

    /**
     * What to name the host in the CredSSP service principal (`TERMSRV/...`).
     *
     * The agent dials whatever the node's service settings say, so this is
     * never used for routing. It matters only because some hosts check the SPN,
     * and the browser has no other way to learn the host's real address.
     */
    @Prop()
    destination?: string;

    /** `fit` scales the desktop to the widget, `real` keeps 1:1 pixels. */
    @Prop()
    scale: 'fit' | 'full' | 'real' = 'fit';

    /**
     * Ask the remote host to change its resolution to match the widget whenever
     * the widget is resized, so the desktop is rendered at native size rather
     * than scaled.
     *
     * The host has the last word: this needs the display-control channel, and a
     * host that does not offer it simply keeps the resolution it started with —
     * which `scale` then fits into the widget, as before.
     */
    @Prop()
    dynamicResize = true;

    /**
     * While the widget is fullscreen, take the keys the browser normally keeps
     * for itself (Ctrl+W, Ctrl+T, Alt+Tab, F11) and send them to the remote
     * host instead. Escape is taken too, so leaving fullscreen becomes a
     * press-and-hold.
     *
     * Ordinary keys do not depend on this — they are forwarded whenever the
     * desktop has focus.
     */
    @Prop()
    captureKeyboard = true;

    @Watch('nodeId')
    onNodeIdChange(newValue?: string, _oldValue?: string) {
        this.reset_session_state();

        if (this.channel && this.channel.is_connected()) {
            this.close_comms();
        }

        if (newValue) {
            this.open_comms();
            this.channel.connect();
        }
    }

    @Prop()
    serverId?: string;

    @Watch('serverId')
    onServerIdChange(_newValue?: string, _oldValue?: string) {
        this.onNodeIdChange(this.nodeId, this.nodeId);
    }

    @Event({
        eventName: 'connectionStateChanged',
        composed: true,
        cancelable: true,
        bubbles: true,
    })
    connectionStateChanged!: EventEmitter<[ConnectionState, unknown?]>;

    private create_web_socket_endpoint(): string {
        const protocol = this.allowInsecure ? 'ws' : 'wss';

        if (!this.allowInsecure && this.serverPort === 443) {
            return `${protocol}://${this.serverHost}`;
        }

        if (this.allowInsecure && this.serverPort === 80) {
            return `${protocol}://${this.serverHost}`;
        }

        return `${protocol}://${this.serverHost}:${this.serverPort}`;
    }

    async connectedCallback() {
        document.addEventListener('fullscreenchange', this.onFullscreenChange);

        // A widget can be moved in the DOM rather than destroyed, which
        // disconnects and reconnects it; the second life is a real one.
        this.disposed = false;

        await init();
        this.open_comms();
        this.runtimeReady = true;

        if (!this.nodeId) {
            console.warn('Prop node_id is not set. Cannot connect to RDP.');
            return;
        }

        this.try_connect();
    }

    componentDidLoad() {
        this.domReady = true;
        this.try_connect();
    }

    /**
     * Closing an RDP tab unmounts the widget, and this is the only notice we
     * get. Everything the session is made of has to go with it — including the
     * parts that are still being built: the tunnel can be authorised, or the RDP
     * client's own WebSocket already open, while the modules it needs are still
     * loading. `disposed` is what those in-flight steps check before carrying
     * on, and clearing `session_id` invalidates any answer still on its way.
     */
    async disconnectedCallback() {
        document.removeEventListener('fullscreenchange', this.onFullscreenChange);

        this.disposed = true;
        this.session_id = undefined;
        this.connected = false;
        this.domReady = false;
        this.runtimeReady = false;
        this.close_comms();
    }

    /**
     * Puts the widget in and out of fullscreen, returning the state it settled
     * in. Fullscreen is also what makes `captureKeyboard` possible, so a host
     * app wanting the browser's own shortcuts to reach the remote desktop has
     * to come through here.
     */
    @Method()
    async toggleFullscreen(): Promise<boolean> {
        const fullscreen = await toggle_fullscreen(this.el);
        this.focus_desktop();
        return fullscreen;
    }

    /** Whether the browser can hand over its reserved keys at all. */
    @Method()
    async keyboardLockSupported(): Promise<boolean> {
        return keyboard_lock_supported();
    }

    /** Directs keystrokes at the remote desktop without waiting for a click. */
    @Method()
    async focusDesktop(): Promise<void> {
        this.focus_desktop();
    }

    private try_connect() {
        if (this.connected || !this.domReady || !this.runtimeReady) {
            return;
        }

        if (!this.containerEl || !this.channel) {
            return;
        }

        this.connect();
    }

    private connect() {
        this.connected = true;
        this.channel.connect();
    }

    private open_comms() {
        if (this.serverId) {
            this.channel = new PhirepassChannel(`${this.create_web_socket_endpoint()}/api/web/ws`, this.nodeId!, this.serverId!);
        } else {
            this.channel = new PhirepassChannel(`${this.create_web_socket_endpoint()}/api/web/ws`, this.nodeId!);
        }

        this.channel.on_connection_open(() => {
            this.connectionStateChanged.emit([ConnectionState.Connected]);
            this.channel.authenticate(this.token, this.nodeId);
        });

        this.channel.on_connection_close(() => {
            this.connectionStateChanged.emit([ConnectionState.Disconnected]);
            this.teardown_client();
        });

        this.channel.on_connection_error((err: Error) => {
            this.connectionStateChanged.emit([ConnectionState.Error, err]);
        });

        this.channel.on_connection_message((_raw_: unknown) => {
            // raw frames are handled by on_protocol_message below
        });

        this.channel.on_protocol_message((msg: ProtocolMessage) => {
            const { web } = msg.data;
            switch (web.type) {
                case ProtocolMessageType.Error:
                    this.handle_error(web);
                    break;
                case ProtocolMessageType.AuthSuccess:
                    this.handle_auth_success(web);
                    break;
                case ProtocolMessageType.RDPAuthorized:
                    this.handle_rdp_authorized(web);
                    break;
                case ProtocolMessageType.TunnelClosed:
                    this.handle_tunnel_closed(web);
                    break;
                default:
                    console.warn('Unknown protocol message type:', web);
            }
        });
    }

    private close_comms() {
        this.teardown_client();

        if (this.channel) {
            this.channel.stop_heartbeat();
            this.channel.disconnect();
        }
    }

    private reset_session_state() {
        this.session_id = undefined;
        this.credentials = undefined;
        this.credentialsPrompt = false;
        this.usernameBuffer = '';
        this.passwordBuffer = '';
        this.statusMessage = undefined;
    }

    /**
     * The channel stays open for the whole session even though no RDP byte ever
     * travels over it: it is what keeps the tunnel registered server-side, and
     * it is where `TunnelClosed` and `Error` arrive.
     */
    private handle_auth_success(_auth_: ProtocolMessageWebAuthSuccess) {
        this.channel.start_heartbeat(this.heartbeatInterval <= 15_000 ? 30_000 : this.heartbeatInterval);

        if (this.username && this.password) {
            this.credentials = { username: this.username, password: this.password };
            this.request_tunnel();
            return;
        }

        this.credentialsPrompt = true;
    }

    private request_tunnel() {
        if (!this.credentials) {
            return;
        }

        this.statusMessage = undefined;
        this.channel.open_rdp_tunnel(
            this.nodeId,
            this.serviceId,
            this.credentials.username,
            this.credentials.password,
        );
    }

    /**
     * The tunnel is authorised but nothing has been dialled yet: the agent only
     * reserves `sid`. Handing the ticket to the RDP client is what triggers the
     * TCP + x224 + TLS hop, and the ticket expires 60s from now.
     */
    private async handle_rdp_authorized(web: ProtocolMessageWebRDPAuthorized) {
        this.session_id = web.sid;
        this.statusMessage = 'Connecting…';

        // Loaded on demand: the RDP client carries a multi-megabyte wasm
        // payload that consumers embedding only the terminal or the SFTP client
        // should never download.
        const [backend] = await Promise.all([
            import('@devolutions/iron-remote-desktop-rdp'),
            // Registers the `iron-remote-desktop` element as a side effect.
            import('@devolutions/iron-remote-desktop'),
        ]);

        // The element may have gone away while the modules were loading.
        if (this.disposed || !this.containerEl || this.session_id !== web.sid) {
            return;
        }

        await backend.init('info');

        if (this.disposed || !this.containerEl || this.session_id !== web.sid) {
            return;
        }

        // Built imperatively rather than in `render()` so `module` is set
        // before the element upgrades — it reads its backend on connect.
        const element = document.createElement('iron-remote-desktop') as IronRemoteDesktopElement;
        element.module = backend.Backend;
        element.scale = this.scale;
        element.flexcenter = true;
        element.verbose = false;
        element.addEventListener('ready', (event: Event) => {
            const detail = (event as CustomEvent<{ irgUserInteraction: UserInteraction }>).detail;
            void this.start_session(detail.irgUserInteraction, web.ticket, backend.enableCredssp(true));
        });

        this.ironEl = element;
        this.mount_client(element);
    }

    /**
     * Mounts the client in the widget's **light** DOM, slotted into `.screen`,
     * rather than as a child of the shadow root.
     *
     * This is what makes the keyboard work. IronRDP forwards a key event only
     * while `document.activeElement` is its own element, and `activeElement`
     * retargets focus to the outermost shadow host: with the client inside this
     * widget's shadow root the answer is always `<phirepass-rdp>`, the check
     * never passes, and not one keystroke reaches the remote host — while the
     * mouse, which is bound to the canvas directly, works fine. Slotting the
     * client leaves it in the document tree, so `activeElement` resolves to the
     * client itself.
     */
    private mount_client(element: IronRemoteDesktopElement) {
        this.el.appendChild(element);
    }

    private async start_session(userInteraction: UserInteraction, ticket: string, credssp: unknown) {
        this.userInteraction = userInteraction;

        const builder = userInteraction
            .configBuilder()
            .withUsername(this.credentials?.username ?? '')
            .withPassword(this.credentials?.password ?? '')
            .withDestination(this.destination ?? this.nodeId)
            .withProxyAddress(`${this.create_web_socket_endpoint()}/api/web/rdp/${this.nodeId}`)
            .withAuthToken(ticket)
            .withExtension(credssp);

        // Asking for the widget's size up front saves the remote host a
        // resolution change immediately after logon — but only when the widget
        // has been laid out. An unmeasurable widget asks for nothing and lets
        // `start_viewport_sync` correct the size once the client is visible;
        // sending a size derived from a zero-sized box is how a host ends up
        // refusing the connection outright.
        if (this.dynamicResize) {
            const size = measure_initial_desktop_size(this.el);
            if (size) {
                builder.withDesktopSize(size);
            }
        }

        try {
            const session = await userInteraction.connect(builder.build());

            // The tab can be closed while this handshake is in flight. The
            // session owns the RDP WebSocket and nothing else can close it, so
            // the socket is only released by letting the session loop start and
            // see the shutdown it was already handed — terminate first, then
            // run, and never make the widget visible.
            if (this.disposed) {
                this.shutdown_session(userInteraction);
                await session.run();
                return;
            }

            userInteraction.setVisibility(true);
            this.statusMessage = undefined;
            this.focus_desktop();
            this.start_viewport_sync();
            void this.sync_keyboard_lock();

            const termination = await session.run();
            this.statusMessage = termination.reason();
        } catch (err) {
            const message = this.describe_error(err);
            this.statusMessage = message;
            this.connectionStateChanged.emit([ConnectionState.Error, err]);
        }
    }

    /**
     * Keeps the remote resolution equal to the widget's size.
     *
     * `setVisibility(true)` is what gives the widget its layout, so the first
     * measurement has to happen after it — measuring earlier reads a hidden,
     * zero-sized box.
     */
    private start_viewport_sync() {
        if (!this.dynamicResize) {
            return;
        }

        this.viewport = new ViewportSync((size: DesktopSize) => this.resize_desktop(size));
        this.viewport.observe(this.el);
    }

    private stop_viewport_sync() {
        this.viewport?.disconnect();
        this.viewport = undefined;
    }

    private resize_desktop(size: DesktopSize) {
        try {
            this.userInteraction?.resize(size.width, size.height);
        } catch (err) {
            // A host without the display-control channel refuses the request;
            // the session carries on at the resolution it already has.
            console.warn('The remote host would not resize its desktop:', err);
        }
    }

    private focus_desktop() {
        focus_client(this.ironEl);
    }

    /**
     * Holds the keyboard lock exactly while the widget is fullscreen. Both
     * edges matter: the browser drops the lock on its own when fullscreen ends,
     * but not when the session does, and a lock left behind would keep
     * swallowing shortcuts for the rest of the page.
     */
    private async sync_keyboard_lock() {
        if (!this.captureKeyboard || !shown_fullscreen(this.el)) {
            unlock_keyboard();
            return;
        }

        await lock_keyboard(this.el);
        this.focus_desktop();
    }

    /** IronRDP rejects with its own error shape rather than an `Error`. */
    private describe_error(err: unknown): string {
        const iron = err as { backtrace?: () => string } | undefined;
        if (iron && typeof iron.backtrace === 'function') {
            return iron.backtrace();
        }
        return err instanceof Error ? err.message : 'Connection failed.';
    }

    private handle_tunnel_closed(_web_: ProtocolMessageWebTunnelClosed) {
        this.session_id = undefined;
        this.statusMessage = this.statusMessage ?? 'Connection closed.';
        this.teardown_client();
        this.close_comms();
    }

    private handle_error(error: ProtocolMessageWebError) {
        this.statusMessage = error.message;
        this.connectionStateChanged.emit([ConnectionState.Error, error]);
    }

    /**
     * Asks the RDP client to end its session, which is also what closes the
     * socket it opened. Failing here is not worth propagating: the caller is
     * already tearing the widget down and has nothing else to try.
     */
    private shutdown_session(userInteraction: UserInteraction) {
        try {
            userInteraction.shutdown();
        } catch (err) {
            console.warn('Failed to shut the RDP session down cleanly:', err);
        }
    }

    private teardown_client() {
        this.stop_viewport_sync();
        unlock_keyboard();

        if (this.userInteraction) {
            this.shutdown_session(this.userInteraction);
            this.userInteraction = undefined;
        }

        this.ironEl?.remove();
        this.ironEl = undefined;

        this.credentialsPrompt = false;
        this.usernameBuffer = '';
        this.passwordBuffer = '';
    }

    private submit_credentials(event: Event) {
        event.preventDefault();
        this.credentialsPrompt = false;
        this.credentials = { username: this.usernameBuffer, password: this.passwordBuffer };
        this.usernameBuffer = '';
        this.passwordBuffer = '';
        this.request_tunnel();
    }

    render() {
        return (
            <Host>
                {/* The client is slotted in rather than rendered here — see `mount_client`. */}
                <div class="screen" ref={(el) => (this.containerEl = el as HTMLDivElement)}>
                    <slot />
                </div>

                {this.credentialsPrompt && (
                    <form class="prompt" onSubmit={(event) => this.submit_credentials(event)}>
                        <label htmlFor="rdp-username">Username</label>
                        <input
                            id="rdp-username"
                            type="text"
                            autocomplete="username"
                            autofocus
                            onInput={(event) => (this.usernameBuffer = (event.target as HTMLInputElement).value)}
                        />
                        <label htmlFor="rdp-password">Password</label>
                        <input
                            id="rdp-password"
                            type="password"
                            autocomplete="current-password"
                            onInput={(event) => (this.passwordBuffer = (event.target as HTMLInputElement).value)}
                        />
                        <button type="submit">Connect</button>
                    </form>
                )}

                {this.statusMessage && !this.credentialsPrompt && (
                    <div class="status">{this.statusMessage}</div>
                )}
            </Host>
        );
    }
}
