/**
 * Ambient types for noVNC, which ships as plain ES modules with no bundled
 * declarations. Only the surface `phirepass-vnc` uses is described here.
 *
 * Verified against @novnc/novnc 1.7.0.
 */
declare module '@novnc/novnc' {
    export interface RFBCredentials {
        username?: string;
        password?: string;
        target?: string;
    }

    export interface RFBOptions {
        shared?: boolean;
        credentials?: RFBCredentials;
        repeaterID?: string;
        wsProtocols?: string[];
    }

    /**
     * The second argument is a URL or any object carrying the raw-channel
     * surface noVNC checks for: `send`, `close`, `binaryType`, `onerror`,
     * `onmessage`, `onopen`, `protocol` and `readyState`.
     */
    export default class RFB extends EventTarget {
        constructor(target: Element, urlOrChannel: string | object, options?: RFBOptions);

        viewOnly: boolean;
        focusOnClick: boolean;
        clipViewport: boolean;
        dragViewport: boolean;
        scaleViewport: boolean;
        resizeSession: boolean;
        showDotCursor: boolean;
        background: string;
        qualityLevel: number;
        compressionLevel: number;

        readonly capabilities: { power?: boolean };

        disconnect(): void;
        sendCredentials(credentials: RFBCredentials): void;
        sendKey(keysym: number, code: string | null, down?: boolean): void;
        sendCtrlAltDel(): void;
        focus(options?: FocusOptions): void;
        blur(): void;
        clipboardPasteFrom(text: string): void;
        machineShutdown(): void;
        machineReboot(): void;
        machineReset(): void;
    }
}
