import './globals.css'

/**
 * The root layout is intentionally minimal. `<html>` and `<body>` live in
 * `app/[locale]/layout.tsx`, which is where the resolved locale is available
 * for `lang` and `dir`.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
