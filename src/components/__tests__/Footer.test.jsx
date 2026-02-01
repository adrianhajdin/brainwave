import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Footer from "../Footer";

vi.mock("../Section", () => ({
  default: ({ children }) => <div data-testid="section">{children}</div>,
}));

vi.mock("../../assets", () => ({
  logo: "logo.svg",
}));

vi.mock("../../constants", () => ({
  socials: [
    { id: "0", title: "LinkedIn", iconUrl: "linkedin.svg", url: "https://linkedin.com" },
    { id: "1", title: "Twitter", iconUrl: "twitter.svg", url: "https://twitter.com" },
  ],
}));

describe("Footer", () => {
  it("renders copyright with current year", () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${year}`))).toBeInTheDocument();
  });

  it("renders SunRegen Healthcare AG text", () => {
    render(<Footer />);
    const matches = screen.getAllByText(/SunRegen Healthcare AG/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all social links", () => {
    render(<Footer />);
    const links = document.querySelectorAll("a[target='_blank']");
    expect(links).toHaveLength(2);
  });

  it("social links have correct href values", () => {
    render(<Footer />);
    const links = document.querySelectorAll("a[target='_blank']");
    expect(links[0]).toHaveAttribute("href", "https://linkedin.com");
    expect(links[1]).toHaveAttribute("href", "https://twitter.com");
  });

  it("renders social icon images with alt text", () => {
    render(<Footer />);
    expect(screen.getByAltText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByAltText("Twitter")).toBeInTheDocument();
  });

  it("renders Quick Links column", () => {
    render(<Footer />);
    expect(screen.getByText("Quick Links")).toBeInTheDocument();
  });

  it("renders Legal column", () => {
    render(<Footer />);
    expect(screen.getByText("Legal")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByText("Terms of Use")).toBeInTheDocument();
  });

  it("renders Connect column", () => {
    render(<Footer />);
    expect(screen.getByText("Connect")).toBeInTheDocument();
  });

  it("renders forward-looking disclaimer", () => {
    render(<Footer />);
    expect(screen.getByText(/forward-looking statements/)).toBeInTheDocument();
  });

  it("renders Basel, Switzerland location", () => {
    render(<Footer />);
    expect(screen.getByText(/Basel, Switzerland/)).toBeInTheDocument();
  });
});
