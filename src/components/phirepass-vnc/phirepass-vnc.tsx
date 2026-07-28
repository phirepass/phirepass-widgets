import { Component, Host, h, Element, Prop, State, Watch } from '@stencil/core';
import { Event, EventEmitter } from '@stencil/core';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';
import { ChannelSocket } from '../../common/channel-socket';
import { ConnectionState, ProtocolMessage, ProtocolMessageType, ProtocolMessageWebAuthSuccess, ProtocolMessageWebError, ProtocolMessageWebTunnelClosed, ProtocolMessageWebTunnelData, ProtocolMessageWebTunnelOpened } from '../../common/protocol';
import type RFB from '@novnc/novnc';

@Component({
    tag: 'phirepass-vnc',
    styleUrl: 'phirepass-vnc.css',
    shadow: true,
})
export class PhirepassVnc {
    private channel!: PhirepassChannel;
    private containerEl?: HTMLDivElement;
    private socket?: ChannelSocket;
    private rfb?: RFB;

    private domReady = false;
    private runtimeReady = false;
    private connected = false;
    private session_id?: number;

    @State()
    private passwordPrompt = false;

    @State()
    private statusMessage?: string;

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

    /** Scales the remote desktop to fit the widget instead of showing scrollbars. */
    @Prop()
    scaleViewport = true;

    /** Asks the VNC server to match its resolution to the widget size. */
    @Prop()
    resizeSession = true;

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
            console.warn('Prop node_id is not set. Cannot connect to VNC.');
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
            this.teardown_rfb();
        });

        this.channel.on_connection_error((err: Error) => {
            this.connectionStateChanged.emit([ConnectionState.Error, err]);
            this.socket?.failed(err);
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
                case ProtocolMessageType.TunnelOpened:
                    this.handle_tunnel_opened(web);
                    break;
                case ProtocolMessageType.TunnelClosed:
                    this.handle_tunnel_closed(web);
                    break;
                case ProtocolMessageType.TunnelData:
                    this.handle_tunnel_data(web);
                    break;
                default:
                    console.warn('Unknown protocol message type:', web);
            }
        });
    }

    private close_comms() {
        this.teardown_rfb();

        if (this.channel) {
            this.channel.stop_heartbeat();
            this.channel.disconnect();
        }
    }

    private reset_session_state() {
        this.session_id = undefined;
        this.passwordPrompt = false;
        this.passwordBuffer = '';
        this.statusMessage = undefined;
    }

    private handle_auth_success(_auth_: ProtocolMessageWebAuthSuccess) {
        this.channel.start_heartbeat(this.heartbeatInterval <= 15_000 ? 30_000 : this.heartbeatInterval);
        this.channel.open_vnc_tunnel(this.nodeId, this.serviceId);
    }

    /**
     * The tunnel is a byte pipe from here on: noVNC drives the RFB handshake,
     * including authentication, over the socket adapter.
     */
    private async handle_tunnel_opened(web: ProtocolMessageWebTunnelOpened) {
        this.session_id = web.sid;
        this.statusMessage = undefined;

        const socket = new ChannelSocket(
            (data: Uint8Array) => {
                if (this.session_id === undefined) {
                    return;
                }
                this.channel.send_vnc_tunnel_data(this.nodeId, this.session_id, data);
            },
            () => this.close_comms(),
        );

        this.socket = socket;

        // Loaded on demand so consumers embedding only the terminal or the SFTP
        // client never download the RFB client.
        const { default: RFBClient } = await import('@novnc/novnc');

        // The element may have gone away while the module was loading.
        if (!this.containerEl || this.socket !== socket) {
            return;
        }

        const rfb = new RFBClient(this.containerEl, socket);
        rfb.scaleViewport = this.scaleViewport;
        rfb.resizeSession = this.resizeSession;

        rfb.addEventListener('credentialsrequired', () => {
            this.passwordPrompt = true;
        });

        rfb.addEventListener('securityfailure', (event: Event) => {
            const detail = (event as CustomEvent).detail;
            this.statusMessage = detail?.reason ?? 'Authentication failed.';
            this.connectionStateChanged.emit([ConnectionState.Error, detail]);
        });

        rfb.addEventListener('disconnect', () => {
            this.statusMessage = this.statusMessage ?? 'Connection closed.';
        });

        this.rfb = rfb;

        // Only now can noVNC start reading: it attaches on construction.
        socket.open();
    }

    private handle_tunnel_data(web: ProtocolMessageWebTunnelData) {
        this.socket?.receive(new Uint8Array(web.data));
    }

    private handle_tunnel_closed(_web_: ProtocolMessageWebTunnelClosed) {
        this.session_id = undefined;
        this.statusMessage = 'Connection closed.';
        this.teardown_rfb();
        this.close_comms();
    }

    private handle_error(error: ProtocolMessageWebError) {
        this.statusMessage = error.message;
        this.connectionStateChanged.emit([ConnectionState.Error, error]);
        this.socket?.failed(error);
    }

    private teardown_rfb() {
        if (this.rfb) {
            try {
                this.rfb.disconnect();
            } catch (err) {
                console.warn('Failed to disconnect RFB cleanly:', err);
            }
            this.rfb = undefined;
        }

        if (this.socket) {
            this.socket.closed();
            this.socket = undefined;
        }

        this.passwordPrompt = false;
        this.passwordBuffer = '';
    }

    private submit_password(event: Event) {
        event.preventDefault();
        this.passwordPrompt = false;
        this.rfb?.sendCredentials({ password: this.passwordBuffer });
        this.passwordBuffer = '';
    }

    render() {
        return (
            <Host>
                <div class="screen" ref={(el) => (this.containerEl = el as HTMLDivElement)} />

                {this.passwordPrompt && (
                    <form class="prompt" onSubmit={(event) => this.submit_password(event)}>
                        <label htmlFor="vnc-password">VNC password</label>
                        <input
                            id="vnc-password"
                            type="password"
                            autofocus
                            onInput={(event) => (this.passwordBuffer = (event.target as HTMLInputElement).value)}
                        />
                        <button type="submit">Connect</button>
                    </form>
                )}

                {this.statusMessage && !this.passwordPrompt && (
                    <div class="status">{this.statusMessage}</div>
                )}
            </Host>
        );
    }
}
