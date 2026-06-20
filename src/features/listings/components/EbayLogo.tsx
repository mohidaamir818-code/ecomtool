interface EbayLogoProps {
  className?: string;
}

export function EbayLogo({ className = "h-8 w-auto" }: EbayLogoProps) {
  return (
    <svg
      viewBox="0 0 120 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="eBay"
      role="img"
    >
      <text x="0" y="36" fontFamily="Arial, Helvetica, sans-serif" fontSize="36" fontWeight="700">
        <tspan fill="#E53238">e</tspan>
        <tspan fill="#0064D2">B</tspan>
        <tspan fill="#F5AF02">a</tspan>
        <tspan fill="#86B817">y</tspan>
      </text>
    </svg>
  );
}
