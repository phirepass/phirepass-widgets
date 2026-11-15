import type { StorybookConfig } from '@storybook/web-components-vite';

/**
 * Stories render the real widgets from Stencil's `dist-custom-elements`
 * output, so run `stencil build` first (the `storybook` scripts do). Each
 * widget talks to a `MockChannel` through its `channelFactory`, never to a
 * server.
 */
const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.ts'],
    addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest'],
    framework: {
        name: '@storybook/web-components-vite',
        options: {},
    },
    staticDirs: [{ from: '../stories/assets', to: '/assets' }],
    core: {
        disableTelemetry: true,
    },
};

export default config;
