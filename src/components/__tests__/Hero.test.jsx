import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Hero from "../Hero";

vi.mock("../Section", () => ({
  default: ({ children, id }) => <div data-testid="section" id={id}>{children}</div>,
}));

vi.mock("../Button", () => ({
  default: ({ children, href, white }) => (
    <a data-testid="hero-button" href={href} data-white={String(!!white)}>
      {children}
    </a>
  ),
}));

vi.mock("../design/Hero", () => ({
  BottomLine: () => <div data-testid="bottom-line" />,
}));

describe("Hero", () => {
  it("renders the section with hero id", () => {
    render(<Hero />);
    expect(document.getElementById("hero")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<Hero />);
    expect(screen.getByText("SunRegen Healthcare")).toBeInTheDocument();
  });

  it("renders the main heading", () => {
    render(<Hero />);
    expect(
      screen.getByText("Advancing Neuroprotective Therapies for Retinal Degeneration")
    ).toBeInTheDocument();
  });

  it("renders the body text", () => {
    render(<Hero />);
    expect(
      screen.getByText(/first-in-class treatments targeting/)
    ).toBeInTheDocument();
  });

  it("renders View Our Science button", () => {
    render(<Hero />);
    const buttons = screen.getAllByTestId("hero-button");
    const scienceButton = buttons.find((b) => b.textContent === "View Our Science");
    expect(scienceButton).toBeInTheDocument();
    expect(scienceButton).toHaveAttribute("href", "#science");
  });

  it("renders Pipeline Overview button as white variant", () => {
    render(<Hero />);
    const buttons = screen.getAllByTestId("hero-button");
    const pipelineButton = buttons.find((b) => b.textContent === "Pipeline Overview");
    expect(pipelineButton).toBeInTheDocument();
    expect(pipelineButton).toHaveAttribute("data-white", "true");
  });

  it("renders BottomLine decoration", () => {
    render(<Hero />);
    expect(screen.getByTestId("bottom-line")).toBeInTheDocument();
  });
});
