import { check } from "../assets";
import { pricing } from "../constants";
import Button from "./Button";

const PricingList = () => {
  return (
    <div className="flex gap-[1rem] max-lg:flex-wrap">
      {pricing.map((item) => (
        <div
          key={item.id}
          className="w-[19rem] max-lg:w-full h-full px-6 bg-n-8 border border-n-6 rounded-[2rem] lg:w-auto even:py-14 odd:py-8 odd:my-4 [&>h4]:first:text-color-4 [&>h4]:even:text-color-1 [&>h4]:last:text-color-5"
        >
          <h4 className="h4 mb-4">{item.title}</h4>

          <p className="body-3 min-h-[4rem] text-n-1">
            {item.description}
          </p>

          <div className="flex items-center h-[1.5rem] mb-8">
            {item.price1 && (
              <>
                <div className="text-[2rem] leading-none font-bold">
                  {item.price1}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center h-[1.5rem] mb-8">
            {item.price2 && (
              <>
                <div className="text-[2rem] leading-none font-bold">
                  {item.price2}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center h-[1.5rem] mb-2">
            {item.price3 && (
              <>
                <div className="text-[2rem] leading-none font-bold">
                  {item.price3}
                </div>
              </>
            )}
          </div>

          <Button
            className="w-full mb-6 mt-8"
            href={item.price ? "/pricing" : "#contact"}
            white={!!item.price}
          >
            {item.price ? "Get started" : "Contact us"}
          </Button>

          <ul>
            {item.features.map((feature, index) => (
              <li
                key={index}
                className="flex items-start py-5 border-t border-n-6"
              >
                <img src={check} width={24} height={24} alt="Check" />
                <p className="body-2 ml-4">{feature}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default PricingList;
