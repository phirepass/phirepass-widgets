import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { DOWNLOAD_FOLDER, MEDIA_FOLDER, drawerJobs, job } from '../../src/testing/fixtures';
import { inSftp, rowButton, rowNamed, startArgs } from '../fetch-helpers';
import { allInShadow, clickRowAction, hostedDownloader, inShadow, mounted, shadowText, waitForButton } from '../helpers';

const meta: Meta = {
    title: 'Remote Fetch/1 · Inside the SFTP browser',
    parameters: {
        docs: { description: { component: 'The Fetch button, its dialog and the transfers drawer: `<phirepass-downloader compact>` hosted by `<phirepass-sftp-client>`, sharing its channel.' } },
    },
};
export default meta;

type Story = StoryObj;

/** A: the drawer open under the listing, with a running link, a torrent, metadata, a finished and a retrying job. */
export const A_TransfersDrawerOpen: Story = {
    name: 'A · Transfers drawer open',
    render: () => inSftp({ jobs: drawerJobs(), live: true }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const fetch = await inShadow(el, '.action.fetch');
        await waitFor(() => expect(fetch.querySelector('.badge')?.textContent).toBe('3'));
        const dl = await hostedDownloader(el);
        await userEvent.click(await inShadow(dl, '.strip'));
        await inShadow(dl, '.drawer');
        await shadowText(dl, 'big_buck_bunny_1080p.mp4');
        await shadowText(dl, 'Fetching metadata');
        await shadowText(dl, 'Server answered 403 Forbidden');
        // The part file in the listing is dimmed.
        const part = allInShadow(el, 'tr.part');
        expect(part.length).toBe(1);
    },
};

/** A2: the Fetch dialog over the listing, saving into the folder on screen. */
export const A2_FetchDialog: Story = {
    name: 'A2 · Fetch dialog over the listing',
    render: () => inSftp({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await userEvent.click(await inShadow(el, '.action.fetch'));
        const dl = await hostedDownloader(el);
        const modal = await inShadow(dl, '.modal');
        expect(modal.textContent).toContain('Fetch into this folder');
        await waitFor(() => expect(channel().callsTo('send_download_where').at(-1)?.[1]).toEqual({ service_id: 'sftp-1', path: MEDIA_FOLDER }));
        await waitFor(() => expect(modal.querySelector('.dest')?.textContent).toContain(MEDIA_FOLDER));
        const input = modal.querySelector<HTMLInputElement>('#fetch-link')!;
        await userEvent.type(input, 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel.2010.1080p.mkv');
        await waitFor(() => expect(modal.textContent).toContain('How should it download?'));
        const start = Array.from(modal.querySelectorAll('button')).find(b => b.textContent === 'Start download')!;
        expect(start.disabled).toBe(true);
        await userEvent.click(modal.querySelector<HTMLInputElement>('input[value="in"]')!);
        await waitFor(() => expect(start.disabled).toBe(false));
    },
};

/** A3: the drawer collapsed to one line while you keep browsing. */
export const A3_DrawerCollapsed: Story = {
    name: 'A3 · Drawer collapsed',
    render: () => inSftp({ jobs: drawerJobs() }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const dl = await hostedDownloader(el);
        const strip = await inShadow(dl, '.strip');
        await waitFor(() => expect(strip.textContent).toMatch(/3 active · \d+% · ↓ 14\.2 MB\/s/));
        expect(dl.shadowRoot!.querySelector('.drawer')).toBeNull();
    },
};

/** C: right-click a `.torrent` that lies inside the download folder. */
export const C_TorrentContextMenu: Story = {
    name: 'C · Right-click a .torrent on the node',
    render: () => inSftp({ jobs: [] }, { cwd: DOWNLOAD_FOLDER }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await shadowText(el, 'archlinux-2026.11.01-x86_64.iso.torrent');
        const dl = await hostedDownloader(el);
        await waitFor(() => expect(channel().callsTo('send_download_subscribe').length).toBe(1));
        await waitFor(async () => expect(await (dl as any).torrentPathFor(`${DOWNLOAD_FOLDER}/x.torrent`)).toBe('x.torrent'));
        const row = allInShadow(el, 'tbody tr').find(r => r.textContent?.includes('.torrent'))!;
        row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 120, clientY: 160 }));
        const menu = await inShadow(el, '.context-menu');
        expect(menu.textContent).toContain('Download torrent contents here');
        await userEvent.click(await waitForButton(el, /Download torrent contents here/));
        await waitFor(() => expect(startArgs(channel().callsTo('send_download_start')).source).toEqual({ TorrentPath: { path: 'archlinux-2026.11.01-x86_64.iso.torrent' } }));
    },
};

