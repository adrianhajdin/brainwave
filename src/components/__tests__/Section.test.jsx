import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Section from "../Section";

vi.mock("../../assets/svg/SectionSvg", () => ({
  default: ({ crossesOffset }) => (
    <div data-testid="section-svg" data-offset={crossesOffset} />
  ),
}));

describe("Section", () => {
  it("renders children", () => {
    render(<Section><p>Child content</p></Section>);
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("sets id attribute", () => {
    const { container } = render(<Section id="test-section">Content</Section>);
    expect(container.firstChild).toHaveAttribute("id", "test-section");
  });

  it("applies className prop", () => {
    const { container } = render(<Section className="custom">Content</Section>);
    expect(container.firstChild.className).toContain("custom");
  });

  it("renders crosses when crosses prop is true", () => {
    render(<Section crosses>Content</Section>);
    expect(screen.getByTestId("section-svg")).toBeInTheDocument();
  });

  it("does not render crosses when crosses prop is false", () => {
    render(<Section>Content</Section>);
    expect(screen.queryByTestId("section-svg")).not.toBeInTheDocument();
  });

  it("passes crossesOffset to SectionSvg", () => {
    render(<Section crosses crossesOffset="lg:translate-y-10">Content</Section>);
    expect(screen.getByTestId("section-svg")).toHaveAttribute("data-offset", "lg:translate-y-10");
  });

  it("uses custom paddings when provided", () => {
    const { container } = render(<Section customPaddings="py-5">Content</Section>);
    expect(container.firstChild.className).toContain("py-5");
    expect(container.firstChild.className).not.toContain("py-10");
  });

  it("uses default paddings when customPaddings is not provided", () => {
    const { container } = render(<Section>Content</Section>);
    expect(container.firstChild.className).toContain("py-10");
  });

  it("includes extra padding classes when crosses is true and no custom paddings", () => {
    const { container } = render(<Section crosses>Content</Section>);
    expect(container.firstChild.className).toContain("lg:py-32");
  });
});
