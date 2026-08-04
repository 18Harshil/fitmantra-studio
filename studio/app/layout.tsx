export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#eee" }}>
        {children}
        <div style={{
          position: "fixed", top: 12, right: 32, zIndex: 1000,
          display: "flex", alignItems: "center", gap: 8,
          opacity: 0.9, pointerEvents: "none",
        }}>
          <img src="/logo.png" alt="FitMantra" style={{ height: 52, width: "auto", objectFit: "contain" }} />
        </div>
      </body>
    </html>
  )
}
