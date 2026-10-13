import { SUPPORTED_LOCALES } from "@irishpub-map/shared/locale";
import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text accessibilityRole="header">Irish Pub Map</Text>
      <Text>Supported locales: {SUPPORTED_LOCALES.join(", ")}</Text>
    </View>
  );
}
