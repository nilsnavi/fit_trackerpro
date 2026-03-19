/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // ============================================
            // DESIGN TOKENS - FitTracker Pro
            // ============================================
            colors: {
                // Semantic Colors
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",

                // Primary Brand Colors
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    50: "hsl(var(--primary-50))",
                    100: "hsl(var(--primary-100))",
                    200: "hsl(var(--primary-200))",
                    300: "hsl(var(--primary-300))",
                    400: "hsl(var(--primary-400))",
                    500: "hsl(var(--primary-500))",
                    600: "hsl(var(--primary-600))",
                    700: "hsl(var(--primary-700))",
                    800: "hsl(var(--primary-800))",
                    900: "hsl(var(--primary-900))",
                    foreground: "hsl(var(--primary-foreground))",
                },

                // Success State Colors
                success: {
                    DEFAULT: "hsl(var(--success))",
                    50: "#f0fdf4",
                    100: "#dcfce7",
                    200: "#bbf7d0",
                    300: "#86efac",
                    400: "#4ade80",
                    500: "#22c55e",
                    600: "#16a34a",
                    700: "#15803d",
                    800: "#166534",
                    900: "#14532d",
                    foreground: "#ffffff",
                },

                // Warning State Colors
                warning: {
                    DEFAULT: "hsl(var(--warning))",
                    50: "#fffbeb",
                    100: "#fef3c7",
                    200: "#fde68a",
                    300: "#fcd34d",
                    400: "#fbbf24",
                    500: "#f59e0b",
                    600: "#d97706",
                    700: "#b45309",
                    800: "#92400e",
                    900: "#78350f",
                    foreground: "#ffffff",
                },

                // Danger/Error State Colors
                danger: {
                    DEFAULT: "hsl(var(--danger))",
                    50: "#fef2f2",
                    100: "#fee2e2",
                    200: "#fecaca",
                    300: "#fca5a5",
                    400: "#f87171",
                    500: "#ef4444",
                    600: "#dc2626",
                    700: "#b91c1c",
                    800: "#991b1b",
                    900: "#7f1d1d",
                    foreground: "#ffffff",
                },

                // Neutral Gray Scale
                neutral: {
                    DEFAULT: "hsl(var(--neutral))",
                    50: "#f8fafc",
                    100: "#f1f5f9",
                    200: "#e2e8f0",
                    300: "#cbd5e1",
                    400: "#94a3b8",
                    500: "#64748b",
                    600: "#475569",
                    700: "#334155",
                    800: "#1e293b",
                    900: "#0f172a",
                    950: "#020617",
                    foreground: "#ffffff",
                },

                // Glucose Specific Colors
                glucose: {
                    low: "#3b82f6",      // Blue for low glucose
                    normal: "#22c55e",   // Green for normal
                    high: "#f59e0b",     // Orange for high
                    critical: "#ef4444", // Red for critical
                },

                // Legacy compatibility
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },

                // Telegram Theme Integration
                telegram: {
                    bg: "var(--tg-theme-bg-color, #ffffff)",
                    "bg-secondary": "var(--tg-theme-secondary-bg-color, #f0f0f0)",
                    text: "var(--tg-theme-text-color, #000000)",
                    hint: "var(--tg-theme-hint-color, #999999)",
                    link: "var(--tg-theme-link-color, #2481cc)",
                    button: "var(--tg-theme-button-color, #2481cc)",
                    "button-text": "var(--tg-theme-button-text-color, #ffffff)",
                    "secondary-bg": "var(--tg-theme-secondary-bg-color, #f0f0f0)",
                    header: "var(--tg-theme-header-bg-color, #2481cc)",
                    accent: "var(--tg-theme-accent-text-color, #2481cc)",
                    destructive: "var(--tg-theme-destructive-text-color, #ef4444)",
                },
            },

            // ============================================
            // TYPOGRAPHY
            // ============================================
            fontSize: {
                xs: ["0.75rem", { lineHeight: "1rem" }],
                sm: ["0.875rem", { lineHeight: "1.25rem" }],
                base: ["1rem", { lineHeight: "1.5rem" }],
                lg: ["1.125rem", { lineHeight: "1.75rem" }],
                xl: ["1.25rem", { lineHeight: "1.75rem" }],
                "2xl": ["1.5rem", { lineHeight: "2rem" }],
                "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
                "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
                // Timer specific sizes
                timer: ["3rem", { lineHeight: "1", fontWeight: "700" }],
                "timer-lg": ["4rem", { lineHeight: "1", fontWeight: "700" }],
            },

            fontWeight: {
                thin: "100",
                extralight: "200",
                light: "300",
                normal: "400",
                medium: "500",
                semibold: "600",
                bold: "700",
                extrabold: "800",
                black: "900",
            },

            // ============================================
            // BORDER RADIUS
            // ============================================
            borderRadius: {
                sm: "0.375rem",
                md: "0.5rem",
                lg: "var(--radius)",
                xl: "0.75rem",
                "2xl": "1rem",
                "3xl": "1.5rem",
                full: "9999px",
            },

            // ============================================
            // SHADOWS
            // ============================================
            boxShadow: {
                sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
                xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
                // Colored shadows
                primary: "0 4px 14px 0 hsl(var(--primary) / 0.39)",
                success: "0 4px 14px 0 rgb(34 197 94 / 0.39)",
                danger: "0 4px 14px 0 rgb(239 68 68 / 0.39)",
                warning: "0 4px 14px 0 rgb(245 158 11 / 0.39)",
                // Inner shadows
                inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
            },

            // ============================================
            // ANIMATIONS
            // ============================================
            keyframes: {
                // Accordion
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                // Fade animations
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "fade-out": {
                    from: { opacity: "1" },
                    to: { opacity: "0" },
                },
                // Slide animations
                "slide-up": {
                    from: { opacity: "0", transform: "translateY(10px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "slide-down": {
                    from: { opacity: "0", transform: "translateY(-10px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "slide-left": {
                    from: { opacity: "0", transform: "translateX(10px)" },
                    to: { opacity: "1", transform: "translateX(0)" },
                },
                "slide-right": {
                    from: { opacity: "0", transform: "translateX(-10px)" },
                    to: { opacity: "1", transform: "translateX(0)" },
                },
                // Scale animations
                "scale-in": {
                    from: { opacity: "0", transform: "scale(0.95)" },
                    to: { opacity: "1", transform: "scale(1)" },
                },
                "scale-out": {
                    from: { opacity: "1", transform: "scale(1)" },
                    to: { opacity: "0", transform: "scale(0.95)" },
                },
                // Pulse and bounce
                pulse: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.5" },
                },
                bounce: {
                    "0%, 100%": { transform: "translateY(-25%)", animationTimingFunction: "cubic-bezier(0.8, 0, 1, 1)" },
                    "50%": { transform: "translateY(0)", animationTimingFunction: "cubic-bezier(0, 0, 0.2, 1)" },
                },
                // Spin
                spin: {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                },
                // Shake
                shake: {
                    "0%, 100%": { transform: "translateX(0)" },
                    "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
                    "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
                },
                // Timer pulse
                "timer-pulse": {
                    "0%, 100%": { transform: "scale(1)" },
                    "50%": { transform: "scale(1.02)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.3s ease-out",
                "fade-out": "fade-out 0.2s ease-in",
                "slide-up": "slide-up 0.3s ease-out",
                "slide-down": "slide-down 0.3s ease-out",
                "slide-left": "slide-left 0.3s ease-out",
                "slide-right": "slide-right 0.3s ease-out",
                "scale-in": "scale-in 0.2s ease-out",
                "scale-out": "scale-out 0.2s ease-in",
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                bounce: "bounce 1s infinite",
                spin: "spin 1s linear infinite",
                shake: "shake 0.5s ease-in-out",
                "timer-pulse": "timer-pulse 1s ease-in-out infinite",
            },

            // ============================================
            // TRANSITIONS
            // ============================================
            transitionDuration: {
                0: "0ms",
                75: "75ms",
                100: "100ms",
                150: "150ms",
                200: "200ms",
                300: "300ms",
                500: "500ms",
                700: "700ms",
                1000: "1000ms",
            },

            transitionTimingFunction: {
                "ease-in-out-cubic": "cubic-bezier(0.65, 0, 0.35, 1)",
                "ease-out-cubic": "cubic-bezier(0.33, 1, 0.68, 1)",
                "ease-in-cubic": "cubic-bezier(0.32, 0, 0.67, 0)",
            },

            // ============================================
            // SPACING
            // ============================================
            spacing: {
                18: "4.5rem",
                22: "5.5rem",
                26: "6.5rem",
                30: "7.5rem",
            },

            // ============================================
            // Z-INDEX
            // ============================================
            zIndex: {
                60: "60",
                70: "70",
                80: "80",
                90: "90",
                100: "100",
            },
        },
    },
    plugins: [],
}
