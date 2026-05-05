import "./globals.css";

export const metadata = {
  title: "RAG 3D Chatbot",
  description: "Next.js + Supabase + pgvector + React Three Fiber baseline",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
