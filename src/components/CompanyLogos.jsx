import { companyLogos } from "../constants";

const CompanyLogos = ({ className }) => {
  return (
    <div className={className}>
      <h5 className="tagline mb-4 text-center text-n-6 font-bold text-lg">
        Since 2020, we are the world's first fully virtual car rental company.
      </h5>
      <ul className="flex">
        {companyLogos.map((logo, index) => (
          <li
            className="flex items-center justify-center flex-1 h-[8.5rem]"
            key={index}
          >
            <img src={logo} width={156} height={32} alt={logo} />
          </li>
        ))}
      </ul>
      <h5 className="tagline mb-4 mt-4 text-center text-n-1 font-bold">
        Your company soon.
      </h5>
    </div>
  );
};

export default CompanyLogos;
