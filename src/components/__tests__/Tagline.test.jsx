import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TagLine from "../Tagline";

vi.mock("../../assets/svg/Brackets", () => ({
  default: (position) => <span data-testid={`bracket-${position}`} />,
}));

describe("TagLine", () => {
  it("renders children content", () => {
    render(<TagLine>Hello World</TagLine>);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders left and right brackets", () => {
    render(<TagLine>Content</TagLine>);
    expect(screen.getByTestId("bracket-left")).toBeInTheDocument();
    expect(screen.getByTestId("bracket-right")).toBeInTheDocument();
  });

  it("applies className prop", () => {
    const { container } = render(<TagLine className="extra">Text</TagLine>);
    expect(container.firstChild.className).toContain("extra");
    expect(container.firstChild.className).toContain("tagline");
  });

  it("has default classes without className prop", () => {
    const { container } = render(<TagLine>Text</TagLine>);
    expect(container.firstChild.className).toContain("tagline");
    expect(container.firstChild.className).toContain("flex");
    expect(container.firstChild.className).toContain("items-center");
  });
});
