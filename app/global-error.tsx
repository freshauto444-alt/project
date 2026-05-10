"use client"

// Last-resort error boundary — kicks in when root layout itself errors.
// Must render its own <html>/<body> since layout failed to render.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uk">
      <body style={{
        background: "#030303", color: "#F5F5F7",
        minHeight: "100vh", margin: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 24, textAlign: "center", gap: 16, flexDirection: "column",
      }}>
        <h1 style={{ fontSize: 28, fontWeight: 600 }}>Критична помилка</h1>
        <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 420 }}>
          Сайт тимчасово недоступний. Спробуйте оновити сторінку або зайти пізніше.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#00D2C6", color: "#030303", border: 0,
            padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Оновити
        </button>
      </body>
    </html>
  )
}
