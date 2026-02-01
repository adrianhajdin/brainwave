import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../../App";

// Mock all section components to simple stubs
vi.mock("../Header", () => ({
  default: () => <div data-testid="header">Header</div>,
}));

vi.mock("../Hero", () => ({
  default: () => <div data-testid="hero">Hero</div>,
}));

vi.mock("../Benefits", () => ({
  default: () => <div data-testid="benefits">Benefits</div>,
}));

vi.mock("../Collaboration", () => ({
  default: () => <div data-testid="collaboration">Collaboration</div>,
}));

vi.mock("../Services", () => ({
  default: () => <div data-testid="services">Services</div>,
}));

vi.mock("../Pricing", () => ({
  default: () => <div data-testid="pricing">Pricing</div>,
}));

vi.mock("../Roadmap", () => ({
  default: () => <div data-testid="roadmap">Roadmap</div>,
}));

vi.mock("../Footer", () => ({
  default: () => <div data-testid="footer">Footer</div>,
}));

vi.mock("../../assets/svg/ButtonGradient", () => ({
  default: () => <svg data-testid="button-gradient" />,
}));

describe("App", () => {
  const renderApp = () =>
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

  it("renders all major sections", () => {
    renderApp();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("hero")).toBeInTheDocument();
    expect(screen.getByTestId("benefits")).toBeInTheDocument();
    expect(screen.getByTestId("collaboration")).toBeInTheDocument();
    expect(screen.getByTestId("services")).toBeInTheDocument();
    expect(screen.getByTestId("pricing")).toBeInTheDocument();
    expect(screen.getByTestId("roadmap")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("renders ButtonGradient SVG", () => {
    renderApp();
    expect(screen.getByTestId("button-gradient")).toBeInTheDocument();
  });

  it("renders sections in correct order", () => {
    renderApp();
    const container = document.querySelector(".overflow-hidden");
    const children = Array.from(container.children);
    const testIds = children.map((c) => c.getAttribute("data-testid"));
    expect(testIds).toEqual([
      "header",
      "hero",
      "benefits",
      "collaboration",
      "services",
      "pricing",
      "roadmap",
      "footer",
    ]);
  });
});
