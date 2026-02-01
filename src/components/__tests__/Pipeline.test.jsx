import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Pipeline from "../Pipeline";

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

vi.mock("../../assets", () => ({
  check: "check.svg",
}));

vi.mock("../../constants", () => ({
  pipeline: [
    {
      id: "0",
      name: "SR-001",
      title: "SR-001 for Retinitis Pigmentosa",
      status: "IND-Enabling Studies",
      indication: "Retinitis pigmentosa (multiple genetic subtypes)",
      route: "Intravitreal injection",
      highlights: ["Mutation-agnostic approach", "Favorable safety profile"],
    },
    {
      id: "1",
      name: "SR-002",
      title: "SR-002 for Dry AMD",
      status: "Preclinical Development",
      indication: "Dry age-related macular degeneration",
      route: "Intravitreal injection",
      highlights: ["Complementary mechanism"],
    },
    {
      id: "2",
      name: "Exploratory",
      title: "Optic Neuropathy & CNS",
      status: "Research Stage",
      indication: "Optic atrophy, glaucoma, CNS diseases",
      route: "TBD",
      highlights: ["Retinal ganglion cell protection"],
    },
  ],
}));

describe("Pipeline", () => {
  it("renders the section with science id", () => {
    render(<Pipeline />);
    expect(document.getElementById("science")).toBeInTheDocument();
  });

  it("renders the heading with correct tag and title", () => {
    render(<Pipeline />);
    expect(screen.getByText("Our Pipeline")).toBeInTheDocument();
    expect(screen.getByText("A Differentiated Approach to Neuroprotection")).toBeInTheDocument();
  });

  it("renders the intro paragraph", () => {
    render(<Pipeline />);
    expect(screen.getByText(/cellular pathways critical for neuronal survival/)).toBeInTheDocument();
  });

  it("renders all pipeline program names", () => {
    render(<Pipeline />);
    expect(screen.getByText("SR-001")).toBeInTheDocument();
    expect(screen.getByText("SR-002")).toBeInTheDocument();
    expect(screen.getByText("Exploratory")).toBeInTheDocument();
  });

  it("renders status badges", () => {
    render(<Pipeline />);
    expect(screen.getByText("IND-Enabling Studies")).toBeInTheDocument();
    expect(screen.getByText("Preclinical Development")).toBeInTheDocument();
    expect(screen.getByText("Research Stage")).toBeInTheDocument();
  });

  it("renders indications", () => {
    render(<Pipeline />);
    expect(screen.getByText(/Retinitis pigmentosa/)).toBeInTheDocument();
    expect(screen.getByText(/Dry age-related macular degeneration/)).toBeInTheDocument();
  });

  it("renders highlights as list items", () => {
    render(<Pipeline />);
    expect(screen.getByText("Mutation-agnostic approach")).toBeInTheDocument();
    expect(screen.getByText("Favorable safety profile")).toBeInTheDocument();
    expect(screen.getByText("Complementary mechanism")).toBeInTheDocument();
  });

  it("renders check icons for highlights", () => {
    render(<Pipeline />);
    const checkIcons = screen.getAllByAltText("Check");
    expect(checkIcons.length).toBe(4);
  });
});
