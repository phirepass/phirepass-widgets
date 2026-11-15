import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { caps } from '../../src/testing/fixtures';
import { MEDIA_FOLDER, embedded, openDialog, startArgs } from '../fetch-helpers';
import { inShadow, mounted, typeInto } from '../helpers';

const meta: Meta = {
    title: 'Remote Fetch/4 · Every state of the Fetch dialog',
    parameters: { docs: { description: { component: 'Mockup B and its states. The same states apply to the standalone add form.' } } },
};
export default meta;

type Story = StoryObj;

const startButton = (modal: HTMLElement) => Array.from(modal.querySelectorAll('button')).find(b => /Start download|Starting…/.test(b.textContent ?? '')) as HTMLButtonElement;
const link = (modal: HTMLElement) => modal.querySelector<HTMLInputElement>('#fetch-link')!;

function fileOf(name: string, bytes: number): File {
    return new File([new Uint8Array(bytes)], name, { type: 'application/x-bittorrent' });
}

async function chooseFile(modal: HTMLElement, file: File) {
    const input = modal.querySelector<HTMLInputElement>('input[type=file]')!;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** B: the resting state with a link. Save as shows for HTTP only. */
export const B_FetchDialog: Story = {
    name: 'B · Fetch dialog, link',
    render: () => embedded({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const modal = await openDialog(el);
        await waitFor(() => expect(modal.querySelector('.dest')?.textContent).toContain(MEDIA_FOLDER));
        typeInto(link(modal), 'https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_1080p.mp4');
        await waitFor(() => expect(modal.querySelector('.detect')?.textContent).toContain('download.blender.org'));
        expect(modal.querySelector('#fetch-save-as')).toBeTruthy();
        expect((modal.querySelector('#fetch-save-as') as HTMLInputElement).placeholder).toBe('big_buck_bunny_1080p.mp4');
        expect(modal.textContent).not.toContain('How should it download?');
        await waitFor(() => expect(startButton(modal).disabled).toBe(false));
        await userEvent.click(startButton(modal));
        await waitFor(() => expect(startArgs(channel().callsTo('send_download_start'))).toMatchObject({ browsing: { service_id: 'sftp-1', path: MEDIA_FOLDER }, inOrder: true }));
    },
};

/** B2: a .torrent chosen from this computer replaces the link field. */
export const B2_TorrentFileChosen: Story = {
    name: 'B2 · A .torrent file chosen',
    render: () => embedded({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        await chooseFile(modal, fileOf('archlinux-2026.11.01-x86_64.iso.torrent', 48_000));
        const chip = await inShadow(el, '.modal .filechip');
        expect(chip.textContent).toContain('archlinux-2026.11.01-x86_64.iso.torrent');
        expect(chip.textContent).toContain('48 KB · from this computer');
        expect(el.shadowRoot!.querySelector('#fetch-link')).toBeNull();
        await userEvent.click(chip.querySelector('button')!);
        await waitFor(() => expect(el.shadowRoot!.querySelector('#fetch-link')).toBeTruthy());
    },
};

/** B3: from the click until the node's first progress for the job. */
export const B3_Starting: Story = {
    name: 'B3 · Starting',
    render: () => embedded({ jobs: [], onStart: 'hang' }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        typeInto(link(modal), 'https://download.blender.org/demo.mp4');
        await waitFor(() => expect(startButton(modal).disabled).toBe(false));
        await userEvent.click(startButton(modal));
        await waitFor(() => expect(startButton(el.shadowRoot!.querySelector('.modal')!).textContent).toBe('Starting…'));
        expect(startButton(el.shadowRoot!.querySelector('.modal')!).disabled).toBe(true);
    },
};

/** B4: not a link, checked as you type. */
export const B4_NotALink: Story = {
    name: 'B4 · Not a link',
    render: () => embedded({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        await userEvent.type(link(modal), 'ftp://old.example.org/file');
        await waitFor(() => expect(modal.textContent).toContain('Not a link'));
        expect(modal.textContent).toContain('Use http://, https:// or magnet:');
        expect(startButton(modal).disabled).toBe(true);
    },
};

/** B5: a magnet on a node that allows links only. The .torrent picker is hidden too. */
export const B5_TorrentsOff: Story = {
    name: 'B5 · Magnet pasted, torrents are off',
    render: () => embedded({ jobs: [], caps: caps({ torrents: false }) }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        expect(modal.querySelector('.drop')).toBeNull();
        typeInto(link(modal), 'magnet:?xt=urn:btih:9f2c0000000000000000000000000000000da41e');
        await waitFor(() => expect(modal.textContent).toContain('Torrents are off'));
        expect(startButton(modal).disabled).toBe(true);
    },
};

/** B6: a .torrent over 2 MB, refused before anything is sent. */
export const B6_TorrentTooLarge: Story = {
    name: 'B6 · .torrent file too large',
    render: () => embedded({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const modal = await openDialog(el);
        await chooseFile(modal, fileOf('complete-archive.torrent', 3_400_000));
        await waitFor(() => expect(el.shadowRoot!.querySelector('.modal')!.textContent).toContain('Too large'));
        expect(el.shadowRoot!.querySelector('.filechip.bad')).toBeTruthy();
        expect(startButton(el.shadowRoot!.querySelector('.modal')!).disabled).toBe(true);
        expect(channel().callsTo('send_download_start')).toEqual([]);
    },
};

/** B7: the node refused the Start; shown in place while the dialog is open. */
export const B7_NodeRefused: Story = {
    name: 'B7 · The node refused the address',
    render: () => embedded({ jobs: [], onStart: 'refuse', refuseReason: 'This node does not download from private network addresses.' }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        typeInto(link(modal), 'http://192.168.1.10/backup.tar');
        await waitFor(() => expect(startButton(modal).disabled).toBe(false));
        await userEvent.click(startButton(modal));
        await waitFor(() => expect(el.shadowRoot!.querySelector('.modal')?.textContent).toContain('This node does not download from private network addresses.'));
        expect(el.shadowRoot!.querySelector('.modal .note.err b')?.textContent).toBe('Refused');
    },
};

/** B8: the node's agent predates Remote Fetch. */
export const B8_AgentTooOld: Story = {
    name: 'B8 · The node’s agent is too old',
    render: () => embedded({ jobs: [], caps: caps({ agent_supported: false }) }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        await waitFor(() => expect(modal.querySelector('[data-blocker="too-old"]')).toBeTruthy());
        expect(modal.textContent).toContain('runs an agent that cannot download');
        expect(modal.querySelector('#fetch-link')).toBeNull();
    },
};

/** B9: Downloads are off for this node. The Fetch button stays so the feature can be found. */
export const B9_DownloadsOff: Story = {
    name: 'B9 · Downloads are off for this node',
    render: () => embedded({ jobs: [], caps: caps({ http: false, torrents: false }) }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const opened: unknown[] = [];
        el.addEventListener('phirepassOpenNodeSettings', e => opened.push((e as CustomEvent).detail));
        const modal = await openDialog(el);
        await waitFor(() => expect(modal.textContent).toContain('Downloads are turned off for raspberrypi.'));
        expect(modal.textContent).toContain("You can turn them on in the node's settings.");
        await userEvent.click(Array.from(modal.querySelectorAll('button')).find(b => b.textContent === 'Open node settings')!);
        expect(opened.length).toBe(1);
    },
};

/** B9 for someone the node is shared with: no settings button, different advice. */
export const B9_DownloadsOffShared: Story = {
    name: 'B9 · Downloads off, seen through a share',
    render: () => embedded({ jobs: [], caps: caps({ http: false, torrents: false }) }, { props: { canConfigure: false } }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        await waitFor(() => expect(modal.textContent).toContain("Ask the node's owner to turn them on."));
        expect(Array.from(modal.querySelectorAll('button')).some(b => b.textContent === 'Open node settings')).toBe(false);
    },
};

/** L3: the organisation blocks downloads on this node. */
export const L3_Blocked: Story = {
    name: 'L3 · Fetch on a blocked node',
    render: () => embedded({ jobs: [], caps: caps({ lock: 'Organisation' }) }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        await waitFor(() => expect(modal.textContent).toContain('Your organisation does not allow downloads on raspberrypi.'));
        expect(modal.textContent).toContain('Organisation → Downloads');
    },
};

/** L3, no folder: the download folder is missing or not writable. */
export const L3_NoFolder: Story = {
    name: 'L3 · The download folder is missing',
    render: () => embedded({ jobs: [], caps: caps({ lock: 'NoFolder' }) }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        await waitFor(() => expect(modal.textContent).toContain("The download folder on this node is missing or can't be written."));
    },
};

/** Outside the download folder: the dialog says where the file goes before Start. */
export const OutsideDownloadFolder: Story = {
    name: 'A2 · Folder outside the download folder',
    render: () => embedded({ jobs: [], where: () => ({ saves_to: '/home/pi/Downloads', mapped: false }) }, { props: { browsingPath: '/etc' } }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const modal = await openDialog(el);
        await waitFor(() => expect(modal.textContent).toContain("This folder is outside raspberrypi's download folder. The file will be saved to /home/pi/Downloads."));
    },
};

/** U3 in the widget: a link that needs a login, collapsed under “This link needs a login”. */
export const LinkLogin: Story = {
    name: 'U3 · A link that needs a login',
    render: () => embedded({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const modal = await openDialog(el);
        typeInto(link(modal), 'https://git.example.com/releases/firmware-v2.4.bin');
        let toggle: HTMLButtonElement | undefined;
        await waitFor(() => {
            toggle = Array.from(modal.querySelectorAll('button')).find(b => b.textContent?.includes('This link needs a login'));
            expect(toggle).toBeTruthy();
        });
        await userEvent.click(toggle!);
        const auth = await inShadow(el, '.modal .auth');
        await userEvent.click(Array.from(auth.querySelectorAll('label')).find(l => l.textContent === 'Custom header')!.querySelector('input')!);
        let nameInput!: HTMLInputElement;
        let valueInput!: HTMLInputElement;
        await waitFor(() => {
            [nameInput, valueInput] = Array.from(el.shadowRoot!.querySelectorAll<HTMLInputElement>('.modal .auth .inp'));
            expect(valueInput).toBeTruthy();
        });
        typeInto(nameInput, 'Host');
        await waitFor(() => expect(el.shadowRoot!.querySelector('.modal .hint.err')?.textContent).toBe('Host cannot be set here.'));
        expect(startButton(el.shadowRoot!.querySelector('.modal')!).disabled).toBe(true);
        typeInto(nameInput, 'X-Api-Key');
        typeInto(valueInput, 'secret');
        await waitFor(() => expect(startButton(el.shadowRoot!.querySelector('.modal')!).disabled).toBe(false));
        await userEvent.click(startButton(el.shadowRoot!.querySelector('.modal')!));
        await waitFor(() => expect(startArgs(channel().callsTo('send_download_start')).options.source_auth).toEqual({ Header: { name: 'X-Api-Key', value: 'secret' } }));
    },
};
