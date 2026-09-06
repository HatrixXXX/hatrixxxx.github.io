import { describe, expect, it, vi } from 'vitest';
import { createLoadingController, MINIMUM_VISIBLE_DURATION } from '../../src/scripts/loading-overlay';

describe('loading overlay controller', () => {
  it('does not show when loading finishes within the delay', () => {
    vi.useFakeTimers();
    const show = vi.fn();
    const hide = vi.fn();
    const controller = createLoadingController({ show, hide });

    controller.start();
    vi.advanceTimersByTime(119);
    controller.finish();
    vi.advanceTimersByTime(500);

    expect(show).not.toHaveBeenCalled();
    expect(hide).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('shows after the delay and stays visible for the minimum duration', () => {
    vi.useFakeTimers();
    const show = vi.fn();
    const hide = vi.fn();
    const controller = createLoadingController({ show, hide });

    controller.start();
    vi.advanceTimersByTime(120);
    expect(show).toHaveBeenCalledTimes(1);
    controller.finish();
    vi.advanceTimersByTime(MINIMUM_VISIBLE_DURATION - 1);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(hide).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('cleans up both successful and failed loads', () => {
    vi.useFakeTimers();
    const show = vi.fn();
    const hide = vi.fn();
    const controller = createLoadingController({ show, hide });

    controller.start();
    vi.advanceTimersByTime(120);
    controller.fail();
    vi.advanceTimersByTime(MINIMUM_VISIBLE_DURATION);
    controller.start();
    controller.fail();

    expect(hide).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('finishes idempotently and emits the collapse phase once', () => {
    vi.useFakeTimers();
    const finishAnimation = vi.fn();
    const hide = vi.fn();
    const controller = createLoadingController({ finishAnimation, hide });

    controller.start();
    vi.advanceTimersByTime(120);
    controller.finish();
    controller.finish();

    expect(finishAnimation).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MINIMUM_VISIBLE_DURATION);
    expect(hide).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('re-enters loading immediately when navigation starts during finishing', () => {
    vi.useFakeTimers();
    const show = vi.fn();
    const finishAnimation = vi.fn();
    const hide = vi.fn();
    const controller = createLoadingController({ show, finishAnimation, hide });

    controller.start();
    vi.advanceTimersByTime(120);
    controller.finish();
    vi.advanceTimersByTime(100);
    controller.start();

    expect(show).toHaveBeenCalledTimes(2);
    controller.finish();
    vi.advanceTimersByTime(MINIMUM_VISIBLE_DURATION - 1);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(hide).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('can force immediate loading for homepage navigation tests', () => {
    vi.useFakeTimers();
    const show = vi.fn();
    const controller = createLoadingController({ show });

    controller.start(true);

    expect(show).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('wires after-swap and initial load completion events', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('../../src/scripts/loading-overlay.ts', import.meta.url), 'utf8')
    );

    expect(source).toContain("'astro:after-swap'");
    expect(source).toContain("window.addEventListener('load'");
    expect(source).toContain("signal?.addEventListener('abort'");
  });
});
