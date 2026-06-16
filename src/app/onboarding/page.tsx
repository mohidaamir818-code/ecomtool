import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { OnboardingForm } from "@/components/auth/OnboardingForm";

export const metadata: Metadata = {
  title: "Complete Setup — EcomTools",
  description: "Tell us about your business to personalize your EcomTools experience.",
};

export default function OnboardingPage() {
  return (
    <AuthLayout>
      <OnboardingForm />
    </AuthLayout>
  );
}
