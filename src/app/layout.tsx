import type { Metadata } from "next";
import packageJson from "../../package.json";
import "./globals.css";

export const metadata: Metadata = {
  title: "MwalimuConnect | Teaching opportunities, closer to home",
  description:
    "Discover teaching vacancies, including positions where teachers are employed by Boards of Management (BOM), and education internships across Kenya.",
  other: {
    "application-version": packageJson.version,
  },
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
