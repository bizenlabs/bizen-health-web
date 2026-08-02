import { Source_Serif_4 } from "next/font/google";

/* Display face for the marketing pages only — the app itself stays on Inter.
   Loaded here (not the root layout) so app routes don't pay for it. */
export const displayFont = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});
