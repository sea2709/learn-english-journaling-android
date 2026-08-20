import { Text, TouchableOpacity } from "react-native";
import { AddImageIcon } from "../chrome/icons";
import { colors } from "../../lib/theme";

export function AddImageButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className="mt-2 flex-row items-center gap-1.5 self-start"
      style={{ opacity: disabled ? 0.5 : 1 }}
      accessibilityRole="button"
      accessibilityLabel="Add image"
    >
      <AddImageIcon size={16} color={colors.pen} />
      <Text className="font-sans text-sm text-pen">Add image</Text>
    </TouchableOpacity>
  );
}
