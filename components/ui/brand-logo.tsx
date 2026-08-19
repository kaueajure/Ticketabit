type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      <img src="/brand-logo.svg" alt="" />
    </span>
  );
}
