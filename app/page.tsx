import Nav from "@/components/Nav";
import StageLoader from "@/components/bim/StageLoader";
import Hero from "@/components/sections/Hero";
import Story from "@/components/sections/Story";
import GridWipe from "@/components/sections/GridWipe";
import Shop from "@/components/sections/Shop";
import Reach from "@/components/sections/Reach";
import Work from "@/components/sections/Work";
import Credentials from "@/components/sections/Credentials";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/sections/Footer";

/**
 * All Air Mechanical — the 3D model edition.
 * One illustrative building sits in a fixed WebGL stage behind the hero and the
 * systems story: it assembles in 4D on load, then each trade goes in as you
 * scroll. Everything after the story scrolls over it on opaque sections.
 */
export default function Page() {
  return (
    <>
      <Nav />
      <StageLoader />
      <main id="top" className="relative z-10">
        <Hero />
        <Story />
        <GridWipe />
        <Shop />
        <Reach />
        <Work />
        <Credentials />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
