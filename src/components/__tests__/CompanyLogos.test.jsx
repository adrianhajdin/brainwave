import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CompanyLogos from "../CompanyLogos";

vi.mock("../../constants", () => ({
  companyLogos: ["logo1.png", "logo2.png", "logo3.png", "logo4.png", "logo5.png"],
}));

describe("CompanyLogos", () => {
  it("renders the tagline text", () => {
    render(<CompanyLogos />);
    expect(screen.getByText("Helping people create beautiful content at")).toBeInTheDocument();
  });

  it("renders all company logos", () => {
    render(<CompanyLogos />);
    const listItems = document.querySelectorAll("ul li");
    expect(listItems).toHaveLength(5);
  });

  it("renders logo images with correct dimensions", () => {
    render(<CompanyLogos />);
    const images = document.querySelectorAll("ul li img");
    images.forEach((img) => {
      expect(img).toHaveAttribute("width", "134");
      expect(img).toHaveAttribute("height", "28");
    });
  });

  it("applies className prop", () => {
    const { container } = render(<CompanyLogos className="test-class" />);
    expect(container.firstChild.className).toContain("test-class");
  });
});
