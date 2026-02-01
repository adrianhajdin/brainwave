import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Button from "../Button";

vi.mock("../../assets/svg/ButtonSvg", () => ({
  default: (white) => <span data-testid="button-svg" data-white={String(!!white)} />,
}));

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("renders as a button element when no href is provided", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders as an anchor element when href is provided", () => {
    render(<Button href="/test">Link</Button>);
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
  });

  it("calls onClick handler when clicked as button", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies white text class when white prop is true", () => {
    render(<Button white>White</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("text-n-8");
    expect(button.className).not.toContain("text-n-1");
  });

  it("applies default text class when white prop is false", () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("text-n-1");
  });

  it("uses default px-7 padding when px prop is not provided", () => {
    render(<Button>Default padding</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("px-7");
  });

  it("uses custom padding when px prop is provided", () => {
    render(<Button px="px-3">Custom padding</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("px-3");
    expect(button.className).not.toContain("px-7");
  });

  it("applies additional className", () => {
    render(<Button className="my-class">Styled</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("my-class");
  });

  it("renders ButtonSvg component", () => {
    render(<Button>With SVG</Button>);
    expect(screen.getByTestId("button-svg")).toBeInTheDocument();
  });
});
