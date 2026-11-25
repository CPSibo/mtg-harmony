import { useToast } from '@nuxt/ui/composables';
import { ref } from 'vue';
import { fetchCardById } from '~/composables/useScryfall';
import { useBattlefieldStore } from '~/features/battlefield';
import type { BoardCard } from '~/types/PlayArea';
import type { ScryfallCard, ScryfallRelatedCard } from '~/types/Scryfall';

/**
 * Creates a token a card makes (#203): fetches it from Scryfall unless it's
 * already been fetched, and puts it on the board. A failed fetch says so in a
 * toast. `creating` is the ID of the token under way, one at a time.
 */
export function useCreateToken() {
  const battlefield = useBattlefieldStore();
  const toast = useToast();
  const creating = ref<string | null>(null);

  /** Whether the token went on the board. */
  async function create(
    source: BoardCard,
    token: ScryfallRelatedCard,
    fetched?: ScryfallCard,
  ): Promise<boolean> {
    if (creating.value) return false;
    creating.value = token.id;
    try {
      battlefield.createToken(
        source,
        fetched ?? (await fetchCardById(token.id)),
      );
      return true;
    } catch {
      toast.add({
        title: `Could not fetch ${token.name}`,
        description: 'Check your connection and try again.',
        color: 'error',
        icon: 'i-lucide-triangle-alert',
      });
      return false;
    } finally {
      creating.value = null;
    }
  }

  return { create, creating };
}
