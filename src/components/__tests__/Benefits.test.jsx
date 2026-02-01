import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Benefits from "../Benefits";

vi.mock("../Section", () => ({
  default: ({ children, id }) => <div data-testid="section" id={id}>{children}</div>,
}));

vi.mock("../Heading", () => ({
  default: ({ title, className }) => <h2 data-testid="heading">{title}</h2>,
}));

vi.mock("../../assets/svg/Arrow", () => ({
  default: () => <span data-testid="arrow" />,
}));

vi.mock("../design/Benefits", () => ({
  GradientLight: () => <div data-testid="gradient-light" />,
}));

vi.mock("../../assets/svg/ClipPath", () => ({
  default: () => <svg data-testid="clip-path" />,
}));

vi.mock("../../constants", () => ({
  benefits: [
    {
      id: "0",
      title: "Ask anything",
      text: "Quick answers",
      backgroundUrl: "card-1.svg",
      iconUrl: "icon1.svg",
      imageUrl: "image1.png",
    },
    {
      id: "1",
      title: "Improve everyday",
      text: "NLP processing",
      backgroundUrl: "card-2.svg",
      iconUrl: "icon2.svg",
      imageUrl: "image2.png",
      light: true,
    },
    {
      id: "2",
      title: "Connect everywhere",
      text: "Any device",
      backgroundUrl: "card-3.svg",
      iconUrl: "icon3.svg",
      imageUrl: null,
    },
  ],
}));

describe("Benefits", () => {
  it("renders the section with features id", () => {
    render(<Benefits />);
    expect(document.getElementById("features")).toBeInTheDocument();
  });

  it("renders the heading", () => {
    render(<Benefits />);
    expect(screen.getByTestId("heading")).toHaveTextContent("Chat Smarter, Not Harder with Brainwave");
  });

  it("renders correct number of benefit cards", () => {
    render(<Benefits />);
    const titles = ["Ask anything", "Improve everyday", "Connect everywhere"];
    titles.forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it("renders benefit descriptions", () => {
    render(<Benefits />);
    expect(screen.getByText("Quick answers")).toBeInTheDocument();
    expect(screen.getByText("NLP processing")).toBeInTheDocument();
  });

  it("renders Explore more text for each card", () => {
    render(<Benefits />);
    const exploreTexts = screen.getAllByText("Explore more");
    expect(exploreTexts).toHaveLength(3);
  });

  it("renders GradientLight only for items with light=true", () => {
    render(<Benefits />);
    const gradients = screen.getAllByTestId("gradient-light");
    expect(gradients).toHaveLength(1);
  });

  it("renders icon images for each benefit", () => {
    render(<Benefits />);
    const icons = screen.getAllByAltText(/Ask anything|Improve everyday|Connect everywhere/);
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });
});
