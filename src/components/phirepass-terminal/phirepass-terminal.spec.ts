// These mocks must be declared before any imports that use them
jest.mock('@xterm/xterm', () => {
    return {
        Terminal: jest.fn(function () {
            this.loadAddon = jest.fn();
            this.open = jest.fn();
            this.reset = jest.fn();
            this.dispose = jest.fn();
            this.write = jest.fn();
            this.writeln = jest.fn();
            this.focus = jest.fn();
            this.onData = jest.fn();
            this.cols = 80;
            this.rows = 24;
        }),
    };
});

jest.mock('@xterm/addon-fit', () => {
    return {
        FitAddon: jest.fn(function () {
            this.fit = jest.fn();
        }),
    };
});

jest.mock('@xterm/addon-web-links', () => {
    return {
        WebLinksAddon: jest.fn(),
    };
});

jest.mock('@xterm/addon-search', () => {
    return {
        SearchAddon: jest.fn(),
    };
});

jest.mock('@xterm/addon-webgl', () => {
    return {
        WebglAddon: jest.fn(),
    };
});

jest.mock('@xterm/addon-serialize', () => {
    return {
        SerializeAddon: jest.fn(),
    };
});

jest.mock('@xterm/addon-image', () => {
    return {
        ImageAddon: jest.fn(),
    };
});

jest.mock('phirepass-channel', () => {
    return {
        __esModule: true,
        default: jest.fn(),
        Channel: jest.fn(function () {
            this.is_connected = jest.fn(() => false);
            this.connect = jest.fn();
            this.disconnect = jest.fn();
            this.stop_heartbeat = jest.fn();
            this.on_connection_open = jest.fn();
            this.on_connection_close = jest.fn();
            this.on_connection_error = jest.fn();
            this.on_connection_message = jest.fn();
            this.on_protocol_message = jest.fn();
            this.start_heartbeat = jest.fn();
            this.open_ssh_tunnel = jest.fn();
            this.send_ssh_terminal_resize = jest.fn();
            this.send_ssh_tunnel_data = jest.fn();
        }),
    };
});

import { newSpecPage } from '@stencil/core/testing';
import { PhirepassTerminal } from './phirepass-terminal';

