"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { company, contact } from "@/lib/content";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { scrollToTarget } from "@/lib/smooth-scroll";
import { BrandMark } from "@/components/shell/BrandMark";
import { MotionToggle } from "@/components/shell/MotionToggle";
import { BID_HREF, SECTION_LINKS, STREAM_FILLS, TRI_BAR } from "@/components/shell/site";

const GLASS_AFTER = 40; // px of scroll before the glass backdrop fades in
const MENU_ID = "site-menu";
const WIDE = "(min-width: 1024px)"; // lg: inline links replace the menu sheet
const OBSERVED = ["hero", ...SECTION_LINKS.map((l) => l.id)]; // "hero" active = no link underlined
const LEGAL_TAIL = company.name.slice(company.short.length).trim(); // "Contractors, Inc."

// Menu icon: the three streams stacked, folding into an X.
const BAR_GAP = motionTokens.distance.sm;
const BARS_CLOSED = [
  { y: -BAR_GAP, rotate: 0, opacity: 1 },
  { y: 0, rotate: 0, opacity: 1 },
  { y: BAR_GAP, rotate: 0, opacity: 1 },
];
const BARS_OPEN = [
  { y: 0, rotate: 45, opacity: 1 },
  { y: 0, rotate: 0, opacity: 0 },
  { y: 0, rotate: -45, opacity: 1 },
];

/**
 * Fixed top bar. Transparent over the dark model (a soft scrim keeps it
 * legible), glass once the page scrolls; tri-colour scroll progress on top;
 * an active-section underline that slides between links; a full-screen menu
 * sheet below lg.
 */
export default function Nav() {
  const reduce = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const active = useActiveSection();
  const { scrollY, scrollYProgress } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > GLASS_AFTER));
  useEffect(() => setScrolled(window.scrollY > GLASS_AFTER), []);
  useMenuSheetLock(open, setOpen, headerRef, buttonRef);

  const fade = {
    duration: reduce ? motionTokens.duration.fast : motionTokens.duration.normal,
    ease: motionTokens.easing.smooth,
  };
  const close = () => setOpen(false);
  // In-page jump from the open sheet: Lenis is stopped while the sheet locks the
  // page, so close first, then glide once the lock has lifted (next frame).
  const jump = (hash: string) => {
    setOpen(false);
    requestAnimationFrame(() => scrollToTarget(hash));
  };
  const handleLogo = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!open) return; // a plain anchor: Lenis glides it
    e.preventDefault();
    jump("#top");
  };

  return (
    // layoutRoot: the underline's layout animation ignores page scroll inside this fixed bar.
    <motion.header ref={headerRef} layoutRoot className="fixed inset-x-0 top-0 z-50">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-void/80 to-transparent"
        initial={false}
        animate={{ opacity: scrolled ? 0 : 1 }}
        transition={fade}
      />
      <motion.div
        aria-hidden
        className="glass pointer-events-none absolute inset-0 border-x-0 border-t-0"
        initial={false}
        animate={{ opacity: scrolled ? 1 : 0 }}
        transition={fade}
      />
      <ScrollProgress progress={scrollYProgress} reduce={reduce} />

      <nav aria-label="Primary" className="container-x relative z-10 flex h-[var(--nav-h)] items-center justify-between gap-6">
        <a
          href="#top"
          onClick={handleLogo}
          aria-label={`${company.name} — back to top`}
          className="flex shrink-0 items-center gap-3 rounded-sm"
        >
          <BrandMark draw="load" className="block h-9 w-auto md:h-10" />
          <span className="leading-none">
            <span className="block text-[15px] font-extrabold tracking-tight text-chalk md:text-base">{company.short}</span>
            <span className="hud mt-1 block text-fog">{LEGAL_TAIL}</span>
          </span>
        </a>

        <DesktopLinks active={active} reduce={reduce} />

        <div className="flex items-center gap-2">
          <a href={BID_HREF} className="btn btn-primary hidden px-4 py-2.5 text-[13px] sm:inline-flex">
            Request a bid
          </a>
          <MotionToggle variant="bar" />
          <MenuButton open={open} onToggle={() => setOpen((o) => !o)} buttonRef={buttonRef} />
        </div>
      </nav>

      <AnimatePresence>
        {open && <MenuSheet key="sheet" active={active} reduce={reduce} onNavigate={close} onJump={jump} />}
      </AnimatePresence>
    </motion.header>
  );
}

/** Three stream segments that fill in sequence: blue, then green, then red. */
function ScrollProgress({ progress, reduce }: { progress: MotionValue<number>; reduce: boolean }) {
  const smooth = useSpring(progress, springs.release);
  const p = reduce ? progress : smooth;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[2px]">
      {STREAM_FILLS.map((fill, i) => (
        <ProgressSegment key={fill} progress={p} index={i} fill={fill} />
      ))}
    </div>
  );
}

function ProgressSegment({ progress, index, fill }: { progress: MotionValue<number>; index: number; fill: string }) {
  const n = STREAM_FILLS.length;
  const scaleX = useTransform(progress, [index / n, (index + 1) / n], [0, 1]);
  return <motion.span className={`block h-full flex-1 origin-left ${fill}`} style={{ scaleX }} />;
}

