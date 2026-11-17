import Image from "next/image";
import { cn } from "@corex/ui/lib/utils";

export type Shot = { src: string; alt: string };

/** A real screen from a demo, in a simple browser frame. */
export function BrowserShot({
  shot,
  priority = false,
  sizes,
  className,
}: {
  shot: Shot;
  priority?: boolean;
  sizes: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-background shadow-[0_18px_50px_-24px_rgba(6,70,68,0.45)]",
        className,
      )}
    >
      <div
        className="flex items-center gap-1.5 border-b border-border bg-surface px-3 py-2"
        aria-hidden="true"
      >
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
      </div>
      <Image
        src={shot.src}
        alt={shot.alt}
        width={1600}
        height={1000}
        sizes={sizes}
        priority={priority}
        className="block h-auto w-full"
      />
    </div>
  );
}

/** The product hero: the computer screen, with the phone screen in front of it on wider screens. */
export function ProductShot({ desktop, phone }: { desktop: Shot; phone: Shot }) {
  return (
    <div className="relative pb-[6%] sm:pr-[14%]">
      <BrowserShot shot={desktop} priority sizes="(min-width: 1024px) 560px, 92vw" />
      <div className="absolute right-0 bottom-0 hidden w-[24%] overflow-hidden rounded-[22px] border-4 border-ink bg-ink shadow-[0_18px_40px_-18px_rgba(6,70,68,0.6)] sm:block">
        <Image
          src={phone.src}
          alt={phone.alt}
          width={585}
          height={1266}
          sizes="140px"
          className="block h-auto w-full rounded-[18px]"
        />
      </div>
    </div>
  );
}
