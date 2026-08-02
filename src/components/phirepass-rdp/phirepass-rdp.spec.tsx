import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, h } from '@stencil/vitest';

/**
 * The widget owns the browser half of the two-socket RDP handshake: it asks the
 * control socket for a tunnel, waits for `RDPAuthorized`, and hands the ticket
 * to an RDP client that opens its own socket. These tests drive that sequence
 * with the channel and the IronRDP packages stubbed, so what is under test is
 * the handoff — which values reach which client, and in what order.
 */

const mocks = vi.hoisted(() => {
    const channels: any[] = [];
    const builders: any[] = [];
    const sessions: any[] = [];

    return { channels, builders, sessions };
});

vi.mock('phirepass-channel', () => {
    return {
        __esModule: true,
        default: vi.fn(async () => {}),
        ErrorType: { Generic: 0, Authentication: 10 },
        Channel: vi.fn(function (this: any) {
            this.handlers = {};
            this.is_connected = vi.fn(() => false);
            this.connect = vi.fn();
            this.disconnect = vi.fn();
            this.authenticate = vi.fn();
            this.stop_heartbeat = vi.fn();
            this.start_heartbeat = vi.fn();
            this.on_connection_open = vi.fn((cb: unknown) => (this.handlers.open = cb));
            this.on_connection_close = vi.fn((cb: unknown) => (this.handlers.close = cb));
            this.on_connection_error = vi.fn((cb: unknown) => (this.handlers.error = cb));
            this.on_connection_message = vi.fn();
            this.on_protocol_message = vi.fn((cb: unknown) => (this.handlers.protocol = cb));
            this.open_rdp_tunnel = vi.fn();
            mocks.channels.push(this);
        }),
    };
});

vi.mock('@devolutions/iron-remote-desktop', () => ({ __esModule: true, default: {} }));

vi.mock('@devolutions/iron-remote-desktop-rdp', () => ({
    __esModule: true,
    init: vi.fn(async () => {}),
    Backend: { backend: 'rdp' },
    enableCredssp: vi.fn((enable: boolean) => ({ extension: 'credssp', enable })),
}));

import './phirepass-rdp';

/** The `UserInteraction` the `iron-remote-desktop` element hands over on `ready`. */
function fakeUserInteraction() {
    const built: Record<string, unknown> = {};
    const builder: any = {
        built,
        withUsername: vi.fn((v: string) => ((built.username = v), builder)),
        withPassword: vi.fn((v: string) => ((built.password = v), builder)),
        withDestination: vi.fn((v: string) => ((built.destination = v), builder)),
        withProxyAddress: vi.fn((v: string) => ((built.proxyAddress = v), builder)),
        withAuthToken: vi.fn((v: string) => ((built.authToken = v), builder)),
        withExtension: vi.fn((v: unknown) => ((built.extension = v), builder)),
        build: vi.fn(() => built),
    };
    mocks.builders.push(builder);

    const session = {
        run: vi.fn(async () => ({ reason: () => 'session ended' })),
    };
    mocks.sessions.push(session);

    return {
        configBuilder: vi.fn(() => builder),
        connect: vi.fn(async () => session),
        setVisibility: vi.fn(),
        shutdown: vi.fn(),
    };
}

async function waitFor(predicate: () => boolean, what: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`timed out waiting for ${what}`);
}

const NODE_ID = 'e9d5a1b0-0000-4000-8000-000000000001';
const SERVICE_ID = 'a1b2c3d4-0000-4000-8000-000000000002';
const TICKET = 'ticket-from-the-server';

const baseProps = {
    nodeId: NODE_ID,
    serviceId: SERVICE_ID,
    token: 'jwt',
    serverHost: 'example.test',
    serverPort: 443,
};

/** The `RDPAuthorized` frame, in the shape `on_protocol_message` delivers. */
function authorizedFrame(ticket = TICKET, sid = 42) {
    return { version: 1, encoding: 'MessagePack', data: { web: { type: 'RDPAuthorized', sid, ticket } } };
}

function authSuccessFrame() {
    return { version: 1, encoding: 'MessagePack', data: { web: { type: 'AuthSuccess', cid: 'cid', version: '1' } } };
}

