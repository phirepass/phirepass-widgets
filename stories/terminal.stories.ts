import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, waitFor } from 'storybook/test';
import { inShadow, mount, mounted } from './helpers';

const BANNER = '\x1b[1;32mWelcome to raspberrypi\x1b[0m (Debian GNU/Linux 13)\r\n\r\npi@raspberrypi:~ $ ';

const meta: Meta = {
    title: 'Widgets/Terminal',
    parameters: { docs: { description: { component: '`<phirepass-terminal>`: an SSH session in xterm.js, over the channel.' } } },
};
export default meta;

type Story = StoryObj;

export const Connected: Story = {
    render: () => mount('phirepass-terminal', { serviceId: 'ssh-1' }, { ssh: { banner: BANNER, echo: true } }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await inShadow(el, '.xterm');
        await waitFor(() => expect(channel().callsTo('authenticate')).toEqual([['story-token', expect.any(String)]]));
        await waitFor(() => expect(channel().callsTo('open_ssh_tunnel').length).toBe(1));
        expect(channel().callsTo('start_heartbeat').length).toBe(1);
    },
};

export const AsksForUsername: Story = {
    render: () => mount('phirepass-terminal', { serviceId: 'ssh-1' }, { ssh: { requires: 'username' } }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await inShadow(el, '.xterm');
        // The terminal asks in-band; nothing is sent until a username is typed.
        await waitFor(() => expect(channel().callsTo('open_ssh_tunnel').length).toBe(1));
        expect(channel().callsTo('send_ssh_tunnel_data')).toEqual([]);
    },
};

export const ConnectionRefused: Story = {
    render: () => mount('phirepass-terminal', { serviceId: 'ssh-1' }, { connect: 'refuse' }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const states: unknown[] = [];
        el.addEventListener('connectionStateChanged', e => states.push((e as CustomEvent).detail[0]));
        await waitFor(() => expect(channel().callsTo('connect').length).toBeGreaterThan(0));
        expect(channel().callsTo('authenticate')).toEqual([]);
    },
};
