import { curve, gradient } from "../assets";
import Button from "./Button";
import Section from "./Section";
import { BackgroundCircles, BottomLine, Gradient } from "./design/Hero";
import { heroIcons } from "../constants";
import { useRef, useState } from "react";
import Generating from "./Generating";
import Notification from "./Notification";
import CompanyLogos from "./CompanyLogos";
import LazyLoad from "react-lazy-load";
import ReactPlayer from "react-player";

const Hero = () => {
  const parallaxRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGenerating, setShowGenerating] = useState(true);

  const handlePlayerPlay = () => {
    setIsPlaying(true);
    setTimeout(() => {
      setShowGenerating(false);
    }, 750);
  };

  const handlePlayerPause = () => {
    setIsPlaying(false);
    setShowGenerating(true);
  };

  return (
    <Section
      className="pt-[12rem] -mt-[5.25rem]"
      crosses
      crossesOffset="lg:translate-y-[5.25rem]"
      customPaddings
      id="hero"
    >
      <div className="container relative" ref={parallaxRef}>
        <div className="relative z-1 max-w-[62rem] mx-auto text-center mb-[3.875rem] md:mb-20 lg:mb-[6.25rem]">
          <h1 className="h2 mb-2">
            Explore the Revolution of Virtual Assistance: {` `}
          </h1>
          <span className="inline-block relative h1 mb-12">
            <span
              style={{
                background: "white",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "#007FFF",
                WebkitTextStroke: "1px #007FFF",
              }}
            >
              VideFace
            </span>{" "}
            <img
              src={curve}
              className="absolute top-full left-0 w-full xl:-mt-1"
              width={624}
              height={28}
              alt="Curve"
            />
          </span>
          <p className="body-1 max-w-3xl mx-auto mb-6 text-n-2 lg:mb-8">
            Seamless experience that gives all the advantages <strong>of remote assistance, vehicle inspections, keys management and more.</strong>
          </p>
          <Button href="#pricing" white>
            Get started
          </Button>
        </div>
        <div className="relative max-w-[23rem] mx-auto md:max-w-5xl xl:mb-24">
          <div className="relative z-1 p-0.5 rounded-2xl bg-conic-black">
            <div className="relative bg-n-1 rounded-[1rem]">
              <div className="h-[1.4rem] bg-n-1 rounded-t-[0.9rem]" />

              <div className="aspect-[33/40] rounded-b-[0.9rem] overflow-hidden md:aspect-[688/490] lg:aspect-[1024/490]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-black text-4xl">Welcome.</p>
                </div>
                <LazyLoad>
                  <div className={`absolute inset-2 border z-1`}>
                    <ReactPlayer
                      url={"https://www.youtube.com/watch?v=3rgVNI_2uuM"}
                      width="100%"
                      height="100%"
                      controls={true}
                      className="rounded-2xl"
                      onPlay={handlePlayerPlay}
                      onPause={handlePlayerPause}
                    />
                  </div>
                </LazyLoad>
                {showGenerating && (
                  <Generating
                    className={`z-1 absolute left-4 right-4 bottom-5 md:left-1/2 md:right-auto md:bottom-8 md:w-[31rem] md:-translate-x-1/2 transition-opacity ${isPlaying ? "opacity-0" : "opacity-100"
                      }`}
                  />
                )}
                <ul
                  className={`z-1 hidden absolute -left-[5.5rem] bottom-[7.5rem] px-1 py-1 bg-n-9/40 backdrop-blur border border-n-1/10 rounded-2xl xl:flex transition-opacity ${isPlaying ? "opacity-0" : "opacity-100"
                    }`}
                >
                  {heroIcons.map((icon, index) => (
                    <li className="p-5" key={index}>
                      <img src={icon} width={24} height={25} alt={icon} />
                    </li>
                  ))}
                </ul>

                <Notification
                  className={`z-1 hidden absolute -right-[5.5rem] bottom-[11rem] w-[18rem] xl:flex transition-opacity ${isPlaying ? "opacity-0 z-0" : "opacity-100 z-1"
                    }`}
                  title="How can I help you?"
                />
              </div>
            </div>

            <Gradient />
          </div>
          <div className="absolute -top-[54%] left-1/2 w-[234%] -translate-x-1/2 md:-top-[46%] md:w-[138%] lg:-top-[104%] opacity-20">
            <img
              src={gradient}
              className="w-full"
              width={1440}
              height={1800}
              alt="hero"
            />
          </div>

          <BackgroundCircles />
        </div>

        <CompanyLogos className="z-10 mt-20 lg:block" />
      </div>

      <BottomLine />
    </Section>
  );
};

export default Hero;
