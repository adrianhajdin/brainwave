import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Generating from "../Generating";

vi.mock("../../assets", () => ({
  loading: "loading.svg",
}));

describe("Generating", () => {
  it("renders the loading text", () => {
    render(<Generating />);
    expect(screen.getByText("AI is generating")).toBeInTheDocument();
  });

  it("renders the loading image", () => {
    render(<Generating />);
    const img = screen.getByAltText("Loading");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "loading.svg");
  });

  it("applies className prop", () => {
    const { container } = render(<Generating className="extra-class" />);
    expect(container.firstChild.className).toContain("extra-class");
  });

  it("has base classes without className", () => {
    const { container } = render(<Generating />);
    expect(container.firstChild.className).toContain("flex");
    expect(container.firstChild.className).toContain("items-center");
  });
});
