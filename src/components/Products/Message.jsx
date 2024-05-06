import React, { useRef } from "react";
import Section from "../Section";
import { message1, gradient } from "../../assets";
import { BackgroundCircles } from "../design/Header";
import { Gradient } from "../design/Hero";

export default function Message() {
    const parallaxRef = useRef(null);
    return (
        <Section className="pt-[12rem] -mt-[5.25rem]" crosses crossesOffset="lg:translate-y-[5.25rem]" customPaddings>
            <div className="container relative" ref={parallaxRef}>
                <div className="relative z-1 max-w-[62rem] mx-auto">
                    <h1 className="h2 mb-2 text-center">Let's start transforming your offices</h1>
                    <div className="flex items-center mt-6">
                        {" "}
                        <img src={message1} alt="message" className="max-w-80 z-2" />
                        <div className="bg-white">
                            <p className="body-1 max-w-3xl mx-auto text-n-2 p-4 border-4 border-black rounded-lg">
                                Dear VideFace user, you, as a valuable company entering this new revolution, deserve our
                                support throughout the process, especially at the beginning. For this reason we offer
                                you this guide that will allow you to quickly adapt your offices to a virtual and
                                automated one with our services.
                            </p>
                            <Gradient />
                        </div>
                    </div>
                </div>
                <BackgroundCircles />
            </div>
        </Section>
    );
}
