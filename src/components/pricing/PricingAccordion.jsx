import React, { useState } from "react";
import { tablesData } from "../../constants/plans";
import Tooltip from "./Tooltip";
import AccordionTable from "./AccordionTable";
import Section from "../Section";

export default function PricingAccordion() {
    const [activeIndex, setActiveIndex] = useState(null);

    const handleClick = (index) => {
        setActiveIndex(index === activeIndex ? null : index);
    };

    return (
        <Section id="plansMobile" className="sticky">
            <div className="container relative z-2">
                <div className="flex flex-col gap-4">
                    {tablesData.map((tableData, index) => (
                        <div key={tableData.id} className="rounded-md overflow-hidden">
                            <button
                                className={`w-full p-4 flex justify-between items-center focus:outline-none rounded-md border border-n-6 ${
                                    activeIndex === index ? "bg-slate-50" : ""
                                }`}
                                onClick={() => handleClick(index)}
                            >
                                <span
                                    className={`font-bold text-[18px] ${
                                        index === activeIndex ? "text-color-1" : "text-neutral-950"
                                    }`}
                                >
                                    {tableData.title.text}
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
                            {activeIndex === index && (
                                <div className="p-4">
                                    {Object.entries(tableData.elements).map(([rowKey, rowData]) => (
                                        <div key={rowKey} className="mb-4  rounded-md ">
                                            <div className="p-4 border-b border-n-6 rounded-t flex justify-between">
                                                <span className="font-medium text-n-6 max-w-[79%]">{rowData.name}</span>
                                                <div className="flex items-center">
                                                    <Tooltip content={rowData.description}>
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="16"
                                                            height="16"
                                                            fill="none"
                                                        >
                                                            <path
                                                                fill="#A8AFBD"
                                                                d="M7.333 4.667h1.334V6H7.333zm0 2.666h1.334v4H7.333zm.667-6A6.67 6.67 0 0 0 1.333 8 6.67 6.67 0 0 0 8 14.667 6.67 6.67 0 0 0 14.667 8 6.67 6.67 0 0 0 8 1.333m0 12A5.34 5.34 0 0 1 2.667 8 5.34 5.34 0 0 1 8 2.667 5.34 5.34 0 0 1 13.333 8 5.34 5.34 0 0 1 8 13.333"
                                                            />
                                                        </svg>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                            <AccordionTable rowData={rowData} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </Section>
    );
}
