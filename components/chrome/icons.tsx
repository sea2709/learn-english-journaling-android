import type { ComponentProps } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "../../lib/theme";

type IconProps = {
  size?: number;
  color?: string;
};

function FaIcon({
  name,
  size = 14,
  color = colors.pen,
}: IconProps & { name: ComponentProps<typeof FontAwesome>["name"] }) {
  return <FontAwesome name={name} size={size} color={color} />;
}

export function HamburgerIcon({ size = 16, color = colors.pen }: IconProps) {
  return <FaIcon name="bars" size={size} color={color} />;
}

export function SettingsIcon({ size = 14, color = colors.pen }: IconProps) {
  return <FaIcon name="cog" size={size} color={color} />;
}

export function KeyIcon({ size = 14, color = colors.pen }: IconProps) {
  return <FaIcon name="key" size={size} color={color} />;
}

export function SignOutIcon({ size = 14, color = colors.pen }: IconProps) {
  return <FaIcon name="sign-out" size={size} color={color} />;
}

export function AppFeedbackIcon({ size = 14, color = colors.pen }: IconProps) {
  return <FaIcon name="comment" size={size} color={color} />;
}

export function AddImageIcon({ size = 16, color = colors.pen }: IconProps) {
  return <FaIcon name="image" size={size} color={color} />;
}

export function EyeIcon({
  crossed = false,
  size = 16,
  color = colors.ink400,
}: IconProps & { crossed?: boolean }) {
  return <FaIcon name={crossed ? "eye-slash" : "eye"} size={size} color={color} />;
}
