import { openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAppStorage, showStartupFailure } from '~/startupRecovery';

afterEach(() => {
  document.body.innerHTML = '';
});

// #154: a save the app couldn't read used to leave a blank page.
describe('startup recovery', () => {
  it('shows what went wrong and a way out instead of a blank page', () => {
    showStartupFailure(new Error('stack.primary is undefined'));

    const panel = document.querySelector('[role="alertdialog"]')!;
    expect(panel.textContent).toContain("couldn't start");
    expect(panel.textContent).toContain('stack.primary is undefined');
    const buttons = [...panel.querySelectorAll('button')].map(
      (b) => b.textContent,
    );
    expect(buttons).toEqual(['Reload', 'Reset app data']);
  });

  it('shows the panel once, however many errors follow', () => {
    showStartupFailure(new Error('one'));
    showStartupFailure(new Error('two'));

    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
  });

  it("clears the app's saved data and archive, and nothing else", async () => {
    localStorage.setItem('mtg-harmony_battlefield', 'x');
    localStorage.setItem('mtg-harmony_settings', 'x');
    localStorage.setItem('another-app', 'keep');
    (
      await openDB('mtg-harmony', 1, {
        upgrade: (db) => void db.createObjectStore('games'),
      })
    ).close();

    await resetAppStorage();

    expect(localStorage.getItem('mtg-harmony_battlefield')).toBeNull();
    expect(localStorage.getItem('mtg-harmony_settings')).toBeNull();
    expect(localStorage.getItem('another-app')).toBe('keep');
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(
      'mtg-harmony',
    );
  });

  it('resets and reloads from the panel', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...location, reload });
    localStorage.setItem('mtg-harmony_battlefield', 'x');
    showStartupFailure(new Error('bad save'));

    const reset = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Reset app data',
    )!;
    reset.click();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(localStorage.getItem('mtg-harmony_battlefield')).toBeNull();
  });
});
