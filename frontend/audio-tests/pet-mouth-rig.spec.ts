import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type { SpeechActivity, SpeechPlayback } from '../src/audio/model';
import type { CoachMotion, SelectableCoach } from '../src/coach/model';
import type { SpeechMouthShape, SpeechMouthTrack } from '../src/coach/speechMouth';
import { viteFsPath } from '../studio-tests/helpers/viteFsPath';

const root = () => viteFsPath(path.resolve('.'));

async function openArtworkPage(page: Page) {
  // Keep the real Vite module graph without mounting the unrelated studio shell.
  await page.route(url => url.pathname === '/', route => route.fulfill({
    contentType: 'text/html', body: `<!doctype html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="module">
        import { injectIntoGlobalHook } from '/@react-refresh';
        injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
      </script></head><body></body></html>`,
  }));
  await page.goto('/');
}

for (const size of [92.8, 52.5]) {
  test(`pet mouths preserve their faces and distinguish O and oo at ${size}px`, async ({ page }, info) => {
    await openArtworkPage(page);
    const petIds = await page.evaluate(async ({ root, size }) => {
      const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
      const { CoachCharacter } = await import(`${root}/src/coach/CoachAvatar.tsx`);
      const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
      const pets: SelectableCoach[] = selectableCoaches.filter((coach: SelectableCoach) => ['dogs', 'cats'].includes(coach.group!));
      const sheet = document.createElement('section');
      sheet.id = 'pet-mouth-sheet';
      sheet.style.cssText = 'position:absolute;inset:0 auto auto 0;z-index:9999;background:#151718;color:#eee;padding:18px;display:grid;grid-template-columns:repeat(5,116px);gap:12px;font:11px sans-serif';
      const styles = document.createElement('style');
      styles.textContent = `#pet-mouth-sheet .coach-avatar {width:${size}px;height:${size * 1.25}px}`;
      document.head.append(styles);
      document.body.append(sheet);
      const shapes = ['authored', 'rest', 'open', 'round', 'pucker'];
      createRoot(sheet).render(React.createElement(React.Fragment, null,
        ...pets.flatMap(coach => ['neutral', 'blunder'].flatMap(expression => shapes.map(shape =>
          React.createElement('figure', {
            key: `${coach.id}-${expression}-${shape}`, 'data-pet': coach.id,
            'data-expression': expression, 'data-shape': shape,
            style: { margin: 0, display: 'grid', justifyItems: 'center', gap: 4 },
          }, React.createElement(CoachCharacter, {
            coach, reaction: { state: expression, key: expression }, motion: 'still', idle: false,
          }), React.createElement('figcaption', null, `${coach.name} · ${expression} · ${shape}`)),
        ))),
      ));
      return pets.map(coach => coach.id);
    }, { root: root(), size });
    expect(petIds).toHaveLength(7);
    const sheet = page.locator('#pet-mouth-sheet');
    await expect(sheet.locator('.coach-avatar')).toHaveCount(70);
    const geometry = await sheet.evaluate(async (sheet, root) => {
      const { speechMouthPoses } = await import(`${root}/src/coach/speechMouth.ts`);
      return [...sheet.querySelectorAll<HTMLElement>('figure')].map(figure => {
        const avatar = figure.querySelector<HTMLElement>('.coach-avatar')!;
        const shape = figure.dataset.shape!;
        avatar.dataset.speaking = shape === 'authored' ? 'false' : 'true';
        avatar.dataset.articulation = 'aligned';
        avatar.dataset.speechPreview = 'true';
        if (shape !== 'authored') for (const [part, value] of Object.entries(speechMouthPoses[shape])) {
          avatar.style.setProperty(`--speech-${part}`, String(value));
        }
        const authored = avatar.querySelector<SVGGElement>('.speech-mouth-authored')!;
        const live = avatar.querySelector<SVGGElement>('.speech-mouth-live')!;
        const aperture = avatar.querySelector<SVGPathElement>('.organic-speech-opening > .organic-speech-aperture')!;
        const bounds = aperture.getBoundingClientRect();
        const contours = [...avatar.querySelectorAll<SVGPathElement>('.organic-speech-aperture')];
        return {
          pet: figure.dataset.pet!, expression: figure.dataset.expression!, shape,
          width: bounds.width, height: bounds.height, path: getComputedStyle(aperture).d,
          authoredVisibility: (authored.getAnimations().forEach(fade => fade.finish()), getComputedStyle(authored).visibility),
          liveVisibility: (live.getAnimations().forEach(fade => fade.finish()), getComputedStyle(live).visibility),
          authoredMarkup: authored.innerHTML,
          noseMarkup: [...avatar.querySelectorAll('.study-muzzle > path')].map(node => node.outerHTML),
          whiskerMarkup: avatar.querySelector('.study-whiskers')?.innerHTML ?? '',
          teethSubpaths: [...avatar.querySelectorAll('.organic-speech-teeth > path')]
            .map(node => (node.getAttribute('d')?.match(/M/g) ?? []).length),
          contours: contours.map(node => getComputedStyle(node).d),
          animationStates: contours.flatMap(node => node.getAnimations().map(animation => animation.playState)),
          openingOpacity: getComputedStyle(aperture.parentElement!).opacity,
        };
      });
    }, root());
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    await sheet.screenshot({ path: info.outputPath(`pet-mouth-targets-${size}.png`), animations: 'allow' });
    for (const pet of petIds) for (const expression of ['neutral', 'blunder']) {
      const targets = Object.fromEntries(geometry.filter(target => target.pet === pet && target.expression === expression)
        .map(target => [target.shape, target]));
      const description = `${pet}, ${expression}, ${size}px`;
      expect(targets.authored.authoredVisibility, description).toBe('visible');
      expect(targets.authored.liveVisibility, description).toBe('hidden');
      expect(targets.authored.noseMarkup.length, description).toBeGreaterThanOrEqual(2);
      if (pet.startsWith('cat-')) expect(targets.authored.whiskerMarkup, description).not.toBe('');
      expect(targets.authored.teethSubpaths, description).toEqual(pet.startsWith('dog-') ? [2] : []);
      expect(targets.rest.openingOpacity, description).toBe('0');
      for (const shape of ['rest', 'open', 'round', 'pucker']) {
        expect(targets[shape].authoredVisibility, description).toBe('hidden');
        expect(targets[shape].liveVisibility, description).toBe('visible');
        expect(targets[shape].authoredMarkup, description).toBe(targets.authored.authoredMarkup);
        expect(targets[shape].noseMarkup, description).toEqual(targets.authored.noseMarkup);
        expect(targets[shape].whiskerMarkup, description).toBe(targets.authored.whiskerMarkup);
        expect(new Set(targets[shape].contours).size, description).toBe(1);
        expect(targets[shape].animationStates, description).toEqual(['paused', 'paused', 'paused']);
      }
      expect(targets.round.width, description).toBeLessThan(targets.open.width);
      expect(targets.pucker.width, description).toBeLessThan(targets.round.width);
      expect(targets.pucker.height, description).toBeLessThan(targets.round.height);
      expect(targets.pucker.width, description).toBeGreaterThan(.5);
      expect(targets.round.path, description).not.toBe(targets.open.path);
    }
  });
}

