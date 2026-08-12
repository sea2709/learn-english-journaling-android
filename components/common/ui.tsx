import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, cx } from "../../lib/theme";

/** Display grammar score on a 0–10 scale (storage remains 0–100). */
export function scoreToDisplay(score: number): number {
  return Math.round((score / 100) * 10 * 10) / 10;
}

export function ScoreRing({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md";
}) {
  const displayScore = scoreToDisplay(score);
  const svgSize = size === "sm" ? 72 : 96;
  const radius = size === "sm" ? 28 : 36;
  const stroke = size === "sm" ? 5 : 6;
  const center = svgSize / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 10) * circumference;

  return (
    <View
      className="items-center justify-center"
      style={{ width: svgSize, height: svgSize }}
    >
      <Svg
        width={svgSize}
        height={svgSize}
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={colors.paperLine}
          strokeWidth={stroke}
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={colors.penLight}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text
        className={cx(
          "font-display text-ink-900",
          size === "sm" ? "text-lg leading-5" : "text-2xl leading-7"
        )}
      >
        {displayScore}
      </Text>
      <Text
        className={cx(
          "uppercase tracking-wide text-ink-500",
          size === "sm" ? "text-[9px]" : "text-[10px]"
        )}
      >
        / 10
      </Text>
    </View>
  );
}

type PillProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  penAccent?: boolean;
  fullWidth?: boolean;
  variant?: "default" | "primary" | "danger";
};

export function PillButton({
  label,
  onPress,
  disabled,
  loading,
  penAccent,
  fullWidth,
  variant = "default",
}: PillProps) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      className={cx(
        "min-h-10 items-center justify-center rounded-full border px-3.5 py-2",
        "border-paper-line/80 bg-white/55",
        fullWidth && "w-full",
        isPrimary && "border-ink-900 bg-ink-900",
        isDanger && "border-coral-200 bg-coral-50",
        (disabled || loading) && "opacity-[0.55]"
      )}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.pen} size="small" />
      ) : (
        <Text
          className={cx(
            "text-[13px] font-medium text-ink-800",
            penAccent && "text-pen",
            isPrimary && "font-semibold text-white",
            isDanger && "font-semibold text-coral-700"
          )}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function PaperLoading({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-paper">
      <ActivityIndicator size="large" color={colors.pen} />
      {label ? <Text className="text-sm text-ink-500">{label}</Text> : null}
    </View>
  );
}
