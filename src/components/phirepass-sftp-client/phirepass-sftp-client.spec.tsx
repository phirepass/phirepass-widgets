import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, h } from '@stencil/vitest';

vi.mock('phirepass-channel', () => {
    return {
        __esModule: true,
        default: vi.fn(),
        ErrorType: {
            Generic: 0,
            Authentication: 10,
            RequiresUsername: 100,
            RequiresPassword: 110,
            RequiresUsernamePassword: 120,
        },
        Channel: vi.fn(function (this: any) {
            this.is_connected = vi.fn(() => false);
            this.connect = vi.fn();
            this.disconnect = vi.fn();
            this.stop_heartbeat = vi.fn();
            this.start_heartbeat = vi.fn();
            this.on_connection_open = vi.fn();
            this.on_connection_close = vi.fn();
            this.on_connection_error = vi.fn();
            this.on_connection_message = vi.fn();
            this.on_protocol_message = vi.fn();
            this.open_sftp_tunnel = vi.fn();
            this.send_sftp_list_data = vi.fn();
            this.send_sftp_mkdir = vi.fn();
            this.send_sftp_rename = vi.fn();
            this.send_sftp_chmod = vi.fn();
            this.send_sftp_remove = vi.fn();
            this.send_sftp_read_file = vi.fn();
            this.send_sftp_write_file = vi.fn();
        }),
    };
});

import './phirepass-sftp-client';
import { ProtocolMessageError, SFTPListItem } from '../../common/protocol';

function entry(
    name: string,
    kind: SFTPListItem['kind'],
    over: Partial<SFTPListItem['attributes']> = {},
    path = '/srv',
): SFTPListItem {
    return {
        name,
        path,
        kind,
        items: [],
        attributes: {
            size: 0,
            uid: 0,
            user: 'root',
            gid: 0,
            group: 'root',
            permissions: 0,
            atime: 0,
            modified: 0,
            ...over,
        },
    };
}

async function mount() {
    const { root, waitForChanges } = await render(
        h('phirepass-sftp-client', { nodeId: 'node-1', serviceId: 'svc-1', token: 't' }),
    );
    return { el: root as any, waitForChanges };
}

