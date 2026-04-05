import {
    createContext,
    useContext,
    useLayoutEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'

type AppShellLayoutContextValue = {
    headerRight: ReactNode
    setHeaderRight: (node: ReactNode) => void
}

const AppShellLayoutContext = createContext<AppShellLayoutContextValue | null>(null)

export function AppShellLayoutProvider({ children }: { children: ReactNode }) {
    const [headerRight, setHeaderRight] = useState<ReactNode>(null)

    const value = useMemo(
        () => ({
            headerRight,
            setHeaderRight,
        }),
        [headerRight],
    )

    return <AppShellLayoutContext.Provider value={value}>{children}</AppShellLayoutContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppShellLayoutContext() {
    const ctx = useContext(AppShellLayoutContext)
    if (!ctx) {
        throw new Error('useAppShellLayoutContext must be used inside AppShellLayoutProvider')
    }
    return ctx
}

/**
 * Правая часть app header. Передавайте узел, стабилизированный через useMemo, чтобы не вызывать лишние перерисовки.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAppShellHeaderRight(node: ReactNode) {
    const { setHeaderRight } = useAppShellLayoutContext()

    useLayoutEffect(() => {
        setHeaderRight(node)
        return () => setHeaderRight(null)
    }, [node, setHeaderRight])
}
