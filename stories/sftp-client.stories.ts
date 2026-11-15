import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { MEDIA_FOLDER, entry, mediaListing } from '../src/testing/fixtures';
import { allInShadow, clickRowAction, inShadow, mount, mounted, shadowText, waitForButton } from './helpers';

const meta: Meta = {
    title: 'Widgets/SFTP client',
    parameters: { docs: { description: { component: '`<phirepass-sftp-client>`: browse, edit, upload and download files on a node over SFTP.' } } },
};
export default meta;

type Story = StoryObj;

const sftp = (extra: Record<string, unknown> = {}) => ({ sftp: { cwd: MEDIA_FOLDER, tree: mediaListing() }, ...extra });

export const Listing: Story = {
    render: () => mount('phirepass-sftp-client', { serviceId: 'sftp-1' }, sftp()).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await inShadow(el, '.content table tbody tr');
        await shadowText(el, 'home-assistant-backup.tar');
        // A channel without Remote Fetch shows no Fetch button and no drawer.
        expect(el.shadowRoot!.querySelector('.action.fetch')).toBeNull();
        expect(el.shadowRoot!.querySelector('phirepass-downloader')).toBeNull();
    },
};

export const EmptyFolder: Story = {
    render: () => mount('phirepass-sftp-client', { serviceId: 'sftp-1' }, { sftp: { cwd: '/srv/empty', tree: { '/srv/empty': [] } } }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await shadowText(el, 'This directory is empty.');
    },
};

export const Filtered: Story = {
    render: () => mount('phirepass-sftp-client', { serviceId: 'sftp-1' }, sftp()).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const filter = await inShadow<HTMLInputElement>(el, 'input.filter');
        await shadowText(el, 'notes.txt');
        await userEvent.type(filter, 'zzz');
        await shadowText(el, 'Nothing here matches "zzz".');
    },
};

export const AsksForCredentials: Story = {
    render: () => mount('phirepass-sftp-client', { serviceId: 'sftp-1' }, { sftp: { cwd: MEDIA_FOLDER, tree: mediaListing(), requires: 'both' } }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const form = await inShadow<HTMLFormElement>(el, '.creds form');
        expect(form.querySelector('#username')).toBeTruthy();
        expect(form.querySelector('#password')).toBeTruthy();
        await userEvent.type(form.querySelector('#username')!, 'pi');
        await userEvent.type(form.querySelector('#password')!, 'raspberry');
        await userEvent.click(form.querySelector('button[type=submit]')!);
        await waitFor(() => expect(channel().callsTo('open_sftp_tunnel').at(-1)).toEqual([expect.any(String), 'sftp-1', 'pi', 'raspberry']));
    },
};

export const SessionExpired: Story = {
    render: () => mount('phirepass-sftp-client', { serviceId: 'sftp-1' }, { ...sftp(), auth: 'fail' }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        const banner = await inShadow(el, '.error');
        expect(banner.textContent).toContain('Your session has expired.');
    },
};

export const NewFolderDialog: Story = {
    render: () => mount('phirepass-sftp-client', { serviceId: 'sftp-1' }, sftp()).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await shadowText(el, 'notes.txt');
        await userEvent.click(await waitForButton(el, 'New folder'));
        const input = await inShadow<HTMLInputElement>(el, '.prompt-dialog input');
        await userEvent.type(input, 'Movies');
        await userEvent.click(await waitForButton(el, 'Create'));
        await waitFor(() => expect(channel().callsTo('send_sftp_mkdir')[0][2]).toBe(`${MEDIA_FOLDER}/Movies`));
    },
};

export const DeleteDialog: Story = {
    render: () => mount('phirepass-sftp-client', { serviceId: 'sftp-1' }, sftp()).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await shadowText(el, 'notes.txt');
        await clickRowAction(el, 'Delete notes.txt');
        const dialog = await inShadow(el, '.delete-dialog');
        expect(dialog.textContent).toContain('Are you sure you want to delete this file?');
    },
};

export const Editor: Story = {
    render: () => mount('phirepass-sftp-client', { serviceId: 'sftp-1' }, { sftp: { cwd: '/etc/app', tree: { '/etc/app': [entry('config.yaml', 'File', { size: 120 }, '/etc/app')] } } }).root,
    play: async ({ canvasElement }) => {
        const { el } = mounted(canvasElement);
        await shadowText(el, 'config.yaml');
        await clickRowAction(el, 'Edit config.yaml');
        const area = await inShadow<HTMLTextAreaElement>(el, '.editor-text');
        await waitFor(() => expect(area.value).toContain('listen: 0.0.0.0:8080'));
        await userEvent.type(area, '# edited');
        await waitFor(() => expect(allInShadow(el, '.editor-dialog .title')[0].textContent).toContain('*'));
    },
};
