import { afterEach, describe, expect, it } from 'vitest';
import CardText from '~/components/shared/CardText.vue';
import { makeScryfallCard } from '../../fixtures/cards';
import { mountInApp, unmountAll } from '../../fixtures/mount';

describe('CardText (#171)', () => {
  afterEach(unmountAll);

  it('shows the name, type line and power/toughness', () => {
    const wrapper = mountInApp(CardText, {
      props: {
        card: makeScryfallCard({
          name: 'Grizzly Bears',
          type_line: 'Creature — Bear',
          oracle_text: '',
          power: '2',
          toughness: '2',
        }),
      },
    });

    expect(wrapper.text()).toContain('Grizzly Bears');
    expect(wrapper.text()).toContain('Creature — Bear');
    expect(wrapper.text()).toContain('2/2');
  });

  it('gives each line of rules text its own paragraph', () => {
    const wrapper = mountInApp(CardText, {
      props: {
        card: makeScryfallCard({
          oracle_text: 'Flying\n\nWhen this enters, draw a card.',
        }),
      },
    });

    expect(wrapper.findAll('p').map((p) => p.text())).toEqual([
      'Flying',
      'When this enters, draw a card.',
    ]);
  });

  it("shows a multi-face card's front face", () => {
    const wrapper = mountInApp(CardText, {
      props: {
        card: makeScryfallCard({
          name: 'Front // Back',
          type_line: undefined,
          oracle_text: undefined,
          mana_cost: '',
          card_faces: [
            {
              name: 'Front',
              type_line: 'Instant',
              oracle_text: 'Front text.',
              mana_cost: '{U}',
            },
            {
              name: 'Back',
              type_line: 'Sorcery',
              oracle_text: 'Back text.',
              mana_cost: '{R}',
            },
          ],
        }),
      },
    });

    expect(wrapper.text()).toContain('Instant');
    expect(wrapper.text()).toContain('Front text.');
    expect(wrapper.text()).not.toContain('Back text.');
    expect(wrapper.find('.ms-u').exists()).toBe(true);
  });
});
