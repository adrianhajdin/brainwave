import React, { useState } from "react";
import { tablesData } from "../../constants/plans";
import Tooltip from "./Tooltip";

export default function PricingAccordion() {
    const [activeIndex, setActiveIndex] = useState(null);

    const handleClick = (index) => {
        setActiveIndex(index === activeIndex ? null : index);
    };

    return (
        <div className="flex flex-col gap-4">
            {tablesData.map((tableData, index) => (
                <div key={tableData.id} className="rounded-md overflow-hidden">
                    <button
                        className={`w-full p-4 flex justify-between items-center focus:outline-none rounded-md border border-n-6 ${
                            activeIndex === index ? "bg-slate-50" : ""
                        }`}
                        onClick={() => handleClick(index)}
                    >
                        <span className={`font-bold ${index === activeIndex ? "text-color-1" : "text-neutral-950"}`}>
                            {tableData.title.text}
                        </span>
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
                                    <div className="p-4">
                                        <table className="w-full table-auto">
                                            <th></th>
                                            <tbody>
                                                <tr className="border-b">
                                                    <td className="p-4 text-left font-medium text-n-1 flex">
                                                        VideFace Calls
                                                    </td>
                                                    <td className="p-4">{renderValue(rowData.call)}</td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="p-4 text-left font-medium text-n-1">
                                                        VideFace Cars
                                                    </td>
                                                    <td className="p-4">{renderValue(rowData.car)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="p-4 text-left font-medium text-n-1">
                                                        Full VideFace
                                                    </td>
                                                    <td className="p-4">{renderValue(rowData.all)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function renderValue(value) {
    if (value === "true") {
        return <IconCheck />;
    } else if (value === "false") {
        return "-";
    } else {
        return value.toString();
    }
}

function IconCheck() {
    return (
        <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none">
                <path
                    fill="#1489FF"
                    d="M10 1.667A8.336 8.336 0 0 0 1.667 10c0 4.6 3.733 8.333 8.333 8.333S18.333 14.6 18.333 10 14.6 1.667 10 1.667m-1.667 12.5L4.167 10l1.175-1.175 2.991 2.983 6.325-6.325 1.175 1.184z"
                ></path>
            </svg>
        </div>
    );
}
