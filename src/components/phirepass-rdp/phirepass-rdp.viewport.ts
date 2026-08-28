import type { DesktopSize } from '@devolutions/iron-remote-desktop';

/**
 * RDP's display-control PDU describes a monitor in whole, even pixels within
 * these bounds. A layout outside them is refused by the host rather than
 * negotiated down, and the client reports nothing when that happens — so the
 * clamping has to be done here, before the request leaves.
 */
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 8192;

/**
 * The size requested at *connect* time travels in the Client Core Data, whose
 * desktop dimensions the protocol caps at 4096 — half what the display-control
 * PDU above allows. A host does not negotiate an out-of-range value down; it
 * drops the connection partway through the sequence, which the client can only
 * report as a truncated stream.
 */
const MAX_CONNECT_DIMENSION = 4096;

/** How long a drag has to settle before the host is asked for a new size. */
export const RESIZE_DEBOUNCE_MS = 250;

function clamp(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return MIN_DIMENSION;
    }

    return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.floor(value)));
}

function even(value: number): number {
    return value - (value % 2);
}

export function clamp_desktop_size(width: number, height: number): DesktopSize {
    return { width: even(clamp(width)), height: even(clamp(height)) };
}

/** The size the remote desktop would need to be to fill `element` exactly. */
export function measure_desktop_size(element: Element): DesktopSize {
    const rect = element.getBoundingClientRect();
    return clamp_desktop_size(rect.width, rect.height);
}

/**
 * The size to open a session at, or `undefined` when the widget has no usable
 * layout yet — in which case the host should choose and [`ViewportSync`] will
 * correct it as soon as the client is visible.
 *
 * This is deliberately not [`measure_desktop_size`]. That function clamps, which
 * is right for a resize — a host asked for something silly should get the
 * nearest legal size — but wrong here, because the widget legitimately measures
 * 0×0 before connecting: it sits in a `display: none` tab, or in a container
 * that has not been laid out, or is simply still hidden. Clamping turns that
 * into a request to open the desktop at 200×200, and "the smallest legal
 * desktop" is not what a zero-sized box meant. Asking for nothing is.
 */
export function measure_initial_desktop_size(element: Element): DesktopSize | undefined {
    const rect = element.getBoundingClientRect();

    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
        return undefined;
    }

    if (rect.width < MIN_DIMENSION || rect.height < MIN_DIMENSION) {
        return undefined;
    }

    return {
        width: even(Math.min(Math.floor(rect.width), MAX_CONNECT_DIMENSION)),
        height: even(Math.min(Math.floor(rect.height), MAX_CONNECT_DIMENSION)),
    };
}

export function same_desktop_size(a?: DesktopSize, b?: DesktopSize): boolean {
    return !!a && !!b && a.width === b.width && a.height === b.height;
}

/**
 * Reports the widget's size to whoever can act on it, as the widget is resized.
 *
 * Two behaviours are deliberate. It **debounces**, because dragging a panel
 * edge emits a resize per frame while every report costs a display-control
 * round trip to the host — and a host that is still applying one layout ignores
 * the next. And it **drops repeats**, because a resize observer also fires for
 * changes that do not move the desktop at all (a scrollbar appearing, the
 * canvas being re-laid-out in response to the resize this class just asked for,
 * which would otherwise loop).
 */
export class ViewportSync {
    private observer?: ResizeObserver;
    private handle?: ReturnType<typeof setTimeout>;
    private reported?: DesktopSize;

    constructor(
        private readonly onResize: (size: DesktopSize) => void,
        private readonly debounceMs: number = RESIZE_DEBOUNCE_MS,
    ) {}

    /**
     * Starts watching `element`. The current size is reported immediately, so a
     * widget that was resized while disconnected catches up on reconnect.
     *
     * `openedAt` is the size the session was actually opened at, and passing it
     * is what stops that immediate report from being a resize to the resolution
     * the host is already showing. That redundant request is not free: a
     * display-control PDU makes the host renegotiate capabilities and resend the
     * screen, and arriving moments after the connection sequence it is the worst
     * possible time to ask — the client can end up parsing a bitmap whose
     * declared length no longer matches the stream. Seeded here rather than
     * suppressed at the call site because "what has the host been told" is this
     * class's state; the caller only knows what it asked for at connect.
     */
    observe(element: Element, openedAt?: DesktopSize) {
        this.disconnect();
        this.reported = openedAt;
        this.report(measure_desktop_size(element));

        // Absent under the spec test environment, and on nothing else worth
        // supporting — a missing observer costs the dynamic resize, not the
        // session.
        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        this.observer = new ResizeObserver(() => {
            clearTimeout(this.handle);
            this.handle = setTimeout(() => this.report(measure_desktop_size(element)), this.debounceMs);
        });

        this.observer.observe(element);
    }

    disconnect() {
        clearTimeout(this.handle);
        this.handle = undefined;
        this.observer?.disconnect();
        this.observer = undefined;
        this.reported = undefined;
    }

    private report(size: DesktopSize) {
        if (same_desktop_size(size, this.reported)) {
            return;
        }

        this.reported = size;
        this.onResize(size);
    }
}
