"use client";

import { createContext, type ReactNode, useContext } from "react";

/**
 * Session-derived viewer info that the workspace UI wants without
 * prop-drilling from the server layout.
 *
 * Better-Auth's client `useSession` does not surface the `admin` plugin's
 * `role` field, so we read it server-side and inject via this provider.
 */
export interface Viewer {
  isAdmin: boolean;
}

const ViewerCtx = createContext<Viewer>({ isAdmin: false });

export function ViewerProvider({
  value,
  children,
}: {
  value: Viewer;
  children: ReactNode;
}) {
  return <ViewerCtx.Provider value={value}>{children}</ViewerCtx.Provider>;
}

export function useViewer(): Viewer {
  return useContext(ViewerCtx);
}