type HarnessOptions = { motion: CoachMotion; aligned: boolean };
type PetSpeechHarness = {
  sample: (value: Partial<SpeechActivity> | null) => void;
  update: (patch: Partial<HarnessOptions>) => void;
  remember: () => void;
  preserved: () => boolean;
  reads: () => number;
};
type HarnessWindow = Window & { petSpeech: PetSpeechHarness };

async function mountPetPerformance(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openArtworkPage(page);
  await page.evaluate(async root => {
    const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const { CoachCharacter } = await import(`${root}/src/coach/CoachAvatar.tsx`);
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    // Opt in only these test copies so artwork verification is independent of
    // the separately reviewed rollout of registry speech capabilities.
    const pets: SelectableCoach[] = selectableCoaches.filter((coach: SelectableCoach) => ['dogs', 'cats'].includes(coach.group!))
      .map((coach: SelectableCoach) => ({ ...coach, capabilities: { ...coach.capabilities, speech: true },
        families: coach.families.map(family => ({ ...family, speech: true })) }));
    const track: SpeechMouthTrack = { durationSeconds: 2, cues: [
      { start: 0, end: .5, shape: 'open' }, { start: .5, end: 1, shape: 'round' },
      { start: 1, end: 1.5, shape: 'pucker' }, { start: 1.5, end: 2, shape: 'rest' },
    ] };
    let options: HarnessOptions = { motion: 'natural', aligned: true };
    let value: SpeechActivity | null = { elapsedSeconds: .2, energy: .9, brightness: .35 };
    let reads = 0;
    const feeds = new Map(pets.map(coach => [coach.id, {
      scope: 'pet-rig', eventId: coach.id, utteranceId: coach.id, coachId: coach.id,
      read: () => { reads++; return value; },
    } satisfies SpeechPlayback]));
    const container = document.createElement('section');
    container.id = 'pet-performance';
    container.style.cssText = 'position:fixed;inset:8px auto auto 8px;z-index:9999;display:grid;grid-template-columns:repeat(3,100px);gap:4px;background:#151718;padding:8px';
    const styles = document.createElement('style');
    styles.textContent = '#pet-performance .coach-avatar {width:92.8px;height:116px}';
    document.head.append(styles);
    document.body.append(container);
    const mounted = createRoot(container);
    const render = () => mounted.render(React.createElement(React.Fragment, null, ...pets.map(coach =>
      React.createElement(CoachCharacter, { key: coach.id, coach, reaction: { state: 'neutral', key: 'pet-rig' },
        motion: options.motion, idle: false, speech: feeds.get(coach.id), speechTrack: options.aligned ? track : undefined }),
    )));
    let originals: { avatar: HTMLElement; artwork: Element; authored: Element; markup: string; outside: string[] }[] = [];
    const outside = (avatar: HTMLElement) => [...avatar.querySelectorAll('.study-muzzle > path, .study-whiskers')].map(node => node.outerHTML);
    (window as unknown as HarnessWindow).petSpeech = {
      sample: patch => { value = patch === null ? null : { elapsedSeconds: .2, energy: .9, brightness: .35, ...patch }; },
      update: patch => { options = { ...options, ...patch }; render(); },
      reads: () => reads,
      remember: () => {
        originals = [...container.querySelectorAll<HTMLElement>('.coach-avatar')].map(avatar => ({
          avatar, artwork: avatar.querySelector('svg.coach-artwork')!, authored: avatar.querySelector('.speech-mouth-authored')!,
          markup: avatar.querySelector('.speech-mouth-authored')!.innerHTML, outside: outside(avatar),
        }));
      },
      preserved: () => originals.length === 7 && originals.every(({ avatar, artwork, authored, markup, outside: oldOutside }) =>
        avatar.isConnected && avatar.querySelector('svg.coach-artwork') === artwork && avatar.querySelector('.speech-mouth-authored') === authored
        && authored.innerHTML === markup && JSON.stringify(outside(avatar)) === JSON.stringify(oldOutside)),
    };
    render();
  }, root());
  const portraits = page.locator('#pet-performance .coach-avatar');
  await expect(portraits).toHaveCount(7);
  // Let the initial authored reaction commit before checking syllable identity.
  await page.clock.runFor(2200);
  await page.evaluate(() => (window as unknown as HarnessWindow).petSpeech.remember());
  return portraits;
}

