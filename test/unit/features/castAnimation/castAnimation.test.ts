import { describe, expect, it } from 'vitest';
import {
  CAST_FLIGHTS,
  flightKeyframes,
  graveyardKeyframes,
  isCastDuration,
  isCastFlight,
  isCastLanding,
  sparkleAngles,
} from '~/features/castAnimation';
import { useSettingsStore } from '~/stores/settings';

const from = { x: 0, y: 0, width: 100, height: 140 };
const to = { x: 300, y: 200, width: 200, height: 280 };

describe('flightKeyframes', () => {
  for (const flight of CAST_FLIGHTS.filter((f) => f !== 'off')) {
    it(`${flight} starts in place and ends on the target`, () => {
      const frames = flightKeyframes(flight, from, to);
      const first = String(frames[0]!.transform);
      const last = String(frames.at(-1)!.transform);
      expect(first).toContain('translate(0px, 0px)');
      expect(first).toContain('scale(1, 1)');
      expect(last).toContain('translate(300px, 200px)');
      expect(last).toContain('scale(2, 2)');
    });
  }

  it('leans the other way when flying left', () => {
    const right = flightKeyframes('tilt', from, to);
    const left = flightKeyframes('tilt', to, from);
    expect(String(right[2]!.transform)).toContain('rotate(16deg)');
    expect(String(left[2]!.transform)).toContain('rotate(-16deg)');
  });
});

// #175
describe('graveyardKeyframes', () => {
  it('starts in place and ends shrunk, faded and centred on the target', () => {
    const corner = { x: 980, y: 740, width: 20, height: 28 };
    const frames = graveyardKeyframes(from, corner);
    const first = frames[0]!;
    const last = frames.at(-1)!;

    expect(String(first.transform)).toContain('translate(0px, 0px)');
    expect(first.opacity).toBe(1);
    // The flyer's centre (50, 70) ends on the corner's centre (990, 754).
    expect(String(last.transform)).toContain('translate(940px, 684px)');
    expect(String(last.transform)).toContain('scale(0.2)');
    expect(last.opacity).toBe(0);
  });
});

describe('sparkleAngles', () => {
  it('spreads evenly round the circle', () => {
    expect(sparkleAngles(4)).toEqual([0, Math.PI / 2, Math.PI, Math.PI * 1.5]);
  });
});

describe('cast animation settings', () => {
  it('validates values', () => {
    expect(isCastFlight('arc')).toBe(true);
    expect(isCastFlight('zoom')).toBe(false);
    expect(isCastLanding('ring')).toBe(true);
    expect(isCastLanding(3)).toBe(false);
    expect(isCastDuration(450)).toBe(true);
    expect(isCastDuration(50)).toBe(false);
  });

  it('loads saved choices and ignores bad ones', () => {
    localStorage.setItem(
      'mtg-harmony_settings',
      JSON.stringify([
        {
          castFlight: 1,
          castLanding: 2,
          castDuration: 3,
          attachFlareEnabled: 4,
        },
        'arc',
        'nonsense',
        800,
        false,
      ]),
    );
    const settings = useSettingsStore();
    expect(settings.castFlight).toBe('arc');
    expect(settings.castLanding).toBe('sparkleRing');
    expect(settings.castDuration).toBe(800);
    expect(settings.attachFlareEnabled).toBe(false);
  });
});
