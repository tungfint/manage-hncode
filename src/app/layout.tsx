import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HNCode - Hệ thống quản lý Câu lạc bộ lập trình",
  description: "Hệ thống quản lý Câu lạc bộ lập trình HNCode",
  icons: {
    icon: "/favicon-HNCode.svg",
    shortcut: "/favicon-HNCode.svg",
    apple: "/favicon-HNCode.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full bg-[#f5f8fb] text-[#17215c] antialiased">
        {children}
      </body>
    </html>
  );
}