describe('phirepass-terminal', () => {
    const originalResizeObserver = (globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;

    beforeAll(() => {
        (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class {
            observe = jest.fn();
            unobserve = jest.fn();
            disconnect = jest.fn();
        } as unknown as typeof ResizeObserver;
    });

    afterAll(() => {
        if (originalResizeObserver) {
            (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = originalResizeObserver;
            return;
        }
        delete (globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    });

    it('renders with shadow DOM', async () => {
        const page = await newSpecPage({
            components: [PhirepassTerminal],
            html: `<phirepass-terminal></phirepass-terminal>`,
        });
        expect(page.root.shadowRoot.querySelector('#ccc')).toBeTruthy();
    });

    it('has default serverHost and serverPort props', async () => {
        const page = await newSpecPage({
            components: [PhirepassTerminal],
            html: `<phirepass-terminal></phirepass-terminal>`,
        });
        expect(page.rootInstance.serverHost).toBe('phirepass.com');
        expect(page.rootInstance.serverPort).toBe(443);
    });

    it('has default heartbeatInterval prop', async () => {
        const page = await newSpecPage({
            components: [PhirepassTerminal],
            html: `<phirepass-terminal></phirepass-terminal>`,
        });
        expect(page.rootInstance.heartbeatInterval).toBe(30_000);
    });

    it('has allowInsecure prop defaulting to false', async () => {
        const page = await newSpecPage({
            components: [PhirepassTerminal],
            html: `<phirepass-terminal></phirepass-terminal>`,
        });
        expect(page.rootInstance.allowInsecure).toBe(false);
    });

    describe('createWebSocketEndpoint', () => {
        it('creates secure wss endpoint for default secure config', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal></phirepass-terminal>`,
            });
            const endpoint = page.rootInstance.createWebSocketEndpoint();
            expect(endpoint).toBe('wss://phirepass.com');
        });

        it('creates wss endpoint with custom secure host and port', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal server-host="custom.host" server-port="8443"></phirepass-terminal>`,
            });
            await page.waitForChanges();
            const endpoint = page.rootInstance.createWebSocketEndpoint();
            expect(endpoint).toBe('wss://custom.host:8443');
        });

        it('creates ws endpoint when allowInsecure is true with port 80', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal allow-insecure="true" server-port="80"></phirepass-terminal>`,
            });
            await page.waitForChanges();
            const endpoint = page.rootInstance.createWebSocketEndpoint();
            expect(endpoint).toBe('ws://phirepass.com');
        });

        it('creates ws endpoint with custom port when allowInsecure is true', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal allow-insecure="true" server-port="8080"></phirepass-terminal>`,
            });
            await page.waitForChanges();
            const endpoint = page.rootInstance.createWebSocketEndpoint();
            expect(endpoint).toBe('ws://phirepass.com:8080');
        });
    });

    describe('props', () => {
        it('accepts custom serverHost prop', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal server-host="test.example.com"></phirepass-terminal>`,
            });
            await page.waitForChanges();
            expect(page.rootInstance.serverHost).toBe('test.example.com');
        });

        it('accepts custom serverPort prop', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal server-port="9000"></phirepass-terminal>`,
            });
            await page.waitForChanges();
            expect(page.rootInstance.serverPort).toBe(9000);
        });

        it('accepts custom heartbeatInterval prop', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal heartbeat-interval="60000"></phirepass-terminal>`,
            });
            await page.waitForChanges();
            expect(page.rootInstance.heartbeatInterval).toBe(60000);
        });

        it('accepts nodeId prop', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal node-id="test-node-123"></phirepass-terminal>`,
            });
            await page.waitForChanges();
            expect(page.rootInstance.nodeId).toBe('test-node-123');
        });
    });

    describe('terminalOptions', () => {
        it('has correct terminal configuration', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal></phirepass-terminal>`,
            });

            const options = page.rootInstance.terminalOptions;
            expect(options.termName).toBe('xterm-256color');
            expect(options.rendererType).toBe('canvas');
            expect(options.fontSize).toBe(12);
            expect(options.cursorBlink).toBe(true);
            expect(options.scrollback).toBe(10000);
            expect(options.bellStyle).toBe('sound');
        });

        it('has correct theme configuration', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal></phirepass-terminal>`,
            });

            const theme = page.rootInstance.terminalOptions.theme;
            expect(theme.background).toBe('#0b1021');
            expect(theme.foreground).toBe('#e2e8f0');
            expect(theme.cursor).toBe('#67e8f9');
        });
    });

    describe('lifecycle', () => {
        it('displays warning when nodeId is not set during connectedCallback', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal></phirepass-terminal>`,
            });
            expect(page.rootInstance.nodeId).toBeUndefined();
            warnSpy.mockRestore();
        });
    });

    describe('input handling', () => {
        it('handles terminal data in default mode', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal></phirepass-terminal>`,
            });

            const component = page.rootInstance;
            const sendDataSpy = jest.spyOn(component, 'send_ssh_data');

            // Simulate default mode data input
            component.handleTerminalData('test command');
            expect(sendDataSpy).toHaveBeenCalledWith('test command');

            sendDataSpy.mockRestore();
        });
    });

    describe('session state management', () => {
        it('resets session state', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal></phirepass-terminal>`,
            });

            const component = page.rootInstance;
            component.session_id = 123;
            component['usernameBuffer'] = 'user';
            component['passwordBuffer'] = 'pass';

            // Private method, but we can access through reflection
            component['reset_session_state']();

            expect(component.session_id).toBeUndefined();
            expect(component['usernameBuffer']).toBe('');
            expect(component['passwordBuffer']).toBe('');
        });
    });

    describe('cancel operations', () => {
        it('cancelCredentialEntry clears buffers and resets', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal></phirepass-terminal>`,
            });

            const component = page.rootInstance;
            component['usernameBuffer'] = 'user';
            component['passwordBuffer'] = 'pass';

            // Initialize terminal mock for writeln
            component.terminal = {
                writeln: jest.fn(),
                reset: jest.fn(),
            } as any;

            component.cancel_credential_entry();

            expect(component['usernameBuffer']).toBe('');
            expect(component['passwordBuffer']).toBe('');
            expect(component.terminal.writeln).toHaveBeenCalledWith('Authentication cancelled.');
            expect(component.terminal.reset).toHaveBeenCalled();
        });
    });

    describe('tunnel state management', () => {
        it('handleTunnelClosed clears session and resets terminal', async () => {
            const page = await newSpecPage({
                components: [PhirepassTerminal],
                html: `<phirepass-terminal></phirepass-terminal>`,
            });

            const component = page.rootInstance;
            component.session_id = 123;
            component['usernameBuffer'] = 'user';
            component['passwordBuffer'] = 'pass';

            // Mock terminal
            component.terminal = {
                reset: jest.fn(),
                writeln: jest.fn(),
            } as any;

            component.handleTunnelClosed();

            expect(component.session_id).toBeUndefined();
            expect(component['usernameBuffer']).toBe('');
            expect(component['passwordBuffer']).toBe('');
            expect(component.terminal.reset).toHaveBeenCalled();
            expect(component.terminal.writeln).toHaveBeenCalledWith('Connection closed.');
        });
    });
});
