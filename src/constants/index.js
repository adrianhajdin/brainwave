import {
  discordBlack,
  twitter,
} from "../assets";

export const navigation = [
  {
    id: "0",
    title: "About",
    url: "#about",
  },
  {
    id: "1",
    title: "Science",
    url: "#science",
  },
  {
    id: "2",
    title: "News",
    url: "#news",
  },
  {
    id: "3",
    title: "Investors",
    url: "#science",
  },
  {
    id: "4",
    title: "Contact",
    url: "#contact",
    onlyMobile: true,
  },
];

export const valueProps = [
  {
    id: "0",
    title: "Novel Mechanism",
    text: "Our platform targets cellular pathways essential for neuronal survival, offering a differentiated approach to neuroprotection.",
  },
  {
    id: "1",
    title: "Validated Science",
    text: "Preclinical studies demonstrate significant preservation of retinal structure and function in validated disease models.",
  },
  {
    id: "2",
    title: "Broad Potential",
    text: "Platform technology designed for retinal applications with expansion potential across neurodegenerative indications.",
  },
];

export const pipeline = [
  {
    id: "0",
    name: "SR-001",
    title: "SR-001 for Retinitis Pigmentosa",
    status: "IND-Enabling Studies",
    indication: "Retinitis pigmentosa (multiple genetic subtypes)",
    route: "Intravitreal injection",
    highlights: [
      "Mutation-agnostic approach applicable across genetic subtypes",
      "Demonstrated efficacy in multiple RP models",
      "Monthly or quarterly dosing regimen anticipated",
      "Favorable preclinical safety profile",
    ],
  },
  {
    id: "1",
    name: "SR-002",
    title: "SR-002 for Dry AMD / Geographic Atrophy",
    status: "Preclinical Development",
    indication: "Dry age-related macular degeneration, geographic atrophy",
    route: "Intravitreal injection",
    highlights: [
      "Complementary mechanism to approved complement inhibitors",
      "Potential for combination therapy approaches",
      "Targets photoreceptor and RPE survival",
    ],
  },
  {
    id: "2",
    name: "Exploratory",
    title: "Optic Neuropathy & CNS Expansion",
    status: "Research Stage",
    indication: "Optic atrophy, glaucoma, CNS neurodegenerative diseases",
    route: "TBD",
    highlights: [
      "Platform mechanism applicable to retinal ganglion cell protection",
      "Broader neuronal populations in CNS (exploratory)",
      "Timeline contingent on lead program advancement",
    ],
  },
];

export const milestones = [
  {
    id: "0",
    date: "2015",
    title: "Company Founded",
    text: "SunRegen Healthcare founded in Basel, Switzerland. Initial seed financing completed and research collaboration established with University of Basel.",
    status: "done",
  },
  {
    id: "1",
    date: "2017–2018",
    title: "Grants & Recognition",
    text: "CTI Innovation Grant awarded. BaseLaunch Accelerator selection. BIO-Europe Startup Slam Winner in Copenhagen. European Commission SME Instrument Grant. Expansion to JLABS @ Basel.",
    status: "done",
  },
  {
    id: "2",
    date: "2019–2022",
    title: "Preclinical Advancement",
    text: "Innosuisse Innovation Project Grant secured. IND-enabling studies initiated. Strategic partnerships established with European research institutions. Clinical development planning advanced.",
    status: "done",
  },
  {
    id: "3",
    date: "2025",
    title: "Clinical Preparation",
    text: "Preparing for clinical trial initiation. Seeking Series A financing to advance SR-001 into Phase 1/2 clinical trials in retinitis pigmentosa.",
    status: "progress",
  },
];

export const socials = [
  {
    id: "0",
    title: "LinkedIn",
    iconUrl: discordBlack,
    url: "#",
  },
  {
    id: "1",
    title: "Twitter",
    iconUrl: twitter,
    url: "#",
  },
];
