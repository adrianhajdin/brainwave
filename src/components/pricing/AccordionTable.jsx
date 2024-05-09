import React from "react";

export default function AccordionTable({ rowData }) {
    return (
        <div className="p-4">
            <table className="w-full table-auto">
                <th></th>
                <tbody>
                    <tr className="border-b">
                        <td className="w-3/5 p-4 text-left font-medium text-n-1 text-sm">VideFace Calls</td>
                        <td className="w-2/5 p-4">{renderValue(rowData.call)}</td>
                    </tr>
                    <tr className="border-b">
                        <td className="w-3/5 p-4 text-left font-medium text-n-1 text-sm">VideFace Cars</td>
                        <td className="w-2/5 p-4">{renderValue(rowData.car)}</td>
                    </tr>
                    <tr>
                        <td className="w-3/5 p-4 text-left font-medium text-n-1 text-sm">Full VideFace</td>
                        <td className="w-2/5 p-4">{renderValue(rowData.all)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function renderValue(value) {
    if (value === "true") {
        return <IconCheck />;
    } else if (value === "false") {
        return <div className="size-[20px] text-center">-</div>;
    } else {
        return value;
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
