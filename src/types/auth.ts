export interface SignUpPayload {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}

export interface SignUpResponse {
  success: boolean;
  message: string;
  userId?: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export type AuthNextStep = "dashboard" | "verify-email" | "onboarding";

export interface SignInResponse {
  success: boolean;
  message: string;
  userId?: string;
  email?: string;
  fullName?: string;
  nextStep?: AuthNextStep;
}

export type SellingPlatform = "Amazef" | "eBay";

export interface OnboardingPayload {
  userId: string;
  heardAboutUs: string;
  platform: SellingPlatform;
}

export interface OnboardingResponse {
  success: boolean;
  message: string;
}
