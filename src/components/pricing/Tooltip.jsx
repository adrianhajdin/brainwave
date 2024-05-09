import React from "react";

const Tooltip = ({ content, children }) => {
    const [showTooltip, setShowTooltip] = React.useState(false);

    const handleMouseEnter = () => {
        setShowTooltip(true);
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    return (
        <div className="relative">
            <span onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                {children}
            </span>
            {showTooltip && (
                <div className="absolute z-10 top-0 left-0 p-4 bg-n-5 text-white text-center rounded-md w-[15rem] lg:w-[23rem] text-xs lg:text-sm transform -translate-x-[100%] lg:-translate-x-[48%] -translate-y-full lg:-translate-y-[120%]">
                    {content}
                    <div className="bg-n-5 rounded-sm bottom-[-8px] h-5 left-[50%] ml-[-10px] absolute rotate-45 w-5 z-2 hidden lg:block"></div>
                </div>
            )}
        </div>
    );
};

export default Tooltip;
