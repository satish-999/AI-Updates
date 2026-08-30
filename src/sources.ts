/**
 * Starter source list.
 *
 * `weight` is an authority score from 0 to 1. It feeds the importance formula.
 * Primary sources (the lab actually announcing the thing) score highest;
 * aggregators and community feeds score lower because they amplify rather
 * than originate.
 *
 * NOT ALL OF THESE URLS ARE GUARANTEED LIVE — feeds move and break constantly.
 * The ingest script logs failures to sources.last_error. After the first run,
 * check that column and prune or fix whatever failed. This is normal.
 */

export type SourceSeed = {
  name: string;
  feed_url: string;
  site_url?: string;
  kind?: "rss" | "youtube" | "reddit";
  weight: number;
};

export const SOURCES: SourceSeed[] = [
  // ---- Primary: the labs themselves. Highest authority. ----
  // Anthropic publishes no RSS/Atom feed — anthropic.com/news advertises no
  // <link rel="alternate"> and every conventional path 404s. Their launches
  // still arrive via press coverage, just without the 1.0 primary weight.
  // Fixing this properly means a scraped source kind; see PLAN.md.
  { name: "OpenAI Blog",           feed_url: "https://openai.com/blog/rss.xml",                           weight: 1.0 },
  { name: "Google DeepMind",       feed_url: "https://deepmind.google/blog/rss.xml",                      weight: 1.0 },
  { name: "Google AI Blog",        feed_url: "https://blog.google/technology/ai/rss/",                    weight: 0.9 },
  { name: "Meta AI Research",      feed_url: "https://engineering.fb.com/category/ai-research/feed/",     weight: 0.9 },
  { name: "Hugging Face Blog",     feed_url: "https://huggingface.co/blog/feed.xml",                      weight: 0.8 },
  { name: "Mistral AI",            feed_url: "https://mistral.ai/rss.xml",                                weight: 0.9 },

  // ---- Research ----
  { name: "arXiv cs.AI",           feed_url: "http://export.arxiv.org/rss/cs.AI",                         weight: 0.6 },
  { name: "arXiv cs.CL",           feed_url: "http://export.arxiv.org/rss/cs.CL",                         weight: 0.6 },
  { name: "arXiv cs.LG",           feed_url: "http://export.arxiv.org/rss/cs.LG",                         weight: 0.6 },

  // ---- Press: high volume, this is where coverage velocity comes from ----
  { name: "TechCrunch AI",         feed_url: "https://techcrunch.com/category/artificial-intelligence/feed/", weight: 0.7 },
  { name: "VentureBeat AI",        feed_url: "https://venturebeat.com/category/ai/feed/",                 weight: 0.65 },
  { name: "The Verge AI",          feed_url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", weight: 0.7 },
  { name: "Ars Technica",          feed_url: "https://feeds.arstechnica.com/arstechnica/technology-lab",   weight: 0.65 },
  { name: "MIT Tech Review",       feed_url: "https://www.technologyreview.com/feed/",                     weight: 0.75 },

  // ---- Funding / startups ----
  { name: "Crunchbase News AI",    feed_url: "https://news.crunchbase.com/sections/ai/feed/",              weight: 0.7 },

  // ---- Analysis: low volume, high signal ----
  { name: "Import AI",             feed_url: "https://importai.substack.com/feed",                         weight: 0.85 },
  { name: "Simon Willison",        feed_url: "https://simonwillison.net/atom/everything/",                 weight: 0.8 },
  { name: "Latent Space",          feed_url: "https://www.latent.space/feed",                              weight: 0.75 },
  { name: "Interconnects",         feed_url: "https://www.interconnects.ai/feed",                          weight: 0.8 },
  { name: "AI News (smol.ai)",     feed_url: "https://buttondown.com/ainews/rss",                          weight: 0.7 },

  // ---- Community: breaks fast, noisy. Low weight on purpose. ----
  { name: "r/LocalLLaMA",          feed_url: "https://www.reddit.com/r/LocalLLaMA/.rss",  kind: "reddit",  weight: 0.4 },
  { name: "r/MachineLearning",     feed_url: "https://www.reddit.com/r/MachineLearning/.rss", kind: "reddit", weight: 0.4 },
  { name: "HN (AI, 100+ points)",  feed_url: "https://hnrss.org/newest?q=AI&points=100",                   weight: 0.5 },
];
