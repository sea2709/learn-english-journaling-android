/**
 * JS color/font tokens for props that cannot use className
 * (e.g. ActivityIndicator `color`, SVG `stroke`, Stack header options).
 * Source of truth for utilities: tailwind.config.js (mirrors the web app).
 */
export const colors = {
  paper: "#F3EDE1",
  paperDark: "#E8E0D0",
  paperLine: "#D4C9B8",
  pen: "#B0432E",
  penLight: "#C5562E",
  penMuted: "#B0432E99",
  ink50: "#f7f6f3",
  ink100: "#ece9e1",
  ink200: "#d9d3c4",
  ink300: "#c0b6a0",
  ink400: "#a6977c",
  ink500: "#8f7d62",
  ink600: "#7a6a54",
  ink700: "#645646",
  ink800: "#54493c",
  ink900: "#483f35",
  ink950: "#272119",
  sage50: "#f4f7f4",
  sage100: "#e4ebe4",
  sage200: "#c9d7ca",
  sage700: "#394e3c",
  sage800: "#304032",
  coral50: "#fff5f2",
  coral200: "#ffd5c8",
  coral700: "#c13d18",
  coral800: "#a03418",
  white: "#FFFFFF",
  whiteSoft: "rgba(255, 255, 255, 0.55)",
} as const;

export const fonts = {
  display: "Fraunces_600SemiBold",
  displayRegular: "Fraunces_400Regular",
  mono: "CourierPrime_400Regular",
  monoBold: "CourierPrime_700Bold",
} as const;

export const spacing = {
  screen: 20,
  sheetMax: 800,
} as const;

/** Join class names, omitting falsy values. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
