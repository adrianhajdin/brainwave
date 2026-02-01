import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Notification from "../Notification";

vi.mock("../../assets", () => ({
  notification1: "notification1.png",
}));

vi.mock("../../constants", () => ({
  notificationImages: ["avatar1.png", "avatar2.png", "avatar3.png"],
}));

describe("Notification", () => {
  it("renders the title", () => {
    render(<Notification title="Code generation" />);
    expect(screen.getByText("Code generation")).toBeInTheDocument();
  });

  it("renders the main notification image", () => {
    render(<Notification title="Test" />);
    const img = screen.getByAltText("image");
    expect(img).toHaveAttribute("src", "notification1.png");
  });

  it("renders all notification avatar images", () => {
    render(<Notification title="Test" />);
    const listItems = document.querySelectorAll("ul li");
    expect(listItems).toHaveLength(3);
  });

  it("renders timestamp text", () => {
    render(<Notification title="Test" />);
    expect(screen.getByText("1m ago")).toBeInTheDocument();
  });

  it("applies className prop", () => {
    const { container } = render(<Notification title="Test" className="custom" />);
    expect(container.firstChild.className).toContain("custom");
  });
});
