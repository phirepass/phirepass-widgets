import { describe, expect, it } from 'vitest';
import { caps } from '../../testing/fixtures';
import { EMPTY_FORM, FormState, buildStart, chooseTorrent, formModel } from './form';

const LINK = 'https://example.com/files/report.pdf';
const MAGNET = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel';
const form = (patch: Partial<FormState>): FormState => ({ ...EMPTY_FORM, ...patch });

describe('formModel', () => {
    it('cannot start an empty form', () => {
        expect(formModel(EMPTY_FORM, caps(), true).canStart).toBe(false);
    });

    it('starts a link straight away, with Save as and a login', () => {
        const m = formModel(form({ text: LINK }), caps(), true);
        expect(m).toMatchObject({ canStart: true, showSaveAs: true, showAuth: true, needsOrder: false, askedName: 'report.pdf' });
    });

    it('waits for the destination before allowing Start', () => {
        expect(formModel(form({ text: LINK }), caps(), false).canStart).toBe(false);
        expect(formModel(form({ text: LINK }), null, true).canStart).toBe(false);
    });

    it('uses the Save as name for the asked name', () => {
        expect(formModel(form({ text: LINK, saveAs: ' mine.pdf ' }), caps(), true).askedName).toBe('mine.pdf');
    });

    it('requires In order or Fastest for a torrent (neither is preselected)', () => {
        const m = formModel(form({ text: MAGNET }), caps(), true);
        expect(m.needsOrder).toBe(true);
        expect(m.canStart).toBe(false);
        expect(formModel(form({ text: MAGNET, order: 'fast' }), caps(), true).canStart).toBe(true);
    });

    it('says what is wrong with a non-link (B4)', () => {
        expect(formModel(form({ text: 'ftp://x/y' }), caps(), true).note).toMatchObject({ tone: 'err', title: 'Not a link' });
    });

    it('warns when the node only allows links (B5)', () => {
        const m = formModel(form({ text: MAGNET, order: 'in' }), caps({ torrents: false }), true);
        expect(m.note).toMatchObject({ tone: 'warn', title: 'Torrents are off' });
        expect(m.needsOrder).toBe(false);
        expect(m.canStart).toBe(false);
    });

    it('refuses a .torrent that is too big (B6)', () => {
        const torrent = chooseTorrent({ name: 'big.torrent', size: 5_000_000 });
        expect(formModel(form({ torrent, order: 'in' }), caps(), true).note?.title).toBe('Too large');
    });

    it('needs the file read before a chosen .torrent can start', () => {
        const torrent = chooseTorrent({ name: 'a.torrent', size: 10 });
        expect(formModel(form({ torrent, order: 'in' }), caps(), true).canStart).toBe(false);
        expect(formModel(form({ torrent: { ...torrent, contents: new Uint8Array(10) }, order: 'in' }), caps(), true).canStart).toBe(true);
    });

    it('blocks Start on a bad login only once the login is open', () => {
        const bad = { ...EMPTY_FORM.auth, mode: 'header' as const, headerName: 'Host' };
        expect(formModel(form({ text: LINK, auth: bad }), caps(), true).canStart).toBe(true);
        const open = formModel(form({ text: LINK, auth: bad, authOpen: true }), caps(), true);
        expect(open.canStart).toBe(false);
        expect(open.authError).toBe('Host cannot be set here.');
    });

    it('does not complain about a login nobody has typed into yet', () => {
        const m = formModel(form({ text: LINK, auth: { ...EMPTY_FORM.auth, mode: 'basic' }, authOpen: true }), caps(), true);
        expect(m.authError).toBeUndefined();
        expect(m.canStart).toBe(false);
    });
});

describe('buildStart', () => {
    it('always downloads a link in order', () => {
        expect(buildStart(form({ text: LINK, saveAs: 'x.pdf' }))).toEqual({
            source: { Http: { url: LINK, save_as: 'x.pdf' } },
            inOrder: true,
            options: { source_auth: null, ignore_window: false },
        });
    });

    it('sends the login only when it is open', () => {
        const auth = { ...EMPTY_FORM.auth, mode: 'bearer' as const, token: 't' };
        expect(buildStart(form({ text: LINK, auth }))!.options.source_auth).toBeNull();
        expect(buildStart(form({ text: LINK, auth, authOpen: true }))!.options.source_auth).toEqual({ Bearer: { token: 't' } });
        expect(buildStart(form({ text: LINK, auth: { ...auth, token: '' }, authOpen: true }))).toBeNull();
    });

    it('keeps the chosen order for a magnet', () => {
        expect(buildStart(form({ text: MAGNET, order: 'fast' }))).toMatchObject({ source: { Magnet: { uri: MAGNET } }, inOrder: false });
    });

    it('sends a read .torrent file', () => {
        const contents = new Uint8Array([1, 2]);
        expect(buildStart(form({ torrent: { name: 'a.torrent', size: 2, contents }, order: 'in' }))).toMatchObject({ source: { TorrentFile: { name: 'a.torrent', contents } }, inOrder: true });
        expect(buildStart(form({ torrent: { name: 'a.torrent', size: 2 } }))).toBeNull();
    });

    it('builds nothing from an invalid form', () => {
        expect(buildStart(form({ text: 'nope' }))).toBeNull();
    });
});