describe('phirepass-sftp-client', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders with shadow DOM', async () => {
        const { el } = await mount();
        expect(el.shadowRoot!.querySelector('.listing')).toBeTruthy();
    });

    describe('paths', () => {
        it('does not double the separator at the root', async () => {
            const { el } = await mount();
            expect(el.join_path('/', 'etc')).toBe('/etc');
            expect(el.join_path('', 'etc')).toBe('/etc');
            expect(el.join_path('/srv', 'app')).toBe('/srv/app');
            expect(el.join_path('/srv/', 'app')).toBe('/srv/app');
        });

        it('builds an entry path from its parent directory', async () => {
            const { el } = await mount();
            expect(el.item_path(entry('app.log', 'File', {}, '/var/log'))).toBe('/var/log/app.log');
            expect(el.item_path(entry('etc', 'Folder', {}, '/'))).toBe('/etc');
        });
    });

    describe('name validation', () => {
        it('rejects names the remote or the path grammar would', async () => {
            const { el } = await mount();
            expect(el.invalid_name('')).toBeTruthy();
            expect(el.invalid_name('.')).toBeTruthy();
            expect(el.invalid_name('..')).toBeTruthy();
            expect(el.invalid_name('a/b')).toBeTruthy();
        });

        it('accepts an ordinary name', async () => {
            const { el } = await mount();
            expect(el.invalid_name('deploy.sh')).toBe('');
        });
    });

    describe('listing order', () => {
        it('keeps folders above files whichever way the sort runs', async () => {
            const { el } = await mount();
            el.listing = [entry('zeta.txt', 'File'), entry('alpha', 'Folder')];

            expect(el.visible_listing().map((i: SFTPListItem) => i.name)).toEqual(['alpha', 'zeta.txt']);

            el.sort_asc = false;
            expect(el.visible_listing().map((i: SFTPListItem) => i.name)).toEqual(['alpha', 'zeta.txt']);
        });

        it('sorts by size when asked', async () => {
            const { el } = await mount();
            el.listing = [entry('big', 'File', { size: 900 }), entry('small', 'File', { size: 10 })];

            el.sort_key = 'size';
            expect(el.visible_listing().map((i: SFTPListItem) => i.name)).toEqual(['small', 'big']);

            el.sort_asc = false;
            expect(el.visible_listing().map((i: SFTPListItem) => i.name)).toEqual(['big', 'small']);
        });

        it('filters case-insensitively without touching the listing', async () => {
            const { el } = await mount();
            el.listing = [entry('README.md', 'File'), entry('deploy.sh', 'File')];
            el.filter = 'readme';

            expect(el.visible_listing().map((i: SFTPListItem) => i.name)).toEqual(['README.md']);
            expect(el.listing).toHaveLength(2);
        });
    });

    describe('permissions dialog', () => {
        it('toggles a bit without disturbing the others', async () => {
            const { el } = await mount();
            el.chmod_mode = 0o644;

            el.toggle_chmod_bit(0o100);
            expect(el.chmod_mode).toBe(0o744);

            el.toggle_chmod_bit(0o100);
            expect(el.chmod_mode).toBe(0o644);
        });

        it('takes an octal string and rejects anything else', async () => {
            const { el } = await mount();

            el.on_chmod_octal_input('755');
            expect(el.chmod_mode).toBe(0o755);
            expect(el.chmod_error).toBe('');

            el.on_chmod_octal_input('9');
            expect(el.chmod_mode).toBe(0o755);
            expect(el.chmod_error).toBeTruthy();
        });
    });

    describe('editor decoding', () => {
        it('accepts UTF-8 text', async () => {
            const { el } = await mount();
            const text = 'héllo\n';
            expect(el.decode_text(new TextEncoder().encode(text))).toBe(text);
        });

        it('refuses a file with a null byte rather than mangling it', async () => {
            const { el } = await mount();
            expect(() => el.decode_text(new Uint8Array([0x7f, 0x45, 0x00, 0x4c]))).toThrow(/binary/i);
        });

        it('refuses invalid UTF-8', async () => {
            const { el } = await mount();
            expect(() => el.decode_text(new Uint8Array([0xff, 0xfe, 0x41]))).toThrow(/UTF-8/);
        });
    });

    describe('operation round trip', () => {
        it('resolves when the matching result arrives', async () => {
            const { el } = await mount();
            el.session_id = 7;

            let sent = -1;
            const pending = el.run_op('do the thing', (msgId: number) => {
                sent = msgId;
            });

            el.handle_op_result({ type: 'SFTPOpResult', sid: 7, msg_id: sent, result: { result: 'Done' } });

            await expect(pending).resolves.toEqual({ result: 'Done' });
        });

        it('rejects with the remote message, and leaves the page banner alone', async () => {
            const { el } = await mount();
            el.session_id = 7;

            let sent = -1;
            const pending = el.run_op('delete', (msgId: number) => {
                sent = msgId;
            });

            el.handle_error({
                type: 'Error',
                kind: ProtocolMessageError.Generic,
                message: 'Could not delete: Permission denied',
                msg_id: sent,
            });

            await expect(pending).rejects.toThrow('Permission denied');
            expect(el.show_error).toBe(false);
        });

        it('ignores a result for an operation it is not waiting on', async () => {
            const { el } = await mount();
            el.session_id = 7;

            expect(() =>
                el.handle_op_result({ type: 'SFTPOpResult', sid: 7, msg_id: 4242, result: { result: 'Done' } }),
            ).not.toThrow();
        });

        it('blames an old agent when nothing answers', async () => {
            const { el } = await mount();
            el.session_id = 7;

            // After mount: rendering awaits timers of its own, and faking them
            // beforehand never lets the component finish connecting.
            vi.useFakeTimers();

            const pending = el.run_op('rename', () => undefined, 1_000);
            const assertion = expect(pending).rejects.toThrow(/too old/);

            vi.advanceTimersByTime(1_001);
            await assertion;
        });

        /// The editor used to save to `selected_item`, which the listing refresh
        /// after the first save clears — so the second save went nowhere.
        it('keeps saving to the file it opened after the listing refreshes', async () => {
            const { el } = await mount();
            el.session_id = 7;

            const opened = el.on_edit_action(entry('conf.yaml', 'File', {}, '/etc'), new Event('click'));

            const read = el.channel.send_sftp_read_file.mock.calls[0];
            expect(read[2]).toBe('/etc/conf.yaml');

            el.handle_op_result({
                type: 'SFTPOpResult',
                sid: 7,
                msg_id: read[3],
                result: {
                    result: 'FileContents',
                    path: '/etc/conf.yaml',
                    contents: Array.from(new TextEncoder().encode('a: 1\n')),
                },
            });
            await opened;
            expect(el.editor_text).toBe('a: 1\n');

            // What a refresh does to the selection, without a real listing.
            el.selected_item = null;
            el.editor_text = 'a: 2\n';

            const saving = el.save_editor();
            const write = el.channel.send_sftp_write_file.mock.calls[0];
            expect(write[2]).toBe('/etc/conf.yaml');

            el.handle_op_result({ type: 'SFTPOpResult', sid: 7, msg_id: write[4], result: { result: 'Done' } });
            await saving;

            expect(el.editor_saved_text).toBe('a: 2\n');
        });

        it('leaves the editor read-only when the file will not decode', async () => {
            const { el } = await mount();
            el.session_id = 7;

            const opened = el.on_edit_action(entry('app.bin', 'File', {}, '/opt'), new Event('click'));
            const read = el.channel.send_sftp_read_file.mock.calls[0];

            el.handle_op_result({
                type: 'SFTPOpResult',
                sid: 7,
                msg_id: read[3],
                result: { result: 'FileContents', path: '/opt/app.bin', contents: [0x7f, 0x45, 0x00, 0x4c] },
            });
            await opened;

            expect(el.editor_loaded).toBe(false);
            expect(el.editor_error).toMatch(/binary/i);
        });

        it('refuses to send without a session', async () => {
            const { el } = await mount();
            el.session_id = undefined;

            await expect(el.run_op('rename', () => undefined)).rejects.toThrow(/No active SFTP session/);
        });
    });
});
