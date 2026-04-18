import { Component, Host, h, Element, Prop, Watch } from '@stencil/core';
import { Event, EventEmitter } from '@stencil/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { SerializeAddon } from '@xterm/addon-serialize';
import { ImageAddon, IImageAddonOptions } from '@xterm/addon-image';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';
import { ConnectionState, InputMode, ProtocolMessage, ProtocolMessageError, ProtocolMessageType, ProtocolMessageWebAuthSuccess, ProtocolMessageWebError, ProtocolMessageWebTunnelClosed, ProtocolMessageWebTunnelData, ProtocolMessageWebTunnelOpened } from '../../common/protocol';

@Component({
    tag: 'phirepass-terminal',
    styleUrl: 'phirepass-terminal.css',
    shadow: true,
})
export class PhirepassTerminal {
    private terminal!: Terminal;
    private fitAddon!: FitAddon;
    private webLinksAddon?: WebLinksAddon;
    private searchAddon?: SearchAddon;
    private webglAddon?: WebglAddon;
    private serializeAddon?: SerializeAddon;
    private imageAddon?: ImageAddon;

    private channel!: PhirepassChannel;
    private containerEl?: HTMLDivElement;
    private domReady = false;
    private runtimeReady = false;
    private connected = false;
    private inputMode: InputMode = InputMode.Default;
    private resizeObserver!: ResizeObserver;
    private resizeDebounceHandle?: ReturnType<typeof setTimeout> | number;

    private session_id?: number;
    private usernameBuffer = "";
    private passwordBuffer = "";

    private xtermImageSettings: IImageAddonOptions = {
        enableSizeReports: true,    // whether to enable CSI t reports (see below)
        pixelLimit: 16777216,       // max. pixel size of a single image
        sixelSupport: true,         // enable sixel support
        sixelScrolling: true,       // whether to scroll on image output
        sixelPaletteLimit: 256,     // initial sixel palette size
        sixelSizeLimit: 25000000,   // size limit of a single sixel sequence
        storageLimit: 128,          // FIFO storage limit in MB
        showPlaceholder: true,      // whether to show a placeholder for evicted images
        iipSupport: true,           // enable iTerm IIP support
        iipSizeLimit: 20000000      // size limit of a single IIP sequence
    }

    @Element()
    el!: HTMLElement;

    @Prop()
    terminalOptions = {
        // Terminal identification
        termName: 'xterm-256color',

        // Rendering
        rendererType: 'canvas', // Better performance
        allowTransparency: false,

        fontFamily:
            '"Berkeley Mono", "Fira Code", "SFMono-Regular", Menlo, monospace',
        fontSize: 12,
        // fontWeight: 'normal',
        // fontWeightBold: 'bold',
        letterSpacing: 0,
        lineHeight: 1.0,

        allowProposedApi: true, // needed for bracketed paste

        // Cursor
        cursorBlink: true,
        // cursorStyle: 'block',
        cursorWidth: 1,

        // Colors
        theme: {
            background: "#0b1021",
            foreground: "#e2e8f0",
            cursor: "#67e8f9",
        },

        // Scrolling
        scrollback: 10000,
        fastScrollModifier: 'shift',
        fastScrollSensitivity: 5,

        // Behavior
        bellStyle: 'sound', // or 'none' if you prefer
        convertEol: false, // true to treat \n as \r\n
        disableStdin: false,

        // Selection
        rightClickSelectsWord: true,

        // Performance
        drawBoldTextInBrightColors: true,
        minimumContrastRatio: 1,

        // Advanced
        windowsMode: false, // Important for Linux
        macOptionIsMeta: false,
        altClickMovesCursor: true
    }

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
        this.terminal.reset();

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
        this.setup_terminal();
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
        if (this.resizeDebounceHandle) {
            clearTimeout(this.resizeDebounceHandle);
            this.resizeDebounceHandle = undefined;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.connected = false;
        this.domReady = false;
        this.runtimeReady = false;
        this.close_comms();
        this.destroy_terminal();
    }

    private is_terminal_open(): boolean {
        return Boolean(this.connected && this.containerEl && (this.terminal as Terminal & { element?: HTMLElement }).element);
    }

    private fit_terminal_safely() {
        if (!this.fitAddon || !this.is_terminal_open()) {
            return;
        }

        try {
            this.fitAddon.fit();
        } catch (err) {
            console.warn('Skipping terminal fit before renderer is ready:', err);
        }
    }

