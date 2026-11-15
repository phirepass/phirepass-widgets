import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { inShadow, mount, mounted } from './helpers';

const meta: Meta = {
    title: 'Widgets/Remote desktop',
    parameters: {
        docs: {
            description: {
                component: '`<phirepass-rdp>`: a Windows desktop over RDP. The desktop itself needs a real host, so these stories cover what happens before it.',
            },
        },
    },
};
export default meta;

type Story = StoryObj;

export const AsksForCredentials: Story = {
    render: () => mount('phirepass-rdp', { serviceId: 'rdp-1' }, {}, { height: 360 }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        const form = await inShadow<HTMLFormElement>(el, 'form.prompt');
        await userEvent.type(form.querySelector('#rdp-username')!, 'Administrator');
        await userEvent.type(form.querySelector('#rdp-password')!, 'hunter2');
        await userEvent.click(form.querySelector('button[type=submit]')!);
        await waitFor(() => expect(channel().callsTo('open_rdp_tunnel').at(-1)).toEqual([expect.any(String), 'rdp-1', 'Administrator', 'hunter2']));
    },
};

export const Refused: Story = {
    render: () => mount('phirepass-rdp', { serviceId: 'rdp-1', username: 'Administrator', password: 'wrong' }, { rdp: { error: 'The node refused the RDP login.' } }, { height: 360 }).root,
    play: async ({ canvasElement }) => {
        const { el, channel } = mounted(canvasElement);
        await waitFor(() => expect(channel().callsTo('open_rdp_tunnel').length).toBe(1));
        const status = await inShadow(el, '.status');
        expect(status.textContent).toContain('refused');
    },
};
