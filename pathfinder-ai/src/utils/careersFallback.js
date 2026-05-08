// Static fallback for the careers dropdown. Mirrors backend's CAREER_CATEGORIES
// so the Industry / Career Role selectors are instantly populated even if the
// backend is cold-starting on Render. The /api/careers fetch still runs in the
// background and overrides this if it ever drifts.
export const CAREERS_FALLBACK = {
  "💻 Technology": [
    "AI & Machine Learning Engineer",
    "Data Scientist",
    "Cybersecurity Analyst",
    "Cloud Solutions Architect",
    "Full Stack Developer",
    "DevOps Engineer",
    "Blockchain Developer",
    "Mobile App Developer",
    "Data Engineer",
    "Software Quality Assurance Engineer",
  ],
  "🩺 Healthcare": [
    "Medical Data Analyst",
    "Telehealth Specialist",
    "Biomedical Engineer",
    "Clinical Research Associate",
    "Healthcare Administrator",
    "Public Health Specialist",
    "Medical Laboratory Technologist",
    "Physiotherapist",
    "Pharmacy Manager",
    "Healthcare IT Consultant",
  ],
  "💼 Business": [
    "Business Analyst",
    "Digital Marketing Strategist",
    "Financial Data Analyst",
    "Product Manager",
    "HR Analytics Specialist",
    "Management Consultant",
    "Supply Chain Analyst",
    "Investment Banker",
    "Brand Manager",
    "Operations Manager",
  ],
  "🎥 Content Creation": [
    "Video Content Strategist",
    "Social Media Manager",
    "Copywriter / Content Writer",
    "Graphic Designer",
    "SEO Specialist",
    "Podcast Producer",
    "UX/UI Designer",
    "Video Editor",
    "Influencer Marketing Manager",
    "Content Marketing Strategist",
  ],
}
