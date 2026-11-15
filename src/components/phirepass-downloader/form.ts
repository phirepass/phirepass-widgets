import type { FetchCaps, FetchOptions, FetchSource } from '../../common/fetch';
import { AuthForm, DetectedSource, EMPTY_AUTH, buildSourceAuth, checkTorrentFile, detectSource } from './source';

export type ChosenTorrent = { name: string; size: number; contents?: Uint8Array; error?: 'too-large' | 'not-torrent' };

export type FormState = {
    text: string;
    saveAs: string;
    torrent: ChosenTorrent | null;
    /** For a torrent: nothing until the person picks (plan: neither is preselected). */
    order: 'in' | 'fast' | null;
    auth: AuthForm;
    authOpen: boolean;
};

export const EMPTY_FORM: FormState = { text: '', saveAs: '', torrent: null, order: null, auth: EMPTY_AUTH, authOpen: false };

export type Note = { tone: 'err' | 'warn' | 'info'; title: string; body: string };

export type FormModel = {
    detected: DetectedSource;
    isTorrent: boolean;
    /** True when the In order / Fastest choice is shown (and required). */
    needsOrder: boolean;
    showSaveAs: boolean;
    showAuth: boolean;
    note: Note | null;
    canStart: boolean;
    /** The name the person expects, for “Saved under another name”. */
    askedName?: string;
    /** What is wrong with the link login, once something has been typed into it. */
    authError?: string;
};

export function chooseTorrent(file: { name: string; size: number }): ChosenTorrent {
    const check = checkTorrentFile(file);
    return check.ok ? { name: file.name, size: file.size } : { name: file.name, size: file.size, error: check.reason };
}

/**
 * Everything the Fetch dialog shows that follows from what was typed or
 * chosen: which fields appear, which note (B4–B7), and whether Start works.
 * `ready` is false while the dialog still waits on something outside the form
 * (where the file will land, or the Start already in flight).
 */
export function formModel(form: FormState, caps: FetchCaps | null, ready: boolean): FormModel {
    const detected: DetectedSource = form.torrent ? { kind: 'empty' } : detectSource(form.text);
    const isTorrent = !!form.torrent || detected.kind === 'magnet';
    const torrentsOff = isTorrent && !!caps && !caps.torrents;
    const isHttp = detected.kind === 'http' || detected.kind === 'torrent-url';

    let note: Note | null = null;
    if (form.torrent?.error === 'too-large') {
        note = { tone: 'err', title: 'Too large', body: 'A .torrent file can be up to 2 MB. Use its magnet link instead.' };
    } else if (form.torrent?.error === 'not-torrent') {
        note = { tone: 'err', title: 'Not a .torrent', body: 'Choose a file that ends in .torrent.' };
    } else if (detected.kind === 'invalid') {
        note = { tone: 'err', title: 'Not a link', body: 'Use http://, https:// or magnet:' };
    } else if (torrentsOff) {
        note = { tone: 'warn', title: 'Torrents are off', body: "This node only allows ordinary links. Its owner can allow torrents in the node's settings." };
    }

    const auth = buildSourceAuth(form.auth);
    const hasSource = isHttp || detected.kind === 'magnet' || (!!form.torrent && !form.torrent.error && !!form.torrent.contents);
    const needsOrder = isTorrent && !torrentsOff;
    const canStart = ready && !!caps && hasSource && !note && (!needsOrder || form.order !== null) && (!isHttp || !form.authOpen || !auth.error);

    let askedName: string | undefined;
    if (isHttp) {
        askedName = form.saveAs.trim() || (detected as { name: string }).name;
    } else if (detected.kind === 'magnet') {
        askedName = detected.name;
    }

    const typed = form.auth.username || form.auth.token || form.auth.headerName || form.auth.headerValue;
    const authError = isHttp && form.authOpen && typed ? auth.error : undefined;

    return { detected, isTorrent, needsOrder, showSaveAs: detected.kind === 'http', showAuth: isHttp, note, canStart, askedName, authError };
}

/** The `FetchSource`, order and options a valid form starts. */
export function buildStart(form: FormState): { source: FetchSource; inOrder: boolean; options: FetchOptions } | null {
    const options: FetchOptions = { source_auth: null, ignore_window: false };
    if (form.torrent) {
        if (!form.torrent.contents || form.torrent.error) {
            return null;
        }
        return { source: { TorrentFile: { name: form.torrent.name, contents: form.torrent.contents } }, inOrder: form.order === 'in', options };
    }
    const detected = detectSource(form.text);
    if (detected.kind === 'magnet') {
        return { source: { Magnet: { uri: detected.uri } }, inOrder: form.order === 'in', options };
    }
    if (detected.kind === 'http' || detected.kind === 'torrent-url') {
        const auth = form.authOpen ? buildSourceAuth(form.auth) : { auth: null };
        if ('error' in auth && auth.error) {
            return null;
        }
        const saveAs = form.saveAs.trim();
        // A link always downloads front to back.
        return { source: { Http: { url: detected.url, save_as: saveAs || null } }, inOrder: true, options: { ...options, source_auth: auth.auth } };
    }
    return null;
}
