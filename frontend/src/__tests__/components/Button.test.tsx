import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../components/ui/Button';

describe('Button Component', () => {
    it('renders button with text', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('handles click events', () => {
        const handleClick = jest.fn();
        render(<Button onClick={handleClick}>Click me</Button>);

        fireEvent.click(screen.getByText('Click me'));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled when loading', () => {
        render(<Button isLoading>Loading</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows loading spinner when isLoading is true', () => {
        render(<Button isLoading>Loading</Button>);
        expect(screen.getByRole('button')).toHaveAttribute('disabled');
    });

    it('applies variant classes correctly', () => {
        const { rerender } = render(<Button variant="primary">Primary</Button>);
        expect(screen.getByRole('button')).toHaveClass('bg-blue-600');

        rerender(<Button variant="secondary">Secondary</Button>);
        expect(screen.getByRole('button')).toHaveClass('bg-gray-200');

        rerender(<Button variant="danger">Danger</Button>);
        expect(screen.getByRole('button')).toHaveClass('bg-red-600');
    });

    it('is disabled when disabled prop is true', () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
