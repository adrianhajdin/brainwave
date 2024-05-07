import React from "react";

export default function Table({ data }) {
    return (
        <div className="mb-16">
            <div className="grid grid-cols-4 gap-6 m-4">
                <div className="col-span-1">
                    <h2 className="text-color-1 ml-4 font-bold">{data.title.text}</h2>
                </div>
            </div>

            {Object.entries(data.elements).map(([key, element], index) => (
                <div
                    key={key}
                    className={`grid grid-cols-4 gap-6 m-4 ${index % 2 === 0 ? "bg-[#F0F8FE] rounded-md" : ""}`}
                >
                    <div className="col-span-1 p-4">{element.description}</div>
                    <div className="col-span-1 flex justify-center p-4">
                        {element.call === "true" ? <IconCheck /> : "-"}
                    </div>
                    <div className="col-span-1 flex justify-center p-4">
                        {element.all === "true" ? <IconCheck /> : "-"}
                    </div>
                    <div className="col-span-1 flex justify-center p-4">
                        {element.car === "true" ? <IconCheck /> : "-"}
                    </div>
                </div>
            ))}
        </div>
    );
}

function IconCheck() {
    return <span>&#10003;</span>;
}
