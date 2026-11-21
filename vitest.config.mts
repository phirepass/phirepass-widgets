import { defineVitestConfig } from '@stencil/vitest/config';
import { stencilVitestPlugin } from '@stencil/vitest/plugin';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineVitestConfig({
    stencilConfig: './stencil.config.ts',
    test: {
        projects: [
            {
                // Unit and component specs, in Stencil's mock DOM.
                plugins: [stencilVitestPlugin()],
                test: {
                    name: 'spec',
                    include: ['src/**/*.spec.{ts,tsx}'],
                    environment: 'stencil',
                },
            },
            {
                // Every story's `play` function, run in a real Chromium against the
                // built widgets (`dist/components`): `bun run test:storybook`.
                plugins: [storybookTest({ configDir: `${dirname}/.storybook`, storybookScript: 'bun run storybook --ci' })],
                test: {
                    name: 'storybook',
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{ browser: 'chromium' }],
                    },
                    setupFiles: ['.storybook/vitest.setup.ts'],
                },
            },
        ],
    },
});
