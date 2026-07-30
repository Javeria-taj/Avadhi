import './globals.css'

export const metadata = {
  title: 'ಕ್ಲೇಮ್ ಸಮಯ — Claim Window',
  description: 'Offline claim-deadline navigator',
}

export const viewport = {
  themeColor: '#eaf0eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

// lang="kn" so screen readers announce Kannada correctly.
export default function RootLayout({ children }) {
  return (
    <html lang="kn">
      <body>{children}</body>
    </html>
  )
}
