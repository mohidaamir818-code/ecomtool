import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service | ecomtool",
  description: "Read the terms that apply when using ecomtool.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      updatedAt="June 2026"
      intro="By using ecomtool, you agree to these terms."
    >
      <div>
        <h2 className="text-base font-semibold text-gray-900">1. Service Description</h2>
        <p className="mt-2">
          ecomtool provides product research tools for dropshipping merchants, including price
          checking, stock monitoring, and competitor analysis.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">2. Subscription and Payment</h2>
        <p className="mt-2">
          Access requires a paid subscription. Fees are billed on a recurring basis. No refunds
          for partial months.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">3. Acceptable Use</h2>
        <p className="mt-2">You agree not to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Use the service for illegal purposes</li>
          <li>Attempt to reverse-engineer or resell our API access</li>
          <li>Abuse the service to overload third-party APIs</li>
        </ul>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">4. Data Accuracy</h2>
        <p className="mt-2">
          Product data is sourced from third-party platforms (AliExpress, eBay). We do not
          guarantee 100% accuracy of prices or stock at all times.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">5. Account Termination</h2>
        <p className="mt-2">We reserve the right to suspend accounts that violate these terms.</p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">6. Limitation of Liability</h2>
        <p className="mt-2">
          ecomtool is provided &quot;as is&quot;. We are not liable for losses resulting from
          business decisions made using our data.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">7. Changes to Terms</h2>
        <p className="mt-2">
          We may update these terms. Continued use means acceptance of changes.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900">8. Contact</h2>
        <p className="mt-2">
          Questions:{" "}
          <a href="mailto:admin@amazef.com" className="font-medium text-brand hover:underline">
            admin@amazef.com
          </a>
        </p>
        <p className="mt-2">
          ecomtool is also a project of <span className="font-medium">amazef.com</span>.
        </p>
      </div>
    </LegalPageShell>
  );
}
