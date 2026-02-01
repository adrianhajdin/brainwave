import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Header from "../Header";

vi.mock("scroll-lock", () => ({
  disablePageScroll: vi.fn(),
  enablePageScroll: vi.fn(),
}));

vi.mock("../../assets", () => ({
  brainwave: "brainwave.svg", check: "check.svg", check2: "check2.svg",
  loading1: "loading1.svg", brainwaveSymbol: "brainwaveSymbol.svg",
  brainwaveWhiteSymbol: "brainwaveWhiteSymbol.svg", play: "play.svg",
  gradient: "gradient.png", smallSphere: "smallSphere.png", grid: "grid.png",
  yourlogo: "yourlogo.svg", homeSmile: "homeSmile.svg", file02: "file02.svg",
  searchMd: "searchMd.svg", plusSquare: "plusSquare.svg",
  recording03: "recording03.svg", recording01: "recording01.svg",
  disc02: "disc02.svg", chromecast: "chromecast.svg", sliders04: "sliders04.svg",
  loading: "loading.png", background: "background.jpg",
  curve: "curve.png", robot: "robot.jpg", heroBackground: "heroBackground.jpg",
  curve1: "curve1.svg", curve2: "curve2.svg",
  discord: "discord.png", figma: "figma.png", framer: "framer.png",
  notion: "notion.png", photoshop: "photoshop.png", protopie: "protopie.png",
  raindrop: "raindrop.png", slack: "slack.png",
  service1: "service1.png", service2: "service2.png", service3: "service3.png",
  lines: "lines.svg", stars: "stars.svg",
  coins: "coins.png", done: "done.svg", hero: "hero.png",
  roadmap1: "roadmap1.png", roadmap2: "roadmap2.png",
  roadmap3: "roadmap3.png", roadmap4: "roadmap4.png", undone: "undone.svg",
  notification1: "notification1.png", notification2: "notification2.png",
  notification3: "notification3.png", notification4: "notification4.png",
  benefitCard1: "benefitCard1.svg", benefitCard2: "benefitCard2.svg",
  benefitCard3: "benefitCard3.svg", benefitCard4: "benefitCard4.svg",
  benefitCard5: "benefitCard5.svg", benefitCard6: "benefitCard6.svg",
  benefitIcon1: "benefitIcon1.svg", benefitIcon2: "benefitIcon2.svg",
  benefitIcon3: "benefitIcon3.svg", benefitIcon4: "benefitIcon4.svg",
  benefitImage2: "benefitImage2.png",
  discordBlack: "discordBlack.svg", facebook: "facebook.svg",
  instagram: "instagram.svg", telegram: "telegram.svg", twitter: "twitter.svg",
}));

vi.mock("../../assets/svg/MenuSvg", () => ({
  default: ({ openNavigation }) => (
    <span data-testid="menu-svg" data-open={String(openNavigation)} />
  ),
}));

vi.mock("../Button", () => ({
  default: ({ children, onClick, className, href, px }) => (
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
  it("renders the brainwave logo", () => {
    renderHeader();
    expect(screen.getByAltText("Brainwave")).toBeInTheDocument();
  });

  it("renders navigation items from constants", () => {
    renderHeader();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("How to use")).toBeInTheDocument();
    expect(screen.getByText("Roadmap")).toBeInTheDocument();
  });

  it("renders New account and Sign in links", () => {
    renderHeader();
    const newAccountLinks = screen.getAllByText("New account");
    expect(newAccountLinks.length).toBeGreaterThanOrEqual(1);
    const signInLinks = screen.getAllByText("Sign in");
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("toggles mobile navigation on hamburger click", () => {
    renderHeader();
    const buttons = screen.getAllByTestId("button");
    const hamburger = buttons.find((btn) => btn.querySelector("[data-testid='menu-svg']"));

    // Initially nav should be hidden
    const nav = document.querySelector("nav");
    expect(nav.className).toContain("hidden");

    // Click hamburger to open
    fireEvent.click(hamburger);
    expect(nav.className).toContain("flex");

    // Click again to close
    fireEvent.click(hamburger);
    expect(nav.className).toContain("hidden");
  });

  it("closes navigation when a nav link is clicked", () => {
    renderHeader();
    const buttons = screen.getAllByTestId("button");
    const hamburger = buttons.find((btn) => btn.querySelector("[data-testid='menu-svg']"));

    // Open nav
    fireEvent.click(hamburger);
    const nav = document.querySelector("nav");
    expect(nav.className).toContain("flex");

    // Click a nav link
    fireEvent.click(screen.getByText("Features"));
    expect(nav.className).toContain("hidden");
  });

  it("renders the hamburger menu design component", () => {
    renderHeader();
    expect(screen.getByTestId("hamburger-menu")).toBeInTheDocument();
  });
});
