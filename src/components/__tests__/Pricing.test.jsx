import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Pricing from "../Pricing";

vi.mock("../Section", () => ({
  default: ({ children, id }) => <div data-testid="section" id={id}>{children}</div>,
}));

vi.mock("../Heading", () => ({
  default: ({ tag, title }) => (
    <div data-testid="heading">
      <span>{tag}</span>
      <h2>{title}</h2>
    </div>
  ),
}));

vi.mock("../PricingList", () => ({
  default: () => <div data-testid="pricing-list" />,
}));

vi.mock("../design/Pricing", () => ({
  LeftLine: () => <div data-testid="left-line" />,
  RightLine: () => <div data-testid="right-line" />,
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

describe("Pricing", () => {
  it("renders the section with pricing id", () => {
    render(<Pricing />);
    expect(document.getElementById("pricing")).toBeInTheDocument();
  });

  it("renders the heading with correct tag and title", () => {
    render(<Pricing />);
    expect(screen.getByText("Get started with Brainwave")).toBeInTheDocument();
    expect(screen.getByText("Pay once, use forever")).toBeInTheDocument();
  });

  it("renders the PricingList component", () => {
    render(<Pricing />);
    expect(screen.getByTestId("pricing-list")).toBeInTheDocument();
  });

  it("renders the 'See the full details' link", () => {
    render(<Pricing />);
    const link = screen.getByText("See the full details");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/pricing");
  });

  it("renders decorative line components", () => {
    render(<Pricing />);
    expect(screen.getByTestId("left-line")).toBeInTheDocument();
    expect(screen.getByTestId("right-line")).toBeInTheDocument();
  });
});