/** D: a download finishes into the folder on screen: notice, refresh, and the file marked new. */
export const D_FinishedWhileElsewhere: Story = {
    name: 'D · Download complete',
    render: () => inSftp({ jobs: [job({ name: 'home-assistant-backup.tar', dest_root: MEDIA_FOLDER, state: 'Downloading', done_bytes: 800_000_000, total_bytes: 812_000_000, down_bps: 20_000_000 })], live: true }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const dl = await hostedDownloader(el);
        const toast = await inShadow(dl, '[data-notice="completed"]', 5000);
        expect(toast.textContent).toContain('Download complete');
        expect(toast.textContent).toContain(`home-assistant-backup.tar → ${MEDIA_FOLDER}`);
        await waitFor(() => expect(allInShadow(el, 'tr.fresh').map(r => r.textContent)).toEqual([expect.stringContaining('home-assistant-backup.tar')]));
    },
};

/** K3: deleting a `.phirepass-part` that belongs to a running download deletes the download, not just the file. */
export const K3_DeletePartFile: Story = {
    name: 'K3 · Deleting a file that is still downloading',
    render: () => inSftp({ jobs: drawerJobs() }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const dl = await hostedDownloader(el);
        await inShadow(dl, '.strip');
        await clickRowAction(el, 'Delete big_buck_bunny_1080p.mp4.phirepass-part');
        const dialog = await inShadow(el, '[aria-label="This file is still downloading"]');
        expect(dialog.textContent).toContain('deletes its download');
        await userEvent.click(await waitForButton(el, 'Delete download'));
        await waitFor(() => expect(channel().callsTo('send_download_delete').length).toBe(1));
        expect(channel().callsTo('send_sftp_remove')).toEqual([]);
    },
};

/** X1: the drawer the first time Fetch is used. */
export const X1_EmptyDrawer: Story = {
    name: 'X1 · Drawer with nothing in it',
    render: () => inSftp({ jobs: [] }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await userEvent.click(await inShadow(el, '.action.fetch'));
        const dl = await hostedDownloader(el);
        await userEvent.click(await waitForButton(dl, 'Cancel'));
        await shadowText(dl, 'No downloads yet');
    },
};

/** Play on a media file in the listing that is not a download (SFTPOp::OpenStream). */
export const ListingPlay: Story = {
    name: 'G · Play a file from the listing',
    render: () => inSftp({ jobs: [] }, { streams: true }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await clickRowAction(el, 'Play holiday-2025.mp4');
        await waitFor(() => expect(channel().callsTo('send_sftp_open_stream')[0][2]).toBe(`${MEDIA_FOLDER}/holiday-2025.mp4`));
        const player = await inShadow(el, 'phirepass-media-player');
        expect(player.getAttribute('src') ?? (player as any).src).toMatch(/\/api\/web\/stream\/.+\/t\/tok-mock$/);
    },
};

/** Rows of a running download keep their own Play. */
export const RowPlay: Story = {
    name: 'G · Play while downloading, from the drawer',
    render: () => inSftp({ jobs: drawerJobs() }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const dl = await hostedDownloader(el);
        await userEvent.click(await inShadow(dl, '.strip'));
        const row = await rowNamed(dl, 'big_buck_bunny_1080p.mp4');
        await userEvent.click(rowButton(row, 'Play while downloading'));
        const player = await inShadow(dl, 'phirepass-media-player');
        expect((player as any).src).toMatch(/\/api\/web\/stream\/[^/]+\/[^/]+\/0$/);
    },
};
