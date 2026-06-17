import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy | ecomtool",
  description: "Read how ecomtool collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      updatedAt="June 2026"
      intro='ecomtool ("we", "us", "our") respects your privacy. This policy explains how we handle information when you use our service.'
    >
      <div>
        <h2 className="text-base font-semibold text-gray-900">Information We Collect</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Account information (name, email) when you sign up</li>
          <li>Usage data (features used, login times)</li>
          <li>
            Payment information (processed securely by our payment provider, we do not store card
            details)
          </li>
        </ul>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">How We Use Your Information</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>To provide and improve our subscription service</li>
          <li>To process payments</li>
          <li>To send important service updates</li>
          <li>To respond to support requests</li>
        </ul>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">Third-Party Services</h2>
        <p className="mt-2">
          We use AliExpress and eBay APIs to fetch publicly available product data (prices, stock,
          listings). We do not access or store any personal AliExpress or eBay account data.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">Data Security</h2>
        <p className="mt-2">We use industry-standard security measures to protect your information.</p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">Data Sharing</h2>
        <p className="mt-2">
          We do not sell or share your personal information with third parties except as required
          to provide our service (e.g., payment processors).
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">Your Rights</h2>
        <p className="mt-2">
          You can request access to or deletion of your data by contacting us at{" "}
          <a href="mailto:admin@amazef.com" className="font-medium text-brand hover:underline">
            admin@amazef.com
          </a>
          .
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">Changes to This Policy</h2>
        <p className="mt-2">
          We may update this policy. Continued use of the service means you accept the updated
          policy.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">Contact</h2>
        <p className="mt-2">
          For questions, email:{" "}
          <a href="mailto:admin@amazef.com" className="font-medium text-brand hover:underline">
            admin@amazef.com
          </a>
        </p>
        <p className="mt-2">
          ecomtool is managed and operated by the founders and managers of{" "}
          <span className="font-medium">amazef.com</span>.
        </p>
      </div>
    </LegalPageShell>
  );
}
