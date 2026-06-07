import Image from "next/image";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
  showText?: boolean;
};

export function BrandLogo({
  compact = false,
  className = "",
  showText = true,
}: BrandLogoProps) {
  const imageSize = compact ? 56 : 96;
  const imageClass = compact ? "size-12" : "size-24";

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <Image
        src="/Logo-HNCode.svg"
        alt="Hệ thống quản lý Câu lạc bộ lập trình HNCode"
        width={imageSize}
        height={imageSize}
        priority
        className={`${imageClass} shrink-0 object-contain`}
      />
      {showText ? (
        <div className="min-w-0">
          <p
            className={
              compact
                ? "text-lg font-bold text-[#17215c]"
                : "text-3xl font-bold text-[#17215c]"
            }
          >
            HNCode
          </p>
          <p className="text-xs font-medium text-slate-500">
            Hệ thống quản lý Câu lạc bộ lập trình
          </p>
        </div>
      ) : null}
    </div>
  );
}
