import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PricingList from "../PricingList";

vi.mock("../../assets", () => ({
  check: "check.svg",
}));

vi.mock("../Button", () => ({
  default: ({ children, href, white }) => (
    <a data-testid="pricing-button" href={href} data-white={String(!!white)}>
      {children}
    </a>
  ),
}));

vi.mock("../../constants", () => ({
  pricing: [
    {
      id: "0",
      title: "Basic",
      description: "AI chatbot, personalized recommendations",
      price: "0",
      features: ["Feature A", "Feature B"],
    },
    {
      id: "1",
      title: "Premium",
      description: "Advanced AI chatbot, priority support",
      price: "9.99",
      features: ["Feature C", "Feature D", "Feature E"],
    },
    {
      id: "2",
      title: "Enterprise",
      description: "Custom AI chatbot, dedicated account",
      price: null,
      features: ["Feature F"],
    },
  ],
}));

describe("PricingList", () => {
  it("renders all pricing tiers", () => {
    render(<PricingList />);
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("renders descriptions for each tier", () => {
    render(<PricingList />);
    expect(screen.getByText("AI chatbot, personalized recommendations")).toBeInTheDocument();
    expect(screen.getByText("Advanced AI chatbot, priority support")).toBeInTheDocument();
    expect(screen.getByText("Custom AI chatbot, dedicated account")).toBeInTheDocument();
  });

  it("displays price with dollar sign for priced tiers", () => {
    render(<PricingList />);
    const dollarSigns = screen.getAllByText("$");
    expect(dollarSigns).toHaveLength(2);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("9.99")).toBeInTheDocument();
  });

  it("does not display price for Enterprise tier (null price)", () => {
    render(<PricingList />);
    const dollarSigns = screen.getAllByText("$");
    expect(dollarSigns).toHaveLength(2); // only Basic and Premium
  });

  it("shows 'Get started' for priced tiers and 'Contact us' for null price", () => {
    render(<PricingList />);
    const getStarted = screen.getAllByText("Get started");
    const contactUs = screen.getAllByText("Contact us");
    expect(getStarted).toHaveLength(2);
    expect(contactUs).toHaveLength(1);
  });

  it("sets correct href for pricing buttons", () => {
    render(<PricingList />);
    const buttons = screen.getAllByTestId("pricing-button");
    expect(buttons[0]).toHaveAttribute("href", "/pricing");
    expect(buttons[1]).toHaveAttribute("href", "/pricing");
    expect(buttons[2]).toHaveAttribute("href", "mailto:contact@jsmastery.pro");
  });

  it("renders all features across tiers", () => {
    render(<PricingList />);
    expect(screen.getByText("Feature A")).toBeInTheDocument();
    expect(screen.getByText("Feature B")).toBeInTheDocument();
    expect(screen.getByText("Feature C")).toBeInTheDocument();
    expect(screen.getByText("Feature D")).toBeInTheDocument();
    expect(screen.getByText("Feature E")).toBeInTheDocument();
    expect(screen.getByText("Feature F")).toBeInTheDocument();
  });

  it("renders check icons for each feature", () => {
    render(<PricingList />);
    const checkIcons = screen.getAllByAltText("Check");
    expect(checkIcons).toHaveLength(6);
  });
});
