"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogContextValue {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined)

function useDialog() {
    const context = React.useContext(DialogContext)
    if (!context) {
        throw new Error("Dialog components must be used within a Dialog provider")
    }
    return context
}

interface DialogProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    children: React.ReactNode
}

function Dialog({ open = false, onOpenChange, children }: DialogProps) {
    const [internalOpen, setInternalOpen] = React.useState(open)
    const isControlled = typeof onOpenChange === 'function'

    const handleOpenChange = React.useCallback((newOpen: boolean) => {
        if (isControlled) {
            onOpenChange?.(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
    }, [isControlled, onOpenChange])

    const currentOpen = isControlled ? open : internalOpen

    return (
        <DialogContext.Provider value={{ open: currentOpen, onOpenChange: handleOpenChange }}>
            {children}
        </DialogContext.Provider>
    )
}

interface DialogTriggerProps {
    children: React.ReactNode
    asChild?: boolean
    className?: string
}

function DialogTrigger({ children, asChild, className }: DialogTriggerProps) {
    const { onOpenChange } = useDialog()

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: () => onOpenChange(true),
        })
    }

    return (
        <button
            type="button"
            onClick={() => onOpenChange(true)}
            className={className}
        >
            {children}
        </button>
    )
}

interface DialogPortalProps {
    children: React.ReactNode
}

function DialogPortal({ children }: DialogPortalProps) {
    const { open } = useDialog()

    if (!open) return null

    return <>{children}</>
}

interface DialogOverlayProps {
    className?: string
}

function DialogOverlay({ className }: DialogOverlayProps) {
    const { onOpenChange } = useDialog()

    return (
        <div
            className={cn(
                "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                className
            )}
            onClick={() => onOpenChange(false)}
        />
    )
}

interface DialogContentProps {
    children: React.ReactNode
    className?: string
}

function DialogContent({ children, className }: DialogContentProps) {
    const { open, onOpenChange } = useDialog()

    if (!open) return null

    return (
        <>
            <DialogOverlay />
            <div
                className={cn(
                    "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4",
                    "border bg-white p-6 shadow-lg duration-200 rounded-xl",
                    "animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]",
                    className
                )}
            >
                {children}
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-golden-400 focus:ring-offset-2"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
            </div>
        </>
    )
}

interface DialogHeaderProps {
    className?: string
    children: React.ReactNode
}

function DialogHeader({ className, children }: DialogHeaderProps) {
    return (
        <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}>
            {children}
        </div>
    )
}

interface DialogFooterProps {
    className?: string
    children: React.ReactNode
}

function DialogFooter({ className, children }: DialogFooterProps) {
    return (
        <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}>
            {children}
        </div>
    )
}

interface DialogTitleProps {
    className?: string
    children: React.ReactNode
}

function DialogTitle({ className, children }: DialogTitleProps) {
    return (
        <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
            {children}
        </h2>
    )
}

interface DialogDescriptionProps {
    className?: string
    children: React.ReactNode
}

function DialogDescription({ className, children }: DialogDescriptionProps) {
    return (
        <p className={cn("text-sm text-stone-500", className)}>
            {children}
        </p>
    )
}

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
}
