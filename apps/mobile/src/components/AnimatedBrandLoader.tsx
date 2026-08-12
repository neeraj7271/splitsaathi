import React from "react";

import { BrandSplashScreen } from "./BrandSplashScreen";

/** Boot gate loader — single splash layout, themed by appearance mode. */
export function AnimatedBrandLoader(props?: { message?: string }) {
  return <BrandSplashScreen statusMessage={props?.message} />;
}
