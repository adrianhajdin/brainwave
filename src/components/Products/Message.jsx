import React, { useRef } from "react";
import Section from "../Section";
import { message1 } from "../../assets";
import { BackgroundCircles, Rings } from "../design/Header";
import { Gradient } from "../design/Hero";

export default function Message() {
    const parallaxRef = useRef(null);
    return (
        <Section
            className="pt-[9rem] md:pt-[12rem] -mt-[5.25rem] pb-15"
            crosses
            crossesOffset="lg:translate-y-[5.25rem]"
            customPaddings
        >
            <div className="container relative" ref={parallaxRef}>
                <div className="relative z-1 max-w-[68rem] mx-auto">
                    <h1 className="h2 mb-2 text-center">Let's start transforming your offices</h1>
                    <div className="flex flex-col md:flex-row mt-6 items-center">
                        {" "}
                        <img src={message1} alt="message" className="max-w-[100%] md:max-w-[45%] z-2 rounded-2xl" />
                        <div className="relative mt-8 md:mt-0 md:absolute z-10 right-0">
                            <div className="bg-white rounded-lg">
                                <p className="body-1 max-w-2xl mx-auto text-n-2 p-4 border border-n-6 rounded-lg">
                                    Dear VideFace user, you, as a valuable company entering this new revolution, deserve
                                    our support throughout the process, especially at the beginning. For this reason we
                                    offer you this guide that will allow you to quickly adapt your offices to a virtual
                                    and automated one with our services.
                                </p>
                            </div>
                            <Gradient />
                        </div>
                    </div>
                </div>
                <Rings />
                <BackgroundCircles />
            </div>
        </Section>
    );
}