    private try_connect() {
        if (this.connected || !this.domReady || !this.runtimeReady) {
            return;
        }

        if (!this.containerEl || !this.terminal || !this.channel) {
            return;
        }

        this.connect();
    }

    private setup_terminal() {
        this.terminal = new Terminal(this.terminalOptions);

        this.fitAddon = new FitAddon();
        this.terminal.loadAddon(this.fitAddon);

        this.webLinksAddon = new WebLinksAddon();
        this.terminal.loadAddon(this.webLinksAddon);

        this.searchAddon = new SearchAddon();
        this.terminal.loadAddon(this.searchAddon);

        this.serializeAddon = new SerializeAddon();
        this.terminal.loadAddon(this.serializeAddon);

        this.imageAddon = new ImageAddon(this.xtermImageSettings);
        this.terminal.loadAddon(this.imageAddon);

        try {
            this.webglAddon = new WebglAddon();
            this.terminal.loadAddon(this.webglAddon);
        } catch (e) {
            console.warn('WebGL addon not available or failed to load:', e);
        }

        if (typeof this.terminal.onResize === 'function') {
            this.terminal.onResize(() => {
                this.send_ssh_terminal_resize();
            });
        }
    }

    private destroy_terminal() {
        if (this.terminal) {
            this.terminal.reset();
            if (typeof this.terminal.dispose === 'function') {
                this.terminal.dispose();
            }
        }
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
            this.terminal.reset();
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

    private send_ssh_terminal_resize() {
        if (!this.containerEl) {
            console.warn('Cannot send terminal resize: container element not available');
            return;
        }

        if (!this.nodeId) {
            console.warn('Cannot send terminal resize: node_id is missing');
            return;
        }

        if (!this.channel) {
            console.warn('Cannot send terminal resize: channel is not initialized');
            return;
        }

        if (!this.channel.is_connected()) {
            console.warn('Cannot send terminal resize: channel not connected');
            return;
        }

        if (!this.session_id) {
            console.warn('Cannot send terminal resize: session_id is missing');
            return;
        }

        this.fit_terminal_safely();

        const cols = this.terminal?.cols ?? 0;
        const rows = this.terminal?.rows ?? 0;
        const px_width = this.containerEl.clientWidth ?? 0;
        const px_height = this.containerEl.clientHeight ?? 0;

        if (cols <= 0 || rows <= 0 || px_width <= 0 || px_height <= 0) {
            console.warn(`Cannot send terminal resize: invalid terminal dimensions cols=${cols}, rows=${rows}, px_width=${px_width}, px_height=${px_height}`);
            return;
        }

        try {
            console.log(`Sending terminal resize: cols=${cols}, rows=${rows}, px_width=${px_width}, px_height=${px_height}`);
            this.channel.send_ssh_terminal_resize(this.nodeId, this.session_id, cols, rows, px_width, px_height);
        } catch (err) {
            console.error('Failed to send terminal resize:', err);
        }
    }

    private send_ssh_data(data: string) {
        if (this.channel.is_connected() && !!this.session_id) {
            this.channel.send_ssh_tunnel_data(this.nodeId, this.session_id, data);
        }
    }

    private handle_error(error: ProtocolMessageWebError) {
        switch (error.kind) {
            case ProtocolMessageError.Generic:
            case ProtocolMessageError.Authentication:
                this.terminal.reset();
                this.terminal.write(error.message + "\r\n");
                this.terminal.focus();
                this.usernameBuffer = "";
                this.passwordBuffer = "";
                break;
            case ProtocolMessageError.RequiresUsernamePassword:
                console.log('Server requires both username and password. Prompting for username first.');
            case ProtocolMessageError.RequiresUsername:
                this.terminal.reset();
                this.inputMode = InputMode.Username;
                this.usernameBuffer = "";
                this.terminal.write("Enter your username: ");
                this.terminal.focus();
                break;
            case ProtocolMessageError.RequiresPassword:
                this.terminal.reset();
                this.inputMode = InputMode.Password;
                this.passwordBuffer = "";
                this.terminal.write("Enter your password: ");
                this.terminal.focus();
                break;
            default:
                console.warn('Unknown error kind:', error);
        }
    }

    private close_comms() {
        this.channel.stop_heartbeat();
        this.channel.disconnect();
    }

    private cancel_credential_entry() {
        this.inputMode = InputMode.Default;
        this.clear_creds_buffer();
        this.terminal.writeln("Authentication cancelled.");
        this.terminal.reset();
        this.close_comms();
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

    private handle_auth_success(_auth_: ProtocolMessageWebAuthSuccess) {
        this.clear_creds_buffer();
        this.channel.start_heartbeat(this.heartbeatInterval <= 15_000 ? 30_000 : this.heartbeatInterval);
        this.channel.open_ssh_tunnel(this.nodeId);
    }

    private handle_tunnel_opened(web: ProtocolMessageWebTunnelOpened) {
        this.session_id = web.sid;
        this.terminal.reset();
        this.fit_terminal_safely();
        this.send_ssh_terminal_resize();
    }

    private handle_tunnel_data(web: ProtocolMessageWebTunnelData) {
        this.terminal.write(new Uint8Array(web.data));
    }

    private handle_tunnel_closed(_web_: ProtocolMessageWebTunnelClosed) {
        this.session_id = undefined;
        this.inputMode = InputMode.Default;

        this.clear_creds_buffer();

        this.terminal.reset();
        this.terminal.writeln("Connection closed.");

        this.close_comms();
    }

    private connect() {
        const container = this.containerEl;
        console.log('Attempting to connect terminal to container:', container);
        if (container) {
            this.terminal.open(container);
            console.log('Terminal opened in container');
            this.connected = true;
            this.fit_terminal_safely();
            this.terminal.focus();
            this.terminal.onData(this.handle_terminal_data.bind(this));
            this.channel.connect();
            this.setup_resize_observer();
            console.log('Terminal connected and ready');
        }
    }

    private setup_resize_observer() {
        this.resizeObserver = new ResizeObserver(() => {
            console.log('Container resized, fitting terminal');

            if (this.resizeDebounceHandle) {
                clearTimeout(this.resizeDebounceHandle);
            }

            this.resizeDebounceHandle = setTimeout(() => {
                this.fit_terminal_safely();
                this.send_ssh_terminal_resize();
            }, 100);
        });

        this.resizeObserver.observe(this.containerEl ?? this.el);
    }

    private handle_terminal_data(data: string) {
        switch (this.inputMode) {
            case InputMode.Username:
                this.handle_username_input(data);
                break;
            case InputMode.Password:
                this.handle_password_input(data);
                break;
            case InputMode.Default:
                this.send_ssh_data(data);
                break;
        }
    }

    private handle_username_input(data: string) {
        if (data === "\r" || data === "\n") {
            this.terminal.write("\r\n");
            this.submit_username();
            return;
        }

        if (data === "\u0003") {
            this.terminal.write("^C\r\n");
            this.cancel_credential_entry();
            return;
        }

        if (data === "\u007f") {
            if (this.usernameBuffer.length) {
                this.usernameBuffer = this.usernameBuffer.slice(0, -1);
                this.terminal.write("\b \b");
            }
            return;
        }

        if (data >= " " && data <= "~") {
            this.usernameBuffer += data;
            this.terminal.write(data);
        }
    }

    private submit_username() {
        if (!this.channel.is_connected()) {
            return;
        }

        const username = this.usernameBuffer.trim();
        if (!username) {
            this.terminal.writeln("");
            this.terminal.write("Enter your username: ");
            this.usernameBuffer = "";
            return;
        }

        this.inputMode = InputMode.Default;

        this.channel.open_ssh_tunnel(this.nodeId, username);
    }

    private handle_password_input(data: string) {
        if (data === "\r" || data === "\n") {
            this.terminal.write("\r\n");
            this.submit_password();
            return;
        }

        if (data === "\u0003") {
            this.terminal.write("^C\r\n");
            this.cancel_credential_entry();
            return;
        }

        if (data === "\u007f") {
            if (this.passwordBuffer.length) {
                this.passwordBuffer = this.passwordBuffer.slice(0, -1);
                this.terminal.write("\b \b");
            }
            return;
        }

        if (data >= " " && data <= "~") {
            this.passwordBuffer += data;
            this.terminal.write("*");
        }
    }

    private submit_password() {
        if (!this.channel.is_connected()) {
            return;
        }

        const password = this.passwordBuffer;
        if (!password) {
            this.terminal.writeln("");
            this.terminal.write("Enter your password: ");
            this.passwordBuffer = "";
            return;
        }

        this.inputMode = InputMode.Default;

        // Assuming there's a method to submit password to the channel
        // You may need to adjust this based on your actual API
        this.channel.open_ssh_tunnel(this.nodeId, this.usernameBuffer.trim(), password);

        // Clear sensitive data
        this.passwordBuffer = "";
        this.usernameBuffer = "";
    }

    render() {
        return (
            <Host><div id="ccc" ref={el => (this.containerEl = el as HTMLDivElement)}></div></Host>
        );
    }
}
