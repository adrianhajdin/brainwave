import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Heading from "../Heading";

vi.mock("../Tagline", () => ({
  default: ({ children, className }) => (
    <div data-testid="tagline" className={className}>{children}</div>
  ),
}));

describe("Heading", () => {
  it("renders title when provided", () => {
    render(<Heading title="Test Title" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Test Title");
  });

  it("does not render h2 when title is not provided", () => {
    render(<Heading />);
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders text when provided", () => {
    render(<Heading text="Some body text" />);
    expect(screen.getByText("Some body text")).toBeInTheDocument();
  });

  it("does not render paragraph when text is not provided", () => {
    render(<Heading title="Title Only" />);
    const paragraphs = document.querySelectorAll("p");
    expect(paragraphs).toHaveLength(0);
  });

  it("renders TagLine when tag is provided", () => {
    render(<Heading tag="My Tag" />);
    expect(screen.getByTestId("tagline")).toHaveTextContent("My Tag");
  });

  it("does not render TagLine when tag is not provided", () => {
    render(<Heading title="No Tag" />);
    expect(screen.queryByTestId("tagline")).not.toBeInTheDocument();
  });

  it("renders all elements when all props are provided", () => {
    render(<Heading tag="Tag" title="Title" text="Text" />);
    expect(screen.getByTestId("tagline")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
  });

  it("applies className prop", () => {
    const { container } = render(<Heading className="custom-class" title="T" />);
    expect(container.firstChild.className).toContain("custom-class");
  });
});
