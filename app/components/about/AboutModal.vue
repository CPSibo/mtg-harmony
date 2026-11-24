<template>
  <UModal
    :close="{ onClick: () => emit('close', false) }"
    :ui="{
      title: 'flex items-center gap-2',
      body: 'flex flex-col gap-5 text-sm',
    }"
    description="A table helper for Discord, Lord of Disharmony"
  >
    <template #title>
      <UIcon
        name="i-lucide-info"
        class="size-5"
      />
      About MTG Harmony
    </template>

    <template #body>
      <!-- Wizards' Fan Content Policy asks for this wording (#167). -->
      <section
        class="flex flex-col gap-2"
        aria-labelledby="about-fan-content"
      >
        <h3
          id="about-fan-content"
          class="font-semibold"
        >
          Fan content
        </h3>
        <p class="text-muted">
          MTG Harmony is unofficial Fan Content permitted under the
          <a
            :href="FAN_CONTENT_POLICY"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline"
            >Fan Content Policy</a
          >. Not approved/endorsed by Wizards. Portions of the materials used
          are property of Wizards of the Coast. ©Wizards of the Coast LLC.
        </p>
      </section>

      <section
        class="flex flex-col gap-2"
        aria-labelledby="about-credits"
      >
        <h3
          id="about-credits"
          class="font-semibold"
        >
          Credits
        </h3>
        <ul class="flex flex-col gap-1 text-muted">
          <li
            v-for="credit in CREDITS"
            :key="credit.name"
          >
            <a
              :href="credit.href"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary underline"
              >{{ credit.name }}</a
            >
            {{ credit.for }}
          </li>
        </ul>
      </section>

      <section
        class="flex flex-col gap-2"
        aria-labelledby="about-source"
      >
        <h3
          id="about-source"
          class="font-semibold"
        >
          Source and feedback
        </h3>
        <p class="text-muted">
          MTG Harmony is open source. Report a bug or suggest a feature on
          <a
            :href="REPOSITORY"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary underline"
            >GitHub</a
          >.
        </p>
        <!-- Selectable, so it can be copied into a bug report (#168). -->
        <p class="text-muted select-text">Version {{ APP_VERSION }}</p>
      </section>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Nuxt UI's plain-Vue Icon; components/Icon.vue is the Nuxt-only variant.
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import { APP_VERSION } from '~/utils/appVersion';

const emit = defineEmits<{ close: [boolean] }>();

const FAN_CONTENT_POLICY =
  'https://company.wizards.com/en/legal/fancontentpolicy';
const REPOSITORY = 'https://github.com/cpsibo/mtg-harmony';

const CREDITS = [
  {
    name: 'Scryfall',
    href: 'https://scryfall.com',
    for: 'for card data, images and search.',
  },
  {
    name: 'Mana',
    href: 'https://mana.andrewgioia.com',
    for: 'by Andrew Gioia, for mana and ability symbols.',
  },
  {
    name: 'Lucide',
    href: 'https://lucide.dev',
    for: 'for icons.',
  },
];
</script>
