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
    displayControl: vi.fn((enable: boolean) => ({ extension: 'display_control', enable })),
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
        // Collected, not overwritten: more than one extension is registered and
        // a builder that kept only the last would hide exactly that.
        withExtension: vi.fn((v: unknown) => ((built.extensions as unknown[]).push(v), builder)),
        withDesktopSize: vi.fn((v: unknown) => ((built.desktopSize = v), builder)),
        build: vi.fn(() => built),
    };
    built.extensions = [];
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
        resize: vi.fn(),
        setEnableClipboard: vi.fn(),
        onWarningCallback: vi.fn(),
        ctrlAltDel: vi.fn(),
        metaKey: vi.fn(),
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
        /**
         * `beforeReady` runs after the widget is rendered but before the client
         * announces itself — the only window in which the widget's layout can be
         * staged, since connecting is what reads it.
         */
        async function reachReadyClient(
            props: Record<string, unknown> = {},
            beforeReady?: (root: HTMLElement) => void,
        ) {
            const rendered = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2', ...props }),
            );

            channel().handlers.protocol(authSuccessFrame());
            channel().handlers.protocol(authorizedFrame());

            await waitFor(() => !!rendered.root.querySelector('iron-remote-desktop'), 'the RDP client element');

            beforeReady?.(rendered.root as HTMLElement);

            const element = rendered.root.querySelector('iron-remote-desktop') as HTMLElement & { module: unknown };
            const userInteraction = fakeUserInteraction();
            element.dispatchEvent(new CustomEvent('ready', { detail: { irgUserInteraction: userInteraction } }));

            await waitFor(() => (userInteraction.connect as any).mock.calls.length > 0, 'the client to connect');

            return { ...rendered, element, userInteraction };
        }

        it('creates the client with the RDP backend module', async () => {
            const { element } = await reachReadyClient();
            expect(element.module).toEqual({ backend: 'rdp' });
        });

        // IronRDP forwards keystrokes only while `document.activeElement` is its
        // own element, and `activeElement` retargets to the outermost shadow
        // host — so a client mounted inside this widget's shadow root would get
        // the mouse but never a key. It has to be slotted from the light DOM.
        it('mounts the client in the light DOM so keystrokes reach it', async () => {
            const { root, element } = await reachReadyClient();

            expect(element.parentElement).toBe(root);
            expect(root.shadowRoot!.querySelector('iron-remote-desktop')).toBeFalsy();
            expect(root.shadowRoot!.querySelector('.screen slot')).toBeTruthy();
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
            expect(config.extensions).toContainEqual({ extension: 'credssp', enable: true });
        });

        // The DisplayControl virtual channel is negotiated at connect time and
        // never afterwards, so a client that did not register the extension can
        // only fail every resize — which the widget reports as a host that
        // would not resize, making a missing extension look like a host
        // limitation. Every other resize test drives a stubbed client and would
        // pass without the channel ever being asked for; this is the one that
        // says it was.
        it('asks for the display control channel so resizes are more than a no-op', async () => {
            const { userInteraction } = await reachReadyClient();
            const config = (userInteraction.connect as any).mock.calls[0][0];

            expect(config.extensions).toContainEqual({ extension: 'display_control', enable: true });
        });

        it('never asks for display control when dynamic resize is off', async () => {
            const { userInteraction } = await reachReadyClient({ dynamicResize: false });
            const config = (userInteraction.connect as any).mock.calls[0][0];

            expect(config.extensions).toContainEqual({ extension: 'credssp', enable: true });
            expect(config.extensions).not.toContainEqual({ extension: 'display_control', enable: true });
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

        // The desktop is asked for at the widget's size so the host logs in at
        // the right resolution instead of resizing a moment later.
        it('asks for a desktop the size of the widget', async () => {
            const { userInteraction } = await reachReadyClient({}, (root) => {
                root.getBoundingClientRect = () => ({ width: 1281, height: 903 }) as DOMRect;
            });
            const config = (userInteraction.connect as any).mock.calls[0][0];

            expect(config.desktopSize).toEqual({ width: 1280, height: 902 });
        });

        // A widget in a hidden tab, or one whose container has not been laid
        // out, measures 0×0. Rounding that up to the smallest legal desktop
        // asks the host to open at 200×200 — a size no one wants, and one a
        // host may refuse by dropping the connection mid-sequence, which the
        // client can only report as a truncated stream. Ask for nothing and let
        // the resize that follows visibility set the real size.
        it('asks for no desktop size when the widget has not been laid out', async () => {
            const { userInteraction } = await reachReadyClient();
            const config = (userInteraction.connect as any).mock.calls[0][0];

            expect(config.desktopSize).toBeUndefined();
        });

        // The connect-time field is capped at 4096 by the protocol, unlike the
        // display-control PDU the later resizes go through.
        it('caps the requested desktop at what the connect PDU allows', async () => {
            const { userInteraction } = await reachReadyClient({}, (root) => {
                root.getBoundingClientRect = () => ({ width: 5120, height: 2880 }) as DOMRect;
            });
            const config = (userInteraction.connect as any).mock.calls[0][0];

            expect(config.desktopSize).toEqual({ width: 4096, height: 2880 });
        });

        it('leaves the desktop size to the host when dynamic resize is off', async () => {
            const { userInteraction } = await reachReadyClient({ dynamicResize: false });
            const config = (userInteraction.connect as any).mock.calls[0][0];

            expect(config.desktopSize).toBeUndefined();
        });

        // The widget's size is measured only once the client has been made
        // visible; before that it is a hidden, zero-sized box.
        it('resizes the remote desktop to the widget once the session is up', async () => {
            const { userInteraction } = await reachReadyClient();

            await waitFor(() => (userInteraction.resize as any).mock.calls.length > 0, 'the resize request');
            expect((userInteraction.resize as any).mock.calls[0]).toEqual([200, 200]);
        });

        it('never resizes the remote desktop when dynamic resize is off', async () => {
            const { userInteraction } = await reachReadyClient({ dynamicResize: false });

            await waitFor(() => (mocks.sessions[0].run as any).mock.calls.length > 0, 'the session to run');
            expect(userInteraction.resize).not.toHaveBeenCalled();
        });

        // The client shares the clipboard by default and wires the browser side
        // up itself, so the widget's job is only to be able to take it away —
        // and to leave it alone otherwise. Turning it off has to happen before
        // `connect`, which is when the client decides whether to register the
        // clipboard callbacks with its backend at all.
        it('leaves the clipboard alone when it is allowed', async () => {
            const { userInteraction } = await reachReadyClient();
            expect(userInteraction.setEnableClipboard).not.toHaveBeenCalled();
        });

        it('takes the clipboard away before connecting when it is not allowed', async () => {
            const { userInteraction } = await reachReadyClient({ clipboard: false });

            expect(userInteraction.setEnableClipboard).toHaveBeenCalledWith(false);
            expect((userInteraction.setEnableClipboard as any).mock.invocationCallOrder[0])
                .toBeLessThan((userInteraction.connect as any).mock.invocationCallOrder[0]);
        });

        // An insecure context, a browser without the async clipboard API, a
        // read the user never granted: the client reports all of them here and
        // nowhere else, so an unregistered callback makes a clipboard that does
        // nothing indistinguishable from one nobody asked for.
        it('listens for the warnings the client would otherwise drop', async () => {
            const { userInteraction } = await reachReadyClient();
            expect(userInteraction.onWarningCallback).toHaveBeenCalledTimes(1);

            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            (userInteraction.onWarningCallback as any).mock.calls[0][0]('Clipboard is not supported');

            expect(warn).toHaveBeenCalledWith(expect.any(String), 'Clipboard is not supported');
            warn.mockRestore();
        });

        it('reports the reason the session ended', async () => {
            const { root, waitForChanges } = await reachReadyClient();

            await waitFor(() => (mocks.sessions[0].run as any).mock.calls.length > 0, 'the session to run');
            await waitForChanges();

            expect(root.shadowRoot!.querySelector('.status')!.textContent).toContain('session ended');
        });
    });

    /**
     * Ctrl+Alt+Del is a secure attention sequence the operating system takes
     * before any browser sees it, and the Meta key is claimed by the browser
     * and the desktop environment. Neither can be typed into the remote host,
     * so both have to be sendable directly or a locked Windows desktop is a
     * dead end.
     */
    describe('keys the browser can never forward', () => {
        async function reachRunningSession() {
            const rendered = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2' }),
            );

            channel().handlers.protocol(authSuccessFrame());
            channel().handlers.protocol(authorizedFrame());

            await waitFor(() => !!rendered.root.querySelector('iron-remote-desktop'), 'the RDP client element');

            const element = rendered.root.querySelector('iron-remote-desktop') as HTMLElement;
            const userInteraction = fakeUserInteraction();
            element.dispatchEvent(new CustomEvent('ready', { detail: { irgUserInteraction: userInteraction } }));

            await waitFor(() => (userInteraction.connect as any).mock.calls.length > 0, 'the client to connect');

            return { ...rendered, userInteraction };
        }

        it('sends ctrl+alt+del to the host', async () => {
            const { root, userInteraction } = await reachRunningSession();

            await expect((root as any).sendCtrlAltDel()).resolves.toBe(true);
            expect(userInteraction.ctrlAltDel).toHaveBeenCalledTimes(1);
        });

        it('sends the meta key to the host', async () => {
            const { root, userInteraction } = await reachRunningSession();

            await expect((root as any).sendMetaKey()).resolves.toBe(true);
            expect(userInteraction.metaKey).toHaveBeenCalledTimes(1);
        });

        // The panel offers the control for as long as a tab is open, which is
        // longer than a session lasts: before the client connects and after it
        // has been torn down there is nothing to send to, and saying so lets
        // the caller disable the control rather than have it fail silently.
        it('reports that it sent nothing when there is no session', async () => {
            const { root } = await render(h('phirepass-rdp', { ...baseProps }));

            await expect((root as any).sendCtrlAltDel()).resolves.toBe(false);
            await expect((root as any).sendMetaKey()).resolves.toBe(false);
        });
    });

    /**
     * Closing an RDP tab unmounts the widget and nothing else. The session it
     * leaves behind is not local: the agent holds a TCP connection to the RDP
     * host and the host holds a desktop, so anything the widget fails to shut
     * down stays open on someone else's machine.
     */
    describe('closing the tab', () => {
        it('shuts the session down and closes the channel', async () => {
            const rendered = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2' }),
            );

            channel().handlers.protocol(authSuccessFrame());
            channel().handlers.protocol(authorizedFrame());

            await waitFor(() => !!rendered.root.querySelector('iron-remote-desktop'), 'the RDP client element');

            const userInteraction = fakeUserInteraction();
            rendered.root
                .querySelector('iron-remote-desktop')!
                .dispatchEvent(new CustomEvent('ready', { detail: { irgUserInteraction: userInteraction } }));
            await waitFor(() => (userInteraction.connect as any).mock.calls.length > 0, 'the client to connect');

            rendered.root.remove();

            expect(userInteraction.shutdown).toHaveBeenCalled();
            expect(channel().disconnect).toHaveBeenCalled();
            expect(channel().stop_heartbeat).toHaveBeenCalled();
        });

        // The socket the RDP client opened belongs to the client, and the only
        // way to close it is to let its session loop start and see the shutdown
        // it was handed. Returning early instead would leak the socket — and
        // with it the agent's connection to the host.
        it('shuts down a session that arrives after the widget is gone', async () => {
            const rendered = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2' }),
            );

            channel().handlers.protocol(authSuccessFrame());
            channel().handlers.protocol(authorizedFrame());

            await waitFor(() => !!rendered.root.querySelector('iron-remote-desktop'), 'the RDP client element');

            const userInteraction = fakeUserInteraction();
            const session = mocks.sessions[mocks.sessions.length - 1];
            let handshakeDone: (value: unknown) => void = () => {};
            userInteraction.connect = vi.fn(
                () => new Promise((resolve) => (handshakeDone = resolve)),
            ) as any;

            rendered.root
                .querySelector('iron-remote-desktop')!
                .dispatchEvent(new CustomEvent('ready', { detail: { irgUserInteraction: userInteraction } }));
            await waitFor(() => (userInteraction.connect as any).mock.calls.length > 0, 'the client to connect');

            rendered.root.remove();
            handshakeDone(session);

            await waitFor(() => (session.run as any).mock.calls.length > 0, 'the session to be drained');
            expect(userInteraction.shutdown).toHaveBeenCalled();
            expect(userInteraction.setVisibility).not.toHaveBeenCalled();
        });

        // The ticket is already minted at this point, but the client that would
        // use it is still a dynamic import away. Mounting it now would open a
        // socket for a widget that no longer exists.
        it('never mounts a client for a widget that has gone', async () => {
            const rendered = await render(
                h('phirepass-rdp', { ...baseProps, username: 'admin', password: 'hunter2' }),
            );

            channel().handlers.protocol(authSuccessFrame());
            channel().handlers.protocol(authorizedFrame());
            rendered.root.remove();

            for (let tick = 0; tick < 10; tick += 1) {
                await new Promise((resolve) => setTimeout(resolve, 5));
            }

            expect(rendered.root.querySelector('iron-remote-desktop')).toBeFalsy();
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

            await waitFor(() => !!rendered.root.querySelector('iron-remote-desktop'), 'the RDP client element');

            const userInteraction = fakeUserInteraction();
            userInteraction.connect = vi.fn(async () => {
                throw { backtrace: () => 'CredSSP: logon failure', kind: () => 2 };
            }) as any;

            rendered.root
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

            await waitFor(() => !!rendered.root.querySelector('iron-remote-desktop'), 'the RDP client element');

            const userInteraction = fakeUserInteraction();
            rendered.root
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
            expect(rendered.root.querySelector('iron-remote-desktop')).toBeFalsy();
            expect(channel().disconnect).toHaveBeenCalled();
        });
    });
});
