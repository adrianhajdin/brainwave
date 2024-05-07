import React, { useState } from "react";
import PropTypes from "prop-types";

const Accordion = ({ items }) => {
    const [activeIndex, setActiveIndex] = useState(0);

    const handleToggle = (index) => {
        setActiveIndex(index);
    };

    return (
        <div className="border-n-6 mt-10">
            {items.map((item, index) => (
                <div key={item.id} className="mb-4">
                    <div className="h-auto w-full rounded-lg bg-gradient-to-br from-[#168BFF] via-[#46BCF4] to-[#98F7ED] p-[0.1rem]">
                        <button
                            className={`bg-n-8 p-4 w-full rounded-md flex justify-between items-center ${
                                index === activeIndex ? "bg-slate-50" : "bg-n-8"
                            }`}
                            onClick={() => handleToggle(index)}
                        >
                            <span
                                className={`font-bold ${index === activeIndex ? "text-color-2 " : "text-neutral-950"}`}
                            >
                                {item.title}
                            </span>
                            <svg
                                className={`transform transition duration-200 ${
                                    index === activeIndex ? "rotate-180" : ""
                                }`}
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M6 9l6 6 6-6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>
                    </div>

                    {index === activeIndex && (
                        <div className="border border-n-6 rounded-lg bg-white p-4 mt-2">{item.content}</div>
                    )}
                </div>
            ))}
        </div>
    );
};

Accordion.propTypes = {
    items: PropTypes.arrayOf(
        PropTypes.shape({
            title: PropTypes.string.isRequired,
            content: PropTypes.node.isRequired,
        })
    ).isRequired,
};

export default Accordion;
