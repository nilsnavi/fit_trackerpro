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
    hideHeader: boolean
    setHideHeader: (hide: boolean) => void
    hideNavigation: boolean
    setHideNavigation: (hide: boolean) => void
}

const AppShellLayoutContext = createContext<AppShellLayoutContextValue | null>(null)

export function AppShellLayoutProvider({ children }: { children: ReactNode }) {
    const [headerRight, setHeaderRight] = useState<ReactNode>(null)
    const [hideHeader, setHideHeader] = useState(false)
    const [hideNavigation, setHideNavigation] = useState(false)

    const value = useMemo(
        () => ({
            headerRight,
            setHeaderRight,
            hideHeader,
            setHideHeader,
            hideNavigation,
            setHideNavigation,
        }),
        [headerRight, hideHeader, hideNavigation],
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

/**
 * Скрыть глобальный AppShellHeader для текущей страницы.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useHideAppShellHeader() {
    const { setHideHeader } = useAppShellLayoutContext()

    useLayoutEffect(() => {
        setHideHeader(true)
        return () => setHideHeader(false)
    }, [setHideHeader])
}

/**
 * Скрыть глобальную нижнюю навигацию для полноэкранных mobile-first поверхностей.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useHideAppShellNavigation() {
    const { setHideNavigation } = useAppShellLayoutContext()

    useLayoutEffect(() => {
        setHideNavigation(true)
        return () => setHideNavigation(false)
    }, [setHideNavigation])
}