function DesktopLinks({ active, reduce }: { active: string | null; reduce: boolean }) {
  return (
    <ul className="hidden items-center lg:flex">
      {SECTION_LINKS.map((l) => {
        const isActive = active === l.id;
        return (
          <li key={l.id}>
            <a
              href={`#${l.id}`}
              aria-current={isActive ? "true" : undefined}
              className={`relative block rounded-sm px-3 py-2 text-[13px] font-semibold transition-colors hover:text-chalk ${
                isActive ? "text-chalk" : "text-mist"
              }`}
            >
              {l.label}
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  aria-hidden
                  className="absolute inset-x-3 bottom-0 h-[2px]"
                  style={{ background: TRI_BAR }}
                  transition={reduce ? { duration: 0 } : springs.snappy}
                />
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

type MenuButtonProps = { open: boolean; onToggle: () => void; buttonRef: RefObject<HTMLButtonElement> };

function MenuButton({ open, onToggle, buttonRef }: MenuButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-expanded={open}
      aria-controls={MENU_ID}
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={onToggle}
      className="grid h-11 w-11 place-items-center rounded-full border border-chalk/25 bg-void/40 transition-colors hover:border-chalk/60 lg:hidden"
    >
      <span aria-hidden className="relative block h-[18px] w-5">
        {STREAM_FILLS.map((fill, i) => (
          <motion.span
            key={fill}
            className={`absolute inset-x-0 top-1/2 -mt-px block h-[2px] rounded-full ${fill}`}
            initial={false}
            animate={open ? BARS_OPEN[i] : BARS_CLOSED[i]}
            transition={springs.snappy}
          />
        ))}
      </span>
    </button>
  );
}

type SheetProps = {
  active: string | null;
  reduce: boolean;
  /** close the sheet; the link keeps its native action (the mailto bid link) */
  onNavigate: () => void;
  /** close the sheet, then scroll to an in-page "#id" */
  onJump: (hash: string) => void;
};

/** Full-screen menu below lg: numbered section links rise in one by one over a drafting grid. */
function MenuSheet({ active, reduce, onNavigate, onJump }: SheetProps) {
  const item = {
    hidden: { opacity: 0, y: motionTokens.distance.lg },
    shown: {
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: motionTokens.duration.fast }
        : { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth },
    },
  };
  return (
    <motion.nav
      id={MENU_ID}
      aria-label="Menu"
      className="blueprint fixed inset-0 z-[5] overflow-y-auto bg-void lg:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? motionTokens.duration.fast : motionTokens.duration.normal }}
    >
      <motion.ul
        className="container-x pb-12 pt-[calc(var(--nav-h)+2rem)]"
        initial="hidden"
        animate="shown"
        variants={{
          shown: {
            transition: {
              staggerChildren: reduce ? 0 : motionTokens.stagger,
              delayChildren: reduce ? 0 : motionTokens.duration.fast,
            },
          },
        }}
      >
        {SECTION_LINKS.map((l, i) => {
          const isActive = active === l.id;
          return (
            <motion.li key={l.id} variants={item} className="border-b border-hair">
              <a
                href={`#${l.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onJump(`#${l.id}`);
                }}
                aria-current={isActive ? "true" : undefined}
                className="flex items-center gap-4 rounded-sm py-4"
              >
                <span className="hud w-6 text-fog">{l.index}</span>
                <span className={`display text-[clamp(2rem,9vw,3.25rem)] ${isActive ? "text-chalk" : "text-mist"}`}>
                  {l.label}
                </span>
                <span aria-hidden className={`ml-auto h-2 w-2 rounded-full ${STREAM_FILLS[i % STREAM_FILLS.length]}`} />
              </a>
            </motion.li>
          );
        })}
        <motion.li variants={item} className="pt-8">
          <a href={BID_HREF} onClick={onNavigate} className="btn btn-primary w-full justify-center">
            Request a bid
          </a>
          <MotionToggle variant="sheet" className="mt-4" />
          <p className="mono mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            <a href={contact.phoneHref} className="rounded-sm text-mist transition-colors hover:text-chalk">
              {contact.phone}
            </a>
            <a href={`mailto:${contact.email}`} className="rounded-sm text-mist transition-colors hover:text-chalk">
              {contact.email}
            </a>
          </p>
        </motion.li>
      </motion.ul>
    </motion.nav>
  );
}

/** The section crossing a thin band just above mid-screen is the current one. */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const id of OBSERVED) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return active;
}

/**
 * While the sheet is open: page scroll locked, everything outside the header
 * inert, Tab trapped inside the header (bar + sheet), Escape closes and hands
 * focus back to the menu button, widening to lg closes it.
 * The lock is body overflow only: hidden on <html> too would break
 * position: sticky, and SmoothScroll pauses Lenis by watching the body.
 */
function useMenuSheetLock(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
  headerRef: RefObject<HTMLElement>,
  buttonRef: RefObject<HTMLButtonElement>,
) {
  useEffect(() => {
    const header = headerRef.current;
    if (!open || !header) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const outside = Array.from(document.body.children).filter(
      (el) => !el.contains(header) && !el.hasAttribute("inert"),
    );
    outside.forEach((el) => el.setAttribute("inert", ""));
    document.getElementById(MENU_ID)?.querySelector<HTMLElement>("a[href]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(header.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter(
        (el) => el.getClientRects().length > 0,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const wide = window.matchMedia(WIDE);
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = prevOverflow;
      outside.forEach((el) => el.removeAttribute("inert"));
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open, setOpen, headerRef, buttonRef]);
}
