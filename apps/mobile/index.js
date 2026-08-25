import "react-native-gesture-handler";
import { registerRootComponent } from "expo";

import { configurePushNotifications } from "./src/notifications/configurePush";
import App from "./App";

void configurePushNotifications().catch(() => undefined);

registerRootComponent(App);
