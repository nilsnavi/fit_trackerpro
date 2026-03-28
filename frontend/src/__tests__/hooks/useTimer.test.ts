import { renderHook, act } from '@testing-library/react';
import { useTimer } from '../../shared/hooks/useTimer';

/**
 * useTimer drives the clock via requestAnimationFrame. Queue callbacks and flush
 * with synthetic timestamps so tests do not depend on a real display refresh loop.
 */
describe('useTimer Hook', () => {
    const pending = new Map<number, FrameRequestCallback>();
    let nextRafId = 0;

    beforeEach(() => {
        pending.clear();
        nextRafId = 0;
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            const id = ++nextRafId;
            pending.set(id, cb);
            return id;
        });
        jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
            pending.delete(id);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function flushAllAtTimestamp(timestamp: number) {
        let guard = 0;
        while (pending.size > 0 && guard++ < 200) {
            const callbacks = [...pending.values()];
            pending.clear();
            act(() => {
                callbacks.forEach((cb) => cb(timestamp));
            });
        }
    }

    function advanceSimulatedMs(ms: number, step = 100) {
        for (let t = step; t <= ms; t += step) {
            flushAllAtTimestamp(t);
        }
    }

    it('should initialize with default values', () => {
        const { result } = renderHook(() => useTimer({ initialDuration: 60 }));

        expect(result.current.timeLeft).toBe(60);
        expect(result.current.state).toBe('idle');
    });

    it('should start timer', () => {
        const { result } = renderHook(() => useTimer({ initialDuration: 60 }));

        act(() => {
            result.current.start();
        });

        expect(result.current.state).toBe('running');
    });

    it('should decrement time when running', () => {
        const { result } = renderHook(() => useTimer({ initialDuration: 60 }));

        act(() => {
            result.current.start();
        });

        advanceSimulatedMs(1100);

        expect(result.current.timeLeft).toBeLessThan(60);
    });

    it('should pause timer', () => {
        const { result } = renderHook(() => useTimer({ initialDuration: 60 }));

        act(() => {
            result.current.start();
        });

        advanceSimulatedMs(500);
        const leftAfterRun = result.current.timeLeft;

        act(() => {
            result.current.pause();
        });

        expect(result.current.state).toBe('paused');

        advanceSimulatedMs(2000);

        expect(result.current.timeLeft).toBe(leftAfterRun);
    });

    it('should reset timer', () => {
        const { result } = renderHook(() => useTimer({ initialDuration: 60 }));

        act(() => {
            result.current.start();
        });

        advanceSimulatedMs(2000);

        act(() => {
            result.current.reset();
        });

        expect(result.current.timeLeft).toBe(60);
        expect(result.current.state).toBe('idle');
    });

    it('should call onComplete when timer reaches zero', () => {
        const onComplete = jest.fn();
        const { result } = renderHook(() =>
            useTimer({
                initialDuration: 3,
                onComplete,
            })
        );

        act(() => {
            result.current.start();
        });

        advanceSimulatedMs(5000);

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(result.current.timeLeft).toBe(0);
        expect(result.current.state).toBe('completed');
    });
});
