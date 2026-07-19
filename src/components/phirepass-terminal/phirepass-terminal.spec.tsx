import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, h } from '@stencil/vitest';

vi.mock('@xterm/xterm', () => {
    return {
        Terminal: vi.fn(function (this: any) {
            this.loadAddon = vi.fn();
            this.open = vi.fn();
            this.reset = vi.fn();
            this.dispose = vi.fn();
            this.write = vi.fn();
            this.writeln = vi.fn();
            this.focus = vi.fn();
            this.onData = vi.fn();
            this.cols = 80;
            this.rows = 24;
        }),
    };
});

vi.mock('@xterm/addon-fit', () => {
    return {
        FitAddon: vi.fn(function (this: any) {
            this.fit = vi.fn();
        }),
    };
});

vi.mock('@xterm/addon-web-links', () => {
    return { WebLinksAddon: vi.fn() };
});

vi.mock('@xterm/addon-search', () => {
    return { SearchAddon: vi.fn() };
});

vi.mock('@xterm/addon-webgl', () => {
    return { WebglAddon: vi.fn() };
});

vi.mock('@xterm/addon-serialize', () => {
    return { SerializeAddon: vi.fn() };
});

vi.mock('@xterm/addon-image', () => {
    return { ImageAddon: vi.fn() };
});

vi.mock('phirepass-channel', () => {
    return {
        __esModule: true,
        default: vi.fn(),
        ErrorType: {
            Generic: 0,
            Authentication: 10,
            RequiresUsername: 100,
            RequiresPassword: 110,
        },
        Channel: vi.fn(function (this: any) {
            this.is_connected = vi.fn(() => false);
            this.connect = vi.fn();
            this.disconnect = vi.fn();
            this.stop_heartbeat = vi.fn();
            this.on_connection_open = vi.fn();
            this.on_connection_close = vi.fn();
            this.on_connection_error = vi.fn();
            this.on_connection_message = vi.fn();
            this.on_protocol_message = vi.fn();
            this.start_heartbeat = vi.fn();
            this.open_ssh_tunnel = vi.fn();
            this.send_ssh_terminal_resize = vi.fn();
            this.send_ssh_tunnel_data = vi.fn();
        }),
    };
});

import './phirepass-terminal';
import { ProtocolMessageError } from '../../common/protocol';

describe('phirepass-terminal', () => {
    const originalResizeObserver = (globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;

    beforeAll(() => {
        (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        } as unknown as typeof ResizeObserver;
    });

    afterAll(() => {
        if (originalResizeObserver) {
            (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = originalResizeObserver;
            return;
        }
        delete (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    });

    it('renders with shadow DOM', async () => {
        const { root } = await render(h('phirepass-terminal', {}));
        expect(root.shadowRoot!.querySelector('#ccc')).toBeTruthy();
    });

    it('has default serverHost and serverPort props', async () => {
        const { root } = await render(h('phirepass-terminal', {}));
        expect((root as any).serverHost).toBe('phirepass.com');
        expect((root as any).serverPort).toBe(443);
    });

    it('has default heartbeatInterval prop', async () => {
        const { root } = await render(h('phirepass-terminal', {}));
        expect((root as any).heartbeatInterval).toBe(30_000);
    });

    it('has allowInsecure prop defaulting to false', async () => {
        const { root } = await render(h('phirepass-terminal', {}));
        expect((root as any).allowInsecure).toBe(false);
    });

    describe('props', () => {
        it('accepts custom serverHost prop', async () => {
            const { root, waitForChanges } = await render(h('phirepass-terminal', { serverHost: 'test.example.com' }));
            await waitForChanges();
            expect((root as any).serverHost).toBe('test.example.com');
        });

        it('accepts custom serverPort prop', async () => {
            const { root, waitForChanges } = await render(h('phirepass-terminal', { serverPort: 9000 }));
            await waitForChanges();
            expect((root as any).serverPort).toBe(9000);
        });

        it('accepts custom heartbeatInterval prop', async () => {
            const { root, waitForChanges } = await render(h('phirepass-terminal', { heartbeatInterval: 60000 }));
            await waitForChanges();
            expect((root as any).heartbeatInterval).toBe(60000);
        });

        it('accepts nodeId prop', async () => {
            const { root, waitForChanges } = await render(h('phirepass-terminal', { nodeId: 'test-node-123' }));
            await waitForChanges();
            expect((root as any).nodeId).toBe('test-node-123');
        });
    });

    describe('terminalOptions', () => {
        it('has correct terminal configuration', async () => {
            const { root } = await render(h('phirepass-terminal', {}));
            const options = (root as any).terminalOptions;
            expect(options.termName).toBe('xterm-256color');
            expect(options.rendererType).toBe('canvas');
            expect(options.fontSize).toBe(12);
            expect(options.cursorBlink).toBe(true);
            expect(options.scrollback).toBe(10000);
            expect(options.bellStyle).toBe('sound');
        });

        it('has correct theme configuration', async () => {
            const { root } = await render(h('phirepass-terminal', {}));
            const theme = (root as any).terminalOptions.theme;
            expect(theme.background).toBe('#0b1021');
            expect(theme.foreground).toBe('#e2e8f0');
            expect(theme.cursor).toBe('#67e8f9');
        });
    });

    describe('lifecycle', () => {
        it('displays warning when nodeId is not set during connectedCallback', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { root } = await render(h('phirepass-terminal', {}));
            expect((root as any).nodeId).toBeUndefined();
            warnSpy.mockRestore();
        });
    });

    describe('session state management', () => {
        it('resets session state', async () => {
            const { root } = await render(h('phirepass-terminal', {}));
            const component = root as any;
            component.session_id = 123;
            component['usernameBuffer'] = 'user';
            component['passwordBuffer'] = 'pass';

            component['reset_session_state']();

            expect(component.session_id).toBeUndefined();
            expect(component['usernameBuffer']).toBe('');
            expect(component['passwordBuffer']).toBe('');
        });
    });

    describe('cancel operations', () => {
        it('cancelCredentialEntry clears buffers and resets', async () => {
            const { root } = await render(h('phirepass-terminal', {}));
            const component = root as any;
            component['usernameBuffer'] = 'user';
            component['passwordBuffer'] = 'pass';
            component.terminal = {
                writeln: vi.fn(),
                reset: vi.fn(),
            };

            component.cancel_credential_entry();

            expect(component['usernameBuffer']).toBe('');
            expect(component['passwordBuffer']).toBe('');
            expect(component.terminal.writeln).toHaveBeenCalledWith('Authentication cancelled.');
            expect(component.terminal.reset).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('prints authentication failure messages in the terminal', async () => {
            const { root } = await render(h('phirepass-terminal', {}));
            const component = root as any;
            component.terminal = {
                reset: vi.fn(),
                write: vi.fn(),
                focus: vi.fn(),
            };

            component['handle_error']({
                kind: ProtocolMessageError.Authentication,
                message: 'SSH authentication failed',
                type: 'Error',
            } as any);

            expect(component.terminal.reset).toHaveBeenCalled();
            expect(component.terminal.write).toHaveBeenCalledWith('SSH authentication failed\r\n');
            expect(component.terminal.focus).toHaveBeenCalled();
        });
    });
});
