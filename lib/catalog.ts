/** Editorial catalog. Every plan fact links to a provider source. Review dates
 * are not availability promises; the advisor excludes expired facts. */
export const GOALS = ["anime", "video", "voice", "music", "graphics", "social"] as const;
export type Goal = typeof GOALS[number];
export type Tool = {
  id: string; name: string; kind: "AI application" | "Open-weight model" | "Editor";
  goals: Goal[]; role: string; fit: string; limitation: string;
  url: string; source: string; rightsSource?: string; reviewed: string;
  device: "browser" | "desktop" | "gpu";
  plans: { name: string; monthlyUSD: number | null; allowance: string; commercial: "conditional" | "no" | "unverified"; rights: string }[];
};
export const CATALOG: Tool[] = [
  { id: "runway", name: "Runway / Gen-4 family", kind: "AI application", goals: ["anime", "video", "social"], role: "Motion generation",
    fit: "Create short generated shots; test character references before producing a full sequence.", limitation: "Generation retries consume credits. Character continuity and final quality need review.",
    url: "https://runway.com/", source: "https://runway.com/pricing", reviewed: "2026-10-10", device: "browser",
    plans: [{ name: "Free", monthlyUSD: 0, allowance: "125 one-time credits; a selection of models.", commercial: "unverified", rights: "Commercial terms have not been verified in this catalog." },
      { name: "Standard", monthlyUSD: 15, allowance: "625 credits/month; no watermarks. Annual billing has different pricing.", commercial: "unverified", rights: "Verify output and input-asset rights before monetization." }] },
  { id: "firefly", name: "Adobe Firefly", kind: "AI application", goals: ["anime", "video", "graphics", "social"], role: "Visual generation",
    fit: "Explore original images and short visual concepts, then finish typography and editing separately.", limitation: "Allowances vary by model and feature. Partner models have their own terms.",
    url: "https://firefly.adobe.com/", source: "https://www.adobe.com/products/firefly/plans.html", rightsSource: "https://helpx.adobe.com/creative-cloud/apps/generative-ai/generative-credits-faq.html", reviewed: "2026-10-10", device: "browser",
    plans: [{ name: "Free", monthlyUSD: 0, allowance: "Limited daily generations; check availability of the feature you need.", commercial: "conditional", rights: "For Adobe Firefly outputs: commercial use subject to feature terms. Review beta notices; this does not cover partner models." },
      { name: "Standard", monthlyUSD: 9.99, allowance: "2,000 generative credits/month; premium features consume credits.", commercial: "conditional", rights: "Use Adobe Firefly models and verify current feature and asset terms." }] },
  { id: "elevenlabs", name: "ElevenLabs", kind: "AI application", goals: ["voice", "anime", "video"], role: "Voice generation",
    fit: "Turn a finished script into narration; test pronunciations in a short sample.", limitation: "Voice/model choice affects credit use. Use voices and recordings you have permission to use.",
    url: "https://elevenlabs.io/", source: "https://elevenlabs.io/pricing", reviewed: "2026-10-10", device: "browser",
    plans: [{ name: "Free", monthlyUSD: 0, allowance: "10,000 credits/month.", commercial: "no", rights: "Commercial license is listed on paid plans, not this free tier." },
      { name: "Starter", monthlyUSD: 6, allowance: "30,000 credits/month; regular price excluding first-month promotions.", commercial: "conditional", rights: "Includes commercial license; comply with voice consent and content terms." }] },
  { id: "suno", name: "Suno", kind: "AI application", goals: ["music"], role: "Music generation",
    fit: "Explore musical concepts from a written brief, then review and edit the selected track.", limitation: "Upgrading does not automatically grant commercial rights to earlier free-plan songs.",
    url: "https://suno.com/", source: "https://help.suno.com/en/articles/2425729", rightsSource: "https://help.suno.com/en/articles/9601665", reviewed: "2026-10-10", device: "browser",
    plans: [{ name: "Free", monthlyUSD: 0, allowance: "Limited free generation; confirm the current credit allowance with Suno.", commercial: "no", rights: "Free-plan songs are for non-commercial use." },
      { name: "Pro", monthlyUSD: 10, allowance: "Paid entry plan; verify current credits and checkout pricing.", commercial: "conditional", rights: "Follow current paid-plan rights; do not assume retroactive licensing for free-plan tracks." }] },
  { id: "flux", name: "FLUX.1 [schnell]", kind: "Open-weight model", goals: ["anime", "graphics", "social"], role: "Local image generation",
    fit: "Generate image assets locally through a compatible interface such as ComfyUI.", limitation: "Requires setup and suitable compute. Free weights do not include hardware, electricity or hosted GPU time.",
    url: "https://huggingface.co/black-forest-labs/FLUX.1-schnell", source: "https://huggingface.co/black-forest-labs/FLUX.1-schnell", reviewed: "2026-10-10", device: "gpu",
    plans: [{ name: "Local weights", monthlyUSD: 0, allowance: "No model subscription; hardware and hosting costs excluded.", commercial: "conditional", rights: "Apache-2.0 model license; comply with license and applicable output/input rights." }] },
  { id: "krita", name: "Krita", kind: "Editor", goals: ["anime", "graphics"], role: "Drawing and cleanup",
    fit: "Draw character references and clean up artwork with a desktop painting tool.", limitation: "Manual editor, not a built-in generative AI service; drawing skills are useful.",
    url: "https://krita.org/en/", source: "https://krita.org/en/", reviewed: "2026-10-10", device: "desktop",
    plans: [{ name: "Free download", monthlyUSD: 0, allowance: "Free open-source painting software.", commercial: "unverified", rights: "Confirm rights to artwork, fonts, brushes and imported assets." }] },
  { id: "audacity", name: "Audacity", kind: "Editor", goals: ["voice", "music", "video", "anime"], role: "Audio recording and editing",
    fit: "Record your own voice and edit or mix audio on your computer.", limitation: "Manual recording/editing alternative; this recommendation does not include AI voice generation.",
    url: "https://www.audacityteam.org/", source: "https://www.audacityteam.org/", reviewed: "2026-10-10", device: "desktop",
    plans: [{ name: "Free download", monthlyUSD: 0, allowance: "Free open-source audio editor and recorder.", commercial: "unverified", rights: "Use original recordings or confirm licenses for imported audio." }] },
  { id: "canva", name: "Canva", kind: "Editor", goals: ["graphics", "social", "video", "anime"], role: "Layout and final assembly",
    fit: "Combine visuals, text and clips into a finished layout or social asset.", limitation: "Premium assets and AI features may require a paid plan. Check export and asset limits.",
    url: "https://www.canva.com/", source: "https://www.canva.com/pricing/", reviewed: "2026-10-10", device: "browser",
    plans: [{ name: "Free", monthlyUSD: 0, allowance: "Free design plan; AI allowances are not verified here.", commercial: "unverified", rights: "Check each asset's license; do not treat a free plan as a blanket commercial license." }] },
];

