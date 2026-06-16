export const SITE_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/why-we-built-this", label: "Why We Built This" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/testimonials", label: "Testimonials" },
] as const;

export const SITE_FOOTER_LINKS = [
  { href: "/about", label: "About Counterpoint" },
  { href: "/why-we-built-this", label: "Why we created this" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/testimonials", label: "Selected testimonials" },
] as const;

export const SAMPLE_TESTIMONIALS = [
  {
    name: "Maya R.",
    role: "High school debate captain",
    quote:
      "Counterpoint feels like the first practice tool that actually punishes lazy warrants instead of praising me for sounding confident.",
  },
  {
    name: "Eli T.",
    role: "College student preparing for interviews",
    quote:
      "I came in for debate drills and stayed for the rebuttal coaching. It is basically verbal sparring with receipts.",
  },
  {
    name: "Jordan P.",
    role: "Speech and civics teacher",
    quote:
      "The reports are the best part. Students do not just learn whether they lost; they learn exactly where the round slipped.",
  },
  {
    name: "Nina C.",
    role: "Mock trial student",
    quote:
      "Switching personalities makes it feel like you are preparing for different judges, opponents, and energy levels instead of one generic practice tool.",
  },
  {
    name: "Sam D.",
    role: "Founder who wanted sharper thinking",
    quote:
      "Some days I do not even care about the topic. I just want the app to make me argue cleaner than I did yesterday.",
  },
  {
    name: "Avery L.",
    role: "Policy nerd and chronic over-explainer",
    quote:
      "It catches the exact thing I overdo: long assertions with no clean weighing line. That alone has made my rounds tighter.",
  },
] as const;

export const ORIGIN_NOTES = [
  {
    title: "Most practice is too polite",
    body:
      "A lot of argument tools either feel academic in a dead way or supportive in a fake way. We wanted pressure that still teaches.",
  },
  {
    title: "People need reps, not lectures",
    body:
      "Good debaters improve by taking live shots, getting punished for weak reasoning, then trying again immediately with a better sentence.",
  },
  {
    title: "Feedback should create momentum",
    body:
      "The end screen should not feel like homework. It should make you want one more round because the fix is clear and the next rep is obvious.",
  },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    title: "Build the matchup",
    body:
      "Choose your topic, your side, the opponent personality, and the response style you want to survive.",
  },
  {
    title: "Take live pressure",
    body:
      "The opponent pushes your logic, evidence, and framing instead of just agreeing that you sound smart.",
  },
  {
    title: "Get coached like it mattered",
    body:
      "When the round ends, the report breaks the debate into skills, missed chances, and the exact fix worth drilling next.",
  },
] as const;

export const ABOUT_FAQS = [
  {
    question: "Is this for formal debaters only?",
    answer:
      "No. It is for students, founders, interview preppers, creators, and anyone who wants stronger verbal reasoning under pressure.",
  },
  {
    question: "Why the personality modes?",
    answer:
      "Different opponents reward different habits. Some force cleaner evidence, some punish vague definitions, and some mainly test composure.",
  },
  {
    question: "Why do the reports go so deep?",
    answer:
      "Because most people do not lose debates for one giant reason. They lose them through small structural leaks that only become obvious when the round is unpacked carefully.",
  },
] as const;
