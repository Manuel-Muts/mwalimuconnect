import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MwalimuConnect | Teaching opportunities, closer to home",
  description:
    "Discover teaching vacancies, including positions where teachers are employed by Boards of Management (BOM), and education internships across Kenya.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
