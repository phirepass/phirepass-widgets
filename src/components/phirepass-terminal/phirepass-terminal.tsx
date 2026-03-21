import { Component, Host, h, Element, Prop, Watch } from '@stencil/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { SerializeAddon } from '@xterm/addon-serialize';
import { ImageAddon, IImageAddonOptions } from '@xterm/addon-image';
import init, { Channel as PhirepassChannel } from 'phirepass-channel';
import { ProtocolMessage, ProtocolMessageError, ProtocolMessageWebAuthSuccess, ProtocolMessageWebError } from '../../common/protocol';

enum InputMode {
    Username,
    Password,
    Default,
}

@Component({
    tag: 'phirepass-terminal',
    styleUrl: 'phirepass-terminal.css',
    shadow: true,
})
export class PhirepassTerminal {
    private terminal: Terminal;
    private fitAddon: FitAddon;
    private webLinksAddon?: WebLinksAddon;
    private searchAddon?: SearchAddon;
    private webglAddon?: WebglAddon;
    private serializeAddon?: SerializeAddon;
    private imageAddon?: ImageAddon;

    private channel: PhirepassChannel;
    private inputMode: InputMode = InputMode.Default;
    private resizeObserver: ResizeObserver;
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
    el: HTMLElement;

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
    nodeId: string;

    @Prop()
    token: string;

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

    createWebSocketEndpoint(): string {
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
        console.log('PhirepassTerminal connected to DOM');
        await init();
        console.log('PhirepassChannel module initialized');
        this.setup_terminal();
        console.log('Terminal setup complete');
        this.open_comms();
        console.log('Comms opened');

        if (!this.nodeId) {
            console.warn('Prop node_id is not set. Cannot connect to terminal.');
            return;
        }

        this.connect();
    }

    async disconnectedCallback() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.close_comms();
        this.destroy_terminal();
    }

    setup_terminal() {
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

        this.fitAddon.fit();
    }

    destroy_terminal() {
        if (this.terminal) {
            this.terminal.reset();
            if (typeof this.terminal.dispose === 'function') {
                this.terminal.dispose();
            }
        }
    }

    open_comms() {
        if (this.serverId) {
            this.channel = new PhirepassChannel(`${this.createWebSocketEndpoint()}/api/web/ws`, this.nodeId!, this.serverId!);
        } else {
            this.channel = new PhirepassChannel(`${this.createWebSocketEndpoint()}/api/web/ws`, this.nodeId!);
        }

        this.channel.on_connection_open(() => {
            this.channel.authenticate(this.token, this.nodeId);
        });

        this.channel.on_connection_close(() => {
            this.terminal.reset();
        });

        this.channel.on_connection_error((err: Error) => {
            console.error('>> connection error:', err);
        });

        this.channel.on_connection_message((_raw: unknown) => {
            // console.log('>> raw message received', raw);
        });

        this.channel.on_protocol_message((msg: ProtocolMessage) => {
            const { web } = msg.data;
            switch (web.type) {
                case "Error":
                    this.handle_error(web);
                    break;
                case "AuthSuccess":
                    this.handleAuthSuccess(web);
                    break;
                case "TunnelOpened":
                    this.session_id = web.sid;
                    this.terminal.reset();
                    this.send_ssh_terminal_resize();
                    break;
                case "TunnelClosed":
                    this.handleTunnelClosed();
                    break;
                case "TunnelData":
                    this.terminal.write(new Uint8Array(web.data));
                    break;
                default:
                    console.warn('Unknown protocol message type:', web);
            }
        });
    }

    send_ssh_terminal_resize() {
        if (!this.channel || !this.channel.is_connected() || !this.session_id) {
            return;
        }

        const cols = this.terminal?.cols ?? 0;
        const rows = this.terminal?.rows ?? 0;
        if (cols <= 0 || rows <= 0) {
            return;
        }

        try {
            this.channel.send_ssh_terminal_resize(this.nodeId!, this.session_id, cols, rows);
        } catch (err) {
            console.error('Failed to send terminal resize:', err);
        }
    }

    send_ssh_data(data: string) {
        if (this.channel.is_connected() && this.session_id) {
            this.channel.send_ssh_tunnel_data(this.nodeId!, this.session_id, data);
        }
    }

    handle_error(error: ProtocolMessageWebError) {
        switch (error.kind) {
            case ProtocolMessageError.Generic:
                this.terminal.reset();
                this.terminal.write(error.message + "\r\n");
                this.terminal.focus();
                break;
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

    close_comms() {
        this.channel.stop_heartbeat();
        this.channel.disconnect();
    }

    cancel_credential_entry() {
        this.inputMode = InputMode.Default;
        this.clear_creds_buffer();
        this.terminal.writeln("Authentication cancelled.");
        this.terminal.reset();
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

    handleAuthSuccess(_auth_: ProtocolMessageWebAuthSuccess) {
        this.clear_creds_buffer();
        this.channel.start_heartbeat(this.heartbeatInterval <= 15_000 ? 30_000 : this.heartbeatInterval);
        this.channel.open_ssh_tunnel(this.nodeId);
    }

    handleTunnelClosed() {
        this.session_id = undefined;
        this.inputMode = InputMode.Default;

        this.clear_creds_buffer();

        this.terminal.reset();
        this.terminal.writeln("Connection closed.");
    }

    connect() {
        const container = this.el.shadowRoot.getElementById('ccc');
        if (container) {
            this.terminal.open(container);
            this.fitAddon.fit();
            this.terminal.focus();
            this.terminal.onData(this.handleTerminalData.bind(this));
            this.channel.connect();
            this.setupResizeObserver();
            console.log('Terminal connected and ready');
        }
    }

    setupResizeObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            if (this.resizeDebounceHandle) {
                clearTimeout(this.resizeDebounceHandle);
            }

            this.resizeDebounceHandle = setTimeout(() => {
                this.fitAddon.fit();
                this.send_ssh_terminal_resize();
            }, 100);
        });

        this.resizeObserver.observe(this.el);
    }

    handleTerminalData(data: string) {
        switch (this.inputMode) {
            case InputMode.Username:
                this.handleUsernameInput(data);
                break;
            case InputMode.Password:
                this.handlePasswordInput(data);
                break;
            case InputMode.Default:
                this.send_ssh_data(data);
                break;
        }
    }

    handleUsernameInput(data: string) {
        if (data === "\r" || data === "\n") {
            this.terminal.write("\r\n");
            this.submitUsername();
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

    submitUsername() {
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

    handlePasswordInput(data: string) {
        if (data === "\r" || data === "\n") {
            this.terminal.write("\r\n");
            this.submitPassword();
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

    submitPassword() {
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
            <Host><div id="ccc"></div></Host>
        );
    }
}
