import { describe, it, expect, vi } from 'vitest';
import { ChannelSocket, ChannelSocketState } from './channel-socket';

/**
 * Mirrors the property list and the discovery logic in noVNC's
 * `Websock.attach()` (core/websock.js, verified against 1.7.0). Reproduced here
 * rather than imported because noVNC's package exports only expose the root
 * entry point, and this is the contract that silently breaks the widget: a
 * handler left declared-but-unassigned disappears at runtime and `attach()`
 * throws "Raw channel missing property".
 */
const RAW_CHANNEL_PROPS = [
    'send',
    'close',
    'binaryType',
    'onerror',
    'onmessage',
    'onopen',
    'protocol',
    'readyState',
];

function missingRawChannelProps(channel: object): string[] {
    const present = [
        ...Object.keys(channel),
        ...Object.getOwnPropertyNames(Object.getPrototypeOf(channel)),
    ];

    return RAW_CHANNEL_PROPS.filter((prop) => present.indexOf(prop) < 0);
}

function makeSocket() {
    const sent: Uint8Array[] = [];
    const close = vi.fn();
    const socket = new ChannelSocket((data) => sent.push(data), close);
    return { socket, sent, close };
}

describe('ChannelSocket', () => {
    it('satisfies every property noVNC requires of a raw channel', () => {
        const { socket } = makeSocket();
        expect(missingRawChannelProps(socket)).toEqual([]);
    });

    it('starts connecting and only opens once', () => {
        const { socket } = makeSocket();
        const onopen = vi.fn();
        socket.onopen = onopen;

        expect(socket.readyState).toBe(ChannelSocketState.Connecting);

        socket.open();
        socket.open();

        expect(socket.readyState).toBe(ChannelSocketState.Open);
        expect(onopen).toHaveBeenCalledTimes(1);
    });

    it('forwards sent bytes to the tunnel', () => {
        const { socket, sent } = makeSocket();
        socket.open();

        socket.send(new Uint8Array([1, 2, 3]));

        expect(sent).toHaveLength(1);
        expect(Array.from(sent[0])).toEqual([1, 2, 3]);
    });

    /**
     * noVNC sends views into a send queue it immediately reuses, so the adapter
     * must copy before handing the bytes on.
     */
    it('copies outgoing bytes out of the caller buffer', () => {
        const { socket, sent } = makeSocket();
        socket.open();

        const queue = new Uint8Array([9, 8, 7]);
        socket.send(queue);
        queue.fill(0);

        expect(Array.from(sent[0])).toEqual([9, 8, 7]);
    });

    it('unwraps ArrayBuffer views before sending', () => {
        const { socket, sent } = makeSocket();
        socket.open();

        const backing = new Uint8Array([0, 0, 4, 5, 0]);
        socket.send(new Uint8Array(backing.buffer, 2, 2));

        expect(Array.from(sent[0])).toEqual([4, 5]);
    });

    it('drops sends before open and after close', () => {
        const { socket, sent } = makeSocket();

        socket.send(new Uint8Array([1]));
        expect(sent).toHaveLength(0);

        socket.open();
        socket.closed();
        socket.send(new Uint8Array([2]));
        expect(sent).toHaveLength(0);
    });

    it('delivers received bytes as an ArrayBuffer', () => {
        const { socket } = makeSocket();
        const onmessage = vi.fn();
        socket.onmessage = onmessage;
        socket.open();

        socket.receive(new Uint8Array([7, 7]));

        expect(onmessage).toHaveBeenCalledTimes(1);
        const { data } = onmessage.mock.calls[0][0];
        expect(data).toBeInstanceOf(ArrayBuffer);
        expect(Array.from(new Uint8Array(data))).toEqual([7, 7]);
    });

    /** Incoming views may be backed by wasm memory that is reused after return. */
    it('copies incoming bytes out of the source buffer', () => {
        const { socket } = makeSocket();
        const onmessage = vi.fn();
        socket.onmessage = onmessage;
        socket.open();

        const incoming = new Uint8Array([3, 4]);
        socket.receive(incoming);
        incoming.fill(0);

        const { data } = onmessage.mock.calls[0][0];
        expect(Array.from(new Uint8Array(data))).toEqual([3, 4]);
    });

    it('closes the tunnel when noVNC closes the socket', () => {
        const { socket, close } = makeSocket();
        const onclose = vi.fn();
        socket.onclose = onclose;
        socket.open();

        socket.close();

        expect(close).toHaveBeenCalledTimes(1);
        expect(socket.readyState).toBe(ChannelSocketState.Closed);
        expect(onclose).toHaveBeenCalledTimes(1);
    });

    it('reports failures once and then closes', () => {
        const { socket } = makeSocket();
        const onerror = vi.fn();
        const onclose = vi.fn();
        socket.onerror = onerror;
        socket.onclose = onclose;
        socket.open();

        socket.failed(new Error('boom'));
        socket.closed();

        expect(onerror).toHaveBeenCalledTimes(1);
        expect(onclose).toHaveBeenCalledTimes(1);
        expect(socket.readyState).toBe(ChannelSocketState.Closed);
    });
});
