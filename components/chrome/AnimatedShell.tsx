import { useEffect, useState, type ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors, cx } from "../../lib/theme";

/** Matches web Tailwind animations in tailwind.config.ts */
export const motion = {
  fadeInMs: 200,
  menuFadeMs: 150,
  drawerMs: 250,
  easeOut: Easing.out(Easing.ease),
} as const;

type AnimatedDrawerProps = {
  visible: boolean;
  onClose: () => void;
  side: "left" | "right";
  children: ReactNode;
  widthPercent?: `${number}%`;
  maxWidth?: number;
  panelStyle?: StyleProp<ViewStyle>;
};

/**
 * Backdrop fade-in (0.2s) + panel slide (0.25s ease-out), matching web
 * animate-fade-in / animate-drawer-in-left|right.
 */
export function AnimatedDrawer({
  visible,
  onClose,
  side,
  children,
  widthPercent = "86%",
  maxWidth = 380,
  panelStyle,
}: AnimatedDrawerProps) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: motion.drawerMs,
        easing: motion.easeOut,
      });
      return;
    }

    if (!mounted) return;

    progress.value = withTiming(
      0,
      { duration: motion.fadeInMs, easing: motion.easeOut },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      }
    );
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1" style={{ pointerEvents: "box-none" }}>
        <Pressable className="absolute inset-0" onPress={onClose}>
          <Animated.View
            className="absolute inset-0 bg-ink-950/25"
            style={backdropStyle}
          />
        </Pressable>
        <AnimatedDrawerPanel
          side={side}
          progress={progress}
          widthPercent={widthPercent}
          maxWidth={maxWidth}
          style={panelStyle}
        >
          {children}
        </AnimatedDrawerPanel>
      </View>
    </Modal>
  );
}

function AnimatedDrawerPanel({
  side,
  progress,
  widthPercent,
  maxWidth,
  style,
  children,
}: {
  side: "left" | "right";
  progress: SharedValue<number>;
  widthPercent: `${number}%`;
  maxWidth: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [panelWidth, setPanelWidth] = useState(() =>
    Math.min(maxWidth, Dimensions.get("window").width * 0.86)
  );

  const panelAnimStyle = useAnimatedStyle(() => {
    const offset = panelWidth * (1 - progress.value);
    return {
      transform: [{ translateX: side === "left" ? -offset : offset }],
    };
  }, [panelWidth, side]);

  return (
    <Animated.View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - panelWidth) > 0.5) setPanelWidth(w);
      }}
      className={cx(
        "absolute bottom-0 top-0 bg-paper shadow-lg",
        side === "left" ? "left-0" : "right-0"
      )}
      style={[
        { width: widthPercent, maxWidth, elevation: 12 },
        panelAnimStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

type AnimatedMenuProps = {
  visible: boolean;
  onClose: () => void;
  anchor: { top: number; right: number } | null;
  children: ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
};

/** Menu dropdown fade-in (0.15s ease-out), matching web .top-actions-dropdown. */
export function AnimatedMenu({
  visible,
  onClose,
  anchor,
  children,
  cardStyle,
}: AnimatedMenuProps) {
  const [mounted, setMounted] = useState(visible && anchor != null);
  const [cachedAnchor, setCachedAnchor] = useState(anchor);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible && anchor) {
      setCachedAnchor(anchor);
      setMounted(true);
      progress.value = withTiming(1, {
        duration: motion.menuFadeMs,
        easing: motion.easeOut,
      });
      return;
    }

    progress.value = withTiming(
      0,
      { duration: motion.menuFadeMs, easing: motion.easeOut },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      }
    );
  }, [visible, anchor, progress]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  if (!mounted || !cachedAnchor) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1" style={{ pointerEvents: "box-none" }}>
        <Pressable
          accessibilityLabel="Dismiss menu"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            menuCardStyles.card,
            { top: cachedAnchor.top, right: cachedAnchor.right },
            cardAnimStyle,
            cardStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Mirrors web `.top-actions-dropdown` shell (globals.css). */
const menuCardShadow = Platform.select<ViewStyle>({
  web: {
    boxShadow: "0 8px 24px rgba(39, 33, 25, 0.12)",
  } as ViewStyle,
  default: {
    shadowColor: colors.ink950,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
});

const menuCardStyles = StyleSheet.create({
  card: {
    position: "absolute",
    zIndex: 50,
    minWidth: 184,
    maxWidth: 300,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(212, 201, 184, 0.9)",
    borderRadius: 12,
    backgroundColor: colors.paper,
    ...menuCardShadow,
  },
});
