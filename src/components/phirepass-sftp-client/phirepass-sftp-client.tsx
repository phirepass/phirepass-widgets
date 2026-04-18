import { Component, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import { Event, EventEmitter } from '@stencil/core';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';

import svg from './phirepass-sftp-client.logo.svg';
import max from './phirepass-sftp-client.max.svg';
import { ConnectionState, InputMode, ProtocolMessage, ProtocolMessageType, ProtocolMessageWebAuthSuccess, ProtocolMessageWebError, ProtocolMessageWebTunnelClosed, ProtocolMessageWebTunnelData, ProtocolMessageWebTunnelOpened } from '../../common/protocol';

// https://sweet-sftp-view.lovable.app/

@Component({
    tag: 'phirepass-sftp-client',
    styleUrl: 'phirepass-sftp-client.css',
    shadow: true,
})
export class PhirepassSftpClient {
    private channel!: PhirepassChannel;
    private domReady = false;
    private runtimeReady = false;
    private connected = false;
    private inputMode: InputMode = InputMode.Default;

    private session_id?: number;
    private usernameBuffer = "";
    private passwordBuffer = "";

    @Prop()
    name = 'SFTP';

    @Prop()
    description = 'Client';

    @Prop()
    hideHeader = false;

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
    token!: string;

    @Watch('nodeId')
    onNodeIdChange(newValue?: string, _oldValue?: string) {
        // Handle the change in node_id here
        // console.log(`node_id changed from ${oldValue} to ${newValue}`);

        // Always clear local session state and reset terminal view
        this.reset_session_state();
        // this.terminal.reset();

        // Close existing comms if connected
        if (this.channel && this.channel.is_connected()) {
            this.close_comms();
        }

        // Open new comms for the updated node
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
        eventName: 'maximize',
        composed: true,
        cancelable: true,
        bubbles: true,
    })
    maximizeEvent: EventEmitter<boolean> | undefined;

    @Method()
    async maximize() {
        this.max = !this.max;
    }

    @Method()
    async minimize() {
        this.max = false;
    }

    @Event({
        eventName: 'connectionStateChanged',
        composed: true,
        cancelable: true,
        bubbles: true,
    })
    connectionStateChanged!: EventEmitter<[ConnectionState, unknown?]>;

    @State()
    max = false;

    @State()
    show_login_screen = false;

    @State()
    show_login_screen_username = false;

    @State()
    show_login_screen_password = false;

    private toggle_max() {
        this.maximizeEvent?.emit(!this.max);
    }

    async connectedCallback() {
        await init();
        // this.setup_terminal();
        this.open_comms();
        this.runtimeReady = true;

        if (!this.nodeId) {
            console.warn('Prop node_id is not set. Cannot connect to terminal.');
            return;
        }

        this.try_connect();
    }

    componentDidLoad() {
        this.domReady = true;
        this.try_connect();
    }

    async disconnectedCallback() {
        // if (this.resizeDebounceHandle) {
        //     clearTimeout(this.resizeDebounceHandle);
        //     this.resizeDebounceHandle = undefined;
        // }
        //
        // if (this.resizeObserver) {
        //     this.resizeObserver.disconnect();
        // }

        this.connected = false;
        this.domReady = false;
        this.runtimeReady = false;
        this.close_comms();
        // this.destroy_terminal();
    }

    private connect() {
        this.connected = true;
        this.channel.connect();
        // const container = this.containerEl;
        // console.log('Attempting to connect terminal to container:', container);
        // if (container) {
        //     this.terminal.open(container);
        //     console.log('Terminal opened in container');
        //     this.connected = true;
        //     this.fit_terminal_safely();
        //     this.terminal.focus();
        //     this.terminal.onData(this.handle_terminal_data.bind(this));
        //     this.channel.connect();
        //     this.setup_resize_observer();
        //     console.log('Terminal connected and ready');
        // }
    }

    private try_connect() {
        if (this.connected || !this.domReady || !this.runtimeReady) {
            return;
        }

        if (!this.channel) {
            return;
        }

        this.connect();
    }

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

    private handle_error(_error_: ProtocolMessageWebError) {
        //
    }

    private handle_auth_success(_auth_: ProtocolMessageWebAuthSuccess) {
        //
    }

    private handle_tunnel_opened(_web_: ProtocolMessageWebTunnelOpened) {
        //
    }

    private handle_tunnel_data(_web_: ProtocolMessageWebTunnelData) {
        //
    }

    private handle_tunnel_closed(_web_: ProtocolMessageWebTunnelClosed) {
        //
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
            // this.terminal.reset();
        });

        this.channel.on_connection_error((err: Error) => {
            this.connectionStateChanged.emit([ConnectionState.Error, err]);
        });

        this.channel.on_connection_message((_raw_: unknown) => {
            // console.log('>> raw message received', raw);
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
        this.channel.stop_heartbeat();
        this.channel.disconnect();
    }

    private clear_creds_buffer() {
        this.usernameBuffer = "";
        this.passwordBuffer = "";
    }

    private reset_session_state() {
        this.session_id = undefined;
        this.inputMode = InputMode.Default;
        this.clear_creds_buffer();
    }

    render() {
        return (
            <Host class={{
                'default': !this.max,
                'max': this.max,
            }}>
                <section class="listing">
                    {!this.hideHeader &&
                        <header>
                            <section class="title">
                                <img src={svg} alt="SFTP Client" />
                                <div class="text">
                                    <div class="name">{this.name}</div>
                                    <div class="description">{this.description}</div>
                                </div>
                            </section>
                            <section class="actions">
                                <div class="action" onClick={() => this.toggle_max()}>
                                    <img src={max} alt="Maximize" />
                                </div>
                            </section>
                        </header>
                    }
                    <main></main>
                    <footer></footer>
                </section>
                <section class={{
                    'creds': true,
                    'blurred': this.show_login_screen,
                }}>
                    {this.show_login_screen && <form class="form">
                        <div>SFTP Connection</div>
                        <div>
                            <div>Username</div>
                            <input type="text" placeholder="" />
                        </div>
                        <div>
                            <div>Password</div>
                            <input type="password" placeholder="" />
                        </div>
                        <div>
                            <button>Connect</button>
                        </div>
                    </form>}
                </section>
            </Host>
        );
    }
}
