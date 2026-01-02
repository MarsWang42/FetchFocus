import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
    ({ className, checked = false, onCheckedChange, ...props }, ref) => {
        return (
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                ref={ref}
                onClick={() => onCheckedChange?.(!checked)}
                className={cn(
                    'peer h-5 w-5 shrink-0 rounded-md border-2 transition-all duration-200 flex items-center justify-center',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-golden-400 focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    checked
                        ? 'border-golden-600 bg-golden-600 text-white'
                        : 'border-slate-300 bg-white hover:border-golden-400',
                    className
                )}
                {...props}
            >
                {checked && <Check className="h-3 w-3" strokeWidth={3} />}
            </button>
        );
    }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
