import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@shared/lib/cn';

export interface ModalProps {
    /** Открыто ли модальное окно */
    isOpen: boolean;
    /** Обработчик закрытия */
    onClose: () => void;
    /** Заголовок */
    title?: string;
    /** Дочерние элементы */
    children: React.ReactNode;
    /** CSS класс контента */
    className?: string;
    /** Закрывать по клику на оверлей */
    closeOnOverlayClick?: boolean;
    /** Закрывать по Escape */
    closeOnEscape?: boolean;
    /** Показывать drag handle */
    showHandle?: boolean;
    /** Размер модалки */
    size?: 'sm' | 'md' | 'lg' | 'full';
    /** Haptic feedback */
    haptic?: boolean;
}

const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-full mx-4',
};

/**
 * Modal - компонент модального окна с bottom sheet для мобильных
 * 
 * @example
 * // Базовое использование
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Заголовок"
 * >
 *   <p>Содержимое модального окна</p>
 * </Modal>
 * 
 * // Без заголовка
 * <Modal isOpen={isOpen} onClose={handleClose}>
 *   <div>Контент</div>
 * </Modal>
 * 
 * // Полноэкранный режим
 * <Modal isOpen={isOpen} onClose={handleClose} size="full">
 *   <WorkoutDetails />
 * </Modal>
 */
export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    className,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    showHandle = true,
    size = 'md',
    haptic = true,
}) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const touchStartY = useRef<number>(0);
    const touchCurrentY = useRef<number>(0);
    const isDragging = useRef<boolean>(false);

    // Haptic feedback при открытии
    useEffect(() => {
        if (isOpen && haptic && typeof window !== 'undefined' && 'Telegram' in window) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        }
    }, [isOpen, haptic]);

    // Монтирование компонента
    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);
            setIsClosing(false);
            // Блокируем скролл body
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Плавное закрытие
    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsMounted(false);
        }, 300);
    }, [onClose]);

    // Обработка Escape
    const handleEscape = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && closeOnEscape && isOpen) {
                handleClose();
            }
        },
        [closeOnEscape, isOpen, handleClose]
    );

    useEffect(() => {
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [handleEscape]);

    // Клик по оверлею
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current && closeOnOverlayClick) {
            handleClose();
        }
    };

    // Touch handling для drag-to-dismiss
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        isDragging.current = true;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current) return;

        touchCurrentY.current = e.touches[0].clientY;
        const deltaY = touchCurrentY.current - touchStartY.current;

        // Только свайп вниз
        if (deltaY > 0 && contentRef.current) {
            contentRef.current.style.transform = `translateY(${deltaY}px)`;
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging.current) return;

        isDragging.current = false;
        const deltaY = touchCurrentY.current - touchStartY.current;

        // Если свайп больше 100px - закрываем
        if (deltaY > 100) {
            handleClose();
        } else if (contentRef.current) {
            // Иначе возвращаем на место с анимацией
            contentRef.current.style.transition = 'transform 0.3s ease-out';
            contentRef.current.style.transform = 'translateY(0)';
            setTimeout(() => {
                if (contentRef.current) {
                    contentRef.current.style.transition = '';
                }
            }, 300);
        }
    };

    if (!isMounted && !isOpen) return null;

    const modalContent = (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className={cn(
                'fixed inset-0 z-50',
                'flex items-end sm:items-center justify-center',
                'bg-black/60 backdrop-blur-sm',
                'transition-opacity duration-300',
                isClosing ? 'opacity-0' : 'opacity-100'
            )}
            aria-modal="true"
            role="dialog"
        >
            {/* Контент модалки */}
            <div
                ref={contentRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={cn(
                    // Базовые стили
                    'w-full bg-telegram-bg',
                    'rounded-t-3xl sm:rounded-2xl',
                    'shadow-2xl',
                    'transition-all duration-300',
                    'touch-manipulation',

                    // Анимация появления/исчезновения
                    isClosing
                        ? 'translate-y-full sm:translate-y-8 sm:opacity-0'
                        : 'translate-y-0 sm:translate-y-0 sm:opacity-100',

                    // Размеры
                    sizeStyles[size],

                    // Safe area для мобильных
                    'pb-safe-bottom',

                    className
                )}
            >
                {/* Drag handle */}
                {showHandle && (
                    <div className="flex justify-center pt-3 pb-1">
                        <div
                            className={cn(
                                'w-10 h-1 rounded-full',
                                'bg-telegram-hint/30',
                                'transition-colors duration-200'
                            )}
                        />
                    </div>
                )}

                {/* Заголовок */}
                {title && (
                    <div className="px-5 pt-2 pb-3 border-b border-border">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-telegram-text">
                                {title}
                            </h2>
                            {/* Кнопка закрытия */}
                            <button
                                onClick={handleClose}
                                className={cn(
                                    'p-2 -mr-2 rounded-full',
                                    'text-telegram-hint hover:text-telegram-text',
                                    'hover:bg-telegram-secondary-bg',
                                    'transition-colors duration-200',
                                    'focus:outline-none focus:ring-2 focus:ring-primary/30'
                                )}
                                aria-label="Закрыть"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* Контент */}
                <div className="p-5 max-h-[70vh] overflow-y-auto no-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

Modal.displayName = 'Modal';

export default Modal;