test('all seven pets follow the shared speech clock and restore their authored faces without remounting', async ({ page }) => {
  const portraits = await mountPetPerformance(page);
  for (const [shape, elapsedSeconds] of [['open', .2], ['round', .7], ['pucker', 1.2], ['rest', 1.7]] as [SpeechMouthShape, number][]) {
    await page.evaluate(elapsedSeconds => (window as unknown as HarnessWindow).petSpeech.sample({ elapsedSeconds }), elapsedSeconds);
    await page.clock.runFor(256);
    for (const portrait of await portraits.all()) {
      await expect(portrait).toHaveAttribute('data-speaking', 'true');
      await expect(portrait).toHaveAttribute('data-articulation', 'aligned');
      await expect(portrait).toHaveAttribute('data-mouth-shape', shape);
      await expect(portrait.locator('.speech-mouth-authored')).toBeHidden();
      await expect(portrait.locator('.speech-mouth-live')).toBeVisible();
    }
    expect(await page.evaluate(() => (window as unknown as HarnessWindow).petSpeech.preserved())).toBe(true);
  }
  expect(await portraits.evaluateAll(nodes => nodes.map(node => Number((node as HTMLElement).style.getPropertyValue('--speech-open')))))
    .toEqual(Array(7).fill(0));

  await page.evaluate(() => (window as unknown as HarnessWindow).petSpeech.sample(null));
  await page.clock.runFor(32);
  for (const portrait of await portraits.all()) {
    await expect(portrait).toHaveAttribute('data-speaking', 'false');
    await expect(portrait.locator('.speech-mouth-authored')).toBeVisible();
    await expect(portrait.locator('.speech-mouth-live')).toBeHidden();
  }

  // Recordings without aligned cues still use the existing audio energy feed.
  await page.evaluate(() => {
    (window as unknown as HarnessWindow).petSpeech.update({ aligned: false });
    (window as unknown as HarnessWindow).petSpeech.sample({ energy: .8 });
  });
  await page.clock.runFor(256);
  for (const portrait of await portraits.all()) {
    await expect(portrait).toHaveAttribute('data-speaking', 'true');
    await expect(portrait).not.toHaveAttribute('data-articulation', 'aligned');
    await expect(portrait.locator('.speech-mouth-live')).toBeVisible();
    expect(await portrait.evaluate(node => Number((node as HTMLElement).style.getPropertyValue('--speech-open')))).toBeGreaterThan(.7);
  }

  await page.evaluate(() => (window as unknown as HarnessWindow).petSpeech.update({ motion: 'still' }));
  for (const portrait of await portraits.all()) {
    await expect(portrait).toHaveAttribute('data-motion', 'still');
    await expect(portrait).toHaveAttribute('data-speaking', 'false');
    await expect(portrait.locator('.speech-mouth-authored')).toBeVisible();
  }
  const stoppedReads = await page.evaluate(() => (window as unknown as HarnessWindow).petSpeech.reads());
  await page.clock.runFor(256);
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).petSpeech.reads())).toBe(stoppedReads);
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).petSpeech.preserved())).toBe(true);
  expect(await portraits.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).style.getPropertyValue('--speech-open'))))
    .toEqual(Array(7).fill(''));
});
