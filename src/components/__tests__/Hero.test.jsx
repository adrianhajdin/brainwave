import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Hero from "../Hero";

vi.mock("../Section", () => ({
  default: ({ children, id }) => <div data-testid="section" id={id}>{children}</div>,
}));

vi.mock("../Button", () => ({
  default: ({ children, href, white }) => (
    <a data-testid="hero-button" href={href} data-white={String(!!white)}>
      {children}
    </a>
  ),
}));

vi.mock("../Generating", () => ({
  default: ({ className }) => <div data-testid="generating" className={className} />,
}));

vi.mock("../Notification", () => ({
  default: ({ title, className }) => (
    <div data-testid="notification" data-title={title} className={className} />
  ),
}));

vi.mock("../CompanyLogos", () => ({
  default: ({ className }) => <div data-testid="company-logos" className={className} />,
}));

vi.mock("../design/Hero", () => ({
  BackgroundCircles: () => <div data-testid="bg-circles" />,
  BottomLine: () => <div data-testid="bottom-line" />,
  Gradient: () => <div data-testid="gradient" />,
}));

vi.mock("react-just-parallax", () => ({
  ScrollParallax: ({ children }) => <div data-testid="scroll-parallax">{children}</div>,
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

vi.mock("../../assets/svg/PlusSvg", () => ({ default: () => null }));

vi.mock("../../constants", () => ({
  heroIcons: ["icon1.svg", "icon2.svg", "icon3.svg", "icon4.svg"],
}));

describe("Hero", () => {
  it("renders the section with hero id", () => {
    render(<Hero />);
    expect(document.getElementById("hero")).toBeInTheDocument();
  });

  it("renders the main heading text", () => {
    render(<Hero />);
    expect(screen.getByText(/Explore the Possibilities of/)).toBeInTheDocument();
  });

  it("renders Brainwave in the heading", () => {
    render(<Hero />);
    const brainwaveElements = screen.getAllByText(/Brainwave/);
    expect(brainwaveElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the body text", () => {
    render(<Hero />);
    expect(screen.getByText(/Unleash the power of AI within Brainwave/)).toBeInTheDocument();
  });

  it("renders Get started button with /pricing href", () => {
    render(<Hero />);
    const button = screen.getByTestId("hero-button");
    expect(button).toHaveTextContent("Get started");
    expect(button).toHaveAttribute("href", "/pricing");
  });

  it("renders the robot image", () => {
    render(<Hero />);
    expect(screen.getByAltText("AI")).toBeInTheDocument();
  });

  it("renders the Generating component", () => {
    render(<Hero />);
    expect(screen.getByTestId("generating")).toBeInTheDocument();
  });

  it("renders the Notification component with correct title", () => {
    render(<Hero />);
    const notification = screen.getByTestId("notification");
    expect(notification).toHaveAttribute("data-title", "Code generation");
  });

  it("renders hero icons inside ScrollParallax", () => {
    render(<Hero />);
    const parallaxContainers = screen.getAllByTestId("scroll-parallax");
    expect(parallaxContainers.length).toBeGreaterThanOrEqual(1);
  });

  it("renders CompanyLogos component", () => {
    render(<Hero />);
    expect(screen.getByTestId("company-logos")).toBeInTheDocument();
  });

  it("renders BackgroundCircles and BottomLine decorations", () => {
    render(<Hero />);
    expect(screen.getByTestId("bg-circles")).toBeInTheDocument();
    expect(screen.getByTestId("bottom-line")).toBeInTheDocument();
  });

  it("renders the curve image", () => {
    render(<Hero />);
    expect(screen.getByAltText("Curve")).toBeInTheDocument();
  });
});
