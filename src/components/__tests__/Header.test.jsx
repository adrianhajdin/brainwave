import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Header from "../Header";

vi.mock("scroll-lock", () => ({
  disablePageScroll: vi.fn(),
  enablePageScroll: vi.fn(),
}));

vi.mock("../../assets", () => ({
  logo: "logo.svg",
  discordBlack: "discord.svg",
  twitter: "twitter.svg",
}));

vi.mock("../../assets/svg/MenuSvg", () => ({
  default: ({ openNavigation }) => (
    <span data-testid="menu-svg" data-open={String(openNavigation)} />
  ),
}));

vi.mock("../Button", () => ({
  default: ({ children, onClick, className, href }) => (
    <button data-testid="button" onClick={onClick} className={className} data-href={href}>
      {children}
    </button>
  ),
}));

vi.mock("../design/Header", () => ({
  HamburgerMenu: () => <div data-testid="hamburger-menu" />,
}));

const renderHeader = (initialRoute = "/") =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Header />
    </MemoryRouter>
  );

describe("Header", () => {
  it("renders the SunRegen logo", () => {
    renderHeader();
    expect(screen.getByAltText("SunRegen Healthcare")).toBeInTheDocument();
  });

  it("renders navigation items from constants", () => {
    renderHeader();
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText("Science")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    const investorsElements = screen.getAllByText("Investors");
    expect(investorsElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Investors and Contact Us links", () => {
    renderHeader();
    const investorsElements = screen.getAllByText("Investors");
    expect(investorsElements.length).toBeGreaterThanOrEqual(1);
    const contactButtons = screen.getAllByText("Contact Us");
    expect(contactButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("toggles mobile navigation on hamburger click", () => {
    renderHeader();
    const buttons = screen.getAllByTestId("button");
    const hamburger = buttons.find((btn) => btn.querySelector("[data-testid='menu-svg']"));

    const nav = document.querySelector("nav");
    expect(nav.className).toContain("hidden");

    fireEvent.click(hamburger);
    expect(nav.className).toContain("flex");

    fireEvent.click(hamburger);
    expect(nav.className).toContain("hidden");
  });

  it("closes navigation when a nav link is clicked", () => {
    renderHeader();
    const buttons = screen.getAllByTestId("button");
    const hamburger = buttons.find((btn) => btn.querySelector("[data-testid='menu-svg']"));

    fireEvent.click(hamburger);
    const nav = document.querySelector("nav");
    expect(nav.className).toContain("flex");

    fireEvent.click(screen.getByText("About"));
    expect(nav.className).toContain("hidden");
  });

  it("renders the hamburger menu design component", () => {
    renderHeader();
    expect(screen.getByTestId("hamburger-menu")).toBeInTheDocument();
  });
});
