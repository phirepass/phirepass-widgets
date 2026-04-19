import { Component, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import { Event, EventEmitter } from '@stencil/core';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';

import svg from './phirepass-sftp-client.logo.svg';
import max from './phirepass-sftp-client.max.svg';
import chevron from './phirepass-sftp-client.chevron.svg';
import folder from './phirepass-sftp-client.folder.svg';
import file from './phirepass-sftp-client.file.svg';
import go_up from './phirepass-sftp-client.go_up.svg';
import refresh from './phirepass-sftp-client.refresh.svg';
import upload from './phirepass-sftp-client.upload.svg';
import { ConnectionState, ProtocolMessage, ProtocolMessageError, ProtocolMessageType, ProtocolMessageWebAuthSuccess, ProtocolMessageWebError, ProtocolMessageWebSFTPListItems, ProtocolMessageWebTunnelClosed, ProtocolMessageWebTunnelData, ProtocolMessageWebTunnelOpened, SFTPListItem } from '../../common/protocol';

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
    private uploadInputEl?: HTMLInputElement;
    // private inputMode: InputMode = InputMode.Default;

    private session_id?: number;
    // private usernameBuffer = "";
    // private passwordBuffer = "";

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
            this.status = 'Connecting...';
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
    show_error = false;

    @State()
    error_message = '';

    @State()
    show_login_screen_password = false;

    @State()
    show_navigation = false;

    @State()
    breadcrumbs: Array<{ label: string, path: string }> = [];

    @State()
    current_dir = '.';

    @State()
    listing: Array<SFTPListItem> = [];

    @State()
    show_content = false;

    @State()
    show_loader = false;

    @State()
    version = '';

    @State()
    status = 'Disconnected';

    @State()
    selected_item: SFTPListItem | null = null;

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
        this.status = 'Connecting...';
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

    private handle_error(error: ProtocolMessageWebError) {
        switch (error.kind) {
            case ProtocolMessageError.Generic:
            case ProtocolMessageError.Authentication:
                this.error_message = error.message || 'An unknown error occurred.';
                break;
            case ProtocolMessageError.RequiresUsername:
                this.show_login_screen_username = true;
                this.show_login_screen_password = false;
                this.show_login_screen = true;
                break;
            case ProtocolMessageError.RequiresPassword:
                this.show_login_screen_username = false;
                this.show_login_screen_password = true;
                this.show_login_screen = true;
                break;
            case ProtocolMessageError.RequiresUsernamePassword:
                this.show_login_screen_username = true;
                this.show_login_screen_password = true;
                this.show_login_screen = true;
                break;
        }

        setTimeout(() => {
            this.show_loader = false;
        }, 1_000);
    }

    private handle_auth_success(auth: ProtocolMessageWebAuthSuccess) {
        this.clear_creds_buffer();
        this.version = auth.version;
        this.channel.start_heartbeat(this.heartbeatInterval <= 15_000 ? 30_000 : this.heartbeatInterval);
        this.channel.open_sftp_tunnel(this.nodeId);
        this.status = 'Connected';
    }

    private handle_tunnel_opened(web: ProtocolMessageWebTunnelOpened) {
        this.session_id = web.sid;
        // this.terminal.reset();
        // this.fit_terminal_safely();
        // this.send_ssh_terminal_resize();
        this.channel.send_sftp_list_data(this.nodeId, this.session_id!, this.current_dir);
    }

    private handle_sftp_list_items(web: ProtocolMessageWebSFTPListItems) {
        setTimeout(() => {
            this.show_loader = false;
        }, 500);

        this.listing = web.dir.items;
        this.current_dir = web.path;
        this.breadcrumbs = web.path.split('/').map((path, index, arr) => {
            if (path === '' && index === 0) {
                return { label: '/', path: '/' };
            }

            return { label: path, path: arr.slice(0, index + 1).join('/') };
        });

        this.show_content = true;
        this.show_navigation = true;
    }

    private handle_tunnel_data(web: ProtocolMessageWebTunnelData) {
        console.log('received tunnel data:', web);
    }

    private handle_tunnel_closed(_web_: ProtocolMessageWebTunnelClosed) {
        // this.session_id = undefined;
        // this.inputMode = InputMode.Default;

        this.clear_creds_buffer();

        // this.terminal.reset();
        // this.terminal.writeln("Connection closed.");

        this.close_comms();
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
            this.status = 'Authenticating...';
        });

        this.channel.on_connection_close(() => {
            this.connectionStateChanged.emit([ConnectionState.Disconnected]);
            this.status = 'Disconnected';
        });

        this.channel.on_connection_error((err: Error) => {
            this.connectionStateChanged.emit([ConnectionState.Error, err]);
            this.status = 'Error ' + err.message;
        });

        this.channel.on_connection_message((_raw_: unknown) => {
            //
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
                case ProtocolMessageType.SFTPListItems:
                    this.handle_sftp_list_items(web);
                    break;
                default:
                    console.warn('Unhandled protocol message type:', web);
            }
        });
    }

    private close_comms() {
        this.channel.stop_heartbeat();
        this.channel.disconnect();
    }

    private clear_creds_buffer() {
        // this.usernameBuffer = "";
        // this.passwordBuffer = "";
    }

    private reset_session_state() {
        // this.session_id = undefined;
        // this.inputMode = InputMode.Default;
        this.clear_creds_buffer();
    }

    private list_breadcrumb(path: string) {
        this.show_loader = true;
        this.selected_item = null;
        this.channel.send_sftp_list_data(this.nodeId, this.session_id!, path);
    }

    private go_to_parent_directory() {
        if (!this.session_id) {
            return;
        }

        if (this.current_dir === '/') {
            return;
        }

        const parent = this.breadcrumbs[this.breadcrumbs.length - 2]?.path || '/';
        this.list_breadcrumb(parent);
    }

    private refresh_directory() {
        if (!this.session_id) {
            return;
        }

        this.list_breadcrumb(this.current_dir);
    }

    private disconnect_session() {
        this.close_comms();
        this.session_id = undefined;
        this.status = 'Disconnected';
        this.show_loader = false;
    }

    private open_upload_picker() {
        this.uploadInputEl?.click();
    }

    private on_upload_selected(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) {
            return;
        }

        this.show_error = true;
        this.error_message = 'Upload is not available yet in this widget.';
        setTimeout(() => {
            this.show_error = false;
        }, 2_000);

        input.value = '';
    }

    private is_selected(item: SFTPListItem): boolean {
        if (!this.selected_item) {
            return false;
        }

        return this.selected_item.path === item.path &&
            this.selected_item.name === item.name;
    }

    private list_directory(entry: SFTPListItem) {
        if (!this.session_id) {
            console.warn('No active session. Cannot list directory.');
            return;
        }

        if (entry.kind === 'File') {
            console.warn('Cannot list directory of a file. Ignoring click.');
            this.selected_item = entry;
            return;
        }

        const path = [entry.path, entry.name].join('/');
        if (path === this.current_dir) {
            console.warn('Already in this directory. Ignoring click.');
            return;
        }

        this.show_loader = true;
        this.selected_item = null;

        this.channel.send_sftp_list_data(this.nodeId, this.session_id!, path);
    }

    private get_full_path(item: SFTPListItem): string {
        return [item.path, item.name].join('/');
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
                    <main>
                        {this.show_navigation && <nav class="navigation">
                            <div class="breadcrumbs">
                                {this.breadcrumbs.map((crumb, index, breadcrumbs) => (
                                    <>
                                        <span key={index} onClick={() => this.list_breadcrumb(crumb.path)} class="breadcrumb">{crumb.label}</span>
                                        {index < breadcrumbs.length - 1 && <img class="arrow" src={chevron} />}
                                    </>
                                ))}
                            </div>
                            <section class="actions" aria-label="SFTP actions">
                                <button type="button" class="action" onClick={() => this.go_to_parent_directory()} title="Go to parent directory" aria-label="Go to parent directory">
                                    <img src={go_up} alt="Go up" />
                                </button>
                                <button type="button" class="action" onClick={() => this.refresh_directory()} title="Refresh" aria-label="Refresh">
                                    <img src={refresh} alt="Refresh" />
                                </button>
                                <button type="button" class="action" onClick={() => this.open_upload_picker()} title="Upload" aria-label="Upload">
                                    <img src={upload} alt="Upload" />
                                </button>
                                <button type="button" class="action disconnect" onClick={() => this.disconnect_session()} title="Disconnect" aria-label="Disconnect">
                                    DISCONNECT
                                </button>
                            </section>
                        </nav>}
                        <input
                            type="file"
                            ref={(el) => this.uploadInputEl = el as HTMLInputElement}
                            onChange={(event) => this.on_upload_selected(event)}
                            style={{ display: 'none' }}
                        />
                        {this.show_content && <div class="content">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Size</th>
                                        <th>Permissions</th>
                                        <th>Owner</th>
                                        <th>Modified</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {this.listing.map((item, index) => (
                                        <tr key={index} class={{
                                            'selected': this.is_selected(item),
                                        }} onClick={() => this.list_directory(item)}>
                                            <td>
                                                {item.kind === 'Folder' ? <img class="kind" src={folder} alt="Folder" /> : <img class="kind" src={file} alt="File" />}
                                                <span class={`name ${item.kind.toLowerCase()}`}>{item.name}</span>
                                            </td>
                                            <td>{item.attributes.size}</td>
                                            <td>{item.attributes.permissions ?? '-'}</td>
                                            <td>{item.attributes.user ?? '-'}</td>
                                            <td>{new Date(item.attributes.mtime * 1000).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>}
                        {this.show_loader && <div class="loader">Loading...</div>}
                        {this.show_error && <div class="error">{this.error_message}</div>}
                    </main>
                    <footer>
                        <section class="status">
                            <span>{this.status}</span>
                            {this.selected_item && <span class="selected-item">{this.get_full_path(this.selected_item)}</span>}
                        </section>
                        <section class="version">Version: {this.version}</section>
                    </footer>
                </section>
                {this.show_login_screen &&
                    <section class={{
                        'creds': true,
                        'blurred': this.show_login_screen,
                    }}>
                        <form class="auth" onSubmit={(event) => {
                            const formData = new FormData(event.target as HTMLFormElement);

                            let username = undefined;
                            if (this.show_login_screen_username) {
                                username = formData.get('username') as string;
                            }

                            let password = undefined;
                            if (this.show_login_screen_password) {
                                password = formData.get('password') as string;
                            }

                            this.channel.open_sftp_tunnel(this.nodeId, username, password);

                            this.show_login_screen_username = false;
                            this.show_login_screen_password = false;
                            this.show_login_screen = false;
                            this.show_loader = true;

                            event.stopPropagation();
                            event.preventDefault();
                        }}>
                            <div class="title">SFTP Connection</div>
                            {this.show_login_screen_username &&
                                <div>
                                    <label htmlFor="username">Username</label>
                                    <input id="username" autoComplete='off' name="username" type="text" placeholder="" />
                                </div>
                            }
                            {this.show_login_screen_password &&
                                <div>
                                    <label htmlFor="password">Password</label>
                                    <input id="password" autoComplete='off' name="password" type="password" placeholder="" />
                                </div>
                            }
                            <div>
                                <button type="submit">Connect</button>
                            </div>
                        </form>
                    </section>
                }
            </Host>
        );
    }
}
