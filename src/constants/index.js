import {
  benefitIcon1,
  benefitIcon2,
  benefitIcon3,
  benefitIcon4,
  benefitImage2,
  chromecast,
  disc02,
  discord,
  discordBlack,
  facebook,
  figma,
  file02,
  framer,
  homeSmile,
  instagram,
  notification2,
  notification3,
  notification4,
  notion,
  photoshop,
  plusSquare,
  protopie,
  raindrop,
  recording01,
  recording03,
  roadmap1,
  roadmap2,
  roadmap3,
  roadmap4,
  searchMd,
  slack,
  sliders04,
  telegram,
  twitter,
  yourlogo,
} from "../assets";

export const navigation = [
  {
    id: "0",
    title: "Features",
    url: "#features",
  },
  {
    id: "1",
    title: "Pricing",
    url: "#pricing",
  },
  {
    id: "2",
    title: "How to use",
    url: "#how-to-use",
  },
  {
    id: "3",
    title: "Roadmap",
    url: "#roadmap",
  },
  {
    id: "4",
    title: "New account",
    url: "#signup",
    onlyMobile: true,
  },
  {
    id: "5",
    title: "Sign in",
    url: "#login",
    onlyMobile: true,
  },
];

export const heroIcons = [homeSmile, file02, searchMd, plusSquare];

export const notificationImages = [notification4, notification3, notification2];

export const companyLogos = [yourlogo, yourlogo, yourlogo, yourlogo, yourlogo];

export const brainwaveServices = [
  "Interactive AR Learning",
  "Gesture Recognition",
  "Real-time Problem Solving",
];

export const brainwaveServicesIcons = [
  recording03,
  recording01,
  disc02,
  chromecast,
  sliders04,
];

export const roadmap = [
  {
    id: "0",
    title: "AR Integration",
    text: "Implement advanced AR features for 3D mathematical visualization and interactive learning experiences.",
    date: "Q2 2024",
    status: "done",
    imageUrl: roadmap1,
    colorful: true,
  },
  {
    id: "1",
    title: "Gesture Recognition",
    text: "Develop and refine gesture-based problem-solving capabilities for natural mathematical interaction.",
    date: "Q3 2024",
    status: "progress",
    imageUrl: roadmap2,
  },
  {
    id: "2",
    title: "AI Tutor Enhancement",
    text: "Enhance the AI tutor with advanced personalization and adaptive learning algorithms.",
    date: "Q4 2024",
    status: "done",
    imageUrl: roadmap3,
  },
  {
    id: "3",
    title: "Institutional Integration",
    text: "Develop comprehensive tools for educational institutions and classroom integration.",
    date: "Q1 2025",
    status: "progress",
    imageUrl: roadmap4,
  },
];

export const collabText =
  "With smart automation and top-notch security, it's the perfect solution for teams looking to work smarter.";

export const collabContent = [
  {
    id: "0",
    title: "Seamless Integration",
    text: collabText,
  },
  {
    id: "1",
    title: "Smart Automation",
  },
  {
    id: "2",
    title: "Top-notch Security",
  },
];

export const collabApps = [
  {
    id: "0",
    title: "Figma",
    icon: figma,
    width: 26,
    height: 36,
  },
  {
    id: "1",
    title: "Notion",
    icon: notion,
    width: 34,
    height: 36,
  },
  {
    id: "2",
    title: "Discord",
    icon: discord,
    width: 36,
    height: 28,
  },
  {
    id: "3",
    title: "Slack",
    icon: slack,
    width: 34,
    height: 35,
  },
  {
    id: "4",
    title: "Photoshop",
    icon: photoshop,
    width: 34,
    height: 34,
  },
  {
    id: "5",
    title: "Protopie",
    icon: protopie,
    width: 34,
    height: 34,
  },
  {
    id: "6",
    title: "Framer",
    icon: framer,
    width: 26,
    height: 34,
  },
  {
    id: "7",
    title: "Raindrop",
    icon: raindrop,
    width: 38,
    height: 32,
  },
];

export const pricing = [
  {
    id: "0",
    title: "Student",
    description: "For individual students and parents, offering full access to the AI tutor and core features.",
    price: "19.99",
    features: [
      "Full AI tutor access for a single user ",
      "Gesture-based problem solving",
      "Interactive voice guidance",
      "Freemium option with access to core features",
      "Upgrade anytime for premium capabilities",
    ],
  },
  {
    id: "1",
    title: "Institutional",
    description: "For schools and universities to embed NumenAI into their classroom and online learning platforms.",
    price: "5000",
    features: [
      "Starts at €5,000/year per institution",
      "Enable for multiple student accounts",
      "Full access to AR and gesture-based features",
      "Tools for classroom teaching integration",
    ],
  },
  {
    id: "2",
    title: "Enterprise & Partner",
    description: "For EdTech companies looking to integrate NumenAI under their own brand with full customization.",
    price: null,
    features: [
      "White-label options to use your own brand",
      "Full customization and integration",
      "Custom pricing based on scale and usage",
      "Dedicated support and API access",
    ],
  },
];

export const benefits = [
  {
    id: "0",
    title: "Interactive AR Learning",
    text: "Transform static mathematical concepts into dynamic, interactive 3D models using Augmented Reality technology.",
    backgroundUrl: "./src/assets/benefits/card-1.svg",
    iconUrl: benefitIcon1,
    imageUrl: benefitImage2,
  },
  {
    id: "1",
    title: "Gesture-Based Learning",
    text: "Write and solve mathematical problems naturally using gesture recognition technology, just like in a real classroom.",
    backgroundUrl: "./src/assets/benefits/card-2.svg",
    iconUrl: benefitIcon2,
    imageUrl: benefitImage2,
    light: true,
  },
  {
    id: "2",
    title: "AI-Powered Tutoring",
    text: "Get personalized guidance from our AI tutor that adapts to your learning style and pace.",
    backgroundUrl: "./src/assets/benefits/card-3.svg",
    iconUrl: benefitIcon3,
    imageUrl: benefitImage2,
  },
  {
    id: "3",
    title: "Step-by-Step Solutions",
    text: "Receive detailed, color-coded explanations for every mathematical concept and problem.",
    backgroundUrl: "./src/assets/benefits/card-4.svg",
    iconUrl: benefitIcon4,
    imageUrl: benefitImage2,
    light: true,
  },
  {
    id: "4",
    title: "Dynamic Textbook Reader",
    text: "Transform traditional textbooks into interactive learning experiences with our AR-based reader.",
    backgroundUrl: "./src/assets/benefits/card-5.svg",
    iconUrl: benefitIcon1,
    imageUrl: benefitImage2,
  },
  {
    id: "5",
    title: "Real-Time Feedback",
    text: "Get instant feedback and guidance as you solve problems, helping you learn from your mistakes.",
    backgroundUrl: "./src/assets/benefits/card-6.svg",
    iconUrl: benefitIcon2,
    imageUrl: benefitImage2,
  },
];

export const socials = [
  {
    id: "0",
    title: "Discord",
    iconUrl: discordBlack,
    url: "#",
  },
  {
    id: "1",
    title: "Twitter",
    iconUrl: twitter,
    url: "#",
  },
  {
    id: "2",
    title: "Instagram",
    iconUrl: instagram,
    url: "#",
  },
  {
    id: "3",
    title: "Telegram",
    iconUrl: telegram,
    url: "#",
  },
  {
    id: "4",
    title: "Facebook",
    iconUrl: facebook,
    url: "#",
  },
];
