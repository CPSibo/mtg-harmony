import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import AboutModal from '~/components/about/AboutModal.vue';
import { APP_VERSION } from '~/utils/appVersion';
import { mountInApp, unmountAll } from '../../fixtures/mount';

describe('AboutModal', () => {
  afterEach(unmountAll);

  it("shows the build's version, for bug reports (#168)", async () => {
    mountInApp(AboutModal, { props: { open: true } });
    await flushPromises();

    expect(document.body.textContent).toContain(APP_VERSION);
  });
});
