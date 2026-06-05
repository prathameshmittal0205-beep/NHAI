import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NHAI Datalake 3.0 — Offline Facial Recognition System",
  description: "Edge-deployed offline facial recognition and liveness detection system for NHAI field personnel. Built with MobileFaceNet, TFLite INT8, React Native, and AWS.",
  openGraph: {
    title: "NHAI Datalake 3.0",
    description: "Edge-deployed offline facial recognition and liveness detection system for NHAI field personnel. Built with MobileFaceNet, TFLite INT8, React Native, and AWS.",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-950 text-slate-50 antialiased selection:bg-blue-500/30`}>
        <Navbar />
        <div className="flex-1 mt-20">
          {children}
        </div>
        <Footer />
        <BackToTop />
      </body>
    </html>
  );
}