describe('phirepass-rdp', () => {
    beforeEach(() => {
        mocks.channels.length = 0;
        mocks.builders.length = 0;
        mocks.sessions.length = 0;
    });

    const channel = () => mocks.channels[mocks.channels.length - 1];

    it('renders with shadow DOM', async () => {
        const { root } = await render(h('phirepass-rdp', { ...baseProps }));
        expect(root.shadowRoot!.querySelector('.screen')).toBeTruthy();
    });

    it('defaults scale to fit', async () => {
        const { root } = await render(h('phirepass-rdp', { ...baseProps }));
        expect((root as any).scale).toBe('fit');
    });

    describe('authorising the tunnel', () => {
        it('opens the tunnel with the credentials it was given', async () => {
            await render(h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2' }));

            channel().handlers.protocol(authSuccessFrame());

            expect(channel().start_heartbeat).toHaveBeenCalled();
            expect(channel().open_rdp_tunnel).toHaveBeenCalledWith(NODE_ID, SERVICE_ID, 'admin', 'hunter2');
        });

        // The agent rejects an authorize with an empty username or password, so
        // asking first is not merely cosmetic.
        it('prompts instead of opening a tunnel when credentials are missing', async () => {
            const { root, waitForChanges } = await render(h('phirepass-rdp', { ...baseProps }));

            channel().handlers.protocol(authSuccessFrame());
            await waitForChanges();

            expect(channel().open_rdp_tunnel).not.toHaveBeenCalled();
            expect(root.shadowRoot!.querySelector('form.prompt')).toBeTruthy();
        });

        it('opens the tunnel once the prompt is submitted', async () => {
            const { root, waitForChanges } = await render(h('phirepass-rdp', { ...baseProps }));

            channel().handlers.protocol(authSuccessFrame());
            await waitForChanges();

            const form = root.shadowRoot!.querySelector('form.prompt') as HTMLFormElement;
            const [username, password] = Array.from(form.querySelectorAll('input')) as HTMLInputElement[];

            username.value = 'admin';
            username.dispatchEvent(new Event('input'));
            password.value = 'hunter2';
            password.dispatchEvent(new Event('input'));
            form.dispatchEvent(new Event('submit'));
            await waitForChanges();

            expect(channel().open_rdp_tunnel).toHaveBeenCalledWith(NODE_ID, SERVICE_ID, 'admin', 'hunter2');
            expect(root.shadowRoot!.querySelector('form.prompt')).toBeFalsy();
        });
    });

    describe('handing the session to the RDP client', () => {
        async function reachReadyClient(props: Record<string, unknown> = {}) {
            const rendered = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2', ...props }),
            );

            channel().handlers.protocol(authSuccessFrame());
            channel().handlers.protocol(authorizedFrame());

            const screen = rendered.root.shadowRoot!.querySelector('.screen')!;
            await waitFor(() => !!screen.querySelector('iron-remote-desktop'), 'the RDP client element');

            const element = screen.querySelector('iron-remote-desktop') as HTMLElement & { module: unknown };
            const userInteraction = fakeUserInteraction();
            element.dispatchEvent(new CustomEvent('ready', { detail: { irgUserInteraction: userInteraction } }));

            await waitFor(() => (userInteraction.connect as any).mock.calls.length > 0, 'the client to connect');

            return { ...rendered, element, userInteraction };
        }

        it('creates the client with the RDP backend module', async () => {
            const { element } = await reachReadyClient();
            expect(element.module).toEqual({ backend: 'rdp' });
        });

        // The ticket is the only authorisation the RDP socket ever sees, and the
        // node id has to be in the path because the relay routes on it before
        // any WebSocket payload exists.
        it('points the client at its own socket, authorised by the ticket', async () => {
            const { userInteraction } = await reachReadyClient();
            const config = (userInteraction.connect as any).mock.calls[0][0];

            expect(config.proxyAddress).toBe(`wss://example.test/api/web/rdp/${NODE_ID}`);
            expect(config.authToken).toBe(TICKET);
        });

        it('passes the same credentials on to CredSSP', async () => {
            const { userInteraction } = await reachReadyClient();
            const config = (userInteraction.connect as any).mock.calls[0][0];

            expect(config.username).toBe('admin');
            expect(config.password).toBe('hunter2');
            expect(config.extension).toEqual({ extension: 'credssp', enable: true });
        });

        it('names the destination the caller supplied, falling back to the node id', async () => {
            const withDestination = await reachReadyClient({ destination: '10.0.0.5:3389' });
            expect((withDestination.userInteraction.connect as any).mock.calls[0][0].destination).toBe('10.0.0.5:3389');

            const withoutDestination = await reachReadyClient();
            expect((withoutDestination.userInteraction.connect as any).mock.calls[0][0].destination).toBe(NODE_ID);
        });

        // The client hides its canvas until told otherwise, and only starts
        // reading the socket once `run` is called.
        it('makes the session visible and runs it', async () => {
            const { userInteraction } = await reachReadyClient();
            await waitFor(() => (mocks.sessions[0].run as any).mock.calls.length > 0, 'the session to run');
            expect(userInteraction.setVisibility).toHaveBeenCalledWith(true);
        });

        it('reports the reason the session ended', async () => {
            const { root, waitForChanges } = await reachReadyClient();

            await waitFor(() => (mocks.sessions[0].run as any).mock.calls.length > 0, 'the session to run');
            await waitForChanges();

            expect(root.shadowRoot!.querySelector('.status')!.textContent).toContain('session ended');
        });
    });

    describe('failures', () => {
        it('surfaces an error frame from the server', async () => {
            const { root, waitForChanges } = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2' }),
            );

            channel().handlers.protocol({
                version: 1,
                encoding: 'MessagePack',
                data: { web: { type: 'Error', kind: 0, message: 'Unknown service type' } },
            });
            await waitForChanges();

            expect(root.shadowRoot!.querySelector('.status')!.textContent).toContain('Unknown service type');
        });

        // IronRDP rejects with its own error shape rather than an `Error`, so a
        // naive `err.message` would render "undefined".
        it('describes an IronRDP failure using its backtrace', async () => {
            const rendered = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2' }),
            );

            channel().handlers.protocol(authSuccessFrame());
            channel().handlers.protocol(authorizedFrame());

            const screen = rendered.root.shadowRoot!.querySelector('.screen')!;
            await waitFor(() => !!screen.querySelector('iron-remote-desktop'), 'the RDP client element');

            const userInteraction = fakeUserInteraction();
            userInteraction.connect = vi.fn(async () => {
                throw { backtrace: () => 'CredSSP: logon failure', kind: () => 2 };
            }) as any;

            screen
                .querySelector('iron-remote-desktop')!
                .dispatchEvent(new CustomEvent('ready', { detail: { irgUserInteraction: userInteraction } }));

            await waitFor(
                () => !!rendered.root.shadowRoot!.querySelector('.status'),
                'the failure to be reported',
            );
            await rendered.waitForChanges();

            expect(rendered.root.shadowRoot!.querySelector('.status')!.textContent).toContain('logon failure');
        });

        it('tears the client down when the agent closes the tunnel', async () => {
            const rendered = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2' }),
            );

            channel().handlers.protocol(authSuccessFrame());
            channel().handlers.protocol(authorizedFrame());

            const screen = rendered.root.shadowRoot!.querySelector('.screen')!;
            await waitFor(() => !!screen.querySelector('iron-remote-desktop'), 'the RDP client element');

            const userInteraction = fakeUserInteraction();
            screen
                .querySelector('iron-remote-desktop')!
                .dispatchEvent(new CustomEvent('ready', { detail: { irgUserInteraction: userInteraction } }));
            await waitFor(() => (userInteraction.connect as any).mock.calls.length > 0, 'the client to connect');

            channel().handlers.protocol({
                version: 1,
                encoding: 'MessagePack',
                data: { web: { type: 'TunnelClosed', protocol: 2, sid: 42 } },
            });
            await rendered.waitForChanges();

            expect(userInteraction.shutdown).toHaveBeenCalled();
            expect(screen.querySelector('iron-remote-desktop')).toBeFalsy();
            expect(channel().disconnect).toHaveBeenCalled();
        });
    });
});
