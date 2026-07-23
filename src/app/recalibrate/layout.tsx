import { ThemeProvider } from "@/components/theme-provider";

// The interview console is dark-by-default regardless of the panelist's stored
// site-wide theme preference — nested ThemeProvider + forcedTheme locks it here
// only; every other route keeps respecting the user's own light/dark/system choice.
export default function RecalibrateLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider forcedTheme="dark">{children}</ThemeProvider>;
}
