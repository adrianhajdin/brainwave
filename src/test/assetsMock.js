// Comprehensive mock for src/assets/index.js
// Every export returns a string stub
const exports = [
  "logo", "check", "check2", "loading1", "logoSymbol",
  "logoWhiteSymbol", "play", "gradient", "smallSphere", "grid",
  "yourlogo", "homeSmile", "file02", "searchMd", "plusSquare",
  "recording03", "recording01", "disc02", "chromecast", "sliders04",
  "loading", "background", "curve", "robot", "heroBackground",
  "curve1", "curve2", "discord", "figma", "framer", "notion",
  "photoshop", "protopie", "raindrop", "slack",
  "service1", "service2", "service3",
  "lines", "stars",
  "coins", "done", "hero", "roadmap1", "roadmap2", "roadmap3", "roadmap4", "undone",
  "notification1", "notification2", "notification3", "notification4",
  "benefitCard1", "benefitCard2", "benefitCard3", "benefitCard4",
  "benefitCard5", "benefitCard6",
  "benefitIcon1", "benefitIcon2", "benefitIcon3", "benefitIcon4", "benefitImage2",
  "discordBlack", "facebook", "instagram", "telegram", "twitter",
];

const mock = {};
exports.forEach((name) => { mock[name] = `${name}.svg`; });

export default mock;
