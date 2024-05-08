import React from "react";
import PropTypes from "prop-types";
import Tooltip from "./Tooltip";

export default function Table({ data }) {
    return (
        <div className="mb-32">
            <div className="grid grid-cols-4 gap-6 m-4">
                <div className="col-span-1">
                    <h2 className="text-color-1 ml-4 font-bold text-xl">{data.title.text}</h2>
                </div>
            </div>

            {Object.entries(data.elements).map(([key, element], index) => (
                <div
                    key={key}
                    className={`grid grid-cols-4 gap-6 m-4 ${index % 2 === 0 ? "bg-[#F0F8FE] rounded-md" : ""}`}
                >
                    <div className="col-span-1 p-4 flex justify-between">
                        <div>{element.name}</div>
                        <div className="flex items-center">
                            <Tooltip content={element.description}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none">
                                    <path
                                        fill="#A8AFBD"
                                        d="M7.333 4.667h1.334V6H7.333zm0 2.666h1.334v4H7.333zm.667-6A6.67 6.67 0 0 0 1.333 8 6.67 6.67 0 0 0 8 14.667 6.67 6.67 0 0 0 14.667 8 6.67 6.67 0 0 0 8 1.333m0 12A5.34 5.34 0 0 1 2.667 8 5.34 5.34 0 0 1 8 2.667 5.34 5.34 0 0 1 13.333 8 5.34 5.34 0 0 1 8 13.333"
                                    />
                                </svg>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="col-span-1 flex justify-center items-center">{renderValue(element.call)}</div>
                    <div className="col-span-1 flex justify-center items-center">{renderValue(element.car)}</div>
                    <div className="col-span-1 flex justify-center items-center">{renderValue(element.all)}</div>
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

Table.propTypes = {
    data: PropTypes.shape({
        title: PropTypes.shape({
            text: PropTypes.string.isRequired,
        }),
        elements: PropTypes.object.isRequired,
    }).isRequired,
};
