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
                <div
                    className="absolute z-10 top-0 left-0 p-4 bg-white rounded-md shadow-md w-[10rem]"
                    style={{
                        transform: "translateY(-100%)",
                    }}
                >
                    {content}
                </div>
            )}
        </div>
    );
};

export default Tooltip;
