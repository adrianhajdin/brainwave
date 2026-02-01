import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../../App";

vi.mock("../Header", () => ({
  default: () => <div data-testid="header">Header</div>,
}));

vi.mock("../Hero", () => ({
  default: () => <div data-testid="hero">Hero</div>,
}));

vi.mock("../ValueProposition", () => ({
  default: () => <div data-testid="value-proposition">ValueProposition</div>,
}));

vi.mock("../Pipeline", () => ({
  default: () => <div data-testid="pipeline">Pipeline</div>,
}));

vi.mock("../Milestones", () => ({
  default: () => <div data-testid="milestones">Milestones</div>,
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
    expect(screen.getByTestId("value-proposition")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline")).toBeInTheDocument();
    expect(screen.getByTestId("milestones")).toBeInTheDocument();
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
      "value-proposition",
      "pipeline",
      "milestones",
      "footer",
    ]);
  });
});
