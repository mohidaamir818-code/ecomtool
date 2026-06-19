"use client";

import { createContext, useContext } from "react";

interface UserBlockContextValue {
  isBlocked: boolean;
  blockReason: string | null;
}

const UserBlockContext = createContext<UserBlockContextValue>({
  isBlocked: false,
  blockReason: null,
});

export function UserBlockProvider({
  isBlocked,
  blockReason,
  children,
}: {
  isBlocked: boolean;
  blockReason: string | null;
  children: React.ReactNode;
}) {
  return (
    <UserBlockContext.Provider value={{ isBlocked, blockReason }}>
      {children}
    </UserBlockContext.Provider>
  );
}

export function useUserBlock() {
  return useContext(UserBlockContext);
}
