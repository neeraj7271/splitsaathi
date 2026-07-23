import React from "react";

import { BrandSplashScreen } from "./BrandSplashScreen";

type Props = {
  message?: string;
};

/**
 * In-app boot / loading state. Uses the branded animated splash
 * (icon badge + wordmark) and adapts to light/dark theme.
 */
export function AnimatedBrandLoader({ message = "Loading your ledger" }: Props) {
  return <BrandSplashScreen message={message} />;
}
