import { Component, Host, h, Element, Prop, State, Watch } from '@stencil/core';
import { Event, EventEmitter } from '@stencil/core';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';
import type { UserInteraction } from '@devolutions/iron-remote-desktop';
import {
    ConnectionState,
    ProtocolMessage,
    ProtocolMessageType,
    ProtocolMessageWebAuthSuccess,
    ProtocolMessageWebError,
    ProtocolMessageWebRDPAuthorized,
    ProtocolMessageWebTunnelClosed,
} from '../../common/protocol';

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

    private domReady = false;
    private runtimeReady = false;
    private connected = false;
    private session_id?: number;

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

    async disconnectedCallback() {
        this.connected = false;
        this.domReady = false;
        this.runtimeReady = false;
        this.close_comms();
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
        if (!this.containerEl || this.session_id !== web.sid) {
            return;
        }

        await backend.init('info');

        if (!this.containerEl || this.session_id !== web.sid) {
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
        this.containerEl.appendChild(element);
    }

    private async start_session(userInteraction: UserInteraction, ticket: string, credssp: unknown) {
        this.userInteraction = userInteraction;

        const config = userInteraction
            .configBuilder()
            .withUsername(this.credentials?.username ?? '')
            .withPassword(this.credentials?.password ?? '')
            .withDestination(this.destination ?? this.nodeId)
            .withProxyAddress(`${this.create_web_socket_endpoint()}/api/web/rdp/${this.nodeId}`)
            .withAuthToken(ticket)
            .withExtension(credssp)
            .build();

        try {
            const session = await userInteraction.connect(config);
            userInteraction.setVisibility(true);
            this.statusMessage = undefined;

            const termination = await session.run();
            this.statusMessage = termination.reason();
        } catch (err) {
            const message = this.describe_error(err);
            this.statusMessage = message;
            this.connectionStateChanged.emit([ConnectionState.Error, err]);
        }
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

    private teardown_client() {
        if (this.userInteraction) {
            try {
                this.userInteraction.shutdown();
            } catch (err) {
                console.warn('Failed to shut the RDP session down cleanly:', err);
            }
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
                <div class="screen" ref={(el) => (this.containerEl = el as HTMLDivElement)} />

                {this.credentialsPrompt && (
                    <form class="prompt" onSubmit={(event) => this.submit_credentials(event)}>
                        <label htmlFor="rdp-username">Windows username</label>
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
