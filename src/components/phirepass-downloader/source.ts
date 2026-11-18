import { DENIED_AUTH_HEADERS, FETCH_TORRENT_MAX_BYTES, SourceAuth } from '../../common/fetch';

export type DetectedSource =
    | { kind: 'empty' }
    | { kind: 'http'; url: string; host: string; name: string; scheme: 'HTTP' | 'HTTPS' }
    /** An HTTP(S) link whose path ends in `.torrent`: fetched as a file, like any link. */
    | { kind: 'torrent-url'; url: string; host: string; name: string; scheme: 'HTTP' | 'HTTPS' }
    | { kind: 'magnet'; uri: string; name?: string; infoHash?: string }
    | { kind: 'invalid' };

function lastSegment(pathname: string): string {
    const parts = pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] ?? '';
    try {
        return decodeURIComponent(last);
    } catch {
        return last;
    }
}

/**
 * Works out what was pasted into the Fetch field, as the person types.
 *
 * Only `http:`, `https:` and `magnet:` are links here; anything else is
 * `invalid` (B4). The name is a guess for the Save as placeholder and the
 * “Saved under another name” notice. The node has the last word.
 */
export function detectSource(text: string): DetectedSource {
    const value = text.trim();
    if (!value) {
        return { kind: 'empty' };
    }

    if (/^magnet:\?/i.test(value)) {
        const query = value.slice(value.indexOf('?') + 1);
        const params = new URLSearchParams(query);
        const xt = params.getAll('xt').find(x => /^urn:btih:/i.test(x));
        if (!xt) {
            return { kind: 'invalid' };
        }
        const infoHash = xt.slice('urn:btih:'.length);
        const dn = params.get('dn')?.trim();
        return { kind: 'magnet', uri: value, infoHash, ...(dn ? { name: dn } : {}) };
    }

    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return { kind: 'invalid' };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { kind: 'invalid' };
    }
    if (!url.hostname) {
        return { kind: 'invalid' };
    }
    // The agent refuses credentials in the URL; say so here instead of after Start.
    if (url.username || url.password) {
        return { kind: 'invalid' };
    }

    const scheme = url.protocol === 'https:' ? 'HTTPS' : 'HTTP';
    const name = lastSegment(url.pathname) || 'download';
    const kind = /\.torrent$/i.test(url.pathname) ? 'torrent-url' : 'http';
    return { kind, url: value, host: url.hostname, name, scheme };
}

/** Short form of a magnet for a row title before its metadata arrives: `magnet:?xt=urn:btih:9f2c…a41e`. */
export function shortMagnet(uri: string): string {
    const m = /urn:btih:([a-z0-9]+)/i.exec(uri);
    if (!m) {
        return uri.length > 40 ? `${uri.slice(0, 37)}…` : uri;
    }
    const hash = m[1];
    return `magnet:?xt=urn:btih:${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

export type TorrentFileCheck = { ok: boolean; reason?: 'too-large' | 'not-torrent' };

/** Refuses a `.torrent` in the browser, before anything is sent (B6). */
export function checkTorrentFile(file: { name: string; size: number }): TorrentFileCheck {
    if (!/\.torrent$/i.test(file.name)) {
        return { ok: false, reason: 'not-torrent' };
    }
    if (file.size > FETCH_TORRENT_MAX_BYTES) {
        return { ok: false, reason: 'too-large' };
    }
    return { ok: true };
}

export type AuthForm = { mode: 'none' | 'basic' | 'bearer' | 'header'; username: string; password: string; token: string; headerName: string; headerValue: string };

export const EMPTY_AUTH: AuthForm = { mode: 'none', username: '', password: '', token: '', headerName: '', headerValue: '' };

/**
 * Turns the login fields into the `SourceAuth` the node seals, or explains
 * what is missing. `null` with no error means no login.
 */
export function buildSourceAuth(form: AuthForm): { auth: SourceAuth | null; error?: string } {
    // The node refuses these too (`SourceAuth::problem`); this answers sooner.
    const breaks = (...values: string[]) => values.some(v => /[\r\n\0]/.test(v));
    switch (form.mode) {
        case 'none':
            return { auth: null };
        case 'basic':
            if (!form.username) {
                return { auth: null, error: 'Enter a username.' };
            }
            if (form.username.includes(':')) {
                return { auth: null, error: 'A username cannot contain a colon.' };
            }
            if (breaks(form.username, form.password)) {
                return { auth: null, error: 'A login cannot contain line breaks.' };
            }
            return { auth: { Basic: { username: form.username, password: form.password } } };
        case 'bearer':
            if (!form.token.trim()) {
                return { auth: null, error: 'Enter a token.' };
            }
            if (breaks(form.token)) {
                return { auth: null, error: 'A login cannot contain line breaks.' };
            }
            return { auth: { Bearer: { token: form.token.trim() } } };
        case 'header': {
            const name = form.headerName.trim();
            if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) {
                return { auth: null, error: 'Enter a valid header name.' };
            }
            if (DENIED_AUTH_HEADERS.has(name.toLowerCase())) {
                return { auth: null, error: `${name} cannot be set here.` };
            }
            if (breaks(form.headerValue)) {
                return { auth: null, error: 'A login cannot contain line breaks.' };
            }
            return { auth: { Header: { name, value: form.headerValue } } };
        }
    }
}
