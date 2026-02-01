import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ValueProposition from "../ValueProposition";

vi.mock("../Section", () => ({
  default: ({ children, id }) => <div data-testid="section" id={id}>{children}</div>,
}));

vi.mock("../Heading", () => ({
  default: ({ title }) => <h2 data-testid="heading">{title}</h2>,
}));

vi.mock("../../constants", () => ({
  valueProps: [
    { id: "0", title: "Novel Mechanism", text: "Cellular pathways for neuronal survival" },
    { id: "1", title: "Validated Science", text: "Preservation of retinal structure" },
    { id: "2", title: "Broad Potential", text: "Expansion across neurodegenerative indications" },
  ],
}));

describe("ValueProposition", () => {
  it("renders the section with about id", () => {
    render(<ValueProposition />);
    expect(document.getElementById("about")).toBeInTheDocument();
  });

  it("renders the heading", () => {
    render(<ValueProposition />);
    expect(screen.getByTestId("heading")).toHaveTextContent(
      "Targeting Neuronal Survival at the Cellular Level"
    );
  });

  it("renders the introductory text about neurons", () => {
    render(<ValueProposition />);
    expect(screen.getByText(/99\.9% of neurons persist/)).toBeInTheDocument();
  });

  it("renders all three value proposition cards", () => {
    render(<ValueProposition />);
    expect(screen.getByText("Novel Mechanism")).toBeInTheDocument();
    expect(screen.getByText("Validated Science")).toBeInTheDocument();
    expect(screen.getByText("Broad Potential")).toBeInTheDocument();
  });

  it("renders descriptions for each card", () => {
    render(<ValueProposition />);
    expect(screen.getByText("Cellular pathways for neuronal survival")).toBeInTheDocument();
    expect(screen.getByText("Preservation of retinal structure")).toBeInTheDocument();
    expect(screen.getByText("Expansion across neurodegenerative indications")).toBeInTheDocument();
  });
});
