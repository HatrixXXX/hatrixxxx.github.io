import { describe, expect, it, vi } from 'vitest';
import { createLoadingController } from '../../src/scripts/loading-overlay';

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
    vi.advanceTimersByTime(359);
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
    vi.advanceTimersByTime(360);
    controller.start();
    controller.fail();

    expect(hide).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
