import React, { useState } from "react";

const Accordion = ({ items }) => {
    const [activeIndex, setActiveIndex] = useState(0);

    const handleToggle = (index) => {
        setActiveIndex(index);
    };

    return (
        <div className="bg-white border-n-6 mt-10">
            {items.map((item, index) => (
                <div key={index.id} className="mb-4">
                    <button
                        className={`bg-n-8 p-4 w-full border border-n-6 rounded-lg flex justify-between items-center hover:bg-slate-100`}
                        onClick={() => handleToggle(index)}
                    >
                        <span>{item.title}</span>
                        <svg
                            className={`transform transition duration-200 ${index === activeIndex ? "rotate-180" : ""}`}
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
                    {index === activeIndex && (
                        <div className="border border-n-6 rounded-lg bg-white p-4 mt-2">{item.content}</div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default Accordion;
