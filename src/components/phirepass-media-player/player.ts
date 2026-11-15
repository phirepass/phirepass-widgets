/** A stored playback position. `at` is when it was saved (unix ms). */
export type StoredPosition = { secs: number; duration: number; at: number };

/**
 * Where “Continue watching” keeps positions. The dashboard implements it with
 * `/api/playback`; with none given the player falls back to `localStorage`.
 */
export type PositionStore = {
    get(key: string): Promise<StoredPosition | null>;
    set(key: string, secs: number, duration: number): Promise<void>;
    clear?(key: string): Promise<void>;
};

const MIME: Record<string, string> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
};

export function extOf(name: string): string {
    const m = /\.([a-z0-9]+)$/i.exec(name);
    return m ? m[1].toLowerCase() : '';
}

/** Mime from the extension, as the agent's stream server decides it. */
export function mimeFor(name: string): string {
    return MIME[extOf(name)] ?? 'application/octet-stream';
}

export function isAudio(name: string, mime?: string): boolean {
    return (mime ?? mimeFor(name)).startsWith('audio/');
}

export function isPlayableName(name: string): boolean {
    return extOf(name) in MIME;
}

/**
 * Whether a Cast receiver can play this. The Default Media Receiver plays MP4
 * (H.264/AAC), WebM and common audio, mostly not MKV or MOV.
 */
export function castBlocker(name: string, mime?: string): string | null {
    const m = mime ?? mimeFor(name);
    if (m === 'video/x-matroska') {
        return 'TVs cannot play MKV files. Download it and play it with VLC.';
    }
    if (m === 'video/quicktime') {
        return 'TVs cannot play MOV files.';
    }
    return null;
}

/** Nothing is saved in the first 30 seconds. */
export const SAVE_AFTER_SECS = 30;
export const SAVE_EVERY_MS = 10_000;

/** Past 95%, or within the last two minutes, the file counts as watched and the position is cleared. */
export function isWatched(secs: number, duration: number): boolean {
    if (!Number.isFinite(duration) || duration <= 0) {
        return false;
    }
    return secs >= duration * 0.95 || duration - secs <= 120;
}

export type PositionAction = 'skip' | 'save' | 'clear';

export function positionAction(secs: number, duration: number): PositionAction {
    if (isWatched(secs, duration)) {
        return 'clear';
    }
    if (secs < SAVE_AFTER_SECS) {
        return 'skip';
    }
    return 'save';
}

const LS_PREFIX = 'phirepass.player.position.';

/** The fallback store, per browser. Every access is guarded: storage can be missing or refuse. */
export const localPositionStore: PositionStore = {
    async get(key) {
        try {
            const raw = window.localStorage.getItem(LS_PREFIX + key);
            if (!raw) {
                return null;
            }
            const value = JSON.parse(raw);
            return typeof value?.secs === 'number' ? (value as StoredPosition) : null;
        } catch {
            return null;
        }
    },
    async set(key, secs, duration) {
        try {
            window.localStorage.setItem(LS_PREFIX + key, JSON.stringify({ secs, duration, at: Date.now() }));
        } catch {
            // Nothing to do: the next visit starts from the beginning.
        }
    },
    async clear(key) {
        try {
            window.localStorage.removeItem(LS_PREFIX + key);
        } catch {
            // ignore
        }
    },
};

/** The subset of `RemotePlayback` the player uses; a property seam for demos and tests. */
export type RemotePlaybackLike = {
    state: 'disconnected' | 'connecting' | 'connected';
    watchAvailability(cb: (available: boolean) => void): Promise<number>;
    cancelWatchAvailability(id?: number): Promise<void>;
    prompt(): Promise<void>;
    addEventListener(type: 'connect' | 'connecting' | 'disconnect', cb: () => void): void;
    removeEventListener(type: 'connect' | 'connecting' | 'disconnect', cb: () => void): void;
};
