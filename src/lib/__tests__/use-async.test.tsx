/**
 * `useAsync` keeps its data fresh by itself: a quiet re-read every few seconds while the app is visible, so a
 * screen shows what other people did without anyone reloading the page. These pin the rules that make that
 * safe — it never flashes a loading state, never turns one failed attempt into an error banner, and does not
 * poll at all when switched off or while the app is in the background.
 */
import { act, render, screen } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import { AUTO_REFRESH_MS, useAsync } from '../use-async';

function Probe({ fn, refreshMs }: { fn: () => Promise<number>; refreshMs?: number | false }) {
  const state = useAsync(fn, [], true, refreshMs);
  return <Text testID="out">{`${state.data ?? 'none'}|${state.loading ? 'loading' : 'idle'}|${state.error ? 'error' : 'ok'}`}</Text>;
}

const out = (): string => String(screen.getByTestId('out').props.children);

/** Lets the pending promise callbacks run inside act() so React applies their state updates. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAsync auto-refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the first result, then picks up a change by itself without ever showing "loading"', async () => {
    let value = 1;
    await render(<Probe fn={() => Promise.resolve(value)} />);
    await flush();
    expect(out()).toBe('1|idle|ok');

    value = 2; // something changed on the server
    await act(async () => {
      jest.advanceTimersByTime(AUTO_REFRESH_MS);
    });
    await flush();
    expect(out()).toBe('2|idle|ok');
  });

  it('keeps the last good data and shows no error when one quiet refresh fails', async () => {
    let fail = false;
    await render(<Probe fn={() => (fail ? Promise.reject(new Error('offline')) : Promise.resolve(7))} />);
    await flush();
    expect(out()).toBe('7|idle|ok');

    fail = true;
    await act(async () => {
      jest.advanceTimersByTime(AUTO_REFRESH_MS);
    });
    await flush();
    expect(out()).toBe('7|idle|ok');
  });

  it('does not poll when switched off', async () => {
    const fn = jest.fn(() => Promise.resolve(1));
    await render(<Probe fn={fn} refreshMs={false} />);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(AUTO_REFRESH_MS * 5);
    });
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('polls again on every interval while visible', async () => {
    const fn = jest.fn(() => Promise.resolve(1));
    await render(<Probe fn={fn} />);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    // one interval at a time, letting each answer come back before the next tick
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        jest.advanceTimersByTime(AUTO_REFRESH_MS);
      });
      await flush();
    }
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('never starts a read while the previous one is still out', async () => {
    // The first read (the loud one) answers; every quiet one hangs, like a slow network.
    let calls = 0;
    const fn = jest.fn(() => {
      calls += 1;
      return calls === 1 ? Promise.resolve(1) : new Promise<number>(() => undefined);
    });
    await render(<Probe fn={fn} />);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(AUTO_REFRESH_MS * 10);
    });
    await flush();
    // one quiet read started at the first tick; the other nine ticks found it still in flight and waited
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops while the app is in the background', async () => {
    let onChange: ((state: 'active' | 'background') => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      onChange = handler as (state: 'active' | 'background') => void;
      return { remove: jest.fn() };
    });
    const fn = jest.fn(() => Promise.resolve(1));
    await render(<Probe fn={fn} />);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      onChange?.('background');
    });
    await act(async () => {
      jest.advanceTimersByTime(AUTO_REFRESH_MS * 3);
    });
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    // back to the foreground: it reads again straight away, not only at the next tick
    await act(async () => {
      onChange?.('active');
    });
    await flush();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
