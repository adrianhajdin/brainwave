import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Footer from "../Footer";

vi.mock("../Section", () => ({
  default: ({ children }) => <div data-testid="section">{children}</div>,
}));

vi.mock("../../constants", () => ({
  socials: [
    { id: "0", title: "Discord", iconUrl: "discord.svg", url: "https://discord.com" },
    { id: "1", title: "Twitter", iconUrl: "twitter.svg", url: "https://twitter.com" },
    { id: "2", title: "Instagram", iconUrl: "instagram.svg", url: "https://instagram.com" },
  ],
}));

describe("Footer", () => {
  it("renders copyright with current year", () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${year}`))).toBeInTheDocument();
  });

  it("renders all rights reserved text", () => {
    render(<Footer />);
    expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
  });

  it("renders all social links", () => {
    render(<Footer />);
    const links = document.querySelectorAll("a[target='_blank']");
    expect(links).toHaveLength(3);
  });

  it("social links have correct href values", () => {
    render(<Footer />);
    const links = document.querySelectorAll("a[target='_blank']");
    expect(links[0]).toHaveAttribute("href", "https://discord.com");
    expect(links[1]).toHaveAttribute("href", "https://twitter.com");
    expect(links[2]).toHaveAttribute("href", "https://instagram.com");
  });

  it("renders social icon images with alt text", () => {
    render(<Footer />);
    expect(screen.getByAltText("Discord")).toBeInTheDocument();
    expect(screen.getByAltText("Twitter")).toBeInTheDocument();
    expect(screen.getByAltText("Instagram")).toBeInTheDocument();
  });
});
