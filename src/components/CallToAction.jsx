import Button from "./Button";
import Heading from "./Heading";
import Section from "./Section";
import Tagline from "./Tagline";
import { roadmap } from "../constants";
import { check2, grid, loading1 } from "../assets";
import { Gradient } from "./design/Roadmap";
import SurveyForm from "./SurveyForm";

const CallToAction = () => (
  <Section className="overflow-hidden" id="callToAction">
    <div className="container md:pb-10">
      <Heading title="Join Telegram to get Exclusive Whitelisted Access" />
      {/* <Heading title="Products" /> */}
			<div className="container mx-auto">
        {/* <h2 className="text-3xl font-bold mb-8 text-center">We'd Love Your Feedback</h2> */}
        <SurveyForm />
      </div>

      <div className="relative grid gap-6 md:grid-cols-2 md:gap-4 md:pb-[7rem]">
        <Gradient />
      </div>

      {/* <div className="flex justify-center mt-12 md:mt-15 xl:mt-20">
        <Button href="/roadmap">Our roadmap</Button>
      </div> */}
    </div>
  </Section>
);

export default CallToAction;
