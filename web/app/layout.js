import "./globals.css";

export const metadata = { title: "InsightForge | Sales Intelligence", description: "Sales analytics pipeline & dashboard" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}