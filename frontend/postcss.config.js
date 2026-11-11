export default {
    plugins: {
        // Tailwind v4: the PostCSS plugin lives in a separate package.
        // Autoprefixing is handled inside Tailwind v4, so `autoprefixer` is no longer needed.
        "@tailwindcss/postcss": {},
    },
}