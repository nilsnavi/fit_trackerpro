import { renderHook, act } from '@testing-library/react';
import { useTimer } from '../../hooks/useTimer';

// Мок таймеров
jest.useFakeTimers();

describe('useTimer Hook', () => {
    beforeEach(() => {
        jest.clearAllTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it('should initialize with default values', () => {
        const { result } = renderHook(() => useTimer({ initialTime: 60 }));

        expect(result.current.time).toBe(60);
        expect(result.current.isRunning).toBe(false);
        expect(result.current.isPaused).toBe(false);
    });

    it('should start timer', () => {
        const { result } = renderHook(() => useTimer({ initialTime: 60 }));

        act(() => {
            result.current.start();
        });

        expect(result.current.isRunning).toBe(true);
        expect(result.current.isPaused).toBe(false);
    });

    it('should decrement time when running', () => {
        const { result } = renderHook(() => useTimer({ initialTime: 60 }));

        act(() => {
            result.current.start();
        });

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(result.current.time).toBe(59);
    });

    it('should pause timer', () => {
        const { result } = renderHook(() => useTimer({ initialTime: 60 }));

        act(() => {
            result.current.start();
        });

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        act(() => {
            result.current.pause();
        });

        expect(result.current.isPaused).toBe(true);
        expect(result.current.time).toBe(58);

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        expect(result.current.time).toBe(58);
    });

    it('should reset timer', () => {
        const { result } = renderHook(() => useTimer({ initialTime: 60 }));

        act(() => {
            result.current.start();
        });

        act(() => {
            jest.advanceTimersByTime(10000);
        });

        act(() => {
            result.current.reset();
        });

        expect(result.current.time).toBe(60);
        expect(result.current.isRunning).toBe(false);
        expect(result.current.isPaused).toBe(false);
    });

    it('should call onComplete when timer reaches zero', () => {
        const onComplete = jest.fn();
        const { result } = renderHook(() => useTimer({
            initialTime: 3,
            onComplete
        }));

        act(() => {
            result.current.start();
        });

        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(result.current.time).toBe(0);
        expect(result.current.isRunning).toBe(false);
    });
});
