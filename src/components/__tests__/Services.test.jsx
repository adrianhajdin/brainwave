import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Services from "../Services";

vi.mock("../Section", () => ({
  default: ({ children, id }) => <div data-testid="section" id={id}>{children}</div>,
}));

vi.mock("../Heading", () => ({
  default: ({ title, text }) => (
    <div data-testid="heading">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  ),
}));

vi.mock("../Generating", () => ({
  default: ({ className }) => <div data-testid="generating" className={className} />,
}));

vi.mock("../design/Services", () => ({
  PhotoChatMessage: () => <div data-testid="photo-chat" />,
  Gradient: () => <div data-testid="gradient" />,
  VideoBar: () => <div data-testid="video-bar" />,
  VideoChatMessage: () => <div data-testid="video-chat" />,
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

vi.mock("../../assets/svg/ChatBubbleWing", () => ({ default: () => null }));

vi.mock("../../constants", () => ({
  brainwaveServices: ["Photo generating", "Photo enhance", "Seamless Integration"],
  brainwaveServicesIcons: ["icon1.svg", "icon2.svg", "icon3.svg", "icon4.svg", "icon5.svg"],
}));

describe("Services", () => {
  it("renders the section with how-to-use id", () => {
    render(<Services />);
    expect(document.getElementById("how-to-use")).toBeInTheDocument();
  });

  it("renders the heading", () => {
    render(<Services />);
    expect(screen.getByText("Generative AI made for creators.")).toBeInTheDocument();
  });

  it("renders Smartest AI title", () => {
    render(<Services />);
    expect(screen.getByText("Smartest AI")).toBeInTheDocument();
  });

  it("renders Photo editing title", () => {
    render(<Services />);
    expect(screen.getByText("Photo editing")).toBeInTheDocument();
  });

  it("renders Video generation title", () => {
    render(<Services />);
    expect(screen.getByText("Video generation")).toBeInTheDocument();
  });

  it("renders all brainwave service items", () => {
    render(<Services />);
    expect(screen.getByText("Photo generating")).toBeInTheDocument();
    expect(screen.getByText("Photo enhance")).toBeInTheDocument();
    expect(screen.getByText("Seamless Integration")).toBeInTheDocument();
  });

  it("renders service icons", () => {
    render(<Services />);
    const icons = document.querySelectorAll("ul li img");
    expect(icons.length).toBeGreaterThanOrEqual(5);
  });

  it("renders the Generating component", () => {
    render(<Services />);
    expect(screen.getByTestId("generating")).toBeInTheDocument();
  });

  it("renders the PhotoChatMessage component", () => {
    render(<Services />);
    expect(screen.getByTestId("photo-chat")).toBeInTheDocument();
  });

  it("renders the VideoChatMessage and VideoBar components", () => {
    render(<Services />);
    expect(screen.getByTestId("video-chat")).toBeInTheDocument();
    expect(screen.getByTestId("video-bar")).toBeInTheDocument();
  });
});