export const PLAYBOOKS: Record<Goal, { title: string; description: string; example: string; steps: string[]; prompt: string }> = {
  anime: { title: "Anime short", description: "Characters, scenes and motion", example: "A 30-second anime about an explorer finding a floating city.", steps: ["Write a short script and divide it into shots.", "Create a character sheet and consistent visual references.", "Test one short motion shot before generating the full sequence.", "Add your own or licensed narration, assemble the shots and check continuity."], prompt: "Create a six-shot storyboard. Include action, framing, movement, duration and character-continuity notes. Use original characters." },
  video: { title: "AI video", description: "From concept to finished clips", example: "A short product video for my handmade accessories.", steps: ["Define your message, audience and aspect ratio.", "Prepare images and assets you have permission to use.", "Generate a short test; check that products and people remain accurate.", "Edit selected clips, add audio and captions, and review the final export."], prompt: "Write a concise shot list with camera directions, captions and duration. Keep product details accurate." },
  voice: { title: "Voiceover", description: "Narration, dialogue and audio", example: "A clear, calm voiceover for a one-minute tutorial.", steps: ["Write and proofread a spoken script.", "Choose a voice you may use, or record your own.", "Test pronunciation and pacing with a short sample.", "Generate or record the final take, then mix and review the full audio."], prompt: "Draft natural spoken narration. Mark pauses and pronunciation notes. Keep sentences clear and easy to speak." },
  music: { title: "Music", description: "Soundtracks and song concepts", example: "An original instrumental soundtrack for a travel montage.", steps: ["Define mood, instruments, tempo feel and length.", "Generate a few contrasting concepts or record your own composition.", "Check the selected track's licensing before publishing.", "Edit timing and volume to fit the finished project."], prompt: "Write three original soundtrack briefs with mood, instruments, tempo feel and structure. Avoid imitating a named artist." },
  graphics: { title: "Graphic design", description: "Posters, artwork and visuals", example: "A promotional poster for a local creative workshop.", steps: ["Define dimensions, audience and the main message.", "Generate or draw an original visual concept.", "Add accurate typography and branding in a layout editor.", "Check readability, asset rights and export dimensions."], prompt: "Create a visual brief with composition, palette, subject placement and space for typography. Keep final text separate from generated art." },
  social: { title: "Social content", description: "Reels, thumbnails and posts", example: "Three coordinated social posts introducing my small business.", steps: ["Choose one message and audience for each post.", "Create a consistent visual style and reusable layout.", "Write captions and verify factual claims.", "Preview on a phone, export and evaluate audience feedback."], prompt: "Plan three related social posts. Give each a message, visual direction, caption and call to action with a consistent style." },
};
