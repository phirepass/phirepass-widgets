/**
 * Presents a phirepass tunnel as the "raw channel" noVNC expects in place of a
 * WebSocket.
 *
 * noVNC's `Websock.attach()` validates the object it is handed against a fixed
 * property list — `send`, `close`, `binaryType`, `onerror`, `onmessage`,
 * `onopen`, `protocol`, `readyState` — collected from `Object.keys(channel)`
 * plus the own property names of its prototype. Methods and getters satisfy
 * that from the prototype; the event handlers only satisfy it if they are
 * *assigned* in the constructor, so every one of them is initialised to `null`
 * below even though TypeScript would not otherwise require it. Leaving one
 * merely declared makes `attach()` throw "Raw channel missing property".
 */

/** Matches the numeric `WebSocket.readyState` constants noVNC compares against. */
export enum ChannelSocketState {
    Connecting = 0,
    Open = 1,
    Closing = 2,
    Closed = 3,
}

export type ChannelSocketSend = (data: Uint8Array) => void;
export type ChannelSocketClose = () => void;

export class ChannelSocket {
    /** noVNC overwrites this with "arraybuffer" during attach. */
    binaryType: string = 'arraybuffer';

    /** Always empty: there is no WebSocket sub-protocol negotiation here. */
    readonly protocol: string = '';

    readyState: number = ChannelSocketState.Connecting;

    onopen: ((event?: unknown) => void) | null = null;
    onmessage: ((event: { data: ArrayBuffer }) => void) | null = null;
    onclose: ((event?: unknown) => void) | null = null;
    onerror: ((event?: unknown) => void) | null = null;

    private readonly sendData: ChannelSocketSend;
    private readonly closeTunnel: ChannelSocketClose;

    constructor(sendData: ChannelSocketSend, closeTunnel: ChannelSocketClose) {
        this.sendData = sendData;
        this.closeTunnel = closeTunnel;
    }

    /** Marks the tunnel as usable and lets noVNC start the RFB handshake. */
    open() {
        if (this.readyState !== ChannelSocketState.Connecting) {
            return;
        }

        this.readyState = ChannelSocketState.Open;
        this.onopen?.();
    }

    /** Hands bytes arriving from the node up to noVNC. */
    receive(data: Uint8Array) {
        if (this.readyState !== ChannelSocketState.Open) {
            return;
        }

        // Copy into a standalone buffer: the incoming view may be backed by
        // wasm memory that is reused or detached after this call returns.
        const buffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(buffer).set(data);

        this.onmessage?.({ data: buffer });
    }

    /** Ends the socket from the phirepass side (tunnel closed, disconnect). */
    closed() {
        if (this.readyState === ChannelSocketState.Closed) {
            return;
        }

        this.readyState = ChannelSocketState.Closed;
        this.onclose?.();
    }

    failed(error?: unknown) {
        this.onerror?.(error);
        this.closed();
    }

    // ── the surface noVNC calls ───────────────────────────────────────────────

    send(data: ArrayBuffer | ArrayBufferView) {
        if (this.readyState !== ChannelSocketState.Open) {
            return;
        }

        const bytes =
            data instanceof ArrayBuffer
                ? new Uint8Array(data)
                : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

        // Copy before handing off: noVNC sends views into its own reusable
        // send queue, which it overwrites immediately afterwards.
        this.sendData(new Uint8Array(bytes));
    }

    close() {
        if (this.readyState === ChannelSocketState.Closed) {
            return;
        }

        this.readyState = ChannelSocketState.Closing;
        this.closeTunnel();
        this.closed();
    }
}
