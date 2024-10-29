import ButtonSvg from "../assets/svg/ButtonSvg";

import telegramIcon from "../assets/telegram_icon.webp";

const Button = ({ className, href, onClick, children, px, white }) => {
  const classes = `button relative inline-flex items-center justify-center h-11 transition-colors hover:text-color-1 ${
    px || "px-7"
  } ${white ? "text-n-8" : "text-n-1"} ${className || ""}`;
  const spanClasses = "relative z-10";

  const renderButton = () => (
    <button className={classes} onClick={onClick}>
      <img src={telegramIcon} alt="Telegram" className="w-10 h-10 mr-2" /> {/* Adjust size as needed */}
      <span className={spanClasses}>{children}</span>
      {ButtonSvg(white)}
    </button>
  );

  const renderLink = () => (
    // <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
    <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
      <img src={telegramIcon} alt="Telegram" className="w-10 h-10 mr-1 -m-2" /> {/* Adjust size as needed */}
      <span className={spanClasses}>{children}</span>
      {ButtonSvg(white)}
    </a>
  );

  return href ? renderLink() : renderButton();
};

export default Button;
