import Button from "./Button";
import Section from "./Section";
import { BottomLine } from "./design/Hero";

const Hero = () => {
  return (
    <Section
      className="pt-[12rem] -mt-[5.25rem]"
      customPaddings=" "
      id="hero"
    >
      <div className="container relative">
        <div className="relative z-1 max-w-[62rem] mx-auto text-center mb-[3.875rem] md:mb-20 lg:mb-[6.25rem]">
          <p className="tagline mb-6 text-color-1">
            SunRegen Healthcare
          </p>
          <h1 className="h1 mb-6">
            Advancing Neuroprotective Therapies for Retinal Degeneration
          </h1>
          <p className="body-1 max-w-3xl mx-auto mb-6 text-n-2 lg:mb-8">
            SunRegen is developing first-in-class treatments targeting the
            underlying mechanisms of neuronal loss in degenerative retinal
            diseases, with potential applications across neurodegenerative
            conditions.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button href="#science">
              View Our Science
            </Button>
            <Button href="#science" white>
              Pipeline Overview
            </Button>
          </div>
        </div>
      </div>

      <BottomLine />
    </Section>
  );
};

export default Hero;
