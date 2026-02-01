import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Collaboration from "../Collaboration";

vi.mock("../Section", () => ({
  default: ({ children }) => <div data-testid="section">{children}</div>,
}));

vi.mock("../Button", () => ({
  default: ({ children }) => <button data-testid="collab-button">{children}</button>,
}));

vi.mock("../design/Collaboration", () => ({
  LeftCurve: () => <div data-testid="left-curve" />,
  RightCurve: () => <div data-testid="right-curve" />,
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

vi.mock("../../constants", () => ({
  collabText: "Smart automation and top-notch security.",
  collabContent: [
    { id: "0", title: "Seamless Integration", text: "Smart automation and top-notch security." },
    { id: "1", title: "Smart Automation" },
    { id: "2", title: "Top-notch Security" },
  ],
  collabApps: [
    { id: "0", title: "Figma", icon: "figma.svg", width: 26, height: 36 },
    { id: "1", title: "Notion", icon: "notion.svg", width: 34, height: 36 },
    { id: "2", title: "Discord", icon: "discord.svg", width: 36, height: 28 },
  ],
}));

describe("Collaboration", () => {
  it("renders the heading", () => {
    render(<Collaboration />);
    expect(screen.getByText("AI Chat App for seamless collaboration")).toBeInTheDocument();
  });

  it("renders all collaboration content items", () => {
    render(<Collaboration />);
    expect(screen.getByText("Seamless Integration")).toBeInTheDocument();
    expect(screen.getByText("Smart Automation")).toBeInTheDocument();
    expect(screen.getByText("Top-notch Security")).toBeInTheDocument();
  });

  it("renders text only for items that have it", () => {
    render(<Collaboration />);
    const textElements = screen.getAllByText("Smart automation and top-notch security.");
    expect(textElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders check icons for each content item", () => {
    render(<Collaboration />);
    const checkIcons = screen.getAllByAltText("check");
    expect(checkIcons).toHaveLength(3);
  });

  it("renders Try it now button", () => {
    render(<Collaboration />);
    expect(screen.getByText("Try it now")).toBeInTheDocument();
  });

  it("renders collaboration app icons", () => {
    render(<Collaboration />);
    expect(screen.getByAltText("Figma")).toBeInTheDocument();
    expect(screen.getByAltText("Notion")).toBeInTheDocument();
    expect(screen.getByAltText("Discord")).toBeInTheDocument();
  });

  it("renders the brainwave symbol", () => {
    render(<Collaboration />);
    expect(screen.getByAltText("brainwave")).toBeInTheDocument();
  });

  it("renders decorative curves", () => {
    render(<Collaboration />);
    expect(screen.getByTestId("left-curve")).toBeInTheDocument();
    expect(screen.getByTestId("right-curve")).toBeInTheDocument();
  });
});
