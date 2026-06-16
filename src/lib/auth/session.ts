import type { AuthNextStep, SignInResponse } from "@/types/auth";

const STEP_PATHS: Record<AuthNextStep, string> = {
  dashboard: "/dashboard",
  "verify-email": "/verify-email",
  onboarding: "/onboarding",
};

export function saveAuthSession(data: SignInResponse) {
  if (!data.userId || !data.email || !data.nextStep) return;

  sessionStorage.setItem("ecomtools_user_id", data.userId);
  sessionStorage.setItem("ecomtools_user_email", data.email);
  sessionStorage.setItem("ecomtools_user_name", data.fullName ?? "User");

  sessionStorage.setItem(
    "ecomtools_email_verified",
    data.nextStep === "verify-email" ? "false" : "true",
  );

  sessionStorage.setItem(
    "ecomtools_onboarding_complete",
    data.nextStep === "dashboard" ? "true" : "false",
  );
}

export function getRedirectPath(nextStep: AuthNextStep) {
  return STEP_PATHS[nextStep];
}
