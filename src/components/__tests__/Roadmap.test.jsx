import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Roadmap from "../Roadmap";

vi.mock("../Button", () => ({
  default: ({ children, href }) => <a data-testid="roadmap-button" href={href}>{children}</a>,
}));

vi.mock("../Heading", () => ({
  default: ({ tag, title }) => (
    <div data-testid="heading">
      <span>{tag}</span>
      <h2>{title}</h2>
    </div>
  ),
}));

vi.mock("../Section", () => ({
  default: ({ children, id }) => <div data-testid="section" id={id}>{children}</div>,
}));

vi.mock("../Tagline", () => ({
  default: ({ children }) => <div data-testid="tagline">{children}</div>,
}));

vi.mock("../design/Roadmap", () => ({
  Gradient: () => <div data-testid="gradient" />,
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
  roadmap: [
    {
      id: "0",
      title: "Voice recognition",
      text: "Enable voice commands",
      date: "May 2023",
      status: "done",
      imageUrl: "roadmap1.png",
      colorful: true,
    },
    {
      id: "1",
      title: "Gamification",
      text: "Add game elements",
      date: "May 2023",
      status: "progress",
      imageUrl: "roadmap2.png",
    },
  ],
}));

describe("Roadmap", () => {
  it("renders the section with roadmap id", () => {
    render(<Roadmap />);
    expect(document.getElementById("roadmap")).toBeInTheDocument();
  });

  it("renders the heading with correct tag and title", () => {
    render(<Roadmap />);
    expect(screen.getByText("Ready to get started")).toBeInTheDocument();
    expect(screen.getByText(/What we.re working on/)).toBeInTheDocument();
  });

  it("renders all roadmap items", () => {
    render(<Roadmap />);
    expect(screen.getByText("Voice recognition")).toBeInTheDocument();
    expect(screen.getByText("Gamification")).toBeInTheDocument();
  });

  it("renders item descriptions", () => {
    render(<Roadmap />);
    expect(screen.getByText("Enable voice commands")).toBeInTheDocument();
    expect(screen.getByText("Add game elements")).toBeInTheDocument();
  });

  it("maps status correctly - 'done' becomes 'Done'", () => {
    render(<Roadmap />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("maps status correctly - 'progress' becomes 'In progress'", () => {
    render(<Roadmap />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders date taglines", () => {
    render(<Roadmap />);
    const taglines = screen.getAllByTestId("tagline");
    expect(taglines).toHaveLength(2);
    expect(taglines[0]).toHaveTextContent("May 2023");
  });

  it("uses check icon for done status", () => {
    render(<Roadmap />);
    const doneImg = screen.getByAltText("Done");
    expect(doneImg).toHaveAttribute("src", "check2.svg");
  });

  it("uses loading icon for in-progress status", () => {
    render(<Roadmap />);
    const progressImg = screen.getByAltText("In progress");
    expect(progressImg).toHaveAttribute("src", "loading1.svg");
  });

  it("applies conic gradient for colorful items", () => {
    render(<Roadmap />);
    const items = document.querySelectorAll("[class*='bg-conic-gradient']");
    expect(items).toHaveLength(1);
  });

  it("renders Our roadmap button link", () => {
    render(<Roadmap />);
    const button = screen.getByTestId("roadmap-button");
    expect(button).toHaveTextContent("Our roadmap");
    expect(button).toHaveAttribute("href", "/roadmap");
  });
});
