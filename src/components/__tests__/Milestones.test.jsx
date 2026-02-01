import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Milestones from "../Milestones";

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

vi.mock("../../constants", () => ({
  milestones: [
    { id: "0", date: "2015", title: "Company Founded", text: "Founded in Basel", status: "done" },
    { id: "1", date: "2017-2018", title: "Grants & Recognition", text: "CTI Innovation Grant", status: "done" },
    { id: "2", date: "2019-2022", title: "Preclinical Advancement", text: "IND-enabling studies", status: "done" },
    { id: "3", date: "2025", title: "Clinical Preparation", text: "Series A financing", status: "progress" },
  ],
}));

describe("Milestones", () => {
  it("renders the section with news id", () => {
    render(<Milestones />);
    expect(document.getElementById("news")).toBeInTheDocument();
  });

  it("renders the heading with correct tag and title", () => {
    render(<Milestones />);
    expect(screen.getByText("Company History")).toBeInTheDocument();
    expect(screen.getByText("Key Milestones")).toBeInTheDocument();
  });

  it("renders all milestone titles", () => {
    render(<Milestones />);
    expect(screen.getByText("Company Founded")).toBeInTheDocument();
    expect(screen.getByText("Grants & Recognition")).toBeInTheDocument();
    expect(screen.getByText("Preclinical Advancement")).toBeInTheDocument();
    expect(screen.getByText("Clinical Preparation")).toBeInTheDocument();
  });

  it("renders milestone dates", () => {
    render(<Milestones />);
    expect(screen.getByText("2015")).toBeInTheDocument();
    expect(screen.getByText("2017-2018")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
  });

  it("renders milestone descriptions", () => {
    render(<Milestones />);
    expect(screen.getByText("Founded in Basel")).toBeInTheDocument();
    expect(screen.getByText("CTI Innovation Grant")).toBeInTheDocument();
  });

  it("shows Complete badge for done milestones", () => {
    render(<Milestones />);
    const completeBadges = screen.getAllByText("Complete");
    expect(completeBadges).toHaveLength(3);
  });

  it("shows In Progress badge for progress milestones", () => {
    render(<Milestones />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});
