import React, { useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import Button from "./Button";
import Heading from "./Heading";
import Section from "./Section";
import { gradient } from "../assets";
import { BackgroundCircles } from "./design/Hero";
import { HashLink as Link } from 'react-router-hash-link';

const Contact = () => {
    const formRef = useRef();
    const [form, setForm] = useState({
        name: "",
        company: "",
        email: "",
        message: "",
    });

    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [errors, setErrors] = useState({
        name: false,
        company: false,
        email: false,
        message: false,
    });

    const serviceId = "service_533en9n";
    const templateId = "template_iaw1tzn";
    const publicKey = "MT8ojo1DMmh4mO2x6";

    const handleChange = (e) => {
        const { id, value } = e.target;
        setForm((prevForm) => ({
            ...prevForm,
            [id]: value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        let hasErrors = false;
        const newErrors = {
            name: form.name === "",
            company: form.company === "",
            email: form.email === "",
            message: form.message === "",
        };

        if (newErrors.name || newErrors.company || newErrors.email || newErrors.message) {
            hasErrors = true;
        }

        setErrors(newErrors);

        if (hasErrors) {
            return;
        }

        setLoading(true);

        emailjs
            .send(
                serviceId,
                templateId,
                {
                    from_name: form.name,
                    to_name: "VideFace Contact",
                    from_email: form.email,
                    to_email: "videfaceapp@gmail.com",
                    message: `${form.company} \n\n${form.message} \n\nEmail: ${form.email}`,
                },
                publicKey
            )
            .then(
                () => {
                    setLoading(false);
                    setEmailSent(true);

                    setForm({
                        name: "",
                        company: "",
                        email: "",
                        message: "",
                    });
                },
                (error) => {
                    setLoading(false);
                    console.error(error);

                    alert("Ahh, something went wrong. Please try again.");
                }
            );
    };

    const isMobile = window.innerWidth <= 768; // Set the breakpoint for mobile devices

    return (
        <Section crosses>
            <div className="flex flex-col justify-center items-center h-screen">
                <Heading
                    tag="Don't be shy"
                    title="Contact us!"
                />
                <div className="bg-n-14 border border-n-6 rounded-[2rem] p-8 rounded-lg shadow-md max-w-md w-full">
                    <form ref={formRef} onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label htmlFor="name" className="block mb-1">
                                Your Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                className={`w-full p-2 border ${errors.name ? "border-n-6" : "border-gray-300"
                                    } rounded bg-n-7`}
                                placeholder="Name"
                                value={form.name}
                                onChange={handleChange}
                            />
                            {errors.name && (
                                <span className="text-color-5 text-sm">
                                    Please, write your name here.
                                </span>
                            )}
                        </div>
                        <div className="mb-4">
                            <label htmlFor="company" className="block mb-1">
                                Company Name
                            </label>
                            <input
                                id="company"
                                type="text"
                                className={`w-full p-2 border ${errors.company ? "border-n-6" : "border-gray-300"
                                    } rounded bg-n-7`}
                                placeholder="Company Name"
                                value={form.company}
                                onChange={handleChange}
                            />
                            {errors.company && (
                                <span className="text-color-5 text-sm">
                                    Please, write your company's name here.
                                </span>
                            )}
                        </div>
                        <div className="mb-4">
                            <label htmlFor="email" className="block mb-1">
                                Your Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                className={`w-full p-2 border ${errors.email ? "border-n-6" : "border-gray-300"
                                    } rounded bg-n-7`}
                                placeholder="Email"
                                value={form.email}
                                onChange={handleChange}
                            />
                            {errors.email && (
                                <span className="text-color-5 text-sm">
                                    Don't forget to write your email.
                                </span>
                            )}
                        </div>
                        <div className="mb-4">
                            <label htmlFor="message" className="block mb-1">
                                Tell us about your wants and needs
                            </label>
                            <textarea
                                id="message"
                                className={`w-full p-2 border ${errors.message ? "border-n-6" : "border-gray-300"
                                    } rounded bg-n-7 resize-none h-24`}
                                placeholder="Message"
                                value={form.message}
                                onChange={handleChange}
                            />
                            {errors.message && (
                                <span className="text-color-5 text-sm">
                                    The message can't be empty. Please, don't be shy!
                                </span>
                            )}
                        </div>
                        <Button
                            className={`w-full mb-6 mt-8 ${emailSent ? "bg-transparent cursor-not-allowed" : "bg-transparent hover:text-n-6"
                                }`}
                            disabled={emailSent}
                            onClick={handleSubmit}
                        >
                            {loading ? "Sending..." : emailSent ? "Email sent successfully!" : "Send"}
                        </Button>
                        <p className="text-sm text-center">
                            You can also email to{" "}
                            <a href="mailto:contact@videface.app" className="text-blue-500">
                                contact@videface.app
                            </a>
                        </p>
                    </form>
                    <div className="absolute -top-[54%] left-1/2 w-[234%] -translate-x-1/2 md:-top-[50%] md:w-[95%] lg:-top-[12%] opacity-15 " style={{ zIndex: -1 }}>
                        <img
                            src={gradient}
                            className="w-full"
                            width={1440}
                            height={1800}
                            alt="contact gradient background"
                        />
                    </div>
                </div>
                <div className={`relative ${isMobile ? "-top-[26%]" : "-top-[52%]"}`} style={{ zIndex: -1 }}>
                    <BackgroundCircles />
                </div>
            </div>
        </Section>
    );
};

export default Contact;
