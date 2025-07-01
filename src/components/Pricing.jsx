import Section from "./Section";
import { smallSphere, stars } from "../assets";
import Heading from "./Heading";
import PricingList from "./PricingList";
import { LeftLine, RightLine } from "./design/Pricing";

const Pricing = () => {
  return (
    <Section className="overflow-hidden" id="pricing">
      <div className="container relative z-2">
        <div className="hidden relative justify-center mb-[6.5rem] lg:flex">
          <img
            src={smallSphere}
            className="relative z-1"
            width={255}
            height={255}
            alt="Sphere"
          />
          <div className="absolute top-1/2 left-1/2 w-[60rem] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <img
              src={stars}
              className="w-full"
              width={950}
              height={400}
              alt="Stars"
            />
          </div>
        </div>

        <Heading
          tag="Get started with NumenAI"
          title="Choose your learning plan"
        />

        <div className="relative">
          <PricingList />
          <LeftLine />
          <RightLine />
        </div>

        <div className="flex justify-center mt-10">
          <span className="text-xs font-code font-bold tracking-wider uppercase ">Achieve more with less effort — learning just got easier.</span>
          <a
            className="text-xs font-code font-bold tracking-wider uppercase border-b"
            href="https://docs.google.com/forms/d/e/1FAIpQLSet6U4qZXxAbDgBUh95HQkbciYa8g-LyIJMhjxBq0Ub4NMidQ/viewform?usp=header"
          >
            Pick your plan and begin
          </a>
        </div>
      </div>
    </Section>
  );
};

export default Pricing;
